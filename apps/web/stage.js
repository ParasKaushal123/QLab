/* =====================================================================
   STAGE INSTRUMENTS — shared by Arrival, Placement and the Course.
   Tray: shots fall as grains into outcome columns.
   Shaper: predict a histogram by dragging bin heights.
   Needle: a phase dial you turn by hand.
   QubitStage: one qubit, drawn large — sphere, amplitude disks, odds,
     gate marks, θ rule, φ needle, measurement.
   GhostSphere: predict where the arrow will point by dragging a ghost.
===================================================================== */
const Stage = (() => {
  /* ---------------- tray: grains of outcomes ---------------- */
  function Tray(host, { keys, height = 220, label = 'Outcome tray', grain = 3, cap = 1000 } = {}) {
    const grain0 = grain;
    const wrap = h('div', { class: 'tray' }), cv = h('canvas', { role: 'img', 'aria-label': label }), capEl = h('div', { class: 'tray-keys' }), out = h('p', { class: 'tray-read', 'aria-live': 'polite' });
    wrap.append(cv, capEl, out); host.replaceChildren(wrap);
    let counts = {}, total = 0, falling = [], raf = 0, W = 0, ghost = null, colW = 0;
    const K = () => keys;
    function size() { const d = devicePixelRatio || 1; W = Math.max(110, wrap.clientWidth || 480); cv.width = W * d; cv.height = height * d; cv.style.width = W + 'px'; cv.style.height = height + 'px'; cv.getContext('2d').setTransform(d, 0, 0, d, 0, 0); colW = W / K().length; grain = grain0; while (grain > .9 && Math.ceil(cap / perRow()) * (grain * 2 + 1) > height - 34) grain -= .25; paintKeys(); draw(); }
    function paintKeys() { capEl.style.gridTemplateColumns = `repeat(${K().length},1fr)`; capEl.replaceChildren(...K().map(k => h('span', {}, h('b', { class: 'mono' }, '|' + k + '⟩'), h('i', { class: 'mono' }, counts[k] ? `${counts[k]}` : '0')))); }
    const perRow = () => Math.max(4, Math.floor((colW * .62) / (grain * 2 + 1)));
    function heapTop(k) { const n = counts[k] || 0, rows = Math.ceil(n / perRow()); return height - 6 - rows * (grain * 2 + 1); }
    function draw() {
      const c = cv.getContext('2d'); c.clearRect(0, 0, W, height); const ink = cssv('--ink'), hair = cssv('--hair2'), sienna = cssv('--sienna');
      c.strokeStyle = hair; c.lineWidth = 1; c.beginPath(); c.moveTo(0, height - .5); c.lineTo(W, height - .5); c.stroke();
      K().forEach((k, i) => { if (i) { c.beginPath(); c.setLineDash([2, 4]); c.moveTo(i * colW + .5, 30); c.lineTo(i * colW + .5, height); c.stroke(); c.setLineDash([]); } });
      c.fillStyle = ink; const pr = perRow(), step = grain * 2 + 1;
      K().forEach((k, i) => { const n = counts[k] || 0, x0 = i * colW + (colW - pr * step) / 2 + grain; for (let j = 0; j < n; j++) { const r = Math.floor(j / pr), cidx = j % pr; c.beginPath(); c.arc(x0 + cidx * step, height - 6 - r * step - grain, grain * .9, 0, 6.2832); c.fill(); } });
      falling.forEach(g => { c.beginPath(); c.arc(g.x, g.y, grain * .9, 0, 6.2832); c.fill(); });
      if (ghost) { c.strokeStyle = sienna; c.setLineDash([5, 4]); c.lineWidth = 1.3; K().forEach((k, i) => { const p = ghost[k] || 0; if (p <= 0) return; const n = p * ghost.shots, rows = Math.ceil(n / pr), y = height - 6 - rows * step; c.beginPath(); c.moveTo(i * colW + colW * .14, y); c.lineTo(i * colW + colW * .86, y); c.stroke(); }); c.setLineDash([]); }
    }
    function read() { if (!total) { out.textContent = ''; return; } out.textContent = K().map(k => `|${k}⟩ ${fmt.p((counts[k] || 0) / total, 0)}`).join('   ·   ') + `   —   ${total} shot${total > 1 ? 's' : ''}`; }
    function drop(k, delay = 0) {
      return new Promise(res => { const i = K().indexOf(k); if (i < 0) return res(); const x = W / 2, tx = i * colW + colW / 2 + (Math.random() - .5) * colW * .3, g = { x, y: 8, k };
        if (Motion.reduced) { counts[k] = (counts[k] || 0) + 1; total++; return res(); }
        setTimeout(() => { falling.push(g); const t0 = performance.now(), ty = heapTop(k), dur = 380 + Math.random() * 140;
          const step = t => { const f = Math.min(1, (t - t0) / dur), e = f * f; g.x = x + (tx - x) * Math.min(1, f * 1.6); g.y = 8 + (ty - 8) * e; if (f >= 1) { falling.splice(falling.indexOf(g), 1); counts[k] = (counts[k] || 0) + 1; total++; paintKeys(); read(); res(); } };
          g.step = step; }, delay); });
    }
    function loop() { const t = performance.now(); falling.slice().forEach(g => g.step && g.step(t)); draw(); raf = falling.length ? requestAnimationFrame(loop) : 0; }
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    const api = {
      el: wrap,
      // pour: outcomes is an array of keys (already sampled). Grains fall faster as the pour goes on.
      async pour(outcomes, { maxAnimated = 120 } = {}) {
        const anim = outcomes.slice(0, maxAnimated), rest = outcomes.slice(maxAnimated); let d = 0; const ps = [];
        anim.forEach((k, i) => { ps.push(drop(k, d)); d += Math.max(8, 110 - i * 3); }); const iv = setInterval(kick, 30); kick();
        await Promise.all(ps); clearInterval(iv);
        if (rest.length) { const chunk = Math.max(1, Math.ceil(rest.length / 24)); for (let i = 0; i < rest.length; i += chunk) { rest.slice(i, i + chunk).forEach(k => { counts[k] = (counts[k] || 0) + 1; total++; }); paintKeys(); read(); draw(); await Motion.wait(28); } }
        draw(); return Object.assign({}, counts);
      },
      clear() { counts = {}; total = 0; falling = []; ghost = null; paintKeys(); read(); draw(); },
      ghost(p, shots) { ghost = p ? Object.assign({}, p, { shots }) : null; draw(); },
      setKeys(k) { keys = k; api.clear(); size(); },
      get counts() { return Object.assign({}, counts); }, get total() { return total; }
    };
    new ResizeObserver(size).observe(wrap); size();
    return api;
  }
  // sample outcome keys (q0 leftmost) from a probability map
  function sampleKeys(prob, shots, seed) { const rng = Sim.mulberry(seed ?? ((Math.random() * 2 ** 31) | 0)), ks = Object.keys(prob), out = []; for (let s = 0; s < shots; s++) { let r = rng(), k = ks[ks.length - 1]; for (const x of ks) { r -= prob[x]; if (r <= 0) { k = x; break; } } out.push(k); } return out; }

  /* ---------------- shaper: predict by dragging bins ---------------- */
  function Shaper(host, { keys, value, onChange, height = 190, label = 'Your prediction' } = {}) {
    let v = value ? keys.map(k => value[k] || 0) : keys.map(() => 1 / keys.length), touched = false;
    const sv = svg('svg', { class: 'shaper chart', role: 'group', 'aria-label': label }), wrap = h('div', { class: 'shaper-wrap' }, sv); host.replaceChildren(wrap);
    let W = 0; const base = height - 28, top = 14;
    function norm(fixed) { const s = v.reduce((a, b) => a + b, 0); if (s <= 0) { v = v.map(() => 1 / v.length); return; } if (fixed == null || v.length === 1) { v = v.map(x => x / s); return; } const others = s - v[fixed], want = 1 - v[fixed]; if (others <= 1e-9) { v = v.map((x, i) => i === fixed ? x : want / (v.length - 1)); } else v = v.map((x, i) => i === fixed ? x : x * want / others); }
    function set(i, x) { v[i] = Math.max(0, Math.min(1, x)); norm(i); touched = true; paint(); onChange && onChange(api.value); }
    function paint() {
      W = Math.max(240, wrap.clientWidth || 420); sv.setAttribute('viewBox', `0 0 ${W} ${height}`); sv.setAttribute('width', W); sv.setAttribute('height', height); sv.replaceChildren();
      const step = W / keys.length, bw = Math.min(64, step * .56);
      svg('line', { class: 'ax', x1: 0, x2: W, y1: base + .5, y2: base + .5 }, sv);
      [.25, .5, .75, 1].forEach(g => { const y = base - (base - top) * g; svg('line', { class: 'grid', x1: 0, x2: W, y1: y, y2: y }, sv); const t = svg('text', { x: W - 2, y: y - 3, 'text-anchor': 'end' }, sv); t.textContent = fmt.p(g, 0); });
      keys.forEach((k, i) => {
        const x = step * i + (step - bw) / 2, hgt = (base - top) * v[i], g = svg('g', { class: 'bin', role: 'slider', tabindex: 0, 'aria-label': `Predicted odds of |${k}⟩`, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(v[i] * 100), 'aria-valuetext': fmt.p(v[i], 0) }, sv);
        svg('rect', { class: 'bin-hit', x: step * i, y: top - 10, width: step, height: base - top + 10 }, g);
        svg('rect', { class: 'bin-bar', x, y: base - hgt, width: bw, height: Math.max(0, hgt) }, g);
        svg('line', { class: 'bin-cap', x1: x - 6, x2: x + bw + 6, y1: base - hgt, y2: base - hgt }, g);
        const t = svg('text', { x: x + bw / 2, y: base - hgt - 8, 'text-anchor': 'middle', class: 'bin-val' }, g); t.textContent = fmt.p(v[i], 0);
        const kt = svg('text', { x: x + bw / 2, y: base + 18, 'text-anchor': 'middle' }, g); kt.textContent = '|' + k + '⟩';
        const fromY = e => { const r = sv.getBoundingClientRect(), y = (e.clientY - r.top) * height / r.height; set(i, (base - y) / (base - top)); };
        g.addEventListener('pointerdown', e => { e.preventDefault(); g.setPointerCapture(e.pointerId); fromY(e); const mv = ev => fromY(ev), up = () => { g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.focus({ preventScroll: true }); }; g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); });
        g.addEventListener('keydown', e => { const d = { ArrowUp: .05, ArrowRight: .05, ArrowDown: -.05, ArrowLeft: -.05, PageUp: .25, PageDown: -.25 }[e.key]; if (d != null) { e.preventDefault(); set(i, v[i] + d); sv.querySelectorAll('.bin')[i].focus(); } });
      });
    }
    const api = { el: wrap, get value() { const o = {}; keys.forEach((k, i) => o[k] = v[i]); return o; }, get touched() { return touched; }, set(val) { v = keys.map(k => val[k] || 0); paint(); }, repaint: paint };
    new ResizeObserver(() => paint()).observe(wrap); paint();
    return api;
  }

  /* ---------------- needle: turn a phase by hand ---------------- */
  function Needle(host, { value = 0, onInput, onChange, label = 'Relative phase φ', R = 54, snap = Math.PI / 8 } = {}) {
    let v = value; const S = 2 * R + 44;
    const sv = svg('svg', { class: 'needle', viewBox: `0 0 ${S} ${S}`, width: S, height: S, role: 'slider', tabindex: 0, 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 360 });
    const c = S / 2; svg('circle', { class: 'nd-ring', cx: c, cy: c, r: R }, sv);
    for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, l = k % 4 ? 5 : 10; svg('line', { class: 'nd-tick', x1: c + Math.cos(a) * R, y1: c - Math.sin(a) * R, x2: c + Math.cos(a) * (R - l), y2: c - Math.sin(a) * (R - l) }, sv); }
    [['0', 0], ['π/2', Math.PI / 2], ['π', Math.PI], ['3π/2', 3 * Math.PI / 2]].forEach(([t, a]) => { const e = svg('text', { class: 'nd-lab', x: c + Math.cos(a) * (R + 14), y: c - Math.sin(a) * (R + 14) + 4, 'text-anchor': 'middle' }, sv); e.textContent = t; });
    const arc = svg('path', { class: 'nd-arc' }, sv), ln = svg('line', { class: 'nd-needle', x1: c, y1: c }, sv), tip = svg('circle', { class: 'nd-tip', r: 6 }, sv); svg('circle', { class: 'q-hub', cx: c, cy: c, r: 2.5 }, sv);
    const out = h('span', { class: 'mono nd-read' });
    function paint() { const x = c + Math.cos(v) * (R - 4), y = c - Math.sin(v) * (R - 4); ln.setAttribute('x2', x); ln.setAttribute('y2', y); tip.setAttribute('cx', x); tip.setAttribute('cy', y); const r = R * .36, large = v > Math.PI ? 1 : 0; arc.setAttribute('d', v < 1e-3 ? '' : `M${c + r} ${c} A${r} ${r} 0 ${large} 0 ${c + Math.cos(v) * r} ${c - Math.sin(v) * r}`); out.textContent = 'φ = ' + fmt.ang(v); sv.setAttribute('aria-valuenow', Math.round(v * 180 / Math.PI)); sv.setAttribute('aria-valuetext', fmt.ang(v)); }
    function set(x, fire = true) { x = ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); const sn = Math.round(x / snap) * snap; if (Math.abs(sn - x) < .07) x = sn % (2 * Math.PI); v = x; paint(); fire && onInput && onInput(v); }
    const fromE = e => { const r = sv.getBoundingClientRect(), x = (e.clientX - r.left) * S / r.width - c, y = (e.clientY - r.top) * S / r.height - c; set(Math.atan2(-y, x)); };
    sv.addEventListener('pointerdown', e => { e.preventDefault(); sv.setPointerCapture(e.pointerId); fromE(e); sv.focus({ preventScroll: true }); const mv = ev => fromE(ev), up = () => { sv.removeEventListener('pointermove', mv); sv.removeEventListener('pointerup', up); onChange && onChange(v); }; sv.addEventListener('pointermove', mv); sv.addEventListener('pointerup', up); });
    sv.addEventListener('keydown', e => { const d = { ArrowUp: snap, ArrowRight: -snap, ArrowDown: -snap, ArrowLeft: snap }[e.key]; if (d != null) { e.preventDefault(); set(v + d); onChange && onChange(v); } });
    const el = h('div', { class: 'needle-wrap' }, sv, h('div', {}, h('span', { class: 'lbl' }, label), h('br'), out)); host && host.replaceChildren(el); paint();
    return { el, set: x => set(x, false), get value() { return v; } };
  }

  /* ---------------- one qubit, drawn large ---------------- */
  // opts: {gates:[..], theta, phi, needle, measure, bases, R, start:'DSL', onState(s, info), label}
  function QubitStage(host, opts = {}) {
    const R = opts.R || 118, SW = R * 2 + 90, SH = R * 2 + 70;
    let ops = opts.start ? Q.parse(1, opts.start).ops : [], manual = null, basis = opts.basis || 'Z', measured = null;
    const E = {};
    const sph = svg('svg', { class: 'qs-sphere', viewBox: `0 0 ${SW} ${SH}`, width: SW, height: SH, role: 'img', 'aria-label': 'Bloch sphere of the qubit' });
    const S = Ink.sphere(sph, { cx: SW / 2, cy: SH / 2 + 6, R, ghost: !!opts.ghost, tipR: 6 });
    const disks = svg('svg', { class: 'qs-disks', role: 'img', 'aria-label': 'Amplitude disks: area is probability, needle is phase' });
    E.bars = h('div', { class: 'qs-odds' });
    E.gates = h('div', { class: 'qs-gates', role: 'toolbar', 'aria-label': 'Gates' });
    E.ctl = h('div', { class: 'qs-ctl' });
    E.read = h('p', { class: 'qs-read mono', 'aria-live': 'polite' });
    const left = h('div', { class: 'qs-left' }, sph), right = h('div', { class: 'qs-right' }, h('p', { class: 'lbl' }, 'Amplitudes'), disks, h('p', { class: 'lbl', style: { marginTop: '14px' } }, opts.basis ? 'Odds in the chosen basis' : 'Odds of reading 0 or 1'), E.bars, E.read);
    const el = h('div', { class: 'qstage' + (opts.compact ? ' compact' : '') }, left, right, h('div', { class: 'qs-foot' }, E.gates, E.ctl));
    host.replaceChildren(el);
    const stateOf = () => { if (manual) { const s = Sim.zero(1); s.re[0] = Math.cos(manual.theta / 2); s.re[1] = Math.sin(manual.theta / 2) * Math.cos(manual.phi); s.im[1] = Math.sin(manual.theta / 2) * Math.sin(manual.phi); return s; } return Sim.run({ n: 1, ops }); };
    const basisOps = { Z: [], X: [{ g: 'H', q: [0], c: [], p: [], col: 0 }], Y: [{ g: 'SDG', q: [0], c: [], p: [], col: 0 }, { g: 'H', q: [0], c: [], p: [], col: 1 }] };
    function oddsIn(s, b) { const u = Sim.copy(s); u.n = 1; basisOps[b].forEach(o => Sim.applyUnitary(u, o, {})); const p = Sim.probs(u); return [p[0], p[1]]; }
    const bLab = { Z: ['0', '1'], X: ['+', '−'], Y: ['+i', '−i'] };
    function paint(anim = true) {
      const s = stateOf(), b = Sim.bloch(s, 0); anim ? S.to(b, .45) : (S.st.v = b, S.draw());
      Ink.field(disks, s, { per: 2, cell: 92, R: 34, n: 1 });
      const [p0, p1] = oddsIn(s, basis);
      E.bars.replaceChildren(...[[bLab[basis][0], p0], [bLab[basis][1], p1]].map(([k, p]) => h('div', { class: 'qs-bar' }, h('span', { class: 'mono' }, `|${k}⟩`), h('i', { style: { '--s': p.toFixed(4) } }), h('b', { class: 'mono' }, fmt.f(p, 3)))));
      const a0 = [s.re[0], s.im[0]], a1 = [s.re[1], s.im[1]];
      E.read.textContent = `|ψ⟩ = ${fmt.cplx(a0[0], a0[1])} |0⟩ + ${fmt.cplx(a1[0], a1[1])} |1⟩`;
      opts.onState && opts.onState(s, { ops: ops.slice(), bloch: b, odds: { [bLab[basis][0]]: p0, [bLab[basis][1]]: p1 }, basis, manual: manual && Object.assign({}, manual) });
    }
    async function apply(g, p) {
      const o = IR.op(g, [0], { p: p || [], col: ops.length }); ops.push(o);
      const M = Sim.mat(o, {}), aa = Sim.axisAngle(M);
      if (aa.angle > 1e-6 && !Motion.reduced) { await S.rotate(aa.axis, aa.angle, .55); }
      paint(false); announce(`${Sim.displayName(o)} applied.`);
    }
    if (opts.gates) { E.gates.append(h('span', { class: 'lbl' }, 'Apply')); opts.gates.forEach(g => { const b = h('button', { type: 'button', class: `gmark chip-${paletteChip(g)} fam-${paletteFam(g)}`, title: paletteTitle(g), 'aria-label': `Apply ${paletteTitle(g)}` }, LABEL[g] || g); b.addEventListener('click', () => { manual = null; apply(g); }); E.gates.append(b); });
      E.gates.append(h('button', { type: 'button', class: 'btn', onclick: () => { ops = []; S.st.traces = []; paint(); } }, 'Reset to |0⟩')); }
    if (opts.theta || opts.phi) {
      manual = { theta: opts.theta0 || 0, phi: opts.phi0 || 0 };
      if (opts.theta) E.ctl.append(E.th = Ctl.slider({ label: 'θ tilt', min: 0, max: Math.PI, step: Math.PI / 96, value: manual.theta, fmt: v => fmt.ang(v), onInput: v => { manual.theta = v; paint(false); }, notches: 4 }));
      if (opts.phi) E.ctl.append((E.nd = Needle(null, { value: manual.phi, label: opts.phiLabel || 'Phase of |1⟩', onInput: v => { manual.phi = v; paint(false); } })).el);
    }
    if (opts.bases) E.ctl.append(h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Measure along'), Ctl.words(['Z', 'X', 'Y'].map(b => ({ value: b, label: `${b} (${bLab[b].map(x => '|' + x + '⟩').join(' ')})` })), basis, v => { basis = v; paint(false); opts.onBasis && opts.onBasis(v); }, { label: 'Measurement basis' })));
    paint(false);
    return {
      el, sphere: S, paint, apply, get state() { return stateOf(); }, get ops() { return ops.slice(); }, get basis() { return basis; }, set basis(b) { basis = b; paint(false); },
      odds() { return oddsIn(stateOf(), basis); }, keys: () => bLab[basis],
      setManual(m) { manual = Object.assign(manual || {}, m); E.th && E.th.set(manual.theta); E.nd && E.nd.set(manual.phi); paint(); },
      reset() { ops = opts.start ? Q.parse(1, opts.start).ops : []; S.st.traces = []; paint(); },
      // collapse animation: arrow snaps to a pole
      async collapse(v) { const t = basis === 'Z' ? [0, 0, v ? -1 : 1] : basis === 'X' ? [v ? -1 : 1, 0, 0] : [0, v ? -1 : 1, 0]; S.to(t, .25); await Motion.wait(420); paint(); }
    };
  }

  /* ---------------- ghost sphere: predict the arrow ---------------- */
  function GhostSphere(host, { R = 110, value = [0, 0, 1], onChange, label = 'Drag the ghost arrow to where you think the qubit will point' } = {}) {
    const SW = R * 2 + 80, SH = R * 2 + 64; let v = value.slice();
    const sv = svg('svg', { class: 'qs-sphere ghosting', viewBox: `0 0 ${SW} ${SH}`, width: SW, height: SH, role: 'img', 'aria-label': label });
    const S = Ink.sphere(sv, { cx: SW / 2, cy: SH / 2 + 4, R, ghost: true, tipR: 5 }); S.E.arrow.style.opacity = .12; S.E.tip.style.opacity = .12; S.E.gG.classList.add('is-on');
    const setV = (x, fire = true) => { const L = V3.len(x) || 1; v = x.map(y => y / L); S.st.ghost = v; S.draw(); th.set(Math.acos(Math.max(-1, Math.min(1, v[2])))); fire && onChange && onChange(v); };
    const inv = (e) => { const r = sv.getBoundingClientRect(), g = S.g, x = ((e.clientX - r.left) * SW / r.width - g.cx) / g.R, y = -((e.clientY - r.top) * SH / r.height - g.cy) / g.R; let d = x * x + y * y, q0 = x, q1 = y, q2; if (d > 1) { const L = Math.sqrt(d); q0 /= L; q1 /= L; q2 = 0; } else q2 = Math.sqrt(1 - d); const a = g.view.yaw, p = g.view.pitch; const y1 = Math.sin(p) * q1 - Math.cos(p) * q2, v2 = Math.cos(p) * q1 + Math.sin(p) * q2; return [q0 * Math.cos(a) - y1 * Math.sin(a), q0 * Math.sin(a) + y1 * Math.cos(a), v2]; };
    sv.addEventListener('pointerdown', e => { e.preventDefault(); sv.setPointerCapture(e.pointerId); setV(inv(e)); const mv = ev => setV(inv(ev)), up = () => { sv.removeEventListener('pointermove', mv); sv.removeEventListener('pointerup', up); }; sv.addEventListener('pointermove', mv); sv.addEventListener('pointerup', up); });
    const polar = () => Math.acos(Math.max(-1, Math.min(1, v[2]))), az = () => Math.atan2(v[1], v[0]);
    const th = Ctl.slider({ label: 'θ', min: 0, max: Math.PI, step: Math.PI / 48, value: polar(), fmt: x => fmt.ang(x), onInput: t => { const a = az(); setV([Math.sin(t) * Math.cos(a), Math.sin(t) * Math.sin(a), Math.cos(t)]); } });
    const ph = Needle(null, { value: (az() + 2 * Math.PI) % (2 * Math.PI), label: 'Azimuth φ', R: 40, onInput: a => { const t = polar(); setV([Math.sin(t) * Math.cos(a), Math.sin(t) * Math.sin(a), Math.cos(t)]); } });
    const el = h('div', { class: 'ghost-wrap' }, sv, h('div', { class: 'ghost-ctl' }, h('p', { class: 'small' }, 'Drag on the sphere, or set the angles:'), th, ph.el));
    host.replaceChildren(el); setV(v, false);
    return { el, sphere: S, get value() { return v.slice(); }, set: x => setV(x, false), reveal(b) { S.E.arrow.style.opacity = 1; S.E.tip.style.opacity = 1; S.to(b, .6); } };
  }
  return { Tray, Shaper, Needle, QubitStage, GhostSphere, sampleKeys };
})();
