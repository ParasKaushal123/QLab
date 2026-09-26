/* =====================================================================
   TEMPLATES — circuits by name. Used by the type case, the tutor's
   generator, the Library and the Course.
===================================================================== */
const Templates = (() => {
  const PI = Math.PI;
  const C = (n, name, list, extra) => Object.assign(IR.fromList(n, list), { name }, extra || {});
  const measureAll = (n, col) => Array.from({ length: n }, (_, q) => ['M', [q], col, { cb: q }]);
  const T = {
    bell: () => C(2, 'Bell pair', [['H', [0], 0], ['X', [1], 1, { c: [0] }], ...measureAll(2, 2)]),
    ghz: (k = 3) => C(k, `GHZ, ${k} qubits`, [['H', [0], 0], ...Array.from({ length: k - 1 }, (_, i) => ['X', [i + 1], i + 1, { c: [i] }]), ...measureAll(k, k)]),
    w3: () => C(3, 'W state, 3 qubits', [['RY', [0], 0, { p: [2 * Math.acos(1 / Math.sqrt(3))] }], ['RY', [1], 1, { c: [0], p: [PI / 2] }], ['X', [0], 2, { c: [1] }], ['X', [0], 3], ['X', [1], 3], ['X', [2], 4, { c: [0, 1] }], ['X', [0], 5], ['X', [1], 5]]),
    superposition: (k = 3) => C(k, `Even superposition, ${k} qubits`, Array.from({ length: k }, (_, q) => ['H', [q], 0])),
    qft: (k = 3) => { const c = C(k, `QFT, ${k} qubits`, []); c.ops = Sim.qftOps([...Array(k).keys()]).map(o => IR.op(o.g, o.q, o)); return c; },
    iqft: (k = 3) => { const c = C(k, `Inverse QFT, ${k} qubits`, []); c.ops = Sim.qftOps([...Array(k).keys()], 0, true).map(o => IR.op(o.g, o.q, o)); return c; },
    grover(n = 3, marked = ['101'], iters) {
      const N = 1 << n, M = marked.length, k = iters ?? Math.max(1, Math.floor(PI / 4 * Math.sqrt(N / M))), L = []; let col = 0;
      for (let q = 0; q < n; q++) L.push(['H', [q], col]); col++;
      const mcz = () => L.push(['Z', [n - 1], col++, { c: [...Array(n - 1).keys()] }]);
      for (let it = 0; it < k; it++) {
        for (const s of marked) { const zeros = [...s].map((b, q) => b === '0' ? q : -1).filter(q => q >= 0); if (zeros.length) { zeros.forEach(q => L.push(['X', [q], col])); col++; } mcz(); if (zeros.length) { zeros.forEach(q => L.push(['X', [q], col])); col++; } }
        for (let q = 0; q < n; q++) L.push(['H', [q], col]); col++; for (let q = 0; q < n; q++) L.push(['X', [q], col]); col++; mcz(); for (let q = 0; q < n; q++) L.push(['X', [q], col]); col++; for (let q = 0; q < n; q++) L.push(['H', [q], col]); col++;
      }
      L.push(...measureAll(n, col)); return C(n, `Grover, ${n} qubits, marks ${marked.join(', ')}`, L, { meta: { iters: k } });
    },
    dj(n = 3, kind = 'balanced') { // n input qubits + 1 ancilla
      const L = [['X', [n], 0]]; for (let q = 0; q <= n; q++) L.push(['H', [q], 1]); let col = 2;
      if (kind === 'balanced') for (let q = 0; q < n; q++) L.push(['X', [n], col++, { c: [q] }]); else if (kind === 'constant1') L.push(['X', [n], col++]);
      for (let q = 0; q < n; q++) L.push(['H', [q], col]); col++; for (let q = 0; q < n; q++) L.push(['M', [q], col, { cb: q }]);
      return C(n + 1, `Deutsch–Jozsa, ${n} inputs, ${kind === 'balanced' ? 'balanced' : 'constant'} oracle`, L);
    },
    bv(s = '101') { const n = s.length, L = [['X', [n], 0]]; for (let q = 0; q <= n; q++) L.push(['H', [q], 1]); let col = 2; [...s].forEach((b, q) => { if (b === '1') L.push(['X', [n], col++, { c: [q] }]); }); for (let q = 0; q < n; q++) L.push(['H', [q], col]); col++; for (let q = 0; q < n; q++) L.push(['M', [q], col, { cb: q }]); return C(n + 1, `Bernstein–Vazirani, s = ${s}`, L); },
    teleport(theta = 1.1, phi = .7) { return C(3, 'Teleportation', [['U', [0], 0, { p: [theta, phi, 0] }], ['H', [1], 1], ['X', [2], 2, { c: [1] }], ['BARRIER', [0, 1, 2], 3], ['X', [1], 4, { c: [0] }], ['H', [0], 5], ['M', [0], 6, { cb: 0 }], ['M', [1], 7, { cb: 1 }], ['X', [2], 8, { cond: { bit: 1, val: 1 } }], ['Z', [2], 9, { cond: { bit: 0, val: 1 } }]]); },
    superdense(bits = '11') { const L = [['H', [0], 0], ['X', [1], 1, { c: [0] }]]; let col = 2; if (bits[1] === '1') L.push(['X', [0], col++]); if (bits[0] === '1') L.push(['Z', [0], col++]); L.push(['X', [1], col++, { c: [0] }], ['H', [0], col++], ['M', [0], col, { cb: 0 }], ['M', [1], col, { cb: 1 }]); return C(2, `Superdense coding, sends ${bits}`, L); },
    qpe(t = 3, phaseFrac = 1 / 8) { const L = [['X', [t], 0]]; for (let k = 0; k < t; k++) L.push(['H', [k], 1]); let col = 2; for (let k = 0; k < t; k++) L.push(['P', [t], col++, { c: [k], p: [2 * PI * phaseFrac * (1 << (t - 1 - k))] }]); const c = C(t + 1, `Phase estimation, ${t} ancillas, φ = ${phaseFrac}`, L); Sim.qftOps([...Array(t).keys()], col, true).forEach(o => c.ops.push(IR.op(o.g, o.q, o))); col += Sim.qftOps([...Array(t).keys()]).length; for (let k = 0; k < t; k++) c.ops.push(IR.op('M', [k], { col, cb: k })); return c; },
    bitflip(err = 1) { const L = [['RY', [0], 0, { p: [1.2] }], ['X', [1], 1, { c: [0] }], ['X', [2], 2, { c: [0] }], ['BARRIER', [0, 1, 2, 3, 4], 3]]; if (err >= 0) L.push(['X', [err], 4]); L.push(['BARRIER', [0, 1, 2, 3, 4], 5], ['X', [3], 6, { c: [0] }], ['X', [3], 7, { c: [1] }], ['X', [4], 8, { c: [1] }], ['X', [4], 9, { c: [2] }], ['M', [3], 10, { cb: 0 }], ['M', [4], 10.5, { cb: 1 }], ['X', [0], 11, { cond: { reg: 'c', val: 1 } }], ['X', [1], 12, { cond: { reg: 'c', val: 3 } }], ['X', [2], 13, { cond: { reg: 'c', val: 2 } }]); return C(5, `Bit-flip code, error on q${err}`, L, { nc: 2 }); },
    qaoaRing(k = 4, p = 1) { const edges = Array.from({ length: k }, (_, i) => [i, (i + 1) % k]); let best = null; for (let g = .05; g < PI; g += .05) for (let b = .05; b < PI / 2; b += .05) { const r = Sim.qaoa(k, edges, Array(p).fill(g), Array(p).fill(b)); if (!best || r.expect > best.e) best = { e: r.expect, g, b }; } const c = Sim.qaoaCircuit(k, edges, Array(p).fill(+best.g.toFixed(3)), Array(p).fill(+best.b.toFixed(3))); return Object.assign(IR.fromList(k, []), { name: `QAOA MaxCut, ${k}-node ring, p = ${p}`, ops: c.ops.map(o => IR.op(o.g, o.q, o)) }); },
    vqeH2(theta = .22) { return Object.assign(IR.fromList(2, [['RY', [0], 0, { p: ['theta'] }], ['X', [1], 1, { c: [0] }], ['X', [1], 2]]), { name: 'VQE ansatz for H₂', params: { theta } }); },
    chsh(x = 0, y = 0) { const A = [0, PI / 2], B = [PI / 4, -PI / 4]; return C(2, `CHSH round x=${x}, y=${y}`, [['H', [0], 0], ['X', [1], 1, { c: [0] }], ['RY', [0], 2, { p: [-A[x]] }], ['RY', [1], 2, { p: [-B[y]] }], ...measureAll(2, 3)]); }
  };
  const LIST = [
    { key: 'bell', label: 'bell', hint: 'Bell pair', make: () => T.bell() }, { key: 'ghz', label: 'ghz 3', hint: 'GHZ state', make: k => T.ghz(k || 3) }, { key: 'w', label: 'w', hint: 'W state, 3 qubits', make: () => T.w3() },
    { key: 'qft', label: 'qft 3', hint: 'Quantum Fourier transform', make: k => T.qft(k || 3) }, { key: 'iqft', label: 'iqft 3', hint: 'Inverse QFT', make: k => T.iqft(k || 3) },
    { key: 'grover', label: 'grover 101', hint: 'Grover search (type the marked strings)', make: (k, s) => T.grover((s && s[0] ? s[0].length : 3), s && s.length ? s : ['101']) },
    { key: 'dj', label: 'dj 3', hint: 'Deutsch–Jozsa', make: k => T.dj(k || 3) }, { key: 'bv', label: 'bv 1011', hint: 'Bernstein–Vazirani', make: (k, s) => T.bv(s && s[0] ? s[0] : '101') },
    { key: 'teleport', label: 'teleport', hint: 'Teleportation with feed-forward', make: () => T.teleport() }, { key: 'superdense', label: 'superdense 10', hint: 'Superdense coding', make: (k, s) => T.superdense(s && s[0] ? s[0] : '11') },
    { key: 'qpe', label: 'qpe 3', hint: 'Phase estimation of T', make: k => T.qpe(k || 3) }, { key: 'bitflip', label: 'bitflip', hint: '3-qubit bit-flip code', make: () => T.bitflip(1) },
    { key: 'qaoa', label: 'qaoa 4', hint: 'QAOA MaxCut on a ring', make: k => T.qaoaRing(k || 4) }, { key: 'vqe', label: 'vqe', hint: 'VQE ansatz for H₂', make: () => T.vqeH2() }, { key: 'superposition', label: 'plus 3', hint: 'Even superposition', make: k => T.superposition(k || 3) }
  ];
  function fromText(text) {
    const s = text.toLowerCase(), k = +(s.match(/(\d+)\s*-?\s*(?:qubit|node|input|ancilla)/) || s.match(/\b(\d{1,2})\b/) || [])[1] || null;
    const strings = (s.match(/\b[01]{2,8}\b/g) || []), p = +(s.match(/p\s*=\s*(\d)/) || [])[1] || 1;
    if (/ghz/.test(s)) return T.ghz(Math.min(12, Math.max(2, k || 3)));
    if (/bell/.test(s)) return T.bell();
    if (/\bw\b|w state|w-state/.test(s)) return T.w3();
    if (/inverse qft|iqft/.test(s)) return T.iqft(Math.min(8, k || 3));
    if (/qft|fourier/.test(s)) return T.qft(Math.min(8, k || 3));
    if (/grover/.test(s)) { const m = strings.length ? strings : ['1'.repeat(k || 3)]; const n = m[0].length; return T.grover(n, m.filter(x => x.length === n)); }
    if (/qaoa|maxcut|max-cut/.test(s)) return T.qaoaRing(Math.min(8, Math.max(3, k || 4)), Math.min(3, p));
    if (/deutsch|dj/.test(s)) return T.dj(Math.min(6, k || 3), /constant/.test(s) ? 'constant1' : 'balanced');
    if (/bernstein|bv/.test(s)) return T.bv(strings[0] || '101');
    if (/teleport/.test(s)) return T.teleport();
    if (/superdense/.test(s)) return T.superdense(strings[0] || '11');
    if (/phase estimation|qpe/.test(s)) return T.qpe(Math.min(6, k || 3));
    if (/bit.?flip|error correct/.test(s)) return T.bitflip(1);
    if (/vqe|h2|hydrogen/.test(s)) return T.vqeH2();
    if (/superposition|plus/.test(s)) return T.superposition(Math.min(12, k || 3));
    return null;
  }
  return Object.assign(T, { LIST, fromText, measureAll });
})();
