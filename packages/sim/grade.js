/* =====================================================================
   Q — a compact circuit notation used by the course, library and practice.
     "H0 CX0.1 RY2(pi/3) CCX0.1.2 M* QFT0.1.2 X2?c1=1 H* B"
     controls come first, targets last; * = every qubit; ?c1=1 / ?c=3 conditions.
   GRADE — behaviour grading shared by lessons, exercises and challenges.
===================================================================== */
const Q = (() => {
  const TOK = /^([A-Z]+)(\*|\d+(?:\.\d+)*)?(?:\(([^)]*)\))?(?:\?c(\d*)=(\d+))?$/;
  function split(name) { let c = 0, g = name; while (!Sim.G[g] && g[0] === 'C' && g.length > 1) { g = g.slice(1); c++; } return Sim.G[g] ? { g, c } : null; }
  function parse(n, text, extra = {}) {
    const ops = [], front = new Array(n).fill(0); let cfront = 0;
    const place = (o, allCols) => { const w = Sim.wires(o), lo = Math.min(...w), hi = Math.max(...w); let col = 0; for (let q = allCols ? 0 : lo; q <= (allCols ? n - 1 : hi); q++) col = Math.max(col, front[q]); if (o.cond) col = Math.max(col, cfront); o.col = col; for (let q = lo; q <= hi; q++) front[q] = col + 1; if (o.g === 'M') cfront = Math.max(cfront, col + 1); ops.push(o); };
    const toks = String(text || '').trim().split(/\s+/).filter(Boolean);
    for (const t of toks) {
      const m = t.match(TOK); if (!m) throw new Error(`Can’t read “${t}”`);
      const [, name, wires, par, cbit, cval] = m;
      const ps = par ? par.split(',').map(x => { x = x.trim(); try { return Sim.evalExpr(x, {}); } catch (e) { return x; } }) : [];
      const cond = cval != null ? (cbit === '' ? { reg: 'c', val: +cval } : { bit: +cbit, val: +cval }) : undefined;
      const all = wires === '*', ws = all ? [...Array(n).keys()] : (wires || '').split('.').filter(x => x !== '').map(Number);
      if (ws.some(q => q >= n)) throw new Error(`“${t}” uses a qubit beyond ${n}`);
      if (name === 'QFT' || name === 'IQFT') { Sim.qftOps(ws, 0, name === 'IQFT').forEach(o => place(IR.op(o.g, o.q, { c: o.c || [], p: o.p || [] }))); continue; }
      if (name === 'B') { place(IR.op('BARRIER', [...Array(n).keys()]), true); continue; }
      if (name === 'M') { if (all) { const col = Math.max(...front); ws.forEach(q => { const o = IR.op('M', [q], { cb: q }); o.col = col; front[q] = col + 1; ops.push(o); }); cfront = col + 1; } else ws.forEach(q => place(IR.op('M', [q], { cb: q }))); continue; }
      const sp = split(name); if (!sp) throw new Error(`Unknown gate “${name}”`);
      const G = Sim.G[sp.g], nt = G.nt || 1;
      if (all) { ws.forEach(q => place(IR.op(sp.g, [q], { p: ps, cond }))); continue; }
      if (ws.length !== sp.c + nt) throw new Error(`“${t}” needs ${sp.c + nt} qubit indices`);
      place(IR.op(sp.g, ws.slice(sp.c), { c: ws.slice(0, sp.c), p: ps, cond }));
    }
    return Object.assign({ n, nc: n, ops, defs: {}, params: {}, name: '' }, extra);
  }
  // canonical text of a circuit (misconception clusters, sharing)
  function text(C) {
    return Sim.sorted(Sim.expand(C)).map(o => {
      if (o.g === 'BARRIER') return 'B';
      const ps = (o.p || []).length ? `(${o.p.map(p => typeof p === 'number' ? Code.fmtNum(p) : p).join(',')})` : '';
      const cd = o.cond ? (o.cond.reg != null ? `?c=${o.cond.val}` : `?c${o.cond.bit}=${o.cond.val}`) : '';
      return 'C'.repeat((o.c || []).length) + o.g + [...(o.c || []), ...o.q].join('.') + ps + cd;
    }).join(' ');
  }
  return { parse, text };
})();

