/* =====================================================================
   ALGORITHMS — gallery + journey pages. Every stage node is computed live
   from the simulator: the state after that stage, the number on the
   connector, the resources table, the scaling chart.
===================================================================== */
const ALGOS = (() => {
  const rep = (k, f) => Array.from({ length: k }, (_, i) => f(i)).join(' ');
  const mcz = n => n === 1 ? 'Z0' : 'C'.repeat(n - 1) + 'Z' + rep(n, i => i).replace(/ /g, '.');
  const flipZeros = (s) => [...s].map((b, q) => b === '0' ? `X${q}` : '').filter(Boolean).join(' ');
  const oracle = (s) => { const f = flipZeros(s); return [f, mcz(s.length), f].filter(Boolean).join(' '); };
  const diffuser = n => `${rep(n, i => `H${i}`)} ${rep(n, i => `X${i}`)} ${mcz(n)} ${rep(n, i => `X${i}`)} ${rep(n, i => `H${i}`)}`;
  const markedFor = (n, M) => { const all = ['1'.repeat(n), '1' + '0'.repeat(n - 1) , '01'.repeat(n).slice(0, n), '10'.repeat(n).slice(0, n)]; return [...new Set(all)].slice(0, M); };
  return [
    { id: 'dj', title: 'Deutsch–Jozsa', level: 'Foundations', tag: 'Oracles', blurb: 'Is a hidden function constant or balanced? One quantum query decides; a classical check can need 2ⁿ⁻¹ + 1.',
      params: { n: { label: 'input qubits', min: 1, max: 6, val: 3 }, kind: { label: 'oracle', options: ['balanced', 'constant'], val: 'balanced' } },
      width: p => p.n + 1, reg: p => rep(p.n, i => i).split(' ').map(Number),
      stages: p => [['Superposition', `X${p.n} ${rep(p.n + 1, i => `H${i}`)}`], ['Oracle', p.kind === 'balanced' ? rep(p.n, i => `CX${i}.${p.n}`) : `X${p.n}`], ['Interference', rep(p.n, i => `H${i}`)], ['Measure', rep(p.n, i => `M${i}`)]],
      key: (p, dist) => ['P(0…0)', dist['0'.repeat(p.n)] || 0], verdict: (p, dist) => (dist['0'.repeat(p.n)] || 0) > .99 ? 'constant' : 'balanced',
      classical: n => Math.pow(2, n - 1) + 1, quantum: () => 1, qlabel: 'oracle queries', cite: 'D. Deutsch & R. Jozsa, Proc. R. Soc. Lond. A 439, 553 (1992).' },
    { id: 'bv', title: 'Bernstein–Vazirani', level: 'Foundations', tag: 'Oracles', blurb: 'Find a hidden bit-string s from f(x) = s·x mod 2. Quantumly: one query. Classically: n.',
      params: { s: { label: 'hidden string', options: ['101', '1101', '10110', '011', '111001'], val: '1101' } },
      width: p => p.s.length + 1, reg: p => [...p.s].map((_, i) => i),
      stages: p => { const n = p.s.length; return [['Superposition', `X${n} ${rep(n + 1, i => `H${i}`)}`], ['Oracle', [...p.s].map((b, i) => b === '1' ? `CX${i}.${n}` : '').filter(Boolean).join(' ')], ['Interference', rep(n, i => `H${i}`)], ['Read s', rep(n, i => `M${i}`)]]; },
      key: (p, dist) => [`P(${p.s})`, dist[p.s] || 0], classical: n => n, quantum: () => 1, qlabel: 'oracle queries', nOf: p => p.s.length, cite: 'E. Bernstein & U. Vazirani, SIAM J. Comput. 26, 1411 (1997).' },
    { id: 'grover', title: 'Grover search', level: 'Algorithms', tag: 'Search', blurb: 'Amplify the marked answers by repeated reflection. √N steps instead of N — and it overshoots if you keep going.',
      params: { n: { label: 'qubits', min: 2, max: 10, val: 3 }, M: { label: 'marked', min: 1, max: 2, val: 1 }, k: { label: 'iterations', min: 0, max: 30, val: -1 } },
      width: p => p.n, reg: p => rep(p.n, i => i).split(' ').map(Number),
      marked: p => markedFor(p.n, p.M), iters: p => p.k >= 0 ? p.k : Math.max(1, Math.floor(Math.PI / 4 * Math.sqrt((1 << p.n) / p.M))),
      stages(p) { const mk = this.marked(p), k = this.iters(p), one = mk.map(oracle).join(' ') + ' ' + diffuser(p.n); return [['Superposition', rep(p.n, i => `H${i}`)], ['Oracle', mk.map(oracle).join(' ')], ['Diffusion', diffuser(p.n)], [`× ${Math.max(0, k - 1)} more`, rep(Math.max(0, k - 1), () => one)], ['Measure', rep(p.n, i => `M${i}`)]]; },
      key(p, dist) { return ['P(marked)', this.marked(p).reduce((a, s) => a + (dist[s] || 0), 0)]; },
      classical: n => Math.pow(2, n) / 2, quantum: n => Math.max(1, Math.floor(Math.PI / 4 * Math.sqrt(Math.pow(2, n)))), qlabel: 'oracle calls (1 marked)', cite: 'L. K. Grover, Phys. Rev. Lett. 79, 325 (1997).' },
    { id: 'qpe', title: 'QFT → phase estimation', level: 'Algorithms', tag: 'Fourier', blurb: 'Read an eigenphase into a register of clocks. Each extra ancilla doubles the precision.',
      params: { t: { label: 'ancillas', min: 2, max: 7, val: 4 }, phi: { label: 'phase φ', min: 0, max: 1, step: 1 / 64, val: 0.3 } },
      width: p => p.t + 1, reg: p => rep(p.t, i => i).split(' ').map(Number),
      stages: p => [['Eigenstate', `X${p.t}`], ['Clocks', rep(p.t, i => `H${i}`)], ['Controlled powers', rep(p.t, k => `CP${k}.${p.t}(${(2 * Math.PI * p.phi * Math.pow(2, p.t - 1 - k)).toFixed(6)})`)], ['Inverse QFT', `IQFT${rep(p.t, i => i).replace(/ /g, '.')}`], ['Read φ', rep(p.t, i => `M${i}`)]],
      key: (p, dist) => { const best = Object.entries(dist).sort((a, b) => b[1] - a[1])[0] || ['0', 0]; return [`φ ≈ ${(parseInt(best[0], 2) / (1 << p.t)).toFixed(4)}`, best[1]]; },
      classical: t => Math.pow(2, t), quantum: t => t, qlabel: 'bits of precision cost', nOf: p => p.t, cite: 'A. Yu. Kitaev, arXiv:quant-ph/9511026 (1995); Cleve, Ekert, Macchiavello & Mosca, Proc. R. Soc. A 454, 339 (1998).' },
    { id: 'shor', title: 'Shor’s factoring', level: 'Algorithms', tag: 'Fourier', custom: 'shor', blurb: 'Factor N by finding the period of aˣ mod N: modular exponentiation, a QFT, continued fractions, then a gcd.',
      params: { N: { label: 'N', options: [15, 21], val: 15 }, a: { label: 'a', options: [2, 4, 7, 8, 11, 13], val: 7 } }, cite: 'P. W. Shor, SIAM J. Comput. 26, 1484 (1997). C. Gidney & M. Ekerå, Quantum 5, 433 (2021). C. Gidney, arXiv:2505.15917 (2025).' },
    { id: 'vqe', title: 'VQE for H₂', level: 'Near-term', tag: 'Variational', custom: 'vqe', blurb: 'A classical optimiser tunes a one-parameter circuit until its energy reaches the molecule’s ground state.',
      params: { R: { label: 'bond length Å', min: .3, max: 2.5, step: .005, val: .735 } }, cite: 'A. Peruzzo et al., Nat. Commun. 5, 4213 (2014); P. J. J. O’Malley et al., Phys. Rev. X 6, 031007 (2016).' },
    { id: 'qaoa', title: 'QAOA for MaxCut', level: 'Near-term', tag: 'Variational', custom: 'qaoa', blurb: 'Alternate a cost and a mixer layer, tune (γ, β), and read out a large cut of any graph you draw.',
      params: { p: { label: 'layers p', min: 1, max: 3, val: 1 } }, cite: 'E. Farhi, J. Goldstone & S. Gutmann, arXiv:1411.4028 (2014).' },
    { id: 'teleport', title: 'Teleportation', level: 'Foundations', tag: 'Protocols', blurb: 'Move an unknown qubit using one shared Bell pair and two classical bits — without moving the qubit.',
      params: { theta: { label: 'θ', min: 0, max: Math.PI, step: Math.PI / 48, val: 1.1 }, phi: { label: 'φ', min: 0, max: 2 * Math.PI, step: Math.PI / 48, val: .7 } }, m1: 'Teleport fidelity', m2: ['Classical bits sent', '2', 'plus one shared Bell pair'],
      width: () => 3, reg: () => [2], spheres: [0, 2],
      stages: p => [['Prepare ψ', `U0(${p.theta},${p.phi},0)`], ['Share a Bell pair', 'H1 CX1.2'], ['Bell measurement', 'CX0.1 H0'], ['Corrections', 'CX1.2 CZ0.2'], ['Bob holds ψ', '']],
      key: (p, dist, s) => { const target = Sim.bloch(Sim.run(Q.parse(1, `U0(${p.theta},${p.phi},0)`)), 0), b = Sim.bloch(s, 2); return ['fidelity', (1 + b[0] * target[0] + b[1] * target[1] + b[2] * target[2]) / 2]; },
      note: 'Corrections are applied as controlled gates (deferred measurement); the Laboratory version measures mid-circuit and feeds forward.', cite: 'C. H. Bennett et al., Phys. Rev. Lett. 70, 1895 (1993).' },
    { id: 'bitflip', title: 'Bit-flip code', level: 'Hardware', tag: 'Error correction', blurb: 'Spread one qubit over three, read two parities without looking at the data, and undo a flip.',
      params: { err: { label: 'flip qubit', options: [-1, 0, 1, 2], val: 1 } }, m1: 'Logical fidelity', m2: ['Syndrome bits', '2', 'data never measured'],
      width: () => 5, reg: () => [3, 4],
      stages: p => [['Encode', 'RY0(1.2) CX0.1 CX0.2'], ['Error', p.err >= 0 ? `X${p.err}` : ''], ['Syndrome', 'CX0.3 CX1.3 CX1.4 CX2.4'], ['Correct', 'X4 CCX3.4.0 X4 CCX3.4.1 X3 CCX3.4.2 X3'], ['Decode', 'CX0.2 CX0.1']],
      key: (p, dist, s) => { const b = Sim.bloch(s, 0), t = Sim.bloch(Sim.run(Q.parse(1, 'RY0(1.2)')), 0); return ['logical fidelity', (1 + b[0] * t[0] + b[1] * t[1] + b[2] * t[2]) / 2]; }, cite: 'A. Peres, Phys. Rev. A 32, 3266 (1985); Nielsen & Chuang §10.1.' }
  ];
})();
window.ALGOS = ALGOS;

