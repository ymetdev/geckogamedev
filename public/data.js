// GeckoBoard — game data tables (balance sheets: monsters, zones, items…). Loaded after app.js (shares its globals).
Object.assign(I18N.en, {
  data_title: 'Game data', data_btn: 'Game data', data_tables: 'Tables', data_new_table: '+ New table', data_prompt_name: 'Table name (e.g. Monsters, Zones, Items):',
  data_add_row: '+ Row', data_columns: 'Columns', data_import: 'Import', data_csv: 'CSV', data_json: 'JSON', data_history: 'History', data_search: 'Search rows…',
  data_no_tables: 'No tables yet. Create one for monsters, zones, items, skills…', data_no_rows: 'No rows yet — add one or import from Excel / Google Sheets.', data_pick: 'Pick a table on the left.',
  data_col_name: 'Column name', data_type_text: 'Text', data_type_number: 'Number', data_type_select: 'Choice', data_type_bool: 'Yes/No', data_options: 'Options, comma separated',
  data_add_col: '+ Column', data_edit_cols: 'Table & columns', data_tname: 'Table name', data_del_table: 'Delete table', data_confirm_del_table: 'Delete table "{0}" with ALL its rows? This cannot be undone (export first!).',
  data_confirm_del_row: 'Delete this row?', data_cols_hint: 'First column is the row name (used in history and links). Removing a column deletes its values.', data_cols_note: 'Changing a column type converts its values where possible.',
  data_imp_title: 'Import rows', data_imp_hint: 'Paste from Excel / Google Sheets (first line = column names), or choose a CSV file.', data_imp_file: 'Choose CSV file', data_imp_append: 'Add to existing rows', data_imp_replace: 'Replace ALL rows',
  data_imp_newcols: 'Create columns that do not exist yet', data_imp_go: 'Import', data_imp_n: '{0} rows ready', data_imp_done: 'Imported {0} rows', data_confirm_replace: 'Replace ALL current rows with the imported ones?',
  data_ro: 'View only', data_no_hist: 'No changes yet', data_linked: 'Game data', data_link_pick: 'Link a row…', data_link_table: 'Table', data_link_row: 'Row', data_link_add: 'Link', data_unlink: 'Unlink',
  data_h_edit: 'changed', data_h_add: 'added', data_h_delete: 'deleted', data_h_import: 'imported', data_h_columns: 'edited columns', data_h_create: 'created the table', data_saved: 'Saved', data_rows_n: '{0} rows',
  data_other: 'This project has no tables, but other projects do — pick one in the list above.', e_dnum: '"{0}" must be a number', e_dtable: 'Table name already used', e_dfull: 'Table is full (3000 rows)',
});
Object.assign(I18N.th, {
  data_title: 'ข้อมูลเกม', data_btn: 'ข้อมูลเกม', data_tables: 'ตาราง', data_new_table: '+ ตารางใหม่', data_prompt_name: 'ชื่อตาราง (เช่น Monsters, Zones, Items):',
  data_add_row: '+ แถว', data_columns: 'คอลัมน์', data_import: 'นำเข้า', data_csv: 'CSV', data_json: 'JSON', data_history: 'ประวัติ', data_search: 'ค้นหาแถว…',
  data_no_tables: 'ยังไม่มีตาราง สร้างตารางมอนสเตอร์ โซน ไอเทม สกิล ได้เลย', data_no_rows: 'ยังไม่มีแถว — เพิ่มเอง หรือนำเข้าจาก Excel / Google Sheets', data_pick: 'เลือกตารางทางซ้าย',
  data_col_name: 'ชื่อคอลัมน์', data_type_text: 'ข้อความ', data_type_number: 'ตัวเลข', data_type_select: 'ตัวเลือก', data_type_bool: 'ใช่/ไม่ใช่', data_options: 'ตัวเลือก คั่นด้วยจุลภาค',
  data_add_col: '+ คอลัมน์', data_edit_cols: 'ตารางและคอลัมน์', data_tname: 'ชื่อตาราง', data_del_table: 'ลบตาราง', data_confirm_del_table: 'ลบตาราง "{0}" และทุกแถว? ย้อนกลับไม่ได้ (ส่งออกก่อนนะ)',
  data_confirm_del_row: 'ลบแถวนี้?', data_cols_hint: 'คอลัมน์แรกคือชื่อของแถว (ใช้ในประวัติและลิงก์) การลบคอลัมน์จะลบค่าในคอลัมน์นั้นด้วย', data_cols_note: 'เปลี่ยนชนิดคอลัมน์จะแปลงค่าให้เท่าที่ทำได้',
  data_imp_title: 'นำเข้าแถว', data_imp_hint: 'วางจาก Excel / Google Sheets (บรรทัดแรก = ชื่อคอลัมน์) หรือเลือกไฟล์ CSV', data_imp_file: 'เลือกไฟล์ CSV', data_imp_append: 'เพิ่มต่อจากแถวเดิม', data_imp_replace: 'แทนที่ทุกแถว',
  data_imp_newcols: 'สร้างคอลัมน์ที่ยังไม่มีให้อัตโนมัติ', data_imp_go: 'นำเข้า', data_imp_n: 'พร้อมนำเข้า {0} แถว', data_imp_done: 'นำเข้าแล้ว {0} แถว', data_confirm_replace: 'แทนที่ทุกแถวที่มีด้วยข้อมูลที่นำเข้า?',
  data_ro: 'ดูอย่างเดียว', data_no_hist: 'ยังไม่มีการแก้ไข', data_linked: 'ข้อมูลเกม', data_link_pick: 'ลิงก์แถวข้อมูล…', data_link_table: 'ตาราง', data_link_row: 'แถว', data_link_add: 'ลิงก์', data_unlink: 'เลิกลิงก์',
  data_h_edit: 'แก้', data_h_add: 'เพิ่ม', data_h_delete: 'ลบ', data_h_import: 'นำเข้า', data_h_columns: 'แก้คอลัมน์', data_h_create: 'สร้างตาราง', data_saved: 'บันทึกแล้ว', data_rows_n: '{0} แถว',
  data_other: 'โปรเจกต์นี้ยังไม่มีตาราง แต่โปรเจกต์อื่นมี — เลือกจากรายการด้านบน', e_dnum: '"{0}" ต้องเป็นตัวเลข', e_dtable: 'ชื่อตารางนี้ถูกใช้แล้ว', e_dfull: 'ตารางเต็ม (3000 แถว)',
});
ERRS.push([/^"(.+)" must be a number/, 'e_dnum'], [/^Table name already used/, 'e_dtable'], [/^Table is full/, 'e_dfull']);

