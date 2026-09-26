/* =====================================================================
   TUTOR — the margin voice. Grounded: every number comes from the
   simulator through tools. A rule-based tutor answers from those tools.
   An AI model is used only if one is plugged into LLM.provider (llm.js),
   which is empty by default, so no AI API is called and no tokens are spent.
===================================================================== */
const LANGS = [{ value: 'en', label: 'English' }, { value: 'hi', label: 'हिन्दी' }, { value: 'ta', label: 'தமிழ்' }, { value: 'te', label: 'తెలుగు' }, { value: 'bn', label: 'বাংলা' }, { value: 'mr', label: 'मराठी' }, { value: 'kn', label: 'ಕನ್ನಡ' }];
const LANG_NAME = { en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', bn: 'Bengali', mr: 'Marathi', kn: 'Kannada' };
const Lint = {
  // pencil suggestions: cancelling pairs, mergeable rotations
  review(C) {
    const out = [], byQ = {}; Sim.sorted(C.ops).forEach(o => Sim.wires(o).forEach(q => (byQ[q] = byQ[q] || []).push(o)));
    const selfInv = new Set(['H', 'X', 'Y', 'Z', 'SWAP']);
    const next = (o, q) => { const L = byQ[q]; return L[L.indexOf(o) + 1]; };
    const seen = new Set();
    for (const o of Sim.sorted(C.ops)) {
      if (seen.has(o.id) || o.cond || o.g === 'M') continue; const w = Sim.wires(o); const nx = next(o, w[0]); if (!nx || seen.has(nx.id)) continue;
      if (!w.every(q => next(o, q) === nx) || Sim.wires(nx).length !== w.length) continue;
      const same = o.q.join() === nx.q.join() && (o.c || []).join() === (nx.c || []).join() && !nx.cond;
      if (!same) continue;
      const inv = Sim.inverseOp(o);
      if ((selfInv.has(o.g) && o.g === nx.g) || (inv && inv.g === nx.g && (inv.p || []).every((x, i) => typeof x === 'number' && Math.abs(x - nx.p[i]) < 1e-9))) { out.push({ kind: 'cancel', ops: [o, nx], text: `${Sim.displayName(o)} then ${Sim.displayName(nx)} on ${w.map(q => 'q' + q).join(', ')} cancel: together they do nothing. Strike both?`, save: 2 }); seen.add(o.id); seen.add(nx.id); continue; }
      if (['RX', 'RY', 'RZ', 'P', 'RXX', 'RYY', 'RZZ'].includes(o.g) && o.g === nx.g) { out.push({ kind: 'merge', ops: [o, nx], into: o.g, text: `Two ${Sim.displayName(o)} rotations in a row merge into one. Merge them?`, save: 1 }); seen.add(o.id); seen.add(nx.id); continue; }
      const fuse = { 'S,S': 'Z', 'T,T': 'S', 'SDG,SDG': 'Z', 'TDG,TDG': 'SDG', 'SX,SX': 'X' }[`${o.g},${nx.g}`];
      if (fuse && !(o.c || []).length) { out.push({ kind: 'merge', ops: [o, nx], into: fuse, text: `${o.g} then ${nx.g} is a single ${fuse}. Merge them?`, save: 1 }); seen.add(o.id); seen.add(nx.id); }
    }
    return out;
  },
  warnings(C) {
    const w = [], ops = Sim.sorted(C.ops), measured = new Set(ops.filter(o => o.g === 'M').map(o => o.q[0])), used = new Set(ops.flatMap(o => Sim.wires(o)));
    ops.filter(o => (o.c || []).length && !o.cond).forEach(o => { const idle = o.c.filter(c => !ops.some(p => p.col < o.col && Sim.wires(p).includes(c))); if (idle.length && !w.some(x => x.kind === 'dead')) w.push({ kind: 'dead', op: o, text: `The ${Sim.displayName(o)}’s control ${idle.map(q => 'q' + q).join(', ')} is still exactly |0⟩ at step ${Math.floor(o.col) + 1}, so the gate never fires. Put an H (or X) on ${idle.map(q => 'q' + q).join(', ')} first, or swap control and target.` }); });
    if (measured.size && measured.size < used.size) { const miss = [...used].filter(q => !measured.has(q)); w.push({ kind: 'measure', q: miss[0], text: `${miss.map(q => 'q' + q).join(', ')} ${miss.length > 1 ? 'are' : 'is'} used but never measured, so hardware returns no bit for ${miss.length > 1 ? 'them' : 'it'}.` }); }
    for (let q = 0; q < C.n; q++) if (!used.has(q) && C.ops.length) { w.push({ kind: 'unused', q, text: `q${q} is never used. Remove it to save a qubit.` }); break; }
    ops.filter(o => o.g === 'M').forEach(m => { if (ops.some(p => p.col > m.col && Sim.wires(p).includes(m.q[0]) && p.g !== 'M' && p.g !== 'BARRIER') && !w.some(x => x.kind === 'mid')) w.push({ kind: 'mid', op: m, text: `q${m.q[0]} is measured mid-circuit and then used again. That’s allowed (the runs switch to per-shot trajectories), but the state views show one sampled branch.` }); });
    const syms = new Set(); ops.forEach(o => (o.p || []).forEach(p => { if (typeof p !== 'number') (String(p).match(/[A-Za-zθγβλφ_]\w*/g) || []).forEach(t => { if (!['pi', 'e', 'sqrt'].includes(t)) syms.add(t.replace('θ', 'theta').replace('γ', 'gamma').replace('β', 'beta')); }); }));
    [...syms].filter(s => !(s in (C.params || {}))).forEach(s => w.push({ kind: 'param', text: `Parameter ${s} has no value yet; it’s treated as 0. Set it in the parameter panel.` }));
    return w;
  }
};
const Tutor = (() => {
  function snapshot(C, upto) {
    const s = Sim.run(C, upto ?? Infinity), p = Sim.probs(s), n = C.n;
    const top = Array.from(p).map((v, i) => [v, i]).filter(a => a[0] > 1e-6).sort((a, b) => b[0] - a[0]).slice(0, 8).map(([v, i]) => ({ ket: Sim.ket(i, n), p: +v.toFixed(4), amp: fmt.cplx(s.re[i], s.im[i], 4), phase: fmt.ang(Sim.phase(s, i)) }));
    const bloch = n <= 12 ? Array.from({ length: n }, (_, q) => Sim.bloch(s, q).map(x => +x.toFixed(3))) : null;
    const ties = []; if (n <= 8) for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) { const t = Sim.tie(s, a, b); if (t > .05) ties.push({ q: [a, b], strength: +t.toFixed(3) }); }
    return { qubits: n, top, bloch, entangled: ties, dynamic: Sim.isDynamic(C) };
  }
  function circuitText(C) { return { n: C.n, params: C.params || {}, ops: Sim.sorted(C.ops).map(o => ({ id: o.id, gate: Sim.displayName(o), targets: o.q, controls: o.c || [], params: o.p || [], step: Math.floor(o.col) + 1, cond: o.cond || undefined })), qiskit: Code.gen('qiskit', C).text }; }
  // parse a model's edit into IR ops
  function toOps(list, n) {
    const map = { CX: ['X', 1], CNOT: ['X', 1], CY: ['Y', 1], CZ: ['Z', 1], CH: ['H', 1], CP: ['P', 1], CRX: ['RX', 1], CRY: ['RY', 1], CRZ: ['RZ', 1], CCX: ['X', 2], TOFFOLI: ['X', 2], CSWAP: ['SWAP', 1], FREDKIN: ['SWAP', 1], MCX: ['X', -1], MCZ: ['Z', -1], MEASURE: ['M', 0], SDAG: ['SDG', 0], TDAG: ['TDG', 0] };
    return (list || []).map((x, i) => {
      let g = String(x.gate || '').toUpperCase().replace('†', 'DG'); let nc = 0; if (map[g]) { [g, nc] = map[g]; }
      if (!Sim.G[g]) throw new Error(`Unknown gate ${x.gate}`);
      const qs = (x.qubits || x.targets || []).map(Number), cs = (x.controls || []).map(Number);
      let q = qs, c = cs; if (nc > 0 && !cs.length) { c = qs.slice(0, nc); q = qs.slice(nc); } if (nc === -1 && !cs.length) { c = qs.slice(0, -1); q = qs.slice(-1); }
      [...q, ...c].forEach(k => { if (!(k >= 0 && k < n)) throw new Error(`Qubit ${k} is outside the register`); });
      if (q.length !== Sim.G[g].nt && g !== 'BARRIER') throw new Error(`${x.gate} needs ${Sim.G[g].nt} target(s)`);
      return IR.op(g, q, { c, p: (x.params || []).map(v => typeof v === 'number' ? v : (() => { try { return Sim.evalExpr(v); } catch (e) { return String(v); } })()), col: x.step != null ? x.step - 1 : i, cb: g === 'M' ? q[0] : undefined });
    });
  }
  /* ---------- rule-based fallback (also used offline) ---------- */
  function local(q, ctx) {
    const C = ctx.circuit, lq = (q || '').toLowerCase(), snap = C ? snapshot(C, ctx.playhead) : null;
    const gen = lq.match(/(\d+)\s*-?\s*qubit|ghz|bell|grover|qaoa|qft|superposition|teleport/);
    if (C && ctx.mode === 'collab' && /(make|build|create|write|generate|draw|give me)/.test(lq) && gen) { const t = Templates.fromText(lq); if (t) return { text: `Drawing ${t.name} on the score, stroke by stroke. The code below writes itself as it goes.`, build: t }; }
    if (!C) return { text: ctx.fallback || 'Ask about the object you’re looking at; press and hold anything on the Stage to attach it to your question.' };
    const list = snap.top.slice(0, 4).map(t => `${t.ket} ${fmt.p(t.p)}`).join(', ');
    if (/entangl|thread|tied|bell|ghz|correl/.test(lq)) { const t = snap.entangled.sort((a, b) => b.strength - a.strength)[0]; return { text: t ? `q${t.q[0]} and q${t.q[1]} are tied with strength ${t.strength} (1 is maximal). Their arrows are ${Math.hypot(...snap.bloch[t.q[0]]).toFixed(2)} and ${Math.hypot(...snap.bloch[t.q[1]]).toFixed(2)} long: neither has a direction of its own.` : 'Nothing is entangled here: every arrow still reaches the sphere’s skin. An H followed by a CNOT ties two qubits.', point: t ? { qubit: t.q[0] } : null }; }
    if (/phase|needle|sign|minus/.test(lq)) { const neg = snap.top.filter(t => t.phase !== '0'); return { text: neg.length ? `${neg.map(t => `${t.ket} has phase ${t.phase}`).join('; ')}. One measurement can’t see a phase; a following H (or any interference step) turns it into odds.` : 'Every filled disk points right: no relative phases yet. A Z, S or T after an H will turn a needle.', point: { field: 1 } }; }
    if (/prob|odds|chance|result|count|histogram|measure/.test(lq)) return { text: `At the playhead the odds are ${list || 'all on ' + Sim.ket(0, C.n)}. Runs pour shots toward those heights; with noise they spread out.`, point: { histogram: 1 } };
    if (/optimi|shorter|simplif|depth|fewer|cnot count|reduce/.test(lq)) { const r = Lint.review(C), m = Passes.metrics(C); return { text: r.length ? r[0].text + ` That saves ${r[0].save} gate${r[0].save > 1 ? 's' : ''}. It’s pencilled on the score.` : `No cancelling pairs or mergeable rotations. Depth ${m.depth}, ${m.cx} CNOTs after translation to {CX, RZ, SX, X}${m.tcount != null ? `, T-count ${m.tcount}` : ''}. Try Optimise for commutation-based cancellation.`, pencil: r[0] || null }; }
    if (/bug|wrong|error|debug|fix|why.*(not|doesn)/.test(lq)) { const w = Lint.warnings(C); return { text: w.length ? w[0].text : 'No structural mistakes found. Scrub the playhead back one step at a time and watch which disk changes first; that’s where the story diverges from what you expect.', point: w[0]?.op ? { op: w[0].op.id } : null }; }
    if (/translate|cirq|pennylane|qasm/.test(lq)) return { text: 'Switch the code language under the score: Qiskit, Cirq, PennyLane and OpenQASM 3 all describe this same circuit. Differences to watch: Qiskit prints bitstrings with q0 on the right; Cirq has no barrier; PennyLane measures mid-circuit with qml.measure and returns counts.' };
    if (ctx.selected) { const o = C.ops.find(x => x.id === ctx.selected); if (o) return { text: Explain.gate(o, ctx.depth), point: { op: o.id } }; }
    return { text: C.ops.length ? `Right now: ${list}. Ask why a gate does what it does, where the entanglement is, how to shorten this, or say “make a 3-qubit GHZ state”.` : 'The register is all |0…0⟩. Drag an H onto q0 and ask what changed.' };
  }
  /* ---------- optional AI model with page tools (off unless LLM.provider is set) ---------- */
  async function ask(q, ctx, { onText, signal, apply } = {}) {
    const sample = typeof LLM !== 'undefined' && typeof LLM.provider === 'function' ? LLM.provider : null;
    if (!sample || ctx.forceLocal) return Object.assign(local(q, ctx), { local: true });
    const C = ctx.circuit, lang = LANG_NAME[Store.get().lang] || 'English', pointed = [], pencilled = [], built = [];
    const tools = [];
    if (C) {
      tools.push({ name: 'simulate', description: 'Exact statevector at the playhead (or a given step): top basis states with probability, amplitude and phase; reduced Bloch vector per qubit; entangled pairs.', inputSchema: { type: 'object', properties: { step: { type: 'number', description: 'Optional: state after this many steps.' } } }, execute: a => snapshot(C, a.step != null ? a.step : ctx.playhead) });
      tools.push({ name: 'getCircuit', description: 'The learner\'s current circuit: gates with ids, targets, controls, parameters and the Qiskit code.', execute: () => circuitText(C) });
      tools.push({ name: 'lint', description: 'Structural checks: cancelling pairs, mergeable rotations, controls that never fire, unmeasured or unused qubits, unset parameters.', execute: () => ({ suggestions: Lint.review(C).map(x => ({ kind: x.kind, ops: x.ops.map(o => o.id), text: x.text })), warnings: Lint.warnings(C).map(x => ({ kind: x.kind, text: x.text, op: x.op?.id })), metrics: Passes.metrics(C) }) });
      tools.push({ name: 'point', description: 'Draw a leader line from your reply to an object on the Stage so the learner can see what you mean.', inputSchema: { type: 'object', properties: { target: { type: 'string', description: 'op:<id>, qubit:<index>, field:<basis index>, histogram, code' } }, required: ['target'] }, execute: a => { pointed.push(String(a.target)); return { ok: true }; } });
      tools.push({ name: 'proposeEdit', description: ctx.mode === 'collab' ? 'Write gates onto the learner\'s score. Gates: H X Y Z S SDG T TDG SX P RX RY RZ U SWAP ISWAP RXX RYY RZZ CX CY CZ CH CP CRX CRY CRZ CCX CSWAP MCX MCZ M RESET. Qubits are 0-indexed; for controlled gates give controls then targets in "qubits", or use "controls". Use replace:true to start from an empty register of n qubits.' : 'Pencil a PARTIAL fix onto the score (one or two gates at most). The learner decides whether to ink it in. Never give a full solution in guide mode.', inputSchema: { type: 'object', properties: { replace: { type: 'boolean' }, n: { type: 'number' }, ops: { type: 'array', items: { type: 'object', properties: { gate: { type: 'string' }, qubits: { type: 'array', items: { type: 'number' } }, controls: { type: 'array', items: { type: 'number' } }, params: { type: 'array', items: {} }, step: { type: 'number' } }, required: ['gate', 'qubits'] } }, note: { type: 'string' } }, required: ['ops'] },
        execute: a => { const n = a.replace && a.n ? Math.min(12, Math.max(1, a.n)) : C.n; const ops = toOps(a.ops, n); if (ctx.mode !== 'collab' && ops.length > 2) throw new Error('Guide mode: pencil at most two gates.'); (ctx.mode === 'collab' ? built : pencilled).push({ ops, replace: !!a.replace, n }); return { ok: true, gates: ops.length }; } });
      if (ctx.grade) tools.push({ name: 'grade', description: 'Grade the learner\'s current circuit against the active challenge.', execute: () => ctx.grade() });
    }
    const persona = ctx.mode === 'collab'
      ? 'You are the collaborator in a quantum computing laboratory. Be precise and brief. You may write full circuits with proposeEdit.'
      : 'You are a Socratic quantum-computing tutor inside a lesson. Escalate hints: ask a guiding question first; if the learner is stuck, point at the object; only then pencil a partial fix (max two gates). Never reveal the full solution.';
    const depth = { intuition: 'Use plain language, no equations unless asked.', formal: 'Use Dirac notation and short derivations where they help (inline LaTeX between $…$).', research: 'Be technical: general n-qubit forms, complexity, resource counts, noise sensitivity; cite original papers by author and year.' }[ctx.depth || 'intuition'];
    const input = `${persona}\nReply in ${lang}. ${depth} Keep answers under 140 words unless asked for more. Every number you state must come from the tools (simulate, getCircuit, lint) — never estimate. When you refer to something on the Stage, call point. Platform convention: q0 is the leftmost bit of every ket and bitstring.\n\nWhere the learner is: ${ctx.where || 'Laboratory'}.${ctx.lesson ? `\nLesson: ${ctx.lesson}` : ''}${ctx.selectedText ? `\nThey pressed and held: ${ctx.selectedText}` : ''}${ctx.extra ? `\n${ctx.extra}` : ''}\n\nLearner: ${q || 'What am I looking at?'}`;
    try {
      const res = await sample(input, { tools, signal, onText: onText ? ({ text }) => onText(text) : undefined, modelTier: ctx.tier || 'default' });
      return { text: res.text, pointed, pencilled, built };
    } catch (e) {
      if (e.code === 'cancelled') return { text: e.text || '', cancelled: true };
      const why = { not_granted: 'The AI tutor isn’t available, so the built-in tutor answers instead.', rate_limited: 'The AI tutor is busy for a moment; the built-in tutor answers instead.', tools_unavailable: '', sampling_disabled: 'AI tutoring is turned off for this account; the built-in tutor answers instead.' }[e.code] || '';
      const L = local(q, ctx); return Object.assign(L, { text: (why ? why + '\n\n' : '') + L.text, local: true });
    }
  }
  /* ---------- mount a margin voice ---------- */
  function mount(host, getCtx, { placeholder = 'Ask about what you see…', onBuild, onPencil, resolve } = {}) {
    let ctl = null;
    const say = h('p', { class: 'say', 'aria-live': 'polite' }), inp = h('input', { type: 'text', autocomplete: 'off', spellcheck: 'true', placeholder, 'aria-label': 'Ask the tutor' });
    const stop = h('button', { type: 'button', class: 'btn', hidden: true, onclick: () => ctl && ctl.abort() }, 'Stop');
    const form = h('form', { class: 'ask', onsubmit: e => { e.preventDefault(); run(inp.value.trim()); } }, inp, h('button', { type: 'submit', 'aria-label': 'Ask' }, '→'));
    const lang = Ctl.menu({ label: 'Tutor language', options: LANGS, value: Store.get().lang, onChange: v => Store.set('lang', v) });
    const wrap = h('div', { class: 'tutor' }, say, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, 'Tutor'), h('span', { class: 'row' }, stop, lang)), form);
    host.append(wrap);
    async function run(q, extraCtx = {}) {
      const ctx = Object.assign(getCtx(), extraCtx); ctl && ctl.abort(); ctl = new AbortController();
      say.className = 'say wait'; say.textContent = 'Thinking…'; stop.hidden = false; const t0 = performance.now();
      const r = await ask(q, ctx, { signal: ctl.signal, onText: t => { say.className = 'say'; say.innerHTML = Tex.prose(t); } });
      await Motion.wait(Math.max(0, 350 - (performance.now() - t0)));
      stop.hidden = true; say.className = 'say';
      if (r.local) { await stream(r.text); } else if (r.text) say.innerHTML = Tex.prose(r.text);
      inp.value = '';
      const targets = (r.pointed || []).map(t => resolve && resolve(t)).filter(Boolean); if (!targets.length && r.point && resolve) { const t = resolve(r.point.op != null ? 'op:' + r.point.op : r.point.qubit != null ? 'qubit:' + r.point.qubit : r.point.field != null ? 'field:' + r.point.field : 'histogram'); if (t) targets.push(t); }
      if (targets[0] && !(Tutor.pointer && Tutor.pointer(targets[0]))) Leader.show(say, targets[0]);
      if (r.build && onBuild) onBuild(r.build);
      (r.built || []).forEach(b => onBuild && onBuild(b));
      if (r.pencil && onPencil) onPencil([r.pencil]);
      (r.pencilled || []).forEach(p => onPencil && onPencil([{ kind: 'add', ops: p.ops, text: 'Pencilled by the tutor.' }]));
      return r;
    }
    async function stream(text) { if (Motion.reduced) { say.innerHTML = Tex.prose(text); return; } let i = 0; return new Promise(res => { const t = setInterval(() => { i += 4; say.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(t); say.innerHTML = Tex.prose(text); res(); } }, 14); }); }
    // press-and-hold any object on the stage to attach it to the next question
    return { run, say, input: inp, speak: async t => { say.className = 'say'; await stream(t); }, attach(desc) { inp.placeholder = `Ask about ${desc}…`; inp.focus(); } };
  }
  return { ask, mount, local, snapshot, toOps };
})();
/* press-and-hold to ask about an object */
function holdToAsk(el, describe, tutor) {
  let t = null, ring = null;
  el.addEventListener('pointerdown', e => { if (e.button > 0) return; const x = e.clientX, y = e.clientY; t = setTimeout(() => { ring && ring.remove(); const d = describe(e); if (!d) return; tutor.attach(d.label); tutor.pending = d; Tutor.pendingObject = d; announce(`${d.label} attached to your next question.`); }, 550); ring = h('div', { class: 'holdring', style: { left: x + 'px', top: y + 'px' } }); document.body.append(ring); });
  const clear = () => { clearTimeout(t); ring && ring.remove(); ring = null; };
  el.addEventListener('pointerup', clear); el.addEventListener('pointerleave', clear); el.addEventListener('pointermove', e => { if (ring && Math.hypot(e.movementX, e.movementY) > 3) clear(); });
}
const Explain = {
  gate(o, depth = 'intuition') {
    const q = o.q.map(k => 'q' + k).join(', '), c = (o.c || []).map(k => 'q' + k).join(', '), p = (o.p || []).map(x => typeof x === 'number' ? fmt.ang(x) : x).join(', ');
    const base = { H: 'H is a half-turn about the axis halfway between x and z: |0⟩ goes to the equator, where 0 and 1 are equally likely, and a second H brings it back.', X: 'X flips the bit: a half-turn about x, swapping |0⟩ and |1⟩.', Y: 'Y is a half-turn about y: a bit flip with a phase.', Z: 'Z leaves the odds alone and flips the phase of |1⟩: a half-turn about z.', S: 'S is a quarter-turn about z: phase i on |1⟩.', SDG: 'S† undoes S: phase −i on |1⟩.', T: 'T is an eighth-turn about z: phase e^{iπ/4} on |1⟩. Together with H and CNOT it makes a universal set.', TDG: 'T† undoes T.', SX: '√X is half an X: two of them make an X. It is a native gate on IBM hardware.', P: `P(${p}) adds phase ${p} to |1⟩ and leaves |0⟩ alone.`, RX: `RX(${p}) turns the arrow by ${p} about x.`, RY: `RY(${p}) turns the arrow by ${p} about y; with real amplitudes only, it’s the gate for preparing arbitrary odds.`, RZ: `RZ(${p}) turns the arrow by ${p} about z; it differs from P only by a global phase.`, U: `U(${p}) is the general single-qubit rotation: RZ(φ)·RY(θ)·RZ(λ).`, SWAP: `SWAP exchanges ${q}.`, ISWAP: `iSWAP exchanges ${q} and adds phase i to the swapped terms.`, RXX: `RXX(${p}) is exp(−iθ XX/2): an Ising-type interaction.`, RYY: `RYY(${p}) is exp(−iθ YY/2).`, RZZ: `RZZ(${p}) is exp(−iθ ZZ/2): it adds a phase depending on whether ${q} agree. QAOA cost layers are made of these.`, M: `M reads ${q} as 0 or 1 into classical bit ${o.cb ?? o.q[0]}; the state collapses to agree.`, RESET: `RESET forces ${q} back to |0⟩ (a measurement, then a flip if needed).`, BARRIER: 'A barrier stops the compiler moving gates across it. It does nothing to the state.' }[o.g] || Sim.displayName(o);
    const ctrl = (o.c || []).length ? ` It acts only on the part of the state where ${c} ${o.c.length > 1 ? 'are all' : 'is'} 1. After an H on the control, that ties the qubits together.` : '';
    const cond = o.cond ? ` It runs only when classical ${o.cond.reg != null ? 'register c' : 'bit c' + o.cond.bit} equals ${o.cond.val}: feed-forward.` : '';
    const formal = depth !== 'intuition' && Sim.G[o.g] && Sim.G[o.g].m ? ` Matrix: ${Explain.matrix(Sim.mat(o, {}))}.` : '';
    return base + ctrl + cond + formal;
  },
  matrix(M) { const f = ([r, i]) => fmt.cplx(r, i, 3).replace(/\.000/g, ''); return `[[${f(M[0])}, ${f(M[1])}], [${f(M[2])}, ${f(M[3])}]]`; }
};
