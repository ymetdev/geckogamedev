// GeckoBoard front-end. Depends on /i18n.js (I18N).
const COLS = [['open', '--open'], ['in_progress', '--prog'], ['needs_info', '--ask'], ['ready_to_test', '--test'], ['complete', '--done']];
const COLOR = Object.fromEntries(COLS);
const PRI_W = { critical: 0, high: 1, medium: 2, low: 3 };
const OLD_DONE_MS = 7 * 864e5, STALE_MS = 3 * 864e5;

let cards = [], users = [], user = null, openId = null, lang = 'en';
const F = { type: '', who: '', q: '', pri: '', tag: '', own: '', ms: '', need: false, fail: false };
const F0 = { ...F };
let showOld = false, mcol = 'open', dragId = null, sortMode = 'auto', loadedOnce = false;
try { Object.assign(F, JSON.parse(localStorage.getItem('geckoboard.filters') || '{}')); sortMode = localStorage.getItem('geckoboard.sort') === 'manual' ? 'manual' : 'auto'; } catch { /* storage blocked */ }
const saveF = () => { try { localStorage.setItem('geckoboard.filters', JSON.stringify(F)); } catch { /* ignore */ } };

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
try { lang = localStorage.getItem('geckoboard.lang') || (/^th/i.test(navigator.language) ? 'th' : 'en'); } catch { /* storage blocked */ }
const t = (k, ...a) => String(I18N[lang][k] ?? I18N.en[k] ?? k).replace(/\{(\d)\}/g, (_, i) => a[i]);
const locale = () => (lang === 'th' ? 'th-TH' : 'en-GB');
const nameOf = (e) => users.find((u) => u.email === e)?.name || e;
let projects = [], viewProject = '';
try { viewProject = localStorage.getItem('geckoboard.project') || ''; } catch { /* storage blocked */ }
const PROJ = (id) => projects.find((p) => p.id === id);
const assignable = (pid) => users.filter((u) => u.role === 'admin' || PROJ(pid)?.members?.[u.email] === 'dev'); // people who can own cards in a project
const roleOf = (pid) => (user?.role === 'admin' ? 'admin' : PROJ(pid)?.role || null); // my role inside one project
const rl = (pid, ...r) => r.includes(roleOf(pid));
const activeProjects = () => projects.filter((p) => !p.archived);
const curPid = () => viewProject || activeProjects()[0]?.id || projects[0]?.id || '';
const role = (...r) => rl(curPid(), ...r); // role in the project being viewed
const rv = (...r) => (viewProject ? rl(viewProject, ...r) : projects.some((p) => r.includes(roleOf(p.id)))); // "in the view" (any project when viewing all)
const refOf = (c) => `${PROJ(c.project)?.key || '?'}-${c.num ?? c.id}`;
const isAdmin = () => user?.role === 'admin';
const vcards = () => (viewProject ? cards.filter((c) => c.project === viewProject) : cards); // cards of the project being viewed
const hue = (e) => { let h = 0; for (const ch of String(e)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
const avatar = (e, cls = '') => `<span class="av ${cls}" style="background:hsl(${hue(e)} 45% 40%)">${esc([...nameOf(e)][0]?.toUpperCase() || '?')}</span>`;
const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
let toastT;
function toast(m, action, ms) { // optional action = { label, fn }: shows a button (used for Undo)
  const el = $('#toast');
  // an open modal dialog makes everything outside it unclickable, so the toast lives inside the top-most open dialog
  const host = $$('dialog[open]').at(-1) || document.body;
  if (el.parentElement !== host) host.appendChild(el);
  el.innerHTML = `<span>${esc(m)}</span>${action ? `<button id="toastAct">${esc(action.label)}</button>` : ''}`;
  el.className = action ? 'ok' : ''; el.style.display = 'flex';
  if (action) $('#toastAct').onclick = async () => { hideToast(); try { await action.fn(); } catch (e) { toast(e.message); } };
  clearTimeout(toastT); toastT = setTimeout(hideToast, ms || (action ? 8000 : 3800));
}
function hideToast() { $('#toast').style.display = 'none'; }
const ERRS = [[/^Only the current owner \((.+?)\) or an admin/, 'e_asg_owner'], [/^Can only assign to a dev or admin/, 'e_asg_target'], [/^Already assigned to (.+)/, 'e_asg_same'], [/^Project is not empty/, 'e_pnotempty'], [/^Project required/, 'e_pneed'], [/^Not logged in/, 'e_login'], [/^Role "(.+)" is not allowed/, 'e_role'], [/^Card #(\d+) not found/, 'e_nocard'], [/^Already claimed by (.+?)\.?$/, 'e_claimed'], [/^Card already complete/, 'e_complete'],
  [/^Not your card/, 'e_notyours'], [/^Only an assignee/, 'e_assignee'], [/^Card must be in progress/, 'e_inprog'], [/^test_steps required/, 'e_steps'], [/^Card is not ready to test/, 'e_notready'], [/^reason required/, 'e_reason'],
  [/^text required/, 'e_text'], [/^title required/, 'e_title'], [/^Only the reporter, the owner/, 'e_edit'], [/^File too large \(max (\d+) MB\)/, 'e_toolarge'], [/^Only PNG\/JPEG/, 'e_filetype'], [/^Max (\d+) files per card/, 'e_maxfiles'],
  [/^Empty file/, 'e_empty'], [/^File not found/, 'e_nofile'], [/recycled/i, 'e_recycled'], [/^A card cannot be its own parent/, 'e_selfparent'], [/^Invalid date/, 'e_date'], [/^Parent card #(\d+) not found/, 'e_noparent'],
  [/^Cannot remove the last admin/, 'e_lastadmin'], [/^Email already registered/, 'e_dupemail'], [/^(Invalid email|Enter a valid email)/, 'e_email'], [/^Invalid role/, 'e_badrole'], [/^Display name already in use/, 'e_nametaken'], [/^(.+) is not registered\./, 'e_unreg'],
  [/^(Invalid Google token|Invalid token issuer|Google email not verified)/, 'e_google'], [/^Email-only login is disabled/, 'e_emaillogin'], [/^Nothing to undo/, 'e_noundo'], [/^Someone else already took/, 'e_taken'],
  [/^This cannot be undone/, 'e_cantundo'], [/^Nothing to restore/, 'e_norestore'], [/^Only the uploader or an admin/, 'e_uploader'], [/^The original was already recycled/, 'e_origrecycled']];
// loading feedback: a thin top bar for slow requests, and buttons that spin + ignore repeat clicks while their request runs
let inflight = 0, topT;
function netStart() { inflight++; clearTimeout(topT); topT = setTimeout(() => { if (inflight) $('#topbar').classList.add('on'); }, 250); }
function netEnd() { inflight = Math.max(0, inflight - 1); if (!inflight) { clearTimeout(topT); $('#topbar').classList.remove('on'); } }
async function withBusy(guard, fn, spin = guard) {
  if (!guard) return fn();
  if (guard.dataset.busy) return; // already running: ignore the extra click / Enter
  guard.dataset.busy = '1'; spin?.classList.add('loading'); if (spin && 'disabled' in spin) spin.disabled = true;
  try { return await fn(); } finally { delete guard.dataset.busy; spin?.classList.remove('loading'); if (spin && 'disabled' in spin) spin.disabled = false; }
}
const markBusy = (id) => $(`.card[data-id="${id}"]`)?.classList.add('busy');
function tErr(msg) { // server messages are English; show them in the chosen language
  msg = String(msg); if (lang === 'en') return msg;
  for (const [re, k] of ERRS) { const m = re.exec(msg); if (m) return t(k, ...m.slice(1)); }
  return msg;
}
const today = () => new Date().toISOString().slice(0, 10);
const daysFrom = (iso) => Math.round((Date.parse(iso) - Date.parse(today())) / 864e5);
const fmtDur = (ms) => { if (!isFinite(ms)) return '—'; const h = ms / 36e5; return h < 24 ? `${h.toFixed(1)} ${t('h')}` : `${(h / 24).toFixed(1)} ${t('d')}`; };

// ---------- api ----------
async function api(method, path, body, quiet) {
  if (!quiet) netStart();
  try { return await api0(method, path, body); } finally { if (!quiet) netEnd(); }
}
async function api0(method, path, body) {
  let r; try { r = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new Error(t('e_net') === 'e_net' ? 'Cannot reach the server. Try again.' : t('e_net')); }
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== '/login') showLogin();
  if (!r.ok) { const er = new Error(tErr(d.error || r.status)); er.data = d; throw er; }
  return d;
}
async function makeThumb(file) { // small JPEG preview kept forever, even after the original is recycled
  try {
    let src, w, h, url;
    if (file.type.startsWith('image/')) { src = await createImageBitmap(file); w = src.width; h = src.height; }
    else if (file.type.startsWith('video/')) {
      const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = url = URL.createObjectURL(file);
      await new Promise((ok, no) => { v.onloadeddata = ok; v.onerror = no; setTimeout(no, 6000); });
      v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
      await new Promise((ok) => { v.onseeked = ok; setTimeout(ok, 2500); });
      src = v; w = v.videoWidth; h = v.videoHeight;
    } else return null;
    const k = Math.min(1, 320 / Math.max(w, h)); const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.drawImage(src, 0, 0, c.width, c.height);
    if (url) URL.revokeObjectURL(url);
    return await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.7));
  } catch { return null; }
}
async function uploadFile(cardId, file) {
  netStart();
  try { return await uploadFile0(cardId, file); } finally { netEnd(); }
}
async function uploadFile0(cardId, file) {
  const r = await fetch(`/api/cards/${cardId}/files`, { method: 'POST', headers: { 'Content-Type': file.type, 'X-Filename': encodeURIComponent(file.name) }, body: file });
  const d = await r.json();
  if (!r.ok) throw new Error(tErr(d.error || r.status));
  const nf = d.files.at(-1);
  if (nf && !nf.thumb) { const tb = await makeThumb(file); if (tb) await fetch(`/api/cards/${cardId}/files/${nf.id}/thumb`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: tb }).catch(() => {}); }
  return d;
}
const LIMITS = { 'image/png': 6e6, 'image/jpeg': 6e6, 'image/gif': 8e6, 'image/webp': 6e6, 'video/mp4': 12e6, 'video/webm': 12e6 };
async function shrinkImage(file) { // screenshots: downscale to 1600px JPEG so they stay small
  if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size < 300e3) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch { return file; }
}
const MAX_FILES = 20;
async function attach(cardId, files) {
  let ok = 0, i = 0;
  for (const f0 of files) {
    if (files.length > 1) toast(t('uploading_n', ++i, files.length));
    const f = await shrinkImage(f0);
    if (!LIMITS[f.type]) { toast(t('file_type', f0.name)); continue; }
    if (f.size > LIMITS[f.type]) { toast(t('file_too_big', f0.name)); continue; }
    try { await uploadFile(cardId, f); ok++; } catch (e) { toast(e.message); }
  }
  return ok;
}

