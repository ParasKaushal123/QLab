/* =====================================================================
   INSIGHT — real-time explanations and error detection for any circuit.
   Everything here is computed from the simulator (no AI, no network):
     Insight.narrate(C)   → one entry per step: what the gates did to the
                            state, in words, with the numbers behind them.
     Insight.diagnose(C)  → mistakes and inefficiencies, each with a
                            severity, the ops involved and (when the ops
                            carry grid meta) a one-click fix.
     Insight.describe(s)  → a plain summary of a state (per-qubit names,
                            entanglement, outcome odds).
   AI answers (ai.js) are grounded in these facts.
===================================================================== */
const Insight = (() => {
  const EPS = 1e-9;
  const ket = (i, n) => '|' + i.toString(2).padStart(n, '0') + '⟩';
  const r3 = x => Math.abs(x) < 5e-4 ? 0 : +x.toFixed(3);
  const pct = x => (x * 100).toFixed(x > 0.001 && x < 0.999 ? 1 : 0) + '%';
  const SELF_INV = new Set(['H', 'X', 'Y', 'Z', 'SWAP']);
  const INV = { S: 'SDG', SDG: 'S', T: 'TDG', TDG: 'T', SX: 'SXDG', SXDG: 'SX', ISWAP: 'ISWAPDG', ISWAPDG: 'ISWAP' };
  const ROT = new Set(['RX', 'RY', 'RZ', 'P', 'RXX', 'RYY', 'RZZ']);
  const PHASE_ONLY = new Set(['Z', 'S', 'SDG', 'T', 'TDG', 'P', 'RZ']);
  const NAMES = { H: 'Hadamard', X: 'X (bit flip)', Y: 'Y', Z: 'Z (phase flip)', S: 'S (quarter phase)', SDG: 'S†', T: 'T (eighth phase)', TDG: 'T†', SX: '√X', SXDG: '√X†', RX: 'Rx', RY: 'Ry', RZ: 'Rz', P: 'phase P', U: 'U', SWAP: 'SWAP', ISWAP: 'iSWAP', RXX: 'XX rotation', RYY: 'YY rotation', RZZ: 'ZZ rotation', M: 'measurement', RESET: 'reset' };

  function num(v, env) { if (typeof v === 'number') return v; try { return Sim.evalExpr(String(v), env || {}); } catch (e) { return NaN; } }
  function params(o, env) { return (o.p || []).map(v => num(v, env)); }
  function opName(o, env) {
    const c = (o.c || []).length, base = NAMES[o.g] || o.g, ps = params(o, env).map(x => isFinite(x) ? fmt.ang(x) : '?');
    const pre = c === 1 ? (o.g === 'X' ? 'CNOT' : 'controlled-' + base) : c === 2 && o.g === 'X' ? 'Toffoli' : c > 1 ? `${c}-controlled ${base}` : base;
    return pre + (ps.length ? `(${ps.join(', ')})` : '');
  }
  function where(o) {
    const c = (o.c || []), t = o.q.map(q => 'q' + q).join(', ');
    return c.length ? `control ${c.map(q => 'q' + q).join(', ')}, target ${t}` : t;
  }

  /* ---------- describing a state ---------- */
  function amps(s, max = 6) {
    const n = s.n, out = [];
    for (let i = 0; i < s.re.length; i++) { const p = s.re[i] ** 2 + s.im[i] ** 2; if (p > 1e-9) out.push({ i, p, re: s.re[i], im: s.im[i] }); }
    out.sort((a, b) => b.p - a.p);
    return { list: out.slice(0, max), more: Math.max(0, out.length - max), n };
  }
  function coef(re, im) {
    const r = r3(re), m = r3(im);
    const known = [[0.707, '1/√2'], [0.5, '1/2'], [0.354, '1/(2√2)'], [0.577, '1/√3'], [0.25, '1/4']];
    const nice = x => { const a = Math.abs(x); for (const [v, t] of known) if (Math.abs(a - v) < 2e-3) return (x < 0 ? '−' : '') + t; if (Math.abs(a - 1) < 2e-3) return x < 0 ? '−' : ''; return (x < 0 ? '−' : '') + a.toFixed(3); };
    if (!m) return nice(r); if (!r) { const t = nice(m); return (t === '' ? '' : t === '−' ? '−' : t) + 'i'; }
    return `(${r.toFixed(3)} ${m < 0 ? '−' : '+'} ${Math.abs(m).toFixed(3)}i)`;
  }
  function stateText(s, max = 4) {
    const { list, more, n } = amps(s, max);
    let t = list.map((a, k) => { let c = coef(a.re, a.im); const sign = k && !c.startsWith('−') ? ' + ' : k ? ' ' : ''; if (k && c.startsWith('−')) c = '− ' + c.slice(1); return sign + c + ket(a.i, n); }).join('');
    return t + (more ? ` + ${more} more` : '');
  }
  const CARD = [[[0, 0, 1], '|0⟩'], [[0, 0, -1], '|1⟩'], [[1, 0, 0], '|+⟩'], [[-1, 0, 0], '|−⟩'], [[0, 1, 0], '|i⟩'], [[0, -1, 0], '|−i⟩']];
  function qubitName(b) {
    const L = Math.hypot(...b);
    if (L < 0.98) return { name: L < 0.05 ? 'maximally entangled' : 'entangled', pure: false, len: L };
    for (const [v, nm] of CARD) if (Math.abs(b[0] - v[0]) + Math.abs(b[1] - v[1]) + Math.abs(b[2] - v[2]) < 0.02) return { name: nm, pure: true, len: L, basis: nm === '|0⟩' || nm === '|1⟩' };
    return { name: 'a superposition', pure: true, len: L };
  }
  function describe(s) {
    const n = s.n, p = Sim.probs(s), qubits = [];
    for (let q = 0; q < n; q++) { const b = Sim.bloch(s, q), nm = qubitName(b); qubits.push(Object.assign({ q, bloch: b.map(r3), p1: r3((1 - b[2]) / 2) }, nm)); }
    const pairs = []; if (n <= 8) for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) { const t = Sim.tie(s, a, b); if (t > 0.05) pairs.push({ q: [a, b], strength: r3(t) }); }
    const outcomes = Array.from(p).map((v, i) => ({ ket: ket(i, n).slice(1, -1), p: v })).filter(o => o.p > 1e-9).sort((a, b) => b.p - a.p);
    return { n, text: stateText(s), qubits, pairs, outcomes, entangled: qubits.some(x => !x.pure) };
  }

  /* ---------- narration: one entry per step ---------- */
  function stepsOf(C) {
    const ops = Sim.sorted(Sim.expand(C)), groups = new Map();
    ops.forEach(o => { const k = o.meta && o.meta.gc != null ? o.meta.gc : Math.floor(o.col); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); });
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }
  function runOps(C, ops) { return Sim.run(Object.assign({}, C, { ops })); }
  function narrate(C, { max = 40 } = {}) {
    const env = C.params || {}; if (C.n > 12) return { steps: [], note: 'Step-by-step explanations are available up to 12 qubits.' };
    const steps = stepsOf(C), out = []; let done = [];
    let prev = runOps(C, []);
    for (const [k, ops] of steps.slice(0, max)) {
      done = done.concat(ops);
      const isPrep = k === -1, meas = ops.filter(o => o.g === 'M'), gates = ops.filter(o => o.g !== 'M' && o.g !== 'BARRIER');
      const cur = runOps(C, done), before = describe(prev), after = describe(cur);
      const pb = Sim.probs(prev), pa = Sim.probs(cur); let dp = 0; for (let i = 0; i < pa.length; i++) dp = Math.max(dp, Math.abs(pa[i] - pb[i]));
      const fid = Sim.fidelity(prev, cur);
      const lines = [];
      if (isPrep) lines.push(`Starting state: ${after.qubits.map(x => `q${x.q} = ${x.name}`).join(', ')}.`);
      else {
        units(gates).forEach(u => lines.push(u.ops.length === 1 ? explainOp(u.ops[0], before, after, env) : explainUnit(u, before, after)));
        if (gates.length && fid > 1 - EPS) lines.push('Overall the state did not change here (up to a global phase).');
        else if (gates.length && dp < 1e-9) lines.push('The outcome probabilities are unchanged: this step only moved phases. A later interference step (like H) can turn that phase into different odds.');
        const newPairs = after.pairs.filter(pp => !before.pairs.some(x => x.q[0] === pp.q[0] && x.q[1] === pp.q[1]));
        const lost = before.pairs.filter(pp => !after.pairs.some(x => x.q[0] === pp.q[0] && x.q[1] === pp.q[1]));
        newPairs.forEach(pp => lines.push(`q${pp.q[0]} and q${pp.q[1]} are now entangled: neither has a state of its own, and measuring one tells you about the other.`));
        lost.forEach(pp => lines.push(`q${pp.q[0]} and q${pp.q[1]} are no longer entangled.`));
        meas.forEach(o => { const q = o.q[0], p1 = Sim.probOne(cur, q); lines.push(`Measure q${q}: it reads 1 with probability ${pct(p1)} and 0 with ${pct(1 - p1)}. After measuring, its superposition is gone.`); });
      }
      const top = after.outcomes.slice(0, 4).map(o => `${o.ket} ${pct(o.p)}`).join(', ');
      out.push({ key: k, label: isPrep ? 'Start' : `Step ${k + 1}`, ops: ops.map(o => o.id).filter(x => x != null), gates: isPrep ? [] : units(ops).map(u => u.ops.length === 1 ? opName(u.ops[0], env) : u.label), lines, state: after.text, odds: top, entangled: after.entangled, changed: fid < 1 - EPS });
      prev = cur;
    }
    if (!steps.length) out.push({ key: 0, label: 'Start', ops: [], gates: [], lines: [`All ${C.n} qubits start in |0⟩. Every measurement would read ${'0'.repeat(C.n)}.`], state: stateText(prev), odds: `${'0'.repeat(C.n)} 100%`, entangled: false, changed: false });
    return { steps: out, final: describe(prev) };
  }
  // ops that came from one grid cell (a decomposed gate) are explained as that gate
  function units(ops) { const m = new Map(); ops.forEach(o => { const k = o.meta && o.meta.gc != null && o.meta.label ? o.meta.gc + ':' + (o.meta.w || []).join(',') : 'id' + (o.id ?? Math.random()); if (!m.has(k)) m.set(k, { ops: [], label: o.meta && o.meta.label, w: o.meta && o.meta.w }); m.get(k).ops.push(o); }); return [...m.values()]; }
  function moveText(q, before, after, solo) { const qa = after.qubits, qb = before.qubits, pre = solo ? '' : `q${q}: `; return qb[q].name === qa[q].name ? (qa[q].pure ? `${pre}stays ${qa[q].name}` : `${pre}stays entangled`) : `${pre}${qb[q].pure ? qb[q].name : 'entangled'} → ${qa[q].pure ? qa[q].name : 'entangled'}${qa[q].pure && qa[q].name === 'a superposition' ? ` (P(1) = ${pct(qa[q].p1)})` : ''}`; }
  function explainUnit(u, before, after) { const w = u.w || [...new Set(u.ops.flatMap(o => o.q))]; return `${u.label} on ${w.map(q => 'q' + q).join(', ')}: ${w.map(q => moveText(q, before, after, w.length === 1)).join('; ')}.`; }
  function explainOp(o, before, after, env) {
    const t = o.q, c = o.c || [], nm = opName(o, env), qa = after.qubits, qb = before.qubits;
    const move = q => qb[q].name === qa[q].name ? (qa[q].pure ? `q${q} stays ${qa[q].name}` : `q${q} stays entangled`) : `q${q}: ${qb[q].pure ? qb[q].name : 'entangled'} → ${qa[q].pure ? qa[q].name : 'entangled'}${qa[q].pure && qa[q].name === 'a superposition' ? ` (P(1) = ${pct(qa[q].p1)})` : ''}`;
    if (c.length) {
      const cs = c.map(q => qb[q]); const allOne = cs.every(x => x.name === '|1⟩'), anyZero = cs.some(x => x.name === '|0⟩');
      const why = anyZero ? ` The control ${c.length > 1 ? 'qubits are not all' : 'is'} ${c.length > 1 ? '1' : '|0⟩'}, so nothing happens.` : allOne ? ' The control is |1⟩, so the target is always acted on.' : ' The control is in superposition, so the target is acted on only in the branch where the control is 1.';
      return `${nm} (${where(o)}).${why} ${t.map(move).join('; ')}.`;
    }
    return `${nm} on ${t.map(q => 'q' + q).join(', ')}: ${t.map(q => moveText(q, before, after, t.length === 1)).join('; ')}.`;
  }

  /* ---------- diagnostics: mistakes, dead gates, simplifications ---------- */
  function sameWires(a, b) { const A = [...(a.c || [])].sort() + '|' + [...a.q].sort(), B = [...(b.c || [])].sort() + '|' + [...b.q].sort(); return A === B; }
  function cellsOf(ops) { const cells = []; ops.forEach(o => { if (o.meta && o.meta.gc >= 0) (o.meta.w || []).concat(o.c || []).forEach(w => cells.push({ gc: o.meta.gc, w })); }); return cells.length ? cells : null; }
  function diagnose(C, { lab = false } = {}) {
    const env = C.params || {}, ops = Sim.sorted(Sim.expand(C)).filter(o => !(o.meta && o.meta.gc === -1)), issues = [];
    const add = (sev, id, title, detail, involved, fixLabel) => { const cells = cellsOf(involved); issues.push({ sev, id, title, detail, ops: involved.map(o => o.id).filter(x => x != null), cells, fix: cells && fixLabel ? fixLabel : null }); };
    // next op touching any of o's wires
    const nextOn = (i) => { const w = Sim.wires(ops[i]); for (let j = i + 1; j < ops.length; j++) if (Sim.wires(ops[j]).some(x => w.includes(x))) return j; return -1; };
    const used = new Set();
    ops.forEach((o, i) => {
      Sim.wires(o).forEach(w => used.add(w));
      const ps = params(o, env);
      if (ps.some(x => !isFinite(x))) add('error', 'bad-angle', `Can’t read the angle of ${NAMES[o.g] || o.g}`, 'Use a number or an expression such as pi/4 or 2*pi/3.', [o]);
      if (o.g === 'M' || o.g === 'BARRIER' || o.g === 'RESET') return;
      const j = nextOn(i); if (j < 0) return; const p = ops[j];
      if (Sim.wires(p).length !== Sim.wires(o).length || !sameWires(o, p)) return;
      if (used.has('pair' + i)) return;
      if (p.g === o.g && SELF_INV.has(o.g)) { used.add('pair' + j); add('warn', 'cancel', `Two ${opName(o, env)} gates in a row cancel`, `${opName(o, env)} undoes itself: applying it twice on ${where(o)} is the identity. Remove both (unless you meant to show exactly this).`, [o, p], 'Remove both'); return; }
      if (INV[o.g] === p.g) { used.add('pair' + j); add('warn', 'cancel', `${opName(o, env)} then ${opName(p, env)} cancel`, 'These two gates are inverses of each other, so together they do nothing.', [o, p], 'Remove both'); return; }
      if (ROT.has(o.g) && p.g === o.g) { const a = ps[0], b = params(p, env)[0]; if (Math.abs(((a + b) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)) < 1e-9 || Math.abs(Math.abs((a + b) % (4 * Math.PI)) - 0) < 1e-9) { used.add('pair' + j); add('warn', 'cancel', `Two ${NAMES[o.g]} rotations add up to zero`, `${fmt.ang(a)} + ${fmt.ang(b)} = 0, so the pair does nothing.`, [o, p], 'Remove both'); } else add('info', 'merge', `Two ${NAMES[o.g]} rotations in a row can be merged`, `${NAMES[o.g]}(${fmt.ang(a)}) followed by ${NAMES[o.g]}(${fmt.ang(b)}) equals one ${NAMES[o.g]}(${fmt.ang(a + b)}).`, [o, p]); }
    });
    // rotations by zero, gates after measurement, dead controls, invisible phases
    let s = Sim.zero(C.n); const prep = Sim.sorted(Sim.expand(C)).filter(o => o.meta && o.meta.gc === -1); if (prep.length) s = Sim.run(Object.assign({}, C, { ops: prep }));
    const measuredAt = new Map();
    const running = []; prep.forEach(o => running.push(o));
    ops.forEach(o => {
      const before = C.n <= 12 ? Sim.run(Object.assign({}, C, { ops: running })) : null;
      if (o.g === 'M') { if (measuredAt.has(o.q[0])) add('warn', 'double-measure', `q${o.q[0]} is measured twice`, 'The second measurement just repeats the first result.', [o]); measuredAt.set(o.q[0], o); running.push(o); return; }
      const ps = params(o, env);
      if (ROT.has(o.g) && ps.length && isFinite(ps[0]) && Math.abs(Math.sin(ps[0] / 2)) < 1e-9 && o.g !== 'P') add('info', 'zero-angle', `${opName(o, env)} does nothing`, `A rotation by ${fmt.ang(ps[0])} is the identity (up to a global phase).`, [o], 'Remove it');
      if (o.g === 'P' && ps.length && Math.abs(Math.cos(ps[0]) - 1) < 1e-9) add('info', 'zero-angle', `${opName(o, env)} does nothing`, `A phase of ${fmt.ang(ps[0])} is the identity.`, [o], 'Remove it');
      o.q.forEach(q => { if (measuredAt.has(q)) add('warn', 'after-measure', `Gate on q${q} after it was measured`, `q${q} is measured before ${opName(o, env)} acts on it, so the reading won’t include this gate. Move the measurement to the end.`, [o]); });
      if (before) {
        const cs = o.c || [];
        if (cs.length) { const dead = cs.find(q => Sim.probOne(before, q) < 1e-9); const always = cs.every(q => Sim.probOne(before, q) > 1 - 1e-9);
          if (dead != null) add('warn', 'dead-control', `This ${opName(o, env)} never fires`, `Its control q${dead} is exactly |0⟩ here, so the gate does nothing. Did you mean to put an H (or X) on q${dead} first?`, [o], 'Remove it');
          else if (always) add('info', 'always-control', `The control of ${opName(o, env)} is always 1`, `Every control is exactly |1⟩, so this acts like a plain ${NAMES[o.g] || o.g} on ${o.q.map(q => 'q' + q).join(', ')}.`, [o]); }
        if (!cs.length && PHASE_ONLY.has(o.g) && o.q.length === 1) { const b = Sim.bloch(before, o.q[0]); if (Math.abs(Math.abs(b[2]) - 1) < 1e-9) add('info', 'invisible-phase', `${opName(o, env)} on q${o.q[0]} has no effect here`, `q${o.q[0]} is in ${b[2] > 0 ? '|0⟩' : '|1⟩'}, and phase gates only change the relative phase between |0⟩ and |1⟩. Put an H before it to see it matter.`, [o]); }
      }
      running.push(o);
    });
    if (C.n > 1) for (let q = 0; q < C.n; q++) if (![...used].includes(q)) add('info', 'unused', `q${q} is never used`, `Nothing acts on q${q}. Remove it to keep the circuit smaller, or give it a job.`, []);
    if (C.n > 12) add('info', 'big', `${C.n} qubits`, `A state of ${C.n} qubits has ${(2 ** C.n).toLocaleString()} amplitudes, so live explanations are limited above 12 qubits.`, []);
    const rank = { error: 0, warn: 1, info: 2 }; issues.sort((a, b) => rank[a.sev] - rank[b.sev]);
    return issues;
  }

  /* ---------- comparing a circuit's output with a target ---------- */
  function compare(C, target) {
    const s = Sim.run(C), t = target.re ? target : Sim.run(target), f = Sim.fidelity(s, t);
    const d = describe(s), dt = describe(t), diffs = [];
    for (let q = 0; q < Math.min(d.n, dt.n); q++) if (d.qubits[q].name !== dt.qubits[q].name) diffs.push({ q, now: d.qubits[q].name, want: dt.qubits[q].name });
    return { fidelity: f, match: f > 1 - 1e-6, now: d, want: dt, diffs };
  }
  // a nudge toward a target: which single gate on which qubit would help most
  function nextGateHint(C, target, gates = ['H', 'X', 'Z', 'S', 'T', 'Y']) {
    const base = compare(C, target).fidelity; let best = null; const col = Math.max(-1, ...C.ops.map(o => o.col)) + 1;
    for (let q = 0; q < C.n; q++) for (const g of gates) { const f = Sim.fidelity(Sim.run(Object.assign({}, C, { ops: C.ops.concat([{ g, q: [q], c: [], p: [], col }]) })), target.re ? target : Sim.run(target)); if (!best || f > best.f) best = { g, q, f }; }
    if (C.n > 1) for (let a = 0; a < C.n; a++) for (let b = 0; b < C.n; b++) if (a !== b) { const f = Sim.fidelity(Sim.run(Object.assign({}, C, { ops: C.ops.concat([{ g: 'X', q: [b], c: [a], p: [], col }]) })), target.re ? target : Sim.run(target)); if (f > best.f + 1e-9) best = { g: 'CNOT', q: b, c: a, f }; }
    return best && best.f > base + 1e-6 ? best : null;
  }
  return { ket, stateText, describe, narrate, diagnose, compare, nextGateHint, opName, qubitName, pct };
})();
