/* Physics test suite — runs in node (CI) and in the page (Notebook › System checks) */
function PHYSICS_TESTS(Sim) {
  const T = [], ok = (name, pass, got) => T.push({ name, pass: !!pass, got: String(got) });
  const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
  const C = (n, list) => ({ n, ops: list.map(([g, q, col, extra]) => Object.assign({ g, q, col }, extra || {})) });
  // H·H = I
  ok('H·H = I', Sim.sameUnitary(1, C(1, [['H', [0], 0], ['H', [0], 1]]).ops, []).ok, 'unitary match');
  // Bell only 00 / 11, reduced arrows length 0
  const bell = Sim.run(C(2, [['H', [0], 0], ['X', [1], 1, { c: [0] }]])), pb = Sim.probs(bell);
  ok('Bell state has only |00⟩ and |11⟩', near(pb[0], .5) && near(pb[3], .5) && near(pb[1] + pb[2], 0), Array.from(pb).map(x => x.toFixed(3)).join(' '));
  const L = q => Math.hypot(...Sim.bloch(bell, q));
  ok('Bell reduced Bloch vectors have length 0', near(L(0), 0) && near(L(1), 0), L(0).toFixed(6));
  // global phase invariance: RZ(θ) and P(θ) differ only by a global phase
  ok('Global phase is unobservable (RZ vs P)', Sim.sameUnitary(1, [{ g: 'RZ', q: [0], p: [0.7], col: 0 }], [{ g: 'P', q: [0], p: [0.7], col: 0 }]).ok, 'equal up to phase');
  // QFT of |0…0⟩ is uniform
  const qft = Sim.probs(Sim.run({ n: 4, ops: Sim.qftOps([0, 1, 2, 3]) }));
  ok('QFT|0000⟩ is uniform', Array.from(qft).every(x => near(x, 1 / 16)), qft[5].toFixed(4));
  // teleportation fidelity 1 for random states (mid-circuit measurement + feed-forward)
  let worst = 1;
  for (let k = 0; k < 6; k++) {
    const th = Math.random() * Math.PI, ph = Math.random() * 2 * Math.PI;
    const prep = [{ g: 'U', q: [0], p: [th, ph, 0], col: 0 }];
    const tel = prep.concat([{ g: 'H', q: [1], col: 1 }, { g: 'X', q: [2], c: [1], col: 2 }, { g: 'X', q: [1], c: [0], col: 3 }, { g: 'H', q: [0], col: 4 }, { g: 'M', q: [0], cb: 0, col: 5 }, { g: 'M', q: [1], cb: 1, col: 5.5 }, { g: 'X', q: [2], col: 6, cond: { bit: 1, val: 1 } }, { g: 'Z', q: [2], col: 7, cond: { bit: 0, val: 1 } }]);
    for (let seed = 1; seed <= 4; seed++) { const s = Sim.run({ n: 3, nc: 3, ops: tel }, Infinity, { seed }); const b = Sim.bloch(s, 2), want = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)]; worst = Math.min(worst, (1 + b[0] * want[0] + b[1] * want[1] + b[2] * want[2]) / 2); }
  }
  ok('Teleportation fidelity = 1 on random states', near(worst, 1, 1e-9), worst.toFixed(9));
  // Grover, 3 qubits, marked |101⟩ — by actual circuit
  const grover = k => { const ops = []; let col = 0; for (let q = 0; q < 3; q++) ops.push({ g: 'H', q: [q], col }); col++;
    for (let i = 0; i < k; i++) { ops.push({ g: 'X', q: [1], col: col++ }); ops.push({ g: 'Z', q: [2], c: [0, 1], col: col++ }); ops.push({ g: 'X', q: [1], col: col++ });
      for (let q = 0; q < 3; q++) ops.push({ g: 'H', q: [q], col }); col++; for (let q = 0; q < 3; q++) ops.push({ g: 'X', q: [q], col }); col++; ops.push({ g: 'Z', q: [2], c: [0, 1], col: col++ }); for (let q = 0; q < 3; q++) ops.push({ g: 'X', q: [q], col }); col++; for (let q = 0; q < 3; q++) ops.push({ g: 'H', q: [q], col }); col++; }
    return Sim.probs(Sim.run({ n: 3, ops }))[5]; };
  const g1 = grover(1), g2 = grover(2), g3 = grover(3);
  ok('Grover 3 qubits: 0.781 / 0.945 / 0.330', near(g1, .78125, 1e-4) && near(g2, .9453, 1e-3) && near(g3, .3301, 1e-3), `${g1.toFixed(3)} / ${g2.toFixed(3)} / ${g3.toFixed(3)}`);
  // CHSH: quantum win probability with optimal angles, by simulation
  const win = (() => { const A = [0, Math.PI / 2], B = [Math.PI / 4, -Math.PI / 4]; let tot = 0;
    for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) { const ops = [{ g: 'H', q: [0], col: 0 }, { g: 'X', q: [1], c: [0], col: 1 }, { g: 'RY', q: [0], p: [-A[x]], col: 2 }, { g: 'RY', q: [1], p: [-B[y]], col: 2 }];
      const p = Sim.probs(Sim.run({ n: 2, ops })); const same = p[0] + p[3]; tot += (x & y) ? 1 - same : same; }
    return tot / 4; })();
  ok('CHSH quantum win ≈ 0.854', near(win, .8536, 1e-3), win.toFixed(4));
  // H2 STO-3G ground energy near 0.735 Å
  const e = Sim.h2(.735).E0; ok('H₂ STO-3G minimum ≈ −1.137 Ha at 0.735 Å', near(e, -1.137, 2e-3), e.toFixed(5));
  let minR = 0, minE = 0; for (let R = .5; R <= 1.2; R += .005) { const v = Sim.h2(R).E0; if (v < minE) { minE = v; minR = R; } }
  ok('H₂ curve minimum near 0.73 Å', Math.abs(minR - .735) < .03, `${minR.toFixed(3)} Å, ${minE.toFixed(4)} Ha`);
  // VQE with the page's ansatz reaches FCI
  const H = Sim.h2(.735); let best = 1e9; for (let t = -Math.PI; t <= Math.PI; t += .001) best = Math.min(best, Sim.h2Energy(H, t)); ok('VQE ansatz reaches the exact H₂ energy', near(best, H.E0, 1e-5), best.toFixed(6));
  // Shor periods
  const per = [2, 7, 8, 11, 13].map(a => Sim.order(a, 15)).join(','); ok('Shor(15): periods for a = 2,7,8,11,13 are 4,4,4,2,4', per === '4,4,4,2,4', per);
  const p21 = Sim.order(2, 21); ok('Shor(21): period of 2 is 6', p21 === 6, p21);
  // QPE on T returns 1/8, by full circuit
  const t = 3, q = [{ g: 'X', q: [t], col: 0 }]; for (let k = 0; k < t; k++) q.push({ g: 'H', q: [k], col: 1 });
  let col = 2; for (let k = 0; k < t; k++) { const reps = 1 << (t - 1 - k); q.push({ g: 'P', q: [t], c: [k], p: [Math.PI / 4 * reps], col: col++ }); }
  const inv = Sim.qftOps([0, 1, 2], col, true); const qp = Sim.probs(Sim.run({ n: 4, ops: q.concat(inv) })); let yb = 0; for (let i = 0; i < 16; i++) if (qp[i] > qp[yb]) yb = i;
  ok('QPE on T gate returns phase 1/8', (yb >> 1) === 1 && near(qp[yb], 1, 1e-9), `register ${(yb >> 1).toString(2).padStart(3, '0')} → ${(yb >> 1) / 8}`);
  // Stabiliser sampler agrees on a 30-qubit GHZ
  const ghz = { n: 30, ops: [{ g: 'H', q: [0], col: 0 }].concat(Array.from({ length: 29 }, (_, i) => ({ g: 'X', q: [i + 1], c: [i], col: i + 1 }))) };
  const st = Sim.stabSample(ghz, 200, 3), keys = Object.keys(st.counts);
  ok('Stabiliser: 30-qubit GHZ gives only all-0 / all-1', keys.every(k => /^0+$|^1+$/.test(k)), keys.map(k => k[0] + '… ' + st.counts[k]).join(', '));
  // density matrix with no noise equals pure state
  const dm = Sim.densityRun({ n: 2, ops: [{ g: 'H', q: [0], col: 0 }, { g: 'X', q: [1], c: [0], col: 1 }] }); ok('Density matrix (noiseless) matches the Bell state', near(dm.get(0, 3)[0], .5) && near(dm.get(1, 1)[0], 0), dm.get(0, 3)[0].toFixed(3));
  // entanglement entropy of a Bell pair is 1 bit
  const S1 = Sim.entropy(bell, [0]); ok('Bell pair: entanglement entropy = 1 bit', near(S1, 1, 1e-6), S1.toFixed(6));
  return T;
}
if (typeof module !== 'undefined') module.exports = PHYSICS_TESTS;
