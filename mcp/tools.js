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
    },
  }, wrap((a) => call('POST', '/cards', a).then(withRef)));

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

  server.registerPrompt('do_my_cards', {
    description: 'Fix all cards I claimed and mark them ready to test',
  }, () => ({
    messages: [{ role: 'user', content: { type: 'text', text:
      'Use GeckoBoard: list_my_cards, then for each card read it with get_card, implement the fix in this repo, ' +
      'verify it, then call mark_ready_for_test with a short Thai summary and 3-6 short, simple Thai test steps ("ทำ... → ควรเห็น: ...", no code terms). Report what you did per card.' } }],
  }));
  return server;
}
