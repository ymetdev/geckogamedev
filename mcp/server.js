#!/usr/bin/env node
// GeckoBoard MCP server (stdio). Each dev runs it with their own Claude.
// Env: GECKOBOARD_URL (default http://localhost:3000), GECKOBOARD_TOKEN (your personal token from the web app: Profile → MCP token)
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE = (process.env.GECKOBOARD_URL || process.env.DEVBOARD_URL || 'http://localhost:3000').replace(/\/$/, '');
const TOKEN = process.env.GECKOBOARD_TOKEN || process.env.DEVBOARD_TOKEN || '';

async function call(method, path, body) {
  const res = await fetch(BASE + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-devboard-token': TOKEN },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
const text = (t) => ({ content: [{ type: 'text', text: typeof t === 'string' ? t : JSON.stringify(t, null, 2) }] });
const fail = (e) => ({ isError: true, content: [{ type: 'text', text: `Error: ${e.message}` }] });
const wrap = (fn) => async (args) => { try { return text(await fn(args)); } catch (e) { return fail(e); } };
const brief = (c) => ({
  id: c.id, type: c.type, title: c.title, priority: c.priority, status: c.status,
  assignees: c.assignees, tags: c.tags,
});

if (!TOKEN) { console.error('GECKOBOARD_TOKEN is required (copy it from the web app profile menu)'); process.exit(1); }

const server = new McpServer({ name: 'geckoboard', version: '1.0.0' }, {
  instructions:
    'GeckoBoard tracks game-team Tickets (bug reports/requests) and Tasks. The dev marks cards they will do ' +
    '(status in_progress, assigned to them). When asked to work on their cards: call list_my_cards, then get_card ' +
    'for details, fix the code in the repo, verify as far as you can, and ONLY THEN call mark_ready_for_test with a ' +
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

server.registerTool('create_card', {
  description: 'Create a new ticket or task (e.g. a follow-up bug found while fixing).',
  inputSchema: {
    type: z.enum(['ticket', 'task']),
    title: z.string(),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  },
}, wrap((a) => call('POST', '/cards', a).then(brief)));

server.registerPrompt('do_my_cards', {
  description: 'Fix all cards I claimed and mark them ready to test',
}, () => ({
  messages: [{ role: 'user', content: { type: 'text', text:
    'Use GeckoBoard: list_my_cards, then for each card read it with get_card, implement the fix in this repo, ' +
    'verify it, then call mark_ready_for_test with a summary and clear tester steps. Report what you did per card.' } }],
}));

await server.connect(new StdioServerTransport());
