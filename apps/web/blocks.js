/* =====================================================================
   BLOCKS — the Block Library: small parameterised generators that return
   circuit IR (built with IR.op, or Q.parse where the notation is shorter).
   Grover-SAT from CNF clauses · QPE from a unitary + bit count ·
   Shor-15, the textbook construction for N = 15 (a in {2,7,8,11,13}) ·
   QAOA MaxCut from a graph + p · plus QFT, GHZ, W and a ripple-carry
   adder. Exported as const Blocks with list + build(name, params),
   and an optional mount(el) panel with small forms.
   Loading this file never touches the DOM and needs only IR at call time.
===================================================================== */
const Blocks = (() => {
  const PI = Math.PI;
  const needIR = () => { if (typeof IR === 'undefined') throw new Error('IR is not loaded.'); };
  const needQ = () => { if (typeof Q === 'undefined') throw new Error('Q is not loaded.'); };
  /* IR.fromList-shaped helper built only from IR.op */
  function L(n, name, list, extra) {
    needIR();
    return Object.assign({ n, nc: n, name, ops: list.map(([g, q, o]) => IR.op(g, q.slice(), o || {})), defs: {}, params: {} }, extra || {});
  }
  /* column placer: earliest column whose wires are all free */
  function placer(n) {
    const front = new Array(n).fill(0); let cfront = 0;
    return {
      put(g, q, o = {}) {
        needIR();
        const w = [...(o.c || []), ...q], col = Math.max(cfront && o.cond ? cfront : 0, ...w.map(x => front[x]));
        const op = IR.op(g, q.slice(), Object.assign({}, o, { col }));
        w.forEach(x => { front[x] = col + 1; });
        if (g === 'M') cfront = Math.max(cfront, col + 1);
        return op;
      },
    };
  }
  const measureAll = (P, n) => { for (let q = 0; q < n; q++) P.put('M', [q], { cb: q }); };
  const modpow = (a, e, N) => { let r = 1, b = ((a % N) + N) % N; while (e) { if (e & 1) r = (r * b) % N; b = (b * b) % N; e >>= 1; } return r; };
  const orderOf = (a, N) => { let r = 1, v = ((a % N) + N) % N; while (v !== 1) { v = (v * a) % N; r++; if (r > N + 1) return null; } return r; };

  /* QFT ops on wires qs (q0 = most significant), own loop, no Sim needed */
  function qftOps(qs, inverse) {
    const seq = [];
    for (let i = 0; i < qs.length; i++) {
      seq.push({ g: 'H', q: [qs[i]] });
      for (let j = i + 1; j < qs.length; j++) seq.push({ g: 'P', q: [qs[i]], c: [qs[j]], p: [PI / (1 << (j - i))] });
    }
    for (let i = 0; i < Math.floor(qs.length / 2); i++) seq.push({ g: 'SWAP', q: [qs[i], qs[qs.length - 1 - i]] });
    return inverse ? seq.slice().reverse().map(o => (o.g === 'P' ? Object.assign({}, o, { p: [-o.p[0]] }) : o)) : seq;
  }

  function diffusion(P, qs) {
    qs.forEach(q => P.put('H', [q]));
    qs.forEach(q => P.put('X', [q]));
    if (qs.length === 1) P.put('Z', qs.slice());
    else P.put('Z', [qs[qs.length - 1]], { c: qs.slice(0, -1) });
    qs.forEach(q => P.put('X', [q]));
    qs.forEach(q => P.put('H', [q]));
  }

  const gen = {
    ghz(p = {}) {
      const n = Math.max(2, Math.min(12, (p.n | 0) || 3));
      const P = placer(n), ops = [];
      ops.push(P.put('H', [0]));
      for (let i = 1; i < n; i++) ops.push(P.put('X', [i], { c: [i - 1] }));
      measureAll({ put: (g, q, o) => ops.push(P.put(g, q, o)) }, n);
      return Object.assign(L(n, `GHZ, ${n} qubits`, []), { ops });
    },
    qft(p = {}) {
      const n = Math.max(1, Math.min(8, (p.n | 0) || 3));
      const P = placer(n), ops = qftOps([...Array(n).keys()], false).map(o => P.put(o.g, o.q, o));
      return Object.assign(L(n, `QFT, ${n} qubits`, []), { ops });
    },
    iqft(p = {}) {
      const n = Math.max(1, Math.min(8, (p.n | 0) || 3));
      const P = placer(n), ops = qftOps([...Array(n).keys()], true).map(o => P.put(o.g, o.q, o));
      return Object.assign(L(n, `Inverse QFT, ${n} qubits`, []), { ops });
    },
    w() {
      // W state, 3 qubits (same angles as Templates.w3).
      const a = 2 * Math.acos(1 / Math.sqrt(3));
      return L(3, 'W state, 3 qubits', [
        ['RY', [0], { p: [a] }], ['RY', [1], { c: [0], p: [PI / 2] }],
        ['X', [0], { c: [1] }], ['X', [0], {}], ['X', [1], {}],
        ['X', [2], { c: [0, 1] }], ['X', [0], {}], ['X', [1], {}],
      ]);
    },
    adder(p = {}) {
      // Ripple-carry adder on k-bit registers a, b with a carry chain:
      // wires a0..a{k-1}, b0..b{k-1}, c0..ck. Sum ends up in b, carry-out in ck.
      const k = Math.max(1, Math.min(4, (p.k | 0) || 2));
      const n = 3 * k + 1, A = [...Array(k).keys()], B = A.map(i => i + k), Cc = A.map(i => i + 2 * k);
      const P = placer(n), ops = [];
      for (let i = 0; i < k; i++) {
        ops.push(P.put('X', [Cc[i + 1]], { c: [A[i], B[i]] }));
        ops.push(P.put('X', [Cc[i + 1]], { c: [A[i], Cc[i]] }));
        ops.push(P.put('X', [Cc[i + 1]], { c: [B[i], Cc[i]] }));
      }
      for (let i = 0; i < k; i++) { ops.push(P.put('X', [B[i]], { c: [A[i]] })); ops.push(P.put('X', [B[i]], { c: [Cc[i]] })); }
      B.forEach(q => ops.push(P.put('M', [q], { cb: q })));
      ops.push(P.put('M', [Cc[k]], { cb: 2 * k }));
      return Object.assign(L(n, `Ripple-carry adder, ${k} bits`, []), { ops, meta: { k } });
    },
    'grover-sat'(p = {}) {
      // CNF clauses: [[1,-2],[2,3]] (DIMACS signs, 1-indexed). Marks the
      // assignments that satisfy every clause, then diffuses.
      const clauses = p.clauses;
      if (!Array.isArray(clauses) || !clauses.length) throw new Error('grover-sat needs clauses, e.g. {clauses:[[1,-2],[2,3]]}.');
      const n = p.n || Math.max(...clauses.flat().map(Math.abs));
      if (!(n >= 1 && n <= 8)) throw new Error('grover-sat supports 1 to 8 variables.');
      clauses.forEach((c, j) => {
        if (!Array.isArray(c) || !c.length) throw new Error(`Clause ${j + 1} is empty.`);
        c.forEach(l => { if (!Number.isInteger(l) || l === 0 || Math.abs(l) > n) throw new Error(`Clause ${j + 1}: literal ${l} is outside 1..${n}.`); });
      });
      const m = clauses.length, out = n + m;
      const N = n + m + 1, P = placer(N), ops = [];
      for (let q = 0; q < n; q++) ops.push(P.put('H', [q]));
      ops.push(P.put('X', [out])); ops.push(P.put('H', [out]));
      const iters = Math.max(1, p.iters || Math.max(1, Math.floor((PI / 4) * Math.sqrt((1 << n)))) || 1);
      const oracle = () => {
        clauses.forEach((c, j) => {
          const neg = c.filter(l => l < 0).map(l => -l - 1);
          neg.forEach(q => ops.push(P.put('X', [q])));
          const vars = [...new Set(c.map(l => Math.abs(l) - 1))];
          ops.push(vars.length === 1 ? P.put('X', [n + j], { c: vars }) : P.put('X', [n + j], { c: vars }));
          neg.forEach(q => ops.push(P.put('X', [q])));
        });
        ops.push(P.put('X', [out], { c: clauses.map((_, j) => n + j) }));
        clauses.slice().reverse().forEach((c, jj) => {
          const j = m - 1 - jj, neg = c.filter(l => l < 0).map(l => -l - 1);
          neg.forEach(q => ops.push(P.put('X', [q])));
          ops.push(P.put('X', [n + j], { c: [...new Set(c.map(l => Math.abs(l) - 1))] }));
          neg.forEach(q => ops.push(P.put('X', [q])));
        });
      };
      for (let it = 0; it < Math.min(iters, 4); it++) { oracle(); diffusion({ put: (g, q, o) => ops.push(P.put(g, q, o)) }, [...Array(n).keys()]); }
      for (let q = 0; q < n; q++) ops.push(P.put('M', [q], { cb: q }));
      const sat = clauses.map(c => `(${c.map(l => (l < 0 ? '¬x' : 'x') + Math.abs(l)).join(' ∨ ')})`).join(' ∧ ');
      return Object.assign(L(N, `Grover-SAT, ${n} vars, ${m} clauses`, []), { ops, nc: n, meta: { iters: Math.min(iters, 4), sat } });
    },
    qpe(p = {}) {
      // Phase estimation of a single-qubit unitary diag(1, e^{2πiφ}):
      // unitary T (φ=1/8), S (1/4), Z (1/2) or P with an explicit phase.
      const t = Math.max(1, Math.min(6, (p.bits | 0) || (p.t | 0) || 3));
      const u = String(p.unitary || 'T').toUpperCase();
      const phi = u === 'S' ? 1 / 4 : u === 'Z' ? 1 / 2 : u === 'P' ? +p.phase || 1 / 3 : 1 / 8;
      if (!(phi > 0 && phi < 1)) throw new Error('qpe needs a phase in (0,1), e.g. {unitary:"P", phase:0.33}.');
      const e = t, N = t + 1, P = placer(N), ops = [];
      ops.push(P.put('X', [e]));
      for (let k = 0; k < t; k++) ops.push(P.put('H', [k]));
      for (let k = 0; k < t; k++) ops.push(P.put('P', [e], { c: [k], p: [2 * PI * phi * (1 << (t - 1 - k))] }));
      qftOps([...Array(t).keys()], true).forEach(o => ops.push(P.put(o.g, o.q, o)));
      for (let k = 0; k < t; k++) ops.push(P.put('M', [k], { cb: k }));
      return Object.assign(L(N, `Phase estimation, ${t} bits, U=${u}${u === 'P' ? `(${phi})` : ''}`, []),
        { ops, nc: t, meta: { bits: t, unitary: u, phase: phi } });
    },
    'shor15'(p = {}) {
      // Textbook order finding for N = 15. Work register holds |1>; each
      // counting qubit controls ×(a^{2^k} mod 15), and ×b is a rotation of
      // the 4 work bits (×2/4/8) plus NOTs when b = 15 − c (×7/11/13).
      const a = (p.a | 0) || 7;
      if (![2, 7, 8, 11, 13].includes(a)) throw new Error(`shor15 needs a in {2,7,8,11,13} (got ${p.a}).`);
      const t = Math.max(2, Math.min(6, (p.bits | 0) || 4));
      const W = [t, t + 1, t + 2, t + 3], N = t + 4, P = placer(N), ops = [];
      const rotL = (w, steps, c) => {
        for (let s = 0; s < steps; s++) for (let i = 0; i < 3; i++) ops.push(P.put('SWAP', [w[i], w[i + 1]], { c: [c] }));
      };
      ops.push(P.put('X', [W[3]]));
      for (let k = 0; k < t; k++) ops.push(P.put('H', [k]));
      for (let k = 0; k < t; k++) {
        const b = modpow(a, 1 << k, 15);
        if (b === 1) continue;
        const neg = b > 7, r = neg ? 15 - b : b;
        const steps = r === 2 ? 1 : r === 4 ? 2 : r === 8 ? 3 : null;
        if (steps == null) throw new Error(`shor15: cannot compile ×${b} mod 15.`);
        if (neg) { for (let s = 0; s < steps; s++) for (let i = 2; i >= 0; i--) ops.push(P.put('SWAP', [W[i], W[i + 1]], { c: [k] })); }
        else rotL(W, steps, k);
        if (neg) W.forEach(w => ops.push(P.put('X', [w], { c: [k] })));
      }
      qftOps([...Array(t).keys()], true).forEach(o => ops.push(P.put(o.g, o.q, o)));
      for (let k = 0; k < t; k++) ops.push(P.put('M', [k], { cb: k }));
      return Object.assign(L(N, `Shor-15, a = ${a} (textbook)`, []),
        { ops, nc: t, meta: { a, N: 15, order: orderOf(a, 15), note: 'textbook construction for N = 15' } });
    },
    qaoa(p = {}) {
      // MaxCut QAOA from an explicit graph + p layers.
      const edges = p.edges;
      if (!Array.isArray(edges) || !edges.length) throw new Error('qaoa needs edges, e.g. {n:4, edges:[[0,1],[1,2],[2,3],[3,0]], p:1}.');
      const n = p.n || Math.max(...edges.flat()) + 1;
      if (!(n >= 2 && n <= 10)) throw new Error('qaoa supports 2 to 10 qubits.');
      edges.forEach(([u, v], i) => {
        if (!Number.isInteger(u) || !Number.isInteger(v) || u < 0 || v < 0 || u >= n || v >= n || u === v)
          throw new Error(`Edge ${i} [${u},${v}] is not a pair of distinct wires below ${n}.`);
      });
      const layers = Math.max(1, Math.min(3, (p.p | 0) || 1));
      let gammas = p.gammas, betas = p.betas;
      if (!gammas || !betas) {
        let best = null;
        const simOK = typeof Sim !== 'undefined' && Sim.qaoa && Sim.qaoaCircuit;
        if (simOK) {
          for (let g = .1; g < PI; g += .2) for (let b = .1; b < PI / 2; b += .2) {
            const r = Sim.qaoa(n, edges, Array(layers).fill(+g.toFixed(3)), Array(layers).fill(+b.toFixed(3)));
            if (!best || r.expect > best.e) best = { e: r.expect, g: +g.toFixed(3), b: +b.toFixed(3) };
          }
        }
        gammas = Array(layers).fill(best ? best.g : .5); betas = Array(layers).fill(best ? best.b : .4);
      }
      const P = placer(n), ops = [];
      for (let q = 0; q < n; q++) ops.push(P.put('H', [q]));
      gammas.forEach((g, k) => {
        edges.forEach(([u, v]) => ops.push(P.put('RZZ', [u, v], { p: [-g] })));
        for (let q = 0; q < n; q++) ops.push(P.put('RX', [q], { p: [2 * betas[k]] }));
      });
      measureAll({ put: (g, q, o) => ops.push(P.put(g, q, o)) }, n);
      return Object.assign(L(n, `QAOA MaxCut, ${n} nodes, p = ${layers}`, []),
        { ops, meta: { edges, p: layers, gammas, betas } });
    },
  };

  const LIST = [
    { key: 'ghz', title: 'GHZ state', hint: 'n-qubit cat state, measured', defaults: { n: 3 } },
    { key: 'qft', title: 'QFT', hint: 'Quantum Fourier transform (no measurements; compose it)', defaults: { n: 3 } },
    { key: 'iqft', title: 'Inverse QFT', hint: 'Adjoint of the QFT', defaults: { n: 3 } },
    { key: 'w', title: 'W state', hint: 'W state, 3 qubits', defaults: {} },
    { key: 'adder', title: 'Ripple-carry adder', hint: 'k-bit a + b with a carry chain; sum ends in b', defaults: { k: 2 } },
    { key: 'grover-sat', title: 'Grover-SAT', hint: 'Oracle from CNF clauses, e.g. {"clauses":[[1,-2],[2,3]]}', defaults: { clauses: [[1, -2], [2, 3]] } },
    { key: 'qpe', title: 'Phase estimation', hint: 'Unitary T/S/Z or P(phase) + bit count', defaults: { bits: 3, unitary: 'T' } },
    { key: 'shor15', title: 'Shor-15 (textbook)', hint: 'Order finding for N = 15, a in {2,7,8,11,13}', defaults: { a: 7, bits: 4 } },
    { key: 'qaoa', title: 'QAOA MaxCut', hint: 'Graph edges + p layers', defaults: { n: 4, edges: [[0, 1], [1, 2], [2, 3], [3, 0]], p: 1 } },
  ];
  function build(key, params = {}) {
    const g = gen[key];
    if (!g) throw new Error(`Unknown block "${key}". Pick one of: ${LIST.map(b => b.key).join(', ')}.`);
    return g(params);
  }

  /* Small form panel: pick a block, edit its params as JSON, open on canvas. */
  function mount(el, opts = {}) {
    let key = (opts.block || 'ghz'), circ = null;
    const E = {};
    const sel = h('select', { class: 'wb-sel', 'aria-label': 'Block' }, LIST.map(b => h('option', { value: b.key, selected: b.key === key }, b.title)));
    const hint = h('p', { class: 'small' });
    const ta = h('textarea', { class: 'uline mono', rows: 5, style: { width: '100%', resize: 'vertical' }, spellcheck: 'false', 'aria-label': 'Block parameters as JSON' });
    const msg = h('p', { class: 'small', 'aria-live': 'polite' });
    const info = h('p', { class: 'small mono' });
    const fill = () => {
      const b = LIST.find(x => x.key === key);
      hint.textContent = b.hint; ta.value = JSON.stringify(b.defaults, null, 1); msg.textContent = ''; info.textContent = ''; circ = null;
    };
    sel.addEventListener('change', () => { key = sel.value; fill(); });
    const open = h('button', { type: 'button', class: 'btn primary', disabled: true, onclick: () => {
      if (!circ) return;
      if (typeof Workbench !== 'undefined' && Workbench && Workbench.load) { Workbench.load(circ); location.hash = '#lab'; }
      else if (typeof Lab !== 'undefined' && Lab && Lab.load) { Lab.load(circ); location.hash = '#canvas'; }
      else if (typeof toast === 'function') toast('No canvas is mounted to open this on.');
      if (opts.onOpen) opts.onOpen(circ);
    } }, 'Open in the Laboratory');
    const make = h('button', { type: 'button', class: 'btn', onclick: () => {
      let params = {};
      try { params = ta.value.trim() ? JSON.parse(ta.value) : {}; }
      catch (e) { msg.textContent = 'Parameters are JSON: ' + e.message; msg.className = 'small bad'; return; }
      try {
        circ = build(key, params);
        msg.textContent = ''; msg.className = 'small';
        info.textContent = `${circ.name} · ${circ.n} qubits · ${circ.ops.length} ops`;
        open.disabled = false;
        if (typeof announce === 'function') announce(`Built ${circ.name}.`);
      } catch (e) { msg.textContent = e.message; msg.className = 'small bad'; open.disabled = true; }
    } }, 'Build');
    el.replaceChildren(h('div', { class: 'blocks' }, h('div', { class: 'row wrap', style: { gap: '8px' } }, sel, make, open), hint, ta, msg, info));
    fill();
    return { build, get circuit() { return circ; } };
  }
  return Object.assign(gen, { list: LIST, build, mount });
})();
