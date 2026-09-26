/* =====================================================================
   INK — the instruments. Every view reads one state; none owns physics.
===================================================================== */
const V3 = {
  rot(v, n, t) { const c = Math.cos(t), s = Math.sin(t), d = n[0] * v[0] + n[1] * v[1] + n[2] * v[2]; const x = n[1] * v[2] - n[2] * v[1], y = n[2] * v[0] - n[0] * v[2], z = n[0] * v[1] - n[1] * v[0]; return [v[0] * c + x * s + n[0] * d * (1 - c), v[1] * c + y * s + n[1] * d * (1 - c), v[2] * c + z * s + n[2] * d * (1 - c)]; },
  len: v => Math.hypot(v[0], v[1], v[2]), lerp: (a, b, t) => [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * t),
  blend(a, b, t) { const la = V3.len(a), lb = V3.len(b), L = la + (lb - la) * t; if (la < 1e-6 || lb < 1e-6) return V3.lerp(a, b, t);
    const ua = a.map(x => x / la), ub = b.map(x => x / lb), d = Math.max(-1, Math.min(1, ua[0] * ub[0] + ua[1] * ub[1] + ua[2] * ub[2])), w = Math.acos(d);
    if (w < 1e-6) return ua.map(x => x * L); if (Math.PI - w < 1e-4) return V3.rot(ua, Math.abs(ua[2]) > .9 ? [1, 0, 0] : [0, 0, 1], w * t).map(x => x * L);
    const s = Math.sin(w), k1 = Math.sin((1 - t) * w) / s, k2 = Math.sin(t * w) / s; return [0, 1, 2].map(i => (ua[i] * k1 + ub[i] * k2) * L); }
};
const Ink = (() => {
  const f1 = x => Math.round(x * 10) / 10;
  function proj(v, view) { const a = view.yaw, p = view.pitch; const x1 = v[0] * Math.cos(a) + v[1] * Math.sin(a), y1 = -v[0] * Math.sin(a) + v[1] * Math.cos(a); return [x1, y1 * Math.sin(p) + v[2] * Math.cos(p), -y1 * Math.cos(p) + v[2] * Math.sin(p)]; }
  function sp(v, g) { const q = proj(v, g.view); return [g.cx + q[0] * g.R, g.cy - q[1] * g.R, q[2]]; }
  function curve(fn, g, n = 72) { let F = '', B = '', prev = null; for (let i = 0; i <= n; i++) { const p = sp(fn(i / n), g), on = p[2] >= -1e-9, pt = f1(p[0]) + ' ' + f1(p[1]); if (on) F += (prev === true ? ' L' : ' M') + pt; else B += (prev === false ? ' L' : ' M') + pt; prev = on; } return [F.trim(), B.trim()]; }
  function phaseColor(ph) { const t = ((ph / (2 * Math.PI)) % 1 + 1) % 1, st = [[92, 142, 196], [146, 116, 196], [196, 102, 132], [212, 150, 84], [128, 170, 106], [92, 142, 196]]; const x = t * 5, i = Math.floor(x), f = x - i, a = st[i], b = st[Math.min(5, i + 1)]; return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`; }
  /* ---- Bloch sphere ---- */
  function sphere(root, opt) {
    const g = { cx: opt.cx, cy: opt.cy, R: opt.R, view: { yaw: 2.0, pitch: 0.28 } }, E = {}, G0 = svg('g', { class: 'sph' }, root);
    E.merB = svg('path', { class: 'q-back' }, G0); E.eqB = svg('path', { class: 'q-back' }, G0); E.wlB = svg('path', { class: 'q-back q-wl' }, G0);
    svg('circle', { class: 'q-outline', cx: g.cx, cy: g.cy, r: g.R }, G0);
    E.merF = svg('path', { class: 'q-front' }, G0); E.eqF = svg('path', { class: 'q-front' }, G0); E.wlF = svg('path', { class: 'q-wlF' }, G0);
    E.axis = svg('line', { class: 'q-axis' }, G0); E.trace = svg('path', { class: 'q-trace' }, G0);
    if (opt.ghost) { E.gG = svg('g', { class: 'q-ghost' }, G0); E.ghost = svg('line', {}, E.gG); E.ghostTip = svg('circle', { r: 8 }, E.gG); }
    E.arrow = svg('line', { class: 'q-arrow' }, G0); svg('circle', { class: 'q-hub', cx: g.cx, cy: g.cy, r: 2.3 }, G0); E.tip = svg('circle', { class: 'q-tip', r: opt.tipR || 5 }, G0);
    if (opt.labels !== false) E.labs = ['|0⟩', '|1⟩', '|+⟩', '|−⟩'].map(t => { const e = svg('text', { class: 'q-slab' }, G0); e.textContent = t; return e; });
    if (opt.gauge) { const x = g.cx + g.R + (opt.gaugeGap || 26); svg('rect', { class: 'q-gauge', x, y: g.cy - g.R, width: 6, height: 2 * g.R, rx: 3 }, G0); E.fill0 = svg('rect', { class: 'q-gfill', x: x + .5, width: 5 }, G0); E.tick = svg('line', { class: 'q-tick', x1: x - 6, x2: x + 12 }, G0); const t = svg('text', { class: 'q-slab', x: x + 3, y: g.cy + g.R + 18 }, G0); t.textContent = 'P(0)'; }
    const st = { v: [0, 0, 1], traces: [], axis: null, axisA: 0, ghost: null };
    function draw() {
      const v = st.v, L = V3.len(v);
      let c = curve(t => [Math.cos(t * 6.2832), Math.sin(t * 6.2832), 0], g); E.eqF.setAttribute('d', c[0]); E.eqB.setAttribute('d', c[1]);
      c = curve(t => [Math.sin(t * 6.2832), 0, Math.cos(t * 6.2832)], g); E.merF.setAttribute('d', c[0]); E.merB.setAttribute('d', c[1]);
      const hh = Math.max(-1, Math.min(1, v[2])), rr = Math.sqrt(Math.max(0, 1 - hh * hh)); c = curve(t => [rr * Math.cos(t * 6.2832), rr * Math.sin(t * 6.2832), hh], g); E.wlF.setAttribute('d', c[0]); E.wlB.setAttribute('d', c[1]);
      const tip = sp(v, g); E.arrow.setAttribute('x1', g.cx); E.arrow.setAttribute('y1', g.cy); E.arrow.setAttribute('x2', f1(tip[0])); E.arrow.setAttribute('y2', f1(tip[1]));
      E.tip.setAttribute('cx', f1(tip[0])); E.tip.setAttribute('cy', f1(tip[1])); E.tip.setAttribute('class', (tip[2] >= 0 ? 'q-tip' : 'q-tip q-tip-back') + (L < .05 ? ' is-sunk' : '')); if (L < .05) E.tip.setAttribute('r', (opt.tipR || 5) + 4); else E.tip.setAttribute('r', opt.tipR || 5);
      if (E.labs) [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0]].forEach((p, i) => { const q = sp(p.map(x => x * 1.24), g); E.labs[i].setAttribute('x', f1(q[0])); E.labs[i].setAttribute('y', f1(q[1] + 4)); });
      if (E.fill0) { const P0 = (1 + hh) / 2, gy = g.cy + g.R - P0 * 2 * g.R; E.fill0.setAttribute('y', f1(gy)); E.fill0.setAttribute('height', f1(P0 * 2 * g.R)); E.tick.setAttribute('y1', f1(gy)); E.tick.setAttribute('y2', f1(gy)); }
      let d = ''; st.traces.forEach(tr => tr.forEach((p, k) => { const q = sp(p, g); d += (k ? ' L' : ' M') + f1(q[0]) + ' ' + f1(q[1]); })); E.trace.setAttribute('d', d.trim());
      const ax = st.axis || [0, 0, 1], a1 = sp(ax.map(x => -x * 1.25), g), a2 = sp(ax.map(x => x * 1.25), g); E.axis.setAttribute('x1', f1(a1[0])); E.axis.setAttribute('y1', f1(a1[1])); E.axis.setAttribute('x2', f1(a2[0])); E.axis.setAttribute('y2', f1(a2[1])); E.axis.style.opacity = st.axisA;
      if (E.ghost) { const gv = st.ghost || [0, 0, 1], q = sp(gv, g); E.ghost.setAttribute('x1', g.cx); E.ghost.setAttribute('y1', g.cy); E.ghost.setAttribute('x2', f1(q[0])); E.ghost.setAttribute('y2', f1(q[1])); E.ghostTip.setAttribute('cx', f1(q[0])); E.ghostTip.setAttribute('cy', f1(q[1])); E.gG.classList.toggle('is-on', !!st.ghost); }
    }
    draw();
    const api = { g, st, draw, E, root: G0,
      to(v, dur = .35) { const a = st.v.slice(), p = { t: 0 }; Motion.to(p, { t: 1, duration: dur, ease: 'power2.out', overwrite: true, onUpdate() { st.v = V3.blend(a, v, p.t); draw(); } }); },
      rotate(axis, angle, dur = .4) { const v0 = st.v.slice(), arc = [], tr = [v0]; for (let i = 0; i <= 48; i++) arc.push(V3.rot(v0, axis, angle * i / 48)); st.traces.push(tr); if (st.traces.length > 6) st.traces.shift(); st.axis = axis; Motion.to(st, { axisA: .9, duration: .15 }); Motion.to(st, { axisA: 0, duration: .5, delay: .7, onUpdate: draw });
        return new Promise(res => { const p = { t: 0 }; Motion.to(p, { t: 1, duration: dur, ease: 'power2.inOut', onUpdate() { st.v = V3.rot(v0, axis, angle * p.t); tr.length = 0; for (let i = 0; i <= Math.round(p.t * 48); i++) tr.push(arc[i]); draw(); }, onComplete() { draw(); res(); } }); }); },
      follow(nx, ny) { if (Motion.reduced) return; Motion.to(g.view, { yaw: 2 + nx * .24, pitch: .28 - ny * .1, duration: .6, ease: 'power3.out', overwrite: true, onUpdate: draw }); }
    };
    return api;
  }
  /* ---- field: disk per basis state, area = probability, needle = phase ---- */
  function field(root, s, { per = 8, cell = 76, R = 28, n, max = 64, onHover, ghost } = {}) {
    const p = Sim.probs(s), N = p.length; root.replaceChildren();
    const show = []; if (N <= max) for (let i = 0; i < N; i++) show.push(i); else { const idx = Array.from(p).map((x, i) => [x, i]).sort((a, b) => b[0] - a[0]).slice(0, max).map(x => x[1]).sort((a, b) => a - b); show.push(...idx); }
    const cols = Math.min(per, show.length), rows = Math.ceil(show.length / cols), W = cols * cell, H = rows * (cell + 16);
    root.setAttribute('viewBox', `0 0 ${W} ${H}`); root.setAttribute('width', W); root.setAttribute('height', H);
    show.forEach((i, k) => {
      const cx = (k % cols) * cell + cell / 2, cy = Math.floor(k / cols) * (cell + 16) + cell / 2 - 4, r = R * Math.sqrt(p[i]), ph = Sim.phase(s, i), col = phaseColor(ph), gg = svg('g', { 'data-i': i, class: 'fd', tabindex: onHover ? 0 : null }, root);
      svg('circle', { class: 'q-dbox', cx, cy, r: R }, gg);
      if (ghost) { const gr = R * Math.sqrt(ghost.p[i] || 0); if (gr > .4) svg('circle', { cx, cy, r: gr.toFixed(2), fill: 'none', stroke: 'var(--sienna)', 'stroke-dasharray': '4 3', 'stroke-width': 1.2 }, gg); }
      if (r > .35) { const d = svg('circle', { class: 'q-disk', cx, cy, r: r.toFixed(2) }, gg); d.style.fill = col; d.style.stroke = col; svg('line', { class: 'q-needle', x1: cx, y1: cy, x2: (cx + Math.cos(ph) * R * .9).toFixed(1), y2: (cy - Math.sin(ph) * R * .9).toFixed(1) }, gg); svg('circle', { class: 'q-hub', cx, cy, r: 1.6 }, gg); }
      const t = svg('text', { class: 'q-fk', x: cx, y: cy + R + 14 }, gg); t.textContent = Sim.ket ? Sim.ket(i, n) : '|' + i.toString(2).padStart(n, '0') + '⟩';
      if (onHover) { gg.addEventListener('pointerenter', () => onHover(i)); gg.addEventListener('focus', () => onHover(i)); }
    });
    return { shown: show.length, total: N };
  }
  /* ---- histogram: ideal (dotted), shots (filled), other backends (outlines) ---- */
  function histogram(root, { keys, ideal, series = [], width = 520, height = 200, maxBins = 64 }) {
    root.replaceChildren(); let K = keys.slice(); if (K.length > maxBins) { const score = k => Math.max(ideal?.[k] || 0, ...series.map(s => (s.counts[k] || 0) / s.shots)); K = K.sort((a, b) => score(b) - score(a)).slice(0, maxBins).sort(); }
    const W = Math.max(width, 280), H = height, pad = 6, base = H - 30, top = 10, step = (W - 2 * pad) / K.length, bw = Math.max(2, Math.min(40, step - 5));
    root.setAttribute('viewBox', `0 0 ${W} ${H}`); root.setAttribute('width', W); root.setAttribute('height', H); root.classList.add('chart');
    svg('line', { class: 'ax', x1: pad, x2: W - pad, y1: base + .5, y2: base + .5 }, root);
    let maxV = .0001; K.forEach(k => { maxV = Math.max(maxV, ideal?.[k] || 0, ...series.map(s => (s.counts[k] || 0) / s.shots)); }); maxV = Math.min(1, Math.max(.25, Math.ceil(maxV * 4) / 4));
    [.25, .5, .75, 1].forEach(g => { if (g > maxV + 1e-9) return; const y = base - (base - top) * g / maxV; svg('line', { class: 'grid', x1: pad, x2: W - pad, y1: y, y2: y }, root); const t = svg('text', { x: W - pad, y: y - 3, 'text-anchor': 'end' }, root); t.textContent = fmt.p(g, 0); });
    const sc = v => (base - top) * v / maxV;
    const main = series.find(s => s.fill);
    K.forEach((k, i) => { const x = pad + step * i + (step - bw) / 2; if (main) { const v = (main.counts[k] || 0) / main.shots * (main.anim ?? 1); svg('rect', { class: 'bar', x, y: base - sc(v), width: bw, height: sc(v), opacity: main.stale ? .35 : 1 }, root); }
      series.filter(s => !s.fill).forEach((s, j) => { const v = (s.counts[k] || 0) / s.shots * (s.anim ?? 1); svg('rect', { x: x - 2 - j * 1.5, y: base - sc(v), width: bw + 4 + j * 3, height: sc(v), fill: 'none', stroke: s.color || 'var(--sienna)', 'stroke-width': 1.3, 'stroke-dasharray': s.dash || '4 3', opacity: s.stale ? .35 : 1 }, root); });
      if (ideal && ideal[k] > 1e-9) { const v = ideal[k]; svg('line', { x1: x - 3, x2: x + bw + 3, y1: base - sc(v), y2: base - sc(v), stroke: 'var(--ink2)', 'stroke-width': 1, 'stroke-dasharray': '1.5 2.5' }, root); }
      if (K.length <= 32 || i % Math.ceil(K.length / 32) === 0) { const t = svg('text', { x: x + bw / 2, y: base + 14, 'text-anchor': 'middle', 'font-size': K[0].length > 5 ? 8.5 : 10.5 }, root); t.textContent = k; }
    });
    return { keys: K };
  }
  /* ---- line chart (scaling, landscapes, curves) ---- */
  function lines(root, { series, width = 460, height = 220, xlabel = '', ylabel = '', xlog = false, ylog = false, xticks, yfmt = v => (+v.toFixed(3)).toString(), marks = [] }) {
    root.replaceChildren(); root.classList.add('chart'); const W = width, H = height, L = 52, Rr = 12, T = ylabel ? 26 : 12, B = 34;
    root.setAttribute('viewBox', `0 0 ${W} ${H}`); root.setAttribute('width', W); root.setAttribute('height', H);
    const all = series.flatMap(s => s.pts); if (!all.length) return;
    const tx = v => xlog ? Math.log10(v) : v, ty = v => ylog ? Math.log10(Math.max(v, 1e-12)) : v;
    let x0 = Math.min(...all.map(p => tx(p[0]))), x1 = Math.max(...all.map(p => tx(p[0]))), y0 = Math.min(...all.map(p => ty(p[1]))), y1 = Math.max(...all.map(p => ty(p[1])));
    if (y0 === y1) { y0 -= 1; y1 += 1; } const padY = (y1 - y0) * .08; y0 -= padY; y1 += padY; if (x0 === x1) { x0 -= 1; x1 += 1; }
    const X = v => L + (tx(v) - x0) / (x1 - x0) * (W - L - Rr), Y = v => T + (1 - (ty(v) - y0) / (y1 - y0)) * (H - T - B);
    svg('line', { class: 'ax', x1: L, x2: W - Rr, y1: H - B, y2: H - B }, root); svg('line', { class: 'ax', x1: L, x2: L, y1: T, y2: H - B }, root);
    for (let k = 0; k <= 4; k++) { const v = y0 + (y1 - y0) * k / 4, y = T + (1 - k / 4) * (H - T - B); svg('line', { class: 'grid', x1: L, x2: W - Rr, y1: y, y2: y }, root); const t = svg('text', { x: L - 6, y: y + 3, 'text-anchor': 'end' }, root); t.textContent = yfmt(ylog ? Math.pow(10, v) : v); }
    const xt = xticks || [0, .25, .5, .75, 1].map(f => { const v = x0 + (x1 - x0) * f; return xlog ? Math.pow(10, v) : v; });
    xt.forEach(v => { const x = X(v); const t = svg('text', { x, y: H - B + 16, 'text-anchor': 'middle' }, root); t.textContent = typeof v === 'number' ? (+v.toPrecision(3)).toString() : v; });
    if (xlabel) { const t = svg('text', { x: (L + W) / 2, y: H - 4, 'text-anchor': 'middle' }, root); t.textContent = xlabel; }
    if (ylabel) { const t = svg('text', { x: 4, y: 11, 'text-anchor': 'start' }, root); t.textContent = ylabel; }
    series.forEach((s, i) => { const d = s.pts.map((p, k) => (k ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' '); svg('path', { class: s.cls || 'l' + (i + 1), d }, root); if (s.dots) s.pts.forEach(p => svg('circle', { class: 'dot', cx: X(p[0]), cy: Y(p[1]), r: 2.5 }, root)); if (s.label) { const lp = s.pts[s.pts.length - 1]; const t = svg('text', { x: Math.min(W - Rr, X(lp[0])), y: Y(lp[1]) - 6, 'text-anchor': 'end', fill: 'var(--ink2)' }, root); t.textContent = s.label; } });
    marks.forEach(m => { svg('circle', { class: 'dot', cx: X(m[0]), cy: Y(m[1]), r: 4 }, root); if (m[2]) { const t = svg('text', { x: X(m[0]) + 8, y: Y(m[1]) + 4 }, root); t.textContent = m[2]; } });
    return { X, Y };
  }
  /* ---- heatmap (density/unitary/landscape) ---- */
  function heat(root, M, { size = 260, label, cellText, signed = false, color } = {}) {
    root.replaceChildren(); const n = M.length, c = size / n; root.setAttribute('viewBox', `0 0 ${size} ${size}`); root.setAttribute('width', size); root.setAttribute('height', size);
    let mx = 1e-12; M.forEach(r => r.forEach(v => mx = Math.max(mx, Math.abs(typeof v === 'number' ? v : v.mag))));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = M[i][j]; let fill, op;
      if (typeof v === 'object') { fill = phaseColor(v.ph); op = v.mag / mx; } else if (signed) { fill = v >= 0 ? 'var(--f-single)' : 'var(--sienna)'; op = Math.abs(v) / mx; } else { fill = color || 'var(--ink)'; op = v / mx; }
      const r = svg('rect', { x: j * c, y: i * c, width: c + .3, height: c + .3, fill, 'fill-opacity': Math.max(0, Math.min(1, op)).toFixed(3) }, root); if (cellText) { const t = svg('title', {}, r); t.textContent = cellText(i, j, v); } }
    svg('rect', { x: .5, y: .5, width: size - 1, height: size - 1, fill: 'none', stroke: 'var(--hair2)' }, root);
  }
  /* ---- Q-sphere: basis states on a sphere by Hamming weight ---- */
  function qsphere(root, s, n, size = 300) {
    root.replaceChildren(); root.setAttribute('viewBox', `0 0 ${size} ${size}`); root.setAttribute('width', size); root.setAttribute('height', size);
    const g = { cx: size / 2, cy: size / 2, R: size * .36, view: { yaw: .5, pitch: .35 } };
    svg('circle', { class: 'q-outline', cx: g.cx, cy: g.cy, r: g.R }, root);
    let c = curve(t => [Math.cos(t * 6.2832), Math.sin(t * 6.2832), 0], g); svg('path', { class: 'q-front', d: c[0] }, root); svg('path', { class: 'q-back', d: c[1] }, root);
    const p = Sim.probs(s), byW = {}; for (let i = 0; i < p.length; i++) { const w = i.toString(2).split('1').length - 1; (byW[w] = byW[w] || []).push(i); }
    const pts = [];
    for (let i = 0; i < p.length; i++) { if (p[i] < 1e-6) continue; const w = i.toString(2).split('1').length - 1, lat = Math.PI * w / n, grp = byW[w], k = grp.indexOf(i), lon = 2 * Math.PI * k / grp.length; const v = [Math.sin(lat) * Math.cos(lon), Math.sin(lat) * Math.sin(lon), Math.cos(lat)]; pts.push([sp(v, g), i]); }
    pts.sort((a, b) => a[0][2] - b[0][2]).forEach(([q, i]) => { svg('line', { x1: g.cx, y1: g.cy, x2: q[0], y2: q[1], stroke: 'var(--hair2)' }, root); const d = svg('circle', { cx: q[0], cy: q[1], r: (3 + 12 * Math.sqrt(p[i])).toFixed(1), fill: phaseColor(Sim.phase(s, i)), 'fill-opacity': q[2] >= 0 ? .9 : .45, stroke: 'var(--ink)', 'stroke-width': .6 }, root); const t = svg('title', {}, d); t.textContent = `${Sim.ket(i, n)} P=${p[i].toFixed(3)} phase ${fmt.ang(Sim.phase(s, i))}`; if (p[i] > .04) { const tt = svg('text', { class: 'q-slab', x: q[0], y: q[1] - 12 - 12 * Math.sqrt(p[i]) }, root); tt.textContent = i.toString(2).padStart(n, '0'); } });
    const t0 = svg('text', { class: 'q-slab', x: g.cx, y: g.cy - g.R - 10 }, root); t0.textContent = '0…0'; const t1 = svg('text', { class: 'q-slab', x: g.cx, y: g.cy + g.R + 18 }, root); t1.textContent = '1…1';
  }
  return { sphere, field, histogram, lines, heat, qsphere, phaseColor, sp };
})();
Sim.ket = (i, n) => '|' + i.toString(2).padStart(n, '0') + '⟩';