// live updates: an SSE stream tells us "something changed"; /state returns nothing when we're already up to date
let rev = 0, loadQ = Promise.resolve(), flash = new Set(), pendingLoad = false, es = null;
const typingInDetail = () => document.activeElement?.matches('#viewBody textarea,#viewBody input:not([type=checkbox]):not([type=file])');
function load(force) { loadQ = loadQ.then(() => doLoad(force)).catch((e) => console.error(e)); return loadQ; }
async function doLoad(force) {
  if (!user) return;
  if (dragId) { pendingLoad = true; return; } // don't yank the board while someone is dragging
  const st = await api('GET', `/state?since=${force ? 0 : rev}`, undefined, true);
  if (st.unchanged) return;
  const sig = () => (openId ? JSON.stringify(cards.find((c) => c.id === openId)) : '');
  const before = sig(), old = new Map(cards.map((c) => [c.id, c])), wasLoaded = loadedOnce;
  const fxSnap = wasLoaded && typeof fxBefore === 'function' ? fxBefore() : null; // card positions before the redraw (for the fly-over effects)
  rev = st.rev; cards = st.cards; users = st.users; projects = st.projects || projects;
  renderProjectSwitch();
  announce(old);
  loadedOnce = true;
  renderAll(); bootHide();
  if (fxSnap) fxAfter(fxSnap, old);
  if (openId && $('#viewDlg').open) {
    if (!cards.some((c) => c.id === openId)) { $('#viewDlg').close(); toast(t('card_gone')); }
    else if (sig() !== before && !typingInDetail()) showCard(openId, true); // keeps videos playing and inputs focused
  }
}
function renderProjectSwitch() { // project picker in the app bar (hidden when you only have one project)
  const sel = $('#projSel'), list = projects.filter((p) => !p.archived || isAdmin());
  if (viewProject && !projects.some((p) => p.id === viewProject)) viewProject = '';
  if (activeProjects().length === 1 && !isAdmin()) viewProject = activeProjects()[0].id;
  sel.hidden = list.length <= 1;
  const opts = [...(list.length > 1 ? [['', t('all_projects')]] : []), ...list.map((p) => [p.id, `${p.name}${p.archived ? ' · ' + t('archived') : ''}`])];
  sel.innerHTML = opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join(''); sel.value = viewProject;
}
$('#projSel').onchange = () => {
  viewProject = $('#projSel').value; try { localStorage.setItem('geckoboard.project', viewProject); } catch { /* ignore */ }
  renderUserBox(); renderAll();
};
function announce(old) { // glow the cards other people changed, and say what happened
  if (!loadedOnce) return;
  const msgs = [];
  for (const c of cards) {
    const prev = old.get(c.id); if (prev && prev.updated_at === c.updated_at && prev.status === c.status) continue;
    const last = c.history.at(-1); if (!last || last.user === user.email) continue; // my own actions need no highlight
    flash.add(c.id); setTimeout(() => { flash.delete(c.id); $(`.card[data-id="${c.id}"]`)?.classList.remove('flash'); }, 2600); // each card's glow ends on its own clock
    if (msgs.length < 2) msgs.push(`${nameOf(last.user)} · ${refOf(c)} ${t('a_' + last.action)}${last.action === 'assigned' ? ' ' + nameOf(last.text) : ''}`);
  }
  if (msgs.length) toast(msgs.join('  |  '));
}
function startEvents() {
  if (es || !window.EventSource) return;
  es = new EventSource('/api/events'); es.onmessage = () => load(); // the browser reconnects by itself if the stream drops
}
function stopEvents() { es?.close(); es = null; rev = 0; }
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });

// ---------- language ----------
function applyLang() {
  document.documentElement.lang = lang;
  $$('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  $$('[data-i18n-ph]').forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
  $$('#langSeg button,[data-langseg] button').forEach((b) => b.classList.toggle('on', b.dataset.v === lang));
  $('#flow').innerHTML = COLS.map(([k, c], i) => `${i ? '→' : ''}<span style="color:var(${c})">${t('s_' + k)}</span>`).join('');
  if (user) renderUserBox();
  if ($('#teamDlg').open) renderTeam();
  renderAll();
  if (openId && $('#viewDlg').open) showCard(openId, true);
  if ($('#cardDlg').open) $('#cardDlgTitle').textContent = t(editId ? 'edit_card' : 'newcard');
}
function setLang(l) { lang = l; try { localStorage.setItem('geckoboard.lang', l); } catch { /* ignore */ } applyLang(); }
$$('#langSeg button,[data-langseg] button').forEach((b) => (b.onclick = () => setLang(b.dataset.v)));

// ---------- login / user ----------
function showLogin() { bootHide(); user = null; stopEvents(); $('#userBox').innerHTML = ''; if (!$('#loginDlg').open) $('#loginDlg').showModal(); initLogin(); }
function renderUserBox() {
  const u = user;
  $('#userBox').innerHTML = `<div class="chip" id="chip" role="button" tabindex="0" aria-label="${esc(u.name)}"><span class="av" style="background:hsl(${hue(u.email)} 45% 40%)">${esc([...u.name][0]?.toUpperCase() || '?')}</span><span>${esc(u.name)}</span><span class="role ${roleOf(curPid()) || u.role}">${roleOf(curPid()) || u.role}</span></div>
   <div class="menu" id="menu">
     <button data-m="rename">✎ ${t('menu_rename')}</button>
     <button data-m="token">${t('menu_token')}</button>
     ${u.role === 'admin' ? `<button data-m="projects">${t('menu_projects')}</button><button data-m="team">${t('menu_team')}</button><button data-m="storage">${t('menu_storage')}</button><button data-m="backup">${t('menu_backup')}</button>` : ''}
     ${typeof fxLabel === 'function' ? `<button data-m="fx">${fxLabel()}</button>` : ''}
     ${installEvt ? `<button data-m="install">📲 ${t('menu_install')}</button>` : ''}
     <button data-m="out">${t('menu_out')}</button></div>`;
  $('#chip').onclick = (e) => { e.stopPropagation(); $('#menu').classList.toggle('show'); };
  $$('#menu button').forEach((b) => (b.onclick = () => menuAct(b.dataset.m)));
}
function setUser(u) {
  user = u; projects = u.projects || []; renderProjectSwitch(); $('#loginDlg').close();
  if (window.__showHelp) { window.__showHelp = false; $('#helpBtn').click(); }
  renderUserBox(); startEvents();
  load(true).then(openFromHash);
}
document.addEventListener('click', (e) => { $('#menu')?.classList.remove('show'); if (!e.target.closest('.bellbox')) $('#bellMenu').classList.remove('show'); });
let lastTok = '';
const mcpUrl = (pid) => `${location.origin}/mcp${pid ? `?project=${encodeURIComponent(pid)}` : ''}`;
// one game repo -> pin it to its project (local scope = only that folder); no project -> all your projects (user scope)
const mcpCmd = (tok, pid) => `claude mcp add --scope ${pid ? 'local' : 'user'} --transport http geckoboard ${mcpUrl(pid)} --header "Authorization: Bearer ${tok}"`;
function showToken(tok, fresh) {
  lastTok = tok; const sel = $('#tokProj');
  if (fresh || !sel.options.length) {
    sel.innerHTML = [['', t('all_projects')], ...activeProjects().map((p) => [p.id, `${p.name} (${p.key})`])].map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
    sel.value = activeProjects().some((p) => p.id === viewProject) ? viewProject : '';
  }
  sel.closest('label').hidden = activeProjects().length <= 1; if (activeProjects().length <= 1) sel.value = activeProjects()[0]?.id || '';
  const pid = sel.value;
  $('#tokNote').textContent = activeProjects().length > 1 ? t(pid ? 'tok_note_one' : 'tok_note_all') : '';
  $('#tokenCmd').textContent = mcpCmd(tok, pid);
  $('#tokenJson').textContent = JSON.stringify({ mcpServers: { geckoboard: { type: 'http', url: mcpUrl(pid), headers: { Authorization: 'Bearer ' + tok } } } }, null, 2);
}
$('#tokProj').onchange = () => showToken(lastTok);
async function copyText(text, btn, key = 'copy') {
  try { await navigator.clipboard.writeText(text); btn.textContent = t('copied'); } catch { toast('Copy failed'); }
  setTimeout(() => (btn.textContent = t(key)), 1500);
}
$('#copyBtn').onclick = () => copyText($('#tokenCmd').textContent, $('#copyBtn'));
$('#copyJsonBtn').onclick = () => copyText($('#tokenJson').textContent, $('#copyJsonBtn'));
$('#rotateBtn').onclick = () => { if (!confirm(t('confirm_rotate'))) return; withBusy($('#rotateBtn'), async () => { try { showToken((await api('POST', '/me/rotate-token', {})).token); } catch (e) { alert(e.message); } }); };
async function menuAct(m) {
  if (m === 'fx') return fxToggle();
  if (m === 'out') { await api('POST', '/logout', {}); showLogin(); }
  if (m === 'token') { const me = await api('GET', '/me'); showToken(me.token, true); $('#tokenDlg').showModal(); }
  if (m === 'rename') { const f = $('#nameForm'); f.reset(); f.name.value = user.name; $('#nameErr').textContent = ''; $('#nameDlg').showModal(); f.name.select(); }
  if (m === 'projects') { projEdit = null; await renderProjects(); $('#projDlg').showModal(); }
  if (m === 'team') { renderTeam(); $('#teamDlg').showModal(); }
  if (m === 'storage') { await renderStorage(); $('#storDlg').showModal(); }
  if (m === 'backup') { await renderBackups(); $('#bkDlg').showModal(); }
  if (m === 'install' && installEvt) { installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; renderUserBox(); }
}
function renderTeam() {
  $('#teamList').innerHTML = users.map((u) => `<div class="trow"><span class="e">${esc(u.name)} <span class="meta">${esc(u.email)}</span>${u.discord_id ? ' <span class="meta" title="Discord ID ' + esc(u.discord_id) + '">🔔</span>' : ''}</span>
    <select data-e="${esc(u.email)}">${['admin', 'dev', 'tester'].map((r) => `<option ${r === u.role ? 'selected' : ''}>${r}</option>`).join('')}</select>
    <button class="btn" data-did="${esc(u.email)}" title="${t('discord_btn')}">@</button><button class="btn" data-ren="${esc(u.email)}" title="${t('menu_rename')}">✎</button><button class="btn bad" data-del="${esc(u.email)}">${t('remove')}</button></div>`).join('');
  $$('#teamList select').forEach((sel) => (sel.onchange = async () => {
    try { await api('PATCH', '/users/' + encodeURIComponent(sel.dataset.e), { role: sel.value }); $('#teamErr').textContent = ''; await load(); if (sel.dataset.e === user.email) user.role = sel.value; }
    catch (e) { $('#teamErr').textContent = e.message; await load(); renderTeam(); }
  }));
  $$('#teamList [data-ren]').forEach((b) => (b.onclick = async () => {
    const u = users.find((x) => x.email === b.dataset.ren); const name = prompt(t('rename_prompt', u?.name || b.dataset.ren), u?.name || ''); if (!name || name.trim() === u?.name) return;
    try { await api('PATCH', '/users/' + encodeURIComponent(b.dataset.ren), { name }); $('#teamErr').textContent = ''; await load(true); renderTeam(); if (b.dataset.ren === user.email) { user.name = name.trim(); renderUserBox(); } } catch (e) { $('#teamErr').textContent = e.message; }
  }));
  $$('#teamList [data-did]').forEach((b) => (b.onclick = async () => {
    const u = users.find((x) => x.email === b.dataset.did); const v = prompt(t('discord_prompt', u?.name || b.dataset.did), u?.discord_id || ''); if (v === null || v.trim() === (u?.discord_id || '')) return;
    try { await api('PATCH', '/users/' + encodeURIComponent(b.dataset.did), { discord_id: v.trim() }); $('#teamErr').textContent = ''; await load(true); renderTeam(); } catch (e) { $('#teamErr').textContent = e.message; }
  }));
  $$('#teamList [data-del]').forEach((b) => (b.onclick = async () => {
    if (!confirm(t('confirm_remove', b.dataset.del))) return;
    try { await api('DELETE', '/users/' + encodeURIComponent(b.dataset.del)); $('#teamErr').textContent = ''; await load(); renderTeam(); } catch (e) { $('#teamErr').textContent = e.message; }
  }));
}
$('#addUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await withBusy(e.target, async () => {
    try { await api('POST', '/users', { ...Object.fromEntries(new FormData(e.target)), project: curPid() }); e.target.reset(); $('#teamErr').textContent = ''; await load(); renderTeam(); } catch (err) { $('#teamErr').textContent = err.message; }
  }, e.target.querySelector('button.primary'));
});
const fmtB = (n) => (n >= 1e9 ? (n / 1e9).toFixed(2) + ' GB' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.round(n / 1e3) + ' KB');
async function renderStorage() {
  const s = await api('GET', '/storage'); const pct = Math.min(100, Math.round(100 * s.used / s.budget));
  $('#storBody').innerHTML = `<div><b style="font-size:18px">${t('storage_used', fmtB(s.used), fmtB(s.budget))}</b> <span class="meta">(${pct}%)</span></div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="meta">${t('storage_files', s.files, s.purged, s.pinned)}</div>
    <div class="meta">${t('storage_policy', s.keepDays)}</div>`;
}
$('#storClean').onclick = () => withBusy($('#storClean'), async () => {
  try { const r = await api('POST', '/storage/recycle', {}); await renderStorage(); await load(); toast(r.purged ? t('cleaned', fmtB(r.freed)) : t('nothing_to_clean')); } catch (e) { toast(e.message); }
});
// ---------- change my display name ----------
$('#nameCancel').onclick = () => $('#nameDlg').close();
$('#nameForm').addEventListener('submit', async (e) => {
  e.preventDefault(); const f = e.target;
  await withBusy(f, async () => {
    try { const me = await api('PATCH', '/me', { name: f.name.value }); user.name = me.name; $('#nameDlg').close(); renderUserBox(); await load(true); toast(t('rename_saved')); }
    catch (er) { $('#nameErr').textContent = er.message; }
  }, f.querySelector('button.primary'));
});

