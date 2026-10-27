// GeckoBoard — Notes: Obsidian-style markdown notes with [[links]], backlinks, tags, import, and a graph view (graph.js). Loaded after app.js.
Object.assign(I18N.en, {
  notes_btn: 'Notes', notes_title: 'Notes', n_tab_notes: 'Notes', n_tab_graph: 'Graph', n_search: 'Search notes…', n_new: '+ Note', n_import: 'Import', n_close: 'Close',
  n_all: 'All', n_empty: 'No notes yet.', n_empty_hint: 'Write design notes with [[links]] between them (like Obsidian), or import your vault (.md files).', n_pick: 'Pick a note on the left, or press “+ Note”.',
  n_edit: 'Edit', n_view: 'View', n_save: 'Save', n_cancel: 'Cancel', n_delete: 'Delete', n_download: '.md', n_local: 'Local graph', n_title: 'Title', n_tags: 'Tags (comma separated)', n_body: 'Write in Markdown…  [[link to a note]] · [[MAIN-12]] links a card · #tag',
  n_backlinks: 'Linked mentions', n_nobacklinks: 'No other note links here yet.', n_history: 'History', n_restore: 'Restore this version', n_props: 'Properties', n_folder: 'Folder', n_updated: 'updated {0} by {1}',
  n_prompt_title: 'Name of the new note:', n_confirm_del: 'Delete note “{0}”? You can undo right after.', n_deleted: 'Note “{0}” deleted', n_undo: 'Undo', n_saved: 'Saved', n_unsaved: 'Discard your changes?', n_create_ghost: 'Create the note “{0}”?', n_ghost_tip: 'Not written yet — click to create',
  n_imp_title: 'Import notes', n_imp_hint: 'Choose .md files, or a whole Obsidian vault folder. Titles come from file names; [[links]], #tags and front matter are kept.', n_imp_files: 'Choose files', n_imp_folder: 'Choose a folder', n_imp_over: 'Overwrite notes that already exist (old version is kept in history)', n_imp_go: 'Import', n_imp_n: '{0} files selected', n_imp_done: 'Imported: {0} new, {1} updated, {2} skipped', n_imp_unres: 'Links to notes that do not exist yet ({0}): ', n_imp_busy: 'Importing…',
  n_g_cards: 'Cards', n_g_ghosts: 'Unwritten', n_g_tags: 'Tags', n_g_labels: 'Labels', n_g_repel: 'Repel', n_g_dist: 'Link distance', n_g_depth: 'Depth', n_g_filter: 'Filter…', n_g_fit: 'Fit', n_g_open: 'Open', n_g_links: '{0} links', n_g_empty: 'Nothing to draw yet — write a few notes with [[links]].', n_g_global: 'Whole graph', n_card_notes: 'Notes', n_ro: 'View only',
  e_ntitle: 'A note with this title already exists.', e_nproj: 'Please choose a project first.',
});
Object.assign(I18N.th, {
  notes_btn: 'โน้ต', notes_title: 'โน้ต', n_tab_notes: 'โน้ต', n_tab_graph: 'กราฟ', n_search: 'ค้นหาโน้ต…', n_new: '+ โน้ต', n_import: 'นำเข้า', n_close: 'ปิด',
  n_all: 'ทั้งหมด', n_empty: 'ยังไม่มีโน้ต', n_empty_hint: 'เขียนโน้ตดีไซน์พร้อมลิงก์ [[ชื่อโน้ต]] เชื่อมกันแบบ Obsidian หรือนำเข้า vault ของคุณ (ไฟล์ .md)', n_pick: 'เลือกโน้ตทางซ้าย หรือกด “+ โน้ต”',
  n_edit: 'แก้ไข', n_view: 'ดู', n_save: 'บันทึก', n_cancel: 'ยกเลิก', n_delete: 'ลบ', n_download: '.md', n_local: 'กราฟเฉพาะโน้ตนี้', n_title: 'ชื่อโน้ต', n_tags: 'แท็ก (คั่นด้วยจุลภาค)', n_body: 'เขียนด้วย Markdown…  [[ลิงก์ไปโน้ต]] · [[MAIN-12]] ลิงก์ไปการ์ด · #แท็ก',
  n_backlinks: 'โน้ตที่ลิงก์มาที่นี่', n_nobacklinks: 'ยังไม่มีโน้ตอื่นลิงก์มาที่นี่', n_history: 'ประวัติ', n_restore: 'กู้เวอร์ชันนี้', n_props: 'คุณสมบัติ', n_folder: 'โฟลเดอร์', n_updated: 'แก้ล่าสุด {0} โดย {1}',
  n_prompt_title: 'ชื่อโน้ตใหม่:', n_confirm_del: 'ลบโน้ต “{0}”? กด Undo ได้ทันทีหลังลบ', n_deleted: 'ลบโน้ต “{0}” แล้ว', n_undo: 'ย้อนกลับ', n_saved: 'บันทึกแล้ว', n_unsaved: 'ทิ้งสิ่งที่แก้ไว้?', n_create_ghost: 'สร้างโน้ต “{0}”?', n_ghost_tip: 'ยังไม่ได้เขียน — คลิกเพื่อสร้าง',
  n_imp_title: 'นำเข้าโน้ต', n_imp_hint: 'เลือกไฟล์ .md หรือทั้งโฟลเดอร์ vault ของ Obsidian ชื่อโน้ตมาจากชื่อไฟล์ ลิงก์ [[ ]] แท็ก # และ front matter จะถูกเก็บไว้', n_imp_files: 'เลือกไฟล์', n_imp_folder: 'เลือกโฟลเดอร์', n_imp_over: 'เขียนทับโน้ตที่มีอยู่แล้ว (เวอร์ชันเก่าเก็บในประวัติ)', n_imp_go: 'นำเข้า', n_imp_n: 'เลือกแล้ว {0} ไฟล์', n_imp_done: 'นำเข้าแล้ว: ใหม่ {0}, อัปเดต {1}, ข้าม {2}', n_imp_unres: 'ลิงก์ไปโน้ตที่ยังไม่มี ({0}): ', n_imp_busy: 'กำลังนำเข้า…',
  n_g_cards: 'การ์ด', n_g_ghosts: 'ที่ยังไม่เขียน', n_g_tags: 'แท็ก', n_g_labels: 'ชื่อ', n_g_repel: 'แรงผลัก', n_g_dist: 'ความยาวเส้น', n_g_depth: 'ระดับ', n_g_filter: 'กรอง…', n_g_fit: 'พอดีจอ', n_g_open: 'เปิด', n_g_links: '{0} ลิงก์', n_g_empty: 'ยังไม่มีอะไรให้วาด — เขียนโน้ตที่มีลิงก์ [[ ]] สักสองสามอัน', n_g_global: 'ทั้งกราฟ', n_card_notes: 'โน้ต', n_ro: 'ดูอย่างเดียว',
  e_ntitle: 'มีโน้ตชื่อนี้อยู่แล้ว', e_nproj: 'กรุณาเลือกโปรเจกต์ก่อน',
});
ERRS.push([/^A note with this title already exists/, 'e_ntitle'], [/^Project required/, 'e_nproj']);

