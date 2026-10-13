// GeckoBoard backend: zero-dependency HTTP server + JSON file store.
import http from 'node:http';
import pg from 'pg';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer as createMcpServer } from './mcp/tools.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'db.json');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const TOKENINFO_URL = process.env.GOOGLE_TOKENINFO_URL || 'https://oauth2.googleapis.com/tokeninfo';
const INSECURE_LOGIN = process.env.ALLOW_INSECURE_EMAIL_LOGIN === '1'; // local dev only: email without verification
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
const DISCORD_TESTER_ROLE_ID = (process.env.DISCORD_TESTER_ROLE_ID || '').replace(/\D/g, ''); // role to @mention when a card is ready to test
const PUBLIC_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(path.dirname(DB_FILE), 'uploads');
const FILE_TYPES = { // allowed attachments: mime -> max bytes
  'image/png': 6e6, 'image/jpeg': 6e6, 'image/gif': 8e6, 'image/webp': 6e6,
  'video/mp4': 12e6, 'video/webm': 12e6,
};
const MAX_FILES_PER_CARD = 20;
// Recycling policy: originals are purged (thumbnails stay) when storage nears the budget or a finished card gets old
const FILE_BUDGET = Math.round(Number(process.env.FILE_BUDGET_MB || 300) * 1e6);
const FILE_KEEP_DAYS = Number(process.env.FILE_KEEP_DAYS || 14);
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase(); // bootstrap admin

