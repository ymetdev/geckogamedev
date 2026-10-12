// GeckoBoard front-end. Depends on /i18n.js (I18N).
const COLS = [['open', '--open'], ['in_progress', '--prog'], ['ready_to_test', '--test'], ['complete', '--done']];
const COLOR = Object.fromEntries(COLS);
const PRI_W = { critical: 0, high: 1, medium: 2, low: 3 };
const OLD_DONE_MS = 7 * 864e5, STALE_MS = 3 * 864e5;

let cards = [], users = [], user = null, openId = null, lang = 'en';
const F = { type: '', who: '', q: '', pri: '', tag: '', own: '', ms: '' };
let showOld = false, mcol = 'open', dragId = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
try { lang = localStorage.getItem('geckoboard.lang') || (/^th/i.test(navigator.language) ? 'th' : 'en'); } catch { /* storage blocked */ }
const t = (k, ...a) => String(I18N[lang][k] ?? I18N.en[k] ?? k).replace(/\{(\d)\}/g, (_, i) => a[i]);
const locale = () => (lang === 'th' ? 'th-TH' : 'en-GB');
const nameOf = (e) => users.find((u) => u.email === e)?.name || e;
const role = (...r) => !!user && r.includes(user.role);
const hue = (e) => { let h = 0; for (const ch of String(e)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
const avatar = (e, cls = '') => `<span class="av ${cls}" style="background:hsl(${hue(e)} 45% 40%)">${esc([...nameOf(e)][0]?.toUpperCase() || '?')}</span>`;
const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
let toastT; const toast = (m) => { const el = $('#toast'); el.textContent = m; el.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => (el.style.display = 'none'), 3800); };
const today = () => new Date().toISOString().slice(0, 10);
const daysFrom = (iso) => Math.round((Date.parse(iso) - Date.parse(today())) / 864e5);
const fmtDur = (ms) => { if (!isFinite(ms)) return '—'; const h = ms / 36e5; return h < 24 ? `${h.toFixed(1)} ${t('h')}` : `${(h / 24).toFixed(1)} ${t('d')}`; };

// ---------- api ----------
async function api(method, path, body) {
  const r = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json();
  if (r.status === 401 && path !== '/login') showLogin();
  if (!r.ok) { const er = new Error(d.error || r.status); er.data = d; throw er; }
  return d;
}
async function uploadFile(cardId, file) {
  const r = await fetch(`/api/cards/${cardId}/files`, { method: 'POST', headers: { 'Content-Type': file.type, 'X-Filename': encodeURIComponent(file.name) }, body: file });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || r.status);
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
async function attach(cardId, files) {
  let ok = 0;
  for (const f0 of files) {
    const f = await shrinkImage(f0);
    if (!LIMITS[f.type]) { toast(t('file_type', f0.name)); continue; }
    if (f.size > LIMITS[f.type]) { toast(t('file_too_big', f0.name)); continue; }
    try { await uploadFile(cardId, f); ok++; } catch (e) { toast(e.message); }
  }
  return ok;
}

async function load() {
  if (!user) return;
  try {
    const sig = () => (openId ? JSON.stringify(cards.find((c) => c.id === openId)) : '');
    const before = sig();
    [cards, users] = await Promise.all([api('GET', '/cards'), api('GET', '/users')]);
    renderAll();
    // re-render the open card only if it changed (keeps videos playing and inputs focused)
    if (openId && $('#viewDlg').open && sig() !== before && !document.activeElement?.matches('#viewBody textarea,#viewBody input:not([type=checkbox]):not([type=file])')) showCard(openId, true);
  } catch (e) { console.error(e); }
}

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
function showLogin() { user = null; $('#userBox').innerHTML = ''; if (!$('#loginDlg').open) $('#loginDlg').showModal(); initLogin(); }
function renderUserBox() {
  const u = user;
  $('#userBox').innerHTML = `<div class="chip" id="chip"><span>${esc(u.name)}</span><span class="role ${u.role}">${u.role}</span></div>
   <div class="menu" id="menu">
     <button data-m="token">${t('menu_token')}</button>
     ${u.role === 'admin' ? `<button data-m="team">${t('menu_team')}</button>` : ''}
     <button data-m="out">${t('menu_out')}</button></div>`;
  $('#chip').onclick = (e) => { e.stopPropagation(); $('#menu').classList.toggle('show'); };
  $$('#menu button').forEach((b) => (b.onclick = () => menuAct(b.dataset.m)));
}
function setUser(u) {
  user = u; $('#loginDlg').close();
  if (window.__showHelp) { window.__showHelp = false; $('#helpBtn').click(); }
  renderUserBox();
  load().then(openFromHash);
}
document.addEventListener('click', (e) => { $('#menu')?.classList.remove('show'); if (!e.target.closest('.bellbox')) $('#bellMenu').classList.remove('show'); });
const mcpCmd = (tok) => `claude mcp add --scope user --transport http geckoboard ${location.origin}/mcp --header "Authorization: Bearer ${tok}"`;
function showToken(tok) {
  $('#tokenCmd').textContent = mcpCmd(tok);
  $('#tokenJson').textContent = JSON.stringify({ mcpServers: { geckoboard: { type: 'http', url: location.origin + '/mcp', headers: { Authorization: 'Bearer ' + tok } } } }, null, 2);
}
async function copyText(text, btn, key = 'copy') {
  try { await navigator.clipboard.writeText(text); btn.textContent = t('copied'); } catch { toast('Copy failed'); }
  setTimeout(() => (btn.textContent = t(key)), 1500);
}
$('#copyBtn').onclick = () => copyText($('#tokenCmd').textContent, $('#copyBtn'));
$('#copyJsonBtn').onclick = () => copyText($('#tokenJson').textContent, $('#copyJsonBtn'));
$('#rotateBtn').onclick = async () => { if (!confirm(t('confirm_rotate'))) return; try { showToken((await api('POST', '/me/rotate-token', {})).token); } catch (e) { alert(e.message); } };
async function menuAct(m) {
  if (m === 'out') { await api('POST', '/logout', {}); showLogin(); }
  if (m === 'token') { const me = await api('GET', '/me'); showToken(me.token); $('#tokenDlg').showModal(); }
  if (m === 'team') { renderTeam(); $('#teamDlg').showModal(); }
}
function renderTeam() {
  $('#teamList').innerHTML = users.map((u) => `<div class="trow"><span class="e">${esc(u.name)} <span class="meta">${esc(u.email)}</span></span>
    <select data-e="${esc(u.email)}">${['admin', 'dev', 'tester'].map((r) => `<option ${r === u.role ? 'selected' : ''}>${r}</option>`).join('')}</select>
    <button class="btn bad" data-del="${esc(u.email)}">${t('remove')}</button></div>`).join('');
  $$('#teamList select').forEach((sel) => (sel.onchange = async () => {
    try { await api('PATCH', '/users/' + encodeURIComponent(sel.dataset.e), { role: sel.value }); $('#teamErr').textContent = ''; await load(); if (sel.dataset.e === user.email) user.role = sel.value; }
    catch (e) { $('#teamErr').textContent = e.message; await load(); renderTeam(); }
  }));
  $$('#teamList [data-del]').forEach((b) => (b.onclick = async () => {
    if (!confirm(t('confirm_remove', b.dataset.del))) return;
    try { await api('DELETE', '/users/' + encodeURIComponent(b.dataset.del)); $('#teamErr').textContent = ''; await load(); renderTeam(); } catch (e) { $('#teamErr').textContent = e.message; }
  }));
}
$('#addUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try { await api('POST', '/users', Object.fromEntries(new FormData(e.target))); e.target.reset(); $('#teamErr').textContent = ''; await load(); renderTeam(); } catch (err) { $('#teamErr').textContent = err.message; }
});
let cfg = null;
async function initLogin() {
  cfg = cfg || await api('GET', '/config');
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
  try { setUser(await api('POST', '/login', Object.fromEntries(new FormData(e.target)))); } catch (err) { $('#loginErr').textContent = err.message; }
});
$('#loginDlg').addEventListener('cancel', (e) => e.preventDefault());