// ---------- projects (admin) ----------
let projEdit = null; // null = list, 'new' = create form, <id> = editing that project
async function renderProjects() {
  const list = await api('GET', '/projects'); const body = $('#projBody'); $('#projDlg .err')?.remove();
  const people = users.filter((u) => u.role !== 'admin');
  if (projEdit === 'new') {
    body.innerHTML = `<form id="pNewForm" class="dlg" style="padding:0"><label><span>${t('proj_name')}</span><input name="name" required maxlength="60"></label>
      <label><span>${t('proj_key')}</span><input name="key" maxlength="8" placeholder="ALPHA" style="text-transform:uppercase"></label>
      <label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="copy" checked style="width:auto"> ${t('proj_copy')}</label><div class="err" id="pErr"></div>
      <div class="actions"><button type="button" class="btn" id="pBack">${t('proj_back')}</button><span class="sp"></span><button class="btn primary">${t('proj_create')}</button></div></form>`;
    $('#pBack').onclick = () => { projEdit = null; renderProjects(); };
    $('#pNewForm').onsubmit = async (e) => {
      e.preventDefault(); const f = e.target;
      await withBusy(f, async () => { try { const p = await api('POST', '/projects', { name: f.name.value, key: f.key.value, copy_members_from: f.copy.checked ? curPid() : '' }); await load(true); projEdit = p.id; await renderProjects(); } catch (er) { $('#pErr').textContent = er.message; } }, f.querySelector('button.primary'));
    };
    return;
  }
  if (projEdit) {
    const p = list.find((x) => x.id === projEdit); if (!p) { projEdit = null; return renderProjects(); }
    body.innerHTML = `<form id="pEditForm" class="dlg" style="padding:0">
      <div class="row" style="flex-wrap:nowrap"><label style="flex:2"><span>${t('proj_name')}</span><input name="name" value="${esc(p.name)}" required maxlength="60"></label><label style="flex:1"><span>${t('proj_key')}</span><input name="key" value="${esc(p.key)}" maxlength="8" style="text-transform:uppercase"></label></div>
      <label><span>${t('proj_webhook')}</span><input name="discord_webhook" value="${esc(p.discord_webhook || '')}" placeholder="https://discord.com/api/webhooks/…"></label><div class="meta">${t('proj_hook_hint')}</div>
      <label><span>${t('proj_role')}</span><input name="discord_tester_role" value="${esc(p.discord_tester_role || '')}" inputmode="numeric"></label>
      <div class="sec"><h4>${t('proj_members')}</h4>
        ${people.map((u) => `<div class="mrow"><span class="e">${esc(u.name)} <span class="meta">${esc(u.email)}</span></span><select data-m="${esc(u.email)}"><option value="">${t('proj_none')}</option><option value="dev" ${p.members?.[u.email] === 'dev' ? 'selected' : ''}>dev</option><option value="tester" ${p.members?.[u.email] === 'tester' ? 'selected' : ''}>tester</option></select></div>`).join('')}
        ${users.filter((u) => u.role === 'admin').map((u) => `<div class="mrow"><span class="e">${esc(u.name)} <span class="meta">${esc(u.email)}</span></span><span class="meta">${t('proj_admin_all')}</span></div>`).join('')}</div>
      <label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="archived" ${p.archived ? 'checked' : ''} style="width:auto"> ${t('proj_archive')}</label><div class="err" id="pErr"></div>
      <div class="actions"><button type="button" class="btn" id="pBack">${t('proj_back')}</button><button type="button" class="btn danger" id="pDel">${t('proj_delete')}</button><span class="sp"></span><button class="btn primary">${t('proj_save')}</button></div></form>`;
    $('#pDel').onclick = async () => { if (!confirm(t('proj_confirm_delete', p.name))) return; try { await api('DELETE', `/projects/${p.id}`); await load(true); projEdit = null; await renderProjects(); } catch (er) { $('#pErr').textContent = er.message; } };
    $('#pBack').onclick = () => { projEdit = null; renderProjects(); };
    $('#pEditForm').onsubmit = async (e) => {
      e.preventDefault(); const f = e.target;
      await withBusy(f, async () => {
        try {
          const members = Object.fromEntries($$('#pEditForm select[data-m]').map((x) => [x.dataset.m, x.value || null]));
          await api('PATCH', `/projects/${p.id}`, { name: f.name.value, key: f.key.value, discord_webhook: f.discord_webhook.value, discord_tester_role: f.discord_tester_role.value, archived: f.archived.checked });
          await api('PUT', `/projects/${p.id}/members`, { members });
          await load(true); toast(t('proj_saved')); projEdit = null; await renderProjects();
        } catch (er) { $('#pErr').textContent = er.message; }
      }, f.querySelector('button.primary'));
    };
    return;
  }
  body.innerHTML = list.map((p) => `<div class="prow"><div style="flex:1;min-width:0"><b>${esc(p.name)}</b><span class="keybadge">${esc(p.key)}</span>${p.archived ? `<span class="pill" style="margin-left:6px">${t('archived')}</span>` : ''}
      <span class="meta">${t('proj_cards', p.cards)} · ${t('proj_members_n', Object.keys(p.members || {}).length)}</span></div><button class="btn" data-pe="${esc(p.id)}">${t('proj_edit')}</button></div>`).join('')
    + `<button class="btn primary" id="pNew">${t('proj_new')}</button>`;
  $$('#projBody [data-pe]').forEach((b) => (b.onclick = () => { projEdit = b.dataset.pe; renderProjects(); }));
  $('#pNew').onclick = () => { projEdit = 'new'; renderProjects(); };
}

// ---------- export & backups (admin) ----------
async function renderBackups() {
  const list = await api('GET', '/backups');
  const lbl = (x) => t(x === 'auto' ? 'bk_by_auto' : x === 'manual' ? 'bk_by_manual' : x === 'before-restore' ? 'bk_by_before' : x) || x;
  $('#bkList').innerHTML = list.map((b) => `<div class="trow"><span class="e">${new Date(b.at).toLocaleString(locale())} <span class="meta">· ${esc(lbl(b.label))} · ${fmtB(b.size)}</span></span><button class="btn" data-restore="${esc(b.id)}" data-at="${esc(new Date(b.at).toLocaleString(locale()))}">${t('bk_restore')}</button></div>`).join('') || `<div class="meta">${t('bk_none')}</div>`;
  $$('#bkList [data-restore]').forEach((b) => (b.onclick = () => {
    if (!confirm(t('bk_confirm', b.dataset.at))) return;
    withBusy(b, async () => { try { const r = await api('POST', `/backups/${encodeURIComponent(b.dataset.restore)}/restore`, {}); $('#bkDlg').close(); await load(true); toast(t('bk_restored', r.cards)); } catch (e) { $('#bkErr').textContent = e.message; } });
  }));
}
$('#bkNow').onclick = () => withBusy($('#bkNow'), async () => { try { await api('POST', '/backups', {}); $('#bkErr').textContent = ''; await renderBackups(); toast(t('bk_done')); } catch (e) { $('#bkErr').textContent = e.message; } });

// ---------- installable app (PWA) ----------
let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (user) renderUserBox(); });
window.addEventListener('appinstalled', () => { installEvt = null; if (user) renderUserBox(); toast(t('installed')); });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));

let cfg = null;
async function initLogin() {
  try { cfg = cfg || await api('GET', '/config'); } catch (e) { $('#loginErr').textContent = e.message; return; } // e.g. offline
  $('#emailLogin').hidden = !cfg.emailLogin;
  if (!cfg.googleClientId) { if (!cfg.emailLogin) $('#loginErr').textContent = t('noGoogle'); return; }
  if (!window.google) {
    await new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'https://accounts.google.com/gsi/client'; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); })
      .catch(() => { $('#loginErr').textContent = t('googleFail'); });
  }
  if (!window.google) return;
  google.accounts.id.initialize({ client_id: cfg.googleClientId, callback: async (r) => {
    try { setUser(await api('POST', '/login/google', { credential: r.credential })); } catch (err) { $('#loginErr').textContent = err.message; }
  } });
  $('#gbtn').innerHTML = ''; google.accounts.id.renderButton($('#gbtn'), { theme: 'filled_black', size: 'large', shape: 'rectangular', locale: lang });
}
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await withBusy(e.target, async () => {
    try { setUser(await api('POST', '/login', Object.fromEntries(new FormData(e.target)))); } catch (err) { $('#loginErr').textContent = err.message; }
  }, e.target.querySelector('button.primary'));
});
$('#loginDlg').addEventListener('cancel', (e) => e.preventDefault());