const N = { pid: '', list: [], q: '', tag: '', cur: null, editing: false, tab: 'notes', built: false, dirty: false, tags: [] };
const nkey = (t) => String(t ?? '').toLowerCase().replace(/\.md$/i, '').replace(/\s+/g, ' ').trim();
const nCan = () => !!N.pid && rl(N.pid, 'dev', 'admin');
const nTitles = () => new Map(N.list.map((n) => [nkey(n.title), n]));
const nAgo = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 6e4); return m < 1 ? '·' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };

function nCtx() { // how [[links]] turn into HTML for the current project
  const titles = nTitles();
  return { wikilink(target, anchor, alias, embed) {
    const label = GBMD.esc(alias || target + (anchor ? ' › ' + anchor : '')), k = nkey(target), n = titles.get(k);
    if (n) return `<a class="wl" data-note="${n.id}">${embed ? '↪ ' : ''}${label}</a>`;
    const m = /^([A-Za-z0-9]{2,8})-(\d+)$/.exec(target), c = m && cards.find((x) => refOf(x).toUpperCase() === target.toUpperCase() && x.project === N.pid);
    if (c) return `<a class="wl wl-card" data-card="${c.id}" title="${GBMD.esc(c.title)}">🎴 ${GBMD.esc(refOf(c))}</a>`;
    return `<a class="wl ghost" data-ghost="${GBMD.esc(target)}" title="${GBMD.esc(t('n_ghost_tip'))}">${label}</a>`;
  } };
}