export const STATUSES = ['open', 'in_progress', 'ready_to_test', 'complete'];
const TYPES = ['ticket', 'task'];
export const ROLES = ['admin', 'dev', 'tester'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

let db = { seq: 0, cards: [], users: [], sessions: {} };
let writeChain = Promise.resolve();
let rev = 1; // bumps on every change; browsers hold an SSE stream and refetch when it changes
const sseClients = new Set();
const broadcast = () => { for (const r of sseClients) { try { r.write(`data: ${rev}\n\n`); } catch { sseClients.delete(r); } } };
const TRASH_DAYS = 7; // deleted cards can be restored (Undo) for this long
// Storage: Postgres when DATABASE_URL is set (Render/Neon), otherwise a local JSON file.
const DATABASE_URL = process.env.DATABASE_URL || '';
if (DATABASE_URL) { // fail early with a readable message (never prints the password)
  let u;
  try { u = new URL(DATABASE_URL); } catch { /* handled below */ }
  if (!u || !/^postgres(ql)?:$/.test(u.protocol) || !(u.hostname.includes('.') || u.hostname === 'localhost')) {
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
  await pool.query('CREATE TABLE IF NOT EXISTS devboard_blobs (hash text PRIMARY KEY, mime text NOT NULL, data bytea, thumb bytea)');
  await pool.query('CREATE TABLE IF NOT EXISTS devboard_backups (id serial PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), label text NOT NULL, size int NOT NULL, data jsonb NOT NULL)');
  const r = await pool.query('SELECT data FROM devboard_state WHERE id = 1');
  if (r.rows[0]) db = r.rows[0].data;
} else {
  try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { /* fresh db */ }
}
db.users ||= []; db.sessions ||= {}; db.trash ||= [];
// one-time migration: files from the first version (id-addressed table / raw files) -> content-addressed blobs
for (const c of db.cards) for (const f of c.files || []) {
  if (f.blob) continue;
  let buf = null;
  if (pool) { const ex = await pool.query("SELECT to_regclass('devboard_files') AS t"); if (ex.rows[0].t) buf = (await pool.query('SELECT data FROM devboard_files WHERE id = $1', [f.id])).rows[0]?.data || null; }
  else { try { buf = fs.readFileSync(path.join(UPLOAD_DIR, f.id)); } catch { /* missing */ } }
  if (buf) { f.blob = crypto.createHash('sha256').update(buf).digest('hex'); await putBlobEarly(f.blob, f.mime, buf); } else { f.blob = f.id; f.purged = true; }
}
async function putBlobEarly(hash, mime, buf) {
  if (pool) return pool.query('INSERT INTO devboard_blobs (hash, mime, data) VALUES ($1,$2,$3) ON CONFLICT (hash) DO NOTHING', [hash, mime, buf]);
  fs.mkdirSync(UPLOAD_DIR, { recursive: true }); fs.writeFileSync(path.join(UPLOAD_DIR, hash), buf);
}
for (const c of db.cards) { // upgrade older cards with the newer fields
  c.due ??= ''; c.milestone ??= ''; c.parent ??= null; c.related ??= []; c.files ??= [];
}
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
  rev++;
  const snapshot = JSON.stringify(db);
  if (pool) { // serialized so writes land in order; callers await durability
    const write = writeChain.then(() => pool.query(
      'INSERT INTO devboard_state (id, data) VALUES (1, $1::jsonb) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data', [snapshot]));
    writeChain = write.catch(() => {}); // a failed write must not block later ones
    write.then(broadcast, () => {});
    return write;
  }
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, snapshot);
  fs.renameSync(tmp, DB_FILE);
  broadcast();
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

const nameOfUser = (email) => db.users.find((u) => u.email === email)?.name || email;
// Discord webhook (fire-and-forget; never blocks or breaks the request). Language: DISCORD_LANG=th|en (default th)
const DLANG = (process.env.DISCORD_LANG || 'th') === 'en' ? 'en' : 'th';
const COLORS = { ready_to_test: 0xb48cff, test_failed: 0xf87171, complete: 0x4ade80, mention: 0x7c8cff, deleted: 0x6b7280 };
const DTXT = {
  en: { ready_to_test: '🧪 Ready to test', test_failed: '❌ Test failed — back to dev', complete: '✅ Complete', mention: '💬 You were mentioned', deleted: '🗑 Card deleted',
    dev: 'Dev', by: 'By', type: 'Type', priority: 'Priority', due: 'Due', ms: 'Milestone', tags: 'Tags', desc: 'Description', summary: 'What was done', steps: 'How to test',
    ping: '🧪 Card #{0} is ready for testing!', more: '…and {0} more steps', reason: 'Reason', comment: 'Comment', open: '🔗 Open card for details', status: 'Status', unassigned: 'Unassigned',
    st: { open: 'Open', in_progress: 'In Progress', ready_to_test: 'Ready to Test', complete: 'Complete' }, pri: { low: 'low', medium: 'medium', high: 'high', critical: 'critical' } },
  th: { ready_to_test: '🧪 พร้อมเทส', test_failed: '❌ เทสไม่ผ่าน — ส่งกลับให้ Dev', complete: '✅ เสร็จสิ้น', mention: '💬 มีคนแท็กคุณ', deleted: '🗑 ลบการ์ดแล้ว',
    dev: 'Dev', by: 'โดย', type: 'ประเภท', priority: 'ความสำคัญ', due: 'กำหนดส่ง', ms: 'Milestone', tags: 'Tag', desc: 'รายละเอียด', summary: 'สิ่งที่ทำ', steps: 'วิธีเทส',
    ping: '🧪 การ์ด #{0} พร้อมให้เทสแล้ว!', more: '…และอีก {0} ข้อ', reason: 'เหตุผล', comment: 'ความคิดเห็น', open: '🔗 กดเพื่อดูรายละเอียดการ์ด', status: 'สถานะ', unassigned: 'ยังไม่มีคนรับ',
    st: { open: 'เปิด', in_progress: 'กำลังทำ', ready_to_test: 'พร้อมเทส', complete: 'เสร็จสิ้น' }, pri: { low: 'ต่ำ', medium: 'ปานกลาง', high: 'สูง', critical: 'วิกฤต' } },
}[DLANG];
const PRI_ICON = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' };
const cut = (s, n) => { s = String(s || '').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
function notify(event, card, actor, text = '') {
  if (!DISCORD_WEBHOOK_URL) return;
  const url = PUBLIC_URL ? `${PUBLIC_URL}/#card-${card.id}` : '';
  const ping = event === 'ready_to_test' && !!DISCORD_TESTER_ROLE_ID;
  const owner = card.assignees[0] ? nameOfUser(card.assignees[0]) : DTXT.unassigned;
  const fields = [
    { name: DTXT.type, value: `${card.type === 'ticket' ? '🎫 Ticket' : '📋 Task'}`, inline: true },
    { name: DTXT.priority, value: `${PRI_ICON[card.priority]} ${DTXT.pri[card.priority]}`, inline: true },
    { name: DTXT.status, value: DTXT.st[card.status], inline: true },
    { name: DTXT.dev, value: owner, inline: true },
    { name: DTXT.by, value: nameOfUser(actor), inline: true },
  ];
  if (card.due) fields.push({ name: DTXT.due, value: card.due, inline: true });
  if (card.milestone) fields.push({ name: DTXT.ms, value: card.milestone, inline: true });
  if (card.tags.length) fields.push({ name: DTXT.tags, value: card.tags.map((t) => `\`${t}\``).join(' '), inline: false });
  if (event === 'ready_to_test') {
    if (card.dev_summary) fields.push({ name: DTXT.summary, value: cut(card.dev_summary, 400), inline: false });
    const steps = card.test_steps.slice(0, 5).map((x, i) => `${i + 1}. ${cut(x, 120)}`);
    if (card.test_steps.length > 5) steps.push(DTXT.more.replace('{0}', card.test_steps.length - 5));
    if (steps.length) fields.push({ name: DTXT.steps, value: steps.join('\n'), inline: false });
  } else if (event === 'test_failed') {
    fields.push({ name: DTXT.reason, value: cut(text, 500) || '—', inline: false });
  } else if (event === 'mention') {
    fields.push({ name: DTXT.comment, value: cut(text, 500), inline: false });
  }
  if (card.description && event !== 'ready_to_test') fields.push({ name: DTXT.desc, value: cut(card.description, 250), inline: false });
  if (url && event !== 'deleted') fields.push({ name: '\u200b', value: `**[${DTXT.open}](${url})**`, inline: false });
  const embed = {
    author: { name: DTXT[event] },
    title: cut(`#${card.id} · ${card.title}`, 250),
    url: event === 'deleted' ? undefined : (url || undefined),
    color: COLORS[event], fields,
    footer: { text: 'GeckoBoard' }, timestamp: new Date().toISOString(),
  };
  fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ping
      ? { content: `<@&${DISCORD_TESTER_ROLE_ID}> ${DTXT.ping.replace('{0}', card.id)}`, embeds: [embed], allowed_mentions: { roles: [DISCORD_TESTER_ROLE_ID] } }
      : { embeds: [embed], allowed_mentions: { parse: [] } }),
    signal: AbortSignal.timeout(5000),
  }).catch((e) => console.error('Discord notify failed:', e.message));
}
// "@name", "@email-prefix" or "@full@email" in a comment -> list of registered user emails
function findMentions(text) {
  const out = new Set();
  for (const m of text.matchAll(/@([\p{L}\p{N}_.\-@]+)/gu)) {
    const tok = m[1].replace(/[.\-]+$/, '').toLowerCase();
    for (const u of db.users) {
      if (u.email === tok || u.email.split('@')[0] === tok || u.name.toLowerCase().replace(/\s+/g, '') === tok) out.add(u.email);
    }
  }
  return [...out];
}
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
const cleanTags = (t) => (Array.isArray(t) ? t : String(t || '').split(',')).map((x) => clean(x, 30)).filter(Boolean).slice(0, 8);
function descendants(id) { // all sub-card ids under a card
  const out = new Set(); const stack = [id];
  while (stack.length) { const cur = stack.pop(); for (const c of db.cards) if (c.parent === cur && !out.has(c.id)) { out.add(c.id); stack.push(c.id); } }
  return out;
}
// Attachment storage, content-addressed (sha256): identical files are stored once and shared between cards.
// data = NULL means the original was recycled (the small thumbnail is kept). Postgres bytea, or ./data/uploads in file mode.
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const fp = (hash, thumb) => path.join(UPLOAD_DIR, hash + (thumb ? '.thumb' : ''));
async function putBlob(hash, mime, buf) {
  if (pool) return pool.query('INSERT INTO devboard_blobs (hash, mime, data) VALUES ($1,$2,$3) ON CONFLICT (hash) DO UPDATE SET data = EXCLUDED.data', [hash, mime, buf]);
  fs.mkdirSync(UPLOAD_DIR, { recursive: true }); fs.writeFileSync(fp(hash), buf);
}
async function putThumb(hash, buf) {
  if (pool) return pool.query('UPDATE devboard_blobs SET thumb = $2 WHERE hash = $1', [hash, buf]);
  fs.mkdirSync(UPLOAD_DIR, { recursive: true }); fs.writeFileSync(fp(hash, true), buf);
}
async function getBlob(hash, thumb = false) {
  if (pool) { const r = await pool.query(`SELECT ${thumb ? 'thumb' : 'data'} AS d FROM devboard_blobs WHERE hash = $1`, [hash]); return r.rows[0]?.d || null; }
  try { return fs.readFileSync(fp(hash, thumb)); } catch { return null; }
}
async function purgeBlob(hash) { // drop the original, keep the thumbnail
  if (pool) return pool.query('UPDATE devboard_blobs SET data = NULL WHERE hash = $1', [hash]);
  try { fs.unlinkSync(fp(hash)); } catch { /* already gone */ }
}
async function delBlob(hash) { // remove everything for a blob nobody references any more
  if (pool) return pool.query('DELETE FROM devboard_blobs WHERE hash = $1', [hash]);
  for (const t of [false, true]) { try { fs.unlinkSync(fp(hash, t)); } catch { /* already gone */ } }
}
const allFiles = () => [...db.cards.map((c) => [c, false]), ...db.trash.map((c) => [c, true])].flatMap(([c, trash]) => c.files.map((f) => ({ f, c, trash })));
async function releaseBlob(hash) { if (!allFiles().some(({ f }) => f.blob === hash)) await delBlob(hash); }

