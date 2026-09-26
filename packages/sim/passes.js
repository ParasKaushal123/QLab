/* =====================================================================
   PASSES — metrics, optimisation, basis translation, routing onto a chip.
===================================================================== */
const Passes = (() => {
  const PI = Math.PI, TAU = 2 * PI;
  const clone = o => Object.assign({}, o, { q: o.q.slice(), c: (o.c || []).slice(), p: (o.p || []).slice() });
  const DIAG = new Set(['Z', 'S', 'SDG', 'T', 'TDG', 'P', 'RZ', 'RZZ', 'I']);
  const XLIKE = new Set(['X', 'SX', 'SXDG', 'RX']);
  function asap(ops, n) { const front = new Array(n).fill(0); return Sim.sorted(ops).map(o => { const w = Sim.wires(o); const [lo, hi] = [Math.min(...w), Math.max(...w)]; let c = 0; for (let q = lo; q <= hi; q++) c = Math.max(c, front[q]); const r = Object.assign({}, o, { col: c }); for (let q = lo; q <= hi; q++) front[q] = c + 1; return r; }); }
  function metrics(circ) {
    const ops = Sim.expand(circ).filter(o => o.g !== 'BARRIER'), n = circ.n, byType = {}, front = new Array(n).fill(0); let depth = 0;
    for (const o of Sim.sorted(ops)) { const name = Sim.displayName(o); byType[name] = (byType[name] || 0) + 1; const w = Sim.wires(o); const lv = Math.max(...w.map(q => front[q])) + 1; w.forEach(q => front[q] = lv); depth = Math.max(depth, lv); }
    let t = 0, tOk = true; for (const o of ops) { if ((o.g === 'T' || o.g === 'TDG') && !(o.c || []).length) t++; else if (o.g === 'X' && (o.c || []).length === 2) t += 7; else if (['RX', 'RY', 'RZ', 'P', 'U', 'RXX', 'RYY', 'RZZ'].includes(o.g)) { const v = (o.p || []).map(x => typeof x === 'number' ? x : NaN); if (v.some(x => isNaN(x) || Math.abs(Math.round(x / (PI / 4)) * (PI / 4) - x) > 1e-9)) tOk = false; } else if ((o.c || []).length && o.g !== 'X' && o.g !== 'Z') tOk = false; }
    const basis = toBasis(circ), cx = basis.ops.filter(o => o.g === 'X' && (o.c || []).length === 1).length;
    const used = new Set(ops.flatMap(o => Sim.wires(o)));
    return { width: n, used: used.size, depth, gates: ops.filter(o => o.g !== 'M').length, twoQ: ops.filter(o => Sim.wires(o).length > 1).length, byType, cx, tcount: tOk ? t : null, measures: ops.filter(o => o.g === 'M').length };
  }
  /* ---------------- optimisation ---------------- */
  function sameWires(a, b) { return a.q.join() === b.q.join() && (a.c || []).join() === (b.c || []).join() && !a.cond && !b.cond; }
  function isInverse(a, b) {
    if (!sameWires(a, b)) return false; const inv = Sim.inverseOp(a); if (!inv) return false;
    if (inv.g !== b.g) return false; return (inv.p || []).every((x, i) => typeof x === 'number' && typeof b.p[i] === 'number' ? Math.abs(x - b.p[i]) < 1e-9 : String(x) === String(b.p[i]) || `-(${b.p[i]})` === String(a.p[i]) || `-(${a.p[i]})` === String(b.p[i]));
  }
  function commutes(a, b) {
    const wa = Sim.wires(a), wb = Sim.wires(b); if (!wa.some(q => wb.includes(q))) return true;
    if (a.cond || b.cond || a.g === 'M' || b.g === 'M' || a.g === 'RESET' || b.g === 'RESET' || a.g === 'BARRIER' || b.g === 'BARRIER') return false;
    const diag = o => DIAG.has(o.g) || (o.g === 'Z'); if (diag(a) && diag(b)) return true;
    // diagonal gate on a qubit that is only a control of the other
    const onlyCtrl = (d, o) => d.q.length === 1 && !(d.c || []).length && DIAG.has(d.g) && (o.c || []).includes(d.q[0]) && !o.q.includes(d.q[0]);
    if (onlyCtrl(a, b) || onlyCtrl(b, a)) return true;
    const xOnTarget = (x, o) => x.q.length === 1 && !(x.c || []).length && XLIKE.has(x.g) && o.g === 'X' && (o.c || []).length && o.q[0] === x.q[0] && !(o.c || []).includes(x.q[0]);
    if (xOnTarget(a, b) || xOnTarget(b, a)) return true;
    return false;
  }
  const MERGE = { RX: 1, RY: 1, RZ: 1, P: 1, RXX: 1, RYY: 1, RZZ: 1 };
  const FUSE = { 'S,S': 'Z', 'SDG,SDG': 'Z', 'T,T': 'S', 'TDG,TDG': 'SDG', 'SX,SX': 'X', 'SXDG,SXDG': 'X' };
  function optimise(circ) {
    let ops = Sim.sorted(Sim.expand(circ)).map(clone); const removed = [], merged = [];
    let changed = true, guard = 0;
    while (changed && guard++ < 40) {
      changed = false;
      for (let i = 0; i < ops.length && !changed; i++) {
        const a = ops[i]; if (!a) continue;
        // identity rotations
        if (MERGE[a.g] && typeof a.p[0] === 'number') { const period = (a.c || []).length || a.g === 'P' ? (a.g === 'P' ? TAU : 2 * TAU) : TAU; const r = ((a.p[0] % period) + period) % period; if (r < 1e-9 || period - r < 1e-9) { removed.push(a); ops.splice(i, 1); changed = true; break; } }
        for (let j = i + 1; j < ops.length; j++) {
          const b = ops[j];
          if (isInverse(a, b)) { removed.push(a, b); ops.splice(j, 1); ops.splice(i, 1); changed = true; break; }
          if (sameWires(a, b) && MERGE[a.g] && a.g === b.g) { const p = typeof a.p[0] === 'number' && typeof b.p[0] === 'number' ? a.p[0] + b.p[0] : `(${a.p[0]}) + (${b.p[0]})`; merged.push({ from: [a, b], into: a.g }); a.p = [p]; removed.push(b); ops.splice(j, 1); changed = true; break; }
          if (sameWires(a, b) && FUSE[`${a.g},${b.g}`]) { merged.push({ from: [a, b], into: FUSE[`${a.g},${b.g}`] }); a.g = FUSE[`${a.g},${b.g}`]; removed.push(b); ops.splice(j, 1); changed = true; break; }
          if (!commutes(a, b)) break;
        }
      }
    }
    return { circ: { n: circ.n, nc: circ.nc, params: circ.params, ops: asap(ops, circ.n) }, removed, merged };
  }
  /* ---------------- basis translation: {CX, RZ, SX, X} ---------------- */
  const cm = (M, env) => M;
  function numMat(o, env) { return Sim.mat(o, env); }
  function zyz(M) { // U = e^{iα} RZ(φ) RY(θ) RZ(λ)
    const [[ar, ai], [br, bi], [cr, ci], [dr, di]] = M, det = [ar * dr - ai * di - (br * cr - bi * ci), ar * di + ai * dr - (br * ci + bi * cr)];
    const alpha = Math.atan2(det[1], det[0]) / 2, ca = Math.cos(-alpha), sa = Math.sin(-alpha), rot = ([x, y]) => [x * ca - y * sa, x * sa + y * ca];
    const a = rot([ar, ai]), b = rot([br, bi]), c = rot([cr, ci]), d = rot([dr, di]);
    const th = 2 * Math.atan2(Math.hypot(c[0], c[1]), Math.hypot(a[0], a[1]));
    const arg = z => Math.atan2(z[1], z[0]); let sum = 0, diff = 0;
    if (Math.hypot(a[0], a[1]) > 1e-9) sum = arg(d) - arg(a);
    if (Math.hypot(c[0], c[1]) > 1e-9) diff = arg(c) - arg([-b[0], -b[1]]);
    if (Math.hypot(a[0], a[1]) <= 1e-9) sum = diff; if (Math.hypot(c[0], c[1]) <= 1e-9) diff = sum;
    return { alpha, theta: th, phi: (sum + diff) / 2, lambda: (sum - diff) / 2 };
  }
  // single-qubit unitary → RZ(λ) SX RZ(θ+π) SX RZ(φ+π)   (in time order), dropping identities
  function oneQ(M, q) {
    const { theta, phi, lambda } = zyz(M), out = [], rz = t => { const r = ((t % TAU) + TAU) % TAU; if (r > 1e-9 && TAU - r > 1e-9) out.push({ g: 'RZ', q: [q], p: [t > PI ? t - TAU : t] }); };
    if (Math.abs(theta) < 1e-9) { rz(phi + lambda); return out; }
    rz(lambda); out.push({ g: 'SX', q: [q] }); rz(theta + PI); out.push({ g: 'SX', q: [q] }); rz(phi + PI); return out;
  }
  function cxo(c, t) { return { g: 'X', q: [t], c: [c] }; }
  function sqrtU(M) { // principal-branch 2×2 square root: V = (U + s·I)/t, s = √det U, t = √(tr U + 2s)
    const mul = (x, y) => [x[0] * y[0] - x[1] * y[1], x[0] * y[1] + x[1] * y[0]], csqrt = z => { const r = Math.hypot(z[0], z[1]), a = Math.atan2(z[1], z[0]) / 2, m = Math.sqrt(r); return [m * Math.cos(a), m * Math.sin(a)]; };
    const det = [mul(M[0], M[3])[0] - mul(M[1], M[2])[0], mul(M[0], M[3])[1] - mul(M[1], M[2])[1]];
    for (const sign of [1, -1]) {
      const s0 = csqrt(det), s = [s0[0] * sign, s0[1] * sign], tr = [M[0][0] + M[3][0] + 2 * s[0], M[0][1] + M[3][1] + 2 * s[1]];
      if (Math.hypot(tr[0], tr[1]) < 1e-6) continue;
      const t = csqrt(tr), inv = [t[0] / (t[0] ** 2 + t[1] ** 2), -t[1] / (t[0] ** 2 + t[1] ** 2)];
      return [mul([M[0][0] + s[0], M[0][1] + s[1]], inv), mul(M[1], inv), mul(M[2], inv), mul([M[3][0] + s[0], M[3][1] + s[1]], inv)];
    }
    const { axis, angle } = Sim.axisAngle(M); const h = angle / 2, c = Math.cos(h / 2), sn = Math.sin(h / 2), [nx, ny, nz] = axis;
    return [[c, -sn * nz], [-sn * ny, -sn * nx], [sn * ny, -sn * nx], [c, sn * nz]];
  }
  const dag = M => [[M[0][0], -M[0][1]], [M[2][0], -M[2][1]], [M[1][0], -M[1][1]], [M[3][0], -M[3][1]]];
  // controlled-U with one control (Nielsen & Chuang ABC decomposition)
  function c1(M, c, t) {
    const { alpha, theta, phi, lambda } = zyz(M), out = [];
    const rz = (x, q) => out.push({ g: 'RZ', q: [q], p: [x] }), ry = (x, q) => out.push({ g: 'RY', q: [q], p: [x] });
    rz((lambda - phi) / 2, t); out.push(cxo(c, t)); rz(-(lambda + phi) / 2, t); ry(-theta / 2, t); out.push(cxo(c, t)); ry(theta / 2, t); rz(phi, t);
    out.push({ g: 'P', q: [c], p: [alpha] });
    return out;
  }
  function ccx(a, b, t) { return [{ g: 'H', q: [t] }, cxo(b, t), { g: 'TDG', q: [t] }, cxo(a, t), { g: 'T', q: [t] }, cxo(b, t), { g: 'TDG', q: [t] }, cxo(a, t), { g: 'T', q: [b] }, { g: 'T', q: [t] }, { g: 'H', q: [t] }, cxo(a, b), { g: 'T', q: [a] }, { g: 'TDG', q: [b] }, cxo(a, b)]; }
  // multi-controlled U, Barenco lemma 7.5 (no ancilla)
  function mc(M, cs, t) {
    if (cs.length === 0) return [{ g: 'U3M', q: [t], M }];
    if (cs.length === 1) return c1(M, cs[0], t);
    const X = [[0, 0], [1, 0], [1, 0], [0, 0]];
    if (cs.length === 2 && Math.abs(M[1][0] - 1) < 1e-12 && Math.abs(M[0][0]) < 1e-12 && Math.abs(M[2][0] - 1) < 1e-12 && Math.abs(M[3][0]) < 1e-12 && !M[1][1] && !M[2][1]) return ccx(cs[0], cs[1], t);
    const V = sqrtU(M), last = cs[cs.length - 1], rest = cs.slice(0, -1);
    return [...c1(V, last, t), ...mc(X, rest, last), ...c1(dag(V), last, t), ...mc(X, rest, last), ...mc(V, rest, t)];
  }
  function toBasis(circ) {
    const env = circ.params || {}, out = [];
    const emit1 = list => { for (const o of list) { if (o.g === 'U3M') out.push(...oneQ(o.M, o.q[0])); else if (o.g === 'X' && (o.c || []).length === 1) out.push({ g: 'X', q: o.q, c: o.c }); else if ((o.c || []).length) emit1(mc(Sim.mat(o, env), o.c, o.q[0])); else if (o.g === 'X' || o.g === 'SX' || o.g === 'RZ') out.push({ g: o.g, q: o.q, p: o.p ? o.p.map(x => Sim.evalExpr(x, env)) : [] }); else if (Sim.G[o.g] && Sim.G[o.g].m) out.push(...oneQ(Sim.mat(o, env), o.q[0])); } };
    for (const o of Sim.sorted(Sim.expand(circ))) {
      if (['M', 'RESET', 'BARRIER'].includes(o.g) || o.cond) { out.push(clone(o)); continue; }
      const c = o.c || [], [a, b] = o.q;
      if (o.g === 'I') continue;
      if (o.g === 'SWAP') { if (!c.length) emit1([cxo(a, b), cxo(b, a), cxo(a, b)]); else emit1([cxo(b, a), { g: 'X', q: [b], c: [c[0], a] }, cxo(b, a)].map(x => x.c && x.c.length === 2 ? Object.assign(x, { c: [...c.slice(1), ...x.c] }) : x)); continue; }
      if (o.g === 'ISWAP' || o.g === 'ISWAPDG') { const s = o.g === 'ISWAP' ? 'S' : 'SDG'; emit1(o.g === 'ISWAP' ? [{ g: 'S', q: [a] }, { g: 'S', q: [b] }, { g: 'H', q: [a] }, cxo(a, b), cxo(b, a), { g: 'H', q: [b] }] : [{ g: 'H', q: [b] }, cxo(b, a), cxo(a, b), { g: 'H', q: [a] }, { g: 'SDG', q: [a] }, { g: 'SDG', q: [b] }]); continue; }
      if (o.g === 'RZZ' || o.g === 'RXX' || o.g === 'RYY') { const t = Sim.evalExpr(o.p[0], env); const pre = o.g === 'RXX' ? [{ g: 'H', q: [a] }, { g: 'H', q: [b] }] : o.g === 'RYY' ? [{ g: 'RX', q: [a], p: [PI / 2] }, { g: 'RX', q: [b], p: [PI / 2] }] : []; const post = o.g === 'RXX' ? pre : o.g === 'RYY' ? [{ g: 'RX', q: [a], p: [-PI / 2] }, { g: 'RX', q: [b], p: [-PI / 2] }] : []; emit1([...pre, cxo(a, b), { g: 'RZ', q: [b], p: [t] }, cxo(a, b), ...post]); continue; }
      emit1([o]);
    }
    let col = 0; return { n: circ.n, nc: circ.nc, ops: out.map(o => Object.assign(o, { col: col++ })).map(o => o) , params: {} };
  }
  /* ---------------- routing onto a coupling map ---------------- */
  const DEVICES = {
    linear: n => ({ name: `Linear, ${n} qubits`, n, edges: Array.from({ length: n - 1 }, (_, i) => [i, i + 1]), pos: Array.from({ length: n }, (_, i) => [i, 0]) }),
    ring: n => ({ name: `Ring, ${n} qubits`, n, edges: Array.from({ length: n }, (_, i) => [i, (i + 1) % n]), pos: Array.from({ length: n }, (_, i) => [Math.cos(2 * PI * i / n), Math.sin(2 * PI * i / n)]) }),
    grid: () => { const r = 3, c = 4, e = [], pos = []; for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) { const k = i * c + j; pos.push([j, i]); if (j + 1 < c) e.push([k, k + 1]); if (i + 1 < r) e.push([k, k + c]); } return { name: 'Grid, 3 × 4', n: 12, edges: e, pos }; },
    heavyhex: () => { // 27-qubit heavy-hex (Falcon layout)
      const E = [[0, 1], [1, 2], [1, 4], [2, 3], [3, 5], [4, 7], [5, 8], [6, 7], [7, 10], [8, 9], [8, 11], [10, 12], [11, 14], [12, 13], [12, 15], [13, 14], [14, 16], [15, 18], [16, 19], [17, 18], [18, 21], [19, 20], [19, 22], [21, 23], [22, 25], [23, 24], [24, 25], [25, 26]];
      const P = { 0: [0, 1], 1: [1, 1], 2: [2, 1], 3: [3, 1], 5: [4, 1], 8: [5, 1], 9: [6, 1], 4: [1, 2], 11: [5, 2], 6: [0, 3], 7: [1, 3], 10: [2, 3], 12: [3, 3], 13: [4, 3], 14: [5, 3], 16: [6, 3], 15: [3, 4], 19: [6, 4], 17: [2, 5], 18: [3, 5], 21: [4, 5], 23: [5, 5], 22: [7, 5], 20: [7, 4], 24: [6, 5], 25: [7, 6], 26: [8, 6] };
      return { name: 'Heavy-hex, 27 qubits (Falcon-style)', n: 27, edges: E, pos: Array.from({ length: 27 }, (_, i) => P[i] || [0, 0]) }; }
  };
  function route(circ, dev) {
    const b = toBasis(circ), adj = Array.from({ length: dev.n }, () => new Set()); dev.edges.forEach(([a, c]) => { adj[a].add(c); adj[c].add(a); });
    if (circ.n > dev.n) throw new Error(`This device has ${dev.n} qubits; the circuit needs ${circ.n}.`);
    const path = (s, t) => { const prev = new Map([[s, null]]), Q = [s]; while (Q.length) { const u = Q.shift(); if (u === t) break; for (const v of adj[u]) if (!prev.has(v)) { prev.set(v, u); Q.push(v); } } const p = []; for (let v = t; v != null; v = prev.get(v)) p.unshift(v); return p; };
    // initial layout: place interacting pairs close (greedy BFS order from the busiest qubit)
    const w = Array.from({ length: circ.n }, () => 0); b.ops.forEach(o => { if ((o.c || []).length) { w[o.c[0]]++; w[o.q[0]]++; } });
    const order = [...Array(circ.n).keys()].sort((x, y) => w[y] - w[x]), bfs = [], seen = new Set([0]), Q = [0]; while (Q.length) { const u = Q.shift(); bfs.push(u); for (const v of adj[u]) if (!seen.has(v)) { seen.add(v); Q.push(v); } }
    const L = {}, inv = {}; order.forEach((q, i) => { L[q] = bfs[i]; inv[bfs[i]] = q; });
    const initial = Object.assign({}, L), out = []; let swaps = 0;
    for (const o of b.ops) {
      if ((o.c || []).length === 1) {
        let pc = L[o.c[0]], pt = L[o.q[0]];
        if (!adj[pc].has(pt)) { const p = path(pc, pt); for (let k = 0; k < p.length - 2; k++) { const u = p[k], v = p[k + 1]; out.push({ g: 'SWAP', q: [u, v], routed: true }); swaps++; const qu = inv[u], qv = inv[v]; inv[u] = qv; inv[v] = qu; if (qu != null) L[qu] = v; if (qv != null) L[qv] = u; } pc = L[o.c[0]]; }
        out.push({ g: 'X', q: [pt], c: [pc] });
      } else out.push(Object.assign({}, o, { q: o.q.map(q => L[q]) }));
    }
    let col = 0; out.forEach(o => o.col = col++);
    return { circ: { n: dev.n, ops: out }, initial, final: Object.assign({}, L), swaps, dev };
  }
  return { metrics, optimise, toBasis, route, DEVICES, asap, zyz, commutes };
})();
