/* =====================================================================
   AI — one tutor brain for the whole app.
   Providers, in order:
     0. "claude": Claude, when the app runs as a published claude.ai page
        (the viewer's own Claude account; asks for consent on first use).
     1. "server": your QUBIQ runner's /v1/tutor endpoint (Claude API or
        Gemini, with the API key kept on the server).
     2. LLM.provider (llm.js), if a developer plugs one in.
     3. "built-in": a grounded rule-based tutor that answers from the
        simulator (Insight), the lesson text and a glossary. Free, offline.
   Every answer is grounded: the model is sent the facts Insight computed
   (state, narration, mistakes, learner mastery) and told to use only them.
===================================================================== */
const AI = (() => {
  let server = { available: false, model: null, provider: null, checked: 0 }, claudeFn = null, claudeDenied = false;
  Cap.use('sample').then(f => { claudeFn = f || null; emit(); });
  const listeners = new Set();
  const mode = () => Store.get().aiMode || 'auto'; // 'auto' | 'local'
  const provider = () => (mode() !== 'local' && claudeFn && !claudeDenied) ? 'claude' : (mode() !== 'local' && server.available) ? 'server' : (typeof LLM !== 'undefined' && typeof LLM.provider === 'function' && mode() !== 'local') ? 'plugin' : 'local';
  const label = () => ({ claude: 'Claude (your claude.ai account)', server: `${server.provider === 'claude' ? 'Claude API' : 'Gemini'}${server.model ? ' · ' + server.model : ''} (your server)`, plugin: 'Custom AI provider', local: 'Built-in tutor (free, offline)' }[provider()]);
  const onChange = f => { listeners.add(f); return () => listeners.delete(f); };
  const emit = () => listeners.forEach(f => { try { f(provider()); } catch (e) { } });
  async function check(force) {
    if (!force && Date.now() - server.checked < 60000) return provider();
    server.checked = Date.now();
    try { if (typeof Runner === 'undefined') throw 0; const r = await fetch(Runner.url() + '/v1/tutor/status', { signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined }); const j = r.ok ? await r.json() : null; server = Object.assign(server, { available: !!(j && j.available), model: j && j.model, provider: j && j.provider }); }
    catch (e) { server.available = false; }
    emit(); return provider();
  }
  function setMode(m) { Store.set('aiMode', m); emit(); }

  /* ---------------- glossary (the built-in tutor's knowledge) ---------------- */
  const KB = [
    { k: /\bqubits?\b(?!.*(entangl|gate))|what is a qubit/, t: 'Qubit', a: 'A qubit is a two-level quantum system. Its state is a unit vector α|0⟩ + β|1⟩ with complex amplitudes α and β, |α|² + |β|² = 1. Measuring it gives 0 with probability |α|² and 1 with probability |β|². Unlike a bit, it can be in a superposition of both until it is measured.', see: 'q1' },
    { k: /superpos/, t: 'Superposition', a: 'A superposition is a state with non-zero amplitude on more than one basis state, like (|0⟩ + |1⟩)/√2. It is not “secretly 0 or 1”: the amplitudes can interfere, which a coin toss can’t do. Measurement picks one outcome with probability |amplitude|².', see: 'q2' },
    { k: /born rule|probabilit.*(amplitude|square)|why.*squared/, t: 'Born rule', a: 'The probability of an outcome is the squared magnitude of its amplitude: P(x) = |αₓ|². Amplitudes can be negative or complex, probabilities can’t; that gap is what lets amplitudes cancel.', see: 'q2' },
    { k: /\bphase\b|global phase|relative phase/, t: 'Phase', a: 'Amplitudes carry a phase (an angle). A global phase, the same factor on every amplitude, changes nothing observable. A relative phase, like the minus sign in |−⟩ = (|0⟩ − |1⟩)/√2, is invisible to a single Z measurement but decides how states interfere after an H.', see: 'q3' },
    { k: /bloch/, t: 'Bloch sphere', a: 'Any single-qubit pure state can be written cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩, which is a point on a sphere: θ is the angle from the north pole (|0⟩), φ the angle around the equator. Single-qubit gates are rotations of that sphere. An entangled qubit’s arrow shrinks inside the sphere.', see: 'q4' },
    { k: /measur|collapse/, t: 'Measurement', a: 'Measuring in the computational basis returns 0 or 1 with the Born-rule probabilities and leaves the qubit in the state it reported. It is irreversible: the superposition is gone. To learn a distribution you repeat the experiment many times (shots).', see: 'q2' },
    { k: /\bbasis|bases|\|\+⟩|plus state|minus state|hadamard basis/, t: 'Bases', a: 'The computational basis is {|0⟩, |1⟩}. The Hadamard (X) basis is {|+⟩, |−⟩} with |±⟩ = (|0⟩ ± |1⟩)/√2, and the Y basis is {|i⟩, |−i⟩}. Measuring in another basis = rotating that basis onto Z first (e.g. H then measure).', see: 'q3' },
    { k: /\bgates?\b.*(what|are|unitar)|unitar|reversib/, t: 'Gates are unitary', a: 'A quantum gate is a unitary matrix U (U†U = I). Unitary means it preserves lengths, so probabilities still add to 1, and every gate can be undone by U†. That is why quantum circuits are reversible until you measure.', see: 'g1' },
    { k: /\bpauli|\bx gate|\by gate|\bz gate|bit flip|phase flip/, t: 'Pauli gates', a: 'X flips |0⟩ ↔ |1⟩ (a half-turn about x). Z leaves |0⟩ alone and flips the sign of |1⟩ (a half-turn about z). Y = iXZ does both. Each is its own inverse.', see: 'g1' },
    { k: /hadamard|\bh gate|\bh\b/, t: 'Hadamard', a: 'H maps |0⟩ → |+⟩ and |1⟩ → |−⟩: it is a half-turn about the axis halfway between x and z. H·H = I. It creates superpositions and, after a phase, makes them interfere, which is why nearly every algorithm starts and ends with Hadamards.', see: 'g2' },
    { k: /interfer/, t: 'Interference', a: 'Amplitudes of different paths to the same outcome add. If they have the same sign they reinforce; opposite signs cancel. H·H|0⟩ = |0⟩ because the two paths to |1⟩ have amplitudes +½ and −½. Algorithms arrange cancellation of wrong answers.', see: 'g2' },
    { k: /\bs gate|\bt gate|rotation|\brx\b|\bry\b|\brz\b/, t: 'Phase and rotation gates', a: 'S = diag(1, i) and T = diag(1, e^{iπ/4}) add a phase to |1⟩: quarter and eighth turns about z. Rx(θ), Ry(θ), Rz(θ) rotate the Bloch sphere by θ about x, y or z. Any single-qubit gate is Rz·Ry·Rz up to a global phase.', see: 'g3' },
    { k: /tensor|product state|many qubits|two qubits|\bkron/, t: 'Multi-qubit states', a: 'n qubits have 2ⁿ amplitudes, one per bitstring. Independent qubits combine by the tensor product: (a|0⟩ + b|1⟩) ⊗ (c|0⟩ + d|1⟩) = ac|00⟩ + ad|01⟩ + bc|10⟩ + bd|11⟩. States that can’t be written this way are entangled.', see: 'g4' },
    { k: /cnot|controlled|\bcx\b|toffoli|kickback/, t: 'Controlled gates', a: 'CNOT flips the target when the control is 1: |c,t⟩ → |c, t⊕c⟩. With the control in superposition it acts on only part of the state, which is how entanglement is made. Phase kickback: if the target is an eigenstate of the gate, the phase lands on the control instead.', see: 'g5' },
    { k: /entangl/, t: 'Entanglement', a: 'A multi-qubit state is entangled when it can’t be written as a product of single-qubit states, e.g. (|00⟩ + |11⟩)/√2. Measuring one qubit then fixes the other’s outcome. Each qubit alone looks random: its Bloch vector has length 0.', see: 'e1' },
    { k: /bell state|epr|\bbell\b/, t: 'Bell states', a: 'The four maximally entangled two-qubit states: Φ± = (|00⟩ ± |11⟩)/√2 and Ψ± = (|01⟩ ± |10⟩)/√2. H on the first qubit then CNOT turns |00⟩ into Φ+.', see: 'e1' },
    { k: /separab|schmidt|reduced|partial trace|purity/, t: 'Separable vs entangled', a: 'A two-qubit pure state a|00⟩ + b|01⟩ + c|10⟩ + d|11⟩ is a product state exactly when ad − bc = 0. The reduced state of one qubit is pure for product states and mixed (purity < 1) for entangled ones.', see: 'e2' },
    { k: /chsh|bell inequal|local hidden|nonlocal/, t: 'CHSH', a: 'In the CHSH game, any local hidden-variable theory gives |S| ≤ 2. Measuring a Bell pair at angles 0, π/2 (Alice) and π/4, −π/4 (Bob) gives S = 2√2 ≈ 2.83, which is what experiments see.', see: 'e4' },
    { k: /no.?cloning|no.?signal|faster than light/, t: 'No-cloning and no-signalling', a: 'No unitary can copy an unknown state (no-cloning). Entanglement gives correlations, not messages: Bob’s local statistics don’t depend on what Alice measures, so nothing travels faster than light.', see: 'e3' },
    { k: /teleport/, t: 'Teleportation', a: 'Alice and Bob share a Bell pair. Alice does CNOT and H on her unknown qubit and her half, measures both (2 classical bits) and sends them; Bob applies X and/or Z accordingly and ends up with the original state. The original is destroyed, so no cloning happens.', see: 'e5' },
    { k: /oracle|deutsch|jozsa/, t: 'Oracles and Deutsch–Jozsa', a: 'An oracle computes f(x) inside a circuit. With the output qubit in |−⟩, it multiplies |x⟩ by (−1)^{f(x)} (phase kickback). Deutsch–Jozsa then applies H to every input qubit: all zeros means f is constant, anything else means balanced, with one query instead of 2ⁿ⁻¹ + 1.', see: 'a1' },
    { k: /bernstein|vazirani|hidden string/, t: 'Bernstein–Vazirani', a: 'For f(x) = s·x mod 2, one query with the input in uniform superposition, a phase oracle, and H on every qubit reads out the hidden string s exactly.', see: 'a2' },
    { k: /grover|amplitude amplif|search/, t: 'Grover search', a: 'Grover finds a marked item among N in about (π/4)√N queries. Each iteration (oracle flips the marked sign, diffusion reflects about the mean) rotates the state by 2θ with sin θ = 1/√N toward the answer. Too many iterations overshoot.', see: 'a3' },
    { k: /\bqft|fourier/, t: 'Quantum Fourier transform', a: 'The QFT maps |x⟩ to (1/√N) Σ_y e^{2πixy/N}|y⟩: it writes x as a set of phase “clock hands”. It needs O(n²) gates for n qubits, versus O(n2ⁿ) for the classical FFT on 2ⁿ numbers.', see: 'a4' },
    { k: /phase estimation|\bqpe\b|shor|factor|period/, t: 'Phase estimation and Shor', a: 'Phase estimation reads the eigenphase φ of a unitary into t qubits using controlled-U^{2^k} and an inverse QFT. Shor’s algorithm uses it on modular multiplication to find the period r of aˣ mod N, then gcd(a^{r/2} ± 1, N) gives factors.', see: 'a5' },
    { k: /\bshots?\b|sampl|statistic/, t: 'Shots', a: 'Each run of a circuit (a shot) returns one bitstring. The histogram of many shots estimates the probabilities; the error shrinks like 1/√shots.', see: 'q2' },
    { k: /noise|decoher|error correct/, t: 'Noise', a: 'Real qubits lose information to their surroundings (T1 relaxation, T2 dephasing) and gates are imperfect. Error correction spreads one logical qubit over many physical ones to detect and fix errors.', see: null },
  ];
  function kbFind(q) { const lq = q.toLowerCase(); return KB.filter(e => e.k.test(lq)); }

  /* ---------------- grounded context → text for the model ---------------- */
  function circuitFacts(C, { narr = true, diag = true } = {}) {
    if (!C || !C.ops) return '';
    const lines = [`Circuit: ${C.n} qubit(s), q0 is the leftmost bit in every ket.`];
    try {
      const N = Insight.narrate(C);
      if (narr) N.steps.forEach(s => lines.push(`- ${s.label}${s.gates.length ? ' [' + s.gates.join(', ') + ']' : ''}: ${s.lines.join(' ')} State: ${s.state}.`));
      const f = N.final || Insight.describe(Sim.run(C));
      lines.push(`Final state: ${f.text}. Outcome odds: ${f.outcomes.slice(0, 6).map(o => o.ket + ' ' + Insight.pct(o.p)).join(', ')}.`);
      lines.push(`Per qubit: ${f.qubits.map(x => `q${x.q} ${x.pure ? x.name : 'entangled'} (P(1)=${Insight.pct(x.p1)})`).join('; ')}.`);
      if (diag) { const d = Insight.diagnose(C); lines.push(d.length ? 'Detected issues: ' + d.map(i => `[${i.sev}] ${i.title}: ${i.detail}`).join(' | ') : 'Detected issues: none.'); }
    } catch (e) { lines.push('(Could not simulate this circuit.)'); }
    return lines.join('\n');
  }
  const WHERE = w => w === 'lab' ? 'the Laboratory (circuit editor)' : /^lesson:(\w+)/.test(w) ? `lesson ${w.split(':')[1]}` : /^assess/.test(w) ? 'a module assessment result' : w === 'progress' ? 'the Progress page' : w;
  function labCircuit() {
    if (typeof Workbench === 'undefined') return null;
    try { const c = Workbench.ir(); if (c && c.ops && c.ops.length) return c; } catch (e) { }
    try { const st = Store.get().wb; if (st && st.cols && st.cols.length) { const P = Workbench._compile(st); if (P.ir.ops.length) return { n: st.n, nc: st.n, name: st.name, ops: P.ir.ops, params: { t: 0 } }; } } catch (e) { }
    return null;
  }
  function learnerFacts() {
    const bkt = Store.get().bkt || {}, ks = Object.keys(bkt); if (!ks.length) return 'Learner: new, no mastery data yet.';
    const s = ks.sort((a, b) => bkt[a] - bkt[b]);
    return `Learner mastery (0–1): ${s.map(k => `${k} ${bkt[k].toFixed(2)}`).join(', ')}. Weakest: ${s.slice(0, 2).join(', ')}.`;
  }
  function contextText(ctx = {}) {
    const parts = [];
    if (ctx.lesson) parts.push(`Lesson: ${ctx.lesson.title}. ${ctx.section ? 'Current section: ' + ctx.section : ''}\nLesson text: ${ctx.lessonText ? ctx.lessonText.slice(0, 3500) : ''}`);
    if (ctx.task) parts.push(`Current task: ${ctx.task}`);
    if (ctx.where) parts.push(`The learner is on: ${WHERE(ctx.where)}.`);
    if (ctx.circuit) parts.push((ctx.where && /^lesson/.test(ctx.where) ? 'Circuit in the lesson example the learner is using:\n' : 'The learner\u2019s circuit:\n') + circuitFacts(ctx.circuit));
    // every chat also sees the learner's current Laboratory circuit, so "what's wrong here?" always has something to look at
    const lab = labCircuit();
    if (lab && (!ctx.circuit || ctx.where !== 'lab')) parts.push('The learner\u2019s current Laboratory circuit (their most recent work, open in the Laboratory):\n' + circuitFacts(lab));
    if (ctx.target) { try { const cmp = Insight.compare(ctx.circuit, ctx.target); parts.push(`Target state: ${cmp.want.text}. Learner's state: ${cmp.now.text}. Fidelity ${cmp.fidelity.toFixed(3)}.`); } catch (e) { } }
    if (ctx.extra) parts.push(ctx.extra);
    parts.push(learnerFacts());
    return parts.join('\n\n');
  }
  const PERSONA = {
    tutor: 'You are QUBIQ’s quantum-computing tutor. Be accurate, warm and brief (under 150 words unless asked). Use the FACTS: never invent numbers; every probability or state you state must appear in the facts. Explain the why, not only the what. Use plain words first, then one line of maths if it helps (inline LaTeX between $…$). If the learner is working on a task, give a hint that moves them one step, not the full answer, unless they ask for the answer.',
    explain: 'You are QUBIQ’s tutor explaining a circuit step by step. Use only the FACTS. For each important step say what changed and why, in 1–2 sentences. End with one question that checks understanding.',
    feedback: 'You are QUBIQ’s tutor giving feedback on a quiz answer. Say briefly why the chosen answer is wrong (or right), name the misconception, and give a one-line way to remember the correct idea. Under 90 words.',
    report: 'You are QUBIQ’s tutor writing feedback on an assessment. Name 1–2 strengths and the 1–2 most important gaps, and recommend the next lessons to study, using the lesson ids given. Under 140 words, encouraging and specific.'
  };

  /* ---------------- calling a model ---------------- */
  async function callServer({ persona, question, ctx, history, onText, signal }) {
    const body = { system: PERSONA[persona] || PERSONA.tutor, context: contextText(ctx), messages: (history || []).concat([{ role: 'user', text: question }]), stream: !!onText };
    const headers = { 'Content-Type': 'application/json' }; const tok = Store.get().authToken; if (tok) headers.Authorization = 'Bearer ' + tok;
    const r = await fetch(Runner.url() + '/v1/tutor', { method: 'POST', headers, body: JSON.stringify(body), signal });
    if (!r.ok) { let d = ''; try { d = (await r.json()).detail; } catch (e) { } throw Object.assign(new Error(d || 'HTTP ' + r.status), { status: r.status }); }
    if (!onText || !r.body || !(r.headers.get('content-type') || '').includes('event-stream')) { const j = await r.json(); onText && onText(j.text); return j.text; }
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', text = '';
    for (;;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf('\n\n')) >= 0) { const chunk = buf.slice(0, i); buf = buf.slice(i + 2); const line = chunk.split('\n').find(l => l.startsWith('data:')); if (!line) continue; const j = JSON.parse(line.slice(5)); if (j.error) throw new Error(j.error); if (j.text) { text += j.text; onText(text); } } }
    return text;
  }
  async function callClaude({ persona, question, ctx, history, onText, signal }) {
    const facts = contextText(ctx), turns = [];
    (history || []).slice(-6).forEach(m => turns.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
    if (turns.length && turns[0].role !== 'user') turns.shift();
    const framed = `${PERSONA[persona] || PERSONA.tutor}\n\nRules: use only numbers and states that appear in FACTS or standard textbook quantum computing. In QUBIQ, q0 is the leftmost bit of every ket. Write short paragraphs, inline maths between $…$, no headings. When a lesson id (like q3 or a5) is relevant, you may name the lesson title. If the learner says “here”, “this” or “my circuit” without saying which, they mean the circuit in FACTS. Never ask them to paste a circuit when FACTS contain one.\n\nFACTS:\n${facts}\n\nQuestion from the learner: ${question}`;
    turns.push({ role: 'user', content: framed });
    for (let i = turns.length - 2; i >= 0; i--) if (turns[i].role === turns[i + 1].role) turns.splice(i, 1);
    const res = await claudeFn(turns, { signal, modelTier: Store.get().aiTier || 'default', onText: onText ? ({ text }) => onText(text) : undefined, cache: false });
    return res.text;
  }
  async function ask(question, ctx = {}, opts = {}) {
    const p = provider(), persona = opts.persona || 'tutor';
    if (p === 'claude') { try { const text = await callClaude({ persona, question, ctx, history: opts.history, onText: opts.onText, signal: opts.signal }); return { text, source: 'claude' }; } catch (e) { if (e && (e.code === 'cancelled' || e.name === 'AbortError')) throw Object.assign(new Error('cancelled'), { name: 'AbortError' }); if (e && e.code === 'not_granted') { claudeDenied = true; emit(); } const L = local(question, ctx, persona); return Object.assign(L, { source: 'local', note: e && e.code === 'not_granted' ? 'Claude wasn’t allowed for this page, so the built-in tutor answered.' : `Claude didn’t answer (${(e && (e.code || e.message)) || 'error'}), so the built-in tutor answered.` }); } }
    if (p === 'server') { try { const text = await callServer({ persona, question, ctx, history: opts.history, onText: opts.onText, signal: opts.signal }); return { text, source: 'server' }; } catch (e) { if (e.name === 'AbortError') throw e; const L = local(question, ctx, persona); return Object.assign(L, { text: L.text, source: 'local', note: `The AI server didn’t answer (${e.message}), so the built-in tutor answered.` }); } }
    if (p === 'plugin') { try { const res = await LLM.provider(`${PERSONA[persona]}\n\nFACTS:\n${contextText(ctx)}\n\nQuestion: ${question}`, { signal: opts.signal, onText: opts.onText ? ({ text }) => opts.onText(text) : undefined }); return { text: res.text, source: 'plugin' }; } catch (e) { const L = local(question, ctx, persona); return Object.assign(L, { source: 'local' }); } }
    const L = local(question, ctx, persona); if (opts.onText) await typeOut(L.text, opts.onText, opts.signal); return Object.assign(L, { source: 'local' });
  }
  async function typeOut(text, onText, signal) { if (Motion && Motion.reduced) { onText(text); return; } const w = text.split(/(\s+)/); let t = ''; for (let i = 0; i < w.length; i += 3) { if (signal && signal.aborted) break; t += w.slice(i, i + 3).join(''); onText(t); await new Promise(r => setTimeout(r, 12)); } onText(text); }

  /* ---------------- the built-in tutor ---------------- */
  function local(question, ctx = {}, persona = 'tutor') {
    const q = String(question || '').trim(), lq = q.toLowerCase(), C = ctx.circuit, out = [], links = [];
    const has = re => re.test(lq);
    if (persona === 'feedback' && ctx.check) return { text: feedbackText(ctx.check, ctx.choice), links: ctx.check.see ? [ctx.check.see] : [] };
    if (persona === 'report' && ctx.report) return reportText(ctx.report);
    // lesson- and progress-aware requests
    const L = ctx.lesson, strip = t => String(t || '').replace(/\$\$?/g, '');
    if (L && has(/summar|recap|tl;?dr|main points/)) return { text: `**${L.title}** in short:\n\n` + L.summary.map(x => '• ' + x).join('\n\n') };
    if (L && has(/key idea|simpl|eli5|plain words|another way|intuition/) && !C) { const keys = L.blocks.filter(b => b.key).map(b => b.key); return { text: keys.length ? keys.map(k => k).join('\n\n') + (L.goals ? `\n\nBy the end you should be able to: ${L.goals.join('; ').toLowerCase()}.` : '') : L.summary.join(' ') }; }
    if (has(/quiz|test me|practi[cs]e question|ask me a question|question for me/)) {
      let pool = []; if (L) pool = L.blocks.filter(b => b.q && b.q.type !== 'build').map(b => b.q);
      if (!pool.length && typeof LEARN !== 'undefined') { const bkt = Store.get().bkt || {}; const weak = Object.keys(CONCEPT_NAMES).filter(k => k in bkt).sort((a, b) => bkt[a] - bkt[b])[0]; const c = weak && LEARN.concepts()[weak]; const lx = c ? LEARN.lesson(c.lesson) : LEARN.lesson(LEARN.lessons()[0].l.id); pool = lx.l.blocks.filter(b => b.q && b.q.type !== 'build').map(b => b.q); if (lx) links.push(lx.l.id); }
      const q2 = pool[Math.floor(Math.random() * pool.length)]; if (q2) return { text: `Here’s one on **${CONCEPT_NAMES[q2.concept] || q2.concept}**:\n\n${q2.q}${q2.choices ? '\n\n' + q2.choices.map((c, i) => `${'ABC'[i]}) ${c.t}`).join('\n') : ''}\n\nWork it out, then scroll to the matching check in the lesson to see if you’re right.`, links };
    }
    if (has(/study next|what next|how am i doing|my progress|where should i|weak|review/) && typeof Learn !== 'undefined') {
      const sum = Learn.progressSummary(), nl = Learn.nextLesson(); const weakLine = sum.split('\n').find(x => x.startsWith('Weakest')); const out2 = [];
      if (nl) { out2.push(`Your next unfinished lesson is **${nl.title}**.`); links.push(nl.id); }
      if (weakLine) { out2.push(weakLine.replace('Weakest concepts:', 'Your weakest concepts right now are') + ' Mastery is on a 0–1 scale.'); const m = weakLine.match(/lesson (\w\d)/); if (m) links.push(m[1]); }
      else out2.push('You haven’t answered enough checks for me to spot weak areas yet; do a lesson’s checks and I’ll track them.');
      out2.push(sum.split('\n').filter(x => x.startsWith('Module')).join(' '));
      return { text: out2.join('\n\n'), links };
    }
    if (!ctx.circuit && ctx.extra && has(/example|showing|widget|looking at|this (chart|plot|game)/)) return { text: `Here’s what the example shows right now: ${ctx.extra}\n\nChange a control and ask again, and I’ll explain the difference.` };
    const N = C ? (() => { try { return Insight.narrate(C); } catch (e) { return null; } })() : null;
    const D = C ? (() => { try { return Insight.diagnose(C); } catch (e) { return []; } })() : [];
    const fin = N && N.final;
    // task help: compare with the target
    if (C && ctx.target && has(/hint|stuck|help|next|how do i|what should|answer|solution/)) {
      const cmp = Insight.compare(C, ctx.target);
      if (cmp.match) return { text: 'Your circuit already produces the target state. Press Check to lock it in.' };
      const g = Insight.nextGateHint(C, ctx.target);
      if (has(/answer|solution|give up/) && ctx.solutionText) return { text: `One solution: ${ctx.solutionText}. Try building it, then ask me why it works.` };
      const diff = cmp.diffs[0];
      let t = diff ? `Right now q${diff.q} is ${diff.now}, but the target needs ${diff.want}.` : `Your state (${cmp.now.text}) isn’t the target (${cmp.want.text}) yet; the fidelity is ${cmp.fidelity.toFixed(2)}.`;
      if (g) t += g.g === 'CNOT' ? ` Try a CNOT with control q${g.c} and target q${g.q} next.` : ` Try adding ${g.g} on q${g.q} next.`;
      else t += ' No single gate gets closer; you may need to undo the last step.';
      return { text: t };
    }
    // mistakes and debugging
    if (C && has(/wrong|mistake|bug|error|fix|problem|doesn.?t work|issue|debug|check my/)) {
      if (!D.length) out.push('I don’t see any mistakes: no cancelling pairs, dead controls, gates after measurement or unreadable angles.');
      else out.push(...D.slice(0, 3).map(i => `${i.title}. ${i.detail}`));
      return { text: out.join('\n\n'), issues: D };
    }
    // explain the circuit / what happened
    if (C && N && has(/explain|what happen|walk me|step by step|what does (this|my) circuit|why did|what changed|narrat/)) {
      const steps = N.steps.filter(s => s.changed || s.label === 'Start').slice(-6);
      out.push(...steps.map(s => `${s.label}${s.gates.length ? ' · ' + s.gates.join(', ') : ''}: ${s.lines.join(' ')}`));
      out.push(`So the final state is ${fin.text}, which reads ${fin.outcomes.slice(0, 4).map(o => o.ket + ' ' + Insight.pct(o.p)).join(', ')}.`);
      return { text: out.join('\n\n') };
    }
    if (C && fin && has(/probab|odds|chance|outcome|histogram|result|measure.*(get|give)|what.*(read|get)/)) return { text: `The outcome odds are ${fin.outcomes.slice(0, 6).map(o => o.ket + ' ' + Insight.pct(o.p)).join(', ')}. They come from squaring the amplitudes of ${fin.text}.` };
    if (C && fin && has(/entangl/) && !has(/what is|define|meaning/)) { const pr = fin.qubits.filter(x => !x.pure); return { text: pr.length ? `Yes: ${pr.map(x => 'q' + x.q).join(', ')} ${pr.length > 1 ? 'are' : 'is'} entangled. Each has a Bloch vector shorter than 1 (length ${pr.map(x => x.len.toFixed(2)).join(', ')}), so none has a state of its own. The joint state is ${fin.text}.` : `No: every qubit has a full-length Bloch vector, so the state is a product of single-qubit states (${fin.qubits.map(x => 'q' + x.q + ' ' + x.name).join(', ')}).` }; }
    // definitions (also enriched by the current circuit)
    const hits = kbFind(lq);
    if (hits.length) {
      const e = hits[0]; out.push(e.a); if (e.see) links.push(e.see);
      if (fin && /superpos|entangl|phase|measur|probab/.test(e.t.toLowerCase())) out.push(`In your circuit right now: ${fin.qubits.map(x => `q${x.q} is ${x.pure ? x.name : 'entangled'}`).join(', ')}.`);
      return { text: out.join('\n\n'), links };
    }
    // lesson text search
    if (ctx.lessonText) { const words = lq.split(/\W+/).filter(w => w.length > 3); const paras = ctx.lessonText.split(/\n+/).filter(Boolean); let best = null, bs = 0; paras.forEach(p => { const pl = p.toLowerCase(); const sc = words.reduce((a, w) => a + (pl.includes(w) ? 1 : 0), 0); if (sc > bs) { bs = sc; best = p; } }); if (best && bs >= 1) return { text: `From this lesson: ${best.replace(/\$/g, '')}` }; }
    if (C && fin) return { text: `Here the state is ${fin.text} (${fin.outcomes.slice(0, 4).map(o => o.ket + ' ' + Insight.pct(o.p)).join(', ')}). ${D.length ? 'I also noticed: ' + D[0].title + '. ' : ''}You can ask me to explain it step by step, check it for mistakes, or what a gate or idea means.` };
    return { text: 'Ask me what an idea means (superposition, phase, entanglement, Grover…), to explain a circuit step by step, to check it for mistakes, or for a hint on the current task.' };
  }
  function feedbackText(check, choice) {
    const c = check.choices ? check.choices[choice] : null, right = check.choices ? check.choices.find(x => x.ok) : null;
    if (c && c.ok) return `Correct. ${c.why || check.why || ''}`.trim();
    const kb = kbFind((check.concept || '') + ' ' + (check.q || '')).find(Boolean);
    return [c && c.why ? c.why : 'Not quite.', right ? `The right answer is “${right.t}”${right.why ? ': ' + right.why : '.'}` : check.why || '', kb ? `Remember: ${kb.a.split('. ').slice(0, 2).join('. ')}.` : ''].filter(Boolean).join(' ');
  }
  function reportText(R) {
    const strong = R.concepts.filter(c => c.score >= .8).map(c => c.name), weak = R.concepts.filter(c => c.score < .6).sort((a, b) => a.score - b.score);
    const t = [`You scored ${Math.round(R.score * 100)}% (${R.correct} of ${R.total}).`];
    if (strong.length) t.push(`Strong: ${strong.join(', ')}.`);
    if (weak.length) t.push(`To work on: ${weak.slice(0, 2).map(c => `${c.name} (${Math.round(c.score * 100)}%)`).join(', ')}. Revisit ${weak.slice(0, 2).map(c => c.lessonTitle).filter(Boolean).join(' and ') || 'the matching lessons'}, then try the assessment again.`);
    else t.push(R.score >= .7 ? 'You are ready for the next module.' : 'Review the lessons once more and retry.');
    return { text: t.join(' '), links: weak.slice(0, 2).map(c => c.lesson).filter(Boolean) };
  }
  return { check, setMode, mode, provider, label, get claude() { return !!claudeFn && !claudeDenied; }, onChange, ask, local, contextText, circuitFacts, KB, kbFind, get server() { return Object.assign({}, server); } };
})();