// Backups: a snapshot of cards + users (not sessions) is taken about once a day and kept for BACKUP_KEEP copies.
// Postgres: table devboard_backups. File mode: ./data/backups/*.json.
const BACKUP_KEEP = Number(process.env.BACKUP_KEEP || 14);
const BACKUP_MAX_BYTES = 25e6;
const BACKUP_DIR = path.join(path.dirname(DB_FILE), 'backups');
async function listBackups() {
  if (pool) { const r = await pool.query('SELECT id, created_at, label, size FROM devboard_backups ORDER BY id DESC'); return r.rows.map((x) => ({ id: String(x.id), at: x.created_at.toISOString(), label: x.label, size: x.size })); }
  try {
    return fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json')).sort().reverse().map((f) => {
      const st = fs.statSync(path.join(BACKUP_DIR, f)); return { id: f, at: st.mtime.toISOString(), label: f.replace(/^.*?__/, '').replace(/\.json$/, ''), size: st.size };
    });
  } catch { return []; }
}
async function makeBackup(label = 'manual') {
  const body = JSON.stringify({ version: 1, taken_at: now(), seq: db.seq, cards: db.cards, trash: db.trash, users: db.users });
  if (body.length > BACKUP_MAX_BYTES) throw new HttpError(413, 'Data is too large to back up automatically');
  if (pool) {
    await pool.query('INSERT INTO devboard_backups (label, size, data) VALUES ($1, $2, $3::jsonb)', [label, body.length, body]);
    await pool.query('DELETE FROM devboard_backups WHERE id NOT IN (SELECT id FROM devboard_backups ORDER BY id DESC LIMIT $1)', [BACKUP_KEEP]);
  } else {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    fs.writeFileSync(path.join(BACKUP_DIR, `${now().replace(/[:.]/g, '-')}__${label}.json`), body);
    for (const old of (await listBackups()).slice(BACKUP_KEEP)) { try { fs.unlinkSync(path.join(BACKUP_DIR, old.id)); } catch { /* gone */ } }
  }
  return { label, size: body.length };
}
async function autoBackup() { // at most one automatic snapshot per ~20 hours
  const latest = (await listBackups())[0];
  if (!latest || Date.now() - Date.parse(latest.at) > 20 * 36e5) { await makeBackup('auto'); console.log('Backup taken'); }
}
async function restoreBackup(id) { // brings back cards + trash (users and sessions are left alone); a safety copy is taken first
  let data;
  if (pool) { const r = await pool.query('SELECT data FROM devboard_backups WHERE id = $1', [Number(id) || 0]); data = r.rows[0]?.data; }
  else { try { data = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, path.basename(id)), 'utf8')); } catch { /* missing */ } }
  need(data && Array.isArray(data.cards), 404, 'Backup not found');
  await makeBackup('before-restore');
  db.cards = data.cards; db.trash = data.trash || []; db.seq = Math.max(db.seq, data.seq || 0);
  for (const c of db.cards) { c.due ??= ''; c.milestone ??= ''; c.parent ??= null; c.related ??= []; c.files ??= []; }
  await save();
  return { cards: db.cards.length };
}
const csvCell = (v) => { const s = Array.isArray(v) ? v.join('; ') : String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function exportCsv() { // UTF-8 with BOM so Excel shows Thai correctly
  const nameOf = (e) => db.users.find((u) => u.email === e)?.name || e;
  const head = ['id', 'type', 'title', 'status', 'priority', 'tags', 'owner', 'reporter', 'due', 'milestone', 'parent', 'created', 'updated', 'description', 'summary', 'test_steps', 'comments'];
  const rows = db.cards.map((c) => [c.id, c.type, c.title, c.status, c.priority, c.tags, c.assignees.map(nameOf), nameOf(c.reporter), c.due, c.milestone, c.parent, c.created_at, c.updated_at,
    c.description, c.dev_summary, c.test_steps.map((x, i) => `${i + 1}. ${x}`).join('\n'), c.comments.map((m) => `${nameOf(m.user)}: ${m.text}`).join('\n')]);
  return '\ufeff' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}
setInterval(() => autoBackup().catch((e) => console.error('backup failed:', e.message)), 6 * 36e5);

// Recycler: frees space by purging original files (never the thumbnails), oldest/biggest-value-last first
let recycling = false;
function storageStats() {
  const blobs = new Map();
  for (const { f, c, trash } of allFiles()) {
    const b = blobs.get(f.blob) || { hash: f.blob, size: f.size, video: f.mime.startsWith('video/'), purged: !!f.purged, pinned: false, allDone: true, newest: '', oldest: f.at, latestCard: '' };
    b.pinned ||= !!f.pinned; b.allDone &&= trash || c.status === 'complete';
    if (f.at > b.newest) b.newest = f.at; if (f.at < b.oldest) b.oldest = f.at;
    const stamp = trash ? c.deleted_at : c.updated_at;
    if (stamp > b.latestCard) b.latestCard = stamp;
    blobs.set(f.blob, b);
  }
  const list = [...blobs.values()], live = list.filter((b) => !b.purged);
  return { list, live, used: live.reduce((n, b) => n + b.size, 0), budget: FILE_BUDGET, files: allFiles().length, blobs: list.length,
    purged: list.filter((b) => b.purged).length, pinned: list.filter((b) => b.pinned).length, keepDays: FILE_KEEP_DAYS };
}
async function recycle({ protect = '' } = {}) {
  if (recycling) return { freed: 0, purged: 0 };
  recycling = true;
  try {
    const st = storageStats(); let used = st.used, freed = 0, purged = 0;
    const kill = async (b) => {
      await purgeBlob(b.hash); used -= b.size; freed += b.size; purged++;
      for (const { f } of allFiles()) if (f.blob === b.hash) { f.purged = true; }
    };
    const cutoff = Date.now() - FILE_KEEP_DAYS * 864e5;
    const live = st.live.filter((b) => !b.pinned && b.hash !== protect);
    for (const b of live) if (b.allDone && Date.parse(b.latestCard) < cutoff) await kill(b); // 1) finished work gets old
    if (used > st.budget) { // 2) over budget: shed in this order until under 90%
      const rank = (b) => (b.allDone ? 0 : 2) + (b.video ? 0 : 1); // done videos, done images, active videos, active images
      const order = live.filter((b) => !b.purged && !(b.allDone && Date.parse(b.latestCard) < cutoff)).sort((x, y) => rank(x) - rank(y) || x.oldest.localeCompare(y.oldest));
      for (const b of order) { if (used <= st.budget * 0.9) break; await kill(b); }
    }
    if (purged) { await save(); console.log(`Recycled ${purged} file(s), freed ${(freed / 1e6).toFixed(1)} MB`); }
    return { freed, purged };
  } finally { recycling = false; }
}
async function purgeTrash() { // really delete cards that stayed in the trash too long
  const cutoff = Date.now() - TRASH_DAYS * 864e5;
  const gone = db.trash.filter((c) => Date.parse(c.deleted_at) < cutoff);
  if (!gone.length) return;
  db.trash = db.trash.filter((c) => !gone.includes(c));
  for (const card of gone) {
    for (const c of db.cards) { c.related = c.related.filter((r) => r !== card.id); if (c.parent === card.id) c.parent = card.parent; }
    for (const h of new Set(card.files.map((f) => f.blob))) await releaseBlob(h);
  }
  await save();
}
setInterval(() => purgeTrash().catch((e) => console.error('purgeTrash failed:', e.message)), 6 * 36e5);
setInterval(() => recycle().catch((e) => console.error('recycle failed:', e.message)), 6 * 36e5);

function readRaw(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > max) { reject(new HttpError(413, `File too large (max ${Math.round(max / 1e6)} MB)`)); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

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
  const isUpload = parts[0] === 'cards' && parts[2] === 'files' && method === 'POST';
  const body = method === 'GET' || isUpload ? {} : await readBody(req);

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

  if (parts[0] === 'me' && parts[1] === 'rotate-token' && method === 'POST') {
    me.token = crypto.randomBytes(24).toString('hex'); // old token stops working immediately
    await save();
    return sendJson(res, 200, { token: me.token });
  }
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

  // ---- backups & export (admin) ----
  if (parts[0] === 'backups') {
    forbid(me, 'admin');
    if (method === 'GET' && parts.length === 1) return sendJson(res, 200, await listBackups());
    if (method === 'POST' && parts.length === 1) { const r = await makeBackup('manual'); return sendJson(res, 200, { ...r, backups: await listBackups() }); }
    if (method === 'POST' && parts[2] === 'restore') { const r = await restoreBackup(decodeURIComponent(parts[1])); return sendJson(res, 200, r); }
    throw new HttpError(405, 'Method not allowed');
  }
  if (parts[0] === 'export' && method === 'GET') {
    forbid(me, 'admin');
    const day = now().slice(0, 10);
    if (url.searchParams.get('format') === 'csv') {
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="geckoboard-${day}.csv"` });
      return res.end(exportCsv());
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="geckoboard-${day}.json"` });
    return res.end(JSON.stringify({ exported_at: now(), cards: db.cards, trash: db.trash, users: db.users.map(publicUser) }, null, 2)); // no tokens
  }

  // ---- storage ----
  if (parts[0] === 'storage' && method === 'GET') { const { list, live, ...st } = storageStats(); return sendJson(res, 200, st); }
  if (parts[0] === 'storage' && parts[1] === 'recycle' && method === 'POST') {
    forbid(me, 'admin');
    const r = await recycle(); const { list, live, ...st } = storageStats();
    return sendJson(res, 200, { ...st, ...r });
  }

  // ---- attachments: download ----
  if (parts[0] === 'files' && parts.length === 2 && method === 'GET') {
    const f = db.cards.flatMap((c) => c.files).find((x) => x.id === parts[1]);
    need(f, 404, 'File not found');
    const wantThumb = url.searchParams.get('thumb') === '1';
    const buf = await getBlob(f.blob, wantThumb);
    need(buf || wantThumb, 410, 'This file was recycled to save space', { recycled: true });
    need(buf, 404, 'No thumbnail');
    const headers = { 'Content-Type': wantThumb ? 'image/jpeg' : f.mime, 'Accept-Ranges': 'bytes', 'Cache-Control': wantThumb ? 'private, max-age=604800' : 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' };
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m && (m[1] || m[2])) { // Range support so videos can seek
      const start = m[1] ? Number(m[1]) : Math.max(0, buf.length - Number(m[2]));
      const end = m[1] && m[2] ? Math.min(Number(m[2]), buf.length - 1) : buf.length - 1;
      if (start > end || start >= buf.length) { res.writeHead(416, { 'Content-Range': `bytes */${buf.length}` }); return res.end(); }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${buf.length}`, 'Content-Length': end - start + 1 });
      return res.end(buf.subarray(start, end + 1));
    }
    res.writeHead(200, { ...headers, 'Content-Length': buf.length });
    return res.end(buf);
  }

  // ---- live updates ----
  if (parts[0] === 'events' && method === 'GET') { // Server-Sent Events: just a "something changed" ping with the revision number
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`retry: 3000\ndata: ${rev}\n\n`);
    sseClients.add(res);
    const ka = setInterval(() => { try { res.write(': ka\n\n'); } catch { /* closed */ } }, 25000);
    req.on('close', () => { clearInterval(ka); sseClients.delete(res); });
    return;
  }
  if (parts[0] === 'state' && method === 'GET') { // cheap poll: nothing is sent back if nothing changed
    if (Number(url.searchParams.get('since')) === rev) return sendJson(res, 200, { rev, unchanged: true });
    return sendJson(res, 200, { rev, cards: db.cards, users: db.users.map(publicUser) });
  }
  if (parts[0] === 'trash' && parts[2] === 'restore' && method === 'POST') {
    forbid(me, 'admin', 'dev');
    const card = db.trash.find((c) => c.id === Number(parts[1]));
    need(card, 404, 'Nothing to restore (it may have been removed for good)');
    db.trash = db.trash.filter((c) => c !== card);
    delete card.deleted_at; delete card.deleted_by;
    db.cards.push(card);
    log(card, user, 'restored');
    await save();
    return sendJson(res, 200, card);
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
    const dup = db.cards.find((c) => c.reporter === user && c.title === title && Date.now() - Date.parse(c.created_at) < 15000); // double-click / retry safety net
    if (dup) return sendJson(res, 200, dup);
    const type = TYPES.includes(body.type) ? body.type : 'task';
    const priority = PRIORITIES.includes(body.priority) ? body.priority : 'medium';
    const tags = cleanTags(body.tags);
    const due = isDate(clean(body.due, 10)) ? clean(body.due, 10) : '';
    const parentId = body.parent ? Number(body.parent) : null;
    need(parentId === null || db.cards.some((c) => c.id === parentId), 400, `Parent card #${parentId} not found`);
    const card = {
      id: ++db.seq, type, title, description: clean(body.description), priority, tags,
      due, milestone: clean(body.milestone, 40), parent: parentId, related: [], files: [],
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
  if (!action && method === 'DELETE') { // soft delete: kept in the trash for TRASH_DAYS so it can be undone
    forbid(me, 'admin', 'dev');
    notify('deleted', card, user); // the team sees who deleted what
    db.cards = db.cards.filter((c) => c !== card);
    card.deleted_at = now(); card.deleted_by = user;
    db.trash.push(card);
    await save();
    return sendJson(res, 200, { ok: true });
  }
  if (!action && method === 'PATCH') {
    need(can(me, 'admin') || card.reporter === user || card.assignees.includes(user), 403, 'Only the reporter, the owner or an admin can edit');
    if (body.title !== undefined) { const t = clean(body.title, 200); need(t, 400, 'title required'); card.title = t; }
    if (body.description !== undefined) card.description = clean(body.description);
    if (PRIORITIES.includes(body.priority)) card.priority = body.priority;
    if (TYPES.includes(body.type)) card.type = body.type;
    if (body.tags !== undefined) card.tags = cleanTags(body.tags);
    if (body.due !== undefined) { const d = clean(body.due, 10); need(d === '' || isDate(d), 400, 'Invalid date'); card.due = d; }
    if (body.milestone !== undefined) card.milestone = clean(body.milestone, 40);
    if (body.parent !== undefined) {
      const pid = body.parent ? Number(body.parent) : null;
      if (pid !== null) {
        need(db.cards.some((c) => c.id === pid), 400, `Card #${pid} not found`);
        need(pid !== card.id && !descendants(card.id).has(pid), 400, 'A card cannot be its own parent or sub-card');
      }
      card.parent = pid;
    }
    log(card, user, 'edited');
    await save();
    return sendJson(res, 200, card);
  }
  if (action === 'files' && parts[3] && method === 'PATCH') { // pin / unpin: pinned originals are never recycled
    const f = card.files.find((x) => x.id === parts[3]);
    need(f, 404, 'File not found');
    need(can(me, 'admin') || f.by === user, 403, 'Only the uploader or an admin can pin a file');
    need(!f.purged || body.pinned === false, 409, 'The original was already recycled');
    for (const x of allFiles().map(({ f: g }) => g)) if (x.blob === f.blob) x.pinned = !!body.pinned;
    await save();
    return sendJson(res, 200, card);
  }
  if (action === 'files' && parts[3] && method === 'DELETE') {
    const f = card.files.find((x) => x.id === parts[3]);
    need(f, 404, 'File not found');
    need(can(me, 'admin') || f.by === user, 403, 'Only the uploader or an admin can remove a file');
    card.files = card.files.filter((x) => x !== f);
    await releaseBlob(f.blob);
    log(card, user, 'file_removed', f.name);
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
      const removed = body.email && can(me, 'admin') ? body.email : user;
      card.assignees = card.assignees.filter((a) => a !== removed);
      if (card.assignees.length === 0 && card.status === 'in_progress') card.status = 'open';
      log(card, user, 'unclaimed', removed !== user ? removed : '');
      break;
    }
    case 'files': {
      if (parts[3] && parts[4] === 'thumb') { // client-made JPEG thumbnail for an uploaded file
        const f = card.files.find((x) => x.id === parts[3]);
        need(f, 404, 'File not found');
        const buf = await readRaw(req, 150e3);
        need(buf.length > 0 && buf[0] === 0xff && buf[1] === 0xd8, 400, 'Thumbnail must be a JPEG');
        await putThumb(f.blob, buf);
        for (const { f: g } of allFiles()) if (g.blob === f.blob) g.thumb = true;
        break;
      }
      // upload one attachment: raw body, Content-Type = mime, X-Filename = url-encoded name
      const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      need(FILE_TYPES[mime], 415, 'Only PNG/JPEG/GIF/WebP images and MP4/WebM videos are allowed');
      need(card.files.length < MAX_FILES_PER_CARD, 409, `Max ${MAX_FILES_PER_CARD} files per card`);
      const buf = await readRaw(req, FILE_TYPES[mime]);
      need(buf.length > 0, 400, 'Empty file');
      const hash = sha(buf);
      const twin = allFiles().find(({ f }) => f.blob === hash)?.f; // same bytes already stored -> share (and revive if recycled)
      if (!twin || twin.purged) { await putBlob(hash, mime, buf); for (const { f } of allFiles()) if (f.blob === hash) f.purged = false; }
      const id = crypto.randomBytes(12).toString('hex');
      let name = 'file'; try { name = decodeURIComponent(String(req.headers['x-filename'] || 'file')); } catch { /* keep default */ }
      card.files.push({ id, name: clean(name.replace(/[\\/]/g, '_'), 80), mime, size: buf.length, by: user, at: now(), blob: hash, purged: false, pinned: !!twin?.pinned, thumb: !!twin?.thumb });
      log(card, user, 'file_added', card.files.at(-1).name);
      await save();
      await recycle({ protect: hash }); // make room if we just went over budget
      return sendJson(res, 200, card);
    }
    case 'link': case 'unlink': { // "related" links are two-way
      const other = db.cards.find((c) => c.id === Number(body.id));
      need(other && other.id !== card.id, 400, 'Card not found');
      if (action === 'link') {
        if (!card.related.includes(other.id)) card.related.push(other.id);
        if (!other.related.includes(card.id)) other.related.push(card.id);
      } else {
        card.related = card.related.filter((r) => r !== other.id);
        other.related = other.related.filter((r) => r !== card.id);
      }
      log(card, user, action === 'link' ? 'linked' : 'unlinked', `#${other.id}`);
      break;
    }
    case 'undo': { // take back your own last action (within 5 minutes)
      const last = card.history.at(-1);
      need(last && last.user === user && Date.now() - Date.parse(last.at) < 5 * 6e4, 409, 'Nothing to undo');
      switch (last.action) {
        case 'claimed':
          card.assignees = card.assignees.filter((a) => a !== user);
          if (!card.assignees.length && card.status === 'in_progress') card.status = 'open';
          break;
        case 'unclaimed': {
          const who = last.text || user;
          need(!card.assignees.length, 409, 'Someone else already took this card');
          card.assignees.push(who); if (card.status === 'open') card.status = 'in_progress';
          break;
        }
        case 'ready_to_test': card.status = 'in_progress'; break;
        case 'complete': card.status = 'ready_to_test'; delete card.completed_by; break;
        case 'test_failed':
          card.status = 'ready_to_test';
          if (card.comments.at(-1)?.text.startsWith('❌ Test failed')) card.comments.pop();
          break;
        default: throw new HttpError(409, 'This cannot be undone');
      }
      log(card, user, 'undone', last.action);
      break;
    }
    case 'move': { // manual order inside a column: place between two neighbours
      const epos = (c) => c.pos ?? Date.parse(c.created_at);
      const above = body.after ? db.cards.find((c) => c.id === Number(body.after)) : null;
      const below = body.before ? db.cards.find((c) => c.id === Number(body.before)) : null;
      card.pos = above && below ? (epos(above) + epos(below)) / 2 : above ? epos(above) + 1000 : below ? epos(below) - 1000 : Date.now();
      await save(); // no history entry / updated_at: re-ordering is not a content change
      return sendJson(res, 200, card);
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
      notify('ready_to_test', card, user, card.dev_summary);
      break;
    }
    case 'pass': { // Tester: passed -> complete
      forbid(me, 'tester', 'admin');
      need(card.status === 'ready_to_test', 409, 'Card is not ready to test');
      card.status = 'complete';
      card.completed_by = user;
      log(card, user, 'complete', clean(body.text));
      notify('complete', card, user);
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
      notify('test_failed', card, user, reason);
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
      const mentions = findMentions(text);
      card.comments.push({ at: now(), user, text, mentions });
      log(card, user, 'commented');
      if (mentions.length) notify('mention', card, user, `${mentions.map((e) => '@' + nameOfUser(e)).join(' ')} — ${text}`);
      break;
    }
    default: throw new HttpError(404, 'Unknown action');
  }
  await save();
  return sendJson(res, 200, card);
}

// ---- static files ----
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.ico': 'image/x-icon' };
function serveStatic(req, res, url) {
  const rel = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.join(__dirname, 'public', path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(path.join(__dirname, 'public'))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const noCache = /(^|[\\/])sw\.js$/.test(file) || file.endsWith('.webmanifest'); // always fresh so updates reach installed apps
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', ...(noCache && { 'Cache-Control': 'no-cache' }) });
    res.end(buf);
  });
}

// Remote MCP (Streamable HTTP, stateless). Auth: "Authorization: Bearer <personal token>".
async function mcp(req, res) {
  const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1] || '';
  const u = token && db.users.find((x) => x.token === token);
  if (!u) { res.setHeader('WWW-Authenticate', 'Bearer'); return sendJson(res, 401, { error: 'Missing or invalid token' }); }
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Use POST' });
  const server = createMcpServer({ base: `http://127.0.0.1:${PORT}`, token });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => { transport.close(); server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, await readBody(req));
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); res.end('ok'); }
    else if (url.pathname === '/mcp') await mcp(req, res);
    else if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else serveStatic(req, res, url);
  } catch (e) {
    sendJson(res, e.code || 400, { error: e.message, ...e.extra });
  }
}).listen(PORT, () => {
  console.log(`GeckoBoard running at http://localhost:${PORT}`);
  recycle().catch((e) => console.error('recycle failed:', e.message));
  purgeTrash().catch((e) => console.error('purgeTrash failed:', e.message));
  setTimeout(() => autoBackup().catch((e) => console.error('backup failed:', e.message)), 30000);
  // Render's free plan sleeps after ~15 min without inbound traffic; a ping through the public URL every 10 min keeps it awake.
  if (PUBLIC_URL && process.env.KEEP_AWAKE !== '0') {
    setInterval(() => fetch(`${PUBLIC_URL}/healthz`, { signal: AbortSignal.timeout(15000) }).catch(() => {}), 10 * 60e3);
    console.log(`Keep-awake ping enabled for ${PUBLIC_URL} (set KEEP_AWAKE=0 to disable)`);
  }
});