// ---------- test-failure info (derived from the card history) ----------
function failInfo(c) { // { count: times failed, last: latest failure entry, active: sent back and not yet re-submitted }
  const fails = [], stack = []; let active = false;
  for (const h of c.history || []) {
    if (h.action === 'test_failed') { fails.push(h); active = true; }
    else if (h.action === 'ready_to_test') { stack.push(active); active = false; }
    else if (h.action === 'complete' || h.action === 'reopened') active = false;
    else if (h.action === 'undone') { if (h.text === 'test_failed') { fails.pop(); active = false; } else if (h.text === 'ready_to_test') active = stack.pop() ?? false; }
  }
  if (c.status === 'complete' || c.status === 'ready_to_test') active = false;
  return { count: fails.length, last: fails.at(-1), active };
}
// ---------- filters / sorting ----------
function matches(c) {
  if (F.fail && !failInfo(c).active) return false;
  if (viewProject && c.project !== viewProject) return false;
  if (F.type && c.type !== F.type) return false;
  if (F.who === 'mine' && !(user && c.assignees.includes(user.email))) return false;
  if (F.who === 'unassigned' && c.assignees.length) return false;
  if (F.pri && c.priority !== F.pri) return false;
  if (F.tag && !c.tags.includes(F.tag)) return false;
  if (F.ms && c.milestone !== F.ms) return false;
  if (F.need && !needsMe(c)) return false;
  if (F.own === '__none' ? c.assignees.length : F.own && !c.assignees.includes(F.own)) return false;
  if (F.q) {
    const q = F.q.toLowerCase().trim();
    const hit = q.startsWith('#') ? String(c.num) === q.slice(1) : `${c.title} ${c.description} ${c.repro || ''} ${c.acceptance || ''} ${c.tags.join(' ')} ${c.milestone}`.toLowerCase().includes(q) || String(c.num) === q || refOf(c).toLowerCase() === q;
    if (!hit) return false;
  }
  return true;
}
const anyFilter = () => Object.keys(F0).some((k) => F[k] !== F0[k]);
function needsMe(c) {
  if (!user) return false;
  const mineIP = c.assignees.includes(user.email) && c.status === 'in_progress', r = roleOf(c.project);
  const answer = c.status === 'needs_info' && (c.reporter === user.email || (c.comments || []).some((m) => m.text.startsWith('❓') && (m.mentions || []).includes(user.email)));
  if (answer) return true; // somebody asked you a question
  if (r === 'tester') return c.status === 'ready_to_test';
  if (r === 'dev') return mineIP;
  return r === 'admin' && (c.status === 'ready_to_test' || mineIP);
}
function renderNeed() {
  const n = cards.filter((c) => (!viewProject || c.project === viewProject) && needsMe(c)).length, b = $('#needBtn');
  const nr = isAdmin() ? 'admin' : rv('tester') && !rv('dev') ? 'tester' : 'dev';
  b.innerHTML = `${t('need_' + nr)}<b>${n}</b>`; b.classList.toggle('on', F.need); b.setAttribute('aria-pressed', F.need);
  const nf = cards.filter((c) => (!viewProject || c.project === viewProject) && failInfo(c).active).length, fb = $('#failBtn');
  fb.innerHTML = `❌ ${t('f_failed')}<b>${nf}</b>`; fb.classList.toggle('on', F.fail); fb.setAttribute('aria-pressed', F.fail); fb.hidden = !nf && !F.fail;
  document.title = n ? `(${n}) GeckoBoard` : 'GeckoBoard';
  const sb = $('#sortBtn'); sb.textContent = t('sort_' + sortMode); sb.title = t('sort_tip_' + sortMode); sb.classList.toggle('on', sortMode === 'manual');
}
$('#needBtn').onclick = () => { F.need = !F.need; saveF(); renderNeed(); renderBoard(); $('#fclear').hidden = !anyFilter(); };
$('#failBtn').onclick = () => { F.fail = !F.fail; saveF(); renderNeed(); renderBoard(); $('#fclear').hidden = !anyFilter(); };
$('#sortBtn').onclick = () => { sortMode = sortMode === 'auto' ? 'manual' : 'auto'; try { localStorage.setItem('geckoboard.sort', sortMode); } catch { /* ignore */ } renderNeed(); renderBoard(); };
function syncControls() { // reflect restored filters in the UI
  $('#fq').value = F.q;
  $$('#typeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === F.type));
  $$('#whoSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === F.who));
}
const epos = (c) => c.pos ?? Date.parse(c.created_at);
function sortCards(a, b) {
  if (sortMode === 'manual') return epos(a) - epos(b);
  return (PRI_W[a.priority] - PRI_W[b.priority]) || ((a.due || '9999').localeCompare(b.due || '9999')) || b.updated_at.localeCompare(a.updated_at);
}
function fillSelect(sel, first, opts, cur) {
  sel.innerHTML = `<option value="">${first}</option>` + opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  sel.value = opts.some(([v]) => v === cur) ? cur : '';
}
function renderFilters() {
  fillSelect($('#fpri'), t('all_pri'), ['critical', 'high', 'medium', 'low'].map((p) => [p, t('pri_' + p)]), F.pri);
  fillSelect($('#ftag'), t('all_tags'), [...new Set(cards.flatMap((c) => c.tags))].sort().map((x) => [x, x]), F.tag);
  fillSelect($('#fown'), t('all_assignees'), [['__none', t('unassigned')], ...users.filter((u) => u.role !== 'tester').map((u) => [u.email, u.name])], F.own);
  const mss = [...new Set(cards.map((c) => c.milestone).filter(Boolean))].sort();
  fillSelect($('#fms'), t('all_ms'), mss.map((x) => [x, x]), F.ms);
  $('#msList').innerHTML = mss.map((x) => `<option value="${esc(x)}">`).join('');
  F.pri = $('#fpri').value; F.tag = $('#ftag').value; F.own = $('#fown').value; F.ms = $('#fms').value;
  $('#fclear').hidden = !anyFilter();
  renderNeed();
}
['#fpri', '#ftag', '#fown', '#fms'].forEach((id) => ($(id).onchange = () => { F.pri = $('#fpri').value; F.tag = $('#ftag').value; F.own = $('#fown').value; F.ms = $('#fms').value; saveF(); renderBoard(); $('#fclear').hidden = !anyFilter(); }));
$('#fq').oninput = () => { F.q = $('#fq').value; saveF(); renderBoard(); $('#fclear').hidden = !anyFilter(); };
$('#fclear').onclick = () => {
  Object.assign(F, F0); saveF(); syncControls();
  renderFilters(); renderBoard();
};
for (const [id, key] of [['#typeSeg', 'type'], ['#whoSeg', 'who']]) {
  $$(id + ' button').forEach((b) => (b.onclick = () => {
    $$(id + ' button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); F[key] = b.dataset.v; saveF(); renderBoard(); $('#fclear').hidden = !anyFilter();
  }));
}

// ---------- board ----------
function dueChip(c) {
  if (!c.due) return '';
  const d = daysFrom(c.due), done = c.status === 'complete';
  const cls = done ? '' : d < 0 ? 'late' : d <= 2 ? 'soon' : '';
  const label = !done && d < 0 ? `${t('overdue')} · ${c.due}` : t('due_on', c.due);
  return `<span class="pill ${cls}">📅 ${esc(label)}</span>`;
}
function cardHtml(c) {
  const owner = c.assignees[0], mine = !!user && c.assignees.includes(user.email), lockedByOther = !!owner && !mine;
  const canTick = rl(c.project, 'dev', 'admin') && c.status !== 'complete' && c.status !== 'ready_to_test';
  let ctl = '';
  if (canTick && !lockedByOther) ctl = `<label class="chk" title="${t('tick_tip')}"><input type="checkbox" data-claim="${c.id}" ${mine ? 'checked' : ''}></label>`;
  else if (lockedByOther && canTick) ctl = `<span class="lock" title="${esc(t('claimed_by', nameOf(owner)))}">${LOCK}</span>`;
  const claim = owner ? `<div class="claim${mine ? ' me' : ''}">${avatar(owner)}<span>${mine ? `<b>${t('you')}</b>` : `<b>${esc(nameOf(owner))}</b>`} · ${t(c.status === 'complete' ? 'did_it' : 'working')}</span></div>` : '';
  const chips = [dueChip(c), c.milestone ? `<span class="pill ms">${esc(t('ms_chip', c.milestone))}</span>` : '',
    c.parent && cards.some((x) => x.id === c.parent) ? `<span class="pill" title="${esc(t('parent_of'))}">↳ ${refOf(cards.find((x) => x.id === c.parent))}</span>` : '', cards.some((x) => x.parent === c.id) ? `<span class="pill">⑂ ${cards.filter((x) => x.parent === c.id).length}</span>` : '',
    c.files.length ? `<span class="pill">📎 ${c.files.length}</span>` : '',
].filter(Boolean).join('');
  const fi = failInfo(c);
  const failBadge = fi.active ? `<span class="pill fail" title="${esc(fi.last?.text || '')}">❌ ${t('failed_badge')}${fi.count > 1 ? ' ×' + fi.count : ''}</span>` : fi.count && c.status === 'ready_to_test' ? `<span class="pill retest">↻ ${t('retest_badge', fi.count)}</span>` : '';
  const failNote = fi.active && fi.last ? `<div class="failnote" title="${esc(fi.last.text)}">${esc(fi.last.text)}</div>` : '';
  return `<div class="card${mine ? ' mine' : ''}${lockedByOther ? ' locked' : ''}${flash.has(c.id) ? ' flash' : ''}" data-id="${c.id}" data-pri="${c.priority}" data-st="${c.status}" draggable="true">
    <div class="row">${ctl}<span class="cid">${refOf(c)}</span><span class="tag ${c.type}">${c.type}</span>
    <span class="prib pri-${c.priority}">${t('pri_' + c.priority)}</span></div>
    <div class="title">${esc(c.title)}</div>
    ${failBadge || failNote ? `<div class="chiprow" style="margin-top:0">${failBadge}</div>${failNote}` : ''}
    ${c.tags.length ? `<div class="row">${c.tags.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</div>` : ''}
    ${chips ? `<div class="chiprow">${chips}</div>` : ''}${claim}</div>`;
}
function renderBoard() {
  if (loadedOnce && user && !projects.length && !isAdmin()) { $('#board').innerHTML = `<div class="onb"><div class="big">🔒</div><h2>${t('no_projects_t')}</h2><p>${t('no_projects')}</p></div>`; $('#tabs').innerHTML = ''; return; }
  if (loadedOnce && !cards.length && user) { // brand-new board: guide the first step
    $('#board').innerHTML = `<div class="onb"><div class="big">🦎</div><h2>${t('onb_title')}</h2><p>${t('onb_sub')}</p><button class="btn primary" id="onbNew">${t('onb_btn')}</button></div>`;
    $('#onbNew').onclick = () => openCardDlg(null); $('#tabs').innerHTML = ''; return;
  }
  const vis = cards.filter(matches);
  $('#board').innerHTML = COLS.map(([k, col]) => {
    let list = vis.filter((c) => c.status === k).sort(sortCards);
    let oldBtn = '';
    if (k === 'complete') {
      const old = list.filter((c) => Date.now() - Date.parse(c.updated_at) > OLD_DONE_MS);
      if (old.length && !showOld) { list = list.filter((c) => !old.includes(c)); oldBtn = `<button class="oldbtn" data-old="1">${t('show_old', old.length)}</button>`; }
      else if (old.length) oldBtn = `<button class="oldbtn" data-old="0">${t('hide_old')}</button>`;
    }
    const mineN = user ? list.filter((c) => c.assignees.includes(user.email)).length : 0;
    const hot = rv('tester') && k === 'ready_to_test' && list.length > 0;
    const empty = anyFilter() ? t('no_match') : t('empty_' + k);
    return `<section class="col${mcol === k ? ' active' : ''}" data-status="${k}"><h2><span class="dot" style="background:var(${col})"></span>${t('s_' + k)}
      <span class="cnt">${mineN && rv('dev', 'admin') ? `<span class="count me" title="${t('mine')}">👤 ${mineN}</span>` : ''}<span class="count${hot ? ' hot' : ''}">${list.length}</span></span></h2>`
      + `<div class="colbody">${list.map(cardHtml).join('') || `<div class="empty">${empty}</div>`}${oldBtn}</div></section>`;
  }).join('');
  $('#tabs').innerHTML = COLS.map(([k]) => `<button data-s="${k}" class="${mcol === k ? 'on' : ''}"><span class="tc">${vis.filter((c) => c.status === k).length}</span><span class="tl">${t('s_' + k)}</span></button>`).join('');
  $$('#tabs button').forEach((b) => (b.onclick = () => { mcol = b.dataset.s; renderBoard(); }));
}
function renderAll() { renderFilters(); renderBoard(); renderBell(); }

// Undo: every state change offers a button for a few seconds (the server only lets you undo your own last action)
function undoToast(id, key) { const c = cards.find((x) => x.id === id); toast(t(key, c ? refOf(c) : id), { label: t('undo'), fn: async () => { await api('POST', `/cards/${id}/undo`, {}); await load(); toast(t('undone')); } }); }
function restoreToast(id, ref) { toast(t('u_deleted', ref), { label: t('undo'), fn: async () => { await api('POST', `/trash/${id}/restore`, {}); await load(); toast(t('u_restored', ref)); } }); }

// board interactions: tick-to-claim, open card, "show older"

$('#board').addEventListener('click', async (e) => {
  const old = e.target.closest('[data-old]');
  if (old) { showOld = old.dataset.old === '1'; return renderBoard(); }
  const box = e.target.closest('input[data-claim]');
  if (box) {
    e.stopPropagation(); box.disabled = true;
    const id = +box.dataset.claim, claiming = box.checked; markBusy(id);
    try { await api('POST', `/cards/${id}/${claiming ? 'claim' : 'unclaim'}`, {}); await load(); undoToast(id, claiming ? 'u_claimed' : 'u_released'); }
    catch (err) { await load(); toast(err.data?.claimed_by ? t('already', nameOf(err.data.claimed_by)) : err.message); }
    return;
  }
  if (e.target.closest('.chk')) return;
  const el = e.target.closest('.card'); if (el) showCard(+el.dataset.id);
});
// drag & drop: between columns changes status; inside a column it reorders (manual order mode)
let dropTarget = null; // { id, after } while hovering a card in manual mode
const clearDrop = () => $$('.drop-before,.drop-after,.col.over').forEach((x) => x.classList.remove('drop-before', 'drop-after', 'over'));
$('#board').addEventListener('dragstart', (e) => { const el = e.target.closest('.card'); if (!el) return; dragId = +el.dataset.id; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(dragId)); });
$('#board').addEventListener('dragend', () => { dragId = null; dropTarget = null; $$('.dragging').forEach((x) => x.classList.remove('dragging')); clearDrop(); if (pendingLoad) { pendingLoad = false; load(); } });
$('#board').addEventListener('dragover', (e) => {
  const col = e.target.closest('.col'); if (!col || !dragId) return; e.preventDefault();
  clearDrop(); col.classList.add('over'); dropTarget = null;
  const src = cards.find((x) => x.id === dragId), over = e.target.closest('.card');
  if (sortMode === 'manual' && src && src.status === col.dataset.status && over && +over.dataset.id !== dragId) {
    const r = over.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2;
    over.classList.add(after ? 'drop-after' : 'drop-before'); col.classList.remove('over'); dropTarget = { id: +over.dataset.id, after };
  }
});
$('#board').addEventListener('drop', async (e) => {
  const col = e.target.closest('.col'); if (!col || !dragId) return; e.preventDefault();
  const c = cards.find((x) => x.id === dragId), to = col.dataset.status, target = dropTarget; dragId = null; dropTarget = null; clearDrop();
  if (!c) return;
  if (c.status === to) return reorder(c, col, target);
  await moveCard(c, to);
});
async function reorder(c, col, target) {
  if (sortMode !== 'manual') return toast(t('manual_hint'), { label: t('manual_on'), fn: () => $('#sortBtn').click() }, 6000);
  const ids = [...col.querySelectorAll('.card')].map((el) => +el.dataset.id).filter((id) => id !== c.id); // visible order without the dragged card
  let at = ids.length; // default: end of the column
  if (target) at = ids.indexOf(target.id) + (target.after ? 1 : 0);
  markBusy(c.id);
  try { await api('POST', `/cards/${c.id}/move`, { after: ids[at - 1] || null, before: ids[at] || null }); await load(); } catch (err) { toast(err.message); }
}
async function moveCard(c, to) {
  const from = c.status; if (from === to) return;
  const mine = c.assignees.includes(user.email);
  if (['open-in_progress', 'in_progress-open', 'needs_info-in_progress', 'needs_info-open', 'ready_to_test-complete', 'complete-open', 'complete-in_progress'].includes(`${from}-${to}`)) markBusy(c.id);
  try {
    if (from === 'open' && to === 'in_progress' && rl(c.project, 'dev', 'admin')) { await api('POST', `/cards/${c.id}/claim`, {}); await load(); return undoToast(c.id, 'u_claimed'); }
    else if (from === 'in_progress' && to === 'open' && (mine || rl(c.project, 'admin'))) { await api('POST', `/cards/${c.id}/unclaim`, mine ? {} : { email: c.assignees[0] }); await load(); return undoToast(c.id, 'u_released'); }
    else if (from === 'ready_to_test' && to === 'complete' && rl(c.project, 'tester', 'admin')) { await api('POST', `/cards/${c.id}/pass`, {}); await load(); return undoToast(c.id, 'u_passed'); }
    else if (from === 'ready_to_test' && to === 'in_progress' && rl(c.project, 'tester', 'admin')) return openFailDlg(c);
    else if (from === 'in_progress' && to === 'needs_info' && rl(c.project, 'dev', 'admin')) { if (mine || rl(c.project, 'admin')) return openAskDlg(c); return toast(t('move_not_yours')); }
    else if (from === 'needs_info' && to === 'in_progress' && (rl(c.project, 'dev', 'admin') || c.reporter === user.email)) { await api('POST', `/cards/${c.id}/resume`, {}); await load(); return undoToast(c.id, 'u_resumed'); }
    else if (from === 'complete' && (to === 'open' || to === 'in_progress') && rl(c.project, 'tester', 'admin')) await api('POST', `/cards/${c.id}/reopen`, {});
    else if (from === 'in_progress' && to === 'ready_to_test' && rl(c.project, 'dev', 'admin')) { if (mine || rl(c.project, 'admin')) return openReadyDlg(c); return toast(t('move_not_yours')); }
    else return toast(t('move_no'));
  } catch (err) { toast(err.data?.claimed_by ? t('already', nameOf(err.data.claimed_by)) : err.message); }
  await load();
}

// ---------- card detail ----------
function linkRow(id, removable, kind) {
  const c = cards.find((x) => x.id === id); if (!c) return '';
  return `<div class="lnk"><a data-open="${id}">${c ? refOf(c) : '#' + id} ${esc(c?.title || '?')}</a><span class="pill">${c ? t('s_' + c.status) : ''}</span>${removable ? `<button class="x" data-unlink="${id}" data-kind="${kind}" title="${t('unlink')}">✕</button>` : ''}</div>`;
}
function mdText(c) {
  const L = [`${refOf(c)} ${c.title}`, `${c.type} · ${t('s_' + c.status)} · ${t('pri_' + c.priority)}`];
  if (c.assignees.length) L.push(`${t('working')}: ${c.assignees.map(nameOf).join(', ')}`);
  if (c.due) L.push(t('due_on', c.due)); if (c.milestone) L.push(t('ms_chip', c.milestone));
  if (c.description) L.push('', c.description);
  if (c.repro) L.push('', t('repro_h') + ':', c.repro);
  if (c.acceptance) L.push('', t('acc_h') + ':', c.acceptance);
  if (c.test_steps.length) L.push('', t('howtest'), ...c.test_steps.map((s, i) => `${i + 1}. ${s}`));
  if (location.origin) L.push('', `${location.origin}/#card-${c.id}`);
  return L.join('\n');
}
function showCard(id, keep) {
  const c = cards.find((x) => x.id === id); if (!c) return;
  openId = id;
  const scroll = $('#viewDlg').scrollTop; const draft = $('#cmt')?.value;
  const mine = c.assignees.includes(user.email), owner = c.assignees[0];
  const canEdit = rl(c.project, 'admin') || c.reporter === user.email || mine;
  const kids = cards.filter((x) => x.parent === c.id);
  const prim = [], sec = []; // primary = the next step for this card (sticky bar on phones); secondary = release / edit steps / delete
  if (c.status !== 'complete' && rl(c.project, 'dev', 'admin')) {
    if (mine) sec.push(`<button class="btn" data-a="unclaim">${t('release')}</button>`);
    else if (!owner) prim.push(`<button class="btn primary" data-a="claim">${t('claim')}</button>`);
    else if (rl(c.project, 'admin')) sec.push(`<button class="btn" data-a="unclaim_other" data-email="${esc(owner)}">${t('release_other', nameOf(owner))}</button>`);
  }
  if (c.status === 'in_progress' && rl(c.project, 'dev', 'admin') && (mine || rl(c.project, 'admin'))) sec.unshift(`<button class="btn" data-a="ask">❓ ${t('ask_btn')}</button>`);
  if (c.status === 'needs_info' && (rl(c.project, 'dev', 'admin') || c.reporter === user.email)) prim.push(`<button class="btn primary" data-a="resume">✅ ${t('resume_btn')}</button>`);
  if (c.status === 'ready_to_test' && rl(c.project, 'tester', 'admin')) prim.push(`<button class="btn ok" data-a="pass">${t('pass')}</button><button class="btn bad" data-a="fail">${t('fail')}</button>`);
  if (c.status === 'complete' && rl(c.project, 'tester', 'admin')) prim.push(`<button class="btn" data-a="reopen">${t('reopen')}</button>`);
  if (rl(c.project, 'dev', 'admin') && (mine || rl(c.project, 'admin')) && (c.status === 'in_progress' || c.status === 'ready_to_test')) {
    (c.status === 'in_progress' ? prim : sec).unshift(`<button class="btn ${c.status === 'in_progress' ? 'primary' : ''}" data-a="ready">${t(c.status === 'in_progress' ? 'send_test' : 'edit_steps')}</button>`);
  }
  if (rl(c.project, 'dev', 'admin')) sec.push(`<button class="btn danger" data-a="delete">🗑 ${t('delete')}</button>`);
  const files = c.files.map((f) => {
    const vid = f.mime.startsWith('video/');
    const thumbSrc = f.thumb ? `/api/files/${f.id}?thumb=1` : (!f.purged && !vid ? `/api/files/${f.id}` : '');
    let media;
    if (f.purged) media = thumbSrc ? `<img src="${thumbSrc}" class="gone" alt="${esc(f.name)}" data-gone="1" loading="lazy">` : `<div class="ph" data-gone="1">${vid ? '🎞' : '🖼'}</div>`;
    else if (vid) media = `<video src="/api/files/${f.id}" ${thumbSrc ? `poster="${thumbSrc}"` : ''} controls preload="none"></video>`;
    else media = `<img src="${thumbSrc}" alt="${esc(f.name)}" data-lb="${f.id}" loading="lazy">`;
    const mineF = rl(c.project, 'admin') || f.by === user.email;
    return `<div class="thumb" title="${esc(f.name)}">${media}${f.purged ? `<span class="rec">♻ ${t('recycled')}</span>` : ''}
      ${mineF || f.pinned ? `<button class="pin${f.pinned ? ' on' : ''}" data-pin="${f.id}" data-on="${f.pinned ? 1 : 0}" title="${t(f.pinned ? 'unpin' : 'pin')}" ${mineF ? '' : 'disabled'}>📌</button>` : ''}
      ${mineF ? `<button class="x" data-rmfile="${f.id}" data-name="${esc(f.name)}" title="${t('remove_file')}">✕</button>` : ''}</div>`;
  }).join('');
  const stCol = `var(${COLOR[c.status]})`;
  $('#viewBody').innerHTML = `
    <button type="button" class="dx" data-a="close" aria-label="Close">✕</button>
    <div class="dhead"><span class="tag ${c.type}">${c.type}</span><span class="cid">${refOf(c)}</span><span class="meta">${t('by')} ${esc(nameOf(c.reporter))}</span>
      <span class="prib pri-${c.priority}" style="margin-left:0">${t('pri_' + c.priority)}</span>
      <span class="status" style="margin-left:auto;color:${stCol};border:1px solid ${stCol}">${t('s_' + c.status)}</span></div>
    <div class="dgrid">
     <div class="dmain">
      ${(() => { const fi = failInfo(c); return fi.active && fi.last ? `<div class="failbox"><b>❌ ${t('failed_by', nameOf(fi.last.user))}${fi.count > 1 ? ' · ' + t('failed_times', fi.count) : ''}</b><div>${esc(fi.last.text)}</div><small>${new Date(fi.last.at).toLocaleString(locale())}</small></div>` : fi.count && c.status === 'ready_to_test' ? `<div class="failbox retest"><b>↻ ${t('retest_badge', fi.count)}</b></div>` : ''; })()}
      ${c.status === 'needs_info' ? (() => { const q = [...c.comments].reverse().find((m) => m.text.startsWith('❓ Needs info')); return q ? `<div class="askbox"><b>❓ ${t('ask_from', nameOf(q.user))}</b><div>${esc(q.text.replace(/^❓ Needs info:\s*/, ''))}</div><small>${new Date(q.at).toLocaleString(locale())} · ${t('ask_hint')}</small></div>` : ''; })() : ''}
      <div class="s-title"><h3>${esc(c.title)}</h3>
        <div class="row">${canEdit ? `<button class="btn" data-a="edit">✎ ${t('edit')}</button>` : ''}<button class="btn" data-a="copytext">${t('copy_text')}</button></div></div>
      ${c.tags.length || c.due || c.milestone ? `<div class="chiprow s-chips" style="margin:0">${c.tags.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}${dueChip(c)}${c.milestone ? `<span class="pill ms">${esc(t('ms_chip', c.milestone))}</span>` : ''}</div>` : ''}
      ${c.description ? `<div class="box s-desc">${esc(c.description)}</div>` : ''}
      ${c.repro ? `<div class="sec s-repro"><h4>🐞 ${t('repro_h')}</h4><div class="box" style="white-space:pre-wrap">${esc(c.repro)}</div></div>` : ''}
      ${c.acceptance ? `<div class="sec s-acc"><h4>🎯 ${t('acc_h')}</h4><div class="box accbox" style="white-space:pre-wrap">${esc(c.acceptance)}</div></div>` : ''}
      <div class="sec s-att"><h4>${t('attachments')} ${c.files.length ? `(${c.files.length})` : ''}</h4>
        ${files ? `<div class="gal">${files}</div>` : ''}
        <div class="drop" id="drop">${t('drop_hint')} · <a href="#" id="pickFile">${t('add_file')}</a>
          <input type="file" id="fileIn" multiple hidden accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm"></div></div>
      ${c.test_steps.length ? `<div class="sec s-steps"><h4>${t('howtest')}</h4>
        ${c.dev_summary ? `<div class="box testbox" style="margin-bottom:10px">${esc(c.dev_summary)}</div>` : ''}
        <ol class="steps">${c.test_steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>` : ''}
      <div class="sec s-comments"><h4>${t('comments')}</h4>
        ${c.comments.map((m) => `<div class="cm"><b>${esc(nameOf(m.user))}</b> ${esc(m.text).replace(/@([\p{L}\p{N}_.\-@]+)/gu, '<span style="color:var(--accent)">@$1</span>')}</div>`).join('') || `<div class="meta">${t('nocomments')}</div>`}
        <div class="row" style="margin-top:10px;position:relative;flex-wrap:nowrap"><div class="sugg" id="sugg" hidden></div><input id="cmt" placeholder="${esc(t('writecomment'))}" style="flex:1" autocomplete="off"><button class="btn" data-a="comment">${t('send')}</button></div></div>
     </div>
     <aside class="dside">
      <div class="banner s-banner${mine ? ' me' : ''}">${owner ? avatar(owner, 'lg') : '<span class="av lg" style="background:var(--surface3);color:var(--mute)">?</span>'}
        <div class="who">${owner ? `<b>${mine ? t('you') : esc(nameOf(owner))}</b><small>${t(c.status === 'complete' ? 'did_it' : 'working')}</small>` : `<span class="meta">${t('noassignee')}</span>`}</div></div>
      <div class="actions sideacts">${prim.join('')}</div>
      ${(() => { // hand the card to a teammate: anyone for an unassigned card, the owner (or an admin) for an owned one
        if (!(rl(c.project, 'dev', 'admin') && c.status !== 'complete' && (!owner || mine || rl(c.project, 'admin')))) return '';
        const opts = assignable(c.project).filter((u) => u.email !== owner).sort((x, y) => (x.email === user.email ? -1 : y.email === user.email ? 1 : x.name.localeCompare(y.name)));
        return opts.length ? `<div class="sec s-assign"><h4>${t(owner ? 'handover' : 'assign_to')}</h4><div class="row" style="flex-wrap:nowrap"><select id="asgSel"><option value="">${esc(t('assign_pick'))}</option>${opts.map((u) => `<option value="${esc(u.email)}">${esc(u.name)}${u.email === user.email ? ' ' + t('assign_me') : ''}</option>`).join('')}</select><button class="btn" data-a="assign">${t('assign_btn')}</button></div></div>` : '';
      })()}
      <div class="sec s-links"><h4>${t('links')}</h4>
        ${c.parent && cards.some((x) => x.id === c.parent) ? `<div class="meta">${t('parent_of')}</div>${linkRow(c.parent, canEdit, 'parent')}` : ''}
        ${kids.length ? `<div class="meta">${t('subcards')}</div>${kids.map((k) => linkRow(k.id, false)).join('')}` : ''}
        ${c.related.some((r) => cards.some((x) => x.id === r)) ? `<div class="meta">${t('related')}</div>${c.related.map((r) => linkRow(r, true, 'related')).join('')}` : ''}
        <div class="row" style="margin-top:8px;flex-wrap:nowrap"><input id="linkId" type="number" min="1" placeholder="${t('add_related')}"><button class="btn" data-a="link">${t('link')}</button></div>
        ${canEdit ? `<div class="row" style="margin-top:8px;flex-wrap:nowrap"><input id="parentId" type="number" min="1" placeholder="${t('set_parent')}"><button class="btn" data-a="setparent">${t('save')}</button></div>` : ''}</div>
      <div class="sec s-data" id="cardData" hidden></div>
      <div class="actions sideacts2 s-more">${sec.join('')}</div>
      <details class="sec hist s-hist"><summary>${t('history')}</summary>${c.history.map((h) => `<div>${new Date(h.at).toLocaleString(locale())} · ${esc(nameOf(h.user))} · ${esc(t('a_' + h.action))} ${esc(h.action === 'assigned' ? nameOf(h.text) : h.text)}</div>`).join('')}</details>
     </aside>
    </div>
    <div class="actions foot"><span class="sp"></span><button class="btn" data-a="close">${t('close')}</button></div>`;
  if (draft) $('#cmt').value = draft;
  wireDetail(c);
  if (typeof renderCardData === 'function') renderCardData(c);
  if (!keep && !$('#viewDlg').open) $('#viewDlg').showModal();
  if (keep) $('#viewDlg').scrollTop = scroll;
  if (location.hash !== `#card-${id}`) history.replaceState(null, '', `#card-${id}`);
}
function wireDetail(c) {
  const body = $('#viewBody');
  $$('#viewBody [data-a]').forEach((b) => (b.onclick = () => act(c, b.dataset.a, b)));
  $$('#viewBody [data-open]').forEach((a) => (a.onclick = () => showCard(+a.dataset.open)));
  $$('#viewBody [data-unlink]').forEach((b) => (b.onclick = async () => {
    try { if (b.dataset.kind === 'parent') await api('PATCH', `/cards/${c.id}`, { parent: null }); else await api('POST', `/cards/${c.id}/unlink`, { id: +b.dataset.unlink }); await load(); } catch (e) { toast(e.message); }
  }));
  $$('#viewBody [data-lb]').forEach((img) => (img.onclick = () => openLightbox(c.files.filter((f) => !f.purged && f.mime.startsWith('image/')), img.dataset.lb)));
  $$('#viewBody [data-gone]').forEach((el) => (el.onclick = () => toast(t('recycled_note'))));
  $$('#viewBody [data-pin]').forEach((b) => (b.onclick = async () => { try { await api('PATCH', `/cards/${c.id}/files/${b.dataset.pin}`, { pinned: b.dataset.on !== '1' }); await load(); } catch (e) { toast(e.message); } }));
  $$('#viewBody [data-rmfile]').forEach((b) => (b.onclick = async () => { if (!confirm(t('confirm_remove_file', b.dataset.name))) return; try { await api('DELETE', `/cards/${c.id}/files/${b.dataset.rmfile}`); await load(); } catch (e) { toast(e.message); } }));
  const drop = $('#drop'), fin = $('#fileIn');
  $('#pickFile').onclick = (e) => { e.preventDefault(); fin.click(); };
  const doUpload = async (files) => { if (!files.length) return; drop.textContent = t('uploading'); await attach(c.id, files); await load(); };
  fin.onchange = () => doUpload([...fin.files]);
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('over'); doUpload([...e.dataTransfer.files]); };
  // mention suggestions
  const cmt = $('#cmt'), sg = $('#sugg');
  cmt.oninput = () => {
    const m = /@([\p{L}\p{N}_.\-]*)$/u.exec(cmt.value.slice(0, cmt.selectionStart));
    if (!m) { sg.hidden = true; return; }
    const q = m[1].toLowerCase();
    const list = users.filter((u) => u.name.toLowerCase().includes(q) || u.email.startsWith(q)).slice(0, 5);
    sg.innerHTML = list.map((u) => `<div data-n="${esc(u.name.replace(/\s+/g, ''))}">${avatar(u.email)} ${esc(u.name)}</div>`).join(''); sg.hidden = !list.length;
    $$('#sugg div').forEach((d) => (d.onmousedown = (ev) => { ev.preventDefault(); const pos = cmt.selectionStart; cmt.value = cmt.value.slice(0, pos).replace(/@([\p{L}\p{N}_.\-]*)$/u, '@' + d.dataset.n + ' ') + cmt.value.slice(pos); sg.hidden = true; cmt.focus(); }));
  };
  cmt.onblur = () => setTimeout(() => (sg.hidden = true), 150);
  cmt.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); act(c, 'comment', $('#viewBody [data-a=comment]')); } };
}
// Ctrl+V a screenshot (or several): into the open form/card, or anywhere on the board to start a new card with it
document.addEventListener('paste', (e) => {
  const files = imagesFrom(e.clipboardData).map(named);
  if (!files.length || !user) return;
  if ($('#failDlg').open && failFor) { e.preventDefault(); toast(t('uploading')); attach(failFor.id, files).then(load); return; } // screenshot of the problem
  if ($('#cardDlg').open) { e.preventDefault(); if (editId) { toast(t('uploading')); attach(editId, files).then(load); } else addPending(files); return; }
  if ($('#viewDlg').open && openId) { e.preventDefault(); toast(t('uploading')); attach(openId, files).then(load); return; }
  if ($$('dialog[open]').length) return; // some other dialog (login, team...) is open
  e.preventDefault(); openCardDlg(null); addPending(files); // pasted on the board: new card with the image(s)
});
let failFor = null;
function openFailDlg(c) { failFor = c; const f = $('#failForm'); f.reset(); $('#failErr').textContent = ''; $('#failDlg').showModal(); f.text.focus(); }
$('#failCancel').onclick = () => $('#failDlg').close();
$('#failForm').addEventListener('submit', async (e) => {
  e.preventDefault(); const text = e.target.text.value.trim();
  if (!text) { $('#failErr').textContent = t('fail_need'); return; }
  await withBusy(e.target, async () => {
  try { const id = failFor.id; await api('POST', `/cards/${id}/fail`, { text }); $('#failDlg').close(); $('#viewDlg').close(); await load(); undoToast(id, 'u_failed'); } catch (err) { $('#failErr').textContent = err.message; }
  }, e.target.querySelector('button.bad'));
});
let askFor = null;
function openAskDlg(c) { askFor = c; const f = $('#askForm'); f.reset(); $('#askErr').textContent = ''; $('#askDlg').showModal(); f.text.focus(); }
$('#askCancel').onclick = () => $('#askDlg').close();
$('#askForm').addEventListener('submit', async (e) => {
  e.preventDefault(); const text = e.target.text.value.trim();
  if (!text) { $('#askErr').textContent = t('ask_need'); return; }
  await withBusy(e.target, async () => {
    try { const id = askFor.id; await api('POST', `/cards/${id}/ask`, { text }); $('#askDlg').close(); $('#viewDlg').close(); await load(); undoToast(id, 'u_asked'); } catch (err) { $('#askErr').textContent = err.message; }
  }, e.target.querySelector('button.primary'));
});
let readyFor = null;
function openReadyDlg(c) {
  readyFor = c; const f = $('#readyForm'); f.reset(); $('#readyErr').textContent = '';
  f.summary.value = c.dev_summary || ''; f.steps.value = c.test_steps.join('\n');
  $('#readyDlg').showModal(); f.steps.focus();
}
$('#readyCancel').onclick = () => $('#readyDlg').close();
$('#readyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const steps = e.target.steps.value.split('\n').map((x) => x.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
  if (!steps.length) { $('#readyErr').textContent = t('ready_need'); return; }
  await withBusy(e.target, async () => {
  try { const id = readyFor.id, wasIP = readyFor.status === 'in_progress'; await api('POST', `/cards/${id}/ready`, { summary: e.target.summary.value, test_steps: steps }); $('#readyDlg').close(); await load(); if (wasIP) undoToast(id, 'u_ready'); }
  catch (err) { $('#readyErr').textContent = err.message; }
  }, e.target.querySelector('button.primary'));
});
function act(c, a, btn) {
  if (['close', 'edit', 'copytext', 'ready', 'fail', 'ask'].includes(a)) return actInner(c, a, btn);
  return withBusy(btn, () => actInner(c, a, btn)); // one request at a time per button
}
async function actInner(c, a, btn) {
  if (a === 'close') return $('#viewDlg').close();
  if (a === 'ready') return openReadyDlg(c);
  if (a === 'ask') return openAskDlg(c);
  if (a === 'edit') return openCardDlg(c);
  if (a === 'copytext') return copyText(mdText(c), btn, 'copy_text');
  try {
    const byNum = (n) => cards.find((x) => x.project === c.project && x.num === n)?.id; // typed numbers are per project (ALPHA-12 -> 12)
    if (a === 'link') { const n = +$('#linkId').value; if (!n) return; const id = byNum(n); if (!id) return toast(tErr(`Card #${n} not found in this project`)); await api('POST', `/cards/${c.id}/link`, { id }); return await load(); }
    if (a === 'setparent') { const n = +$('#parentId').value; if (!n) return; const id = byNum(n); if (!id) return toast(tErr(`Card #${n} not found in this project`)); await api('PATCH', `/cards/${c.id}`, { parent: id }); return await load(); }
    if (a === 'unclaim_other') {
      const em = btn.dataset.email; if (!confirm(t('confirm_release_other', nameOf(em)))) return;
      await api('POST', `/cards/${c.id}/unclaim`, { email: em }); return await load();
    }
    if (a === 'delete') {
      if (!confirm(t('confirm_delete', refOf(c), c.title))) return;
      const ref = refOf(c); await api('DELETE', '/cards/' + c.id); $('#viewDlg').close(); await load(); return restoreToast(c.id, ref);
    }
    const body = {};
    if (a === 'comment') { body.text = $('#cmt').value; if (!body.text.trim()) return; }
    if (a === 'assign') { body.assignee = $('#asgSel').value; if (!body.assignee) return; }
    if (a === 'fail') return openFailDlg(c);
    try { await api('POST', `/cards/${c.id}/${a}`, body); }
    catch (er) { await load(); if (er.data?.claimed_by) { toast(t('already', nameOf(er.data.claimed_by))); return; } throw er; }
    await load();
    if (a === 'pass') { $('#viewDlg').close(); undoToast(c.id, 'u_passed'); }
    if (a === 'resume') undoToast(c.id, 'u_resumed');
    if (a === 'assign') undoToast(c.id, 'u_assigned');
    else if (a === 'claim') undoToast(c.id, 'u_claimed');
    else if (a === 'unclaim') undoToast(c.id, 'u_released');
  } catch (e) { toast(e.message); }
}
$('#viewDlg').addEventListener('close', () => { openId = null; if (location.hash.startsWith('#card-')) history.replaceState(null, '', location.pathname); });
// slideshow lightbox: ← → to move, click image to zoom, Esc to close
let lb = { items: [], i: 0 };
function openLightbox(items, id) { lb = { items, i: Math.max(0, items.findIndex((f) => f.id === id)) }; lbShow(); if (!$('#lbDlg').open) $('#lbDlg').showModal(); }
function lbShow() {
  const f = lb.items[lb.i]; if (!f) return;
  $('#lbDlg').classList.remove('zoom'); $('#lbImg').src = `/api/files/${f.id}`; $('#lbImg').alt = f.name;
  $('#lbCap').textContent = `${f.name}  (${lb.i + 1}/${lb.items.length})`; $('#lbDl').href = `/api/files/${f.id}`; $('#lbDl').download = f.name;
  $('#lbPrev').hidden = $('#lbNext').hidden = lb.items.length < 2;
  for (const d of [-1, 1]) { const n = lb.items[(lb.i + d + lb.items.length) % lb.items.length]; if (n) new Image().src = `/api/files/${n.id}`; } // preload neighbours
}
const lbGo = (d) => { if (lb.items.length < 2) return; lb.i = (lb.i + d + lb.items.length) % lb.items.length; lbShow(); };
$('#lbPrev').onclick = () => lbGo(-1); $('#lbNext').onclick = () => lbGo(1); $('#lbClose').onclick = () => $('#lbDlg').close();
$('#lbImg').onclick = (e) => { e.stopPropagation(); $('#lbDlg').classList.toggle('zoom'); };
$('#lbWrap').onclick = () => $('#lbDlg').close();
document.addEventListener('keydown', (e) => { if (!$('#lbDlg').open) return; if (e.key === 'ArrowLeft') lbGo(-1); else if (e.key === 'ArrowRight') lbGo(1); });

