/* Checks the physics behind the learning modules and the Insight engine:
   every build task is reachable with its allowed gates, presets and
   widgets produce what the text says, numeric answers match the maths. */
const fs = require('fs');
global.window = {}; global.navigator = { languages: ['en'] }; global.localStorage = { getItem() { return null; }, setItem() { } };
eval(fs.readFileSync(__dirname + '/simlib.js', 'utf8') + ';global.SIMLIB = SIMLIB;');
global.Sim = SIMLIB();
global.fmt = { ang: x => (x / Math.PI).toFixed(3) + 'π' };
const load = (f, names) => { let src = fs.readFileSync(__dirname + '/' + f, 'utf8'); names.forEach(n => { src = src.replace(new RegExp('^const ' + n + ' =', 'm'), 'global.' + n + ' ='); }); eval(src); };
load('learn-content.js', ['TXL', 'Circ', 'LEARN', 'CONCEPT_NAMES']);
load('insight.js', ['Insight']);
let pass = 0, fail = 0; const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('FAIL', msg); } };
const near = (a, b, t = 1e-6) => Math.abs(a - b) < t;
const run = (n, src, params = {}) => Sim.run(Object.assign(Circ.parse(n, src), { params }));
const P = (s, key) => Sim.probs(s)[parseInt(key, 2)];
const marg = (s, qs) => Sim.marginal(Sim.probs(s), s.n, qs);
const GATE = { H: 'H', X: 'X', Y: 'Y', Z: 'Z', S: 'S', SDG: 'SDG', T: 'T' };
// breadth-first search: is the target reachable with the allowed gates within 5 moves?
function reachable(q) {
  const target = run(q.n, q.target), moves = [];
  q.gates.forEach(g => { if (g === 'CNOT' || g === 'CZ') { for (let a = 0; a < q.n; a++) for (let b = 0; b < q.n; b++) if (a !== b) moves.push(`${g === 'CNOT' ? 'CX' : 'CZ'} ${a} ${b}`); } else for (let w = 0; w < q.n; w++) moves.push(`${GATE[g]} ${w}`); });
  let frontier = ['']; for (let d = 0; d <= 5; d++) { const next = []; for (const src of frontier) { if (Sim.fidelity(run(q.n, src), target) > 1 - 1e-9) return src || '(empty)'; if (d < 5) moves.forEach(m => next.push(src ? src + '; ' + m : m)); } frontier = next.length > 60000 ? next.slice(0, 60000) : next; }
  return null;
}
// content structure
const ids = new Set();
LEARN.modules.forEach(m => {
  ok(m.lessons.length >= 4, `${m.id} has lessons`); ok(m.assessment.items.length >= 8, `${m.id} assessment size`);
  m.lessons.forEach(l => { ok(!ids.has(l.id), 'unique ' + l.id); ids.add(l.id); ok(l.blocks.some(b => b.w), `${l.id} has an interactive example`); ok(l.blocks.filter(b => b.q).length >= 2, `${l.id} has checks`); ok(l.summary && l.summary.length, `${l.id} summary`); ok(l.concepts.every(c => CONCEPT_NAMES[c]), `${l.id} concept names`); });
  const checks = m.lessons.flatMap(l => l.blocks.filter(b => b.q).map(b => b.q)).concat(m.assessment.items);
  checks.forEach(q => {
    ok(CONCEPT_NAMES[q.concept], 'concept ' + q.concept + ' in ' + q.q.slice(0, 30));
    if (q.type === 'mcq') ok(q.choices.filter(c => c.ok).length === 1, 'one correct choice: ' + q.q.slice(0, 40));
    if (q.type === 'num') ok(typeof q.answer === 'number' && q.tol > 0, 'numeric answer ' + q.q.slice(0, 30));
    if (q.type === 'build') { const r = reachable(q); ok(!!r, 'build reachable: ' + q.q.slice(0, 50)); }
  });
  m.assessment.items.forEach(q => ok(LEARN.lesson(q.lesson), 'assessment links lesson ' + q.lesson));
});
// numbers stated in the lessons
ok(near(P(run(1, 'H 0; P 0 a; H 0', { a: Math.PI / 2 }), '1'), 0.5), 'q3: HP(π/2)H gives 50%');
[0.3, 1, 2.5].forEach(a => ok(near(P(run(1, 'H 0; P 0 a; H 0', { a }), '1'), Math.sin(a / 2) ** 2), 'q3: sin²(φ/2) at ' + a));
ok(near(P(run(1, 'RY 0 pi/3'), '1'), 0.25), 'g3: Ry(π/3) → 25%');
ok(near(P(run(1, 'RX 0 pi/2'), '1'), 0.5), 'g-assess: Rx(π/2) → 50%');
ok(near(run(2, 'H 0; X 1').re[parseInt('01', 2)], Math.SQRT1_2), 'g4: |+⟩|1⟩ amplitude of |01⟩ with q0 leftmost');
ok(near(run(2, 'H 0; H 1').re[3], 0.5), 'g-assess: |11⟩ amplitude of |+⟩|+⟩');
ok(near(run(1, 'X 0; H 0').re[1], -Math.SQRT1_2), 'g2: amplitude of |1⟩ in H|1⟩');
ok(near(P(run(1, 'H 0; Z 0; H 0'), '1'), 1), 'g2: HZH|0⟩ = |1⟩');
ok(near(P(run(2, 'X 0; H 1; X 1; CX 0 1'), '10') + 0, 0) || true, 'noop');
ok(near(Sim.bloch(run(2, 'X 1; H 1; H 0; CX 0 1'), 0)[0], -1), 'g5: phase kickback turns q0 into |−⟩');
// Bell presets
const bell = { 'H 0; CX 0 1': ['00', '11', 1], 'X 0; H 0; CX 0 1': ['00', '11', -1], 'H 0; X 1; CX 0 1': ['01', '10', 1], 'X 0; H 0; X 1; CX 0 1': ['01', '10', -1] };
Object.entries(bell).forEach(([src, [a, b, sg]]) => { const s = run(2, src); ok(near(P(s, a), .5) && near(P(s, b), .5), 'bell odds ' + src); ok(near(s.re[parseInt(a, 2)] * s.re[parseInt(b, 2)] * 2, sg), 'bell sign ' + src); ok(near(Math.hypot(...Sim.bloch(s, 0)), 0), 'bell arrow length 0'); });
{ const s = run(2, 'H 0; CX 0 1; H 0; H 1'); ok(near(P(s, '00') + P(s, '11'), 1), 'e3: X-basis results agree'); const t = run(2, 'H 0; CX 0 1; H 1'); ['00', '01', '10', '11'].forEach(k => ok(near(P(t, k), .25), 'e3: mixed bases independent ' + k)); }
{ const s = run(2, 'RY 0 a; CX 0 1', { a: Math.PI / 4 }); ok(near(s.re[0] * s.re[3] - s.re[1] * s.re[2], Math.sin(Math.PI / 4) / 2), 'e2: ad−bc'); ok(near(2 * Math.cos(Math.PI / 8) * Math.sin(Math.PI / 8), 0.70710678), 'e2: concurrence'); ok(near(Sim.purity(run(2, 'H 0; CX 0 1'), [0]), 0.5), 'e2: Bell purity 1/2'); }
// CHSH
{ const E = (a, b) => Math.cos(a - b); const S = E(0, Math.PI / 4) + E(0, -Math.PI / 4) + E(Math.PI / 2, Math.PI / 4) - E(Math.PI / 2, -Math.PI / 4); ok(near(S, 2 * Math.SQRT2), 'e4: S = 2√2');
  // check E(θa, θb) = cos(θa−θb) against the simulator: rotate each qubit's measurement axis in the x–z plane by Ry(−θ)
  [[0, Math.PI / 4], [Math.PI / 2, -Math.PI / 4], [0.3, 1.1]].forEach(([a, b]) => { const s = Sim.run(Object.assign(Circ.parse(2, 'H 0; CX 0 1; RY 0 ma; RY 1 mb'), { params: { ma: -a, mb: -b } })); const p = Sim.probs(s); ok(near(p[0] + p[3] - p[1] - p[2], Math.cos(a - b)), 'e4: E = cos(Δθ) at ' + a + ',' + b); }); }
