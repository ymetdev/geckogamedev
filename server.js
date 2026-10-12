// GeckoBoard backend: zero-dependency HTTP server + JSON file store.
import http from 'node:http';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'db.json');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const TOKENINFO_URL = process.env.GOOGLE_TOKENINFO_URL || 'https://oauth2.googleapis.com/tokeninfo';
const INSECURE_LOGIN = process.env.ALLOW_INSECURE_EMAIL_LOGIN === '1'; // local dev only: email without verification
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase(); // bootstrap admin

export const STATUSES = ['open', 'in_progress', 'ready_to_test', 'complete'];
const TYPES = ['ticket', 'task'];
export const ROLES = ['admin', 'dev', 'tester'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

let db = { seq: 0, cards: [], users: [], sessions: {} };
let writeChain = Promise.resolve();
// Storage: Postgres when DATABASE_URL is set (Render/Neon), otherwise a local JSON file.
const DATABASE_URL = process.env.DATABASE_URL || '';
if (DATABASE_URL) { // fail early with a readable message (never prints the password)
  let u;
  try { u = new URL(DATABASE_URL); } catch { /* handled below */ }
  if (!u || !/^postgres(ql)?:$/.test(u.protocol) || !u.hostname.includes('.')) {
    console.error('DATABASE_URL is not a valid Postgres connection string. Paste only the value, e.g. postgresql://user:password@ep-xxxx.region.aws.neon.tech/dbname?sslmode=require (no quotes, no "psql", no "DATABASE_URL=" prefix).');
    process.exit(1);
  }
  console.log(`Using Postgres at ${u.hostname}`);
}
const pool = DATABASE_URL
  ? new pg.Pool({ connectionString: DATABASE_URL, max: 3, ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false } })
  : null;
if (pool) {
  await pool.query('CREATE TABLE IF NOT EXISTS devboard_state (id int PRIMARY KEY, data jsonb NOT NULL)');
  const r = await pool.query('SELECT data FROM devboard_state WHERE id = 1');
  if (r.rows[0]) db = r.rows[0].data;
} else {
  try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { /* fresh db */ }
}
db.users ||= []; db.sessions ||= {};
// Seed team from data/users.seed.json (adds missing emails only; later role changes in the UI are kept)
try {
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'users.seed.json'), 'utf8'));
  for (const u of seed) {
    const email = String(u.email).trim().toLowerCase();
    if (!db.users.some((x) => x.email === email) && ROLES.includes(u.role)) db.users.push(newUser(email, u.name || email.split('@')[0], u.role));
  }
} catch { /* no seed file */ }
// ADMIN_EMAIL env always ends up as admin
if (ADMIN_EMAIL) {
  const u = db.users.find((x) => x.email === ADMIN_EMAIL);
  if (u) u.role = 'admin'; else db.users.push(newUser(ADMIN_EMAIL, ADMIN_EMAIL.split('@')[0], 'admin'));
}
await save();
function save() {
  const snapshot = JSON.stringify(db);
  if (pool) { // serialized so writes land in order; callers await durability
    const write = writeChain.then(() => pool.query(
      'INSERT INTO devboard_state (id, data) VALUES (1, $1::jsonb) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data', [snapshot]));
    writeChain = write.catch(() => {}); // a failed write must not block later ones
    return write;
  }
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, snapshot);
  fs.renameSync(tmp, DB_FILE);
  return Promise.resolve();
}

import crypto from 'node:crypto';
function newUser(email, name, role) {
  return { email, name, role, token: crypto.randomBytes(24).toString('hex'), created_at: new Date().toISOString() };
}
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const publicUser = (u) => ({ email: u.email, name: u.name, role: u.role });
function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]));
}
function authUser(req) {
  const tok = req.headers['x-devboard-token'];
  if (tok) return db.users.find((u) => u.token === tok) || null; // MCP / API token
  const email = db.sessions[parseCookies(req).devboard_session];
  return email ? db.users.find((u) => u.email === email) || null : null;
}
const can = (user, ...roles) => roles.includes(user.role);
const forbid = (user, ...roles) => need(can(user, ...roles), 403, `Role "${user.role}" is not allowed to do this`);

const now = () => new Date().toISOString();
const log = (card, user, action, text = '') => {
  card.history.push({ at: now(), user: user || 'unknown', action, text });
  card.updated_at = now();
};
const clean = (s, max = 5000) => String(s ?? '').trim().slice(0, max);

function sendJson(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
  });
}
class HttpError extends Error { constructor(code, msg, extra) { super(msg); this.code = code; this.extra = extra; } }
const need = (cond, code, msg, extra) => { if (!cond) throw new HttpError(code, msg, extra); };
const find = (id) => {
  const c = db.cards.find((x) => x.id === Number(id));
  need(c, 404, `Card #${id} not found`);
  return c;
};