// ---------- create / edit dialog ----------
let editId = null, pending = [];
const imagesFrom = (dt) => [...(dt?.files || [])].filter((f) => /^(image\/(png|jpeg|gif|webp)|video\/(mp4|webm))$/.test(f.type));
const named = (f, i) => (f.name && f.name !== 'image.png' ? f : new File([f], `screenshot-${Date.now()}-${i}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, { type: f.type }));
function renderPending() {
  $('#pendingBox').innerHTML = pending.map((f, i) => `<div class="thumb">${f.type.startsWith('image/') ? `<img src="${URL.createObjectURL(f)}" alt="">` : '<div class="ph">🎞</div>'}<button type="button" class="x" data-rm="${i}">✕</button></div>`).join('');
  $$('#pendingBox [data-rm]').forEach((b) => (b.onclick = () => { pending.splice(+b.dataset.rm, 1); renderPending(); }));
}
function addPending(files) {
  const room = MAX_FILES - pending.length;
  if (files.length > room) toast(t('max_files', MAX_FILES));
  pending.push(...files.slice(0, Math.max(0, room)).map(named)); renderPending();
  toast(t('pasted_n', Math.min(files.length, Math.max(0, room))));
}
$('#newPick').onclick = (e) => { e.preventDefault(); $('#newFiles').click(); };
$('#newFiles').onchange = () => { addPending([...$('#newFiles').files]); $('#newFiles').value = ''; };
$('#newDrop').ondragover = (e) => { e.preventDefault(); $('#newDrop').classList.add('over'); };
$('#newDrop').ondragleave = () => $('#newDrop').classList.remove('over');
$('#newDrop').ondrop = (e) => { e.preventDefault(); $('#newDrop').classList.remove('over'); addPending([...e.dataTransfer.files]); };
const DRAFT_KEY = 'geckoboard.draft';
const formState = () => JSON.stringify(Object.fromEntries(new FormData($('#cardForm'))));
let cardInitial = '';
const draftHasText = () => { const f = $('#cardForm'); return !!(f.title.value.trim() || f.description.value.trim() || f.repro.value.trim() || f.acceptance.value.trim() || f.tags.value.trim()); };
let draftT; function saveDraft() { if (editId) return; clearTimeout(draftT); draftT = setTimeout(() => { try { if (draftHasText()) localStorage.setItem(DRAFT_KEY, formState()); else localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } }, 300); }
const clearDraft = () => { clearTimeout(draftT); try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } };
function openCardDlg(c) {
  editId = c ? c.id : null; pending = []; renderPending();
  const f = $('#cardForm'); f.reset(); $('#cardErr').textContent = ''; $('#draftBar').hidden = true;
  $('#cardDlgTitle').textContent = t(c ? 'edit_card' : 'newcard'); $('#cardSubmit').textContent = t(c ? 'save' : 'create');
  $('#newFilesRow').hidden = !!c;
  const ps = f.project, mine = activeProjects();
  ps.innerHTML = mine.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} (${esc(p.key)})</option>`).join(''); ps.value = c ? c.project : (mine.some((p) => p.id === curPid()) ? curPid() : mine[0]?.id || '');
  $('#projRow').hidden = !!c || mine.length <= 1;
  fillAssignee(c);
  if (c) { f.type.value = c.type; f.priority.value = c.priority; f.title.value = c.title; f.description.value = c.description; f.repro.value = c.repro || ''; f.acceptance.value = c.acceptance || ''; f.tags.value = c.tags.join(', '); f.due.value = c.due; f.milestone.value = c.milestone; f.parent.value = c.parent ? cards.find((x) => x.id === c.parent)?.num || '' : ''; }
  else { // restore an unfinished draft
    try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); if (d) { for (const k of Object.keys(d)) if (f[k]) f[k].value = d[k]; $('#draftBar').hidden = false; } } catch { /* ignore */ }
  }
  syncReproRow();
  cardInitial = formState();
  $('#cardDlg').showModal();
}
function fillAssignee(c) { // optional "assign to" when creating a card (dev/admin only)
  const f = $('#cardForm'), pid = f.project.value, row = $('#asgRow');
  row.hidden = !!c || !pid || !rl(pid, 'dev', 'admin');
  f.assignee.innerHTML = `<option value="">—</option>` + assignable(pid).map((u) => `<option value="${esc(u.email)}">${esc(u.name)}${u.email === user.email ? ' ' + t('assign_me') : ''}</option>`).join('');
}
$('#cardForm').project.addEventListener('change', () => fillAssignee(null));
const syncReproRow = () => { $('#reproRow').hidden = $('#cardForm').type.value !== 'ticket'; }; // repro steps only make sense for tickets (bug reports)
$('#cardForm').type.addEventListener('change', syncReproRow);
$('#cardForm').addEventListener('input', saveDraft);
$('#draftFresh').onclick = () => { clearDraft(); $('#cardForm').reset(); syncReproRow(); $('#draftBar').hidden = true; cardInitial = formState(); };
function okToCloseCardDlg() { // Esc / Cancel: never lose work silently
  if (editId) return formState() === cardInitial || confirm(t('discard_changes'));
  if (pending.length && !confirm(t('discard_images', pending.length))) return false;
  if (draftHasText()) { saveDraft(); toast(t('draft_saved')); }
  return true;
}
$('#cardDlg').addEventListener('cancel', (e) => { if (!okToCloseCardDlg()) e.preventDefault(); });
$('#newBtn').onclick = () => openCardDlg(null);
$('#cardForm').addEventListener('submit', async (e) => {
  if (e.submitter?.value !== 'ok') return;
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  f.parent = f.parent ? (cards.find((x) => x.project === (editId ? cards.find((y) => y.id === editId)?.project : f.project) && x.num === +f.parent)?.id ?? -1) : null; // typed number is per project
  await withBusy(e.target, async () => {
  try {
    let card;
    if (editId) card = await api('PATCH', '/cards/' + editId, f);
    else { card = await api('POST', '/cards', f); clearDraft(); if (pending.length) { toast(t('uploading')); await attach(card.id, pending); pending = []; } }
    $('#cardDlg').close(); await load(); if (editId) showCard(editId, true);
  } catch (err) { $('#cardErr').textContent = err.message; }
  }, $('#cardSubmit'));
});
$('#cardForm').addEventListener('click', (e) => { if (e.target.value === 'cancel') { e.preventDefault(); if (okToCloseCardDlg()) $('#cardDlg').close(); } });