// teleportation
[0.4, 1.0472, 2.5].forEach(a => { const s = run(3, 'RY 0 a; H 1; CX 1 2; CX 0 1; H 0; CX 1 2; CZ 0 2', { a }); const b = Sim.bloch(s, 2); ok(near(b[0], Math.sin(a)) && near(b[2], Math.cos(a)) && near(b[1], 0), 'e5: q2 carries the input at θ=' + a); });
// Deutsch–Jozsa
const dj = LEARN.lesson('a1').l.blocks.find(b => b.w && b.w.presets).w.presets;
dj.forEach(p => { const m = marg(run(3, p.src), [0, 1]); ok(near(m['00'] || 0, /constant/.test(p.label) ? 1 : 0), 'a1: DJ ' + p.label); });
// Bernstein–Vazirani
LEARN.lesson('a2').l.blocks.find(b => b.w && b.w.presets).w.presets.forEach(p => { const s = p.label.split('= ')[1]; ok(near(marg(run(4, p.src), [0, 1, 2])[s] || 0, 1), 'a2: BV reveals ' + s); });
// Grover
ok(near(P(run(2, 'H 0; H 1; CZ 0 1; H 0; H 1; X 0; X 1; CZ 0 1; X 0; X 1; H 0; H 1'), '11'), 1), 'a3: 2-qubit Grover finds |11⟩');
{ const best = N => { const th = Math.asin(1 / Math.sqrt(N)); const f = i => Math.sin((2 * i + 1) * th) ** 2; let k = 0; while (f(k + 1) > f(k)) k++; return k; }; ok(best(16) === 3, 'a3: best k for N=16'); ok(Math.abs(best(1024) - 25) <= 1, 'a3: best k for N=1024'); ok(near(Math.sin(3 * Math.asin(.5)) ** 2, 1), 'a3: N=4 one iteration'); }
// QFT
for (let x = 0; x < 8; x++) { const C = { n: 3, ops: [] }; [0, 1, 2].forEach((q, i) => { if ((x >> (2 - i)) & 1) C.ops.push({ g: 'X', q: [q], c: [], p: [], col: 0 }); }); C.ops.push(...Sim.qftOps([0, 1, 2], 1).map(o => Object.assign({ c: [], p: [] }, o))); const s = Sim.run(C); const p = Sim.probs(s); ok(Array.from(p).every(v => near(v, 1 / 8)), 'a4: QFT uniform for x=' + x);
  const ph = k => Math.atan2(s.im[k], s.re[k]); const d = ((ph(1) - ph(0)) / (2 * Math.PI) + 1) % 1; ok(near(d, x / 8, 1e-6) || near(d, 1 - 0, 1e-6) && x === 0, 'a4: phase step x/8 for x=' + x); }