/* ---------------- AIChat: the tutor panel used in lessons and the Laboratory ---------------- */
const AIChat = (() => {
  const LESSON_TITLE = id => (typeof LEARN !== 'undefined' && LEARN.lesson(id)) ? LEARN.lesson(id).l.title : id;
  function render(text) { const d = h('div', { class: 'ai-txt' }); d.innerHTML = String(text).split(/\n{2,}/).map(p => `<p>${p.split('\n').map(x => Tex.prose(x)).join('<br>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>`).join(''); return d; }
  function badge() { const b = h('span', { class: 'ai-prov' }); const paint = () => { const p = AI.provider(); b.className = 'ai-prov ' + p; b.textContent = p === 'local' ? 'Built-in tutor' : p === 'claude' ? 'Claude' : p === 'server' ? (AI.server.provider === 'claude' ? 'Claude API' : 'Gemini') : 'AI'; b.title = AI.label(); }; paint(); AI.onChange(paint); return b; }
  function mount(host, getCtx, { suggestions = [], placeholder = 'Ask the tutor…', greeting, compact } = {}) {
    const log = h('div', { class: 'ai-log', 'aria-live': 'polite' }), history = [];
    const inp = h('textarea', { class: 'ai-in', rows: 1, placeholder, 'aria-label': 'Ask the tutor' });
    const send = h('button', { type: 'button', class: 'ai-send', 'aria-label': 'Send' }, icon('arrow', 's'));
    const chips = h('div', { class: 'ai-chips' });
    let ctl = null;
    const paintChips = list => chips.replaceChildren(...list.map(s => h('button', { type: 'button', class: 'ai-chip', onclick: () => ask(s) }, s)));
    paintChips(suggestions);
    function bubble(role, text) { const b = h('div', { class: 'ai-msg ' + role }); if (role === 'user') b.append(h('div', { class: 'ai-txt' }, text)); else b.append(render(text)); log.append(b); log.scrollTop = log.scrollHeight; return b; }
    async function ask(q, extraCtx) {
      q = (q || inp.value).trim(); if (!q) return; inp.value = ''; inp.style.height = '';
      if (ctl) ctl.abort(); ctl = new AbortController();
      bubble('user', q); const b = h('div', { class: 'ai-msg bot pending' }, h('div', { class: 'ai-dots' }, h('i'), h('i'), h('i'))); log.append(b); log.scrollTop = log.scrollHeight;
      const ctx = Object.assign({}, getCtx ? getCtx() : {}, extraCtx || {});
      try {
        const res = await AI.ask(q, ctx, { history: history.slice(-6), signal: ctl.signal, onText: t => { b.classList.remove('pending'); b.replaceChildren(render(t)); log.scrollTop = log.scrollHeight; } });
        b.classList.remove('pending'); b.replaceChildren(render(res.text));
        if (res.note) b.append(h('p', { class: 'ai-note' }, res.note));
        const links = [...new Set(res.links || [])].filter(id => typeof LEARN !== 'undefined' && LEARN.lesson(id));
        if (links.length) b.append(h('div', { class: 'ai-links' }, links.map(id => h('a', { href: '#m-' + id, class: 'ai-link' }, icon('course', 's'), 'Lesson: ' + LESSON_TITLE(id)))));
        if (res.issues && res.issues.length && ctx.onIssue) b.append(h('div', { class: 'ai-links' }, res.issues.filter(i => i.fix).slice(0, 2).map(i => h('button', { type: 'button', class: 'ai-link', onclick: () => ctx.onIssue(i) }, icon('check', 's'), i.fix + ': ' + i.title))));
        history.push({ role: 'user', text: q }, { role: 'model', text: res.text });
        Store.attempt({ kind: 'ask', q: q.slice(0, 200), where: ctx.where || null, source: res.source });
      } catch (e) { if (e.name !== 'AbortError') { b.classList.remove('pending'); b.replaceChildren(render('Something went wrong: ' + e.message)); } }
      log.scrollTop = log.scrollHeight;
    }
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } });
    inp.addEventListener('input', () => { inp.style.height = 'auto'; inp.style.height = Math.min(120, inp.scrollHeight) + 'px'; });
    send.addEventListener('click', () => ask());
    const head = h('div', { class: 'ai-head' }, h('span', { class: 'ai-mark', 'aria-hidden': 'true' }, icon('tutor', 's')), h('b', {}, 'Tutor'), badge());
    const root = h('div', { class: 'ai-chat' + (compact ? ' compact' : '') }, head, log, chips, h('div', { class: 'ai-row' }, inp, send));
    host.replaceChildren(root);
    if (greeting) bubble('bot', greeting);
    AI.check();
    return { el: root, ask, say: t => bubble('bot', t), setSuggestions: paintChips, clear() { log.replaceChildren(); history.length = 0; } };
  }
  return { mount, render, badge };
})();