// ---------- summary ----------
function stats() {
  const cards = vcards();
  const cyc = []; const byDev = {}; const byTester = {};
  const dev = (e) => (byDev[e] ||= { ip: 0, ready: 0, done: 0, times: [] });
  for (const c of cards) {
    const claimed = c.history.find((h) => h.action === 'claimed'), done = [...c.history].reverse().find((h) => h.action === 'complete');
    for (const o of c.assignees) { const d = dev(o); if (c.status === 'in_progress') d.ip++; if (c.status === 'ready_to_test') d.ready++; }
    if (c.status === 'complete' && claimed && done) { const ms = Date.parse(done.at) - Date.parse(claimed.at); cyc.push(ms); dev(claimed.user).done++; dev(claimed.user).times.push(ms); }
    for (const h of c.history) if (h.action === 'complete' || h.action === 'test_failed') { const tt = (byTester[h.user] ||= { passed: 0, failed: 0 }); h.action === 'complete' ? tt.passed++ : tt.failed++; }
  }
  const passed = Object.values(byTester).reduce((n, x) => n + x.passed, 0), failed = Object.values(byTester).reduce((n, x) => n + x.failed, 0);
  return { cyc, byDev, byTester, passed, failed };
}
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
function renderSummary() {
  const cards = vcards(), s = stats(), open = cards.filter((c) => c.status !== 'complete');
  const stale = cards.filter((c) => c.status === 'in_progress' && Date.now() - Date.parse(c.updated_at) > STALE_MS).sort((a, b) => a.updated_at.localeCompare(b.updated_at));
  const late = open.filter((c) => c.due && c.due < today()).sort((a, b) => a.due.localeCompare(b.due));
  const li = (c, extra) => `<div class="lnk"><a data-open="${c.id}">#${c.id} ${esc(c.title)}</a><span class="pill">${esc(c.assignees.map(nameOf).join(', ') || '—')}</span><span class="pill late">${esc(extra)}</span></div>`;
  $('#sumBody').innerHTML = `
    <div class="kpis">${COLS.map(([k, c]) => `<div class="kpi"><b style="color:var(${c})">${cards.filter((x) => x.status === k).length}</b><small>${t('s_' + k)}</small></div>`).join('')}
      <div class="kpi"><b>${fmtDur(avg(s.cyc))}</b><small>${t('sum_cycle')}</small></div>
      <div class="kpi"><b>${s.passed + s.failed ? Math.round(100 * s.failed / (s.passed + s.failed)) + '%' : '—'}</b><small>${t('sum_fail')}</small></div></div>
    <div><h4 class="meta" style="margin:6px 0">${t('sum_devs')}</h4><table class="sum"><tr><th>${t('col_dev')}</th><th>${t('col_ip')}</th><th>${t('col_ready')}</th><th>${t('col_done')}</th><th>${t('col_avg')}</th></tr>
      ${Object.entries(s.byDev).map(([e, d]) => `<tr><td>${avatar(e)} ${esc(nameOf(e))}</td><td>${d.ip}</td><td>${d.ready}</td><td>${d.done}</td><td>${fmtDur(avg(d.times))}</td></tr>`).join('') || `<tr><td colspan="5" class="meta">—</td></tr>`}</table></div>
    <div><h4 class="meta" style="margin:6px 0">${t('sum_testers')}</h4><table class="sum"><tr><th>${t('col_tester')}</th><th>${t('passed')}</th><th>${t('failed')}</th></tr>
      ${Object.entries(s.byTester).map(([e, d]) => `<tr><td>${avatar(e)} ${esc(nameOf(e))}</td><td>${d.passed}</td><td>${d.failed}</td></tr>`).join('') || `<tr><td colspan="3" class="meta">—</td></tr>`}</table></div>
    <div><h4 class="meta" style="margin:6px 0">${t('sum_stale')} (${stale.length})</h4>${stale.map((c) => li(c, fmtDur(Date.now() - Date.parse(c.updated_at)))).join('') || `<div class="meta">${t('none')}</div>`}</div>
    <div><h4 class="meta" style="margin:6px 0">${t('sum_overdue')} (${late.length})</h4>${late.map((c) => li(c, c.due)).join('') || `<div class="meta">${t('none')}</div>`}</div>`;
  $$('#sumBody [data-open]').forEach((a) => (a.onclick = () => { $('#sumDlg').close(); showCard(+a.dataset.open); }));
}
$('#sumBtn').onclick = () => { renderSummary(); $('#sumDlg').showModal(); };

