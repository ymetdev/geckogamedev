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

export function createServer({ base, token }) {
  async function call(method, path, body) {
    const res = await fetch(base.replace(/\/$/, '') + '/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-devboard-token': token },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }
  const server = new McpServer({ name: 'geckoboard', version: '1.0.0' }, {
    instructions:
      'GeckoBoard tracks game-team Tickets (bug reports/requests) and Tasks. The dev marks cards they will do ' +
      '(status in_progress, assigned to them). When asked to work on their cards: call list_my_cards, then get_card ' +
      'for details (use get_attachment to look at screenshots on the card), fix the code in the repo, verify as far as you can, and ONLY THEN call mark_ready_for_test with a ' +
      'summary and clear step-by-step manual test instructions for the tester. Never mark ready if the fix is unfinished.',
  });

  server.registerTool('list_my_cards', {
    description: 'List cards the current dev claimed (default: in_progress). Use this when the user says "do my tasks".',
    inputSchema: { status: z.enum(['open', 'in_progress', 'ready_to_test', 'complete']).optional().describe('Default in_progress') },
  }, wrap(async ({ status }) => (await call('GET', `/cards?assignee=${encodeURIComponent((await call('GET', '/me')).email)}&status=${status || 'in_progress'}`)).map(brief)));

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
    return (await call('GET', `/cards?${q}`)).map(brief);
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
      try { out.push(brief(await call('POST', `/cards/${id}/claim`, {}))); }
      catch (e) { out.push({ id, error: e.message }); } // e.g. "Already claimed by Smart": report, keep going
    }
    return out;
  }));

  server.registerTool('mark_ready_for_test', {
    description:
      'After the fix is DONE and verified, set the card to Ready to Test. Must include a short summary of what changed ' +
      'and concrete manual test steps a (non-programmer) tester can follow, including expected results.',
    inputSchema: {
      id: z.number().int(),
      summary: z.string().describe('What was changed / root cause, 1-4 sentences'),
      test_steps: z.array(z.string()).min(1).describe('Ordered manual steps, each ending with the expected result where relevant'),
    },
  }, wrap(async ({ id, summary, test_steps }) => brief(await call('POST', `/cards/${id}/ready`, { summary, test_steps }))));

  server.registerTool('add_comment', {
    description: 'Add a progress note/question to a card (e.g. when blocked or needs info).',
    inputSchema: { id: z.number().int(), text: z.string() },
  }, wrap(({ id, text }) => call('POST', `/cards/${id}/comment`, { text }).then(brief)));

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
  }, wrap((a) => call('POST', '/cards', a).then(brief)));

  server.registerPrompt('do_my_cards', {
    description: 'Fix all cards I claimed and mark them ready to test',
  }, () => ({
    messages: [{ role: 'user', content: { type: 'text', text:
      'Use GeckoBoard: list_my_cards, then for each card read it with get_card, implement the fix in this repo, ' +
      'verify it, then call mark_ready_for_test with a summary and clear tester steps. Report what you did per card.' } }],
  }));
  return server;
}