// ---- API routes ----
async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean).slice(1); // drop "api"
  const method = req.method;
  const body = method === 'GET' ? {} : await readBody(req);

  // ---- auth (no session needed) ----
  const startSession = async (email) => {
    const u = db.users.find((x) => x.email === email);
    need(u, 403, `${email} is not registered. Ask an admin to add you.`);
    const sid = crypto.randomBytes(24).toString('hex');
    db.sessions[sid] = email;
    await save();
    const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `devboard_session=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`);
    return sendJson(res, 200, { ...publicUser(u), token: u.token });
  };
  if (parts[0] === 'config' && method === 'GET') {
    return sendJson(res, 200, { googleClientId: GOOGLE_CLIENT_ID, emailLogin: INSECURE_LOGIN });
  }
  if (parts[0] === 'login' && parts[1] === 'google' && method === 'POST') {
    need(GOOGLE_CLIENT_ID, 503, 'Google sign-in is not configured (GOOGLE_CLIENT_ID)');
    need(typeof body.credential === 'string' && body.credential, 400, 'credential required');
    const r = await fetch(`${TOKENINFO_URL}?id_token=${encodeURIComponent(body.credential)}`);
    const info = await r.json().catch(() => ({}));
    need(r.ok && info.aud === GOOGLE_CLIENT_ID, 401, 'Invalid Google token');
    need(['accounts.google.com', 'https://accounts.google.com'].includes(info.iss), 401, 'Invalid token issuer');
    need(String(info.email_verified) === 'true' && Number(info.exp) * 1000 > Date.now(), 401, 'Google email not verified or token expired');
    return await startSession(String(info.email).toLowerCase());
  }
  if (parts[0] === 'login' && method === 'POST') {
    need(INSECURE_LOGIN, 403, 'Email-only login is disabled. Use Google sign-in.');
    const email = clean(body.email, 120).toLowerCase();
    need(isEmail(email), 400, 'Enter a valid email');
    return await startSession(email);
  }
  if (parts[0] === 'logout' && method === 'POST') {
    delete db.sessions[parseCookies(req).devboard_session];
    await save();
    res.setHeader('Set-Cookie', 'devboard_session=; Path=/; Max-Age=0');
    return sendJson(res, 200, { ok: true });
  }

  const me = authUser(req);
  need(me, 401, 'Not logged in');
  const user = me.email; // identity always comes from auth, never from the request body

  if (parts[0] === 'me' && method === 'GET') return sendJson(res, 200, { ...publicUser(me), token: me.token });

  // ---- users ----
  if (parts[0] === 'users') {
    if (parts.length === 1 && method === 'GET') return sendJson(res, 200, db.users.map(publicUser));
    forbid(me, 'admin');
    const email = clean(parts[1] ? decodeURIComponent(parts[1]) : body.email, 120).toLowerCase();
    if (method === 'POST' && parts.length === 1) {
      need(isEmail(email), 400, 'Invalid email');
      need(!db.users.some((u) => u.email === email), 409, 'Email already registered');
      need(ROLES.includes(body.role), 400, 'Invalid role');
      const u = newUser(email, clean(body.name, 60) || email.split('@')[0], body.role);
      db.users.push(u);
      await save();
      return sendJson(res, 201, publicUser(u));
    }
    const u = db.users.find((x) => x.email === email);
    need(u, 404, 'User not found');
    const admins = db.users.filter((x) => x.role === 'admin');
    if (method === 'PATCH') {
      if (body.role !== undefined) {
        need(ROLES.includes(body.role), 400, 'Invalid role');
        need(!(u.role === 'admin' && body.role !== 'admin' && admins.length === 1), 409, 'Cannot remove the last admin');
        u.role = body.role;
      }
      if (body.name !== undefined) u.name = clean(body.name, 60) || u.name;
      await save();
      return sendJson(res, 200, publicUser(u));
    }
    if (method === 'DELETE') {
      need(!(u.role === 'admin' && admins.length === 1), 409, 'Cannot remove the last admin');
      db.users = db.users.filter((x) => x !== u);
      for (const [sid, e] of Object.entries(db.sessions)) if (e === email) delete db.sessions[sid];
      await save();
      return sendJson(res, 200, { ok: true });
    }
    throw new HttpError(405, 'Method not allowed');
  }

  // ---- cards ----
  if (parts[0] === 'cards' && parts.length === 1 && method === 'GET') {
    let list = db.cards;
    const q = url.searchParams;
    if (q.get('type')) list = list.filter((c) => c.type === q.get('type'));
    if (q.get('status')) list = list.filter((c) => q.get('status').split(',').includes(c.status));
    if (q.get('assignee')) list = list.filter((c) => c.assignees.includes(q.get('assignee')));
    if (q.get('unassigned') === '1') list = list.filter((c) => c.assignees.length === 0);
    return sendJson(res, 200, list);
  }
  if (parts[0] === 'cards' && parts.length === 1 && method === 'POST') {
    const title = clean(body.title, 200);
    need(title, 400, 'title required');
    const type = TYPES.includes(body.type) ? body.type : 'task';
    const priority = PRIORITIES.includes(body.priority) ? body.priority : 'medium';
    const tags = (Array.isArray(body.tags) ? body.tags : String(body.tags || '').split(','))
      .map((t) => clean(t, 30)).filter(Boolean).slice(0, 8);
    const card = {
      id: ++db.seq, type, title, description: clean(body.description), priority, tags,
      reporter: user, status: 'open', assignees: [],
      dev_summary: '', test_steps: [], comments: [], history: [],
      created_at: now(), updated_at: now(),
    };
    log(card, user, 'created');
    db.cards.push(card);
    await save();
    return sendJson(res, 201, card);
  }

  if (parts[0] !== 'cards') throw new HttpError(404, 'Not found');
  const card = find(parts[1]);
  const action = parts[2];

  if (!action && method === 'GET') return sendJson(res, 200, card);
  if (!action && method === 'DELETE') {
    forbid(me, 'admin');
    db.cards = db.cards.filter((c) => c.id !== card.id);
    await save();
    return sendJson(res, 200, { ok: true });
  }
  if (!action && method === 'PATCH') {
    need(can(me, 'admin') || card.reporter === user, 403, 'Only the reporter or an admin can edit');
    for (const k of ['title', 'description']) if (body[k] !== undefined) card[k] = clean(body[k], k === 'title' ? 200 : 5000);
    if (PRIORITIES.includes(body.priority)) card.priority = body.priority;
    if (TYPES.includes(body.type)) card.type = body.type;
    log(card, user, 'edited');
    await save();
    return sendJson(res, 200, card);
  }

  need(method === 'POST', 405, 'Method not allowed');

  switch (action) {
    case 'claim': { // Dev marks "I'll do this"
      forbid(me, 'dev', 'admin');
      need(card.status !== 'complete', 409, 'Card already complete');
      const other = card.assignees.find((a) => a !== user); // one card, one owner
      need(!other, 409, `Already claimed by ${db.users.find((u) => u.email === other)?.name || other}`, { claimed_by: other });
      if (!card.assignees.includes(user)) card.assignees.push(user);
      if (card.status === 'open') card.status = 'in_progress';
      log(card, user, 'claimed');
      break;
    }
    case 'unclaim': {
      need(card.assignees.includes(user) || can(me, 'admin'), 403, 'Not your card');
      card.assignees = card.assignees.filter((a) => a !== (body.email && can(me, 'admin') ? body.email : user));
      if (card.assignees.length === 0 && card.status === 'in_progress') card.status = 'open';
      log(card, user, 'unclaimed');
      break;
    }
    case 'ready': { // Dev/Claude: fix done, ready for tester
      forbid(me, 'dev', 'admin');
      need(card.assignees.includes(user) || can(me, 'admin'), 403, 'Only an assignee can mark this ready');
      need(card.status === 'in_progress' || card.status === 'ready_to_test', 409, 'Card must be in progress first');
      const steps = (Array.isArray(body.test_steps) ? body.test_steps : []).map((s) => clean(s, 500)).filter(Boolean);
      need(steps.length > 0, 400, 'test_steps required (at least one step)');
      card.dev_summary = clean(body.summary);
      card.test_steps = steps;
      card.status = 'ready_to_test';
      log(card, user, 'ready_to_test', card.dev_summary);
      break;
    }
    case 'pass': { // Tester: passed -> complete
      forbid(me, 'tester', 'admin');
      need(card.status === 'ready_to_test', 409, 'Card is not ready to test');
      card.status = 'complete';
      card.completed_by = user;
      log(card, user, 'complete', clean(body.text));
      break;
    }
    case 'fail': { // Tester: send back to dev
      forbid(me, 'tester', 'admin');
      need(card.status === 'ready_to_test', 409, 'Card is not ready to test');
      const reason = clean(body.text);
      need(reason, 400, 'reason required');
      card.status = 'in_progress';
      card.comments.push({ at: now(), user, text: `❌ Test failed: ${reason}` });
      log(card, user, 'test_failed', reason);
      break;
    }
    case 'reopen': {
      forbid(me, 'tester', 'admin');
      card.status = card.assignees.length ? 'in_progress' : 'open';
      log(card, user, 'reopened', clean(body.text));
      break;
    }
    case 'comment': {
      const text = clean(body.text);
      need(text, 400, 'text required');
      card.comments.push({ at: now(), user, text });
      log(card, user, 'commented');
      break;
    }
    default: throw new HttpError(404, 'Unknown action');
  }
  await save();
  return sendJson(res, 200, card);
}

// ---- static files ----
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
function serveStatic(req, res, url) {
  const rel = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.join(__dirname, 'public', path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(path.join(__dirname, 'public'))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else serveStatic(req, res, url);
  } catch (e) {
    sendJson(res, e.code || 400, { error: e.message, ...e.extra });
  }
}).listen(PORT, () => console.log(`GeckoBoard running at http://localhost:${PORT}`));
