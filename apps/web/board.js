/* =====================================================================
   BOARD — the dotted canvas. Pan (drag the ground, space-drag, two-finger
   scroll), zoom (⌘/ctrl-scroll, pinch, toolbar), draggable + resizable
   cards whose layout persists, connectors with number labels, cursors.
   Under 700px wide the board stacks its cards (no pan) for phones.
===================================================================== */
function icon(name, cls = '') { const d = ICON_DATA[name]; const s = svg('svg', { class: 'ic ' + cls, viewBox: '0 0 24 24', 'aria-hidden': 'true' }); if (d) d.forEach(([t, a]) => svg(t, a, s)); return s; }

function Board(host, { id, minZoom = .3, maxZoom = 2.2, stackBelow = 700, onView, fitKeys, fitMax = 1 } = {}) {
  const el = h('div', { class: 'board', tabindex: -1 }), layer = h('div', { class: 'layer' }), links = svg('svg', { class: 'links', width: 1, height: 1 });
  layer.append(links); el.append(layer); host.append(el);
  const cards = new Map(), wires = []; let view = { x: 40, y: 40, z: 1 }, space = false, tool = 'select', stacked = false;
  const saved = () => (Store.get().layouts || {})[id] || {};
  let saveT; const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => { const all = Object.assign({}, Store.get().layouts); const L = {}; cards.forEach((c, k) => L[k] = { x: c.x, y: c.y, w: c.w, h: c.h }); all[id] = Object.assign({}, all[id], L, { _view: view }); Store.set('layouts', all); }, 400); };
  function apply() { layer.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.z})`; el.style.backgroundPosition = `${view.x}px ${view.y}px`; el.style.backgroundSize = `${20 * view.z}px ${20 * view.z}px`; onView && onView(view); api.onView && api.onView(view); }
  function zoomAt(z, cx, cy) { z = Math.max(minZoom, Math.min(maxZoom, z)); const r = el.getBoundingClientRect(), px = (cx ?? r.width / 2), py = (cy ?? r.height / 2); view.x = px - (px - view.x) * z / view.z; view.y = py - (py - view.y) * z / view.z; view.z = z; apply(); persist(); }
  function place(c) { c.el.style.left = c.x + 'px'; c.el.style.top = c.y + 'px'; c.el.style.width = c.w + 'px'; if (c.h) c.el.style.height = c.h + 'px'; }
  /* ---- cards ---- */
  function add(key, o) {
    const s = saved()[key] || {}, c = { key, x: s.x ?? o.x, y: s.y ?? o.y, w: s.w ?? o.w ?? 320, h: s.h ?? o.h ?? null };
    const bh = h('div', { class: 'bh' }, o.icon ? icon(o.icon) : null, h('h3', {}, o.title || ''), ...(o.head || []));
    if (o.menu) { const m = h('button', { type: 'button', class: 'more', 'aria-label': `${o.title} options`, 'aria-haspopup': 'true' }, icon('more')); m.addEventListener('click', e => { e.stopPropagation(); menuPop(m, o.menu); }); bh.append(m); }
    const bb = h('div', { class: 'bb' });
    c.el = h('section', { class: 'bcard' + (o.tint ? ' tint ' + o.tint : '') + (o.cls ? ' ' + o.cls : ''), 'aria-label': o.title, 'data-key': key }, o.bare ? null : bh, bb);
    if (o.resizable !== false) { const rz = h('div', { class: 'resize', 'aria-hidden': 'true' }); c.el.append(rz); rz.addEventListener('pointerdown', e => resizeStart(e, c)); }
    c.body = bb; c.head = bh; c.title = t => bh.querySelector('h3').textContent = t;
    bh.addEventListener('pointerdown', e => { if (e.target.closest('button,a,input,.menu,.words')) return; dragStart(e, c); });
    if (o.dragAll) { c.el.addEventListener('pointerdown', e => { if (e.target.closest('button,input,textarea,.menu,.resize')) return; dragStart(e, c, true); }); c.el.addEventListener('click', e => { if (c.moved) { e.preventDefault(); e.stopPropagation(); c.moved = false; } }, true); }
    layer.append(c.el); place(c); cards.set(key, c);
    new ResizeObserver(() => drawLinks()).observe(c.el);
    return c;
  }
  function remove(key) { const c = cards.get(key); if (!c) return; c.el.remove(); cards.delete(key); for (let i = wires.length - 1; i >= 0; i--) if (wires[i].a === key || wires[i].b === key) { wires[i].lab.remove(); wires.splice(i, 1); } drawLinks(); }
  function dragStart(e, c, soft) { if (stacked || e.button > 0) return; if (!soft) e.preventDefault(); const x0 = e.clientX, y0 = e.clientY, cx = c.x, cy = c.y; c.moved = false; if (!soft) { c.el.classList.add('dragging'); c.el.parentNode.append(c.el); }
    const mv = ev => { if (soft && !c.moved) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return; c.moved = true; c.el.classList.add('dragging'); } else c.moved = true; c.x = Math.round(cx + (ev.clientX - x0) / view.z); c.y = Math.round(cy + (ev.clientY - y0) / view.z); place(c); drawLinks(); };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); c.el.classList.remove('dragging'); persist(); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); }
  function resizeStart(e, c) { if (stacked) return; e.preventDefault(); e.stopPropagation(); const x0 = e.clientX, y0 = e.clientY, w0 = c.el.offsetWidth, h0 = c.el.offsetHeight;
    const mv = ev => { c.w = Math.max(200, Math.round(w0 + (ev.clientX - x0) / view.z)); c.h = Math.max(120, Math.round(h0 + (ev.clientY - y0) / view.z)); place(c); drawLinks(); };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); persist(); api.onResize && api.onResize(c.key); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); }
  /* ---- connectors ---- */
  function link(a, b, { label = '', cls = '', key } = {}) { const w = { a, b, label, cls, key: key || a + '>' + b, lab: h('div', { class: 'lk' + (cls ? ' ' + cls : '') }, label), fresh: true }; if (!label) w.lab.hidden = true; layer.append(w.lab); wires.push(w); drawLinks(); return w; }
  function label(key, text, cls = '') { const w = wires.find(x => x.key === key); if (!w) return; w.label = text; w.lab.textContent = text; w.lab.hidden = !text; w.lab.className = 'lk' + (cls ? ' ' + cls : ''); }
  function rect(c) { return { x: c.el.offsetLeft, y: c.el.offsetTop, w: c.el.offsetWidth, h: c.el.offsetHeight }; }
  function drawLinks() {
    if (stacked) return; links.replaceChildren(); let maxX = 0, maxY = 0;
    for (const w of wires) {
      const A = cards.get(w.a), B = cards.get(w.b); if (!A || !B) continue; const a = rect(A), b = rect(B);
      let x1, y1, x2, y2, horiz = true;
      if (b.y >= a.y + a.h + 20 && !(b.x >= a.x + a.w + 40 && Math.abs((b.y + b.h / 2) - (a.y + a.h / 2)) < a.h)) { horiz = false; x1 = a.x + a.w / 2; y1 = a.y + a.h; x2 = b.x + Math.min(b.w / 2, 120); y2 = b.y; }
      else if (b.x >= a.x + a.w - 10) { x1 = a.x + a.w; y1 = a.y + Math.min(a.h / 2, 80); x2 = b.x; y2 = b.y + Math.min(b.h / 2, 80); }
      else if (b.x + b.w <= a.x + 10) { x1 = a.x; y1 = a.y + Math.min(a.h / 2, 80); x2 = b.x + b.w; y2 = b.y + Math.min(b.h / 2, 80); }
      else { horiz = false; if (b.y > a.y) { x1 = a.x + a.w / 2; y1 = a.y + a.h; x2 = b.x + b.w / 2; y2 = b.y; } else { x1 = a.x + a.w / 2; y1 = a.y; x2 = b.x + b.w / 2; y2 = b.y + b.h; } }
      const r = 14; let d, mx, my;
      if (horiz) { mx = (x1 + x2) / 2; my = (y1 + y2) / 2; const sx = Math.sign(x2 - x1) || 1, sy = Math.sign(y2 - y1), rr = Math.min(r, Math.abs(y2 - y1) / 2, Math.abs(mx - x1));
        d = Math.abs(y2 - y1) < 2 ? `M${x1} ${y1}H${x2}` : `M${x1} ${y1}H${mx - rr * sx}Q${mx} ${y1} ${mx} ${y1 + rr * sy}V${y2 - rr * sy}Q${mx} ${y2} ${mx + rr * sx} ${y2}H${x2}`; }
      else { mx = (x1 + x2) / 2; my = (y1 + y2) / 2; const sy = Math.sign(y2 - y1) || 1, sx = Math.sign(x2 - x1), rr = Math.min(r, Math.abs(x2 - x1) / 2, Math.abs(my - y1));
        d = Math.abs(x2 - x1) < 2 ? `M${x1} ${y1}V${y2}` : `M${x1} ${y1}V${my - rr * sy}Q${x1} ${my} ${x1 + rr * sx} ${my}H${x2 - rr * sx}Q${x2} ${my} ${x2} ${my + rr * sy}V${y2}`; }
      const p = svg('path', { d, class: w.fresh && !Motion.reduced ? 'draw' : '' }, links); if (w.fresh) { const L = p.getTotalLength ? p.getTotalLength() : 400; p.style.setProperty('--len', L); w.fresh = false; }
      const ang = horiz ? (x2 > x1 ? 0 : Math.PI) : (y2 > y1 ? Math.PI / 2 : -Math.PI / 2), hx = x2, hy = y2, s = 6;
      svg('path', { class: 'head', d: `M${hx} ${hy}L${hx - s * Math.cos(ang) - s * .6 * Math.sin(ang)} ${hy - s * Math.sin(ang) + s * .6 * Math.cos(ang)}L${hx - s * Math.cos(ang) + s * .6 * Math.sin(ang)} ${hy - s * Math.sin(ang) - s * .6 * Math.cos(ang)}Z` }, links);
      w.lab.style.left = mx + 'px'; w.lab.style.top = my + 'px'; maxX = Math.max(maxX, x1, x2); maxY = Math.max(maxY, y1, y2);
    }
    links.setAttribute('width', maxX + 40); links.setAttribute('height', maxY + 40);
  }
  /* ---- pan & zoom ---- */
  const ground = t => t === el || t === layer || t === links || (t.closest && t.closest('.links'));
  const pts = new Map(); let pinch = null, panning = null, vel = { x: 0, y: 0 }, inertia = 0;
  el.addEventListener('pointerdown', e => {
    if (stacked) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { const [p, q] = [...pts.values()]; pinch = { d: Math.hypot(p.x - q.x, p.y - q.y), z: view.z }; panning = null; return; }
    if (!(ground(e.target) || space || tool === 'pan')) return;
    e.preventDefault(); cancelAnimationFrame(inertia); panning = { x: e.clientX, y: e.clientY, t: performance.now() }; el.classList.add('panning'); el.setPointerCapture(e.pointerId); el.focus({ preventScroll: true });
  });
  el.addEventListener('pointermove', e => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size === 2) { const [p, q] = [...pts.values()], r = el.getBoundingClientRect(); zoomAt(pinch.z * Math.hypot(p.x - q.x, p.y - q.y) / pinch.d, (p.x + q.x) / 2 - r.left, (p.y + q.y) / 2 - r.top); return; }
    if (!panning) return; const dx = e.clientX - panning.x, dy = e.clientY - panning.y, t = performance.now(), dt = Math.max(1, t - panning.t);
    vel = { x: dx / dt * 16, y: dy / dt * 16 }; view.x += dx; view.y += dy; panning = { x: e.clientX, y: e.clientY, t }; apply();
  });
  const endPan = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!panning) return; panning = null; el.classList.remove('panning');
    if (!Motion.reduced && Math.hypot(vel.x, vel.y) > 1) { const step = () => { vel.x *= .92; vel.y *= .92; view.x += vel.x; view.y += vel.y; apply(); if (Math.hypot(vel.x, vel.y) > .3) inertia = requestAnimationFrame(step); else persist(); }; inertia = requestAnimationFrame(step); } else persist(); };
  el.addEventListener('pointerup', endPan); el.addEventListener('pointercancel', endPan);
  el.addEventListener('wheel', e => { if (stacked) return; const inCard = e.target.closest('.bb'); if (e.ctrlKey || e.metaKey) { e.preventDefault(); const r = el.getBoundingClientRect(); zoomAt(view.z * Math.exp(-e.deltaY * .0025), e.clientX - r.left, e.clientY - r.top); return; }
    if (inCard) { const sc = e.target.closest('.bb'); if (sc.scrollHeight > sc.clientHeight + 2 || sc.scrollWidth > sc.clientWidth + 2) return; }
    e.preventDefault(); view.x -= e.deltaX; view.y -= e.deltaY; apply(); persist(); }, { passive: false });
  const kd = e => { if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && el.isConnected && !el.closest('[hidden]')) { space = true; el.classList.add('panning'); } }, ku = e => { if (e.code === 'Space') { space = false; el.classList.remove('panning'); } };
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  function bbox(keys) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; cards.forEach((c, k) => { if (keys && !keys.includes(k)) return; const r = rect(c); x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); }); return { x0, y0, x1, y1 }; }
  function fit(pad = 48, maxZ = fitMax, bottomPad = 90) { if (stacked || !cards.size) return; const b = bbox(typeof fitKeys === 'function' ? fitKeys() : fitKeys), W = el.clientWidth, H = el.clientHeight; if (!W || !H) return; const z = Math.max(minZoom, Math.min(maxZ, (W - pad * 2) / (b.x1 - b.x0), (H - pad - bottomPad) / (b.y1 - b.y0))); view = { z, x: (W - (b.x1 - b.x0) * z) / 2 - b.x0 * z, y: pad + Math.max(0, Math.min(60, (H - pad - bottomPad - (b.y1 - b.y0) * z) / 2)) - b.y0 * z }; apply(); }
  function stackCheck() { const s = el.parentNode && host.clientWidth < stackBelow; if (s !== stacked) { stacked = s; el.classList.toggle('stacked', s); if (!s) { drawLinks(); } } }
  new ResizeObserver(() => { stackCheck(); if (!api._fitted && el.clientWidth) { api._fitted = true; const sv = saved()._view; if (sv) { view = sv; apply(); } else fit(); } }).observe(host);
  // menu popover for card ⋯ buttons
  function menuPop(anchor, items) { const r = anchor.getBoundingClientRect(), hr = host.getBoundingClientRect(); const p = h('div', { class: 'pop', role: 'menu', style: { left: Math.min(hr.width - 220, r.left - hr.left - 180) + 'px', top: (r.bottom - hr.top + 6) + 'px', padding: '6px', minWidth: '200px' } }, items.map(([t, f]) => h('button', { type: 'button', role: 'menuitem', class: 'btn bare', style: { width: '100%', justifyContent: 'flex-start' }, onclick: () => { p.remove(); f(); } }, t))); host.append(p); const off = ev => { if (!p.contains(ev.target)) { p.remove(); removeEventListener('pointerdown', off, true); } }; setTimeout(() => addEventListener('pointerdown', off, true)); p.querySelector('button')?.focus(); }
  const api = {
    el, layer, host, cards, add, remove, link, label, drawLinks, fit, zoomAt, apply, bbox, menuPop,
    get view() { return view; }, get stacked() { return stacked; }, set tool(t) { tool = t; },
    zoomIn() { zoomAt(view.z * 1.2); }, zoomOut() { zoomAt(view.z / 1.2); }, zoomReset() { zoomAt(1); },
    focusCard(key) { const c = cards.get(key); if (!c || stacked) return c && c.el.scrollIntoView({ behavior: 'smooth', block: 'center' }); const r = rect(c), W = el.clientWidth, H = el.clientHeight; const to = { x: W / 2 - (r.x + r.w / 2) * view.z, y: H / 2 - (r.y + r.h / 2) * view.z }; if (window.gsap && !Motion.reduced) gsap.to(view, Object.assign(to, { duration: .6, ease: 'power3.inOut', onUpdate: apply, onComplete: persist })); else { Object.assign(view, to); apply(); } },
    relayout() { const all = Object.assign({}, Store.get().layouts); delete all[id]; Store.set('layouts', all); location.reload(); },
    destroy() { removeEventListener('keydown', kd); removeEventListener('keyup', ku); }
  };
  apply(); return api;
}

/* floating pill toolbar */
function Toolbar(host, items) {
  const tb = h('div', { class: 'float-tb', role: 'toolbar', 'aria-label': 'Canvas tools' });
  items.forEach(it => { if (it === '|') tb.append(h('span', { class: 'sep', 'aria-hidden': 'true' })); else if (it.nodeType) tb.append(it); else { const b = h('button', { type: 'button', class: 'tb', title: it.title, 'aria-label': it.title, 'aria-pressed': it.pressed != null ? String(!!it.pressed) : null }, it.icon ? icon(it.icon) : null, it.label || null); b.addEventListener('click', e => it.on(b, e)); tb.append(b); it.el = b; } });
  host.append(tb); return tb;
}
function zoomControls(board) {
  const pct = h('span', { class: 'tb zoom', 'aria-live': 'polite' }, '100%'); board.onView = v => pct.textContent = Math.round(v.z * 100) + '%'; pct.textContent = Math.round(board.view.z * 100) + '%';
  return [{ icon: 'zout', title: 'Zoom out', on: () => board.zoomOut() }, (() => { const b = h('button', { type: 'button', class: 'tb zoom', title: 'Fit to screen', 'aria-label': 'Fit to screen' }, pct); b.addEventListener('click', () => board.fit()); return b; })(), { icon: 'zin', title: 'Zoom in', on: () => board.zoomIn() }];
}

/* named multiplayer cursor; the tutor is QUBIT */
function Cursor(board, { name = 'QUBIT', color = '#592EFF', fill = '#DFFF9D', text = '#21164C' } = {}) {
  const speech = h('div', { class: 'speech', 'aria-live': 'polite' });
  const el = h('div', { class: 'qcursor', 'aria-hidden': 'false' });
  const arrow = svg('svg', { width: 22, height: 24, viewBox: '0 0 22 24', 'aria-hidden': 'true' }); svg('path', { d: 'M2 2 L19 12 L11 13.5 L7.5 21 Z', fill: color, stroke: '#fff', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, arrow);
  el.append(arrow, h('span', { class: 'nm', style: { background: fill, color: text } }, name), speech);
  board.layer.append(el); let pos = { x: 60, y: 60 };
  const set = (x, y) => { pos = { x, y }; el.style.transform = `translate(${x}px,${y}px)`; };
  function at(target, dx = 0.62, dy = 0.7) { if (!target) return; const L = board.layer.getBoundingClientRect(), r = target.getBoundingClientRect(), z = board.stacked ? 1 : board.view.z; set((r.left - L.left + r.width * dx) / z, (r.top - L.top + r.height * dy) / z); }
  set(pos.x, pos.y);
  return { el, speech, at, set, get pos() { return pos; },
    say(html) { speech.innerHTML = ''; if (!html) return; speech.append(h('button', { type: 'button', class: 'x', 'aria-label': 'Dismiss', onclick: () => speech.replaceChildren() }, '×')); const d = h('div'); d.innerHTML = html; speech.append(d); },
    hide(v) { el.classList.toggle('hidden', !!v); } };
}
