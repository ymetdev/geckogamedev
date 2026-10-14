// GeckoBoard — eye candy: cards fly between columns when their status changes, little celebrations / warnings, calm aurora background.
// Pure visuals (transform/opacity only). Toggle in the profile menu; off automatically with "reduce motion". Loaded after app.js.
Object.assign(I18N.en, { fx_on: '✨ Effects: on', fx_off: '✨ Effects: off', fx_reduced: '✨ Effects off (reduced motion)' });
Object.assign(I18N.th, { fx_on: '✨ เอฟเฟกต์: เปิด', fx_off: '✨ เอฟเฟกต์: ปิด', fx_reduced: '✨ เอฟเฟกต์ปิด (ระบบตั้งค่าลดการเคลื่อนไหว)' });

const FX_KEY = 'geckoboard.fx', fxReduce = matchMedia('(prefers-reduced-motion: reduce)');
let fxPref = null; try { fxPref = localStorage.getItem(FX_KEY); } catch { /* storage blocked */ }
const fxOn = () => !fxReduce.matches && fxPref !== 'off';
const fxLabel = () => (fxReduce.matches ? t('fx_reduced') : t(fxOn() ? 'fx_on' : 'fx_off'));
function fxApply() {
  document.documentElement.classList.toggle('fx', fxOn());
  if (fxOn() && !$('#fxBg')) { const bg = document.createElement('div'); bg.id = 'fxBg'; bg.innerHTML = '<i></i><i></i><i></i>'; document.body.appendChild(bg); }
}
function fxToggle() { if (fxReduce.matches) return; fxPref = fxOn() ? 'off' : 'on'; try { localStorage.setItem(FX_KEY, fxPref); } catch { /* ignore */ } fxApply(); if (user) renderUserBox(); }
document.addEventListener('visibilitychange', () => document.documentElement.classList.toggle('fx-paused', document.hidden));
fxReduce.addEventListener?.('change', fxApply);

// how many screen px one CSS px of the page is (differs from 1 on the zoomed portrait layout)
function fxK() {
  const p = document.createElement('div'); p.style.cssText = 'position:fixed;left:0;top:0;width:10px;height:10px;transform:translate(100px,0);visibility:hidden';
  document.body.appendChild(p); const k = p.getBoundingClientRect().left / 100; p.remove(); return k > 0 ? k : 1;
}
let fxLayerEl; const fxLayer = () => fxLayerEl || (fxLayerEl = Object.assign(document.createElement('div'), { id: 'fxLayer' }), document.documentElement.appendChild(fxLayerEl), fxLayerEl);

function fxBefore() { // positions of the cards on screen right now
  if (!fxOn() || document.hidden) return null;
  const m = new Map();
  for (const el of $$('.card[data-id]')) { const r = el.getBoundingClientRect(); if (r.width) m.set(+el.dataset.id, { x: r.left, y: r.top, w: r.width }); }
  return m;
}
function fxSparks(r, color, n = 14) {
  const L = fxLayer(), cx = r.left + r.width / 2, cy = r.top + Math.min(r.height / 2, 40);
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i'); s.className = 'fx-spark'; s.style.cssText = `left:${cx}px;top:${cy}px;background:${color};box-shadow:0 0 8px ${color}`;
    L.appendChild(s);
    const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 90;
    s.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 30}px)) scale(.2)`, opacity: 0 }], { duration: 700 + Math.random() * 500, easing: 'cubic-bezier(.1,.7,.3,1)' }).onfinish = () => s.remove();
  }
}
function fxPing(el, cls) { el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 1500); }
function fxFly(el, from, k) { // a ghost copy flies from the old spot to the new one (the real card waits, so column scrolling can't clip it)
  const r = el.getBoundingClientRect(), g = el.cloneNode(true);
  g.classList.remove('flash', 'busy'); g.classList.add('fx-ghost'); g.removeAttribute('data-id');
  Object.assign(g.style, { left: from.x / k + 'px', top: from.y / k + 'px', width: from.w / k + 'px' });
  document.body.appendChild(g); el.style.visibility = 'hidden';
  const dx = (r.left - from.x) / k, dy = (r.top - from.y) / k, tilt = dx > 0 ? 4 : -4, done = () => { g.remove(); el.style.visibility = ''; };
  g.animate([{ transform: 'none' }, { transform: `translate(${dx * 0.55}px,${dy * 0.55 - 24}px) rotate(${tilt}deg) scale(1.05)`, offset: 0.5 }, { transform: `translate(${dx}px,${dy}px)` }], { duration: 900, easing: 'cubic-bezier(.3,.7,.2,1)' }).onfinish = done;
  setTimeout(done, 1400);
}
function fxAfter(snap, old) {
  if (!snap || !fxOn()) return;
  const k = fxK(); let n = 0;
  for (const el of $$('.card[data-id]')) {
    if (n >= 20) break;
    const id = +el.dataset.id, nc = cards.find((c) => c.id === id), oc = old.get(id); if (!nc) continue;
    const r = el.getBoundingClientRect(); if (!r.width) continue;
    const from = snap.get(id);
    if (!oc) { n++; el.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1.05)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 560, easing: 'ease-out' }); fxSparks(r, '#7c8cff', 8); continue; }
    if (oc.status !== nc.status) {
      n++;
      const landed = from ? 900 : 0; if (from) fxFly(el, from, k);
      setTimeout(() => {
        const rr = el.getBoundingClientRect(); if (!rr.width) return;
        if (nc.status === 'complete') fxSparks(rr, ['#4ade80', '#a7f3d0', '#fde68a'][Math.floor(Math.random() * 3)], 22);
        else if (failInfo(nc).active && !failInfo(oc).active) { fxPing(el, 'fx-ping-red'); el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-9px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 520 }); }
        else if (nc.status === 'ready_to_test') { fxPing(el, 'fx-ping-purple'); fxSparks(rr, '#b48cff', 10); }
        else if (nc.status === 'needs_info') fxPing(el, 'fx-ping-orange');
        else fxPing(el, 'fx-ping-blue');
      }, landed);
    } else if (from && Math.hypot(from.x - r.left, from.y - r.top) > 6) { // pushed around by other cards: glide into place
      n++; el.animate([{ transform: `translate(${(from.x - r.left) / k}px,${(from.y - r.top) / k}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  }
}
fxApply();