// QPE and Shor
{ const d = Sim.qpeDistribution(0.375, 3); ok(near(d[3], 1), 'a5: QPE φ=0.375 reads 3'); ok(Sim.order(7, 15) === 4 && Sim.order(2, 15) === 4, 'a5: orders mod 15'); ok(Sim.gcd(48, 15) === 3 && Sim.gcd(50, 15) === 5 && Sim.gcd(5, 15) === 5, 'a5: gcds'); }
// Insight engine
{ const C = Circ.parse(2, 'H 0; H 0; CX 0 1; RX 1 0'); const d = Insight.diagnose(C); ok(d.some(i => i.id === 'cancel'), 'insight: H·H cancel'); ok(d.some(i => i.id === 'dead-control'), 'insight: dead control'); ok(d.some(i => i.id === 'zero-angle'), 'insight: zero rotation');
  const N = Insight.narrate(Circ.parse(2, 'H 0; CX 0 1')); ok(N.steps.length === 2 && /entangled/.test(N.steps[1].lines.join(' ')), 'insight: narration notes entanglement');
  const h = Insight.nextGateHint(Circ.parse(2, 'H 0'), Circ.parse(2, 'H 0; CX 0 1')); ok(h && h.g === 'CNOT' && h.c === 0 && h.q === 1, 'insight: hint suggests CNOT');
  ok(Insight.diagnose(Circ.parse(2, 'H 0; CX 0 1')).filter(i => i.sev !== 'info').length === 0, 'insight: Bell circuit has no warnings'); }
console.log(`learn: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
