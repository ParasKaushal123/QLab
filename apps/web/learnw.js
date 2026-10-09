/* =====================================================================
   LEARN WIDGETS — the interactive examples inside lessons.
   LW.bloch · LW.sampler · LW.lab (mini circuit editor) · LW.chsh ·
   LW.grover · LW.qpe. Each returns { el, circuit?(), extra?() } so the
   lesson tutor can see what the learner is looking at.
===================================================================== */
const LW = (() => {
  const TAU = 2 * Math.PI;
  const ket = (i, n) => i.toString(2).padStart(n, '0');
  const pct = x => (x * 100).toFixed(x > .001 && x < .999 ? 1 : 0) + '%';
  function bars(host, rows, { max = 1, fmtv = pct, ghost } = {}) {
    host.replaceChildren(...rows.map(r => h('div', { class: 'lw-bar' + (r.hot ? ' hot' : '') }, h('span', { class: 'lw-bk mono' }, r.k),
      h('span', { class: 'lw-bt' }, h('i', { style: { width: Math.max(0, Math.min(1, r.v / max)) * 100 + '%' } }), ghost && r.g != null ? h('em', { style: { left: Math.min(1, r.g / max) * 100 + '%' } }) : null),
      h('b', { class: 'mono' }, fmtv(r.v)))));
  }
  function sphereBox(size = 150, label) {
    const s = svg('svg', { class: 'lw-sph', viewBox: `0 0 ${size} ${size}`, width: size, height: size, role: 'img', 'aria-label': label ? 'Bloch sphere of ' + label : 'Bloch sphere' });
    const api = Ink.sphere(s, { cx: size / 2, cy: size / 2, R: size * .34, tipR: size > 120 ? 5 : 3.5, labels: size > 110 });
    const wrap = h('figure', { class: 'lw-fig' }, s, label ? h('figcaption', { class: 'mono' }, label) : null);
    return { el: wrap, set: v => { api.st.v = v.slice(); api.draw(); }, api };
  }
  const cap = t => t ? h('p', { class: 'lw-cap' }, t) : null;

  /* ---------------- Bloch sphere explorer ---------------- */
  function bloch(o) {
    let th = o.theta ?? 0, ph = o.phi ?? 0;
    const S = sphereBox(220), pr = h('div', { class: 'lw-bars' }), fm = h('div', { class: 'lw-formula' }), ang = h('div', { class: 'lw-ang mono' });
    const st = h('div', { class: 'lw-ctl' });
    const sT = Ctl.slider({ label: 'θ', min: 0, max: Math.PI, step: Math.PI / 96, value: th, fmt: v => fmt.ang(v), onInput: v => { th = v; paint(); } });
    const sP = Ctl.slider({ label: 'φ', min: 0, max: TAU, step: Math.PI / 96, value: ph, fmt: v => fmt.ang(v), onInput: v => { ph = v; paint(); } });
    st.append(sT, sP);
    if (o.presets) st.append(h('div', { class: 'lw-presets' }, [['|0⟩', 0, 0], ['|1⟩', Math.PI, 0], ['|+⟩', Math.PI / 2, 0], ['|−⟩', Math.PI / 2, Math.PI], ['|i⟩', Math.PI / 2, Math.PI / 2], ['|−i⟩', Math.PI / 2, 3 * Math.PI / 2]].map(([l, t, p]) => h('button', { type: 'button', class: 'lw-pre', onclick: () => { th = t; ph = p; sT.set(t); sP.set(p); paint(); } }, l))));
    function paint() {
      const v = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)]; S.set(v);
      const a = Math.cos(th / 2), b = Math.sin(th / 2);
      bars(pr, [{ k: '0', v: a * a }, { k: '1', v: b * b }]);
      const f = x => (Math.abs(x) < 5e-4 ? 0 : x).toFixed(3);
      const pa = fmt.ang(ph).replace('π', '\\pi').replace('−', '-');
      const bp = Math.abs(b) < 5e-4 ? '' : Math.abs(ph) < 1e-9 ? `+ ${f(b)}\\,|1\\rangle` : `+ ${f(b)}\\,e^{i ${pa}}|1\\rangle`;
      Tex.into(fm, `|\\psi\\rangle = ${f(a)}\\,|0\\rangle ${bp}`, true);
      ang.textContent = `Bloch vector: x ${f(v[0])} · y ${f(v[1])} · z ${f(v[2])}`;
    }
    paint();
    const el = h('div', { class: 'lw lw-bloch' }, h('div', { class: 'lw-row' }, S.el, h('div', { class: 'lw-side' }, fm, pr, o.show && o.show.includes('angles') ? ang : null, st)), cap(o.caption));
    return { el, circuit: () => ({ n: 1, nc: 1, params: {}, ops: [{ id: 1, g: 'RY', q: [0], c: [], p: [th], col: 0 }, { id: 2, g: 'RZ', q: [0], c: [], p: [ph], col: 1 }] }) };
  }

  /* ---------------- measurement sampler ---------------- */
  function sampler(o) {
    let th = o.theta ?? Math.PI / 2, counts = { 0: 0, 1: 0 };
    const exact = () => { const p1 = Math.sin(th / 2) ** 2; return { 0: 1 - p1, 1: p1 }; };
    const B = h('div', { class: 'lw-bars' }), tot = h('p', { class: 'lw-note' }), S = sphereBox(150);
    const draw = () => { const n = counts[0] + counts[1], E = exact(); bars(B, ['0', '1'].map(k => ({ k, v: n ? counts[k] / n : 0, g: E[k] })), { ghost: true }); tot.textContent = n ? `${n.toLocaleString()} shots: ${counts[1]} ones (${pct(counts[1] / n)}). Exact P(1) = ${pct(E[1])} (the tick). Typical error at this many shots: ±${pct(Math.sqrt(E[1] * (1 - E[1]) / n))}.` : `Exact P(1) = ${pct(E[1])}. Take some shots.`; S.set([Math.sin(th), 0, Math.cos(th)]); };
    const shoot = k => { const E = exact(); for (let i = 0; i < k; i++) counts[Math.random() < E[1] ? 1 : 0]++; draw(); };
    const sl = Ctl.slider({ label: 'θ', min: 0, max: Math.PI, step: Math.PI / 48, value: th, fmt: v => fmt.ang(v), onInput: v => { th = v; counts = { 0: 0, 1: 0 }; draw(); } });
    const btns = h('div', { class: 'lw-presets' }, [1, 10, 100, 1000].map(k => h('button', { type: 'button', class: 'lw-pre', onclick: () => shoot(k) }, `+${k} shot${k > 1 ? 's' : ''}`)), h('button', { type: 'button', class: 'lw-pre ghost', onclick: () => { counts = { 0: 0, 1: 0 }; draw(); } }, 'Reset'));
    draw();
    return { el: h('div', { class: 'lw lw-sampler' }, h('div', { class: 'lw-row' }, S.el, h('div', { class: 'lw-side' }, sl, btns, B, tot)), cap(o.caption)), circuit: () => ({ n: 1, nc: 1, params: {}, ops: [{ id: 1, g: 'RY', q: [0], c: [], p: [th], col: 0 }] }), extra: () => tot.textContent };
  }

  /* ---------------- mini laboratory: tap-to-place circuit editor ---------------- */
  const LABEL = { SDG: 'S†', TDG: 'T†' };
  function lab(o, { onChange, task } = {}) {
    const n = o.n; let C = o.circuit ? Circ.parse(n, o.circuit) : { n, nc: n, ops: [], params: {} };
    let tool = null, pendingCtl = null, uid = 1000, param = o.slider ? o.slider.value : null, showSteps = false;
    const editable = !!(o.gates && o.gates.length);
    const svgHost = h('div', { class: 'lw-circ' }), panels = h('div', { class: 'lw-panels' }), steps = h('div', { class: 'lw-steps', hidden: true }), msg = h('p', { class: 'lw-msg', 'aria-live': 'polite' });
    const circ = () => {
      const c = { n, nc: n, ops: C.ops.slice(), params: Object.assign({}, C.params || {}) };
      if (o.slider) c.params[o.slider.name] = param;
      if (o.qft) { const x = Math.round(param), pre = []; for (let i = 0; i < n; i++) if ((x >> (n - 1 - i)) & 1) pre.push({ id: 900 + i, g: 'X', q: [i], c: [], p: [], col: 0 }); const q = Sim.qftOps([...Array(n).keys()], 1).map((op, k) => Object.assign({ id: 950 + k, c: [], p: [] }, op)); c.ops = pre.concat(q); }
      return c;
    };
    const colAt = ws => Math.max(-1, ...C.ops.filter(op => Sim.wires(op).some(w => ws.includes(w))).map(op => op.col)) + 1;
    function place(w) {
      if (!tool) return;
      if (tool === 'CNOT' || tool === 'CZ') {
        if (pendingCtl == null) { pendingCtl = w; msg.textContent = `Control on q${w}. Now tap the target wire.`; drawCirc(); return; }
        if (pendingCtl === w) { pendingCtl = null; msg.textContent = 'Pick a different wire for the target.'; drawCirc(); return; }
        C.ops.push({ id: uid++, g: tool === 'CNOT' ? 'X' : 'Z', q: [w], c: [pendingCtl], p: [], col: colAt([w, pendingCtl]) }); pendingCtl = null; msg.textContent = tool === 'CNOT' ? 'CNOT added. Tap a control wire for another.' : 'CZ added.';
      } else C.ops.push({ id: uid++, g: tool, q: [w], c: [], p: [], col: colAt([w]) });
      changed();
    }
    function relayout() { const order = C.ops.slice().sort((a, b) => a.col - b.col); const last = new Array(n).fill(-1); order.forEach(op => { const ws = Sim.wires(op); op.col = Math.max(...ws.map(w => last[w])) + 1; ws.forEach(w => last[w] = op.col); }); }
    function removeOp(id) { if (!editable) return; C.ops = C.ops.filter(op => op.id !== id); relayout(); changed(); }
    function changed() { drawCirc(); paint(); onChange && onChange(); }
    function drawCirc() {
      const c = circ(), cols = Math.max(3, ...c.ops.map(op => op.col + 1)) + (editable ? 1 : 0), R = 44, CW = 46, X0 = 40, W = X0 + cols * CW + 16, H = n * R + 6;
      const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'lw-svg', role: 'img', 'aria-label': `Circuit on ${n} qubit${n > 1 ? 's' : ''}` });
      const ys = w => w * R + R / 2 + 3;
      for (let w = 0; w < n; w++) {
        const y = ys(w), g = svg('g', { class: 'lw-wire' + (tool ? ' live' : '') + (pendingCtl === w ? ' ctl' : '') }, s);
        svg('rect', { x: 0, y: y - R / 2, width: W, height: R, class: 'lw-hit' }, g); svg('line', { x1: 28, y1: y, x2: W - 8, y2: y, class: 'lw-wl' }, g);
        const t = svg('text', { x: 4, y: y + 4, class: 'lw-q' }, g); t.textContent = 'q' + w;
        if (tool) g.addEventListener('click', () => place(w));
      }
      c.ops.forEach(op => {
        const x = X0 + op.col * CW + CW / 2, rm = editable && op.id < 900, g = svg('g', { class: 'lw-op' + (rm ? ' rm' : '') }, s);
        if ((op.c || []).length) { const all = Sim.wires(op); svg('line', { x1: x, y1: ys(Math.min(...all)), x2: x, y2: ys(Math.max(...all)), class: 'lw-cl' }, g); op.c.forEach(w => svg('circle', { cx: x, cy: ys(w), r: 5, class: 'lw-dot' }, g)); }
        if (op.g === 'X' && op.c.length) { const y = ys(op.q[0]); svg('circle', { cx: x, cy: y, r: 11, class: 'lw-plus' }, g); svg('path', { d: `M${x - 11} ${y}H${x + 11}M${x} ${y - 11}V${y + 11}`, class: 'lw-cl' }, g); }
        else if (op.g === 'Z' && op.c.length) svg('circle', { cx: x, cy: ys(op.q[0]), r: 5, class: 'lw-dot' }, g);
        else if (op.g === 'SWAP') { svg('line', { x1: x, y1: ys(op.q[0]), x2: x, y2: ys(op.q[1]), class: 'lw-cl' }, g); op.q.forEach(w => { const y = ys(w); svg('path', { d: `M${x - 6} ${y - 6}L${x + 6} ${y + 6}M${x + 6} ${y - 6}L${x - 6} ${y + 6}`, class: 'lw-cl' }, g); }); }
        else op.q.forEach(w => {
          const y = ys(w), pv = (op.p || [])[0], hasP = pv != null;
          svg('rect', { x: x - 18, y: y - 15, width: 36, height: 30, rx: 7, class: 'lw-box f-' + op.g }, g);
          const t = svg('text', { x, y: y + (hasP ? 0 : 4), class: 'lw-gt' }, g); t.textContent = LABEL[op.g] || op.g;
          if (hasP) { const u = svg('text', { x, y: y + 11, class: 'lw-pt' }, g); u.textContent = typeof pv === 'string' ? pv : fmt.ang(pv); }
        });
        const tt = svg('title', {}, g); tt.textContent = Insight.opName(op, c.params) + (rm ? ' — tap to remove' : '');
        if (rm) g.addEventListener('click', e => { e.stopPropagation(); removeOp(op.id); });
      });
      svgHost.replaceChildren(s);
    }
    const P = {}, show = o.show || [];
    if (show.includes('probs') || task) panels.append(h('div', { class: 'lw-pan' }, h('h5', {}, o.measure ? `Odds for q${o.measure.join(', q')}` : 'Outcome odds'), P.probs = h('div', { class: 'lw-bars' })));
    if (show.includes('field')) panels.append(h('div', { class: 'lw-pan' }, h('h5', {}, 'Amplitudes ', h('span', {}, 'area = probability · needle = phase')), P.field = svg('svg', { class: 'lw-field', role: 'img', 'aria-label': 'Amplitudes' })));
    if ((show.includes('bloch') || task) && n <= 3) { P.sph = []; const row = h('div', { class: 'lw-sphs' }); for (let q = 0; q < n; q++) { const b = sphereBox(n === 1 ? 160 : 118, 'q' + q); P.sph.push(b); row.append(b.el); } panels.append(h('div', { class: 'lw-pan' }, h('h5', {}, 'Each qubit ', h('span', {}, 'a short arrow = entangled')), row)); }
    if (show.includes('ent') && n === 2) panels.append(h('div', { class: 'lw-pan' }, h('h5', {}, 'Entanglement'), P.ent = h('div', { class: 'lw-bars' })));
    function paint() {
      let s; try { s = Sim.run(circ()); } catch (e) { msg.textContent = e.message; return; }
      if (P.probs) {
        if (o.measure) { const m = Sim.marginal(Sim.probs(s), n, o.measure); const keys = Array.from({ length: 1 << o.measure.length }, (_, i) => ket(i, o.measure.length)); bars(P.probs, keys.map(k => ({ k, v: m[k] || 0, hot: (m[k] || 0) > .999 }))); }
        else { const p = Sim.probs(s); bars(P.probs, Array.from(p).map((v, i) => ({ k: ket(i, n), v, hot: v > .999 })).filter(r => p.length <= 16 || r.v > 1e-9)); }
      }
      if (P.field) Ink.field(P.field, s, { n, per: Math.min(8, 1 << n), cell: 58, R: 22 });
      if (P.sph) P.sph.forEach((b, q) => b.set(Sim.bloch(s, q)));
      if (P.ent) { const a = s.re, im = s.im, mul = (i, j) => [a[i] * a[j] - im[i] * im[j], a[i] * im[j] + im[i] * a[j]], x = mul(0, 3), y = mul(1, 2), C2 = 2 * Math.hypot(x[0] - y[0], x[1] - y[1]); bars(P.ent, [{ k: 'concurrence', v: C2 }, { k: 'q0 arrow', v: Math.hypot(...Sim.bloch(s, 0)) }, { k: 'purity q0', v: Sim.purity(s, [0]) }], { fmtv: v => v.toFixed(3) }); }
      if (showSteps) paintSteps();
    }
    function paintSteps() { let N; try { N = Insight.narrate(circ()); } catch (e) { return; } steps.replaceChildren(...N.steps.map(st => h('div', { class: 'lw-step' }, h('b', {}, st.label + (st.gates.length ? ' · ' + st.gates.join(', ') : '')), h('p', {}, st.lines.join(' ')), h('p', { class: 'mono lw-st' }, st.state)))); }
    const toolbar = h('div', { class: 'lw-tools' });
    if (editable) {
      const btns = o.gates.map(g => {
        const b = h('button', { type: 'button', class: 'lw-tool f-' + g, 'aria-pressed': 'false', title: g === 'CNOT' ? 'CNOT: tap the control wire, then the target' : g === 'CZ' ? 'CZ: tap one wire, then the other' : `${g}: then tap a wire to add it` }, LABEL[g] || g);
        b.addEventListener('click', () => { tool = tool === g ? null : g; pendingCtl = null; btns.forEach(x => x.setAttribute('aria-pressed', String(x === b && tool === g))); msg.textContent = tool ? (tool === 'CNOT' || tool === 'CZ' ? 'Tap the control wire.' : `Tap a wire to add ${LABEL[tool] || tool}. Tap a placed gate to remove it.`) : ''; drawCirc(); });
        return b;
      });
      toolbar.append(h('span', { class: 'lw-tl' }, 'Gates'), ...btns, h('span', { class: 'grow' }), h('button', { type: 'button', class: 'lw-pre ghost', onclick: () => { C.ops.pop(); changed(); } }, 'Undo'), h('button', { type: 'button', class: 'lw-pre ghost', onclick: () => { C = o.circuit && !task ? Circ.parse(n, o.circuit) : { n, nc: n, ops: [], params: {} }; changed(); } }, 'Reset'));
    }
    if (o.presets) {
      const row = h('div', { class: 'lw-presets' }, o.presets.map((p, i) => { const b = h('button', { type: 'button', class: 'lw-pre' + (i === 0 ? ' on' : ''), onclick: () => { C = Circ.parse(n, p.src); row.querySelectorAll('.lw-pre.on').forEach(x => x.classList.remove('on')); b.classList.add('on'); changed(); } }, p.label); return b; }));
      toolbar.append(row); if (!o.circuit) C = Circ.parse(n, o.presets[0].src);
    }
    const slider = o.slider ? Ctl.slider({ label: o.slider.label, min: o.slider.min, max: o.slider.max, step: o.slider.step || (o.slider.max - o.slider.min) / 96, value: o.slider.value, fmt: v => o.slider.integer ? String(Math.round(v)) + (o.qft ? ` = |${ket(Math.round(v), n)}⟩` : '') : fmt.ang(v), onInput: v => { param = v; drawCirc(); paint(); onChange && onChange(); } }) : null;
    const expl = h('button', { type: 'button', class: 'lw-pre ghost' }, icon('play', 's'), 'Explain step by step');
    const setSteps = on => { showSteps = on; steps.hidden = !on; expl.lastChild.textContent = on ? 'Hide explanation' : 'Explain step by step'; if (on) paintSteps(); };
    expl.addEventListener('click', () => setSteps(!showSteps));
    const ask = o.askable !== false ? h('button', { type: 'button', class: 'lw-pre ghost lw-askbtn' }, icon('tutor', 's'), 'Ask the tutor about this') : null;
    const el = h('div', { class: 'lw lw-lab' }, toolbar.childNodes.length ? toolbar : null, slider ? h('div', { class: 'lw-ctl' }, slider) : null, svgHost, msg, panels, h('div', { class: 'lw-foot' }, expl, ask), steps, cap(o.caption));
    drawCirc(); paint(); if (show.includes('steps')) setSteps(true);
    return { el, circuit: circ, set(src) { C = Circ.parse(n, src); changed(); }, reset() { C = { n, nc: n, ops: [], params: {} }; changed(); } };
  }

  /* ---------------- CHSH game ---------------- */
  function chsh(o) {
    const A = [0, Math.PI / 2], B = [Math.PI / 4, -Math.PI / 4], terms = h('div', { class: 'lw-bars' });
    const E = (a, b) => Math.cos(a - b), S = () => E(A[0], B[0]) + E(A[0], B[1]) + E(A[1], B[0]) - E(A[1], B[1]);
    const sl = (arr, i, lab) => Ctl.slider({ label: lab, min: -Math.PI, max: Math.PI, step: Math.PI / 48, value: arr[i], fmt: v => fmt.ang(v), onInput: v => { arr[i] = v; paint(); } });
    const fill = h('i', { class: 'lw-gfill' }), val = h('b', { class: 'lw-gval mono' });
    const gauge = h('div', { class: 'lw-gauge' }, h('div', { class: 'lw-gtrack' }, fill, h('span', { class: 'lw-gmark c', style: { left: (2 / 3 * 100) + '%' } }, h('em', {}, 'classical limit 2')), h('span', { class: 'lw-gmark q', style: { left: (2 * Math.SQRT2 / 3 * 100) + '%' } }, h('em', {}, '2√2'))), val);
    function paint() {
      const e = [E(A[0], B[0]), E(A[0], B[1]), E(A[1], B[0]), -E(A[1], B[1])], s = S();
      bars(terms, [['E(a, b)', e[0]], ['E(a, b′)', e[1]], ['E(a′, b)', e[2]], ['−E(a′, b′)', e[3]]].map(([k, v]) => ({ k, v: (v + 1) / 2 })), { fmtv: v => (2 * v - 1).toFixed(3) });
      fill.style.width = Math.min(1, Math.abs(s) / 3) * 100 + '%'; gauge.classList.toggle('viol', Math.abs(s) > 2 + 1e-9);
      val.textContent = `S = ${s.toFixed(3)}${Math.abs(s) > 2 + 1e-9 ? ': no local hidden-variable model can do this' : ''}`;
    }
    paint();
    return { el: h('div', { class: 'lw lw-chshw' }, h('div', { class: 'lw-ctl two' }, sl(A, 0, 'Alice a'), sl(A, 1, 'Alice a′'), sl(B, 0, 'Bob b'), sl(B, 1, 'Bob b′')), gauge, terms, cap(o.caption)), extra: () => `CHSH widget: angles a=${fmt.ang(A[0])}, a'=${fmt.ang(A[1])}, b=${fmt.ang(B[0])}, b'=${fmt.ang(B[1])}; E=cos(θA−θB); S=${S().toFixed(3)}.` };
  }

  /* ---------------- Grover success curve ---------------- */
  function grover(o) {
    let nq = 4, k = 3; const chart = h('div', { class: 'lw-cols' }), info = h('p', { class: 'lw-note' });
    const best = N => { const th = Math.asin(1 / Math.sqrt(N)), f = i => Math.sin((2 * i + 1) * th) ** 2; let i = 0; while (f(i + 1) > f(i)) i++; return i; };
    let sk;
    function paint() {
      const N = 2 ** nq, th = Math.asin(1 / Math.sqrt(N)), kb = best(N), km = Math.max(kb * 2 + 2, 6); if (k > km) { k = km; sk && sk.set(k); }
      chart.replaceChildren(...Array.from({ length: km + 1 }, (_, i) => { const p = Math.sin((2 * i + 1) * th) ** 2; return h('div', { class: 'lw-col' + (i === k ? ' hot' : '') + (i === kb ? ' best' : ''), title: `${i} iterations: ${pct(p)}` }, h('i', { style: { height: Math.max(1, p * 100) + '%' } }), h('span', { class: 'mono' }, km > 24 && i % 2 ? '' : String(i))); }));
      const p = Math.sin((2 * k + 1) * th) ** 2;
      info.textContent = `N = ${N} items, θ = ${(th * 180 / Math.PI).toFixed(1)}°. After ${k} iteration${k === 1 ? '' : 's'} the marked item is found with probability ${pct(p)}. Best is ${kb} (≈ (π/4)√N = ${(Math.PI / 4 * Math.sqrt(N)).toFixed(1)}). A classical search needs ${N / 2} guesses on average.`;
    }
    const sn = Ctl.slider({ label: 'qubits', min: 1, max: 10, step: 1, value: nq, fmt: v => `${v} (N = ${2 ** v})`, onInput: v => { nq = v; paint(); } });
    sk = Ctl.slider({ label: 'iterations', min: 0, max: 52, step: 1, value: k, fmt: v => String(v), onInput: v => { k = v; paint(); } });
    paint();
    return { el: h('div', { class: 'lw' }, h('div', { class: 'lw-ctl two' }, sn, sk), chart, info, cap(o.caption)), extra: () => 'Grover widget: ' + info.textContent };
  }

  /* ---------------- phase estimation readout ---------------- */
  function qpe(o) {
    let phi = 0.375, t = 3; const chart = h('div', { class: 'lw-cols' }), info = h('p', { class: 'lw-note' });
    function paint() {
      const d = Sim.qpeDistribution(phi, t), Q = 1 << t; let bi = 0; d.forEach((v, i) => { if (v > d[bi]) bi = i; });
      chart.replaceChildren(...Array.from(d).map((v, i) => h('div', { class: 'lw-col' + (i === bi ? ' hot' : ''), title: `y = ${i} (${ket(i, t)}): ${pct(v)}` }, h('i', { style: { height: Math.max(1, v * 100) + '%' } }), h('span', { class: 'mono' }, Q <= 16 ? ket(i, t) : i % 8 ? '' : String(i)))));
      info.textContent = `φ = ${phi.toFixed(4)}, so φ·2ᵗ = ${(phi * Q).toFixed(3)}. Most likely readout y = ${bi} (${ket(bi, t)}), giving φ ≈ ${(bi / Q).toFixed(4)} with probability ${pct(d[bi])}.`;
    }
    const sp = Ctl.slider({ label: 'φ', min: 0, max: 1, step: 1 / 128, value: phi, fmt: v => v.toFixed(4), onInput: v => { phi = v; paint(); } });
    const st = Ctl.slider({ label: 'counting qubits t', min: 2, max: 6, step: 1, value: t, fmt: v => String(v), onInput: v => { t = v; paint(); } });
    paint();
    return { el: h('div', { class: 'lw' }, h('div', { class: 'lw-ctl two' }, sp, st), chart, info, cap(o.caption)), extra: () => 'Phase-estimation widget: ' + info.textContent };
  }
  return { bloch, sampler, lab, chsh, grover, qpe, bars, sphereBox };
})();
