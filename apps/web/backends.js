/* =====================================================================
   BACKENDS — runCircuit({circuit, backend, shots, noise, seed}).
   Browser runs are real (exact statevector / density matrix / trajectories /
   stabiliser). Every other backend goes through the shared Runner client to
   the real SDK service. No fallback: when the runner is unreachable the
   server path throws with code 'offline', and callers must show
   "Offline — start the runner" instead of substituting the browser engine.
===================================================================== */
const Backends = (() => {
  const DEVICE_NOISE = { p1: .0003, p2: .009, t1: 150, t2: 110, g1: 35, g2: 400, readout: .015 };
  const LIST = [
    { id: 'browser', name: 'Browser', kind: 'real', note: 'Exact statevector in your browser; density matrix when noisy; trajectories for mid-circuit measurement.' },
    { id: 'aer.statevector', name: 'Qiskit Aer · statevector', kind: 'server', sdk: 'qiskit', note: 'AerSimulator, statevector method.' },
    { id: 'aer.density_matrix', name: 'Qiskit Aer · density_matrix', kind: 'server', sdk: 'qiskit', noisy: true, note: 'AerSimulator density-matrix method.' },
    { id: 'aer.fake_sherbrooke', name: 'Qiskit Aer · FakeSherbrooke', kind: 'server', sdk: 'qiskit', noisy: true, device: true, note: 'Device noise from FakeSherbrooke calibration.' },
    { id: 'cirq.simulator', name: 'Cirq · Simulator', kind: 'server', sdk: 'cirq', note: 'cirq.Simulator.' },
    { id: 'cirq.density_matrix', name: 'Cirq · density_matrix', kind: 'server', sdk: 'cirq', noisy: true, note: 'cirq.DensityMatrixSimulator.' },
    { id: 'pennylane.default.qubit', name: 'PennyLane · default.qubit', kind: 'server', sdk: 'pennylane', note: 'default.qubit with shots.' },
    { id: 'pennylane.lightning.qubit', name: 'PennyLane · lightning.qubit', kind: 'server', sdk: 'pennylane', note: 'lightning.qubit (C++).' },
    { id: 'qbraid.cirq', name: 'qBraid → Cirq', kind: 'server', sdk: 'qasm', note: 'qBraid transpile qiskit→cirq, then cirq.Simulator.' },
    { id: 'aer', name: 'Qiskit Aer', kind: 'server', sdk: 'qiskit', note: 'AerSimulator, statevector method.' },
    { id: 'aer_noisy', name: 'Aer (noisy)', kind: 'server', sdk: 'qiskit', noisy: true, note: 'AerSimulator with your noise model.' },
    { id: 'cirq', name: 'Cirq', kind: 'server', sdk: 'cirq', note: 'cirq.Simulator.' },
    { id: 'pennylane', name: 'PennyLane', kind: 'server', sdk: 'pennylane', note: 'default.qubit with shots.' },
    { id: 'qbraid', name: 'qBraid', kind: 'server', sdk: 'qasm', note: 'qBraid runtime, routed to its default simulator.' },
    { id: 'ibm', name: 'IBM hardware', kind: 'server', sdk: 'qiskit', noisy: true, device: true, note: 'Heavy-hex device: routed, with a calibration-derived noise model.' },
    { id: 'stab', name: 'Stabiliser', kind: 'real', note: 'Aaronson–Gottesman tableau: Clifford circuits up to 64 qubits.' }
  ];
  // Legacy alias map for short ids used by older views.
  const ALIAS = { aer: 'aer.statevector', aer_noisy: 'aer.density_matrix', cirq: 'cirq.simulator', pennylane: 'pennylane.default.qubit', qbraid: 'qbraid.cirq' };
  const resolveId = id => ALIAS[id] || id;
  // server adapter delegates to the shared Runner client (no offline mock).
  const server = { endpoint: null, async run(B, C, shots, noise, opts = {}) {
    const backend = resolveId(B.id);
    const ir = { version: 'qlab-ir/1', n: C.n, nc: C.nc ?? C.n, params: C.params || {}, ops: Sim.expand({ n: C.n, ops: C.ops || [] }).map(o => {
      const r = { g: o.g, q: o.q, col: o.col };
      if ((o.c || []).length) r.c = o.c;
      if ((o.p || []).length) r.p = o.p.map(v => typeof v === 'number' ? v : String(v));
      if (o.g === 'M') r.cb = o.cb ?? o.q[0];
      if (o.cond) r.cond = o.cond;
      return r;
    }) };
    const out = await Runner.run({ ir, backend, shots, seed: opts.seed, noise: noise || undefined, options: opts.options || {} }, { timeout: opts.timeout || 60000, signal: opts.signal });
    return out;
  } };
  function toLabResult(out, B, t0, shots) {
    // Normalise a /v1/run payload to the {counts, exact?, keys, shots, meta} shape views expect.
    const prov = out.provenance || { sdk: B.name, where: 'server', backend: B.id, shots };
    return { counts: out.counts || {}, keys: out.keys, exact: out.probabilities || null, shots,
      provenance: prov, statevector: out.statevector, density: out.density, expectation: out.expectation,
      transpiled: out.transpiled, warnings: out.warnings || [],
      meta: { backend: prov.backend || B.name, method: prov.method || B.note, ms: prov.ms != null ? prov.ms : performance.now() - t0, note: '', noise: prov.noise || null, real: false, provenance: prov } };
  }
  async function runCircuit({ circuit, backend, shots = 1000, noise, seed, options, signal, timeout }) {
    const rawId = backend || 'browser';
    const id = resolveId(rawId);
    const B = LIST.find(b => b.id === rawId) || LIST.find(b => b.id === id) || LIST[0], t0 = performance.now(), C = { n: circuit.n, nc: circuit.nc ?? circuit.n, ops: Sim.expand(circuit), params: circuit.params || {} };
    let nz = null, routed = null;
    if (B.id === 'stab') { if (!Sim.isClifford(C)) throw new Error('The stabiliser backend runs Clifford circuits only (H, S, CNOT, Paulis, measurement). Remove T and rotation gates, or pick another backend.'); const r = await Work.call('sample', { circ: C, shots, seed, stab: true }); return Object.assign(r, { meta: { backend: B.name, method: 'stabiliser tableau', ms: performance.now() - t0, real: true } }); }
    if (C.n > 12 && B.id === 'browser') throw new Error('The browser statevector holds 12 qubits. For larger Clifford circuits pick Stabiliser.');
    if (B.kind === 'server') {
      const effId = resolveId(B.id);
      const effB = Object.assign({}, B, { id: effId });
      // Device-routed IBM path still runs through the runner (fake backends carry device noise).
      try {
        const out = await server.run(effB, C, shots, B.noisy ? (noise || DEVICE_NOISE) : (noise || undefined), { seed, options, signal, timeout });
        return toLabResult(out, effB, t0, shots);
      } catch (e) {
        // No fallback to the browser engine. Surface offline distinctly.
        const msg = String(e && e.message || e);
        if (e && (e.name === 'AbortError' || /abort/i.test(msg))) throw e;
        throw Object.assign(new Error('Offline — start the runner at ' + Runner.url() + ' (' + msg + ')'), { code: 'offline', cause: e });
      }
    }
    if (B.noisy) nz = noise || DEVICE_NOISE;
    if (B.device) { try { routed = Passes.route(C, Passes.DEVICES.heavyhex()); const cxL = Passes.toBasis(C).ops.filter(o => (o.c || []).length).length || 1, cxR = routed.circ.ops.filter(o => (o.c || []).length).length + 3 * routed.swaps; nz = Object.assign({}, nz, { p2: nz.p2 * Math.max(1, cxR / cxL) }); } catch (e) { } }
    if (C.n > 7 && nz && !Sim.isDynamic(C)) shots = Math.min(shots, 800);
    const r = await Work.call('sample', { circ: C, shots, seed, noise: nz });
    return Object.assign(r, { shots, provenance: { sdk: 'QUBIQ browser engine', where: 'browser', seed: seed ?? null, shots, method: r.method }, meta: { backend: B.name, method: r.method, ms: performance.now() - t0, note: '', noise: nz, routed: routed ? { swaps: routed.swaps, layout: routed.initial } : null, real: B.kind === 'real', provenance: { sdk: 'QUBIQ browser engine', where: 'browser', seed: seed ?? null, shots, method: r.method } } });
  }
  function tvd(a, b) { const keys = new Set([...Object.keys(a.counts), ...Object.keys(b.counts)]); let d = 0, f = 0; for (const k of keys) { const p = (a.counts[k] || 0) / a.shots, q = (b.counts[k] || 0) / b.shots; d += Math.abs(p - q); f += Math.sqrt(p * q); } return { tvd: d / 2, fidelity: f * f }; }
  return { LIST, runCircuit, tvd, DEVICE_NOISE, server };
})();