// ---------- open / load ----------
async function openNotes(noteId) {
  const act = activeProjects();
  N.pid = N.pid && act.some((p) => p.id === N.pid) ? N.pid : (viewProject || act[0]?.id || projects[0]?.id || '');
  if (!N.built) nBuild();
  N.q = ''; N.tag = ''; N.editing = false; N.cur = null; N.tab = 'notes';
  await nLoad();
  if (!$('#notesDlg').open) $('#notesDlg').showModal();
  if (noteId) await nOpen(noteId);
  nRender();
}
async function nLoad() {
  try { N.list = N.pid ? await api('GET', `/notes?project=${encodeURIComponent(N.pid)}`, undefined, true) : []; } catch (e) { N.list = []; toast(e.message); }
  const tc = new Map(); for (const n of N.list) for (const g of n.tags) tc.set(g, (tc.get(g) || 0) + 1);
  N.tags = [...tc].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
async function nOpen(id) {
  if (N.editing && N.dirty && !confirm(t('n_unsaved'))) return;
  try { N.cur = await api('GET', `/notes/${id}`); } catch (e) { toast(e.message); return; }
  N.editing = false; N.dirty = false; N.tab = 'notes'; nRender(); $('#nMain')?.scrollTo?.(0, 0);
}

// ---------- skeleton ----------
function nBuild() {
  N.built = true;
  const d = document.createElement('dialog'); d.id = 'notesDlg'; d.className = 'full';
  d.innerHTML = `<div class="nwrap"><div class="nbar"><h3 id="nTitle"></h3><select id="nProj"></select><div class="seg" id="nTabs"><button data-t="notes"></button><button data-t="graph"></button></div>
    <input id="nQ" type="search" autocomplete="off"><span class="sp"></span><button class="btn primary" id="nNew"></button><button class="btn" id="nImp"></button><button class="btn icon" id="nClose" aria-label="Close">✕</button></div>
    <div class="nbody"><aside id="nSide"></aside><section id="nMain"></section></div></div>`;
  document.body.appendChild(d);
  $('#nClose').onclick = () => { if (N.editing && N.dirty && !confirm(t('n_unsaved'))) return; d.close(); };
  d.addEventListener('cancel', (e) => { if (N.editing && N.dirty && !confirm(t('n_unsaved'))) e.preventDefault(); });
  d.addEventListener('close', () => { if (typeof nGraph !== 'undefined' && nGraph) nGraph.stop(); });
  $('#nProj').onchange = async (e) => { N.pid = e.target.value; N.cur = null; N.editing = false; N.tag = ''; await nLoad(); nRender(); };
  $('#nTabs').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; N.tab = b.dataset.t; if (N.tab === 'graph' && b.dataset.t !== 'local') N.localId = N.localId && N.cur ? N.localId : ''; nRender(); };
  $('#nQ').oninput = (e) => { N.q = e.target.value; nSearch(); };
  $('#nNew').onclick = nNewNote; $('#nImp').onclick = nImport;
  d.addEventListener('click', nClicks);
  setInterval(async () => { // pick up edits of teammates while the dialog is open
    if (!d.open || N.editing || document.hidden || !N.pid) return;
    try { const fresh = await api('GET', `/notes?project=${encodeURIComponent(N.pid)}`, undefined, true); if (JSON.stringify(fresh.map((n) => [n.id, n.updated_at])) !== JSON.stringify(N.list.map((n) => [n.id, n.updated_at]))) { await nLoad(); if (N.cur && N.list.some((n) => n.id === N.cur.id && n.updated_at !== N.cur.updated_at)) N.cur = await api('GET', `/notes/${N.cur.id}`, undefined, true); nRender(); } } catch { /* ignore */ }
  }, 7000);
}
let nSearchT;
function nSearch() {
  clearTimeout(nSearchT);
  nSearchT = setTimeout(async () => {
    try { N.list = await api('GET', `/notes?project=${encodeURIComponent(N.pid)}${N.q ? '&q=' + encodeURIComponent(N.q) : ''}`, undefined, true); } catch { /* keep */ }
    nSide();
  }, 180);
}

