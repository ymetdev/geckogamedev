// Pure helpers for the Obsidian-style notes (no database access here, so they are easy to test).

export const tkey = (t) => String(t ?? '').toLowerCase().replace(/\.md$/i, '').replace(/\s+/g, ' ').trim();
// Obsidian forbids  [ ] # | ^ \ / : ? * " < >  in note names; we replace them by a space instead of failing
export const cleanTitle = (t) => String(t ?? '').replace(/[\[\]#|^\\/:?*"<>\u0000-\u001f]/g, ' ').replace(/\.md$/i, '').replace(/\s+/g, ' ').trim().slice(0, 120);

const stripCode = (s) => s.replace(/```[\s\S]*?```/g, ' ').replace(/~~~[\s\S]*?~~~/g, ' ').replace(/`[^`\n]*`/g, ' ');

// ---- YAML front matter (the simple subset Obsidian properties use) ----
export function parseFrontmatter(raw) {
  raw = String(raw ?? '').replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const m = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(raw);
  if (!m) return { props: {}, body: raw };
  const props = {}; let last = null;
  for (const line of m[1].split('\n')) {
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && last && Array.isArray(props[last])) { props[last].push(item[1].trim().replace(/^["']|["']$/g, '')); continue; }
    const kv = /^([^\s:#][^:]*):\s*(.*)$/.exec(line); if (!kv) continue;
    const k = kv[1].trim(); let v = kv[2].trim(); last = k;
    if (v === '') { props[k] = []; continue; }
    if (/^\[.*\]$/.test(v)) props[k] = v.slice(1, -1).split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    else props[k] = v.replace(/^["']|["']$/g, '');
  }
  for (const k of Object.keys(props)) if (Array.isArray(props[k]) && props[k].length === 0 && k !== 'tags') props[k] = '';
  return { props, body: raw.slice(m[0].length) };
}
export function serializeFrontmatter(props) {
  const ks = Object.keys(props || {}); if (!ks.length) return '';
  return '---\n' + ks.map((k) => `${k}: ${Array.isArray(props[k]) ? '[' + props[k].join(', ') + ']' : props[k]}`).join('\n') + '\n---\n\n';
}

// ---- [[wiki links]] ----
export function extractLinks(body) {
  const out = []; const re = /(!?)\[\[([^\[\]\n|#]+?)(?:#([^\[\]\n|]*))?(?:\|([^\[\]\n]*))?\]\]/g; const s = stripCode(String(body ?? '')).replace(/(\[\[[^\[\]\n]*?)\\\|/g, '$1|'); // \| is an escaped pipe inside table cells
  for (const m of s.matchAll(re)) out.push({ embed: !!m[1], target: m[2].trim(), anchor: m[3] || '', alias: m[4] || '' });
  return out;
}
export function renameLinks(body, oldTitle, newTitle) {
  const ok = tkey(oldTitle);
  return String(body).replace(/(!?\[\[)([^\[\]\n|#]+?)((?:#[^\[\]\n|]*)?(?:\|[^\[\]\n]*)?\]\])/g, (all, a, t, rest) => (tkey(t) === ok ? a + newTitle + rest : all));
}

// ---- #tags ----
export function extractTags(body, props = {}) {
  const set = new Set();
  const add = (t) => { t = String(t || '').trim().replace(/^#/, '').replace(/\/+$/, '').toLowerCase(); if (t && /\p{L}/u.test(t) && !t.split('/').every((x) => /^[0-9a-f]{3,8}$/i.test(x))) set.add(t); };
  const pt = props.tags ?? props.tag; for (const t of Array.isArray(pt) ? pt : String(pt || '').split(/[,\s]+/)) add(t);
  const s = stripCode(String(body ?? '')).replace(/\[\[[^\]]*\]\]/g, ' ').replace(/\]\([^)]*\)/g, ' ');
  for (const m of s.matchAll(/(?:^|[\s(>])#([\p{L}\p{N}_\-\/]+)/gu)) add(m[1]);
  return [...set].slice(0, 30);
}

export function snippetAround(body, q, n = 70) {
  const s = String(body ?? '').replace(/\s+/g, ' '); const i = s.toLowerCase().indexOf(String(q).toLowerCase());
  if (i < 0) return s.slice(0, n * 2);
  return (i > n ? '…' : '') + s.slice(Math.max(0, i - n), i + q.length + n) + (i + q.length + n < s.length ? '…' : '');
}
// the line that contains a link to `title` (shown in the backlinks list)
export function linkContext(body, matchTargetKey) {
  for (const line of String(body ?? '').split('\n')) {
    for (const l of extractLinks(line)) if (tkey(l.target) === matchTargetKey) return line.replace(/\s+/g, ' ').trim().slice(0, 200);
  }
  return '';
}

export const CARD_REF = /^([A-Za-z0-9]{2,8})-(\d+)$/;