const Algos = (() => {
  let filter = 'All';
  const par = a => Object.fromEntries(Object.entries(a.params || {}).map(([k, v]) => [k, (Store.get().algoParams || {})[a.id]?.[k] ?? v.val]));
  const saveP = (a, p) => Store.set('algoParams', Object.assign({}, Store.get().algoParams, { [a.id]: p }));
  function build(a, p) { const n = a.width(p), segs = a.stages(p); let acc = ''; const out = segs.map(([t, dsl]) => { acc = (acc + ' ' + dsl).trim(); return { t, dsl, C: Q.parse(n, acc) }; }); return { n, segs: out, C: out[out.length - 1].C }; }
  function margin(s, n, reg) { return Sim.marginal(Sim.probs(s), n, reg); }
  const keysOf = k => Array.from({ length: 1 << k }, (_, i) => i.toString(2).padStart(k, '0'));
  function preview(a) {
    const box = h('div', { class: 'alg-prev' });
    if (a.custom === 'vqe') { const sv = svg('svg', { role: 'img', 'aria-label': 'H₂ dissociation curve' }); const pts = []; for (let R = .35; R <= 2.5; R += .1) pts.push([R, Sim.h2(R).E0]); Ink.lines(sv, { series: [{ pts }], width: 300, height: 150, xlabel: 'R (Å)' }); box.append(sv); return box; }
    if (a.custom === 'shor') { const P = Sim.shorDistribution(7, 15, 4), d = {}; P.forEach((v, i) => d[i.toString(2).padStart(4, '0')] = v); box.append(Mini.hist(d, keysOf(4), { w: 280, hgt: 110, color: 'var(--t-lilac-i)' })); return box; }
    if (a.custom === 'qaoa') { box.append(graphSvg(6, ringEdges(6), Sim.qaoa(6, ringEdges(6), [.6], [.4]).probs, 150)); return box; }
    const p = par(a), B = build(a, p), s = Sim.run(Grade.strip(B.C)), d = margin(s, B.n, a.reg(p)); box.append(Mini.hist(d, a.reg(p).length <= 5 ? keysOf(a.reg(p).length) : Object.keys(d).sort(), { w: 280, hgt: 110 })); return box;
  }
  /* ---------------- gallery ---------------- */
  function gallery(el) {
    const tags = ['All', ...new Set(ALGOS.map(a => a.tag))];
    App.top(['Algorithms'], [Ctl.words(tags.map(t => ({ value: t, label: t })), filter, v => { filter = v; paint(); }, { label: 'Filter' })]);
    const grid = h('div', { class: 'alg-grid' });
    function paint() { grid.replaceChildren(...ALGOS.filter(a => filter === 'All' || a.tag === filter).map(a => { const p = par(a), q = a.width ? a.width(p) : a.id === 'shor' ? '8+' : a.id === 'qaoa' ? 6 : 2;
      return h('a', { class: 'card alg-card', href: '#alg-' + a.id }, preview(a), h('h3', {}, a.title), h('p', { class: 'small' }, a.blurb), h('div', { class: 'row' }, h('span', { class: 'badge ' + ({ Foundations: 'b-cyan', Algorithms: 'b-violet', 'Near-term': 'b-lime', Hardware: 'b-magenta' }[a.level]) }, a.level), h('span', { class: 'badge b-ink' }, `${q} qubits`), h('span', { class: 'badge b-ink' }, a.tag))); })); }
    el.replaceChildren(h('div', { class: 'page' }, h('header', { class: 'page-head' }, h('h1', { class: 'display' }, 'Algorithms'), h('p', { class: 'prose' }, 'Nine algorithms as journeys: each stage is a card showing the live state, and every connector carries the number that changed.')), grid)); paint();
  }
  /* ---------------- page ---------------- */
  function page(el, id) {
    const a = ALGOS.find(x => x.id === id); if (!a) { el.replaceChildren(h('div', { class: 'page' }, h('h1', { class: 'display' }, 'Not found'))); return; }
    const p = par(a); el.replaceChildren(); const host = h('div', { style: { position: 'absolute', inset: '0' } }); el.append(host);
    const B = Board(host, { id: 'alg-' + a.id, fitKeys: () => [...B.cards.keys()].filter(k => /^(m-|m[A-Z]|st\d|s\d|run)/.test(k)) }); let noisy = false, redraw;
    const ctl = Object.entries(a.params || {}).map(([k, d]) => { if (d.options) return Ctl.menu({ label: d.label, options: d.options.map(o => ({ value: o, label: `${d.label}: ${o < 0 ? 'none' : o}` })), value: p[k], onChange: v => { p[k] = v; saveP(a, p); redraw(); } });
      if (d.step) { const w = h('div', { class: 'pill slide-pill' }); const sl = Ctl.slider({ label: d.label, min: d.min, max: d.max, step: d.step, value: p[k], fmt: v => k === 'phi' && a.id === 'qpe' ? v.toFixed(4) : (k === 'theta' || k === 'phi') ? fmt.ang(v) : v.toFixed(3), onInput: v => { p[k] = v; redraw(true); }, onChange: () => { saveP(a, p); redraw(); } }); w.append(sl); return w; }
      const val = h('b', { class: 'mono' }), set = v => { p[k] = Math.max(k === 'k' ? -1 : d.min, Math.min(k === 'M' ? d.max : d.max, v)); val.textContent = k === 'k' && p[k] < 0 ? 'best' : p[k]; saveP(a, p); redraw(); };
      const w = h('div', { class: 'pill stepper', role: 'group', 'aria-label': d.label }, h('span', { class: 'lbl' }, d.label), h('button', { type: 'button', 'aria-label': `Fewer ${d.label}`, onclick: () => set((k === 'k' && p[k] < 0 ? a.iters(p) : p[k]) - 1) }, icon('minus', 's')), val, h('button', { type: 'button', 'aria-label': `More ${d.label}`, onclick: () => set((k === 'k' && p[k] < 0 ? a.iters(p) : p[k]) + 1) }, icon('plus', 's'))); val.textContent = k === 'k' && p[k] < 0 ? 'best' : p[k]; return w; });
    const nz = h('button', { type: 'button', class: 'pill', 'aria-pressed': 'false' }, icon('noise', 's'), 'Noisy run'); nz.addEventListener('click', () => { noisy = !noisy; nz.setAttribute('aria-pressed', String(noisy)); redraw(); });
    App.top(['Algorithms', a.title], [...ctl, a.custom ? null : nz]);
    const T = h('div'); Toolbar(host, [{ icon: 'select', title: 'Select', pressed: true, on: () => B.tool = 'select' }, { icon: 'pan', title: 'Pan', on: () => B.tool = 'pan' }, '|', h('a', { class: 'tb', href: '#algorithms' }, icon('back', 's'), 'Gallery'), a.custom ? null : h('button', { type: 'button', class: 'tb', onclick: () => { const b2 = build(a, p); Lab.load(Object.assign(IR.clone(b2.C), { name: a.title })); location.hash = '#lab'; } }, icon('lab', 's'), 'Open in the Lab'), '|', ...zoomControls(B)].filter(Boolean));
    if (a.custom) { const r = CUSTOM[a.custom](B, a, p, host); redraw = r.redraw; redraw(); return { destroy() { B.destroy(); } }; }
    // metric cards, stage nodes, scaling, resources, code
    const M = ['success', 'iters', 'qubits', 'cx'].map((k, i) => B.add('m-' + k, { x: 40 + i * 270, y: 30, w: 250, tint: ['blue', 'rose', 'lime', 'lilac'][i], resizable: false, title: { success: a.m1 || 'Success probability', iters: a.m2 ? a.m2[0] : a.id === 'grover' ? 'Iterations' : 'Oracle queries', qubits: 'Qubits', cx: 'Depth · CX' }[k], icon: { success: 'target', iters: 'history', qubits: 'lab', cx: 'layers' }[k] }));
    const NODE_Y = 250, NW = 250, GAP = 60; let nodes = [], sCard, rCard, cCard, codeLang = 'qiskit';
    redraw = (fast) => {
      const b = build(a, p), n = b.n, reg = a.reg(p);
      // nodes
      if (nodes.length !== b.segs.length) { nodes.forEach(k => B.remove(k)); nodes = b.segs.map((sg, i) => { const k = 'st' + i; B.add(k, { x: 40 + i * (NW + GAP), y: NODE_Y, w: NW, title: `${i + 1} · ${sg.t}`, icon: i === b.segs.length - 1 ? 'chart' : 'layers', resizable: false }); if (i) B.link('st' + (i - 1), k, { key: 'l' + i }); return k; }); }
      let last = null;
      b.segs.forEach((sg, i) => { const c = B.cards.get('st' + i), s = Sim.run(Grade.strip(sg.C)), d = margin(s, n, reg), keys = reg.length <= 5 ? keysOf(reg.length) : Object.entries(d).sort((x, y) => y[1] - x[1]).slice(0, 12).map(x => x[0]).sort();
        c.title(`${i + 1} · ${sg.t}`); c.body.replaceChildren();
        if (a.spheres) { const row = h('div', { class: 'row', style: { justifyContent: 'space-around' } }); a.spheres.forEach(q => { const col = h('div', { class: 'sph-col' }); col.append(Mini.sphere(Sim.bloch(s, q), 34), h('span', { class: 'lbl' }, q === 0 ? 'Alice q0' : 'Bob q2')); row.append(col); }); c.body.append(row); }
        else c.body.append(Mini.hist(d, keys, { w: 214, hgt: 84 }));
        const [kl, kv] = a.key(p, d, s); c.body.append(h('p', { class: 'lbl', style: { marginTop: '6px' } }, sg.dsl ? `${Sim.expand(Q.parse(n, sg.dsl)).length} gates` : 'no gates'));
        if (i) B.label('l' + i, `${kl} ${typeof kv === 'number' ? fmt.p(kv, 1) : kv}`, i === b.segs.length - 1 && typeof kv === 'number' && kv > .9 ? 'good' : ''); last = { d, s, kv }; });
      const m = Passes.metrics(b.C), nn = a.nOf ? a.nOf(p) : (p.n || n);
      const put = (k, big, sub) => { const c = B.cards.get('m-' + k); c.body.replaceChildren(h('span', { class: 'big m' }, big), h('p', { class: 'delta' }, sub)); };
      put('success', fmt.p(last.kv, 1), a.verdict ? `says: ${a.verdict(p, last.d)}` : a.key(p, last.d, last.s)[0]);
      put('iters', a.m2 ? a.m2[1] : a.id === 'grover' ? String(a.iters(p)) : '1', a.id === 'grover' ? `optimal ⌊π/4·√(N/M)⌋ = ${Math.max(1, Math.floor(Math.PI / 4 * Math.sqrt((1 << p.n) / p.M)))}` : a.m2 ? a.m2[2] : a.classical ? `classical: ${fmt.n(a.classical(nn))}` : 'one run');
      put('qubits', String(n), `${reg.length} read out`); put('cx', `${m.depth} · ${m.cx}`, `${m.gates} gates before translation`);
      if (fast) return;
      // ideal vs noisy run node
      B.remove('run'); const rc = B.add('run', { x: 40 + b.segs.length * (NW + GAP), y: NODE_Y, w: 300, title: noisy ? 'Ideal vs noisy' : 'Ideal run', icon: 'play', tint: 'blue', resizable: false }); B.link('st' + (b.segs.length - 1), 'run', { key: 'lrun', label: '1,000 shots' });
      const runC = Object.assign({}, b.C, { ops: b.C.ops.concat(reg.filter(q => !b.C.ops.some(o => o.g === 'M' && o.q[0] === q)).map(q => IR.op('M', [q], { cb: q, col: 999 }))) });
      Backends.runCircuit({ circuit: runC, backend: 'browser', shots: 1000, noise: noisy ? Backends.DEVICE_NOISE : null }).then(r => { if (!B.cards.has('run')) return; const keys = Object.keys(r.counts).sort(), prob = {}; keys.forEach(k => prob[k] = r.counts[k] / r.shots); const sv = svg('svg', { role: 'img', 'aria-label': 'Run result' }); rc.body.replaceChildren(sv, h('p', { class: 'lbl' }, `${r.meta.method}${noisy ? ' with device-like noise' : ''}`)); Ink.histogram(sv, { keys: keys.length <= 32 ? (reg.length <= 5 ? keysOf(reg.length) : keys) : keys.slice(0, 32), ideal: r.exact || null, series: [Object.assign(r, { fill: true })], width: 260, height: 150 }); });
      // scaling chart
      if (a.classical) { B.remove('scale'); const sc = B.add('scale', { x: 40, y: 640, w: 460, title: 'Classical vs quantum', icon: 'trend' }); const sv = svg('svg', { role: 'img', 'aria-label': 'Scaling chart' }); const ns = Array.from({ length: 12 }, (_, i) => i + 2); Ink.lines(sv, { series: [{ pts: ns.map(x => [x, a.classical(x)]) }, { pts: ns.map(x => [x, a.quantum(x)]) }], width: 420, height: 210, xlabel: 'n', ylabel: a.qlabel, ylog: true }); sc.body.append(sv, h('div', { class: 'legend' }, h('span', {}, h('i', { class: 'sw', style: { background: 'var(--violet)' } }), 'classical'), h('span', {}, h('i', { class: 'sw', style: { background: 'var(--magenta)' } }), 'quantum'))); }
      // resources for growing n
      B.remove('res'); const rs = B.add('res', { x: 530, y: 640, w: 420, title: 'Resources as n grows', icon: 'table' });
      const range = a.params.n ? [2, 3, 4, 5, 6, 7, 8, 9, 10].filter(v => v >= a.params.n.min && v <= a.params.n.max) : a.params.t ? [2, 3, 4, 5, 6, 7] : null;
      if (range) { const rows = range.map(v => { const pp = Object.assign({}, p, a.params.n ? { n: v } : { t: v }); const C2 = build(a, pp).C, mm = Passes.metrics(C2); return h('tr', { class: v === (p.n || p.t) ? 'cur' : '' }, h('td', { class: 'num' }, v), h('td', { class: 'num' }, C2.n), h('td', { class: 'num' }, mm.depth), h('td', { class: 'num' }, mm.cx), h('td', { class: 'num' }, mm.tcount ?? '–')); }); rs.body.append(h('table', { class: 'tbl' }, h('tr', {}, ...['n', 'qubits', 'depth', 'CX', 'T'].map(x => h('th', { class: 'num' }, x))), ...rows)); }
      else { const mm = Passes.metrics(b.C); rs.body.append(h('table', { class: 'tbl' }, ...[['qubits', b.C.n], ['depth', mm.depth], ['CX after translation', mm.cx], ['T-count', mm.tcount ?? '–']].map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', { class: 'num' }, v))))); }
      rs.body.append(h('p', { class: 'small', style: { marginTop: '8px' } }, 'Counted by the compiler after translation to {CX, RZ, SX, X}.'));
      // code
      B.remove('code'); const cc = B.add('code', { x: 980, y: 640, w: 520, title: 'Code', icon: 'code' }); const box = h('div'); const words = Ctl.words(['qiskit', 'cirq', 'pennylane', 'qasm'].map(l => ({ value: l, label: { qiskit: 'Qiskit', cirq: 'Cirq', pennylane: 'PennyLane', qasm: 'QASM 3' }[l] })), codeLang, v => { codeLang = v; CB.set(Code.gen(v, runC).text); }, { label: 'SDK' }); cc.body.append(words, box); const CB = Course.CodeBox(box, { value: Code.gen(codeLang, runC).text, editable: false });
      B.remove('refs'); const rf = B.add('refs', { x: 1530, y: 640, w: 420, title: 'Variants, limits and sources', icon: 'course' }); rf.body.append(h('p', { class: 'small' }, a.note || ''), h('p', { class: 'small' }, a.cite));
    };
    redraw();
    return { destroy() { B.destroy(); } };
  }
  /* ---------------- custom journeys: Shor, VQE, QAOA ---------------- */
  const ringEdges = n => Array.from({ length: n }, (_, i) => [i, (i + 1) % n]);
  function graphSvg(n, edges, probs, size = 220, cut) {
    const s = svg('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, role: 'img', 'aria-label': `Graph with ${n} nodes and ${edges.length} edges` }), R = size / 2 - 22, P = i => [size / 2 + R * Math.cos(2 * Math.PI * i / n - Math.PI / 2), size / 2 + R * Math.sin(2 * Math.PI * i / n - Math.PI / 2)];
    let z = cut; if (z == null && probs) { let b = 0; probs.forEach((v, i) => { if (v > probs[b]) b = i; }); z = b; }
    edges.forEach(([a, b]) => { const [x1, y1] = P(a), [x2, y2] = P(b), cutE = z != null && (((z >> (n - 1 - a)) & 1) !== ((z >> (n - 1 - b)) & 1)); svg('line', { x1, y1, x2, y2, stroke: cutE ? 'var(--magenta)' : 'var(--hair2)', 'stroke-width': cutE ? 2.5 : 1.5, 'stroke-dasharray': cutE ? '5 4' : null }, s); });
    for (let i = 0; i < n; i++) { const [x, y] = P(i), side = z != null ? (z >> (n - 1 - i)) & 1 : 0; const g = svg('g', { 'data-node': i, class: 'gnode' }, s); svg('circle', { cx: x, cy: y, r: 13, fill: side ? 'var(--lime)' : 'var(--sky)', stroke: 'var(--plum)', 'stroke-width': 1.2 }, g); const t = svg('text', { x, y: y + 4, 'text-anchor': 'middle', 'font-size': 11, 'font-family': 'var(--mono)', fill: 'var(--plum)' }, g); t.textContent = i; }
    return s;
  }
  const CUSTOM = {
    shor(B, a, p, host) {
      const put = (k, x, y, w, title, ic, tint) => B.add(k, { x, y, w, title, icon: ic, tint, resizable: false });
      const t = 8; ['N', 'r', 'f'].forEach((k, i) => put('m' + k, 40 + i * 270, 30, 250, { N: 'Number to factor', r: 'Period r', f: 'Factors' }[k], { N: 'target', r: 'history', f: 'trophy' }[k], ['blue', 'rose', 'lime'][i]));
      const st = [['s0', 'Choose a', 'target'], ['s1', 'Modular exponentiation', 'trend'], ['s2', 'QFT peaks', 'chart'], ['s3', 'Continued fractions', 'list'], ['s4', 'gcd → factors', 'check']];
      st.forEach(([k, ti, ic], i) => { put(k, 40 + i * 330, 250, i === 3 ? 310 : 290, `${i + 1} · ${ti}`, ic); if (i) B.link(st[i - 1][0], k, { key: 'l' + i }); });
      const rs = put('res', 40, 700, 620, 'At RSA scale', 'cpu', 'lilac'), rf = put('refs', 690, 700, 560, 'Sources', 'course');
      rs.body.append(h('p', { class: 'small', style: { color: 'var(--ti)' } }, 'Factoring a 2048-bit RSA modulus needs error-corrected machines far beyond today’s: Gidney & Ekerå (2021) estimated about 20 million noisy qubits running for 8 hours; Gidney (2025) brought the estimate under one million noisy qubits in under a week. The largest numbers factored by running Shor’s circuit directly are still tiny, like the 15 and 21 on this page.'));
      rf.body.append(h('p', { class: 'small' }, a.cite));
      return { redraw() {
        const N = p.N, g = Sim.gcd(p.a, N), r = g === 1 ? Sim.order(p.a, N) : null, Q2 = 1 << t;
        const c = k => { const x = B.cards.get(k); x.body.replaceChildren(); return x.body; };
        c('mN').append(h('span', { class: 'big m' }, String(N)), h('p', { class: 'delta' }, `with a = ${p.a}`));
        c('s0').append(h('p', { class: 'small' }, `gcd(${p.a}, ${N}) = ${g}.`), h('p', { class: 'small' }, g === 1 ? 'Coprime, so aˣ mod N is periodic and the quantum part can find the period.' : `Lucky: ${g} already divides ${N} — no quantum computer needed. Pick another a to see the algorithm.`));
        if (g !== 1) { ['s1', 's2', 's3', 's4', 'mr', 'mf'].forEach(k => c(k).append(h('p', { class: 'small' }, '—'))); return; }
        const xs = Array.from({ length: 16 }, (_, x) => [x, Sim.modpow(p.a, x, N)]); const sv = svg('svg', { role: 'img', 'aria-label': `${p.a}^x mod ${N}` }); Ink.lines(sv, { series: [{ pts: xs }], width: 250, height: 140, xlabel: 'x', ylabel: 'aˣ mod N', marks: xs.slice(0, r + 1).map(q => [q[0], q[1]]) }); c('s1').append(sv, h('p', { class: 'lbl' }, `repeats every ${r} steps`));
        const P = Sim.shorDistribution(p.a, N, t), d = {}; P.forEach((v, i) => d[i.toString(2).padStart(t, '0')] = v); const peaks = [...P].map((v, i) => [i, v]).filter(x => x[1] > .01).sort((x, y) => y[1] - x[1]);
        const hs = svg('svg', { role: 'img', 'aria-label': 'QFT register distribution' }); c('s2').append(hs, h('p', { class: 'lbl' }, `${t} counting qubits · peaks at multiples of ${Q2}/${r}`)); { const w = 250, hh = 110; hs.setAttribute('viewBox', `0 0 ${w} ${hh}`); hs.setAttribute('width', w); hs.setAttribute('height', hh); const m = Math.max(...P); P.forEach((v, i) => svg('rect', { x: i * w / Q2, y: hh - v / m * (hh - 6), width: Math.max(1, w / Q2 - .5), height: v / m * (hh - 6), rx: 1, fill: 'var(--t-lilac-i)' }, hs)); }
        const ladder = h('div', { class: 'ladder' }); let found = null; peaks.slice(0, 4).forEach(([y]) => { const cf = Sim.contFrac(y, Q2, N), last = cf[cf.length - 1], rr = last ? last[1] : 1, ok = Sim.modpow(p.a, rr, N) === 1 && rr > 0; if (ok && !found) found = rr; ladder.append(h('div', { class: 'ld-row' + (ok ? ' ok' : '') }, h('span', { class: 'mono' }, `y = ${y}`), h('span', { class: 'mono' }, `${y}/${Q2} ≈ ${last ? `${last[0]}/${last[1]}` : '0'}`), h('span', { class: 'badge ' + (ok ? 'b-lime' : 'b-ink') }, ok ? `r = ${rr} ✓` : `r = ${rr}?`))); });
        c('s3').append(ladder); const fr = found || r, half = Sim.modpow(p.a, fr / 2, N), f1 = fr % 2 ? null : Sim.gcd(half - 1, N), f2 = fr % 2 ? null : Sim.gcd(half + 1, N), good = f1 && f1 !== 1 && f1 !== N;
        c('s4').append(h('p', { class: 'small mono' }, fr % 2 ? `r = ${fr} is odd — try another a.` : `a^(r/2) = ${half}`), fr % 2 ? null : h('p', { class: 'small mono' }, `gcd(${half}−1, ${N}) = ${f1}, gcd(${half}+1, ${N}) = ${f2}`), h('p', { class: 'small' }, good ? `${N} = ${f1} × ${N / f1}` : `This a gives trivial factors (a^(r/2) ≡ −1 mod N). Pick another.`));
        c('mr').append(h('span', { class: 'big m' }, String(r)), h('p', { class: 'delta' }, `${p.a}^${r} ≡ 1 (mod ${N})`)); c('mf').append(h('span', { class: 'big m' }, good ? `${f1} × ${N / f1}` : '—'), h('p', { class: 'delta' }, good ? 'found' : 'try another a'));
        B.label('l1', `period ${r}`); B.label('l2', `${peaks.length} peaks`); B.label('l3', `P(peak) ${fmt.p(peaks[0][1], 1)}`, ''); B.label('l4', good ? `${f1} × ${N / f1}` : 'retry', good ? 'good' : 'bad');
      } };
    },
    vqe(B, a, p) {
      const put = (k, x, y, w, title, ic, tint) => B.add(k, { x, y, w, title, icon: ic, tint, resizable: false });
      ['E', 'X', 'D'].forEach((k, i) => put('m' + k, 40 + i * 270, 30, 250, { E: 'VQE energy', X: 'Exact (FCI)', D: 'Error' }[k], { E: 'target', X: 'check', D: 'gauge' }[k], ['blue', 'lime', 'rose'][i]));
      const st = [['s0', 'Hamiltonian', 'list', 290], ['s1', 'Ansatz circuit', 'lab', 300], ['s2', 'Energy landscape', 'trend', 330], ['s3', 'Dissociation curve', 'chart', 360]];
      let x = 40; st.forEach(([k, ti, ic, w], i) => { put(k, x, 250, w, `${i + 1} · ${ti}`, ic); x += w + 40; if (i) B.link(st[i - 1][0], k, { key: 'l' + i }); });
      put('refs', 40, 720, 640, 'Sources', 'course').body.append(h('p', { class: 'small' }, 'Minimal STO-3G basis, exact integrals, reduced to two qubits. Real devices use more terms, measure each Pauli group separately, and fight shot noise and gate error.'), h('p', { class: 'small' }, a.cite));
      let path = [], curve = [];
      const run = h('button', { type: 'button', class: 'primary', onclick: () => optimise() }, icon('play', 's'), 'Run the optimiser'); B.cards.get('s2').head.append(run);
      async function optimise() { const H = Sim.h2(p.R); let th = -2.5; path = [[th, Sim.h2Energy(H, th)]]; for (let i = 0; i < 40; i++) { const g = (Sim.h2Energy(H, th + 1e-4) - Sim.h2Energy(H, th - 1e-4)) / 2e-4; th -= .6 * g / Math.max(.2, Math.abs(H.c) * 2); path.push([th, Sim.h2Energy(H, th)]); draw(true); await Motion.wait(60); } }
      function draw(pathOnly) { const H = Sim.h2(p.R), ths = Array.from({ length: 121 }, (_, i) => -Math.PI + 2 * Math.PI * i / 120), E = ths.map(t => [t, Sim.h2Energy(H, t)]), best = E.reduce((a2, b) => b[1] < a2[1] ? b : a2);
        const c = k => { const x2 = B.cards.get(k); x2.body.replaceChildren(); return x2.body; };
        const sv = svg('svg', { role: 'img', 'aria-label': 'Energy as a function of θ' }); Ink.lines(sv, { series: [{ pts: E }], width: 300, height: 180, xlabel: 'θ', ylabel: 'E (Ha)', marks: path.length ? [path[path.length - 1]] : [best] }); if (path.length > 1) { const pp = svg('path', { d: '', fill: 'none', stroke: 'var(--magenta)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' }, sv); } c('s2').append(sv, h('p', { class: 'lbl' }, path.length ? `step ${path.length - 1}: θ = ${path[path.length - 1][0].toFixed(3)}` : 'press Run to watch gradient descent'));
        const cur = path.length ? path[path.length - 1][1] : best[1];
        c('mE').append(h('span', { class: 'big m' }, cur.toFixed(4)), h('p', { class: 'delta' }, 'Hartree')); c('mX').append(h('span', { class: 'big m' }, H.E0.toFixed(4)), h('p', { class: 'delta' }, `at R = ${p.R.toFixed(3)} Å`)); c('mD').append(h('span', { class: 'big m' }, (Math.abs(cur - H.E0) * 1000).toFixed(2)), h('p', { class: 'delta' }, 'mHa · chemical accuracy is 1.6'));
        B.label('l2', `E(θ*) ${best[1].toFixed(4)} Ha`); B.label('l3', `R = ${p.R.toFixed(3)} Å`);
        if (pathOnly) return;
        c('s0').append(h('p', { class: 'small mono', style: { whiteSpace: 'pre-wrap' } }, H.hamiltonian.replace(/ ([+-]) /g, '\n$1 ')), h('p', { class: 'lbl' }, `Hartree–Fock ${H.Ehf.toFixed(4)} Ha`)); B.label('l1', '5 Pauli terms');
        const sc = h('div'); c('s1').append(sc, h('p', { class: 'lbl' }, 'RY(θ) · CX · X → cos(θ/2)|01⟩ + sin(θ/2)|10⟩')); Score(sc, { circ: Templates.vqeH2(), editable: false, compact: true, playhead: false });
        const cv = svg('svg', { role: 'img', 'aria-label': 'Dissociation curve' }); c('s3').append(cv); if (!curve.length) Work.call('h2curve', { Rs: Array.from({ length: 45 }, (_, i) => .3 + i * .05) }).then(r => { curve = r; drawCurve(cv); }); else drawCurve(cv); }
      function drawCurve(cv) { if (!cv.isConnected) return; Ink.lines(cv, { series: [{ pts: curve.map(q => [q.R, q.E0]) }, { pts: curve.map(q => [q.R, q.Ehf]) }], width: 330, height: 190, xlabel: 'R (Å)', ylabel: 'E (Ha)', marks: [[p.R, Sim.h2(p.R).E0, `${p.R.toFixed(2)} Å`]] }); }
      return { redraw: () => { path = []; draw(); } };
    },
    qaoa(B, a, p) {
      const put = (k, x, y, w, title, ic, tint) => B.add(k, { x, y, w, title, icon: ic, tint, resizable: false });
      let n = 6, edges = (Store.get().qaoaEdges || ringEdges(6).concat([[0, 3]])).filter(([u, v]) => u < n && v < n), pick = null, grid = null, best = null;
      ['R', 'C', 'B'].forEach((k, i) => put('m' + k, 40 + i * 270, 30, 250, { R: 'Approximation ratio', C: 'Expected cut', B: 'Best cut (brute force)' }[k], { R: 'gauge', C: 'target', B: 'check' }[k], ['blue', 'rose', 'lime'][i]));
      const st = [['s0', 'Draw your graph', 'grid', 300], ['s1', '(γ, β) landscape', 'layers', 320], ['s2', 'Most likely cut', 'target', 300], ['s3', 'Against classical', 'chart', 300]];
      let x = 40; st.forEach(([k, ti, ic, w], i) => { put(k, x, 250, w, `${i + 1} · ${ti}`, ic); x += w + 40; if (i) B.link(st[i - 1][0], k, { key: 'l' + i }); });
      put('refs', 40, 730, 640, 'Sources', 'course').body.append(h('p', { class: 'small' }, 'Click two nodes of the graph to add or remove an edge. The landscape is exact for p = 1; for deeper circuits the page tunes all layers by coordinate search.'), h('p', { class: 'small' }, a.cite));
      const optimise = () => { let G = Array(p.p).fill(.6), Bt = Array(p.p).fill(.4); if (grid) { let bi = 0, bj = 0; grid.forEach((row, i) => row.forEach((v, j) => { if (v > grid[bi][bj]) { bi = i; bj = j; } })); G = Array(p.p).fill(Math.PI * bi / 23); Bt = Array(p.p).fill(Math.PI / 2 * bj / 23); } let cur = Sim.qaoa(n, edges, G, Bt).expect; for (let it = 0; it < 3; it++) for (let l = 0; l < p.p; l++) for (const arr of [G, Bt]) for (const d of [.2, .05, .01]) for (const sgn of [1, -1]) { const old = arr[l]; arr[l] += sgn * d; const e = Sim.qaoa(n, edges, G, Bt).expect; if (e > cur) cur = e; else arr[l] = old; } return { G, Bt }; };
      function draw() {
        const c = k => { const x2 = B.cards.get(k); x2.body.replaceChildren(); return x2.body; };
        let bestCut = 0, bestZ = 0; for (let z = 0; z < 1 << n; z++) { const v = Sim.cutValue(z, n, edges); if (v > bestCut) { bestCut = v; bestZ = z; } }
        let greedy = 0; { let side = 0; for (let i = 0; i < n; i++) { const a0 = Sim.cutValue(side, n, edges), a1 = Sim.cutValue(side | (1 << (n - 1 - i)), n, edges); if (a1 > a0) side |= 1 << (n - 1 - i); } greedy = Sim.cutValue(side, n, edges); }
        const g0 = graphSvg(n, edges, null, 250, -1 >>> 0 & 0); g0.querySelectorAll('.gnode').forEach(nd => { nd.style.cursor = 'pointer'; nd.addEventListener('click', () => { const i = +nd.dataset.node; if (pick == null) { pick = i; nd.querySelector('circle').setAttribute('stroke-width', 3); return; } if (pick !== i) { const k = edges.findIndex(([u, v]) => (u === pick && v === i) || (u === i && v === pick)); if (k >= 0) edges.splice(k, 1); else edges.push([Math.min(pick, i), Math.max(pick, i)]); Store.set('qaoaEdges', edges); grid = null; } pick = null; draw(); }); });
        c('s0').append(g0, h('p', { class: 'lbl' }, `${n} nodes · ${edges.length} edges`)); B.label('l1', `${edges.length} edges`);
        const hv = svg('svg', { role: 'img', 'aria-label': 'Expected cut over gamma and beta' }); c('s1').append(hv, h('p', { class: 'lbl' }, 'p = 1 · γ ∈ [0, π] down · β ∈ [0, π/2] across'));
        const finish = () => { const { G, Bt } = optimise(), r = Sim.qaoa(n, edges, G, Bt); best = r; let z = 0; r.probs.forEach((v, i) => { if (v > r.probs[z]) z = i; });
          Ink.heat(hv, grid, { size: 240, color: 'var(--violet)' });
          c('s2').append(graphSvg(n, edges, null, 250, z), h('p', { class: 'lbl mono' }, `${z.toString(2).padStart(n, '0')} · cut ${Sim.cutValue(z, n, edges)} · P ${fmt.p(r.probs[z], 1)}`));
          const bars = h('div', { class: 'kv' }, ...[['Brute force (2ⁿ checks)', bestCut], ['Greedy', greedy], [`QAOA p=${p.p} expected`, r.expect.toFixed(2)], ['QAOA most likely', Sim.cutValue(z, n, edges)]].map(([k, v]) => h('div', {}, h('span', {}, k), h('b', {}, String(v))))); c('s3').append(bars);
          c('mR').append(h('span', { class: 'big m' }, fmt.p(r.ratio, 1)), h('p', { class: 'delta' }, `p = ${p.p}`)); c('mC').append(h('span', { class: 'big m' }, r.expect.toFixed(2)), h('p', { class: 'delta' }, `of ${edges.length} edges`)); c('mB').append(h('span', { class: 'big m' }, String(bestCut)), h('p', { class: 'delta' }, `greedy found ${greedy}`));
          B.label('l2', `ratio ${fmt.p(r.ratio, 1)}`, r.ratio > .85 ? 'good' : ''); B.label('l3', `cut ${Sim.cutValue(z, n, edges)} / ${bestCut}`); };
        if (grid) finish(); else Work.call('qaoaGrid', { n, edges, res: 24, gmax: Math.PI, bmax: Math.PI / 2 }).then(g => { grid = g; if (hv.isConnected) finish(); });
      }
      return { redraw: draw };
    }
  };
  return { gallery, page, build };
})();