const D = { pid: '', all: [], list: [], tid: '', tab: null, q: '', sort: null, hi: '', hist: false, busy: false };
const dEdit = () => !!D.pid && rl(D.pid, 'dev', 'admin');
const dRowName = (tab, r) => String(r.cells[tab.columns[0]?.id] ?? r.id) || r.id;
const dCache = new Map(); // table id -> {at, tab} for card links
async function dGet(id) { const c = dCache.get(id); if (c && Date.now() - c.at < 8000) return c.tab; const tab = await api('GET', `/tables/${encodeURIComponent(id)}`, undefined, true); dCache.set(id, { at: Date.now(), tab }); return tab; }

async function openData(tid, rid) {
  const act = activeProjects();
  D.pid = D.pid && act.some((p) => p.id === D.pid) ? D.pid : (viewProject || act[0]?.id || projects[0]?.id || '');
  if (tid) { const p = await dGet(tid).catch(() => null); if (p) D.pid = p.project; }
  D.q = ''; D.sort = null; D.hist = false; D.hi = rid || '';
  await dList(tid, !viewProject);
  if (!$('#dataDlg').open) $('#dataDlg').showModal();
}
async function dList(want, auto) {
  try { D.all = await api('GET', '/tables'); } catch (e) { D.all = []; toast(e.message); }
  if (auto && !want && !D.all.some((x) => x.project === D.pid) && D.all.length) D.pid = [...D.all].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0].project; // land on a project that has tables
  D.list = D.all.filter((x) => x.project === D.pid);
  const id = want || (D.list.some((x) => x.id === D.tid) ? D.tid : D.list[0]?.id || '');
  await dSelect(id);
}
async function dSelect(id) {
  D.tid = id || ''; D.tab = null;
  if (D.tid) { try { D.tab = await api('GET', `/tables/${encodeURIComponent(D.tid)}`); } catch (e) { toast(e.message); D.tid = ''; } }
  dRender();
}
const dTypeLabel = (ty) => t('data_type_' + ty);
function dRender() {
  const act = projects.filter((p) => !p.archived || isAdmin());
  const ed = dEdit(), tab = D.tab;
  $('#dataDlg h3').textContent = '🗂 ' + t('data_title');
  $('#dataSide').innerHTML = `${act.length > 1 ? `<select id="dataProj">${act.map((p) => `<option value="${esc(p.id)}" ${p.id === D.pid ? 'selected' : ''}>${esc(p.name)} (${D.all.filter((x) => x.project === p.id).length})</option>`).join('')}</select>` : ''}
    <div class="gd-tabs">${D.list.map((x) => `<button class="gd-tab${x.id === D.tid ? ' on' : ''}" data-tid="${esc(x.id)}">${esc(x.name)}<small>${x.rows}</small></button>`).join('')}</div>
    ${ed ? `<button class="btn" id="dataNew">${t('data_new_table')}</button>` : ''}`;
  if (!tab) { $('#dataMain').innerHTML = `<div class="empty" style="margin:auto">${D.list.length ? t('data_pick') : D.all.length ? t('data_other') : t('data_no_tables')}</div>`; return dWire(); }
  $('#dataMain').innerHTML = `<div class="gd-bar">
      <input id="dataQ" type="search" placeholder="${esc(t('data_search'))}" value="${esc(D.q)}">
      <span class="meta" id="dataCnt"></span><span class="sp"></span>
      ${ed ? `<button class="btn primary" id="dataAdd">${t('data_add_row')}</button><button class="btn" id="dataCols">${t('data_columns')}</button><button class="btn" id="dataImp">${t('data_import')}</button>` : `<span class="meta">${t('data_ro')}</span>`}
      <a class="btn" href="/api/tables/${esc(tab.id)}/export?format=csv" download>${t('data_csv')}</a><a class="btn" href="/api/tables/${esc(tab.id)}/export?format=json" download>${t('data_json')}</a>
      <button class="btn${D.hist ? ' on' : ''}" id="dataHist">${t('data_history')}</button></div>
    <div class="gd-scroll"><table class="gd" id="dataGrid"></table></div>
    <div class="gd-hist" id="dataHistBox" ${D.hist ? '' : 'hidden'}></div>`;
  dGrid(); dHist(); dWire();
}
function dCell(c, v, ed, rid) {
  const a = `data-r="${esc(rid)}" data-c="${esc(c.id)}"`;
  if (!ed) return c.type === 'bool' ? (v ? '✓' : '') : esc(v);
  if (c.type === 'bool') return `<input type="checkbox" ${a} ${v ? 'checked' : ''}>`;
  if (c.type === 'select') return `<select ${a}><option value=""></option>${c.options.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  if (c.type === 'number') return `<input type="number" step="any" ${a} value="${esc(v)}">`;
  return `<input type="text" ${a} value="${esc(v)}" maxlength="2000">`;
}
function dGrid() {
  const tab = D.tab, ed = dEdit(), q = D.q.trim().toLowerCase();
  let rows = tab.rows.filter((r) => !q || tab.columns.some((c) => String(r.cells[c.id] ?? '').toLowerCase().includes(q)));
  if (D.sort) { const { id, dir } = D.sort; const col = tab.columns.find((c) => c.id === id);
    rows = [...rows].sort((a, b) => { const x = a.cells[id] ?? '', y = b.cells[id] ?? ''; const r = col?.type === 'number' ? (x === '' ? 1 : y === '' ? -1 : x - y) : String(x).localeCompare(String(y), undefined, { numeric: true }); return r * dir; }); }
  $('#dataCnt').textContent = q ? `${rows.length} / ${tab.rows.length}` : t('data_rows_n', tab.rows.length);
  const arrow = (c) => (D.sort?.id === c.id ? (D.sort.dir > 0 ? ' ▲' : ' ▼') : '');
  $('#dataGrid').innerHTML = `<thead><tr><th class="n">#</th>${tab.columns.map((c) => `<th data-sort="${esc(c.id)}" class="${c.type}" title="${esc(dTypeLabel(c.type))}">${esc(c.name)}${arrow(c)}</th>`).join('')}${ed ? '<th class="x"></th>' : ''}</tr></thead>
    <tbody>${rows.map((r, i) => `<tr data-row="${esc(r.id)}"${r.id === D.hi ? ' class="hi"' : ''}><td class="n">${i + 1}</td>${tab.columns.map((c) => `<td class="${c.type}">${dCell(c, r.cells[c.id] ?? (c.type === 'bool' ? false : ''), ed, r.id)}</td>`).join('')}${ed ? `<td class="x"><button class="btn bad icon" data-delrow="${esc(r.id)}" aria-label="Delete">✕</button></td>` : ''}</tr>`).join('')
      || `<tr><td colspan="${tab.columns.length + 2}" class="meta" style="text-align:center;padding:26px">${q ? t('no_match') : t('data_no_rows')}</td></tr>`}</tbody>`;
  if (D.hi) { $('#dataGrid tr.hi')?.scrollIntoView({ block: 'center' }); D.hi = ''; }
}
function dHist() {
  if (!D.hist || !D.tab) return;
  const h = [...D.tab.history].reverse().slice(0, 80);
  $('#dataHistBox').innerHTML = h.map((x) => `<div>${new Date(x.at).toLocaleString(locale())} · ${esc(nameOf(x.user))} · ${esc(t('data_h_' + x.op))} ${x.label ? `<b>${esc(x.label)}</b>` : ''}${x.col ? ` · ${esc(x.col)}: <s>${esc(x.from === '' ? '∅' : x.from)}</s> → <b>${esc(x.to === '' ? '∅' : x.to)}</b>` : ''}</div>`).join('') || `<div class="meta">${t('data_no_hist')}</div>`;
}
async function dSaveCell(el) {
  const tab = D.tab, row = tab.rows.find((r) => r.id === el.dataset.r); if (!row) return;
  const v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.type !== 'checkbox' && String(row.cells[el.dataset.c] ?? '') === String(v)) return;
  el.classList.add('saving');
  try {
    const r = await api('PATCH', `/tables/${tab.id}/rows/${row.id}`, { cells: { [el.dataset.c]: v } }, true);
    row.cells = r.cells; dCache.delete(tab.id);
    D.tab = await api('GET', `/tables/${tab.id}`, undefined, true); // fresh history and normalised values
    el.classList.remove('saving'); el.classList.add('saved'); setTimeout(() => el.classList.remove('saved'), 900);
    if (D.hist) dHist();
  } catch (e) { toast(e.message); el.classList.remove('saving'); dGrid(); }
}
function dWire() {
  const dlg = $('#dataDlg');
  $('#dataProj')?.addEventListener('change', async (e) => { D.pid = e.target.value; D.tid = ''; await dList(); });
  $$('#dataSide [data-tid]').forEach((b) => (b.onclick = () => { D.q = ''; D.sort = null; dSelect(b.dataset.tid); }));
  $('#dataNew')?.addEventListener('click', async () => {
    const name = prompt(t('data_prompt_name')); if (!name?.trim()) return;
    try { const tb = await api('POST', '/tables', { project: D.pid, name }); await dList(tb.id); dCols(); } catch (e) { toast(e.message); }
  });
  if (!D.tab) return;
  $('#dataQ').oninput = (e) => { D.q = e.target.value; dGrid(); };
  $('#dataHist').onclick = () => { D.hist = !D.hist; $('#dataHistBox').hidden = !D.hist; $('#dataHist').classList.toggle('on', D.hist); dHist(); };
  $('#dataAdd')?.addEventListener('click', async (e) => withBusy(e.target, async () => {
    try { const r = await api('POST', `/tables/${D.tab.id}/rows`, { cells: {} }); D.tab = await api('GET', `/tables/${D.tab.id}`); D.q = ''; D.hi = r.id; dGrid(); const f = $(`#dataGrid tr[data-row="${r.id}"] input,#dataGrid tr[data-row="${r.id}"] select`); f?.focus(); } catch (er) { toast(er.message); }
  }));
  $('#dataCols')?.addEventListener('click', dCols);
  $('#dataImp')?.addEventListener('click', dImport);
  $('#dataGrid').onclick = async (e) => {
    const th = e.target.closest('[data-sort]'); if (th) { const id = th.dataset.sort; D.sort = D.sort?.id === id ? (D.sort.dir > 0 ? { id, dir: -1 } : null) : { id, dir: 1 }; return dGrid(); }
    const del = e.target.closest('[data-delrow]');
    if (del && confirm(t('data_confirm_del_row'))) { try { await api('DELETE', `/tables/${D.tab.id}/rows/${del.dataset.delrow}`); D.tab = await api('GET', `/tables/${D.tab.id}`); dCache.delete(D.tab.id); dGrid(); dHist(); } catch (er) { toast(er.message); } }
  };
  $('#dataGrid').onchange = (e) => { if (e.target.dataset.c) dSaveCell(e.target); };
  $('#dataGrid').onkeydown = (e) => { if (e.key === 'Enter' && e.target.matches('input[type=text],input[type=number]')) { e.preventDefault(); e.target.blur(); } };
}
// ---- columns editor ----
let colDraft = [];
function dCols() {
  const tab = D.tab; colDraft = tab.columns.map((c) => ({ ...c, options: (c.options || []).join(', ') }));
  $('#colName').value = tab.name; $('#colDel').hidden = !isAdmin(); $('#colErr').textContent = ''; dColsRender();
  $('#colDlg').showModal();
}
function dColsRender() {
  $('#colList').innerHTML = colDraft.map((c, i) => `<div class="gd-col" data-i="${i}"><input data-f="name" value="${esc(c.name)}" placeholder="${esc(t('data_col_name'))}" maxlength="40">
    <select data-f="type">${['text', 'number', 'select', 'bool'].map((ty) => `<option value="${ty}" ${ty === c.type ? 'selected' : ''}>${esc(dTypeLabel(ty))}</option>`).join('')}</select>
    <input data-f="options" value="${esc(c.options || '')}" placeholder="${esc(t('data_options'))}" ${c.type === 'select' ? '' : 'hidden'}>
    <button class="btn icon" data-mv="-1" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn icon" data-mv="1" ${i === colDraft.length - 1 ? 'disabled' : ''}>↓</button><button class="btn bad icon" data-rm="1" ${colDraft.length === 1 ? 'disabled' : ''}>✕</button></div>`).join('');
}
$('#colList').addEventListener('input', (e) => { const r = e.target.closest('.gd-col'); if (r && e.target.dataset.f) colDraft[+r.dataset.i][e.target.dataset.f] = e.target.value; });
$('#colList').addEventListener('change', (e) => { const r = e.target.closest('.gd-col'); if (r && e.target.dataset.f === 'type') { colDraft[+r.dataset.i].type = e.target.value; dColsRender(); } });
$('#colList').addEventListener('click', (e) => {
  const r = e.target.closest('.gd-col'); if (!r) return; const i = +r.dataset.i;
  if (e.target.dataset.rm) colDraft.splice(i, 1);
  else if (e.target.dataset.mv) { const j = i + +e.target.dataset.mv; [colDraft[i], colDraft[j]] = [colDraft[j], colDraft[i]]; } else return;
  dColsRender();
});
$('#colAdd').onclick = () => { colDraft.push({ name: '', type: 'text', options: '' }); dColsRender(); $$('#colList .gd-col:last-child input')[0]?.focus(); };
$('#colSave').onclick = async (e) => withBusy(e.target, async () => {
  try { D.tab = await api('PATCH', `/tables/${D.tab.id}`, { name: $('#colName').value, columns: colDraft }); dCache.delete(D.tab.id); $('#colDlg').close(); await dList(D.tab.id); toast(t('data_saved')); }
  catch (er) { $('#colErr').textContent = er.message; }
});
$('#colDel').onclick = async () => {
  if (!confirm(t('data_confirm_del_table', D.tab.name))) return;
  try { await api('DELETE', `/tables/${D.tab.id}`); $('#colDlg').close(); D.tid = ''; await dList(); } catch (er) { $('#colErr').textContent = er.message; }
};
// ---- import ----
function parseSheet(text) { // CSV or tab-separated (pasted from a spreadsheet) -> [{col: value}]
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0] || ''; const sep = first.includes('\t') ? '\t' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"' && cur === '') q = true;
    else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((c) => c !== '')) rows.push(row); row = []; }
    else cur += ch;
  }
  row.push(cur); if (row.some((c) => c !== '')) rows.push(row);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()]).filter(([h]) => h)));
}
function dImport() { $('#impText').value = ''; $('#impInfo').textContent = ''; $('#impErr').textContent = ''; $('#impMode').value = 'append'; $('#impNew').checked = true; $('#impDlg').showModal(); }
$('#impText').addEventListener('input', () => { const n = parseSheet($('#impText').value).length; $('#impInfo').textContent = n ? t('data_imp_n', n) : ''; });
$('#impFile').onchange = async (e) => { const f = e.target.files[0]; if (f) { $('#impText').value = await f.text(); $('#impText').dispatchEvent(new Event('input')); } e.target.value = ''; };
$('#impGo').onclick = async (e) => withBusy(e.target, async () => {
  const rows = parseSheet($('#impText').value); const replace = $('#impMode').value === 'replace';
  if (!rows.length) { $('#impErr').textContent = t('data_imp_hint'); return; }
  if (replace && !confirm(t('data_confirm_replace'))) return;
  try { D.tab = await api('POST', `/tables/${D.tab.id}/import`, { rows, replace, create_columns: $('#impNew').checked }); dCache.delete(D.tab.id); $('#impDlg').close(); await dList(D.tab.id); toast(t('data_imp_done', rows.length)); }
  catch (er) { $('#impErr').textContent = er.message; }
});
// ---- live refresh while open (another person may edit) ----
setInterval(async () => {
  if (!$('#dataDlg').open || !D.tab || D.busy || $('#colDlg').open || $('#impDlg').open || document.activeElement?.closest('#dataGrid')) return;
  try { const fresh = await api('GET', `/tables/${D.tab.id}`, undefined, true); if (fresh.updated_at !== D.tab.updated_at) { D.tab = fresh; dGrid(); dHist(); } } catch { /* ignore */ }
}, 4000);
// ---- card ↔ data rows ----
async function renderCardData(c) {
  const box = $('#cardData'); if (!box) return;
  const links = c.data || [], canLink = rl(c.project, 'dev', 'admin', 'tester');
  const chips = [];
  for (const l of links) {
    const tab = await dGet(l.t).catch(() => null), row = tab?.rows.find((r) => r.id === l.r); if (!row) continue;
    chips.push(`<span class="gd-chip"><a href="#" data-gopen="${esc(l.t)}|${esc(l.r)}">🗂 ${esc(tab.name)} · ${esc(dRowName(tab, row))}</a>${canLink ? `<button data-gunlink="${esc(l.t)}|${esc(l.r)}" aria-label="${esc(t('data_unlink'))}">✕</button>` : ''}</span>`);
  }
  let tables = []; if (canLink) { try { tables = await api('GET', `/tables?project=${encodeURIComponent(c.project)}`, undefined, true); } catch { /* ignore */ } }
  if (!chips.length && !tables.length) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `<h4>${t('data_linked')}</h4><div class="gd-chips">${chips.join('')}</div>
    ${tables.length && canLink ? `<div class="row" style="margin-top:8px;flex-wrap:nowrap"><select id="gdT"><option value="">${esc(t('data_link_pick'))}</option>${tables.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select><select id="gdR" hidden></select><button class="btn" id="gdAdd" hidden>${t('data_link_add')}</button></div>` : ''}`;
  $('#gdT')?.addEventListener('change', async (e) => {
    const r = $('#gdR'), b = $('#gdAdd'); r.hidden = b.hidden = !e.target.value; if (!e.target.value) return;
    const tab = await dGet(e.target.value); r.innerHTML = tab.rows.map((x) => `<option value="${esc(x.id)}">${esc(dRowName(tab, x))}</option>`).join('');
  });
  $('#gdAdd')?.addEventListener('click', async () => { try { await api('POST', `/cards/${c.id}/datalink`, { table: $('#gdT').value, row: $('#gdR').value }); await load(true); } catch (e) { toast(e.message); } });
  box.onclick = async (e) => {
    const o = e.target.closest('[data-gopen]'); if (o) { e.preventDefault(); const [tid, rid] = o.dataset.gopen.split('|'); $('#viewDlg').close(); return openData(tid, rid); }
    const u = e.target.closest('[data-gunlink]'); if (u) { const [tid, rid] = u.dataset.gunlink.split('|'); try { await api('POST', `/cards/${c.id}/dataunlink`, { table: tid, row: rid }); await load(true); } catch (er) { toast(er.message); } }
  };
}
$('#dataBtn').onclick = () => openData();
const _applyLang = applyLang; applyLang = function () { _applyLang(); $('#dataBtn').title = t('data_btn'); if ($('#dataDlg').open) dRender(); };
$('#dataBtn').title = t('data_btn');
applyLang();
