// GeckoBoard — force-directed graph view (canvas): pan / zoom / drag, hover highlight, local graph, glow. No libraries.
(function (g) {
  const TAU = Math.PI * 2;
  const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const hsl = (h, a) => `hsl(${h} 74% 64% / ${a})`;

  class Graph {
    constructor(canvas, cb = {}) {
      this.c = canvas; this.ctx = canvas.getContext('2d'); this.cb = cb;
      this.all = { nodes: [], edges: [] }; this.nodes = []; this.edges = []; this.byId = new Map(); this.pos = new Map(); this.legend = [];
      this.o = { cards: true, ghosts: true, tags: false, labels: true, focus: '', depth: 2, filter: '', repel: 1, dist: 1, size: 1 };
      this.k = 1; this.px = 0; this.py = 0; this.alpha = 1; this.hover = null; this.sel = null; this.drag = null; this.pan = null; this.ptrs = new Map();
      this.raf = 0; this.running = false; this.dpr = Math.min(2, window.devicePixelRatio || 1); this.moved = 0; this.W = 0; this.H = 0;
      this._bind(); this.resize();
    }
    _bind() {
      const c = this.c;
      this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(c.parentElement || c);
      c.addEventListener('pointerdown', (e) => this._down(e)); c.addEventListener('pointermove', (e) => this._move(e));
      c.addEventListener('pointerup', (e) => this._up(e)); c.addEventListener('pointercancel', (e) => this._up(e));
      c.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))); }, { passive: false });
      c.addEventListener('dblclick', (e) => { const n = this._hit(e.offsetX, e.offsetY); if (n) this.cb.onOpen?.(n); });
      c.style.touchAction = 'none'; c.style.cursor = 'grab';
    }
    destroy() { this.stop(); this._ro?.disconnect(); }
    resize() {
      const p = this.c.parentElement || this.c, w = Math.max(100, p.clientWidth), h = Math.max(100, p.clientHeight);
      if (w === this.W && h === this.H) return;
      this.W = w; this.H = h; this.c.width = Math.round(w * this.dpr); this.c.height = Math.round(h * this.dpr); this.c.style.width = w + 'px'; this.c.style.height = h + 'px';
      if (!this._fitted && this.nodes.length) this.fit(false); this.kick(); this.draw();
    }
    // ---- data ----
    setData(data) { this.all = data; this._rebuild(true); }
    set(opts) { const rebuild = ['cards', 'ghosts', 'tags', 'focus', 'depth'].some((k) => k in opts && opts[k] !== this.o[k]); Object.assign(this.o, opts); if (rebuild) this._rebuild(false); this.alpha = Math.max(this.alpha, 0.3); this.kick(); this.draw(); }
    _rebuild(first) {
      for (const n of this.nodes) this.pos.set(n.id, { x: n.x, y: n.y }); // keep positions across rebuilds
      const o = this.o, keepType = (n) => n.type === 'note' || (n.type === 'card' && o.cards) || (n.type === 'ghost' && o.ghosts) || (n.type === 'tag' && o.tags);
      let list = this.all.nodes.filter(keepType); const ids = new Set(list.map((n) => n.id));
      let edges = this.all.edges.filter((e) => ids.has(e.s) && ids.has(e.t) && (e.kind !== 'tag' || o.tags));
      if (o.focus && ids.has(o.focus)) { // local graph: everything within `depth` steps of the focus note
        const adj = new Map(); for (const e of edges) { (adj.get(e.s) || adj.set(e.s, []).get(e.s)).push(e.t); (adj.get(e.t) || adj.set(e.t, []).get(e.t)).push(e.s); }
        const seen = new Map([[o.focus, 0]]); const q = [o.focus];
        while (q.length) { const id = q.shift(), d = seen.get(id); if (d >= o.depth) continue; for (const nb of adj.get(id) || []) if (!seen.has(nb)) { seen.set(nb, d + 1); q.push(nb); } }
        list = list.filter((n) => seen.has(n.id)); const keep = new Set(list.map((n) => n.id)); edges = edges.filter((e) => keep.has(e.s) && keep.has(e.t));
      }
      const deg = new Map(); for (const e of edges) { deg.set(e.s, (deg.get(e.s) || 0) + 1); deg.set(e.t, (deg.get(e.t) || 0) + 1); }
      const tf = new Map(); let nn = 0; for (const n of list) if (n.type === 'note') { nn++; for (const tg of n.tags || []) tf.set(tg, (tf.get(tg) || 0) + 1); }
      const pick = (n) => { // the tag that tells notes apart: most frequent one that is not on (almost) every note; prefer tags shared by 2+ notes
        const c = (n.tags || []).filter((x) => tf.get(x) < Math.max(2, nn * 0.9)).sort((a, b) => tf.get(b) - tf.get(a));
        return c.find((x) => tf.get(x) >= 2) || c[0] || (n.tags || [])[0] || (n.folder || '').split('/')[0] || '';
      };
      const R = 90 + Math.sqrt(list.length) * 60, now = performance.now();
      this.nodes = list.map((n, i) => {
        const p = this.pos.get(n.id), a = (i / Math.max(1, list.length)) * TAU * 3.7, r0 = Math.sqrt(i / Math.max(1, list.length)) * R;
        const grp = n.type === 'note' ? pick(n) : n.type;
        return { ...n, x: p ? p.x : Math.cos(a) * r0, y: p ? p.y : Math.sin(a) * r0, vx: 0, vy: 0, deg: deg.get(n.id) || 0, grp, born: p ? now - 9999 : now + i * 12 };
      });
      this.byId = new Map(this.nodes.map((n) => [n.id, n]));
      this.edges = edges.map((e) => ({ a: this.byId.get(e.s), b: this.byId.get(e.t), kind: e.kind })).filter((e) => e.a && e.b);
      for (const n of this.nodes) n.nb = new Set();
      for (const e of this.edges) { e.a.nb.add(e.b); e.b.nb.add(e.a); }
      this.hover = null; if (this.sel) this.sel = this.byId.get(this.sel.id) || null;
      const cnt = new Map(); for (const n of this.nodes) if (n.type === 'note' && n.grp) cnt.set(n.grp, (cnt.get(n.grp) || 0) + 1);
      this.legend = [...cnt].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, c]) => ({ group: k, count: c, color: this.color({ type: 'note', grp: k }) }));
      this.alpha = 1; if (first) this._fitted = false; if (!this._fitted && this.W) { for (let i = 0; i < 80; i++) this._tick(); this.fit(false); } this.kick(); this.draw();
    }
    radius(n) { const b = n.type === 'note' ? 5.5 : n.type === 'card' ? 5 : n.type === 'tag' ? 4 : 3.6; return (b + Math.sqrt(n.deg) * 2.3) * this.o.size; }
    color(n) { if (n.type === 'card') return '#f5c451'; if (n.type === 'tag') return '#ff7ab6'; if (n.type === 'ghost') return '#7e879b'; return hsl(hash(n.grp || 'x') % 360, 1); }
    // ---- simulation ----
    _tick() {
      const ns = this.nodes, n = ns.length, a = this.alpha, rep = 3200 * this.o.repel, L = 96 * this.o.dist;
      for (let i = 0; i < n; i++) {
        const p = ns[i];
        for (let j = i + 1; j < n; j++) {
          const q = ns[j]; let dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy; if (d2 > 1440000) continue; if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
          const f = (rep * a) / d2, d = Math.sqrt(d2), fx = (dx / d) * f, fy = (dy / d) * f; p.vx += fx; p.vy += fy; q.vx -= fx; q.vy -= fy;
        }
      }
      for (const e of this.edges) {
        const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, len = L + (this.radius(e.a) + this.radius(e.b)) * 0.8, f = ((d - len) / d) * 0.045 * (0.3 + a);
        e.a.vx += dx * f; e.a.vy += dy * f; e.b.vx -= dx * f; e.b.vy -= dy * f;
      }
      for (const p of ns) {
        p.vx -= p.x * 0.006; p.vy -= p.y * 0.006; // gentle gravity keeps islands on screen
        if (p === this.drag) { p.x = p.fx; p.y = p.fy; p.vx = p.vy = 0; continue; }
        p.vx *= 0.6; p.vy *= 0.6; p.x += p.vx; p.y += p.vy;
      }
      this.alpha += (0 - this.alpha) * 0.022;
    }
    // ---- drawing ----
    kick() { if (this.running && !this.raf) this.raf = requestAnimationFrame((t) => this._frame(t)); }
    start() { this.running = true; this.kick(); }
    stop() { this.running = false; if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
    _frame(t) {
      this.raf = 0; if (!this.running) return;
      let steps = this.alpha > 0.02 ? (this.nodes.length > 400 ? 1 : 2) : 0; while (steps--) this._tick();
      const animating = this.alpha > 0.02 || this.nodes.some((n) => t - n.born < 700) || this.drag || this._fly;
      this.draw(t); if (animating) this.raf = requestAnimationFrame((tt) => this._frame(tt));
    }
    draw(t = performance.now()) {
      const ctx = this.ctx, W = this.W, H = this.H; if (!W) return; ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7); bg.addColorStop(0, '#12162a'); bg.addColorStop(1, '#090b12'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      if (this._fly) { const f = this._fly, p = Math.min(1, (t - f.t0) / f.dur), e = 1 - Math.pow(1 - p, 3); this.k = f.k0 + (f.k1 - f.k0) * e; this.px = f.x0 + (f.x1 - f.x0) * e; this.py = f.y0 + (f.y1 - f.y0) * e; if (p >= 1) this._fly = null; }
      ctx.save(); ctx.translate(this.px, this.py); ctx.scale(this.k, this.k);
      const act = this.hover || this.sel, hl = act ? new Set([act, ...act.nb]) : null, q = this.o.filter.trim().toLowerCase(), match = (n) => !q || n.title.toLowerCase().includes(q);
      ctx.lineCap = 'round';
      for (const e of this.edges) {
        const on = hl && (e.a === act || e.b === act), dim = (hl && !on) || (q && !(match(e.a) || match(e.b)));
        ctx.strokeStyle = on ? 'rgba(190,205,255,.85)' : e.kind === 'tag' ? `rgba(255,122,182,${dim ? 0.03 : 0.13})` : `rgba(150,165,235,${dim ? 0.05 : 0.24})`;
        ctx.lineWidth = (on ? 1.8 : 1) / Math.max(this.k, 0.5); ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); ctx.stroke();
      }
      const labels = [];
      const degs = this.nodes.map((n) => n.deg).sort((a, b) => b - a), top = degs[Math.min(degs.length - 1, Math.floor(degs.length * 0.18))] || 0;
      for (const n of this.nodes) {
        const age = (t - n.born) / 600; if (age < 0) continue; const s = age >= 1 ? 1 : Math.max(0.01, easeOutBack(age)), r = this.radius(n) * s;
        const nbHit = hl && hl.has(n), dim = (hl && !nbHit) || (q && !match(n)), isAct = n === act, hue = hash(n.grp || 'x') % 360;
        ctx.globalAlpha = dim ? 0.16 : 1;
        if (n.type === 'ghost') { ctx.strokeStyle = '#8b93ab'; ctx.lineWidth = 1.4 / this.k; ctx.setLineDash([3 / this.k, 3 / this.k]); ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
        else {
          if (n.type === 'note') { const R = r * (isAct ? 4.2 : 3), gl = ctx.createRadialGradient(n.x, n.y, r * 0.3, n.x, n.y, R); gl.addColorStop(0, hsl(hue, 0.4)); gl.addColorStop(1, hsl(hue, 0)); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(n.x, n.y, R, 0, TAU); ctx.fill(); }
          ctx.fillStyle = this.color(n); ctx.beginPath();
          if (n.type === 'card') { ctx.save(); ctx.translate(n.x, n.y); ctx.rotate(Math.PI / 4); ctx.rect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7); ctx.restore(); } else ctx.arc(n.x, n.y, r, 0, TAU);
          ctx.fill(); ctx.strokeStyle = isAct ? '#fff' : 'rgba(255,255,255,.35)'; ctx.lineWidth = (isAct ? 2 : 0.8) / this.k; ctx.stroke();
        }
        if (this.o.labels && (this.k > 0.45 || isAct || nbHit || (q && match(n)))) labels.push({ n, r, dim, isAct, nbHit, pri: (isAct ? 1e6 : 0) + (nbHit ? 1e5 : 0) + (q && match(n) ? 1e4 : 0) + n.deg });
        ctx.globalAlpha = 1;
      }
      // labels: most important first, skip the ones that would overlap an already drawn label
      const fs = Math.max(this.k, 0.45), placed = []; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (const L of labels.sort((a, b) => b.pri - a.pri)) {
        const { n, r, dim, isAct, nbHit } = L, size = (isAct ? 13 : 11.5) / fs; ctx.font = `${size}px Inter, "Noto Sans Thai", system-ui, sans-serif`;
        const lab = n.title.length > 34 ? n.title.slice(0, 33) + '…' : n.title, w = ctx.measureText(lab).width, box = { x: n.x - w / 2 - 3 / fs, y: n.y + r + 2, w: w + 6 / fs, h: size + 4 / fs };
        if (!(isAct || nbHit) && placed.some((p) => box.x < p.x + p.w && box.x + box.w > p.x && box.y < p.y + p.h && box.y + box.h > p.y)) continue;
        placed.push(box); ctx.globalAlpha = dim ? 0.2 : isAct || nbHit ? 1 : 0.88; ctx.lineWidth = 3 / fs; ctx.strokeStyle = 'rgba(9,11,18,.85)'; ctx.strokeText(lab, n.x, n.y + r + 3); ctx.fillStyle = isAct ? '#fff' : '#cdd3ea'; ctx.fillText(lab, n.x, n.y + r + 3);
      }
      ctx.globalAlpha = 1; ctx.restore();
    }
    // ---- view control ----
    fit(animate = true) {
      if (!this.nodes.length || !this.W) return; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const n of this.nodes) { x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y); }
      const w = Math.max(60, x1 - x0), h = Math.max(60, y1 - y0), k = Math.min(2.2, Math.min((this.W - 120) / w, (this.H - 120) / h)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const to = { k, x: this.W / 2 - cx * k, y: this.H / 2 - cy * k }; this._fitted = true;
      if (animate) this._fly = { t0: performance.now(), dur: 450, k0: this.k, k1: to.k, x0: this.px, x1: to.x, y0: this.py, y1: to.y }; else { this.k = to.k; this.px = to.x; this.py = to.y; }
      this.kick(); this.draw();
    }
    zoomAt(sx, sy, f) { const k = Math.max(0.15, Math.min(4, this.k * f)), r = k / this.k; this.px = sx - (sx - this.px) * r; this.py = sy - (sy - this.py) * r; this.k = k; this._fly = null; this.draw(); }
    zoomBy(f) { this.zoomAt(this.W / 2, this.H / 2, f); }
    select(id) { this.sel = this.byId.get(id) || null; this.draw(); }
    // ---- pointer ----
    _w(sx, sy) { return { x: (sx - this.px) / this.k, y: (sy - this.py) / this.k }; }
    _hit(sx, sy) { const p = this._w(sx, sy); for (let i = this.nodes.length - 1; i >= 0; i--) { const n = this.nodes[i], r = this.radius(n) + 5 / this.k; if ((n.x - p.x) ** 2 + (n.y - p.y) ** 2 <= r * r) return n; } return null; }
    _down(e) {
      this.c.setPointerCapture?.(e.pointerId); this.ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); this.moved = 0; this._fly = null;
      if (this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: this.k }; this.drag = null; this.pan = null; return; }
      const n = this._hit(e.offsetX, e.offsetY);
      if (n) { const p = this._w(e.offsetX, e.offsetY); this.drag = n; n.fx = p.x; n.fy = p.y; this.alpha = Math.max(this.alpha, 0.3); } else { this.pan = { x: e.offsetX - this.px, y: e.offsetY - this.py }; this.c.style.cursor = 'grabbing'; }
      this.kick();
    }
    _move(e) {
      const prev = this.ptrs.get(e.pointerId); if (prev) { this.moved += Math.abs(e.offsetX - prev.x) + Math.abs(e.offsetY - prev.y); prev.x = e.offsetX; prev.y = e.offsetY; }
      if (this.pinch && this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; const k = Math.max(0.15, Math.min(4, this.pinch.k * Math.hypot(a.x - b.x, a.y - b.y) / this.pinch.d)); const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, r = k / this.k; this.px = mx - (mx - this.px) * r; this.py = my - (my - this.py) * r; this.k = k; this.draw(); return; }
      if (this.drag) { const p = this._w(e.offsetX, e.offsetY); this.drag.fx = p.x; this.drag.fy = p.y; this.alpha = Math.max(this.alpha, 0.2); this.kick(); return; }
      if (this.pan) { this.px = e.offsetX - this.pan.x; this.py = e.offsetY - this.pan.y; this.draw(); return; }
      const h = this._hit(e.offsetX, e.offsetY); if (h !== this.hover) { this.hover = h; this.c.style.cursor = h ? 'pointer' : 'grab'; this.cb.onHover?.(h, e); this.draw(); }
    }
    _up(e) {
      this.ptrs.delete(e.pointerId); if (this.ptrs.size < 2) this.pinch = null; this.c.style.cursor = 'grab';
      if (this.moved < 5 && !this.pinch) { const n = this.drag || this._hit(e.offsetX, e.offsetY); this.sel = n || null; this.cb.onSelect?.(n || null); }
      this.drag = null; this.pan = null; this.kick(); this.draw();
    }
  }
  g.GBGraph = Graph;
})(globalThis);
