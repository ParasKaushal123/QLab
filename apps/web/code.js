/* =====================================================================
   CODE — one circuit IR, four SDKs, two-way.
   gen(lang, circ) → {text, map:[opId|null per line]}
   parse(lang, text) → {n, nc, ops, params, errors:[{ln,msg}], lineOf:{opIndex:ln}}
===================================================================== */
const Code = (() => {
  const PI = Math.PI;
  function fmtNum(x) {
    if (typeof x !== 'number') return String(x);
    if (Math.abs(x) < 1e-12) return '0';
    for (const d of [1, 2, 3, 4, 6, 8, 16, 32, 64, 128]) { const k = x * d / PI; if (Math.abs(k - Math.round(k)) < 1e-9 && Math.abs(Math.round(k)) <= 64) { const n = Math.round(k); const num = n === 1 ? 'pi' : n === -1 ? '-pi' : `${n}*pi`; return d === 1 ? num : `${num}/${d}`; } }
    return String(+x.toFixed(6));
  }
  const pyName = s => String(s).replace(/θ/g, 'theta').replace(/γ/g, 'gamma').replace(/β/g, 'beta').replace(/λ/g, 'lam').replace(/φ/g, 'phi');
  const P = (x, lang) => { const s = typeof x === 'number' ? fmtNum(x) : pyName(x); return lang === 'qasm' ? s : s.replace(/\bpi\b/g, lang === 'cirq' || lang === 'pennylane' ? 'np.pi' : 'pi'); };
  const symbols = circ => { const set = new Set(); for (const o of circ.ops) for (const p of o.p || []) if (typeof p !== 'number') (String(pyName(p)).match(/[A-Za-z_]\w*/g) || []).forEach(t => { if (!['pi', 'e', 'sqrt', 'np', 'sin', 'cos', 'exp', 'sympy'].includes(t)) set.add(t); }); return [...set]; };
  const QK1 = { H: 'h', X: 'x', Y: 'y', Z: 'z', S: 's', SDG: 'sdg', T: 't', TDG: 'tdg', SX: 'sx', SXDG: 'sxdg', P: 'p', RX: 'rx', RY: 'ry', RZ: 'rz', U: 'u', I: 'id', SWAP: 'swap', ISWAP: 'iswap', RXX: 'rxx', RYY: 'ryy', RZZ: 'rzz' };
  const QK_C1 = { X: 'cx', Y: 'cy', Z: 'cz', H: 'ch', P: 'cp', RX: 'crx', RY: 'cry', RZ: 'crz', SWAP: 'cswap', U: 'cu' };
  const QG = { H: 'HGate', X: 'XGate', Y: 'YGate', Z: 'ZGate', S: 'SGate', SDG: 'SdgGate', T: 'TGate', TDG: 'TdgGate', SX: 'SXGate', SXDG: 'SXdgGate', P: 'PhaseGate', RX: 'RXGate', RY: 'RYGate', RZ: 'RZGate', U: 'UGate', SWAP: 'SwapGate', ISWAP: 'iSwapGate', RXX: 'RXXGate', RYY: 'RYYGate', RZZ: 'RZZGate' };
  const QA3 = { H: 'h', X: 'x', Y: 'y', Z: 'z', S: 's', SDG: 'sdg', T: 't', TDG: 'tdg', SX: 'sx', SXDG: 'sxdg', P: 'p', RX: 'rx', RY: 'ry', RZ: 'rz', U: 'U', I: 'id', SWAP: 'swap', ISWAP: 'iswap', RXX: 'rxx', RYY: 'ryy', RZZ: 'rzz' };
  const QA_C1 = { X: 'cx', Y: 'cy', Z: 'cz', H: 'ch', P: 'cp', RX: 'crx', RY: 'cry', RZ: 'crz', SWAP: 'cswap' };
  const CQ = { H: 'cirq.H', X: 'cirq.X', Y: 'cirq.Y', Z: 'cirq.Z', S: 'cirq.S', SDG: 'cirq.S**-1', T: 'cirq.T', TDG: 'cirq.T**-1', SX: 'cirq.X**0.5', SXDG: 'cirq.X**-0.5', I: 'cirq.I', SWAP: 'cirq.SWAP', ISWAP: 'cirq.ISWAP' };
  const PL = { H: 'Hadamard', X: 'PauliX', Y: 'PauliY', Z: 'PauliZ', S: 'S', T: 'T', SX: 'SX', P: 'PhaseShift', RX: 'RX', RY: 'RY', RZ: 'RZ', U: 'U3', I: 'Identity', SWAP: 'SWAP', ISWAP: 'ISWAP', RXX: 'IsingXX', RYY: 'IsingYY', RZZ: 'IsingZZ' };
  const PL_C = { 'X,1': 'CNOT', 'Y,1': 'CY', 'Z,1': 'CZ', 'H,1': 'CH', 'P,1': 'ControlledPhaseShift', 'RX,1': 'CRX', 'RY,1': 'CRY', 'RZ,1': 'CRZ', 'X,2': 'Toffoli', 'SWAP,1': 'CSWAP' };

  function gen(lang, circ) {
    const L = [], map = [], push = (s, op) => { L.push(s); map.push(op ? op.id : null); };
    const n = circ.n, nc = circ.nc ?? n, ops = Sim.sorted(circ.ops).filter(o => o.g !== 'SUB' || true), syms = symbols(circ), hasM = ops.some(o => o.g === 'M');
    const flat = circ.defs && ops.some(o => o.g === 'SUB') ? Sim.expand(circ) : ops; // sub-circuits are inlined in code
    if (lang === 'qiskit') {
      push('from qiskit import QuantumCircuit' + (syms.length ? '\nfrom qiskit.circuit import Parameter' : '') + (ops.some(o => o.c && o.c.length && !QK_C1[o.g] && !(o.g === 'X') && !(o.g === 'Z')) ? '\nfrom qiskit.circuit.library import ' + [...new Set(ops.filter(o => o.c && o.c.length).map(o => QG[o.g]).filter(Boolean))].join(', ') : '') + '\nfrom math import pi');
      L[0].split('\n').slice(1).forEach(() => map.push(null));
      push('');
      syms.forEach(s => push(`${s} = Parameter("${s}")`));
      push(hasM || ops.some(o => o.cond) ? `qc = QuantumCircuit(${n}, ${nc})` : `qc = QuantumCircuit(${n})`);
      for (const o of flat) {
        const ps = (o.p || []).map(x => P(x, 'qiskit')), c = o.c || [], q = o.q;
        let line;
        if (o.g === 'M') line = `qc.measure(${q[0]}, ${o.cb ?? q[0]})`;
        else if (o.g === 'RESET') line = `qc.reset(${q[0]})`;
        else if (o.g === 'BARRIER') line = `qc.barrier()`;
        else if (!c.length) line = `qc.${QK1[o.g]}(${[...ps, ...q].join(', ')})`;
        else if (c.length === 1 && QK_C1[o.g]) line = `qc.${QK_C1[o.g]}(${[...ps, c[0], ...q].join(', ')})`;
        else if (c.length === 2 && o.g === 'X') line = `qc.ccx(${c[0]}, ${c[1]}, ${q[0]})`;
        else if (o.g === 'X') line = `qc.mcx([${c.join(', ')}], ${q[0]})`;
        else if (o.g === 'Z') line = `qc.mcp(pi, [${c.join(', ')}], ${q[0]})`;
        else line = `qc.append(${QG[o.g]}(${ps.join(', ')}).control(${c.length}), [${[...c, ...q].join(', ')}])`;
        if (o.cond) { push(o.cond.reg != null ? `with qc.if_test((qc.cregs[0], ${o.cond.val})):` : `with qc.if_test((qc.clbits[${o.cond.bit}], ${o.cond.val})):`, o); push('    ' + line, o); }
        else push(line, o);
      }
    } else if (lang === 'qasm') {
      push('OPENQASM 3.0;'); push('include "stdgates.inc";');
      const need = new Set(flat.map(o => o.g));
      if (need.has('RXX')) push('gate rxx(t) a, b { h a; h b; cx a, b; rz(t) b; cx a, b; h a; h b; }');
      if (need.has('RYY')) push('gate ryy(t) a, b { rx(pi/2) a; rx(pi/2) b; cx a, b; rz(t) b; cx a, b; rx(-pi/2) a; rx(-pi/2) b; }');
      if (need.has('RZZ')) push('gate rzz(t) a, b { cx a, b; rz(t) b; cx a, b; }');
      if (need.has('ISWAP')) push('gate iswap a, b { s a; s b; h a; cx a, b; cx b, a; h b; }');
      syms.forEach(s => push(`input float ${s};`));
      push(`qubit[${n}] q;`); if (hasM || flat.some(o => o.cond)) push(`bit[${nc}] c;`);
      for (const o of flat) {
        const ps = (o.p || []).map(x => P(x, 'qasm')), c = o.c || [], q = o.q, pp = ps.length ? `(${ps.join(', ')})` : '';
        let line;
        if (o.g === 'M') line = `c[${o.cb ?? q[0]}] = measure q[${q[0]}];`;
        else if (o.g === 'RESET') line = `reset q[${q[0]}];`;
        else if (o.g === 'BARRIER') line = `barrier q;`;
        else if (!c.length) line = `${QA3[o.g]}${pp} ${q.map(x => `q[${x}]`).join(', ')};`;
        else if (c.length === 1 && QA_C1[o.g]) line = `${QA_C1[o.g]}${pp} q[${c[0]}], ${q.map(x => `q[${x}]`).join(', ')};`;
        else if (c.length === 2 && o.g === 'X') line = `ccx q[${c[0]}], q[${c[1]}], q[${q[0]}];`;
        else line = `ctrl(${c.length}) @ ${QA3[o.g]}${pp} ${[...c, ...q].map(x => `q[${x}]`).join(', ')};`;
        if (o.cond) line = (o.cond.reg != null ? `if (c == ${o.cond.val}) ` : `if (c[${o.cond.bit}] == ${o.cond.val}) `) + line;
        push(line, o);
      }
    } else if (lang === 'cirq') {
      push('import cirq'); push('import numpy as np'); if (syms.length) push('import sympy'); push('');
      syms.forEach(s => push(`${s} = sympy.Symbol("${s}")`));
      push(`q = cirq.LineQubit.range(${n})`); push('circuit = cirq.Circuit()');
      const cz = (g, ps) => ({ P: `cirq.ZPowGate(exponent=(${ps[0]})/np.pi)`, RX: `cirq.rx(${ps[0]})`, RY: `cirq.ry(${ps[0]})`, RZ: `cirq.rz(${ps[0]})`, RXX: `cirq.XXPowGate(exponent=(${ps[0]})/np.pi, global_shift=-0.5)`, RYY: `cirq.YYPowGate(exponent=(${ps[0]})/np.pi, global_shift=-0.5)`, RZZ: `cirq.ZZPowGate(exponent=(${ps[0]})/np.pi, global_shift=-0.5)` })[g] || CQ[g];
      for (const o of flat) {
        const ps = (o.p || []).map(x => P(x, 'cirq')), c = o.c || [], q = o.q, qs = x => x.map(k => `q[${k}]`).join(', ');
        let line;
        if (o.g === 'M') line = `circuit.append(cirq.measure(q[${q[0]}], key="c${o.cb ?? q[0]}"))`;
        else if (o.g === 'RESET') line = `circuit.append(cirq.reset(q[${q[0]}]))`;
        else if (o.g === 'BARRIER') { push('# barrier: cirq keeps moments instead', o); continue; }
        else if (o.g === 'U') { const [t, f, l] = ps; push(`circuit.append(cirq.rz(${l}).on(q[${q[0]}]))  # U = RZ(φ)·RY(θ)·RZ(λ)`, o); push(`circuit.append(cirq.ry(${t}).on(q[${q[0]}]))`, o); line = `circuit.append(cirq.rz(${f}).on(q[${q[0]}]))`; }
        else if (!c.length) line = `circuit.append(${cz(o.g, ps)}(${qs(q)}))`;
        else if (c.length === 1 && o.g === 'X') line = `circuit.append(cirq.CNOT(${qs([c[0], q[0]])}))`;
        else if (c.length === 1 && o.g === 'Z') line = `circuit.append(cirq.CZ(${qs([c[0], q[0]])}))`;
        else if (c.length === 2 && o.g === 'X') line = `circuit.append(cirq.CCX(${qs([...c, q[0]])}))`;
        else if (c.length === 1 && o.g === 'SWAP') line = `circuit.append(cirq.CSWAP(${qs([c[0], ...q])}))`;
        else line = `circuit.append(${cz(o.g, ps)}.controlled(${c.length}).on(${qs([...c, ...q])}))`;
        if (o.cond) line = line.replace(/\)\)$/, `).with_classical_controls("c${o.cond.bit ?? 0}"))`);
        push(line, o);
      }
      push(''); push('result = cirq.Simulator().run(circuit, repetitions=1000)');
    } else {
      push('import pennylane as qml'); push('import numpy as np'); push('');
      push(`dev = qml.device("default.qubit", wires=${n}, shots=1000)`); push('');
      push('@qml.qnode(dev)'); push(`def circuit(${syms.join(', ')}):`);
      const mids = new Map(); let mi = 0; const terminal = new Set(); const S = flat;
      S.forEach((o, i) => { if (o.g === 'M' && !S.slice(i + 1).some(x => x.g !== 'M' && (Sim.wires(x).includes(o.q[0]) || x.cond))) terminal.add(o); });
      for (const o of S) {
        const ps = (o.p || []).map(x => P(x, 'pennylane')), c = o.c || [], q = o.q, w = arr => arr.length > 1 ? `[${arr.join(', ')}]` : arr[0];
        let line;
        if (o.g === 'M') { if (terminal.has(o)) continue; const name = `m${o.cb ?? q[0]}`; mids.set(o.cb ?? q[0], name); line = `${name} = qml.measure(${q[0]})`; }
        else if (o.g === 'RESET') line = `qml.measure(${q[0]}, reset=True)`;
        else if (o.g === 'BARRIER') line = `qml.Barrier(wires=range(${n}))`;
        else if (!c.length) line = o.g === 'SDG' ? `qml.adjoint(qml.S)(wires=${q[0]})` : o.g === 'TDG' ? `qml.adjoint(qml.T)(wires=${q[0]})` : o.g === 'SXDG' ? `qml.adjoint(qml.SX)(wires=${q[0]})` : `qml.${PL[o.g]}(${[...ps, `wires=${w(q)}`].join(', ')})`;
        else if (PL_C[`${o.g},${c.length}`]) line = `qml.${PL_C[`${o.g},${c.length}`]}(${[...ps, `wires=[${[...c, ...q].join(', ')}]`].join(', ')})`;
        else if (o.g === 'X') line = `qml.MultiControlledX(wires=[${[...c, ...q].join(', ')}])`;
        else line = `qml.ctrl(qml.${PL[o.g] || o.g}, control=[${c.join(', ')}])(${[...ps, `wires=${w(q)}`].join(', ')})`;
        if (o.cond) { const m = mids.get(o.cond.bit ?? 0) || `m${o.cond.bit ?? 0}`; line = line.replace(/^qml\.(\w+)\((.*)\)$/, (_, g, a) => `qml.cond(${o.cond.val ? m : `~${m}`}, qml.${g})(${a})`); }
        push('    ' + line, o);
      }
      const mq = S.filter(o => terminal.has(o)).map(o => o.q[0]); push(`    return qml.counts(wires=[${(mq.length ? mq : [...Array(n).keys()]).join(', ')}])`);
      push(''); push(syms.length ? `print(circuit(${syms.map(s => (circ.params || {})[s] ?? 0.5).join(', ')}))` : 'print(circuit())');
    }
    return { text: L.join('\n'), map };
  }

  /* ---------------- parsing (the drawable subset of each SDK) ---------------- */
  const INV_QK = Object.fromEntries(Object.entries(QK1).map(([k, v]) => [v, k])), INV_QKC = Object.fromEntries(Object.entries(QK_C1).map(([k, v]) => [v, k]));
  const INV_QA = Object.fromEntries(Object.entries(QA3).map(([k, v]) => [v.toLowerCase(), k])); INV_QA.u3 = 'U'; INV_QA.u = 'U'; INV_QA.phase = 'P'; INV_QA.u1 = 'P'; INV_QA.cnot = 'CX';
  const INV_QAC = Object.fromEntries(Object.entries(QA_C1).map(([k, v]) => [v, k])); INV_QAC.cphase = 'P'; INV_QAC.cnot = 'X';
  const INV_PL = Object.fromEntries(Object.entries(PL).map(([k, v]) => [v, k])), INV_PLC = Object.fromEntries(Object.entries(PL_C).map(([k, v]) => [v, k.split(',')]));
  const INV_QG = Object.fromEntries(Object.entries(QG).map(([k, v]) => [v, k]));
  function splitArgs(s) { const out = []; let d = 0, cur = ''; for (const ch of s) { if ('([{'.includes(ch)) d++; if (')]}'.includes(ch)) d--; if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; }
  function param(s, ln, errors) {
    const t = s.replace(/np\.pi|math\.pi|numpy\.pi/g, 'pi').replace(/\blam\b/g, 'λ').trim();
    try { return Sim.evalExpr(t, {}); } catch (e) { if (/^[\w\s+\-*/().]+$/.test(t)) return t; errors.push({ ln, msg: `Line ${ln}: “${s}” isn’t a number or parameter expression.` }); return 0; }
  }
  function parse(lang, text) {
    const lines = text.split('\n'), ops = [], errors = []; let n = null, nc = null, pendingCond = null, indentCond = 0;
    const add = (g, q, c, p, ln, extra) => ops.push(Object.assign({ g, q, c: c || [], p: p || [], ln }, extra || {}));
    const qint = (s, ln) => { const m = String(s).match(/^(?:q\[)?(\d+)\]?$/); if (!m) { errors.push({ ln, msg: `Line ${ln}: “${s}” isn’t a qubit reference.` }); return 0; } return +m[1]; };
    lines.forEach((raw, i) => {
      const ln = i + 1; let s = raw.replace(/\s+$/, ''); const indent = s.match(/^\s*/)[0].length; s = s.replace(/#.*$|\/\/.*$/, '').trim(); if (!s) return;
      if (lang !== 'qiskit' || indent <= indentCond) { if (lang === 'qiskit' && pendingCond && indent <= indentCond) pendingCond = null; }
      let m;
      if (lang === 'qiskit') {
        if (/^(from|import) /.test(s) || /^\w+\s*=\s*Parameter\(/.test(s) || /^print\(|^result|^job|^sim|^backend|^counts/.test(s)) return;
        if ((m = s.match(/^\w+\s*=\s*QuantumCircuit\(\s*(\d+)\s*(?:,\s*(\d+)\s*)?\)$/))) { n = +m[1]; nc = m[2] ? +m[2] : n; return; }
        if ((m = s.match(/^with\s+\w+\.if_test\(\(\s*\w+\.(clbits|cregs)\[(\d+)\]\s*,\s*(\d+)\s*\)\)\s*:$/))) { pendingCond = m[1] === 'cregs' ? { reg: 'c', val: +m[3] } : { bit: +m[2], val: +m[3] }; indentCond = indent; return; }
        const cond = pendingCond && indent > indentCond ? { cond: pendingCond } : null; if (pendingCond && indent <= indentCond) pendingCond = null;
        if ((m = s.match(/^\w+\.measure_all\(\s*\)$/))) { for (let q = 0; q < (n || 0); q++) add('M', [q], [], [], ln, { cb: q }); return; }
        if ((m = s.match(/^\w+\.measure\(\s*(\d+)\s*,\s*(\d+)\s*\)$/))) { add('M', [+m[1]], [], [], ln, { cb: +m[2] }); return; }
        if ((m = s.match(/^\w+\.reset\(\s*(\d+)\s*\)$/))) { add('RESET', [+m[1]], [], [], ln); return; }
        if (/^\w+\.barrier\(.*\)$/.test(s)) { add('BARRIER', [...Array(n || 1).keys()], [], [], ln); return; }
        if ((m = s.match(/^\w+\.mcx\(\s*\[([\d,\s]+)\]\s*,\s*(\d+)\s*\)$/))) { add('X', [+m[2]], m[1].split(',').map(Number), [], ln, cond); return; }
        if ((m = s.match(/^\w+\.mcp\(\s*([^,]+),\s*\[([\d,\s]+)\]\s*,\s*(\d+)\s*\)$/))) { const pv = param(m[1], ln, errors); if (typeof pv === 'number' && Math.abs(pv - PI) < 1e-9) add('Z', [+m[3]], m[2].split(',').map(Number), [], ln, cond); else add('P', [+m[3]], m[2].split(',').map(Number), [pv], ln, cond); return; }
        if ((m = s.match(/^\w+\.append\(\s*(\w+)\((.*?)\)\.control\((\d+)\)\s*,\s*\[([\d,\s]+)\]\s*\)$/)) && INV_QG[m[1]]) { const g = INV_QG[m[1]], k = +m[3], qs = m[4].split(',').map(Number), ps = m[2] ? splitArgs(m[2]).map(x => param(x, ln, errors)) : []; add(g, qs.slice(k), qs.slice(0, k), ps, ln, cond); return; }
        if ((m = s.match(/^\w+\.(\w+)\((.*)\)$/))) {
          const name = m[1], args = splitArgs(m[2]);
          if (name === 'ccx' && args.length === 3) { add('X', [+args[2]], [+args[0], +args[1]], [], ln, cond); return; }
          if (INV_QKC[name]) { const g = INV_QKC[name], G = Sim.G[g], np = G.np, nt = G.nt; if (args.length !== np + 1 + nt) { errors.push({ ln, msg: `Line ${ln}: ${name} takes ${np ? np + ' parameter' + (np > 1 ? 's' : '') + ', ' : ''}a control and ${nt} target${nt > 1 ? 's' : ''}.` }); return; } add(g, args.slice(np + 1).map(Number), [+args[np]], args.slice(0, np).map(x => param(x, ln, errors)), ln, cond); return; }
          if (INV_QK[name]) { const g = INV_QK[name], G = Sim.G[g]; if (args.length !== G.np + G.nt) { errors.push({ ln, msg: `Line ${ln}: ${name} takes ${G.np ? G.np + ' parameter' + (G.np > 1 ? 's' : '') + ' and ' : ''}${G.nt} qubit${G.nt > 1 ? 's' : ''}.` }); return; } add(g, args.slice(G.np).map(Number), [], args.slice(0, G.np).map(x => param(x, ln, errors)), ln, cond); return; }
        }
        errors.push({ ln, msg: `Line ${ln} isn’t something the score can draw. Loops and functions run on a server backend; the score keeps the last valid circuit.` });
      } else if (lang === 'qasm') {
        if (/^OPENQASM|^include|^gate\s|^input\s/.test(s)) return;
        if ((m = s.match(/^qubit\[(\d+)\]\s+\w+;$/)) || (m = s.match(/^qreg\s+\w+\[(\d+)\];$/))) { n = +m[1]; return; }
        if ((m = s.match(/^bit\[(\d+)\]\s+\w+;$/)) || (m = s.match(/^creg\s+\w+\[(\d+)\];$/))) { nc = +m[1]; return; }
        let cond = null;
        if ((m = s.match(/^if\s*\(\s*\w+(?:\[(\d+)\])?\s*==\s*(\d+)\s*\)\s*(.*)$/))) { cond = { cond: m[1] != null ? { bit: +m[1], val: +m[2] } : { reg: 'c', val: +m[2] } }; s = m[3].trim(); }
        if ((m = s.match(/^\w+\[(\d+)\]\s*=\s*measure\s+\w+\[(\d+)\];$/))) { add('M', [+m[2]], [], [], ln, { cb: +m[1] }); return; }
        if ((m = s.match(/^measure\s+\w+\[(\d+)\]\s*->\s*\w+\[(\d+)\];$/))) { add('M', [+m[1]], [], [], ln, { cb: +m[2] }); return; }
        if ((m = s.match(/^reset\s+\w+\[(\d+)\];$/))) { add('RESET', [+m[1]], [], [], ln); return; }
        if (/^barrier\b/.test(s)) { add('BARRIER', [...Array(n || 1).keys()], [], [], ln); return; }
        if ((m = s.match(/^ctrl(?:\((\d+)\))?\s*@\s*(\w+)(?:\(([^)]*)\))?\s+(.+);$/))) { const k = +(m[1] || 1), g = INV_QA[m[2].toLowerCase()]; if (!g) { errors.push({ ln, msg: `Line ${ln}: ${m[2]} isn’t a gate the score knows.` }); return; } const qs = m[4].split(',').map(x => qint(x.trim(), ln)); add(g, qs.slice(k), qs.slice(0, k), m[3] ? splitArgs(m[3]).map(x => param(x, ln, errors)) : [], ln, cond); return; }
        if ((m = s.match(/^(\w+)(?:\(([^)]*)\))?\s+(.+);$/))) {
          const name = m[1].toLowerCase(), ps = m[2] ? splitArgs(m[2]).map(x => param(x, ln, errors)) : [], qs = m[3].split(',').map(x => qint(x.trim(), ln));
          if (name === 'ccx') { add('X', [qs[2]], [qs[0], qs[1]], [], ln, cond); return; }
          if (INV_QAC[name]) { const g = INV_QAC[name]; add(g, qs.slice(1), [qs[0]], ps, ln, cond); return; }
          if (name === 'u2') { add('U', qs, [], [PI / 2, ps[0], ps[1]], ln, cond); return; }
          if (INV_QA[name]) { add(INV_QA[name], qs, [], ps, ln, cond); return; }
        }
        errors.push({ ln, msg: /;$/.test(s) ? `Line ${ln} uses an instruction the score can’t draw yet.` : `Line ${ln} is missing its closing semicolon.` });
      } else if (lang === 'cirq') {
        if (/^(import|from) |^\w+\s*=\s*sympy\.Symbol|^circuit\s*=\s*cirq\.Circuit\(\)|^result|^print|^sim/.test(s)) return;
        if ((m = s.match(/^q\s*=\s*cirq\.LineQubit\.range\((\d+)\)$/))) { n = +m[1]; return; }
        if ((m = s.match(/^circuit\.append\((.*)\)$/))) {
          let body = m[1], cond = null; const cc = body.match(/^(.*)\.with_classical_controls\("c(\d+)"\)$/); if (cc) { body = cc[1]; cond = { cond: { bit: +cc[2], val: 1 } }; }
          let k;
          if ((k = body.match(/^cirq\.measure\(q\[(\d+)\],\s*key="c(\d+)"\)$/))) { add('M', [+k[1]], [], [], ln, { cb: +k[2] }); return; }
          if ((k = body.match(/^cirq\.reset\(q\[(\d+)\]\)$/))) { add('RESET', [+k[1]], [], [], ln); return; }
          const qs = (body.match(/q\[(\d+)\]/g) || []).map(x => +x.match(/\d+/)[0]);
          const ctrl = body.match(/\.controlled\((\d+)\)/); const kc = ctrl ? +ctrl[1] : 0;
          const base = body.replace(/\.controlled\(\d+\)/, '').replace(/\.on\(.*\)$|\((q\[\d+\](,\s*)?)+\)$/, '');
          let g = null, p = [];
          const simple = { 'cirq.H': 'H', 'cirq.X': 'X', 'cirq.Y': 'Y', 'cirq.Z': 'Z', 'cirq.S': 'S', 'cirq.S**-1': 'SDG', 'cirq.T': 'T', 'cirq.T**-1': 'TDG', 'cirq.X**0.5': 'SX', 'cirq.X**-0.5': 'SXDG', 'cirq.I': 'I', 'cirq.SWAP': 'SWAP', 'cirq.ISWAP': 'ISWAP', 'cirq.CNOT': 'CNOT', 'cirq.CZ': 'CZ', 'cirq.CCX': 'CCX', 'cirq.CSWAP': 'CSWAP' };
          if (simple[base]) g = simple[base];
          else if ((k = base.match(/^cirq\.(rx|ry|rz)\((.*)\)$/))) { g = k[1].toUpperCase(); p = [param(k[2], ln, errors)]; }
          else if ((k = base.match(/^cirq\.ZPowGate\(exponent=\((.*)\)\/np\.pi\)$/))) { g = 'P'; p = [param(k[1], ln, errors)]; }
          else if ((k = base.match(/^cirq\.(XX|YY|ZZ)PowGate\(exponent=\((.*)\)\/np\.pi, global_shift=-0\.5\)$/))) { g = 'R' + k[1]; p = [param(k[2], ln, errors)]; }
          if (g === 'CNOT') { add('X', [qs[1]], [qs[0]], [], ln, cond); return; } if (g === 'CZ') { add('Z', [qs[1]], [qs[0]], [], ln, cond); return; }
          if (g === 'CCX') { add('X', [qs[2]], [qs[0], qs[1]], [], ln, cond); return; } if (g === 'CSWAP') { add('SWAP', qs.slice(1), [qs[0]], [], ln, cond); return; }
          if (g) { add(g, qs.slice(kc), qs.slice(0, kc), p, ln, cond); return; }
        }
        errors.push({ ln, msg: `Line ${ln} isn’t a Cirq call the score can draw yet.` });
      } else {
        if (/^(import|from) |^dev\s*=|^@qml\.qnode|^def circuit|^print\(|^return /.test(s)) { if ((m = s.match(/^dev\s*=\s*qml\.device\(.*wires\s*=\s*(\d+)/))) n = +m[1]; if ((m = s.match(/^return qml\.counts\(wires=\[([\d,\s]*)\]\)/)) && m[1].trim()) m[1].split(',').forEach(x => add('M', [+x], [], [], ln, { cb: +x })); return; }
        let cond = null, k;
        if ((k = s.match(/^(m\d+)\s*=\s*qml\.measure\((\d+)\)$/))) { add('M', [+k[2]], [], [], ln, { cb: +k[1].slice(1) }); return; }
        if ((k = s.match(/^qml\.measure\((\d+),\s*reset=True\)$/))) { add('RESET', [+k[1]], [], [], ln); return; }
        if ((k = s.match(/^qml\.cond\((~?)m(\d+),\s*qml\.(\w+)\)\((.*)\)$/))) { cond = { cond: { bit: +k[2], val: k[1] ? 0 : 1 } }; s = `qml.${k[3]}(${k[4]})`; }
        if ((k = s.match(/^qml\.adjoint\(qml\.(S|T|SX)\)\(wires=(\d+)\)$/))) { add({ S: 'SDG', T: 'TDG', SX: 'SXDG' }[k[1]], [+k[2]], [], [], ln, cond); return; }
        if ((k = s.match(/^qml\.ctrl\(qml\.(\w+),\s*control=\[([\d,\s]+)\]\)\((.*)\)$/))) { const g = INV_PL[k[1]]; const args = splitArgs(k[3]); const w = args.find(a => a.startsWith('wires=')); const ps = args.filter(a => !a.startsWith('wires=')).map(x => param(x, ln, errors)); const ws = w ? (w.slice(6).match(/\d+/g) || []).map(Number) : []; if (g) { add(g, ws, k[2].split(',').map(Number), ps, ln, cond); return; } }
        if ((k = s.match(/^qml\.(\w+)\((.*)\)$/))) {
          const name = k[1], args = splitArgs(k[2]), w = args.find(a => a.startsWith('wires=')), ws = w ? (w.slice(6).match(/\d+/g) || []).map(Number) : [], ps = args.filter(a => !a.startsWith('wires=')).map(x => param(x, ln, errors));
          if (name === 'Barrier') { add('BARRIER', [...Array(n || 1).keys()], [], [], ln); return; }
          if (name === 'MultiControlledX') { add('X', [ws[ws.length - 1]], ws.slice(0, -1), [], ln, cond); return; }
          if (INV_PLC[name]) { const [g, kc] = INV_PLC[name]; add(g, ws.slice(+kc), ws.slice(0, +kc), ps, ln, cond); return; }
          if (INV_PL[name]) { add(INV_PL[name], ws, [], ps, ln, cond); return; }
        }
        errors.push({ ln, msg: `Line ${ln} isn’t a PennyLane operation the score can draw yet.` });
      }
    });
    if (n == null) errors.unshift({ ln: 1, msg: { qiskit: 'Declare the register first, e.g. qc = QuantumCircuit(2).', qasm: 'Declare the register first, e.g. qubit[2] q;', cirq: 'Declare the qubits first, e.g. q = cirq.LineQubit.range(2).', pennylane: 'Declare the device first, e.g. dev = qml.device("default.qubit", wires=2).' }[lang] });
    if (n != null && (n < 1 || n > 32)) errors.push({ ln: 1, msg: 'The score holds 1 to 32 qubits.' });
    for (const o of ops) { for (const q of [...o.q, ...o.c]) if (n != null && q >= n) errors.push({ ln: o.ln, msg: `Line ${o.ln}: q${q} doesn’t exist; the register has ${n} qubit${n > 1 ? 's' : ''}.` }); if (new Set([...o.q, ...o.c]).size !== o.q.length + o.c.length) errors.push({ ln: o.ln, msg: `Line ${o.ln}: a gate can’t use the same qubit twice.` }); }
    return { n, nc: nc ?? n, ops, errors };
  }
  /* ---- imports ---- */
  function fromQuirk(json) {
    const d = typeof json === 'string' ? JSON.parse(json) : json; if (!d.cols) throw new Error('Quirk JSON needs a "cols" array.');
    const map = { H: 'H', X: 'X', Y: 'Y', Z: 'Z', 'Z^½': 'S', 'Z^-½': 'SDG', 'Z^¼': 'T', 'Z^-¼': 'TDG', 'X^½': 'SX', 'X^-½': 'SXDG', Measure: 'M', Swap: 'SWAP' };
    const ops = []; let n = 1;
    d.cols.forEach((col, c) => {
      n = Math.max(n, col.length); const ctrls = [], tg = {}, sw = [];
      col.forEach((cell, q) => { if (cell === '•') ctrls.push(q); else if (cell === 'Swap') sw.push(q); else if (cell === 1 || cell === '…') return; else if (map[cell]) (tg[map[cell]] = tg[map[cell]] || []).push(q); else throw new Error(`Quirk gate “${typeof cell === 'object' ? JSON.stringify(cell) : cell}” isn’t supported for import.`); });
      if (sw.length === 2) ops.push({ g: 'SWAP', q: sw, c: ctrls, col: c });
      for (const [g, qs] of Object.entries(tg)) qs.forEach(q => ops.push(g === 'M' ? { g, q: [q], col: c, cb: q } : { g, q: [q], c: ctrls.slice(), col: c }));
    });
    return { n, ops };
  }
  /* ---- exports ---- */
  function quantikz(circ) {
    const n = circ.n, cols = Math.max(1, ...circ.ops.map(o => Math.floor(o.col) + 1)), grid = Array.from({ length: n }, () => Array(cols).fill('\\qw'));
    for (const o of circ.ops) {
      const c = Math.floor(o.col), name = Sim.displayName(o), ps = (o.p || []).map(x => typeof x === 'number' ? fmtNum(x).replace(/pi/g, '\\pi').replace(/\*/g, '') : pyName(x).replace(/theta/g, '\\theta').replace(/gamma/g, '\\gamma').replace(/beta/g, '\\beta'));
      const label = { SDG: 'S^\\dagger', TDG: 'T^\\dagger', SX: '\\sqrt{X}', SXDG: '\\sqrt{X}^\\dagger' }[o.g] || (o.g.length > 1 ? `${o.g[0]}_{${o.g.slice(1).toLowerCase()}}` : o.g);
      const box = `\\gate{${label}${ps.length ? `(${ps.join(',')})` : ''}}`;
      if (o.g === 'M') { grid[o.q[0]][c] = '\\meter{}'; continue; }
      if (o.g === 'RESET') { grid[o.q[0]][c] = '\\gate{\\ket{0}}'; continue; }
      if (o.g === 'BARRIER') continue;
      if (o.g === 'SWAP') { grid[o.q[0]][c] = `\\swap{${o.q[1] - o.q[0]}}`; grid[o.q[1]][c] = '\\targX{}'; }
      else if (o.q.length === 2) { grid[o.q[0]][c] = `\\gate[2]{${label}${ps.length ? `(${ps.join(',')})` : ''}}`; grid[o.q[1]][c] = ''; }
      else grid[o.q[0]][c] = (o.g === 'X' && (o.c || []).length) ? '\\targ{}' : ((o.g === 'Z' && (o.c || []).length) ? '\\ctrl{0}' : box);
      for (const k of o.c || []) grid[k][c] = `\\ctrl{${o.q[0] - k}}`;
    }
    return '% \\usepackage{quantikz}\n\\begin{quantikz}\n' + grid.map((row, q) => `\\lstick{$q_{${q}}$} & ${row.join(' & ')} & \\qw`).join(' \\\\\n') + '\n\\end{quantikz}';
  }
  function notebook(circ, title) {
    const src = gen('qiskit', circ).text;
    const cell = (type, text) => ({ cell_type: type, metadata: {}, source: text.split('\n').map((l, i, a) => i < a.length - 1 ? l + '\n' : l), ...(type === 'code' ? { execution_count: null, outputs: [] } : {}) });
    return JSON.stringify({ nbformat: 4, nbformat_minor: 5, metadata: { kernelspec: { name: 'python3', display_name: 'Python 3' }, language_info: { name: 'python' } }, cells: [
      cell('markdown', `# ${title || 'Circuit'}\nExported from QUBIQ. On this platform q0 is the leftmost bit; Qiskit prints it on the right.`),
      cell('code', '%pip install qiskit qiskit-aer'), cell('code', src),
      cell('code', 'from qiskit_aer import AerSimulator\nfrom qiskit import transpile\nsim = AerSimulator()\nif not qc.num_clbits:\n    qc.measure_all()\ncounts = sim.run(transpile(qc, sim), shots=1000).result().get_counts()\nprint(counts)')] }, null, 1);
  }
  function statevectorText(s, n, kind) {
    const rows = []; for (let i = 0; i < s.re.length; i++) { const r = s.re[i], im = s.im[i]; if (r * r + im * im < 1e-12) continue; rows.push([i, r, im]); }
    if (kind === 'numpy') return `import numpy as np\n# q0 is the leftmost bit\npsi = np.zeros(${1 << n}, dtype=complex)\n` + rows.map(([i, r, im]) => `psi[0b${i.toString(2).padStart(n, '0')}] = ${r.toFixed(6)}${im >= 0 ? '+' : '-'}${Math.abs(im).toFixed(6)}j`).join('\n');
    return '|\\psi\\rangle = ' + rows.map(([i, r, im]) => { const c = Math.abs(im) < 1e-9 ? r.toFixed(4) : Math.abs(r) < 1e-9 ? `${im.toFixed(4)}i` : `(${r.toFixed(4)}${im >= 0 ? '+' : '-'}${Math.abs(im).toFixed(4)}i)`; return `${c}\\,|${i.toString(2).padStart(n, '0')}\\rangle`; }).join(' + ').replace(/\+ -/g, '- ');
  }

  /* ---- highlighter: all four SDKs; gate calls carry their family stroke ---- */
  const FAM = g => { const G = Sim.G[g]; if (!G) return 0; return { single: 1, phase: 2, rot: 2, control: 3, measure: 4 }[G.fam] || 0; };
  const NAME2G = { h: 'H', x: 'X', y: 'Y', z: 'Z', s: 'S', sdg: 'SDG', t: 'T', tdg: 'TDG', sx: 'SX', sxdg: 'SXDG', p: 'P', rx: 'RX', ry: 'RY', rz: 'RZ', u: 'U', swap: 'SWAP', iswap: 'ISWAP', rxx: 'RXX', ryy: 'RYY', rzz: 'RZZ', measure: 'M', reset: 'RESET', barrier: 'BARRIER', cx: 'CX', cy: 'CX', cz: 'CX', ch: 'CX', cp: 'CX', crx: 'CX', cry: 'CX', crz: 'CX', ccx: 'CX', ccz: 'CX', cswap: 'CX', mcx: 'CX', cnot: 'CX', toffoli: 'CX', hadamard: 'H', paulix: 'X', pauliy: 'Y', pauliz: 'Z', phaseshift: 'P', controlledphaseshift: 'CX', sdg_: 'SDG', rot: 'U', u3: 'U', measure_all: 'M', counts: 'M', expval: 'M', probs: 'M', ms: 'RXX', isingxx: 'RXX', isingyy: 'RYY', isingzz: 'RZZ', xx: 'RXX', yy: 'RYY', zz: 'RZZ' };
  const famOf = w => { const k = w.toLowerCase().replace(/\*\*.*$/, ''); const g = NAME2G[k]; if (!g) return 0; if (g === 'CX') return 3; return FAM(g) || 1; };
  const KW = /\b(from|import|as|def|return|for|in|range|if|else|elif|with|include|qubit|bit|qreg|creg|gate|OPENQASM|input|float|angle|True|False|None|lambda)\b/g;
  function highlight(text) {
    const e = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return text.split('\n').map((line, i) => {
      const seg = []; let rest = line;
      const cm = rest.match(/(#|\/\/).*$/); let com = ''; if (cm && !/["'][^"']*$/.test(rest.slice(0, cm.index))) { com = rest.slice(cm.index); rest = rest.slice(0, cm.index); }
      rest.split(/("[^"]*"|'[^']*')/).forEach((part, k) => { if (k % 2) { seg.push(`<span class="c-str">${e(part)}</span>`); return; }
        let t = e(part);
        t = t.replace(/(\b(?:qc|circuit|qml|cirq|ops)\.)?\b([A-Za-z_][\w]*)(?=\s*\(|\s+q\[|\s+q\b|\s*\*\*)/g, (m, pre, w) => { const f = famOf(w); return f ? `${pre || ''}<span class="c-g${f}">${w}</span>` : m; });
        t = t.replace(/(^|[^\w">])(\d+(?:\.\d+)?)(?![\w"])/g, '$1<span class="c-num">$2</span>');
        t = t.replace(KW, m => `<span class="c-kw">${m}</span>`);
        seg.push(t); });
      if (com) seg.push(`<span class="c-com">${e(com)}</span>`);
      return `<span class="cl" data-ln="${i + 1}">${seg.join('') || ' '}</span>`;
    }).join('\n') + '\n';
  }
  return { gen, parse, fromQuirk, quantikz, notebook, statevectorText, fmtNum, highlight };
})();