const Grade = (() => {
  const strip = C => ({ n: C.n, nc: C.nc ?? C.n, params: C.params || {}, ops: Sim.expand(C).filter(o => o.g !== 'M' && o.g !== 'BARRIER') });
  const unitaryOnly = C => !Sim.isDynamic(C);
  const circ = (x, n) => typeof x === 'string' ? Q.parse(n, x) : x;
  function exactDist(C) {
    const qs = Sim.measuredQubits(C) || [...Array(C.n).keys()];
    if (!Sim.isDynamic(C)) { const s = Sim.run(strip(C)); return Sim.marginal(Sim.probs(s), C.n, qs); }
    const r = Sim.sample(Object.assign({}, C, { ops: Sim.expand(C) }), 4000, { seed: 99 }); const out = {}; for (const k in r.counts) out[k] = r.counts[k] / 4000; return out;
  }
  function tvd(a, b) { const ks = new Set([...Object.keys(a), ...Object.keys(b)]); let d = 0; ks.forEach(k => d += Math.abs((a[k] || 0) - (b[k] || 0))); return d / 2; }
  /* does circuit L satisfy spec? spec: {answer, match, n, gates?, limit?, nn?, q?, obs?, val?, key?, min?, len?, R?, edges?, target?} */
  function check(L, spec) {
    const n = spec.n, A = spec.answer ? circ(spec.answer, n) : null, res = { ok: false, score: 0, why: '' };
    const used = Sim.expand(L).filter(o => o.g !== 'BARRIER' && o.g !== 'M');
    if (spec.limit != null && used.length > spec.limit) { res.why = `Use at most ${spec.limit} gate${spec.limit > 1 ? 's' : ''} (you have ${used.length}).`; }
    if (spec.nn && used.some(o => { const w = Sim.wires(o); return w.length === 2 && Math.abs(w[0] - w[1]) !== 1; })) res.why = 'Only neighbouring qubits can interact on this chip.';
    const m = spec.match || 'state';
    try {
      if (m === 'state') { if (Sim.isDynamic(L)) return Object.assign(res, { why: 'Compare states without mid-circuit measurement.' }); const f = Sim.fidelity(Sim.run(strip(L)), Sim.run(strip(A))); res.score = f; res.ok = f > .999; }
      else if (m === 'unitary') { if (!unitaryOnly(L)) return Object.assign(res, { why: 'Remove mid-circuit measurements first.' }); const r = Sim.sameUnitary(n, strip(L).ops, strip(A).ops, Object.assign({}, A.params, L.params)); res.ok = r.ok; res.score = r.ok ? 1 : (r.f || 0); res.input = r.input; }
      else if (m === 'probs') { const d = tvd(exactDist(L), exactDist(A)); res.score = 1 - d; res.ok = d < (Sim.isDynamic(L) || Sim.isDynamic(A) ? .05 : .01); }
      else if (m === 'peak') { const p = exactDist(L)[spec.key] || 0; res.score = Math.min(1, p / spec.min); res.ok = p >= spec.min; res.value = p; }
      else if (m === 'bloch') { // every measurement branch must leave qubit q with the target arrow
        const t = Sim.bloch(Sim.run(strip(circ(spec.target, n))), spec.tq ?? 0); let worst = 1;
        for (let sd = 1; sd <= 12; sd++) { const s = Sim.run(Object.assign({}, L, { ops: Sim.expand(L) }), Infinity, { seed: sd, collapseAll: true }); const b = Sim.bloch(s, spec.q); worst = Math.min(worst, (1 + b[0] * t[0] + b[1] * t[1] + b[2] * t[2]) / 2); }
        res.score = worst; res.ok = worst > .995; }
      else if (m === 'blochlen') { const b = Sim.bloch(Sim.run(strip(L)), spec.q), len = Math.hypot(...b); res.value = len; res.score = 1 - Math.min(1, Math.abs(len - spec.len)); res.ok = Math.abs(len - spec.len) < (spec.tol || .03); }
      else if (m === 'purity') { const p = Sim.purity(Sim.run(strip(L)), [spec.q]); res.value = p; res.score = Math.min(1, (1 - p) / .5); res.ok = p < (spec.max || .51); }
      else if (m === 'expect') { const v = Sim.expectation(Sim.run(strip(L)), Sim.parseObservable(spec.obs, n)); res.value = v; res.score = 1 - Math.min(1, Math.abs(v - spec.val)); res.ok = Math.abs(v - spec.val) < (spec.tol || .02); }
      else if (m === 'energy') { const H = Sim.h2(spec.R || .735), v = Sim.expectation(Sim.run(strip(L)), Sim.parseObservable(H.hamiltonian, 2)), tgt = spec.target === 'hf' ? H.Ehf : H.E0; res.value = v; res.target = tgt; res.score = Math.max(0, 1 - Math.abs(v - tgt) / .5); res.ok = Math.abs(v - tgt) < (spec.tol || .002); }
      else if (m === 'cut') { const s = Sim.run(strip(L)), p = Sim.probs(s); let e = 0; for (let z = 0; z < p.length; z++) e += p[z] * Sim.cutValue(z, n, spec.edges); res.value = e; res.score = Math.min(1, e / spec.min); res.ok = e >= spec.min; }
    } catch (e) { res.ok = false; res.why = e.message; }
    if (spec.count) for (const [g, k] of Object.entries(spec.count)) { const have = used.filter(o => o.g === g && !(o.c || []).length).length; if (have !== k) { res.ok = false; res.why = `Use exactly ${k} ${g} gate${k > 1 ? 's' : ''} (you have ${have}).`; } }
    if (res.why && res.ok) res.ok = false;
    if (spec.gates && used.some(o => !gateAllowed(o, spec.gates))) { res.ok = false; res.why = `Use only ${spec.gates.map(g => LABEL[g] || g).join(', ')}.`; }
    return res;
  }
  function paletteKey(o) { const c = (o.c || []).length; if (!c) return o.g; if (c === 1) return 'C' + (o.g === 'P' ? 'P' : o.g); if (c === 2 && o.g === 'X') return 'CCX'; return 'MC' + o.g; }
  function gateAllowed(o, gates) { if (o.cond) return gates.includes('IFX') || gates.includes(o.g); return gates.includes(paletteKey(o)) || gates.includes(o.g) && !(o.c || []).length; }
  /* failure feedback: first differing input side by side, and the step where the paths part */
  function diagnose(L, spec) {
    const n = spec.n, A = circ(spec.answer, n), m = spec.match || 'state';
    const inputs = m === 'unitary' ? Array.from({ length: 1 << n }, (_, i) => i) : [0];
    const prep = k => { const ops = []; for (let q = 0; q < n; q++) if (k & (1 << (n - 1 - q))) ops.push({ g: 'X', q: [q], c: [], p: [], col: -1 }); return ops; };
    const runWith = (C, k, upto = Infinity) => Sim.run({ n, params: Object.assign({}, A.params, C.params), ops: prep(k).concat(strip(C).ops) }, upto);
    let bad = null;
    for (const k of inputs) { const a = runWith(L, k), b = runWith(A, k); if (Sim.fidelity(a, b) < .999) { bad = { k, mine: a, want: b }; break; } }
    if (!bad && m === 'unitary') { bad = { k: 0, mine: runWith(L, 0), want: runWith(A, 0), phaseOnly: true }; }
    if (!bad) return null;
    // walk the learner's columns; find the last step that still lies on the reference path
    const colsL = [...new Set(strip(L).ops.map(o => Math.floor(o.col)))].sort((a, b) => a - b), colsA = [...new Set(strip(A).ops.map(o => Math.floor(o.col)))].sort((a, b) => a - b);
    const refStates = [runWith(A, bad.k, -Infinity)].concat(colsA.map(c => runWith(A, bad.k, c + 1)));
    let lastOn = -1; for (let i = 0; i < colsL.length; i++) { const s = runWith(L, bad.k, colsL[i] + 1); if (refStates.some(r => Sim.fidelity(r, s) > .999)) lastOn = i; else break; }
    const div = colsL[lastOn + 1]; const gates = strip(L).ops.filter(o => Math.floor(o.col) === div);
    return Object.assign(bad, { input: bad.k.toString(2).padStart(n, '0'), step: div, gates });
  }
  return { check, diagnose, exactDist, tvd, circ, strip, gateAllowed };
})();