// ---------- notifications (bell) ----------
const seenKey = () => 'geckoboard.seen.' + (user?.email || '');
function notifs() {
  if (!user) return [];
  const out = [];
  for (const c of cards) {
    for (const m of c.comments) if ((m.mentions || []).includes(user.email) && m.user !== user.email) out.push({ at: m.at, id: c.id, text: t('n_mention', nameOf(m.user), refOf(c)), sub: m.text.slice(0, 80) });
    const asg = c.status !== 'complete' && c.assignees.includes(user.email) ? c.history.filter((h) => h.action === 'assigned' && h.text === user.email && h.user !== user.email).at(-1) : null;
    if (asg) out.push({ at: asg.at, id: c.id, text: t('n_assigned', nameOf(asg.user), refOf(c)), sub: c.title.slice(0, 80) });
    if (c.assignees.includes(user.email)) for (const h of c.history) if (h.action === 'test_failed') out.push({ at: h.at, id: c.id, text: t('n_failed', refOf(c)), sub: h.text.slice(0, 80) });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 15);
}
function renderBell() {
  const list = notifs(); let seen = ''; try { seen = localStorage.getItem(seenKey()) || ''; } catch { /* ignore */ }
  const unread = list.filter((n) => n.at > seen).length;
  const mineLate = user ? cards.filter((c) => c.status !== 'complete' && c.assignees.includes(user.email) && c.due && c.due < today()).length : 0;
  const ready = cards.filter((c) => c.status === 'ready_to_test' && rl(c.project, 'tester', 'admin')).length;
  const asked = user ? cards.filter((c) => c.status === 'needs_info' && c.reporter === user.email && !c.assignees.includes(user.email)) : [];
  const extra = [...asked.map((c) => ({ id: c.id, text: t('n_asked', refOf(c)), sub: '' })), ready ? { id: null, text: t('n_ready', ready), sub: '', go: 'ready_to_test' } : null, mineLate ? { id: null, text: t('n_overdue', mineLate), sub: '' } : null].filter(Boolean);
  const total = unread + extra.length;
  const badge = $('#bellBadge'); badge.hidden = !total; badge.textContent = total;
  $('#bellMenu').innerHTML = [...extra, ...list].map((n) => `<div class="nitem" ${n.id ? `data-open="${n.id}"` : n.go ? `data-go="${n.go}"` : ''}>${esc(n.text)}${n.sub ? `<small>${esc(n.sub)}</small>` : ''}</div>`).join('') || `<div class="nitem" style="cursor:default">${t('no_notif')}</div>`;
  $$('#bellMenu [data-open]').forEach((d) => (d.onclick = () => { $('#bellMenu').classList.remove('show'); showCard(+d.dataset.open); }));
  $$('#bellMenu [data-go]').forEach((d) => (d.onclick = () => { $('#bellMenu').classList.remove('show'); mcol = d.dataset.go; renderBoard(); }));
}
$('#bellBtn').onclick = (e) => {
  e.stopPropagation(); const m = $('#bellMenu'); m.classList.toggle('show');
  if (m.classList.contains('show')) { try { localStorage.setItem(seenKey(), new Date().toISOString()); } catch { /* ignore */ } setTimeout(() => { $('#bellBadge').hidden = true; }, 50); }
};

