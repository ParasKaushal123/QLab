/* =====================================================================
   SIMLIB — the one quantum engine. Runs on the main thread and, from its
   own source text, inside a Web Worker. No DOM access in here.
   Conventions: q0 is the LEFTMOST bit of every ket and bitstring on this
   platform (index bit n-1-q). Classical bit k is written left-to-right too.
   IR op: { id, g, q:[targets], c:[controls], p:[params], cb, cond:{bit,val}|{reg:'c',val}, col, sub }
===================================================================== */
function SIMLIB() {
  const PI = Math.PI, S2 = Math.SQRT1_2;
  /* ---------- parameter expressions: numbers, pi, names, + - * / ^, unary minus, parens ---------- */
  function evalExpr(src, env = {}) {
    if (typeof src === 'number') return src;
    const s = String(src).replace(/π/g, 'pi').replace(/θ/g, 'theta').replace(/γ/g, 'gamma').replace(/β/g, 'beta').replace(/λ/g, 'lambda').replace(/φ/g, 'phi');
    let i = 0;
    const peek = () => s[i], ws = () => { while (s[i] === ' ') i++; };
    function num() {
      ws(); let m = s.slice(i).match(/^(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+)/i);
      if (m) { i += m[0].length; return parseFloat(m[0]); }
      m = s.slice(i).match(/^[A-Za-z_]\w*/);
      if (m) { i += m[0].length; const k = m[0]; if (k === 'pi') return PI; if (k === 'e') return Math.E; if (k === 'sqrt') { ws(); if (s[i] !== '(') throw new Error('sqrt needs ('); i++; const v = add(); ws(); i++; return Math.sqrt(v); } if (k in env) return +env[k]; throw new Error(`Unknown parameter “${k}”`); }
      if (peek() === '(') { i++; const v = add(); ws(); if (s[i] !== ')') throw new Error('Missing )'); i++; return v; }
      if (peek() === '-') { i++; return -pow(); }
      if (peek() === '+') { i++; return pow(); }
      throw new Error(`Can’t read “${s.slice(i, i + 6) || 'end'}”`);
    }
    function pow() { let v = num(); ws(); if (s[i] === '^' || (s[i] === '*' && s[i + 1] === '*')) { i += s[i] === '^' ? 1 : 2; v = Math.pow(v, pow()); } return v; }
    function mul() { let v = pow(); for (;;) { ws(); if (s[i] === '*' && s[i + 1] !== '*') { i++; v *= pow(); } else if (s[i] === '/') { i++; v /= pow(); } else return v; } }
    function add() { let v = mul(); for (;;) { ws(); if (s[i] === '+') { i++; v += mul(); } else if (s[i] === '-') { i++; v -= mul(); } else return v; } }
    const v = add(); ws(); if (i < s.length) throw new Error(`Unexpected “${s[i]}”`); if (!isFinite(v)) throw new Error('Not a finite number'); return v;
  }
  const cx = (r, i = 0) => [r, i], ex = t => [Math.cos(t), Math.sin(t)];
  /* ---------- gate registry ---------- */
  const G = {};
  function def(name, o) { G[name] = Object.assign({ name, nt: 1, np: 0, fam: 'single' }, o); }
  const M2 = (a, b, c, d) => [a, b, c, d]; // each entry [re,im]
  def('I', { m: () => M2(cx(1), cx(0), cx(0), cx(1)), inv: 'I', label: 'I', clifford: true, title: 'Identity' });
  def('X', { m: () => M2(cx(0), cx(1), cx(1), cx(0)), inv: 'X', clifford: true, title: 'Pauli-X (NOT)' });
  def('Y', { m: () => M2(cx(0), cx(0, -1), cx(0, 1), cx(0)), inv: 'Y', clifford: true, title: 'Pauli-Y' });
  def('Z', { m: () => M2(cx(1), cx(0), cx(0), cx(-1)), inv: 'Z', clifford: true, title: 'Pauli-Z' });
  def('H', { m: () => M2(cx(S2), cx(S2), cx(S2), cx(-S2)), inv: 'H', clifford: true, title: 'Hadamard' });
  def('S', { m: () => M2(cx(1), cx(0), cx(0), cx(0, 1)), inv: 'SDG', fam: 'phase', clifford: true, title: 'S (√Z)' });
  def('SDG', { m: () => M2(cx(1), cx(0), cx(0), cx(0, -1)), inv: 'S', fam: 'phase', label: 'S†', clifford: true, title: 'S-dagger' });
  def('T', { m: () => M2(cx(1), cx(0), cx(0), ex(PI / 4)), inv: 'TDG', fam: 'phase', title: 'T (π/8)' });
  def('TDG', { m: () => M2(cx(1), cx(0), cx(0), ex(-PI / 4)), inv: 'T', fam: 'phase', label: 'T†', title: 'T-dagger' });
  def('SX', { m: () => M2(cx(.5, .5), cx(.5, -.5), cx(.5, -.5), cx(.5, .5)), inv: 'SXDG', label: '√X', clifford: true, title: '√X' });
  def('SXDG', { m: () => M2(cx(.5, -.5), cx(.5, .5), cx(.5, .5), cx(.5, -.5)), inv: 'SX', label: '√X†', clifford: true, title: '√X-dagger' });
  def('P', { np: 1, fam: 'phase', m: ([l]) => M2(cx(1), cx(0), cx(0), ex(l)), inv: p => ['P', [-p[0]]], title: 'Phase P(λ)' });
  def('RX', { np: 1, fam: 'rot', m: ([t]) => { const c = Math.cos(t / 2), s = Math.sin(t / 2); return M2(cx(c), cx(0, -s), cx(0, -s), cx(c)); }, inv: p => ['RX', [-p[0]]], title: 'Rotation about x' });
  def('RY', { np: 1, fam: 'rot', m: ([t]) => { const c = Math.cos(t / 2), s = Math.sin(t / 2); return M2(cx(c), cx(-s), cx(s), cx(c)); }, inv: p => ['RY', [-p[0]]], title: 'Rotation about y' });
  def('RZ', { np: 1, fam: 'rot', m: ([t]) => M2(ex(-t / 2), cx(0), cx(0), ex(t / 2)), inv: p => ['RZ', [-p[0]]], title: 'Rotation about z' });
  def('U', { np: 3, fam: 'rot', m: ([t, f, l]) => { const c = Math.cos(t / 2), s = Math.sin(t / 2); const a = ex(l), b = ex(f), d = ex(f + l); return M2(cx(c), [-a[0] * s, -a[1] * s], [b[0] * s, b[1] * s], [d[0] * c, d[1] * c]); }, inv: p => ['U', [-p[0], -p[2], -p[1]]], title: 'General U(θ,φ,λ)' });
  // two-target gates: 4x4 row-major, each [re,im]
  const I4 = (f) => { const m = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) m.push(f(r, c)); return m; };
  def('SWAP', { nt: 2, fam: 'control', m4: () => I4((r, c) => cx(({ 0: 0, 1: 2, 2: 1, 3: 3 })[r] === c ? 1 : 0)), inv: 'SWAP', clifford: true, label: '×', title: 'SWAP' });
  def('ISWAP', { nt: 2, fam: 'control', m4: () => I4((r, c) => (r === c && (r === 0 || r === 3)) ? cx(1) : ((r === 1 && c === 2) || (r === 2 && c === 1)) ? cx(0, 1) : cx(0)), inv: p => ['ISWAPDG', []], clifford: true, label: 'iSW', title: 'iSWAP' });
  def('ISWAPDG', { nt: 2, fam: 'control', m4: () => I4((r, c) => (r === c && (r === 0 || r === 3)) ? cx(1) : ((r === 1 && c === 2) || (r === 2 && c === 1)) ? cx(0, -1) : cx(0)), inv: 'ISWAP', label: 'iSW†', title: 'iSWAP-dagger' });
  const pauli2 = (P, t) => { const c = Math.cos(t / 2), s = Math.sin(t / 2); const XX = [[0, 0, 0, 1], [0, 0, 1, 0], [0, 1, 0, 0], [1, 0, 0, 0]], YY = [[0, 0, 0, -1], [0, 0, 1, 0], [0, 1, 0, 0], [-1, 0, 0, 0]]; const K = P === 'X' ? XX : YY; return I4((r, cc) => [r === cc ? c : 0, -s * K[r][cc]]); };
  def('RXX', { nt: 2, np: 1, fam: 'rot', m4: ([t]) => pauli2('X', t), inv: p => ['RXX', [-p[0]]], title: 'XX interaction' });
  def('RYY', { nt: 2, np: 1, fam: 'rot', m4: ([t]) => pauli2('Y', t), inv: p => ['RYY', [-p[0]]], title: 'YY interaction' });
  def('RZZ', { nt: 2, np: 1, fam: 'rot', m4: ([t]) => I4((r, c) => r !== c ? cx(0) : ex((r === 0 || r === 3) ? -t / 2 : t / 2)), inv: p => ['RZZ', [-p[0]]], title: 'ZZ interaction' });
  def('M', { fam: 'measure', nonunitary: true, title: 'Measure' });
  def('RESET', { fam: 'measure', nonunitary: true, label: '|0⟩', title: 'Reset to |0⟩' });
  def('BARRIER', { fam: 'meta', nonunitary: true, label: '┊', title: 'Barrier' });

  function params(op, env) { return (op.p || []).map(x => evalExpr(x, env)); }
  function mat(op, env) { const g = G[op.g]; return g.m ? g.m(params(op, env)) : g.m4 ? g.m4(params(op, env)) : null; }
  function inverseOp(op) {
    const g = G[op.g]; if (!g || g.nonunitary) return null;
    const inv = typeof g.inv === 'function' ? g.inv((op.p || []).map(x => typeof x === 'number' ? x : NaN)) : [g.inv, []];
    const [ng, np] = inv; const o = Object.assign({}, op, { g: ng, p: g.np ? (np.some(isNaN) ? (op.p || []).map(x => typeof x === 'number' ? -x : `-(${x})`) : np) : [] });
    if (op.g === 'U' && op.p.some(x => typeof x !== 'number')) o.p = [`-(${op.p[0]})`, `-(${op.p[2]})`, `-(${op.p[1]})`];
    return o;
  }
  /* ---------- names shown to people ---------- */
  function displayName(op) {
    const g = G[op.g] || { label: op.g }; const nc = (op.c || []).length, base = g.label || op.g;
    if (op.g === 'SUB') return op.sub;
    if (!nc) return base;
    const map = { X: ['CX', 'CCX', 'MCX'], Z: ['CZ', 'CCZ', 'MCZ'], Y: ['CY'], H: ['CH'], P: ['CP'], RX: ['CRX'], RY: ['CRY'], RZ: ['CRZ'], SWAP: ['CSWAP'], S: ['CS'], T: ['CT'], U: ['CU'] }[op.g];
    if (map) return map[Math.min(nc, map.length) - 1] || 'C' + base;
    return 'C'.repeat(nc) + base;
  }
  /* ---------- state ---------- */
  function zero(n) { const re = new Float64Array(1 << n), im = new Float64Array(1 << n); re[0] = 1; return { n, re, im }; }
  function copy(s) { return { n: s.n, re: Float64Array.from(s.re), im: Float64Array.from(s.im) }; }
  const bit = (n, q) => 1 << (n - 1 - q);
  function cmask(n, cs) { let m = 0; for (const c of cs || []) m |= bit(n, c); return m; }
  // generic single-target matrix (may be non-unitary: Kraus), with controls
  function apply1m(s, M, q, cs) {
    const n = s.n, t = bit(n, q), cm = cmask(n, cs), N = s.re.length, re = s.re, im = s.im;
    const [[a, ai], [b, bi], [c, ci], [d, di]] = M;
    for (let i = 0; i < N; i++) {
      if ((i & t) || (i & cm) !== cm) continue;
      const j = i | t, xr = re[i], xi = im[i], yr = re[j], yi = im[j];
      re[i] = a * xr - ai * xi + b * yr - bi * yi; im[i] = a * xi + ai * xr + b * yi + bi * yr;
      re[j] = c * xr - ci * xi + d * yr - di * yi; im[j] = c * xi + ci * xr + d * yi + di * yr;
    }
  }
  function apply2m(s, M, qa, qb, cs) {
    const n = s.n, ta = bit(n, qa), tb = bit(n, qb), cm = cmask(n, cs), N = s.re.length, re = s.re, im = s.im;
    const idx = [0, tb, ta, ta | tb], vr = [0, 0, 0, 0], vi = [0, 0, 0, 0];
    for (let i = 0; i < N; i++) {
      if ((i & ta) || (i & tb) || (i & cm) !== cm) continue;
      for (let k = 0; k < 4; k++) { vr[k] = re[i | idx[k]]; vi[k] = im[i | idx[k]]; }
      for (let r = 0; r < 4; r++) { let sr = 0, si = 0; for (let k = 0; k < 4; k++) { const [mr, mi] = M[r * 4 + k]; sr += mr * vr[k] - mi * vi[k]; si += mr * vi[k] + mi * vr[k]; } re[i | idx[r]] = sr; im[i | idx[r]] = si; }
    }
  }
  function applyUnitary(s, op, env) {
    const g = G[op.g];
    if (op.g === 'PERM') { permute(s, op); return; }
    if (g.m) apply1m(s, g.m(params(op, env)), op.q[0], op.c); else if (g.m4) apply2m(s, g.m4(params(op, env)), op.q[0], op.q[1], op.c);
  }
  // permutation op (used for modular multiplication in Shor): maps work-register value x -> f(x) when controls are set
  function permute(s, op) {
    const n = s.n, N = s.re.length, work = op.q, cm = cmask(n, op.c), re = Float64Array.from(s.re), im = Float64Array.from(s.im);
    s.re.fill(0); s.im.fill(0);
    for (let i = 0; i < N; i++) {
      let j = i;
      if ((i & cm) === cm) { let x = 0; work.forEach((q, k) => { if (i & bit(n, q)) x |= 1 << (work.length - 1 - k); }); const y = op.map[x] ?? x; j = i; work.forEach((q, k) => { const b = bit(n, q); j = (y >> (work.length - 1 - k)) & 1 ? (j | b) : (j & ~b); }); }
      s.re[j] += re[i]; s.im[j] += im[i];
    }
  }
  function probs(s) { const N = s.re.length, p = new Float64Array(N); for (let i = 0; i < N; i++) p[i] = s.re[i] * s.re[i] + s.im[i] * s.im[i]; return p; }
  function norm(s) { let t = 0; for (let i = 0; i < s.re.length; i++) t += s.re[i] ** 2 + s.im[i] ** 2; t = Math.sqrt(t) || 1; for (let i = 0; i < s.re.length; i++) { s.re[i] /= t; s.im[i] /= t; } }
  function phase(s, i) { const r = s.re[i], m = s.im[i]; return r * r + m * m < 1e-14 ? 0 : Math.atan2(m, r); }
  function probOne(s, q) { const b = bit(s.n, q); let p = 0; for (let i = 0; i < s.re.length; i++) if (i & b) p += s.re[i] ** 2 + s.im[i] ** 2; return p; }
  function collapse(s, q, v) { const b = bit(s.n, q); for (let i = 0; i < s.re.length; i++) if (!!(i & b) !== !!v) { s.re[i] = 0; s.im[i] = 0; } norm(s); }
  function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  /* ---------- circuit helpers ---------- */
  function sorted(ops) { return ops.slice().sort((a, b) => a.col - b.col || Math.min(...wires(a)) - Math.min(...wires(b))); }
  function wires(op) { return [...(op.c || []), ...(op.q || [])]; }
  function span(op) { const w = wires(op); return [Math.min(...w), Math.max(...w)]; }
  function expand(circ) { // inline sub-circuit definitions
    const out = [];
    for (const op of sorted(circ.ops)) {
      if (op.g === 'SUB') { const d = (circ.defs || {})[op.sub]; if (!d) continue; for (const o of sorted(d.ops)) out.push(Object.assign({}, o, { q: o.q.map(k => op.q[k]), c: [...(op.c || []), ...(o.c || []).map(k => op.q[k])], col: op.col + o.col / 1000, from: op.id })); }
      else out.push(op);
    }
    return out;
  }
  function condOK(op, cl) { if (!op.cond) return true; if (op.cond.reg != null) { let v = 0; cl.forEach((b, k) => { if (b) v |= 1 << k; }); return v === op.cond.val; } return (cl[op.cond.bit] || 0) === op.cond.val; }
  function terminalFlags(ops, n) { // an M is terminal when nothing later touches its qubit or reads classical bits
    const flags = new Map(), S = ops;
    S.forEach((op, i) => { if (op.g !== 'M') return; const q = op.q[0]; flags.set(op, !S.slice(i + 1).some(o => o.g !== 'M' && o.g !== 'BARRIER' && (wires(o).includes(q) || o.cond))); });
    return flags;
  }
  function isDynamic(circ) { const ops = expand(circ), t = terminalFlags(ops); return ops.some(o => o.g === 'RESET' || o.cond || (o.g === 'M' && !t.get(o))); }
  /* statevector at the playhead: terminal measures are no-ops; mid-circuit measures collapse on a seeded branch */
  function run(circ, upto = Infinity, opts = {}) {
    const n = circ.n, s = opts.init ? copy(opts.init) : zero(n), ops = expand(circ), term = terminalFlags(ops), env = circ.params || {}, rng = mulberry(opts.seed ?? 7), cl = new Array(circ.nc ?? n).fill(0), branch = [];
    for (const op of ops) {
      if (op.col >= upto) break;
      if (!condOK(op, cl)) continue;
      if (op.g === 'BARRIER' || op.g === 'I') continue;
      if (op.g === 'M') { if (term.get(op) && !opts.collapseAll) continue; const p1 = probOne(s, op.q[0]), v = rng() < p1 ? 1 : 0; collapse(s, op.q[0], v); cl[op.cb ?? op.q[0]] = v; branch.push({ q: op.q[0], v, p: v ? p1 : 1 - p1 }); continue; }
      if (op.g === 'RESET') { const p1 = probOne(s, op.q[0]), v = rng() < p1 ? 1 : 0; collapse(s, op.q[0], v); if (v) apply1m(s, G.X.m(), op.q[0], []); continue; }
      applyUnitary(s, op, env);
    }
    s.branch = branch; s.cl = cl; return s;
  }
  /* per-column cache for smooth scrubbing */
  function history(circ, opts = {}) {
    const cols = Math.max(0, ...circ.ops.map(o => o.col + 1)), out = [];
    for (let c = 0; c <= cols; c++) out.push(run(circ, c, opts));
    return out;
  }
  function bloch(s, q) {
    const N = s.re.length, m = bit(s.n, q); let r00 = 0, r11 = 0, xr = 0, xi = 0;
    for (let i = 0; i < N; i++) { const pp = s.re[i] ** 2 + s.im[i] ** 2; if (i & m) { r11 += pp; continue; } r00 += pp; const j = i | m; xr += s.re[i] * s.re[j] + s.im[i] * s.im[j]; xi += s.re[i] * s.im[j] - s.im[i] * s.re[j]; }
    const c = v => Math.abs(v) < 1e-10 ? 0 : v; return [c(2 * xr), c(2 * xi), c(r00 - r11)];
  }
  /* Pauli strings: "Z0 Z1 + 0.5 X0 - 1.2 Y2" */
  function parseObservable(text, n) {
    const terms = [], src = text.replace(/\s+/g, ' ').trim(); if (!src) throw new Error('Type an observable, e.g. Z0 Z1 + 0.5 X0');
    const parts = src.replace(/-\s*/g, '+ -').split('+').map(x => x.trim()).filter(Boolean);
    for (const part of parts) {
      const m = part.match(/^(-?\s*[\d.]*(?:e[+-]?\d+)?)\s*\*?\s*(.*)$/i); let coef = m[1].replace(/\s/g, ''); coef = coef === '' || coef === '+' ? 1 : coef === '-' ? -1 : parseFloat(coef);
      if (isNaN(coef)) throw new Error(`Can’t read the coefficient in “${part}”`);
      const ops = []; const rest = m[2].trim();
      if (rest && rest !== 'I') for (const tok of rest.split(/[\s*]+/)) { const t = tok.match(/^([XYZI])_?(\d+)$/i); if (!t) throw new Error(`“${tok}” isn’t a Pauli like Z0 or X1`); const q = +t[2]; if (q >= n) throw new Error(`q${q} doesn’t exist in a ${n}-qubit register`); if (t[1].toUpperCase() !== 'I') ops.push([t[1].toUpperCase(), q]); }
      terms.push({ coef, ops });
    }
    return terms;
  }
  function expectation(s, terms) {
    let total = 0;
    for (const t of terms) { const u = copy(s); for (const [P, q] of t.ops) apply1m(u, G[P].m(), q, []); let r = 0; for (let i = 0; i < s.re.length; i++) r += s.re[i] * u.re[i] + s.im[i] * u.im[i]; total += t.coef * r; }
    return total;
  }
  function tie(s, a, b) {
    const ba = bloch(s, a), bb = bloch(s, b), P = ['X', 'Y', 'Z']; let best = 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) best = Math.max(best, Math.abs(expectation(s, [{ coef: 1, ops: [[P[i], a], [P[j], b]] }]) - ba[i] * bb[j]));
    return Math.min(1, best);
  }
  function fidelity(a, b) { let r = 0, m = 0; for (let i = 0; i < a.re.length; i++) { r += a.re[i] * b.re[i] + a.im[i] * b.im[i]; m += a.re[i] * b.im[i] - a.im[i] * b.re[i]; } return r * r + m * m; }
  /* reduced density matrix on a subset of qubits (row-major complex) */
  function reduced(s, keep) {
    const n = s.n, k = keep.length, D = 1 << k, rho = new Float64Array(2 * D * D), rest = []; for (let q = 0; q < n; q++) if (!keep.includes(q)) rest.push(q);
    const idx = (i, qs) => { let v = 0; qs.forEach((q, j) => { if (i & bit(n, q)) v |= 1 << (qs.length - 1 - j); }); return v; };
    const groups = new Map();
    for (let i = 0; i < s.re.length; i++) { const r = idx(i, rest); if (!groups.has(r)) groups.set(r, []); groups.get(r).push([idx(i, keep), s.re[i], s.im[i]]); }
    for (const list of groups.values()) for (const [a, ar, ai] of list) for (const [b, br, bi] of list) { const o = 2 * (a * D + b); rho[o] += ar * br + ai * bi; rho[o + 1] += ai * br - ar * bi; }
    return { D, rho };
  }
  /* eigenvalues of a Hermitian matrix via a real-symmetric Jacobi embedding */
  function hermEig(rho, D) {
    const M = 2 * D, A = []; for (let i = 0; i < M; i++) A.push(new Float64Array(M));
    for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) { const re = rho[2 * (i * D + j)], im = rho[2 * (i * D + j) + 1]; A[i][j] = re; A[i + D][j + D] = re; A[i][j + D] = -im; A[i + D][j] = im; }
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0; for (let i = 0; i < M; i++) for (let j = i + 1; j < M; j++) off += A[i][j] ** 2; if (off < 1e-20) break;
      for (let p = 0; p < M; p++) for (let q = p + 1; q < M; q++) {
        if (Math.abs(A[p][q]) < 1e-15) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), sn = t * c;
        for (let k = 0; k < M; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - sn * akq; A[k][q] = sn * akp + c * akq; }
        for (let k = 0; k < M; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - sn * aqk; A[q][k] = sn * apk + c * aqk; }
      }
    }
    const ev = []; for (let i = 0; i < M; i++) ev.push(A[i][i]); ev.sort((a, b) => b - a);
    return ev.filter((_, i) => i % 2 === 0); // each eigenvalue appears twice in the embedding
  }
  function entropy(s, keep) { const { D, rho } = reduced(s, keep); return hermEig(rho, D).reduce((t, l) => l > 1e-12 ? t - l * Math.log2(l) : t, 0); }
  function purity(s, keep) { const { D, rho } = reduced(s, keep); let p = 0; for (let i = 0; i < 2 * D * D; i++) p += rho[i] * rho[i]; return p; }
  /* full unitary (columns are images of basis states) — pure circuits only */
  function unitary(circ) {
    const n = circ.n, N = 1 << n, U = [], ops = expand(circ).filter(o => !G[o.g].nonunitary);
    for (let k = 0; k < N; k++) { const s = zero(n); s.re[0] = 0; s.re[k] = 1; for (const op of ops) applyUnitary(s, op, circ.params || {}); U.push(s); }
    return U; // U[col] = state
  }
  function sameUnitary(n, a, b, params) {
    const U = unitary({ n, ops: a, params }), V = unitary({ n, ops: b, params }); let tr = [0, 0];
    for (let k = 0; k < U.length; k++) { let r = 0, m = 0; for (let i = 0; i < U.length; i++) { r += V[k].re[i] * U[k].re[i] + V[k].im[i] * U[k].im[i]; m += V[k].re[i] * U[k].im[i] - V[k].im[i] * U[k].re[i]; } tr[0] += r; tr[1] += m; }
    const f = Math.hypot(tr[0], tr[1]) / U.length;
    if (f > 1 - 1e-9) return { ok: true, f };
    for (let k = 0; k < U.length; k++) { const fk = fidelity(U[k], V[k]); if (fk < 1 - 1e-6) return { ok: false, input: k, f }; }
    return { ok: false, input: 'phase', f }; // same on every basis input but relative phases differ
  }
  /* ---------- sampling (exact, dynamic trajectories, noise) ---------- */
  function measuredQubits(circ) { const ms = expand(circ).filter(o => o.g === 'M'); return ms.length ? [...new Set(ms.map(o => o.cb ?? o.q[0]))].sort((a, b) => a - b) : null; }
  function marginal(p, n, qs) { const out = {}; for (let i = 0; i < p.length; i++) { if (p[i] < 1e-15) continue; const k = qs.map(q => (i & bit(n, q)) ? '1' : '0').join(''); out[k] = (out[k] || 0) + p[i]; } return out; }
  function drawCounts(dist, shots, rng) {
    const keys = Object.keys(dist), cdf = []; let acc = 0; for (const k of keys) { acc += dist[k]; cdf.push(acc); }
    const counts = {}; for (let s = 0; s < shots; s++) { const r = rng() * acc; let lo = 0, hi = cdf.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < r) lo = m + 1; else hi = m; } counts[keys[lo]] = (counts[keys[lo]] || 0) + 1; }
    return counts;
  }
  function readoutFlip(counts, p, rng) { if (!p) return counts; const out = {}; for (const [k, v] of Object.entries(counts)) for (let s = 0; s < v; s++) { const kk = k.split('').map(b => rng() < p ? (b === '1' ? '0' : '1') : b).join(''); out[kk] = (out[kk] || 0) + 1; } return out; }
  function sample(circ, shots = 1000, opts = {}) {
    const rng = mulberry(opts.seed ?? ((Math.random() * 2 ** 31) | 0)), n = circ.n, noise = opts.noise, mq = measuredQubits(circ), qs = mq || [...Array(n).keys()];
    const noisy = noise && (noise.p1 || noise.p2 || noise.t1 || noise.readout);
    if (!isDynamic(circ) && !noisy) { const p = probs(run(circ)); return { counts: drawCounts(marginal(p, n, qs), shots, rng), exact: marginal(p, n, qs), keys: qs, method: 'statevector' }; }
    if (!isDynamic(circ) && noisy && n <= 7) { const rho = densityRun(circ, noise); const d = new Float64Array(1 << n); for (let i = 0; i < d.length; i++) d[i] = rho.v.re[i * d.length + i]; return { counts: readoutFlip(drawCounts(marginal(d, n, qs), shots, rng), noise.readout, rng), exact: marginal(d, n, qs), keys: qs, method: 'density matrix' }; }
    // trajectories: one statevector per shot
    const counts = {}, ops = expand(circ), term = terminalFlags(ops), env = circ.params || {};
    for (let sh = 0; sh < shots; sh++) {
      const s = zero(n), cl = new Array(circ.nc ?? n).fill(0);
      for (const op of ops) {
        if (!condOK(op, cl) || op.g === 'BARRIER' || op.g === 'I') continue;
        if (op.g === 'M') { const p1 = probOne(s, op.q[0]), v = rng() < p1 ? 1 : 0; collapse(s, op.q[0], v); cl[op.cb ?? op.q[0]] = v; continue; }
        if (op.g === 'RESET') { const p1 = probOne(s, op.q[0]), v = rng() < p1 ? 1 : 0; collapse(s, op.q[0], v); if (v) apply1m(s, G.X.m(), op.q[0], []); continue; }
        applyUnitary(s, op, env);
        if (noisy) for (const q of wires(op)) {
          const p = (wires(op).length > 1 ? noise.p2 : noise.p1) || 0;
          if (p && rng() < p) apply1m(s, G[['X', 'Y', 'Z'][Math.floor(rng() * 3)]].m(), q, []);
          if (noise.t1) { const dt = (wires(op).length > 1 ? noise.g2 || 300 : noise.g1 || 35) / 1000, gam = 1 - Math.exp(-dt / noise.t1), p1 = probOne(s, q); if (rng() < gam * p1) { collapse(s, q, 1); apply1m(s, G.X.m(), q, []); } else if (gam) { apply1m(s, [[1, 0], [0, 0], [0, 0], [Math.sqrt(1 - gam), 0]], q, []); norm(s); }
            if (noise.t2) { const tphi = 1 / Math.max(1e-9, 1 / noise.t2 - 1 / (2 * noise.t1)), lam = 1 - Math.exp(-dt / tphi); if (rng() < lam / 2) apply1m(s, G.Z.m(), q, []); } }
        }
      }
      if (!mq) { const p = probs(s); let r = rng(), acc = 0, k = 0; for (; k < p.length - 1; k++) { acc += p[k]; if (r < acc) break; } for (let q = 0; q < n; q++) cl[q] = (k & bit(n, q)) ? 1 : 0; }
      const key = qs.map(q => cl[q] ? '1' : '0').join(''); counts[key] = (counts[key] || 0) + 1;
    }
    return { counts: noisy ? readoutFlip(counts, noise.readout, rng) : counts, keys: qs, method: 'trajectories' };
  }
  /* ---------- density matrix (vectorised as 2n qubits): exact noise for n ≤ 7 ---------- */
  function conjM(M) { return M.map(([r, i]) => [r, -i]); }
  function densityRun(circ, noise = {}, upto = Infinity) {
    const n = circ.n, v = zero(2 * n), env = circ.params || {}, ops = expand(circ);
    const both1 = (M, q, cs) => { apply1m(v, M, q, cs); apply1m(v, conjM(M), q + n, (cs || []).map(c => c + n)); };
    const both2 = (M, a, b, cs) => { apply2m(v, M, a, b, cs); apply2m(v, conjM(M), a + n, b + n, (cs || []).map(c => c + n)); };
    const kraus = (Ks, q) => { const acc = { re: new Float64Array(v.re.length), im: new Float64Array(v.re.length) }; for (const K of Ks) { const u = copy(v); apply1m(u, K, q, []); apply1m(u, conjM(K), q + n, []); for (let i = 0; i < acc.re.length; i++) { acc.re[i] += u.re[i]; acc.im[i] += u.im[i]; } } v.re = acc.re; v.im = acc.im; };
    const depol = (p, q) => { if (!p) return; const s = Math.sqrt(p / 3); kraus([[[Math.sqrt(1 - p), 0], [0, 0], [0, 0], [Math.sqrt(1 - p), 0]], G.X.m().map(([a, b]) => [a * s, b * s]), G.Y.m().map(([a, b]) => [a * s, b * s]), G.Z.m().map(([a, b]) => [a * s, b * s])], q); };
    for (const op of ops) {
      if (op.col >= upto) break;
      if (op.g === 'BARRIER' || op.g === 'I') continue;
      if (op.g === 'M') { kraus([[[1, 0], [0, 0], [0, 0], [0, 0]], [[0, 0], [0, 0], [0, 0], [1, 0]]], op.q[0]); continue; } // non-selective
      if (op.g === 'RESET') { kraus([[[1, 0], [0, 0], [0, 0], [0, 0]], [[0, 0], [1, 0], [0, 0], [0, 0]]], op.q[0]); continue; }
      const g = G[op.g]; if (g.m) both1(g.m(params(op, env)), op.q[0], op.c); else if (g.m4) both2(g.m4(params(op, env)), op.q[0], op.q[1], op.c);
      for (const q of wires(op)) {
        depol((wires(op).length > 1 ? noise.p2 : noise.p1) || 0, q);
        if (noise.t1) { const dt = (wires(op).length > 1 ? noise.g2 || 300 : noise.g1 || 35) / 1000, gam = 1 - Math.exp(-dt / noise.t1); kraus([[[1, 0], [0, 0], [0, 0], [Math.sqrt(1 - gam), 0]], [[0, 0], [Math.sqrt(gam), 0], [0, 0], [0, 0]]], q);
          if (noise.t2) { const tphi = 1 / Math.max(1e-9, 1 / noise.t2 - 1 / (2 * noise.t1)), lam = 1 - Math.exp(-dt / tphi); kraus([[[1, 0], [0, 0], [0, 0], [Math.sqrt(1 - lam), 0]], [[0, 0], [0, 0], [0, 0], [Math.sqrt(lam), 0]]], q); } }
      }
    }
    return { n, v, get(i, j) { const k = i * (1 << n) + j; return [v.re[k], v.im[k]]; } };
  }
  function densityPure(s) { const N = s.re.length, v = { re: new Float64Array(N * N), im: new Float64Array(N * N) }; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const k = i * N + j; v.re[k] = s.re[i] * s.re[j] + s.im[i] * s.im[j]; v.im[k] = s.im[i] * s.re[j] - s.re[i] * s.im[j]; } return { n: s.n, v, get(i, j) { const k = i * N + j; return [v.re[k], v.im[k]]; } }; }
  /* ---------- stabiliser (CHP) for large Clifford circuits ---------- */
  function isClifford(circ) { return expand(circ).every(o => o.g === 'M' || o.g === 'BARRIER' || ((o.c || []).length === 0 && G[o.g].clifford && o.g !== 'ISWAP' && o.g !== 'ISWAPDG' && o.g !== 'SX' && o.g !== 'SXDG') || ((o.c || []).length === 1 && (o.g === 'X' || o.g === 'Z'))); }
  function stabSample(circ, shots = 1000, seed) {
    const n = circ.n, rng = mulberry(seed ?? 11), ops = expand(circ), mq = measuredQubits(circ) || [...Array(n).keys()], counts = {};
    for (let sh = 0; sh < shots; sh++) {
      const R = 2 * n + 1, x = [], z = [], r = new Uint8Array(R);
      for (let i = 0; i < R; i++) { x.push(new Uint8Array(n)); z.push(new Uint8Array(n)); }
      for (let i = 0; i < n; i++) { x[i][i] = 1; z[i + n][i] = 1; }
      const H = a => { for (let i = 0; i < 2 * n; i++) { r[i] ^= x[i][a] & z[i][a]; const t = x[i][a]; x[i][a] = z[i][a]; z[i][a] = t; } };
      const S = a => { for (let i = 0; i < 2 * n; i++) { r[i] ^= x[i][a] & z[i][a]; z[i][a] ^= x[i][a]; } };
      const CX = (a, b) => { for (let i = 0; i < 2 * n; i++) { r[i] ^= x[i][a] & z[i][b] & (x[i][b] ^ z[i][a] ^ 1); x[i][b] ^= x[i][a]; z[i][a] ^= z[i][b]; } };
      const gfn = (x1, z1, x2, z2) => (x1 === 0 && z1 === 0) ? 0 : (x1 === 1 && z1 === 1) ? z2 - x2 : (x1 === 1 && z1 === 0) ? z2 * (2 * x2 - 1) : x2 * (1 - 2 * z2);
      const rowsum = (h, i) => { let s = 2 * r[h] + 2 * r[i]; for (let j = 0; j < n; j++) s += gfn(x[i][j], z[i][j], x[h][j], z[h][j]); r[h] = ((s % 4) + 4) % 4 === 0 ? 0 : 1; for (let j = 0; j < n; j++) { x[h][j] ^= x[i][j]; z[h][j] ^= z[i][j]; } };
      const meas = a => { let p = -1; for (let i = n; i < 2 * n; i++) if (x[i][a]) { p = i; break; }
        if (p >= 0) { for (let i = 0; i < 2 * n; i++) if (i !== p && x[i][a]) rowsum(i, p); x[p - n].set(x[p]); z[p - n].set(z[p]); r[p - n] = r[p]; x[p].fill(0); z[p].fill(0); z[p][a] = 1; r[p] = rng() < .5 ? 1 : 0; return r[p]; }
        x[2 * n].fill(0); z[2 * n].fill(0); r[2 * n] = 0; for (let i = 0; i < n; i++) if (x[i][a]) rowsum(2 * n, i + n); return r[2 * n]; };
      const cl = new Array(n).fill(0);
      for (const o of ops) {
        const q = o.q[0], c = (o.c || [])[0];
        if (o.g === 'BARRIER') continue;
        if (o.g === 'M') { cl[o.cb ?? q] = meas(q); continue; }
        if (c != null) { if (o.g === 'X') CX(c, q); else { H(q); CX(c, q); H(q); } continue; }
        switch (o.g) { case 'H': H(q); break; case 'S': S(q); break; case 'SDG': S(q); S(q); S(q); break; case 'Z': S(q); S(q); break; case 'X': H(q); S(q); S(q); H(q); break; case 'Y': S(q); S(q); H(q); S(q); S(q); H(q); break; case 'SWAP': CX(o.q[0], o.q[1]); CX(o.q[1], o.q[0]); CX(o.q[0], o.q[1]); break; case 'I': break; }
      }
      if (!measuredQubits(circ)) for (let q = 0; q < n; q++) cl[q] = meas(q);
      const k = mq.map(q => cl[q] ? '1' : '0').join(''); counts[k] = (counts[k] || 0) + 1;
    }
    return { counts, keys: mq, method: 'stabiliser' };
  }
  /* ---------- rotation axis of a single-qubit gate (for the sphere arc) ---------- */
  function axisAngle(M) {
    const [[a, ai], [b, bi], [c, ci], [d, di]] = M, dr = a * d - ai * di - (b * c - bi * ci), dI = a * di + ai * d - (b * ci + bi * c);
    const mag = Math.sqrt(Math.hypot(dr, dI)), ang = Math.atan2(dI, dr) / 2, pr = Math.cos(-ang) / mag, pi = Math.sin(-ang) / mag;
    const mul = ([x, y]) => [x * pr - y * pi, x * pi + y * pr], u00 = mul([a, ai]), u01 = mul([b, bi]), u10 = mul([c, ci]), u11 = mul([d, di]);
    let cc = (u00[0] + u11[0]) / 2; cc = Math.max(-1, Math.min(1, cc)); let th = 2 * Math.acos(cc), s = Math.sin(th / 2);
    if (Math.abs(s) < 1e-9) return { axis: [0, 0, 1], angle: 0 };
    const nx = -(u01[1] + u10[1]) / (2 * s), ny = (u10[0] - u01[0]) / (2 * s), nz = -(u00[1] - u11[1]) / (2 * s), L = Math.hypot(nx, ny, nz) || 1;
    return { axis: [nx / L, ny / L, nz / L], angle: th };
  }
  /* ================= physics libraries ================= */
  // H2 in STO-3G, exact from Gaussian integrals (Szabo–Ostlund), two-electron singlet FCI
  function erf(x) { const t = 1 / (1 + .5 * Math.abs(x)); const y = 1 - t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (.37409196 + t * (.09678418 + t * (-.18628806 + t * (.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-.82215223 + t * .17087277))))))))); return x >= 0 ? y : -y; }
  const F0 = t => t < 1e-8 ? 1 - t / 3 : .5 * Math.sqrt(PI / t) * erf(Math.sqrt(t));
  function h2(Rang) {
    const R = Rang * 1.8897261254578281, al = [3.42525091, .62391373, .16885540], dc = [.15432897, .53532814, .44463454], A = [0, 0], cen = [0, R];
    const Nn = a => Math.pow(2 * a / PI, .75), prim = []; for (let i = 0; i < 3; i++) prim.push([al[i], dc[i] * Nn(al[i])]);
    const S = (a, b, R2) => Math.pow(PI / (a + b), 1.5) * Math.exp(-a * b / (a + b) * R2);
    const T = (a, b, R2) => a * b / (a + b) * (3 - 2 * a * b / (a + b) * R2) * S(a, b, R2);
    const Vn = (a, b, RA, RB, RC) => { const p = a + b, P = (a * RA + b * RB) / p; return -2 * PI / p * Math.exp(-a * b / p * (RA - RB) ** 2) * F0(p * (P - RC) ** 2); };
    const ERI = (a, b, c, d, RA, RB, RC, RD) => { const p = a + b, q = c + d, P = (a * RA + b * RB) / p, Q = (c * RC + d * RD) / q; return 2 * Math.pow(PI, 2.5) / (p * q * Math.sqrt(p + q)) * Math.exp(-a * b / p * (RA - RB) ** 2 - c * d / q * (RC - RD) ** 2) * F0(p * q / (p + q) * (P - Q) ** 2); };
    const c1 = cen; // 1D positions along the bond
    const cS = (i, j) => { let s = 0; for (const [a, da] of prim) for (const [b, db] of prim) s += da * db * S(a, b, (c1[i] - c1[j]) ** 2); return s; };
    const cH = (i, j) => { let s = 0; for (const [a, da] of prim) for (const [b, db] of prim) { const R2 = (c1[i] - c1[j]) ** 2; s += da * db * (T(a, b, R2) + Vn(a, b, c1[i], c1[j], c1[0]) + Vn(a, b, c1[i], c1[j], c1[1])); } return s; };
    const cE = (i, j, k, l) => { let s = 0; for (const [a, da] of prim) for (const [b, db] of prim) for (const [c, dcc] of prim) for (const [d, dd] of prim) s += da * db * dcc * dd * ERI(a, b, c, d, c1[i], c1[j], c1[k], c1[l]); return s; };
    const S12 = cS(0, 1), hA = [[cH(0, 0), cH(0, 1)], [cH(1, 0), cH(1, 1)]];
    const E4 = {}; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) for (let l = 0; l < 2; l++) E4[`${i}${j}${k}${l}`] = cE(i, j, k, l);
    const cg = [1 / Math.sqrt(2 * (1 + S12)), 1 / Math.sqrt(2 * (1 + S12))], cu = [1 / Math.sqrt(2 * (1 - S12)), -1 / Math.sqrt(2 * (1 - S12))];
    const h1 = (C) => { let s = 0; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) s += C[i] * C[j] * hA[i][j]; return s; };
    const e2 = (P, Q, Rr, Ss) => { let s = 0; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) for (let l = 0; l < 2; l++) s += P[i] * Q[j] * Rr[k] * Ss[l] * E4[`${i}${j}${k}${l}`]; return s; };
    const hg = h1(cg), hu = h1(cu), Jgg = e2(cg, cg, cg, cg), Juu = e2(cu, cu, cu, cu), Kgu = e2(cg, cu, cg, cu), Vnn = 1 / R;
    const Ehf = 2 * hg + Jgg + Vnn, Ed = 2 * hu + Juu + Vnn, Kc = Kgu;
    const mid = (Ehf + Ed) / 2, half = (Ehf - Ed) / 2, E0 = mid - Math.sqrt(half * half + Kc * Kc);
    // 2-qubit Hamiltonian on the {|01>,|10>} sector: a·II + b·(ZI−IZ)/2 + c·(XX+YY)/2
    return { R: Rang, Ehf, Ed, K: Kc, E0, a: mid, b: half, c: Kc, hamiltonian: (() => { const t = (c, p) => `${c < 0 ? '-' : '+'} ${Math.abs(c).toFixed(6)} ${p}`; return `${mid.toFixed(6)} I ${t(half / 2, 'Z0')} ${t(-half / 2, 'Z1')} ${t(Kc / 2, 'X0 X1')} ${t(Kc / 2, 'Y0 Y1')}`; })() };
  }
  // VQE ansatz for that Hamiltonian: RY(θ) q0 · CX(0→1) · X q1  →  cos(θ/2)|01> + sin(θ/2)|10>
  function h2Energy(H, th) { const c = Math.cos(th / 2), s = Math.sin(th / 2); return H.a + H.b * (c * c - s * s) + 2 * H.c * c * s; }
  // QAOA MaxCut, exact statevector
  function cutValue(z, n, edges) { let c = 0; for (const [a, b, w = 1] of edges) if (((z >> (n - 1 - a)) & 1) !== ((z >> (n - 1 - b)) & 1)) c += w; return c; }
  function qaoa(n, edges, gammas, betas) {
    const N = 1 << n, C = new Float64Array(N); for (let z = 0; z < N; z++) C[z] = cutValue(z, n, edges);
    const s = { n, re: new Float64Array(N).fill(1 / Math.sqrt(N)), im: new Float64Array(N) };
    for (let k = 0; k < gammas.length; k++) {
      for (let z = 0; z < N; z++) { const ph = -gammas[k] * C[z], c = Math.cos(ph), sn = Math.sin(ph), r = s.re[z], i = s.im[z]; s.re[z] = r * c - i * sn; s.im[z] = r * sn + i * c; }
      const M = G.RX.m([2 * betas[k]]); for (let q = 0; q < n; q++) apply1m(s, M, q, []);
    }
    const p = probs(s); let e = 0, best = 0; for (let z = 0; z < N; z++) { e += p[z] * C[z]; best = Math.max(best, C[z]); }
    return { expect: e, max: best, ratio: best ? e / best : 0, probs: p, C };
  }
  function qaoaCircuit(n, edges, gammas, betas) {
    const ops = []; let col = 0; for (let q = 0; q < n; q++) ops.push({ g: 'H', q: [q], col }); col++;
    gammas.forEach((g, k) => { for (const [a, b] of edges) ops.push({ g: 'RZZ', q: [a, b], p: [-g], col: col++ }); for (let q = 0; q < n; q++) ops.push({ g: 'RX', q: [q], p: [2 * betas[k]], col }); col++; });
    for (let q = 0; q < n; q++) ops.push({ g: 'M', q: [q], col }); return { n, ops };
  }
  // Shor: classical period, exact QFT-register distribution, continued fractions
  const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a);
  function modpow(a, e, N) { let r = 1, b = a % N; while (e) { if (e & 1) r = r * b % N; b = b * b % N; e >>= 1; } return r; }
  function order(a, N) { let r = 1, v = a % N; while (v !== 1) { v = v * a % N; r++; if (r > N) return null; } return r; }
  function shorDistribution(a, N, t) {
    const Q = 1 << t, groups = new Map(); for (let x = 0; x < Q; x++) { const f = modpow(a, x, N); if (!groups.has(f)) groups.set(f, []); groups.get(f).push(x); }
    const P = new Float64Array(Q);
    for (let y = 0; y < Q; y++) { let tot = 0; for (const xs of groups.values()) { let r = 0, i = 0; for (const x of xs) { const ang = 2 * PI * x * y / Q; r += Math.cos(ang); i += Math.sin(ang); } tot += r * r + i * i; } P[y] = tot / (Q * Q); }
    return P;
  }
  function contFrac(y, Q, maxDen) { // best convergent p/q with q ≤ maxDen
    let a0 = Math.floor(y / Q), h = [a0, 1], k = [1, 0], num = y, den = Q, out = [[a0, 1]]; let rem = num - a0 * den;
    let n2 = den, d2 = rem; while (d2 !== 0) { const a = Math.floor(n2 / d2); const hn = a * h[0] + h[1], kn = a * k[0] + k[1]; if (kn > maxDen) break; h = [hn, h[0]]; k = [kn, k[0]]; out.push([hn, kn]); [n2, d2] = [d2, n2 - a * d2]; }
    return out;
  }
  // phase estimation, analytic distribution for eigenphase phi with t ancillas
  function qpeDistribution(phi, t) { const Q = 1 << t, P = new Float64Array(Q); for (let y = 0; y < Q; y++) { const d = phi - y / Q; let r = 0, i = 0; for (let k = 0; k < Q; k++) { r += Math.cos(2 * PI * k * d); i += Math.sin(2 * PI * k * d); } P[y] = (r * r + i * i) / (Q * Q); } return P; }
  function qftOps(qs, col = 0, inverse = false) { // q0 = most significant
    const ops = [], n = qs.length;
    const seq = []; for (let i = 0; i < n; i++) { seq.push({ g: 'H', q: [qs[i]] }); for (let j = i + 1; j < n; j++) seq.push({ g: 'P', q: [qs[i]], c: [qs[j]], p: [PI / (1 << (j - i))] }); }
    for (let i = 0; i < Math.floor(n / 2); i++) seq.push({ g: 'SWAP', q: [qs[i], qs[n - 1 - i]] });
    const S = inverse ? seq.slice().reverse().map(o => o.g === 'P' ? Object.assign({}, o, { p: [-o.p[0]] }) : o) : seq;
    return S.map((o, k) => Object.assign({ col: col + k }, o));
  }
  return { PI, G, evalExpr, params, mat, inverseOp, displayName, zero, copy, bit, run, history, probs, phase, bloch, probOne, parseObservable, expectation, tie, fidelity, reduced, hermEig, entropy, purity, unitary, sameUnitary, sample, measuredQubits, marginal, densityRun, densityPure, isClifford, stabSample, isDynamic, expand, sorted, wires, span, axisAngle, apply1m, applyUnitary, mulberry,
    h2, h2Energy, qaoa, qaoaCircuit, cutValue, gcd, modpow, order, shorDistribution, contFrac, qpeDistribution, qftOps };
}
