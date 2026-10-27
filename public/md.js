// GeckoBoard — tiny, safe Markdown renderer for the notes (Obsidian flavour: [[links]], #tags, callouts, tables, task lists, ==highlight==).
// Everything is HTML-escaped first; only the tags generated here ever reach the page.
(function (g) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const HEX = /^#[0-9a-fA-F]{6}$/;
  const swatch = (hex) => `<span class="hex"><i style="background:${hex}"></i>${hex}</span>`;
  const CALLOUT = { note: '📝', info: 'ℹ️', tip: '💡', hint: '💡', important: '❗', warning: '⚠️', caution: '⚠️', danger: '⛔', error: '⛔', bug: '🐞', example: '🧪', quote: '❝', question: '❓', success: '✅', check: '✅', todo: '☑️', abstract: '📋', summary: '📋', failure: '❌' };

  function inline(src, ctx) {
    const store = []; const keep = (html) => { store.push(html); return `\u0000${store.length - 1}\u0000`; };
    let s = String(src);
    s = s.replace(/`([^`\n]+)`/g, (_, c) => keep(HEX.test(c) ? swatch(c) : `<code>${esc(c)}</code>`));
    s = s.replace(/(!?)\[\[([^\[\]\n|#]+?)(?:#([^\[\]\n|]*))?(?:\|([^\[\]\n]*))?\]\]/g, (_, bang, target, anchor, alias) => keep(ctx.wikilink(target.trim(), anchor || '', alias || '', !!bang)));
    s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, (_, text, url) => keep(`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${inline(text, ctx)}</a>`));
    s = esc(s);
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^\w])__(.+?)__(?!\w)/g, '$1<strong>$2</strong>');
    s = s.replace(/(^|[^*\w])\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, '$1<em>$2</em>').replace(/(^|[^\w])_(?!\s)(.+?)(?<!\s)_(?!\w)/g, '$1<em>$2</em>');
    s = s.replace(/~~(.+?)~~/g, '<del>$1</del>').replace(/==(.+?)==/g, '<mark>$1</mark>');
    s = s.replace(/(^|[\s(>])#([\p{L}\p{N}_\-\/]+)/gu, (all, pre, tag) => (/\p{L}/u.test(tag) && !tag.split('/').every((x) => /^[0-9a-f]{3,8}$/i.test(x)) ? `${pre}<a class="tagchip" data-tag="${tag.toLowerCase()}">#${tag}</a>` : all));
    s = s.replace(/(^|[^\w&])(#[0-9a-fA-F]{6})(?![\w])/g, (_, pre, hex) => pre + swatch(hex));
    for (let i = 0; i < 4 && /\u0000\d+\u0000/.test(s); i++) s = s.replace(/\u0000(\d+)\u0000/g, (_, n) => store[+n]);
    return s;
  }

  const splitRow = (l) => { l = l.trim().replace(/^\|/, '').replace(/\|$/, ''); const cells = []; let cur = ''; for (let i = 0; i < l.length; i++) { if (l[i] === '\\' && l[i + 1] === '|') { cur += '|'; i++; } else if (l[i] === '|') { cells.push(cur.trim()); cur = ''; } else cur += l[i]; } cells.push(cur.trim()); return cells; };
  const isSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l) && l.includes('-');
  const ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

  function blocks(src, ctx) {
    const lines = String(src).replace(/\r\n?/g, '\n').split('\n'); const out = []; const para = []; let i = 0;
    const flush = () => { if (para.length) { out.push('<p>' + para.map((l) => inline(l, ctx)).join('<br>') + '</p>'); para.length = 0; } };
    while (i < lines.length) {
      const line = lines[i]; let m;
      if ((m = /^\s*(```|~~~)\s*([\w-]*)/.exec(line))) {
        flush(); const fence = m[1], buf = []; i++;
        while (i < lines.length && !lines[i].trim().startsWith(fence)) buf.push(lines[i++]); i++;
        out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue;
      }
      if (!line.trim()) { flush(); i++; continue; }
      if ((m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line))) { flush(); out.push(`<h${m[1].length}>${inline(m[2], ctx)}</h${m[1].length}>`); i++; continue; }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); out.push('<hr>'); i++; continue; }
      if (/^\s*>/.test(line)) {
        flush(); const buf = []; while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
        const co = /^\[!(\w+)\][+-]?\s*(.*)$/.exec(buf[0] || '');
        if (co) { const type = co[1].toLowerCase(); out.push(`<div class="callout c-${esc(type)}"><div class="ct"><span>${CALLOUT[type] || '📌'}</span>${inline(co[2] || type[0].toUpperCase() + type.slice(1), ctx)}</div><div class="cb">${blocks(buf.slice(1).join('\n'), ctx)}</div></div>`); }
        else out.push(`<blockquote>${blocks(buf.join('\n'), ctx)}</blockquote>`);
        continue;
      }
      if (line.includes('|') && i + 1 < lines.length && isSep(lines[i + 1])) {
        flush(); const head = splitRow(line), al = splitRow(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : '')); i += 2; const rows = [];
        while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(splitRow(lines[i++]));
        const td = (t, c, k) => `<${t}${al[k] ? ` style="text-align:${al[k]}"` : ''}>${inline(c || '', ctx)}</${t}>`;
        out.push(`<div class="tbl"><table><thead><tr>${head.map((c, k) => td('th', c, k)).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${head.map((_, k) => td('td', r[k], k)).join('')}</tr>`).join('')}</tbody></table></div>`); continue;
      }
      if ((m = ITEM.exec(line))) {
        flush(); const items = [];
        while (i < lines.length && lines[i].trim()) { const im = ITEM.exec(lines[i]); if (im) items.push({ indent: im[1].replace(/\t/g, '    ').length, ordered: /\d/.test(im[2]), text: im[3] }); else if (items.length && /^\s+\S/.test(lines[i])) items.at(-1).text += ' ' + lines[i].trim(); else break; i++; }
        let html = ''; const stack = [];
        for (const it of items) {
          while (stack.length && it.indent < stack.at(-1).indent) html += `</li></${stack.pop().tag}>`;
          let top = stack.at(-1);
          if (top && it.indent === top.indent && top.tag !== (it.ordered ? 'ol' : 'ul')) { html += `</li></${stack.pop().tag}>`; top = stack.at(-1); }
          if (!top || it.indent > top.indent) { const tag = it.ordered ? 'ol' : 'ul'; html += `<${tag}>`; stack.push({ indent: it.indent, tag }); } else html += '</li>';
          const tk = /^\[([ xX])\]\s+(.*)$/.exec(it.text);
          html += tk ? `<li class="task"><input type="checkbox" disabled ${tk[1] !== ' ' ? 'checked' : ''}> ${inline(tk[2], ctx)}` : `<li>${inline(it.text, ctx)}`;
        }
        while (stack.length) html += `</li></${stack.pop().tag}>`;
        out.push(html); continue;
      }
      para.push(line.trim()); i++;
    }
    flush(); return out.join('\n');
  }
  g.GBMD = { render: blocks, inline, esc };
})(globalThis);
