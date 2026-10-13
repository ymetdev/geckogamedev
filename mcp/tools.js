// GeckoBoard MCP tools. Used by the HTTP endpoint (/mcp) and by the optional stdio launcher (mcp/server.js).
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const text = (t) => ({ content: [{ type: 'text', text: typeof t === 'string' ? t : JSON.stringify(t, null, 2) }] });
const fail = (e) => ({ isError: true, content: [{ type: 'text', text: `Error: ${e.message}` }] });
const wrap = (fn) => async (args) => { try { return text(await fn(args)); } catch (e) { return fail(e); } };
const brief = (c) => ({
  id: c.id, type: c.type, title: c.title, priority: c.priority, status: c.status,
  assignees: c.assignees, tags: c.tags, due: c.due || undefined, milestone: c.milestone || undefined,
  parent: c.parent || undefined, attachments: c.files?.length || undefined,
});

export function createServer({ base, token, project = '' }) {
  // When this connection is not pinned to one project and the user has several, never guess where something goes: make Claude ask first.
  const ASK = 'This connection is not pinned to a project and the user belongs to several. Do NOT guess: ask the user which project (and confirm what you are about to create) before calling this again with `project`.';
  async function call(method, path, body) {
    const res = await fetch(base.replace(/\/$/, '') + '/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-devboard-token': token, ...(project && { 'x-devboard-project': project }) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }
  let keyCache = { at: 0, map: {} };
  async function keys() { // project id -> key (for refs like ALPHA-12), cached briefly
    if (Date.now() - keyCache.at > 60000) { const me = await call('GET', '/me'); keyCache = { at: Date.now(), map: Object.fromEntries(me.projects.map((p) => [p.id, p.key])) }; }
    return keyCache.map;
  }
  const withRef = async (c) => ({ ...brief(c), ref: `${(await keys())[c.project] || '?'}-${c.num ?? c.id}`, project: c.project });
  const server = new McpServer({ name: 'geckoboard', version: '1.0.0' }, {
    instructions:
      (project ? `This connection is pinned to project "${project}": you only see and change that project's cards. ` : 'The user may belong to several projects; each card shows its project and ref (e.g. ALPHA-12). Use a project-pinned connection (/mcp?project=...) when working inside one game repo. ') +
      'IMPORTANT: if you are unsure which project, table or card something belongs to, or what the user wants changed, ASK the user before creating or changing anything. Never guess a project. ' +
      'GeckoBoard tracks game-team Tickets (bug reports/requests) and Tasks. The dev marks cards they will do ' +
      '(status in_progress, assigned to them). When asked to work on their cards: call list_my_cards, then get_card ' +
      'for details (use get_attachment to look at screenshots on the card; if the card links game data rows or is about balance/stats, read them with list_tables/get_table), fix the code in the repo, verify as far as you can, and ONLY THEN call mark_ready_for_test with a ' +
      'summary and test steps for the tester. Never mark ready if the fix is unfinished. ' +
      'WRITING STYLE for the summary and test_steps: write in THAI, in very simple everyday words, as short as possible, for a tester who is NOT a programmer. ' +
      'No code, file, class or function names: describe what the tester does and sees in the game. One action per step, 3-6 steps, each step like "ทำ... → ควรเห็น: ...". The summary is 1-2 short Thai sentences saying what changed in plain words.',
  });

  server.registerTool('list_projects', {
    description: 'List the projects the current user belongs to (id, key, name, role). Cards are numbered per project, e.g. ALPHA-12.',
    inputSchema: {},
  }, wrap(async () => (await call('GET', '/me')).projects));

  server.registerTool('list_my_cards', {
    description: 'List cards the current dev claimed (default: in_progress). Use this when the user says "do my tasks".',
    inputSchema: { status: z.enum(['open', 'in_progress', 'ready_to_test', 'complete']).optional().describe('Default in_progress') },
  }, wrap(async ({ status }) => Promise.all((await call('GET', `/cards?assignee=${encodeURIComponent((await call('GET', '/me')).email)}&status=${status || 'in_progress'}`)).map(withRef))));

  server.registerTool('list_cards', {
    description: 'List cards on the board with optional filters.',
    inputSchema: {
      type: z.enum(['ticket', 'task']).optional(),
      status: z.string().optional().describe('Comma separated: open,in_progress,ready_to_test,complete'),
      unassigned: z.boolean().optional(),
    },
  }, wrap(async ({ type, status, unassigned }) => {
    const q = new URLSearchParams();
    if (type) q.set('type', type);
    if (status) q.set('status', status);
    if (unassigned) q.set('unassigned', '1');
    return Promise.all((await call('GET', `/cards?${q}`)).map(withRef));
  }));

  server.registerTool('get_card', {
    description: 'Get full details of a card: description, comments (incl. failed-test feedback), history.',
    inputSchema: { id: z.number().int() },
  }, wrap(({ id }) => call('GET', `/cards/${id}`)));

  server.registerTool('claim_cards', {
    description: 'Mark one or more cards as "I will do this" for the current dev (moves open -> in_progress). A card can have only one owner: cards already claimed by someone else come back with an error and are skipped.',
    inputSchema: { ids: z.array(z.number().int()).min(1) },
  }, wrap(async ({ ids }) => {
    const out = [];
    for (const id of ids) {
      try { out.push(await withRef(await call('POST', `/cards/${id}/claim`, {}))); }
      catch (e) { out.push({ id, error: e.message }); } // e.g. "Already claimed by Smart": report, keep going
    }
    return out;
  }));

  server.registerTool('mark_ready_for_test', {
    description:
      'After the fix is DONE and verified, set the card to Ready to Test. Write summary and test_steps in THAI, simple everyday words, very short, ' +
      'for a non-programmer tester (no code or file names; say what they do and what they should see). Example step: "กดปุ่มโจมตี → ควรเห็นแถบพลังลดลงทันที".',
    inputSchema: {
      id: z.number().int(),
      summary: z.string().describe('THAI, plain words, 1-2 short sentences: what changed (no code terms)'),
      test_steps: z.array(z.string()).min(1).describe('THAI, very short, simple words, 3-6 steps, each "ทำ... → ควรเห็น: ..."; no code or file names'),
    },
  }, wrap(async ({ id, summary, test_steps }) => withRef(await call('POST', `/cards/${id}/ready`, { summary, test_steps }))));

  server.registerTool('add_comment', {
    description: 'Add a progress note/question to a card (e.g. when blocked or needs info).',
    inputSchema: { id: z.number().int(), text: z.string() },
  }, wrap(({ id, text }) => call('POST', `/cards/${id}/comment`, { text }).then(withRef)));

  server.registerTool('get_attachment', {
    description: 'View an image attached to a card (e.g. a bug screenshot). Use get_card first to see the file ids. Videos cannot be viewed.',
    inputSchema: { id: z.number().int().describe('Card id'), file_id: z.string() },
  }, async ({ id, file_id }) => {
    try {
      const card = await call('GET', `/cards/${id}`);
      const f = (card.files || []).find((x) => x.id === file_id);
      if (!f) throw new Error('File not found on this card');
      if (!f.mime.startsWith('image/')) return text(`"${f.name}" is a ${f.mime} file and cannot be viewed here.`);
      const get = (q) => fetch(base.replace(/\/$/, '') + `/api/files/${file_id}${q}`, { headers: { 'x-devboard-token': token } });
      let res = await get(''), note = '', mime = f.mime;
      if (res.status === 410) { res = await get('?thumb=1'); note = ' - ORIGINAL WAS RECYCLED, this is only the small preview'; mime = 'image/jpeg'; }
      if (!res.ok) throw new Error(res.status === 410 || res.status === 404 ? 'File was recycled and has no preview' : `HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      return { content: [{ type: 'text', text: `${f.name} (${f.mime}, ${f.size} bytes)${note}` }, { type: 'image', data: buf.toString('base64'), mimeType: mime }] };
    } catch (e) { return fail(e); }
  });

  server.registerTool('create_card', {
    description: 'Create a new ticket or task (e.g. a follow-up bug found while fixing).',
    inputSchema: {
      type: z.enum(['ticket', 'task']),
      title: z.string(),
      description: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      tags: z.array(z.string()).optional(),
      due: z.string().optional().describe('YYYY-MM-DD'),
      milestone: z.string().optional(),
      parent: z.number().int().optional().describe('Parent card id (makes this a sub-card)'),
      project: z.string().optional().describe('Project id. ASK the user if unsure; required when the connection is not pinned and the user has several projects'),
    },
  }, wrap(async (a) => {
    if (!project && !a.project && (await call('GET', '/me')).projects.filter((p) => !p.archived).length > 1) throw new Error(ASK + ' Projects: ' + JSON.stringify((await call('GET', '/me')).projects.map((p) => ({ id: p.id, name: p.name }))));
    return withRef(await call('POST', '/cards', a));
  }));

  // ---- game data tables (balance: monsters, zones, items...) ----
  const asObj = (t, r) => ({ row: r.id, ...Object.fromEntries(t.columns.map((c) => [c.name, r.cells[c.id] ?? ''])) });
  server.registerTool('list_tables', {
    description: 'List the game-data tables (balance sheets such as Monsters, Zones, Items) with row counts. Check these when a card is about balance or stats.',
    inputSchema: {},
  }, wrap(() => call('GET', '/tables')));

  server.registerTool('get_table', {
    description: 'Read a game-data table: columns (name, type) and rows as {row, <ColumnName>: value}. Use `q` to filter rows containing text (any column) and `limit` (default 100).',
    inputSchema: { table: z.string().describe('Table id from list_tables, e.g. t1'), q: z.string().optional(), limit: z.number().int().min(1).max(500).optional() },
  }, wrap(async ({ table, q, limit }) => {
    const t = await call('GET', `/tables/${encodeURIComponent(table)}`);
    let rows = t.rows.map((r) => asObj(t, r));
    if (q) rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
    return { id: t.id, name: t.name, columns: t.columns.map((c) => ({ name: c.name, type: c.type, ...(c.options && { options: c.options }) })), total_rows: t.rows.length, rows: rows.slice(0, limit || 100) };
  }));

  server.registerTool('update_row', {
    description: 'Change values in one row of a game-data table (dev/admin only). Use column NAMES as keys. Only change balance values when the card/user asks; every change is recorded in the table history under the user.',
    inputSchema: { table: z.string(), row: z.string().describe('Row id from get_table, e.g. r3'), values: z.record(z.union([z.string(), z.number(), z.boolean()])) },
  }, wrap(async ({ table, row, values }) => {
    const r = await call('PATCH', `/tables/${encodeURIComponent(table)}/rows/${encodeURIComponent(row)}`, { cells: values });
    return { updated: row, cells: r.cells };
  }));

  server.registerTool('add_row', {
    description: 'Add a new row (e.g. a new monster) to a game-data table (dev/admin only). Use column NAMES as keys.',
    inputSchema: { table: z.string(), values: z.record(z.union([z.string(), z.number(), z.boolean()])) },
  }, wrap(async ({ table, values }) => ({ added: (await call('POST', `/tables/${encodeURIComponent(table)}/rows`, { cells: values })).id })));

  server.registerTool('create_table', {
    description: 'Create a game-data table (dev/admin only), e.g. Monsters, Zones, Items. The FIRST column is the row name. Column types: text, number, select (give options), bool. Then fill it with import_rows. Check list_tables first so you do not duplicate an existing table.',
    inputSchema: {
      name: z.string(),
      project: z.string().optional().describe('Project id (needed only if this connection is not pinned to one project; see list_projects)'),
      columns: z.array(z.object({ name: z.string(), type: z.enum(['text', 'number', 'select', 'bool']).optional(), options: z.array(z.string()).optional() })).min(1),
    },
  }, wrap(async ({ name, project: p, columns }) => {
    if (!project && !p && (await call('GET', '/me')).projects.filter((x) => !x.archived).length > 1) throw new Error(ASK + ' Projects: ' + JSON.stringify((await call('GET', '/me')).projects.map((x) => ({ id: x.id, name: x.name }))));
    const t = await call('POST', '/tables', { name, project: p || project || undefined, columns });
    return { id: t.id, name: t.name, columns: t.columns.map((c) => c.name) };
  }));

  server.registerTool('import_rows', {
    description: 'Bulk-add rows to a game-data table (dev/admin only), up to 2000 per call. Use this to copy data you read from the game repo (JSON/CSV/ScriptableObjects/constants) into a table. Keys are column NAMES. Unknown column names are created automatically (numbers detected). replace=true deletes ALL existing rows first, so only use it when the user asked for a full re-sync.',
    inputSchema: { table: z.string(), rows: z.array(z.record(z.union([z.string(), z.number(), z.boolean()]))).min(1).max(2000), replace: z.boolean().optional() },
  }, wrap(async ({ table, rows, replace }) => {
    const t = await call('POST', `/tables/${encodeURIComponent(table)}/import`, { rows, replace: !!replace, create_columns: true });
    return { table: t.id, total_rows: t.rows.length, columns: t.columns.map((c) => `${c.name}:${c.type}`) };
  }));

  const confirmNote = ' Destructive: only do this when the user clearly asked for it; if unsure which table/rows, ASK first.';
  server.registerTool('update_rows', {
    description: 'Edit MANY rows at once (dev/admin only, up to 500, all-or-nothing). Each item: {row, values} with column NAMES as keys. Use for bulk balance changes, e.g. +10% HP on all monsters.',
    inputSchema: { table: z.string(), updates: z.array(z.object({ row: z.string(), values: z.record(z.union([z.string(), z.number(), z.boolean()])) })).min(1).max(500) },
  }, wrap(({ table, updates }) => call('PATCH', `/tables/${encodeURIComponent(table)}/rows`, { updates: updates.map((u) => ({ row: u.row, cells: u.values })) })));

  server.registerTool('delete_rows', {
    description: 'Delete rows from a game-data table by row id (dev/admin only, up to 500). Deleted values stay in the table history, but cannot be restored with a tool.' + confirmNote,
    inputSchema: { table: z.string(), rows: z.array(z.string()).min(1).max(500).describe('Row ids from get_table, e.g. ["r3","r4"]') },
  }, wrap(({ table, rows }) => call('DELETE', `/tables/${encodeURIComponent(table)}/rows`, { rows })));

  server.registerTool('update_table', {
    description: 'Change a table\'s structure (dev/admin only): rename the table, add columns, rename columns, change a column\'s type/options, remove columns, in one call. Existing values are kept when a column is only renamed; type changes convert values where possible; removing a column deletes its values.' + confirmNote,
    inputSchema: {
      table: z.string(),
      name: z.string().optional().describe('New table name'),
      add_columns: z.array(z.object({ name: z.string(), type: z.enum(['text', 'number', 'select', 'bool']).optional(), options: z.array(z.string()).optional() })).optional(),
      rename_columns: z.record(z.string()).optional().describe('{"OldName": "NewName"}'),
      change_columns: z.array(z.object({ name: z.string(), type: z.enum(['text', 'number', 'select', 'bool']).optional(), options: z.array(z.string()).optional() })).optional().describe('Change type/options of existing columns (by current name)'),
      remove_columns: z.array(z.string()).optional(),
    },
  }, wrap(async ({ table, name, add_columns, rename_columns, change_columns, remove_columns }) => {
    const t = await call('GET', `/tables/${encodeURIComponent(table)}`);
    const find = (n) => { const c = t.columns.find((x) => x.name.toLowerCase() === String(n).toLowerCase()); if (!c) throw new Error(`Unknown column "${n}"`); return c; };
    let cols = t.columns.map((c) => ({ ...c }));
    for (const n of remove_columns || []) { const c = find(n); cols = cols.filter((x) => x.id !== c.id); }
    for (const ch of change_columns || []) { const c = cols.find((x) => x.id === find(ch.name).id); if (!c) throw new Error(`Column "${ch.name}" was removed in the same call`); if (ch.type) c.type = ch.type; if (ch.options) c.options = ch.options; }
    for (const [from, to] of Object.entries(rename_columns || {})) { const c = cols.find((x) => x.id === find(from).id); if (!c) throw new Error(`Column "${from}" was removed in the same call`); c.name = to; }
    cols.push(...(add_columns || []).map((c) => ({ name: c.name, type: c.type || 'text', options: c.options })));
    const r = await call('PATCH', `/tables/${encodeURIComponent(table)}`, { ...(name && { name }), columns: cols });
    return { id: r.id, name: r.name, columns: r.columns.map((c) => `${c.name}:${c.type}`), rows: r.rows.length };
  }));

  server.registerTool('delete_table', {
    description: 'Delete a whole game-data table with ALL its rows (ADMIN only; irreversible).' + confirmNote + ' Prefer export first (the user can download CSV/JSON in the web app).',
    inputSchema: { table: z.string(), confirm_name: z.string().describe('Must equal the table name exactly; ask the user to confirm the name') },
  }, wrap(async ({ table, confirm_name }) => {
    const t = await call('GET', `/tables/${encodeURIComponent(table)}`);
    if (t.name !== confirm_name) throw new Error(`confirm_name must equal the table name ("${t.name}"). Ask the user before deleting.`);
    await call('DELETE', `/tables/${encodeURIComponent(table)}`); return { deleted: t.name, rows_lost: t.rows.length };
  }));

  server.registerTool('table_history', {
    description: 'Recent changes of a table (who changed which row/column from → to, imports, deletions). Use to answer "who changed X" or to find a deleted row\'s old values.',
    inputSchema: { table: z.string(), limit: z.number().int().min(1).max(200).optional() },
  }, wrap(async ({ table, limit }) => [...(await call('GET', `/tables/${encodeURIComponent(table)}`)).history].reverse().slice(0, limit || 30)));

  server.registerPrompt('import_game_data', {
    description: 'Scan this game repo for balance data (monsters, items, zones, skills…) and put it into GeckoBoard tables',
    argsSchema: { what: z.string().optional().describe('What to import, e.g. "monster stats" (default: look for balance data)') },
  }, ({ what }) => ({
    messages: [{ role: 'user', content: { type: 'text', text:
      `Find the game's data for: ${what || 'balance data (monsters, items, zones, skills, drops…)'} in this repo (data files, ScriptableObjects, JSON/CSV, constants). ` +
      'First call list_tables so you do not duplicate or overwrite tables. For each group of similar records: create_table with sensible columns (first column = name; use number for stats, select for fixed categories like element/rarity), then import_rows with the real values. ' +
      'Never invent values; skip things you cannot read. Do not use replace unless asked. Finish with a short Thai summary: which tables, how many rows, what you skipped.' } }],
  }));

  // ---- card edit / delete / restore / release / link ----
  server.registerTool('update_card', {
    description: 'Edit a card\'s fields (reporter, owner or admin only): title, description, type, priority, tags (replaces all tags), due (YYYY-MM-DD, "" clears), milestone ("" clears), parent (card id; null makes it top-level). Only the fields you pass change. Use mark_ready_for_test / claim_cards for status changes. If the user did not say exactly what to change, ASK first.',
    inputSchema: {
      id: z.number().int(), title: z.string().optional(), description: z.string().optional(), type: z.enum(['ticket', 'task']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(), tags: z.array(z.string()).optional(),
      due: z.string().optional(), milestone: z.string().optional(), parent: z.number().int().nullable().optional(),
    },
  }, wrap(async ({ id, ...fields }) => withRef(await call('PATCH', `/cards/${id}`, fields))));

  server.registerTool('delete_card', {
    description: 'Delete a card (dev/admin). It goes to the trash and can be restored for 7 days (restore_card); the team is notified on Discord. Sub-cards and links are kept. Only when the user clearly asked; if unsure which card, ASK first.',
    inputSchema: { id: z.number().int(), confirm_title: z.string().describe('The card\'s exact current title (read it with get_card and confirm with the user)') },
  }, wrap(async ({ id, confirm_title }) => {
    const c = await call('GET', `/cards/${id}`);
    if (c.title !== confirm_title) throw new Error(`confirm_title must equal the card title ("${c.title}"). Ask the user before deleting.`);
    await call('DELETE', `/cards/${id}`); return { deleted: id, title: c.title, restorable_days: 7 };
  }));

  server.registerTool('list_trash', {
    description: 'List deleted cards that can still be restored (dev/admin), newest first.',
    inputSchema: {},
  }, wrap(async () => (await call('GET', '/trash')).sort((a, b) => b.deleted_at.localeCompare(a.deleted_at))));

  server.registerTool('restore_card', {
    description: 'Restore a deleted card from the trash (dev/admin). Get ids from list_trash.',
    inputSchema: { id: z.number().int() },
  }, wrap(async ({ id }) => withRef(await call('POST', `/trash/${id}/restore`, {}))));

  server.registerTool('release_card', {
    description: 'Give a card back (un-claim): the owner releases their own card; an admin may pass `email` to release someone else\'s. An in-progress card with no owner goes back to open.',
    inputSchema: { id: z.number().int(), email: z.string().optional().describe('Admin only: whose claim to remove') },
  }, wrap(async ({ id, email }) => withRef(await call('POST', `/cards/${id}/unclaim`, email ? { email } : {}))));

  server.registerTool('link_cards', {
    description: 'Link two cards of the same project as related (two-way), or remove the link with remove=true. For parent/sub-card use update_card parent.',
    inputSchema: { id: z.number().int(), other: z.number().int().describe('Id of the other card'), remove: z.boolean().optional() },
  }, wrap(async ({ id, other, remove }) => withRef(await call('POST', `/cards/${id}/${remove ? 'unlink' : 'link'}`, { id: other }))));

  server.registerPrompt('do_my_cards', {
    description: 'Fix all cards I claimed and mark them ready to test',
  }, () => ({
    messages: [{ role: 'user', content: { type: 'text', text:
      'Use GeckoBoard: list_my_cards, then for each card read it with get_card, implement the fix in this repo, ' +
      'verify it, then call mark_ready_for_test with a short Thai summary and 3-6 short, simple Thai test steps ("ทำ... → ควรเห็น: ...", no code terms). Report what you did per card.' } }],
  }));
  return server;
}