// ---------- render ----------
function nRender() {
  if (!N.built) return;
  const act = projects.filter((p) => !p.archived || isAdmin());
  $('#nTitle').textContent = '📓 ' + t('notes_title');
  $('#nProj').hidden = act.length <= 1; $('#nProj').innerHTML = act.map((p) => `<option value="${esc(p.id)}" ${p.id === N.pid ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  $$('#nTabs button').forEach((b) => { b.textContent = t('n_tab_' + b.dataset.t); b.classList.toggle('on', b.dataset.t === N.tab); });
  $('#nQ').placeholder = t('n_search'); $('#nNew').textContent = t('n_new'); $('#nImp').textContent = t('n_import');
  $('#nNew').hidden = $('#nImp').hidden = !nCan();
  $('.nwrap').classList.toggle('n-open', !!N.cur || N.editing || N.tab === 'graph');
  $('.nwrap').classList.toggle('n-graph', N.tab === 'graph');
  nSide();
  if (N.tab === 'graph') return nGraphTab();
  if (nGraph) nGraph.stop();
  if (N.editing) return nEditor();
  nView();
}
function nSide() {
  const q = N.q.trim().toLowerCase(), list = N.list.filter((n) => !N.tag || n.tags.includes(N.tag));
  const byFolder = new Map(); for (const n of list.slice().sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }))) { const f = n.folder || ''; (byFolder.get(f) || byFolder.set(f, []).get(f)).push(n); }
  const item = (n) => `<button class="ni${N.cur?.id === n.id ? ' on' : ''}" data-note="${n.id}"><span class="nt">${esc(n.title)}</span>${n.snippet ? `<small>${esc(n.snippet)}</small>` : ''}<span class="nu">${nAgo(n.updated_at)}</span></button>`;
  const folders = [...byFolder.keys()].sort();
  $('#nSide').innerHTML = `${N.tags.length ? `<div class="ntags"><button class="tagchip${!N.tag ? ' on' : ''}" data-tag="">${t('n_all')} ${N.list.length}</button>${N.tags.slice(0, 14).map(([g, c]) => `<button class="tagchip${N.tag === g ? ' on' : ''}" data-tag="${esc(g)}">#${esc(g)} <i>${c}</i></button>`).join('')}</div>` : ''}
    <div class="nlist">${list.length ? folders.map((f) => (f ? `<details open><summary>📁 ${esc(f)}</summary>${byFolder.get(f).map(item).join('')}</details>` : byFolder.get(f).map(item).join(''))).join('') : `<div class="meta" style="padding:12px">${t('n_empty')}</div>`}</div>`;
}
function nView() {
  const n = N.cur, M = $('#nMain');
  if (!n) { M.innerHTML = `<div class="nempty"><div class="big">📓</div><h3>${N.list.length ? t('n_pick') : t('n_empty')}</h3>${N.list.length ? '' : `<p>${t('n_empty_hint')}</p>`}${nCan() && !N.list.length ? `<div class="row" style="justify-content:center"><button class="btn primary" id="nEmptyImp">${t('n_import')}</button><button class="btn" id="nEmptyNew">${t('n_new')}</button></div>` : ''}${!nCan() ? `<div class="meta">${t('n_ro')}</div>` : ''}</div>`; $('#nEmptyImp')?.addEventListener('click', nImport); $('#nEmptyNew')?.addEventListener('click', nNewNote); return; }
  const props = Object.entries(n.props || {}).filter(([k]) => k !== 'tags');
  M.innerHTML = `<div class="nview"><button class="btn nback-btn" data-a="back">‹ ${t('notes_title')}</button>
    <div class="nhead"><h2>${esc(n.title)}</h2><div class="nact">${nCan() ? `<button class="btn" data-a="edit">✎ ${t('n_edit')}</button>` : ''}<button class="btn" data-a="local">🕸 ${t('n_local')}</button><button class="btn" data-a="dl">⬇ ${t('n_download')}</button>${nCan() ? `<button class="btn bad" data-a="del">🗑</button>` : ''}</div></div>
    <div class="nmeta">${n.folder ? `📁 ${esc(n.folder)} · ` : ''}${esc(t('n_updated', nAgo(n.updated_at), nameOf(n.updated_by)))}</div>
    ${n.tags.length ? `<div class="ntags inl">${n.tags.map((g) => `<a class="tagchip" data-tag="${esc(g)}">#${esc(g)}</a>`).join('')}</div>` : ''}
    ${props.length ? `<details class="nprops"><summary>${t('n_props')}</summary><table>${props.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(Array.isArray(v) ? v.join(', ') : v)}</td></tr>`).join('')}</table></details>` : ''}
    <article class="md">${GBMD.render(n.body, nCtx())}</article>
    <section class="nbl"><h4>🔗 ${t('n_backlinks')} (${n.backlinks.length})</h4>${n.backlinks.map((b) => `<a class="blk" data-note="${b.id}"><b>${esc(b.title)}</b><small>${esc(b.context)}</small></a>`).join('') || `<div class="meta">${t('n_nobacklinks')}</div>`}</section>
    ${n.history.length ? `<details class="nhist"><summary>🕘 ${t('n_history')} (${n.history.length})</summary>${n.history.map((h) => `<div class="hrow"><span>${new Date(h.at).toLocaleString(locale())} · ${esc(nameOf(h.user))} · ${(h.size / 1000).toFixed(1)}k</span>${nCan() ? `<button class="btn" data-a="revert" data-i="${h.i}">${t('n_restore')}</button>` : ''}</div>`).join('')}</details>` : ''}</div>`;
}

// ---------- editor ----------
function nEditor() {
  const n = N.cur; const M = $('#nMain');
  M.innerHTML = `<form class="nedit" id="nForm"><div class="row"><input name="title" id="nfTitle" required maxlength="120" placeholder="${esc(t('n_title'))}" value="${esc(n.title)}" style="flex:2;font-size:18px;font-weight:650"><input name="tags" placeholder="${esc(t('n_tags'))}" value="${esc((n.props?.tags && Array.isArray(n.props.tags) ? n.props.tags : n.tags).join(', '))}" style="flex:1"></div>
    <div class="nsplit"><div class="nsrc"><textarea name="body" id="nfBody" spellcheck="false" placeholder="${esc(t('n_body'))}">${esc(n.body)}</textarea><div id="nAuto" class="nauto" hidden></div></div><article class="md nprev" id="nPrev"></article></div>
    <div class="actions"><span class="meta" id="nSaveInfo"></span><span class="sp"></span><button type="button" class="btn" data-a="cancel">${t('n_cancel')}</button><button class="btn primary" data-a="save">${t('n_save')}</button></div></form>`;
  const ta = $('#nfBody'), prev = $('#nPrev'); let pt;
  const draw = () => { prev.innerHTML = GBMD.render(ta.value, nCtx()); };
  draw(); ta.focus();
  $('#nForm').addEventListener('input', () => { N.dirty = true; clearTimeout(pt); pt = setTimeout(draw, 160); nAutoComplete(ta); });
  ta.addEventListener('keydown', (e) => nAutoKey(e, ta));
  $('#nForm').addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); nSave(); } });
  $('#nForm').addEventListener('submit', (e) => { e.preventDefault(); nSave(); });
}
// [[ autocomplete
function nAutoComplete(ta) {
  const box = $('#nAuto'); const before = ta.value.slice(0, ta.selectionStart); const m = /\[\[([^\[\]\n|#]*)$/.exec(before);
  if (!m) { box.hidden = true; return; }
  const q = nkey(m[1]); const opts = N.list.filter((n) => n.id !== N.cur?.id && (!q || nkey(n.title).includes(q))).slice(0, 7);
  const cs = cards.filter((c) => c.project === N.pid && q && refOf(c).toLowerCase().startsWith(q)).slice(0, 3);
  const all = [...opts.map((n) => ({ v: n.title, l: n.title })), ...cs.map((c) => ({ v: refOf(c), l: `🎴 ${refOf(c)} ${c.title}` }))];
  if (!all.length) { box.hidden = true; return; }
  box.hidden = false; box.dataset.start = ta.selectionStart - m[1].length; box.dataset.sel = '0';
  box.innerHTML = all.map((o, i) => `<button type="button" class="${i ? '' : 'on'}" data-v="${esc(o.v)}">${esc(o.l)}</button>`).join('');
}
function nAutoPick(ta, v) {
  const box = $('#nAuto'), start = +box.dataset.start, end = ta.selectionStart; const after = ta.value.slice(end).replace(/^\]\]/, '');
  ta.value = ta.value.slice(0, start) + v + ']]' + after; ta.selectionStart = ta.selectionEnd = start + v.length + 2; box.hidden = true; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus();
}
function nAutoKey(e, ta) {
  const box = $('#nAuto'); if (box.hidden) return; const bs = [...box.querySelectorAll('button')]; let i = bs.findIndex((b) => b.classList.contains('on'));
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); bs[i]?.classList.remove('on'); i = (i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length; bs[i].classList.add('on'); }
  else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); nAutoPick(ta, bs[i].dataset.v); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); box.hidden = true; }
}
async function nSave() {
  const f = $('#nForm'); if (!f) return; const n = N.cur;
  const tags = f.tags.value.split(/[,\s]+/).map((x) => x.replace(/^#/, '').trim()).filter(Boolean);
  await withBusy(f, async () => {
    try {
      const patch = { title: f.title.value, body: f.body.value, tags };
      const saved = n.id ? await api('PATCH', `/notes/${n.id}`, patch) : await api('POST', '/notes', { ...patch, project: N.pid });
      N.cur = saved; N.editing = false; N.dirty = false; await nLoad(); nRender(); toast(t('n_saved'));
    } catch (e) { $('#nSaveInfo').textContent = e.message; }
  }, f.querySelector('button.primary'));
}
function nNewNote() {
  const title = prompt(t('n_prompt_title')); if (!title?.trim()) return;
  N.cur = { id: '', project: N.pid, title: title.trim(), body: '', props: {}, tags: [], backlinks: [], links: [], history: [] }; N.editing = true; N.dirty = true; N.tab = 'notes'; nRender();
}

// ---------- clicks ----------
async function nClicks(e) {
  const a = e.target.closest('[data-a]'), nn = e.target.closest('[data-note]'), tg = e.target.closest('[data-tag]'), gh = e.target.closest('[data-ghost]'), cd = e.target.closest('[data-card]'), au = e.target.closest('#nAuto button');
  if (au) { e.preventDefault(); return nAutoPick($('#nfBody'), au.dataset.v); }
  if (cd) { e.preventDefault(); $('#notesDlg').close(); return showCard(+cd.dataset.card); }
  if (gh) { e.preventDefault(); if (!nCan()) return toast(t('n_ghost_tip')); if (!confirm(t('n_create_ghost', gh.dataset.ghost))) return; N.cur = { id: '', project: N.pid, title: gh.dataset.ghost, body: '', props: {}, tags: [], backlinks: [], links: [], history: [] }; N.editing = true; N.dirty = true; N.tab = 'notes'; return nRender(); }
  if (nn && !a) { e.preventDefault(); return nOpen(nn.dataset.note); }
  if (tg && !a) { e.preventDefault(); N.tag = tg.dataset.tag; if (N.editing && N.dirty) return; N.q = ''; $('#nQ').value = ''; await nLoad(); return nRender(); }
  if (!a) return; const n = N.cur;
  if (a.dataset.a === 'back') { N.cur = null; N.editing = false; return nRender(); }
  if (a.dataset.a === 'edit') { N.editing = true; N.dirty = false; return nRender(); }
  if (a.dataset.a === 'cancel') { if (N.dirty && !confirm(t('n_unsaved'))) return; N.dirty = false; N.editing = false; if (!n.id) N.cur = null; return nRender(); }
  if (a.dataset.a === 'save') return;
  if (a.dataset.a === 'local') { N.tab = 'graph'; N.localId = n.id; return nRender(); }
  if (a.dataset.a === 'dl') { const fm = Object.keys(n.props || {}).length ? '---\n' + Object.entries(n.props).map(([k, v]) => `${k}: ${Array.isArray(v) ? '[' + v.join(', ') + ']' : v}`).join('\n') + '\n---\n\n' : ''; const url = URL.createObjectURL(new Blob([fm + n.body], { type: 'text/markdown' })); const l = Object.assign(document.createElement('a'), { href: url, download: n.title + '.md' }); l.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); return; }
  if (a.dataset.a === 'del') {
    if (!confirm(t('n_confirm_del', n.title))) return;
    try { await api('DELETE', `/notes/${n.id}`); const id = n.id, title = n.title; N.cur = null; await nLoad(); nRender(); toast(t('n_deleted', title), { label: t('n_undo'), fn: async () => { try { await api('POST', `/notes/${id}/restore`, {}); await nLoad(); await nOpen(id); } catch (er) { toast(er.message); } } }); } catch (er) { toast(er.message); }
    return;
  }
  if (a.dataset.a === 'revert') { try { N.cur = await api('POST', `/notes/${n.id}/revert`, { index: +a.dataset.i }); await nLoad(); nRender(); toast(t('n_saved')); } catch (er) { toast(er.message); } }
}

// ---------- import ----------
function nImport() {
  let dlg = $('#nImpDlg');
  if (!dlg) {
    dlg = document.createElement('dialog'); dlg.id = 'nImpDlg';
    dlg.innerHTML = `<div class="dlg"><h3 id="niT"></h3><div class="meta" id="niH"></div>
      <div class="row"><label class="btn" id="niF" style="cursor:pointer"><input type="file" id="niFiles" multiple accept=".md,.markdown,.txt,text/markdown,text/plain" hidden></label><label class="btn" id="niD" style="cursor:pointer"><input type="file" id="niDir" webkitdirectory multiple hidden></label><span class="meta" id="niN"></span></div>
      <label class="row" style="gap:8px"><input type="checkbox" id="niO" style="width:auto"><span id="niOT"></span></label><div class="err" id="niErr"></div><div id="niRes" class="meta"></div>
      <div class="actions"><span class="sp"></span><button class="btn" id="niX"></button><button class="btn primary" id="niGo"></button></div></div>`;
    document.body.appendChild(dlg); dlg._files = [];
    const pick = (list) => { dlg._files = [...list].filter((f) => /\.(md|markdown|txt)$/i.test(f.name)); $('#niN').textContent = t('n_imp_n', dlg._files.length); $('#niRes').textContent = ''; };
    $('#niFiles').onchange = (e) => pick(e.target.files); $('#niDir').onchange = (e) => pick(e.target.files); $('#niX').onclick = () => dlg.close();
    $('#niGo').onclick = async (e) => withBusy(e.target, async () => {
      const files = dlg._files; if (!files.length) return; $('#niErr').textContent = ''; $('#niRes').textContent = t('n_imp_busy');
      try {
        const tot = { created: 0, updated: 0, skipped: 0 }; let unres = new Set(); let batch = [], size = 0;
        const send = async () => { if (!batch.length) return; const r = await api('POST', '/notes/import', { project: N.pid, files: batch, overwrite: $('#niO').checked }); tot.created += r.created; tot.updated += r.updated; tot.skipped += r.skipped; r.unresolved.forEach((u) => unres.add(u)); batch = []; size = 0; };
        for (const f of files) {
          const content = await f.text(); const rel = (f.webkitRelativePath || '').split('/'); const folder = rel.length > 2 ? rel.slice(1, -1).join('/') : '';
          if (size + content.length > 600000) await send(); batch.push({ name: f.name, content, folder }); size += content.length;
        }
        await send();
        $('#niRes').innerHTML = `✅ ${esc(t('n_imp_done', tot.created, tot.updated, tot.skipped))}${unres.size ? `<br>${esc(t('n_imp_unres', unres.size))}${esc([...unres].slice(0, 12).join(' · '))}` : ''}`;
        await nLoad(); nRender();
      } catch (er) { $('#niErr').textContent = er.message; $('#niRes').textContent = ''; }
    }, e.target);
  }
  dlg._files = []; $('#niT').textContent = t('n_imp_title'); $('#niH').textContent = t('n_imp_hint'); $('#niF').firstChild?.nodeType === 3 && $('#niF').firstChild.remove();
  $('#niF').childNodes.forEach((x) => x.nodeType === 3 && x.remove()); $('#niD').childNodes.forEach((x) => x.nodeType === 3 && x.remove());
  $('#niF').prepend(document.createTextNode(t('n_imp_files'))); $('#niD').prepend(document.createTextNode(t('n_imp_folder')));
  $('#niOT').textContent = t('n_imp_over'); $('#niX').textContent = t('n_close'); $('#niGo').textContent = t('n_imp_go'); $('#niN').textContent = ''; $('#niRes').textContent = ''; $('#niErr').textContent = ''; $('#niO').checked = false;
  dlg.showModal();
}

// ---------- graph tab ----------
let nGraph = null;
const NG = { filter: '', cards: true, ghosts: true, tags: false, labels: true, repel: 1, dist: 1, size: 1, depth: 2 };
async function nGraphTab() {
  const M = $('#nMain'), focus = N.localId || '';
  M.innerHTML = `<div class="ngraph"><canvas id="ngc"></canvas>
    <div class="gctl"><input id="gF" type="search" placeholder="${esc(t('n_g_filter'))}" value="${esc(NG.filter)}">
      <label><input type="checkbox" data-g="cards" ${NG.cards ? 'checked' : ''}> ${t('n_g_cards')}</label><label><input type="checkbox" data-g="ghosts" ${NG.ghosts ? 'checked' : ''}> ${t('n_g_ghosts')}</label><label><input type="checkbox" data-g="tags" ${NG.tags ? 'checked' : ''}> ${t('n_g_tags')}</label><label><input type="checkbox" data-g="labels" ${NG.labels ? 'checked' : ''}> ${t('n_g_labels')}</label>
      <label>${t('n_g_repel')} <input type="range" data-g="repel" min="0.3" max="3" step="0.1" value="${NG.repel}"></label><label>${t('n_g_dist')} <input type="range" data-g="dist" min="0.5" max="2.5" step="0.1" value="${NG.dist}"></label>
      ${focus ? `<label>${t('n_g_depth')} <select data-g="depth">${[1, 2, 3, 4].map((d) => `<option ${d === NG.depth ? 'selected' : ''}>${d}</option>`).join('')}</select></label><button class="btn" id="gGlobal">${t('n_g_global')}</button>` : ''}</div>
    <div class="gleg" id="gLeg"></div><div class="ginfo" id="gInfo" hidden></div><div class="gtip" id="gTip" hidden></div>
    <div class="gzoom"><button data-z="1.35" aria-label="+">+</button><button data-z="0.74" aria-label="−">−</button><button id="gFit" aria-label="${esc(t('n_g_fit'))}" title="${esc(t('n_g_fit'))}">⤢</button></div><div class="gempty" id="gEmpty" hidden>${t('n_g_empty')}</div></div>`;
  let data; try { data = await api('GET', `/notes/graph?project=${encodeURIComponent(N.pid)}`, undefined, true); } catch (e) { toast(e.message); return; }
  if (N.tab !== 'graph' || !$('#ngc')) return; // the user moved on while we were loading
  if (nGraph) nGraph.destroy();
  const info = $('#gInfo'), tip = $('#gTip');
  const showInfo = (n) => {
    if (!n) { info.hidden = true; return; }
    const kind = { note: '📄', card: '🎴', ghost: '✏️', tag: '#️⃣' }[n.type];
    info.hidden = false; info.innerHTML = `<b>${kind} ${esc(n.title)}</b>${n.tags?.length ? `<div class="ntags inl">${n.tags.map((x) => `<span class="tagchip">#${esc(x)}</span>`).join('')}</div>` : ''}<small>${esc(t('n_g_links', n.deg))}</small><button class="btn primary" id="gOpen">${n.type === 'ghost' ? t('n_new').replace('+ ', '') : t('n_g_open')}</button>${n.type === 'note' ? `<button class="btn" id="gLocal">🕸 ${t('n_local')}</button>` : ''}`;
    $('#gOpen').onclick = () => nGraphOpen(n); $('#gLocal')?.addEventListener('click', () => { N.localId = n.id; nRender(); });
  };
  nGraph = new GBGraph($('#ngc'), {
    onSelect: showInfo, onOpen: nGraphOpen,
    onHover: (n, e) => { if (!n) { tip.hidden = true; return; } tip.hidden = false; tip.textContent = n.title; const r = $('.ngraph').getBoundingClientRect(); tip.style.left = Math.min(r.width - 220, e.clientX - r.left + 14) + 'px'; tip.style.top = (e.clientY - r.top + 14) + 'px'; },
  });
  nGraph.setData(data); nGraph.set({ ...NG, focus }); if (focus) nGraph.select(focus); nGraph.start();
  $('#gEmpty').hidden = nGraph.nodes.length > 0;
  const legend = () => { $('#gLeg').innerHTML = nGraph.legend.map((l) => `<button data-tag="${esc(l.group)}"><i style="background:${l.color}"></i>${esc(l.group.startsWith('#') ? l.group : l.group)} <small>${l.count}</small></button>`).join(''); };
  legend();
  const ctl = $('.gctl');
  ctl.oninput = (e) => { const k = e.target.dataset.g; if (e.target.id === 'gF') { NG.filter = e.target.value; nGraph.set({ filter: NG.filter }); return; } if (!k) return; NG[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' ? +e.target.value : +e.target.value; nGraph.set({ [k]: NG[k] }); legend(); $('#gEmpty').hidden = nGraph.nodes.length > 0; };
  ctl.onchange = ctl.oninput;
  $('#gGlobal')?.addEventListener('click', () => { N.localId = ''; nRender(); });
  $$('.gzoom [data-z]').forEach((b) => (b.onclick = () => nGraph.zoomBy(+b.dataset.z))); $('#gFit').onclick = () => nGraph.fit(true);
  $('#gLeg').onclick = (e) => { const b = e.target.closest('[data-tag]'); if (!b) return; NG.filter = ''; N.tag = b.dataset.tag; N.tab = 'notes'; nLoad().then(nRender); };
}
function nGraphOpen(n) {
  if (n.type === 'note') return nOpen(n.id);
  if (n.type === 'card') { $('#notesDlg').close(); return showCard(n.cardId); }
  if (n.type === 'tag') { N.tag = n.title.replace(/^#/, ''); N.tab = 'notes'; return nLoad().then(nRender); }
  if (n.type === 'ghost') { if (!nCan()) return toast(t('n_ghost_tip')); if (!confirm(t('n_create_ghost', n.title))) return; N.cur = { id: '', project: N.pid, title: n.title, body: '', props: {}, tags: [], backlinks: [], links: [], history: [] }; N.editing = true; N.dirty = true; N.tab = 'notes'; nRender(); }
}

// ---------- card detail: notes that mention this card ----------
async function renderCardNotes(c) {
  const box = $('#cardNotes'); if (!box) return;
  let list = []; try { list = await api('GET', `/notes?project=${encodeURIComponent(c.project)}&mentions=${encodeURIComponent(refOf(c))}`, undefined, true); } catch { /* none */ }
  if (!list.length) { box.hidden = true; return; }
  box.hidden = false; box.innerHTML = `<h4>📓 ${t('n_card_notes')}</h4><div class="gd-chips">${list.map((n) => `<span class="gd-chip"><a href="#" data-opennote="${n.id}" data-proj="${esc(n.project)}">📄 ${esc(n.title)}</a></span>`).join('')}</div>`;
  box.onclick = (e) => { const a = e.target.closest('[data-opennote]'); if (!a) return; e.preventDefault(); N.pid = a.dataset.proj; $('#viewDlg').close(); openNotes(a.dataset.opennote); };
}

$('#notesBtn').onclick = () => openNotes();
const _applyLang2 = applyLang; applyLang = function () { _applyLang2(); $('#notesBtn').title = t('notes_btn'); if (N.built && $('#notesDlg').open) nRender(); };
$('#notesBtn').title = t('notes_btn');
