#!/usr/bin/env node
// Optional stdio launcher (the web app already serves MCP over HTTP at /mcp; prefer that).
// Env: GECKOBOARD_URL (default http://localhost:3000), GECKOBOARD_TOKEN (personal token from the web app)
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './tools.js';

const base = process.env.GECKOBOARD_URL || process.env.DEVBOARD_URL || 'http://localhost:3000';
const token = process.env.GECKOBOARD_TOKEN || process.env.DEVBOARD_TOKEN || '';
if (!token) { console.error('GECKOBOARD_TOKEN is required (copy it from the web app profile menu)'); process.exit(1); }

const project = process.env.GECKOBOARD_PROJECT || '';
await createServer({ base, token, project }).connect(new StdioServerTransport());