// ---------- misc ----------
$('#helpBtn').onclick = () => {
  $$('#helpDlg details[data-h]').forEach((d) => (d.open = d.dataset.h === 'all' || d.dataset.h === user?.role));
  $('#helpDlg').showModal();
};
try { if (!localStorage.getItem('devboard.helpSeen')) { localStorage.setItem('devboard.helpSeen', '1'); window.__showHelp = true; } } catch { /* ignore */ }
function openFromHash() {
  const m = /^#card-(\d+)$/.exec(location.hash), c = m && cards.find((x) => x.id === +m[1]);
  if (!c) return;
  if (viewProject && c.project !== viewProject) { viewProject = c.project; renderProjectSwitch(); renderUserBox(); renderAll(); } // the link is for another project
  showCard(c.id);
}
window.addEventListener('hashchange', openFromHash);

// keyboard shortcuts (ignored while typing or when a window is open)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.closest?.('dialog form')) { // Ctrl+Enter submits the form you're typing in
    const form = e.target.closest('form'); const btn = form.querySelector('button.primary,button.bad'); if (btn) { e.preventDefault(); form.requestSubmit(btn); } return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey || !user) return;
  if (e.key === 'Escape' && document.activeElement === $('#fq')) { $('#fq').blur(); return; }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  if (typing || $$('dialog[open]').length) return;
  const k = e.key.toLowerCase();
  if (k === 'n') { e.preventDefault(); openCardDlg(null); }
  else if (e.key === '/') { e.preventDefault(); $('#fq').focus(); }
  else if (e.key === '?') { e.preventDefault(); $('#helpBtn').click(); }
  else if (k === 'm') $('#needBtn').click();
});
// every dialog gets a close (X) button; it behaves exactly like Esc (so unsaved-changes guards still run)
for (const d of $$('dialog')) {
  if (d.id === 'loginDlg' || d.id === 'lbDlg' || d.id === 'viewDlg') continue; // (viewDlg re-renders; its X is part of the template)
  const x = document.createElement('button'); x.type = 'button'; x.className = 'dx'; x.setAttribute('aria-label', 'Close'); x.textContent = '✕';
  x.onclick = () => { const ev = new Event('cancel', { cancelable: true }); d.dispatchEvent(ev); if (!ev.defaultPrevented) d.close(); };
  (d.querySelector('.dlg') || d).prepend(x);
}
// phones: the secondary header controls and the filter selects fold away
$('#hamb').onclick = () => { const o = $('#hx').classList.toggle('open'); $('#hamb').setAttribute('aria-expanded', o); };
$('#fToggle').onclick = () => { const o = $('#fsel').classList.toggle('open'); $('#fToggle').setAttribute('aria-expanded', o); };

$('#bootMsg').textContent = t('boot_msg');
const bootT = setTimeout(() => { const el = $('#bootSlow'); if (el) { el.textContent = t('boot_slow'); el.hidden = false; } }, 4000);
function bootHide() { clearTimeout(bootT); $('#boot')?.remove(); }
syncControls();
applyLang();
api('GET', '/me').then(setUser).catch(showLogin);
setInterval(() => { if (!document.hidden && user) load(); }, 20000); // safety net; the SSE stream does the real work