// ---------- filters / sorting ----------
function matches(c) {
  if (F.type && c.type !== F.type) return false;
  if (F.who === 'mine' && !(user && c.assignees.includes(user.email))) return false;
  if (F.who === 'unassigned' && c.assignees.length) return false;
  if (F.pri && c.priority !== F.pri) return false;
  if (F.tag && !c.tags.includes(F.tag)) return false;
  if (F.ms && c.milestone !== F.ms) return false;
  if (F.own === '__none' ? c.assignees.length : F.own && !c.assignees.includes(F.own)) return false;
  if (F.q) {
    const q = F.q.toLowerCase().trim();
    const hit = q.startsWith('#') ? String(c.id) === q.slice(1) : `${c.title} ${c.description} ${c.tags.join(' ')} ${c.milestone}`.toLowerCase().includes(q) || String(c.id) === q;
    if (!hit) return false;
  }
  return true;
}
const anyFilter = () => Object.values(F).some(Boolean);
function sortCards(a, b) {
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
}
['#fpri', '#ftag', '#fown', '#fms'].forEach((id) => ($(id).onchange = () => { F.pri = $('#fpri').value; F.tag = $('#ftag').value; F.own = $('#fown').value; F.ms = $('#fms').value; renderBoard(); $('#fclear').hidden = !anyFilter(); }));
$('#fq').oninput = () => { F.q = $('#fq').value; renderBoard(); $('#fclear').hidden = !anyFilter(); };
$('#fclear').onclick = () => {
  Object.assign(F, { type: '', who: '', q: '', pri: '', tag: '', own: '', ms: '' }); $('#fq').value = '';
  $$('#typeSeg button,#whoSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === ''));
  renderFilters(); renderBoard();
};
for (const [id, key] of [['#typeSeg', 'type'], ['#whoSeg', 'who']]) {
  $$(id + ' button').forEach((b) => (b.onclick = () => {
    $$(id + ' button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); F[key] = b.dataset.v; renderBoard(); $('#fclear').hidden = !anyFilter();
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
  const canTick = role('dev', 'admin') && c.status !== 'complete' && c.status !== 'ready_to_test';
  let ctl = '';
  if (canTick && !lockedByOther) ctl = `<label class="chk" title="${t('tick_tip')}"><input type="checkbox" data-claim="${c.id}" ${mine ? 'checked' : ''}></label>`;
  else if (lockedByOther && canTick) ctl = `<span class="lock" title="${esc(t('claimed_by', nameOf(owner)))}">${LOCK}</span>`;
  const claim = owner ? `<div class="claim${mine ? ' me' : ''}">${avatar(owner)}<span>${mine ? `<b>${t('you')}</b>` : `<b>${esc(nameOf(owner))}</b>`} · ${t(c.status === 'complete' ? 'did_it' : 'working')}</span></div>` : '';
  const chips = [dueChip(c), c.milestone ? `<span class="pill ms">${esc(t('ms_chip', c.milestone))}</span>` : '',
    c.parent ? `<span class="pill">↳ #${c.parent}</span>` : '', cards.some((x) => x.parent === c.id) ? `<span class="pill">⑂ ${cards.filter((x) => x.parent === c.id).length}</span>` : '',
    c.files.length ? `<span class="pill">📎 ${c.files.length}</span>` : '',
    c.status === 'ready_to_test' && c.test_steps.length ? `<span class="pill prog">✔ ${c.test_checks.filter(Boolean).length}/${c.test_steps.length}</span>` : ''].filter(Boolean).join('');
  return `<div class="card${mine ? ' mine' : ''}${lockedByOther ? ' locked' : ''}" data-id="${c.id}" draggable="true">
    <div class="row">${ctl}<span class="tag ${c.type}">${c.type}</span><span class="meta">#${c.id}</span>
    <span class="meta pri-${c.priority}" style="margin-left:auto">${t('pri_' + c.priority)}</span></div>
    <div class="title">${esc(c.title)}</div>
    ${c.tags.length ? `<div class="row">${c.tags.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</div>` : ''}
    ${chips ? `<div class="chiprow">${chips}</div>` : ''}${claim}</div>`;
}
function renderBoard() {
  const vis = cards.filter(matches);
  $('#board').innerHTML = COLS.map(([k, col]) => {
    let list = vis.filter((c) => c.status === k).sort(sortCards);
    let oldBtn = '';
    if (k === 'complete') {
      const old = list.filter((c) => Date.now() - Date.parse(c.updated_at) > OLD_DONE_MS);
      if (old.length && !showOld) { list = list.filter((c) => !old.includes(c)); oldBtn = `<button class="oldbtn" data-old="1">${t('show_old', old.length)}</button>`; }
      else if (old.length) oldBtn = `<button class="oldbtn" data-old="0">${t('hide_old')}</button>`;
    }
    return `<section class="col${mcol === k ? ' active' : ''}" data-status="${k}"><h2><span class="dot" style="background:var(${col})"></span>${t('s_' + k)}<span class="count">${list.length}</span></h2>`
      + (list.map(cardHtml).join('') || `<div class="empty">${anyFilter() ? t('no_match') : '—'}</div>`) + oldBtn + '</section>';
  }).join('');
  $('#tabs').innerHTML = COLS.map(([k]) => `<button data-s="${k}" class="${mcol === k ? 'on' : ''}">${t('s_' + k)} · ${vis.filter((c) => c.status === k).length}</button>`).join('');
  $$('#tabs button').forEach((b) => (b.onclick = () => { mcol = b.dataset.s; renderBoard(); }));
}
function renderAll() { renderFilters(); renderBoard(); renderBell(); }

// board interactions: tick-to-claim, open card, "show older"
$('#board').addEventListener('click', async (e) => {
  const old = e.target.closest('[data-old]');
  if (old) { showOld = old.dataset.old === '1'; return renderBoard(); }
  const box = e.target.closest('input[data-claim]');
  if (box) {
    e.stopPropagation(); box.disabled = true;
    try { await api('POST', `/cards/${box.dataset.claim}/${box.checked ? 'claim' : 'unclaim'}`, {}); }
    catch (err) { await load(); toast(err.data?.claimed_by ? t('already', nameOf(err.data.claimed_by)) : err.message); }
    await load(); return;
  }
  if (e.target.closest('.chk')) return;
  const el = e.target.closest('.card'); if (el) showCard(+el.dataset.id);
});
// drag & drop between columns
$('#board').addEventListener('dragstart', (e) => { const el = e.target.closest('.card'); if (!el) return; dragId = +el.dataset.id; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(dragId)); });
$('#board').addEventListener('dragend', () => { dragId = null; $$('.dragging,.over').forEach((x) => x.classList.remove('dragging', 'over')); });
$('#board').addEventListener('dragover', (e) => { const col = e.target.closest('.col'); if (col && dragId) { e.preventDefault(); $$('.col.over').forEach((x) => x !== col && x.classList.remove('over')); col.classList.add('over'); } });
$('#board').addEventListener('drop', async (e) => {
  const col = e.target.closest('.col'); if (!col || !dragId) return; e.preventDefault();
  const c = cards.find((x) => x.id === dragId); const to = col.dataset.status; dragId = null; $$('.over').forEach((x) => x.classList.remove('over'));
  if (c) await moveCard(c, to);
});
async function moveCard(c, to) {
  const from = c.status; if (from === to) return;
  const mine = c.assignees.includes(user.email);
  try {
    if (from === 'open' && to === 'in_progress' && role('dev', 'admin')) await api('POST', `/cards/${c.id}/claim`, {});
    else if (from === 'in_progress' && to === 'open' && (mine || role('admin'))) await api('POST', `/cards/${c.id}/unclaim`, mine ? {} : { email: c.assignees[0] });
    else if (from === 'ready_to_test' && to === 'complete' && role('tester', 'admin')) {
      if (!(c.test_checks.length === c.test_steps.length && c.test_checks.every(Boolean))) { toast(t('must_tick')); return showCard(c.id); }
      await api('POST', `/cards/${c.id}/pass`, {});
    } else if (from === 'ready_to_test' && to === 'in_progress' && role('tester', 'admin')) {
      const text = prompt(t('failprompt')); if (!text) return; await api('POST', `/cards/${c.id}/fail`, { text });
    } else if (from === 'complete' && (to === 'open' || to === 'in_progress') && role('tester', 'admin')) await api('POST', `/cards/${c.id}/reopen`, {});
    else if (from === 'in_progress' && to === 'ready_to_test' && role('dev', 'admin')) { if (mine || role('admin')) return openReadyDlg(c); return toast(t('move_not_yours')); }
    else if (to === 'ready_to_test') return toast(t('move_no'));
    else return toast(t('move_no'));
  } catch (err) { toast(err.data?.claimed_by ? t('already', nameOf(err.data.claimed_by)) : err.message); }
  await load();
}

// ---------- card detail ----------
function linkRow(id, removable, kind) {
  const c = cards.find((x) => x.id === id);
  return `<div class="lnk"><a data-open="${id}">#${id} ${esc(c?.title || '?')}</a><span class="pill">${c ? t('s_' + c.status) : ''}</span>${removable ? `<button class="x" data-unlink="${id}" data-kind="${kind}" title="${t('unlink')}">✕</button>` : ''}</div>`;
}
function mdText(c) {
  const L = [`#${c.id} ${c.title}`, `${c.type} · ${t('s_' + c.status)} · ${t('pri_' + c.priority)}`];
  if (c.assignees.length) L.push(`${t('working')}: ${c.assignees.map(nameOf).join(', ')}`);
  if (c.due) L.push(t('due_on', c.due)); if (c.milestone) L.push(t('ms_chip', c.milestone));
  if (c.description) L.push('', c.description);
  if (c.test_steps.length) L.push('', t('howtest'), ...c.test_steps.map((s, i) => `${c.test_checks[i] ? '[x]' : '[ ]'} ${i + 1}. ${s}`));
  if (location.origin) L.push('', `${location.origin}/#card-${c.id}`);
  return L.join('\n');
}
function showCard(id, keep) {
  const c = cards.find((x) => x.id === id); if (!c) return;
  openId = id;
  const scroll = $('#viewDlg').scrollTop; const draft = $('#cmt')?.value;
  const mine = c.assignees.includes(user.email), owner = c.assignees[0];
  const canEdit = role('admin') || c.reporter === user.email || mine;
  const kids = cards.filter((x) => x.parent === c.id);
  const acts = [];
  if (c.status !== 'complete' && role('dev', 'admin')) {
    if (mine) acts.push(`<button class="btn" data-a="unclaim">${t('release')}</button>`);
    else if (!owner) acts.push(`<button class="btn primary" data-a="claim">${t('claim')}</button>`);
    else if (role('admin')) acts.push(`<button class="btn" data-a="unclaim_other" data-email="${esc(owner)}">${t('release_other', nameOf(owner))}</button>`);
  }
  const allTicked = c.test_steps.length && c.test_checks.length === c.test_steps.length && c.test_checks.every(Boolean);
  if (c.status === 'ready_to_test' && role('tester', 'admin')) acts.push(`<button class="btn ok" data-a="pass" ${allTicked ? '' : 'disabled style="opacity:.5" title="' + esc(t('must_tick')) + '"'}>${t('pass')}</button><button class="btn bad" data-a="fail">${t('fail')}</button>`);
  if (c.status === 'complete' && role('tester', 'admin')) acts.push(`<button class="btn" data-a="reopen">${t('reopen')}</button>`);
  if (role('dev', 'admin') && (mine || role('admin')) && (c.status === 'in_progress' || c.status === 'ready_to_test')) {
    acts.unshift(`<button class="btn ${c.status === 'in_progress' ? 'primary' : ''}" data-a="ready">${t(c.status === 'in_progress' ? 'send_test' : 'edit_steps')}</button>`);
  }
  if (role('dev', 'admin')) acts.push(`<button class="btn danger" data-a="delete" style="margin-left:auto">🗑 ${t('delete')}</button>`);
  const canTick = c.status === 'ready_to_test' && role('tester', 'admin');
  const files = c.files.map((f) => `<div class="thumb">${f.mime.startsWith('video/') ? `<video src="/api/files/${f.id}" controls preload="metadata"></video>` : `<img src="/api/files/${f.id}" alt="${esc(f.name)}" data-lb="${f.id}" loading="lazy">`}${(role('admin') || f.by === user.email) ? `<button class="x" data-rmfile="${f.id}" data-name="${esc(f.name)}" title="${t('remove_file')}">✕</button>` : ''}</div>`).join('');
  $('#viewBody').innerHTML = `
    <div class="row"><span class="tag ${c.type}">${c.type}</span><span class="meta">#${c.id} · ${t('by')} ${esc(nameOf(c.reporter))} · <span class="pri-${c.priority}">${t('pri_' + c.priority)}</span></span>
      <span class="status" style="margin-left:auto;color:var(${COLOR[c.status]});border:1px solid var(${COLOR[c.status]})">${t('s_' + c.status)}</span></div>
    <div class="row" style="justify-content:space-between;flex-wrap:nowrap"><h3 style="word-break:break-word">${esc(c.title)}</h3>
      <div class="row" style="flex:none">${canEdit ? `<button class="btn" data-a="edit">✎ ${t('edit')}</button>` : ''}<button class="btn" data-a="copytext">${t('copy_text')}</button></div></div>
    ${c.tags.length || c.due || c.milestone ? `<div class="chiprow" style="margin:0">${c.tags.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}${dueChip(c)}${c.milestone ? `<span class="pill ms">${esc(t('ms_chip', c.milestone))}</span>` : ''}</div>` : ''}
    <div class="banner${mine ? ' me' : ''}">${owner ? avatar(owner, 'lg') : '<span class="av lg" style="background:var(--line);color:var(--mute)">?</span>'}
      <div class="who">${owner ? `<b>${mine ? t('you') : esc(nameOf(owner))}</b><small>${t(c.status === 'complete' ? 'did_it' : 'working')}</small>` : `<span class="meta">${t('noassignee')}</span>`}</div></div>
    ${c.description ? `<div class="box">${esc(c.description)}</div>` : ''}
    <div class="sec"><h4>${t('attachments')} ${c.files.length ? `(${c.files.length})` : ''}</h4>
      ${files ? `<div class="gal">${files}</div>` : ''}
      <div class="drop" id="drop">${t('drop_hint')} · <a href="#" id="pickFile" style="color:var(--accent)">${t('add_file')}</a>
        <input type="file" id="fileIn" multiple hidden accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm"></div></div>
    ${c.test_steps.length ? `<div class="sec"><h4>${t('howtest')} · <span class="pill prog">${t('steps_done', c.test_checks.filter(Boolean).length, c.test_steps.length)}</span></h4>
      ${c.dev_summary ? `<div class="box testbox" style="margin-bottom:8px">${esc(c.dev_summary)}</div>` : ''}
      ${c.test_steps.map((s, i) => `<label class="ck${c.test_checks[i] ? ' done' : ''}" style="color:var(--text);font-size:14px"><input type="checkbox" data-step="${i}" ${c.test_checks[i] ? 'checked' : ''} ${canTick ? '' : 'disabled'}><span>${esc(s)}</span></label>`).join('')}
      ${canTick ? `<div class="meta">${t('tester_ticks')}</div>` : ''}</div>` : ''}
    <div class="actions">${acts.join('')}</div>
    <div class="sec"><h4>${t('links')}</h4>
      ${c.parent ? `<div class="meta">${t('parent_of')}</div>${linkRow(c.parent, canEdit, 'parent')}` : ''}
      ${kids.length ? `<div class="meta">${t('subcards')}</div>${kids.map((k) => linkRow(k.id, false)).join('')}` : ''}
      ${c.related.length ? `<div class="meta">${t('related')}</div>${c.related.map((r) => linkRow(r, true, 'related')).join('')}` : ''}
      <div class="row" style="margin-top:6px"><input id="linkId" type="number" min="1" placeholder="${t('add_related')}" style="width:120px"><button class="btn" data-a="link">${t('link')}</button>
        ${canEdit ? `<input id="parentId" type="number" min="1" placeholder="${t('set_parent')}" style="width:120px;margin-left:8px"><button class="btn" data-a="setparent">${t('save')}</button>` : ''}</div></div>
    <div class="sec"><h4>${t('comments')}</h4>
      ${c.comments.map((m) => `<div class="cm"><b>${esc(nameOf(m.user))}</b> ${esc(m.text).replace(/@([\p{L}\p{N}_.\-@]+)/gu, '<span style="color:var(--accent)">@$1</span>')}</div>`).join('') || `<div class="meta">${t('nocomments')}</div>`}
      <div class="row" style="margin-top:8px;position:relative;flex-wrap:nowrap"><div class="sugg" id="sugg" hidden></div><input id="cmt" placeholder="${esc(t('writecomment'))}" style="flex:1" autocomplete="off"><button class="btn" data-a="comment">${t('send')}</button></div></div>
    <details class="sec hist"><summary>${t('history')}</summary>${c.history.map((h) => `<div>${new Date(h.at).toLocaleString(locale())} · ${esc(nameOf(h.user))} · ${esc(t('a_' + h.action))} ${esc(h.text)}</div>`).join('')}</details>
    <div class="actions"><span class="sp"></span><button class="btn" data-a="close">${t('close')}</button></div>`;
  if (draft) $('#cmt').value = draft;
  wireDetail(c);
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
  $$('#viewBody [data-step]').forEach((i) => (i.onchange = async () => { try { await api('POST', `/cards/${c.id}/check`, { index: +i.dataset.step, checked: i.checked }); await load(); } catch (e) { toast(e.message); await load(); } }));
  $$('#viewBody [data-lb]').forEach((img) => (img.onclick = () => { $('#lbImg').src = img.src; $('#lbDlg').showModal(); }));
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
  cmt.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); act(c, 'comment'); } };
}
document.addEventListener('paste', (e) => { // Ctrl+V a screenshot while a card is open
  if (!$('#viewDlg').open || !openId) return;
  const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
  if (!files.length) return;
  e.preventDefault();
  toast(t('uploading')); attach(openId, files.map((f, i) => (f.name && f.name !== 'image.png' ? f : new File([f], `screenshot-${Date.now()}-${i}.png`, { type: f.type })))).then(load);
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
  try { await api('POST', `/cards/${readyFor.id}/ready`, { summary: e.target.summary.value, test_steps: steps }); $('#readyDlg').close(); await load(); }
  catch (err) { $('#readyErr').textContent = err.message; }
});
async function act(c, a, btn) {
  if (a === 'close') return $('#viewDlg').close();
  if (a === 'ready') return openReadyDlg(c);
  if (a === 'edit') return openCardDlg(c);
  if (a === 'copytext') return copyText(mdText(c), btn, 'copy_text');
  try {
    if (a === 'link') { const id = +$('#linkId').value; if (!id) return; await api('POST', `/cards/${c.id}/link`, { id }); return await load(); }
    if (a === 'setparent') { const v = $('#parentId').value; if (!v) return; await api('PATCH', `/cards/${c.id}`, { parent: +v }); return await load(); }
    if (a === 'unclaim_other') {
      const em = btn.dataset.email; if (!confirm(t('confirm_release_other', nameOf(em)))) return;
      await api('POST', `/cards/${c.id}/unclaim`, { email: em }); return await load();
    }
    if (a === 'delete') {
      if (!confirm(t('confirm_delete', c.id, c.title))) return;
      await api('DELETE', '/cards/' + c.id); $('#viewDlg').close(); return await load();
    }
    const body = {};
    if (a === 'comment') { body.text = $('#cmt').value; if (!body.text.trim()) return; }
    if (a === 'fail') { body.text = prompt(t('failprompt')); if (!body.text) return; }
    try { await api('POST', `/cards/${c.id}/${a}`, body); }
    catch (er) { await load(); if (er.data?.claimed_by) { toast(t('already', nameOf(er.data.claimed_by))); return; } throw er; }
    await load();
    if (a === 'pass' || a === 'fail') $('#viewDlg').close();
  } catch (e) { toast(e.message); }
}
$('#viewDlg').addEventListener('close', () => { openId = null; if (location.hash.startsWith('#card-')) history.replaceState(null, '', location.pathname); });
$('#lbDlg').addEventListener('click', () => $('#lbDlg').close());

// ---------- create / edit dialog ----------
let editId = null;
function openCardDlg(c) {
  editId = c ? c.id : null;
  const f = $('#cardForm'); f.reset(); $('#cardErr').textContent = '';
  $('#cardDlgTitle').textContent = t(c ? 'edit_card' : 'newcard'); $('#cardSubmit').textContent = t(c ? 'save' : 'create');
  $('#newFilesRow').hidden = !!c;
  if (c) { f.type.value = c.type; f.priority.value = c.priority; f.title.value = c.title; f.description.value = c.description; f.tags.value = c.tags.join(', '); f.due.value = c.due; f.milestone.value = c.milestone; f.parent.value = c.parent || ''; }
  $('#cardDlg').showModal();
}
$('#newBtn').onclick = () => openCardDlg(null);
$('#cardForm').addEventListener('submit', async (e) => {
  if (e.submitter?.value !== 'ok') return;
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target)); f.parent = f.parent ? +f.parent : null;
  try {
    let card;
    if (editId) card = await api('PATCH', '/cards/' + editId, f);
    else { card = await api('POST', '/cards', f); const files = [...$('#newFiles').files]; if (files.length) { toast(t('uploading')); await attach(card.id, files); } }
    $('#cardDlg').close(); await load(); if (editId) showCard(editId, true);
  } catch (err) { $('#cardErr').textContent = err.message; }
});
$('#cardForm').addEventListener('click', (e) => { if (e.target.value === 'cancel') { e.preventDefault(); $('#cardDlg').close(); } });

// ---------- summary ----------
function stats() {
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
  const s = stats(), open = cards.filter((c) => c.status !== 'complete');
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
    for (const m of c.comments) if ((m.mentions || []).includes(user.email) && m.user !== user.email) out.push({ at: m.at, id: c.id, text: t('n_mention', nameOf(m.user), c.id), sub: m.text.slice(0, 80) });
    if (c.assignees.includes(user.email)) for (const h of c.history) if (h.action === 'test_failed') out.push({ at: h.at, id: c.id, text: t('n_failed', c.id), sub: h.text.slice(0, 80) });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 15);
}
function renderBell() {
  const list = notifs(); let seen = ''; try { seen = localStorage.getItem(seenKey()) || ''; } catch { /* ignore */ }
  const unread = list.filter((n) => n.at > seen).length;
  const mineLate = user ? cards.filter((c) => c.status !== 'complete' && c.assignees.includes(user.email) && c.due && c.due < today()).length : 0;
  const ready = role('tester', 'admin') ? cards.filter((c) => c.status === 'ready_to_test').length : 0;
  const extra = [ready ? { id: null, text: t('n_ready', ready), sub: '', go: 'ready_to_test' } : null, mineLate ? { id: null, text: t('n_overdue', mineLate), sub: '' } : null].filter(Boolean);
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
function openFromHash() { const m = /^#card-(\d+)$/.exec(location.hash); if (m && cards.some((c) => c.id === +m[1])) showCard(+m[1]); }
window.addEventListener('hashchange', openFromHash);

applyLang();
api('GET', '/me').then(setUser).catch(showLogin);
setInterval(() => { if (!document.hidden) load(); }, 5000);
