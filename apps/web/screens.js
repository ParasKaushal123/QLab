/* =====================================================================
   PRACTICE · NOTEBOOK · CLASSROOM · LANDING
===================================================================== */
const CHALLENGES = [
  { id: 'flip', title: 'Flip it', level: 1, n: 1, goal: 'Turn |0⟩ into |1⟩ using only H and Z.', gates: ['H', 'Z'], spec: { answer: 'H0 Z0 H0', match: 'state' }, concept: 'phase' },
  { id: 'minus', title: 'Minus state', level: 1, n: 1, goal: 'Prepare |−⟩ = (|0⟩ − |1⟩)/√2.', gates: ['H', 'X', 'Z'], spec: { answer: 'X0 H0', match: 'state' }, concept: 'bases' },
  { id: 'plus-i', title: 'Point along +y', level: 1, n: 1, goal: 'Prepare |+i⟩ with H and S.', gates: ['H', 'S'], spec: { answer: 'H0 S0', match: 'state' }, concept: 'bases' },
  { id: 'quarter', title: 'One in four', level: 1, n: 1, goal: 'Read 1 with probability exactly 25%.', gates: ['RY'], spec: { answer: 'RY0(pi/3)', match: 'probs' }, concept: 'born-rule' },
  { id: 'bell', title: 'Bell pair', level: 1, n: 2, goal: 'Prepare (|00⟩ + |11⟩)/√2.', gates: ['H', 'X', 'CX'], spec: { answer: 'H0 CX0.1', match: 'state' }, concept: 'entanglement' },
  { id: 'psi-minus', title: 'The singlet', level: 2, n: 2, goal: 'Prepare (|01⟩ − |10⟩)/√2.', gates: ['H', 'X', 'Z', 'CX'], spec: { answer: 'H0 X1 Z0 CX0.1', match: 'state' }, concept: 'entanglement' },
  { id: 'ghz3', title: 'GHZ on three', level: 2, n: 3, goal: 'Prepare (|000⟩ + |111⟩)/√2.', gates: ['H', 'CX'], spec: { answer: 'H0 CX0.1 CX1.2', match: 'state' }, concept: 'entanglement' },
  { id: 'swap', title: 'SWAP from CNOTs', level: 2, n: 2, goal: 'Build SWAP using only CNOTs — it must match on every input.', gates: ['CX'], spec: { answer: 'SWAP0.1', match: 'unitary' }, concept: 'gates' },
  { id: 'cz', title: 'CZ from CX', level: 2, n: 2, goal: 'Build controlled-Z from H and CNOT.', gates: ['H', 'CX'], spec: { answer: 'CZ0.1', match: 'unitary' }, concept: 'gates' },
  { id: 'reverse', title: 'Reverse the CNOT', level: 2, n: 2, goal: 'Make a CNOT with q1 as control and q0 as target — using only H and CX(0→1).', gates: ['H', 'CX'], spec: { answer: 'CX1.0', match: 'unitary' }, concept: 'gates' },
  { id: 'x-from-hz', title: 'X in disguise', level: 1, n: 1, goal: 'Build X as a unitary from H and Z only.', gates: ['H', 'Z'], spec: { answer: 'X0', match: 'unitary', limit: 3 }, concept: 'gates' },
  { id: 'z-from-t', title: 'Z from T', level: 1, n: 1, goal: 'Build Z from T gates alone.', gates: ['T'], spec: { answer: 'Z0', match: 'unitary' }, concept: 'phase' },
  { id: 'sx', title: 'Square root of X', level: 2, n: 1, goal: 'Build √X (up to global phase) from H and S.', gates: ['H', 'S', 'T'], spec: { answer: 'SX0', match: 'unitary' }, concept: 'gates' },
  { id: 'uniform3', title: 'All eight', level: 1, n: 3, goal: 'Make all eight outcomes of three qubits equally likely.', gates: ['H', 'X', 'CX'], spec: { answer: 'H0 H1 H2', match: 'probs' }, concept: 'superposition' },
  { id: 'w3', title: 'The W state', level: 3, n: 3, goal: 'Equal odds of 001, 010 and 100 — and nothing else.', gates: ['RY', 'CRY', 'CX', 'X', 'CCX'], spec: { answer: 'RY0(1.9106332) CRY0.1(pi/2) CX1.0 X0 X1 CCX0.1.2 X0 X1', match: 'probs' }, concept: 'entanglement' },
  { id: 'toffoli', title: 'Toffoli by hand', level: 3, n: 3, goal: 'Build CCX from H, T, T† and CNOT — 15 gates or fewer.', gates: ['H', 'T', 'TDG', 'CX'], spec: { answer: 'CCX0.1.2', match: 'unitary', limit: 15 }, concept: 'gates' },
  { id: 'deutsch', title: 'Deutsch in one query', level: 2, n: 2, goal: 'The oracle CX(0→1) is balanced. Finish the circuit so q0 reads 1 every time (q1 starts in |1⟩).', gates: ['H', 'X', 'CX'], start: 'X1 H0 H1 CX0.1', spec: { answer: 'X1 H0 H1 CX0.1 H0 M0', match: 'probs' }, concept: 'oracles', reg: [0] },
  { id: 'grover2', title: 'Find 11', level: 2, n: 2, goal: 'Start from H on both qubits. Mark |11⟩ and amplify it to certainty with one Grover step.', gates: ['H', 'X', 'CZ'], start: 'H0 H1', spec: { match: 'peak', key: '11', min: .99 }, concept: 'grover' },
  { id: 'cs', title: 'Controlled-S', level: 3, n: 2, goal: 'Build controlled-S from T, T† and CNOT.', gates: ['T', 'TDG', 'CX'], spec: { answer: 'CP0.1(pi/2)', match: 'unitary' }, concept: 'gates' },
  { id: 'route', title: 'Distant CNOT', level: 3, n: 3, goal: 'CNOT from q0 to q2 on a line where only neighbours can talk.', gates: ['CX', 'SWAP'], spec: { answer: 'CX0.2', match: 'unitary', nn: true }, concept: 'compilation' },
  { id: 'mixed', title: 'Half an arrow', level: 3, n: 2, goal: 'Make q0’s Bloch arrow exactly 0.6 long by entangling it with q1.', gates: ['RY', 'CX', 'H'], spec: { match: 'blochlen', q: 0, len: .6, tol: .02 }, concept: 'entanglement' },
  { id: 'zero-z', title: 'Balanced expectation', level: 2, n: 1, goal: 'Make ⟨Z⟩ = 0 while ⟨X⟩ = −1.', gates: ['H', 'X', 'Z', 'RY'], spec: { answer: 'X0 H0', match: 'state' }, concept: 'bases' },
  { id: 'hf', title: 'Hartree–Fock', level: 2, n: 2, goal: 'Prepare the H₂ Hartree–Fock state: energy −1.1170 Ha at 0.735 Å.', gates: ['X', 'H', 'CX'], spec: { match: 'energy', R: .735, target: 'hf', tol: .002 }, concept: 'vqe' },
  { id: 'vqe', title: 'Ground state', level: 3, n: 2, goal: 'Reach the H₂ ground state, −1.1373 Ha, within 2 mHa.', gates: ['RY', 'CX', 'X'], spec: { match: 'energy', R: .735, tol: .002 }, concept: 'vqe' }];
const Practice = (() => {
  const lv = ['', 'Warm-up', 'Core', 'Stretch'], lvc = ['', 'b-cyan', 'b-lime', 'b-magenta'];
  const shortest = c => c.spec.answer ? Sim.expand(Grade.strip(Q.parse(c.n, c.spec.answer))).length : null;
  function target(c) { if (c.spec.answer) return Q.parse(c.n, c.spec.answer); return null; }
  function list(el) {
    let f = 'all'; const best = Store.get().best || {};
    App.top(['Practice'], [Ctl.words([{ value: 'all', label: 'All' }, { value: '1', label: 'Warm-up' }, { value: '2', label: 'Core' }, { value: '3', label: 'Stretch' }], f, v => { f = v; paint(); }, { label: 'Difficulty' })]);
    const grid = h('div', { class: 'ch-grid' });
    const next = CHALLENGES.filter(c => !best[c.id]).sort((a, b) => Knowledge.get(a.concept) - Knowledge.get(b.concept))[0];
    function paint() { grid.replaceChildren(...CHALLENGES.filter(c => f === 'all' || String(c.level) === f).map(c => { const t = target(c), a = h('a', { class: 'card ch-card', href: '#ch-' + c.id }), th = h('div', { class: 'ch-thumb' });
      if (t) { const s = Sim.run(Grade.strip(t)); if (c.n === 1) th.append(Mini.sphere(Sim.bloch(s, 0), 34)); else { const fs = svg('svg', { role: 'img', 'aria-label': 'Target amplitudes' }); Ink.field(fs, s, { per: Math.min(8, 1 << c.n), cell: 44, R: 16, n: c.n }); th.append(fs); } } else th.append(h('span', { class: 'big m' }, c.spec.match === 'energy' ? 'H₂' : '?'));
      a.append(th, h('h3', {}, c.title), h('p', { class: 'small' }, c.goal), h('div', { class: 'row' }, h('span', { class: 'badge ' + lvc[c.level] }, lv[c.level]), h('span', { class: 'badge b-ink' }, `${c.n} qubit${c.n > 1 ? 's' : ''}`), best[c.id] ? h('span', { class: 'badge b-violet' }, `best ${best[c.id]} gates${shortest(c) && best[c.id] <= shortest(c) ? ' · shortest known' : ''}`) : null)); return a; })); }
    el.replaceChildren(h('div', { class: 'page' }, h('header', { class: 'page-head row', style: { justifyContent: 'space-between', alignItems: 'flex-end' } }, h('div', {}, h('h1', { class: 'display' }, 'Practice'), h('p', { class: 'prose' }, `${CHALLENGES.length} circuit challenges graded by behaviour — what your circuit does on every input, not what it looks like.`)),
      next ? h('div', { class: 'card tint lilac next-ch' }, h('p', { class: 'lbl', style: { color: 'var(--ti)' } }, 'Next for you'), h('b', {}, next.title), h('a', { class: 'primary', href: '#ch-' + next.id }, 'Start', icon('arrow', 's'))) : null), grid)); paint();
  }
  function challenge(el, id) {
    const c = CHALLENGES.find(x => x.id === id); if (!c) { el.replaceChildren(h('div', { class: 'page' }, h('h1', { class: 'display' }, 'Challenge not found'))); return; }
    App.top(['Practice', c.title], [h('span', { class: 'badge ' + lvc[c.level] }, lv[c.level]), h('a', { class: 'pill', href: '#practice' }, icon('list', 's'), 'All challenges')]);
    el.replaceChildren(); const host = h('div', { style: { position: 'absolute', inset: '0' } }); el.append(host); const B = Board(host, { id: 'ch-' + c.id });
    const spec = Object.assign({ n: c.n, gates: c.gates }, c.spec), T = target(c);
    const tc = B.add('target', { x: 40, y: 40, w: 340, title: 'Target', icon: 'target', tint: 'lilac' });
    tc.body.append(h('p', { class: 'small', style: { color: 'var(--ti)' } }, c.goal));
    if (T) { const s = Sim.run(Grade.strip(T)); if (c.n === 1) tc.body.append(Mini.sphere(Sim.bloch(s, 0), 60)); else { const fs = svg('svg', { role: 'img', 'aria-label': 'Target amplitudes: disk area is probability, needle is phase' }); Ink.field(fs, s, { per: 4, cell: 70, R: 26, n: c.n }); tc.body.append(fs); } }
    if (c.spec.match === 'energy') tc.body.append(h('span', { class: 'big m' }, (c.spec.target === 'hf' ? Sim.h2(.735).Ehf : Sim.h2(.735).E0).toFixed(4)), h('p', { class: 'delta' }, 'Hartree'));
    const yc = B.add('mine', { x: 440, y: 40, w: 560, title: 'Your circuit', icon: 'lab', cls: 'big-card' });
    let C = c.start ? Q.parse(c.n, c.start) : { n: c.n, nc: c.n, ops: [], defs: {}, params: {} }; const sc = h('div'), pe = h('div', { class: 'ex-param' });
    yc.body.append(sc, pe);
    const S = Score(sc, { circ: C, editable: true, fixedQubits: true, maxQubits: c.n, minQubits: c.n, gates: c.gates, minCols: 8, onChange: cc => { C = cc; PE.paint(); }, onSelect: () => PE.paint() }); const PE = Course.paramEditor(pe, S, () => { });
    const rc = B.add('result', { x: 1110, y: 40, w: 360, title: 'Result', icon: 'check' }); rc.body.append(h('p', { class: 'small' }, 'Build, then press Check. The connector shows how close you are.'));
    B.link('target', 'mine', { label: 'build this' }); B.link('mine', 'result', { key: 'fid', label: 'not checked' });
    const check = () => { const r = Grade.check(S.circ, spec), gates = Sim.expand(Grade.strip(S.circ)).length, sh = shortest(c); B.remove('fail');
      Store.attempt({ concept: c.concept, ok: r.ok, kind: 'challenge', item: 'ch:' + c.id, sig: r.ok ? null : Q.text(S.circ) });
      if (r.ok) { const best = Object.assign({}, Store.get().best); const prev = best[c.id]; if (!prev || gates < prev) { best[c.id] = gates; Store.set('best', best); } Platform.publishBest && Platform.publishBest(c.id, gates);
        B.label('fid', `${c.spec.match === 'unitary' ? 'unitary' : 'fidelity'} ${r.score >= .9995 ? '0.999' : r.score.toFixed(3)} ✓`, 'good');
        rc.body.replaceChildren(h('div', { class: 'insight tint lime' }, h('span', { class: 'ins-ic' }, icon('check')), h('div', {}, h('b', {}, 'Solved'), h('p', {}, `${gates} gate${gates === 1 ? '' : 's'}${sh ? ` · shortest known ${sh}${gates <= sh ? ' — you matched it' : ''}` : ''}${prev ? ` · your previous best ${prev}` : ''}.`))), sh && T ? h('details', { class: 'reveal' }, h('summary', {}, 'Show the shortest known circuit'), (() => { const d = h('div'); Score(d, { circ: IR.clone(T), editable: false, compact: true, playhead: false }); return d; })()) : null); return; }
      B.label('fid', `${r.value != null ? 'value ' + (+r.value).toFixed(3) : 'fidelity ' + Math.max(0, r.score).toFixed(3)} ✕`, 'bad');
      rc.body.replaceChildren(h('div', { class: 'insight tint rose' }, h('span', { class: 'ins-ic' }, icon('x')), h('div', {}, h('b', {}, 'Not yet'), h('p', {}, r.why || 'The behaviour differs from the target.'))));
      const d = !r.why && T && Grade.diagnose(S.circ, spec);
      if (d && !d.phaseOnly) { const fc = B.add('fail', { x: 440, y: 420, w: 560, title: `First differing input · ${Sim.ket(parseInt(d.input, 2), c.n)}`, icon: 'eye', tint: 'rose' }); const mk = (s, t) => { const col = h('div', { class: 'fail-col' }, h('p', { class: 'lbl', style: { color: 'var(--ti)' } }, t)); const fs = svg('svg', { role: 'img', 'aria-label': t }); Ink.field(fs, s, { per: Math.min(4, 1 << c.n), cell: 56, R: 20, n: c.n }); col.append(fs); return col; };
        fc.body.append(h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '24px' } }, mk(d.mine, 'Yours'), mk(d.want, 'Target')), h('p', { class: 'small', style: { color: 'var(--ti)' } }, d.step != null && d.gates.length ? `Your circuit leaves the reference path at step ${d.step + 1} (${d.gates.map(g => Sim.displayName(g)).join(', ')}).` : 'The difference appears from the very first step.')); B.link('mine', 'fail', { label: `on ${Sim.ket(parseInt(d.input, 2), c.n)}`, cls: 'bad' }); if (d.gates && d.gates.length) S.select(d.gates.map(g => g.id)); }
      else if (d && d.phaseOnly) rc.body.append(h('p', { class: 'small' }, 'Every input lands on the right states, but the relative phases between inputs differ.')); };
    const tray = h('div', { class: 'typecase tray-case' }); TypeCase(tray, { groups: [c.gates], getScore: () => S });
    const chk = h('button', { type: 'button', class: 'primary' }, 'Check'); chk.addEventListener('click', check);
    Toolbar(host, [tray, '|', { icon: 'undo', title: 'Clear', on: () => { S.set(c.start ? Q.parse(c.n, c.start) : { n: c.n, nc: c.n, ops: [], defs: {}, params: {} }, true); C = S.circ; } }, chk, '|', ...zoomControls(B)]);
    return { destroy() { B.destroy(); } };
  }
  return { list, challenge };
})();

const Notebook = (() => {
  function render(el) {
    const S = Store.get(), A = S.attempts || [], D = Array.from({ length: 28 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (27 - i)); return d; });
    App.top(['Notebook'], [h('a', { class: 'pill', href: '#tests' }, icon('check', 's'), 'Verification')]);
    const concepts = [['state-vector', 'State vectors'], ['born-rule', 'Born rule'], ['bases', 'Bases'], ['phase', 'Phase'], ['bloch', 'Bloch sphere'], ['entanglement', 'Entanglement'], ['gates', 'Gates'], ['grover', 'Grover'], ['vqe', 'VQE'], ['compilation', 'Compilation']];
    const acc = D.map(d => { const a = A.filter(x => x.at >= +d && x.at < +d + 864e5); return a.length ? a.filter(x => x.ok).length / a.length : null; });
    const trendSv = svg('svg', { role: 'img', 'aria-label': 'Daily accuracy' }); const pts = acc.map((v, i) => v == null ? null : [i - 27, v * 100]).filter(Boolean); if (pts.length > 1) Ink.lines(trendSv, { series: [{ pts }], width: 380, height: 160, xlabel: 'days ago', ylabel: '% right' });
    const due = (S.notes || []).filter(n => n.task && n.due <= Date.now());
    const rev = h('div', { class: 'review' }); if (!due.length) rev.append(h('p', { class: 'small', style: { color: 'var(--ti)' } }, 'Nothing due. Kept field notes come back a day later, then at growing intervals.'));
    due.slice(0, 4).forEach(n => { const ans = h('p', { class: 'small', hidden: true }, n.text), acts = h('div', { class: 'row', hidden: true }, h('button', { type: 'button', class: 'btn', onclick: () => { Store.reviewed(n.id, true); item.remove(); } }, 'I had it'), h('button', { type: 'button', class: 'btn bare', onclick: () => { Store.reviewed(n.id, false); item.remove(); } }, 'I didn’t')); const item = h('div', { class: 'rev-item' }, h('b', {}, n.task.label), h('button', { type: 'button', class: 'btn bare', onclick: e => { e.currentTarget.remove(); ans.hidden = false; acts.hidden = false; } }, 'Reveal'), ans, acts); rev.append(item); });
    const rows = [...(S.notes || []).filter(n => n.circuit).map(n => ({ kind: 'Saved circuit', name: n.title, at: n.at, c: n.circuit, badge: `${n.circuit.n} qubits` })), ...(S.jobs || []).slice(0, 12).map(j => ({ kind: 'Run', name: j.name || 'Circuit', at: j.at, c: j.circuit, badge: j.backend + (j.note ? ' (mock)' : ''), top: j.top }))].sort((a, b) => (b.at > a.at ? 1 : -1)).slice(0, 14);
    el.replaceChildren(h('div', { class: 'page' }, h('header', { class: 'page-head' }, h('h1', { class: 'display' }, 'Notebook'), h('p', { class: 'prose' }, 'What you know, what you kept, and everything you ran.')),
      h('div', { class: 'grid2' },
        h('section', { class: 'card tint blue metric' }, h('div', { class: 'card-h' }, icon('chart'), h('h3', {}, 'Mastery by concept')), h('div', { class: 'mbars' }, concepts.map(([k, t]) => { const v = A.some(a => a.concept === k) ? Knowledge.get(k) : 0; return h('div', { class: 'mbar' }, h('span', {}, t), h('i', { style: { '--w': (v * 100).toFixed(1) + '%' } }), h('b', { class: 'mono' }, `${Math.round(v * 100)}%`)); }))),
        h('div', { class: 'stack' },
          h('section', { class: 'card tint lime metric' }, h('div', { class: 'card-h' }, icon('cal'), h('h3', {}, 'Last four weeks')), h('div', { class: 'cal' }, D.map((d, i) => { const n = A.filter(x => x.at >= +d && x.at < +d + 864e5).length; return h('i', { class: n ? (n > 8 ? 'l3' : n > 3 ? 'l2' : 'l1') : '', title: `${d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })}: ${n} answers` }); })), h('p', { class: 'small', style: { color: 'var(--ti)', marginTop: '10px' } }, `${A.length} answers in total · ${A.filter(a => a.ok).length} right`)),
          h('section', { class: 'card tint lilac metric' }, h('div', { class: 'card-h' }, icon('trend'), h('h3', {}, 'Accuracy trend')), pts.length > 1 ? trendSv : h('p', { class: 'small', style: { color: 'var(--ti)' } }, 'Answer on two different days to see a trend.')))),
      h('div', { class: 'grid2' },
        h('section', { class: 'card tint rose metric' }, h('div', { class: 'card-h' }, icon('history'), h('h3', {}, `Review · ${due.length} due`)), rev),
        h('section', { class: 'card' }, h('div', { class: 'card-h' }, icon('notebook'), h('h3', {}, 'Field notes')), h('div', { class: 'notes' }, (S.notes || []).filter(n => n.kind === 'field').slice(0, 8).map(n => h('div', { class: 'fn-row' }, h('b', {}, n.title), h('span', { class: 'small' }, n.text))), (S.notes || []).some(n => n.kind === 'field') ? null : h('p', { class: 'small' }, 'Keep a field note at the end of a lesson and it lands here.')))),
      h('section', { class: 'card' }, h('div', { class: 'card-h' }, icon('table'), h('h3', {}, 'Circuits and runs')), rows.length ? h('table', { class: 'tbl' }, h('tr', {}, h('th', {}, ''), h('th', {}, 'Name'), h('th', {}, 'Kind'), h('th', {}, 'Where'), h('th', {}, 'Top result'), h('th', {}, 'When'), h('th', {}, '')), ...rows.map(r => { const th = h('td', { class: 'tb-thumb' }); if (r.c) Mini.circuit(r.c, th); return h('tr', {}, th, h('td', {}, r.name), h('td', {}, r.kind), h('td', {}, h('span', { class: 'badge b-violet' }, r.badge)), h('td', { class: 'mono' }, r.top || '—'), h('td', {}, fmt.date(r.at)), h('td', {}, r.c ? h('a', { class: 'btn', href: '#lab', onclick: () => Lab.load(Object.assign({}, r.c, { name: r.name })) }, 'Open') : null)); })) : h('p', { class: 'small' }, 'Save a circuit with ⌘S or run one in the Laboratory and it appears here.'))));
  }
  return { render };
})();

const Classroom = (() => {
  async function render(el) {
    App.top(['Classroom']);
    const P = Platform; el.replaceChildren(h('div', { class: 'page' }, h('p', { class: 'small' }, 'Loading the class…')));
    await P.ready;
    if (!P.db || !P.id) { el.replaceChildren(h('div', { class: 'page' }, h('div', { class: 'empty big-empty card' }, h('h1', { class: 'empty-h' }, 'Teach with a ', h('span', { class: 'squig' }, 'live'), ' class'), h('p', { class: 'prose' }, 'Classes need you signed in on the published page: instructors see every student’s mastery, common mistakes and a live prediction overlay; students join with a code.'), h('p', { class: 'small' }, 'This view can’t reach the class store right now.')))); return; }
    const classes = await P.listClasses(), mine = classes.filter(c => c.owner === P.id), joined = P.joined();
    const code = h('input', { class: 'uline mono', placeholder: 'Join code, e.g. QX7-42', 'aria-label': 'Join code', style: { width: '200px' } });
    const join = h('button', { type: 'button', class: 'btn', onclick: async () => { const c = classes.find(x => x.code.toLowerCase() === code.value.trim().toLowerCase()); if (!c) { toast('No class with that code.'); return; } await P.join(c.code); toast(`Joined ${c.name}.`); render(el); } }, 'Join');
    const nm = h('input', { class: 'uline', placeholder: 'New class name', 'aria-label': 'New class name', style: { width: '220px' } });
    const create = P.canEdit ? h('button', { type: 'button', class: 'btn', onclick: async () => { if (!nm.value.trim()) return; await P.createClass(nm.value.trim()); render(el); App.sidebar(); } }, 'Create class') : null;
    const head = h('header', { class: 'page-head row', style: { justifyContent: 'space-between', alignItems: 'flex-end' } }, h('div', {}, h('h1', { class: 'display' }, 'Classroom'), h('p', { class: 'prose' }, P.canEdit ? 'Your cohort at a glance, the mistakes they share, and a live prediction overlay.' : 'Join a class to see its assignments and take part in live sessions.')), h('div', { class: 'row' }, code, join, P.canEdit ? nm : null, create));
    if (!P.canEdit) { el.replaceChildren(h('div', { class: 'page' }, head, h('div', { class: 'grid2' }, ...joined.map(k => { const c = classes.find(x => x.code === k); return c ? h('section', { class: 'card tint lilac' }, h('div', { class: 'card-h' }, icon('classroom'), h('h3', {}, c.name)), h('p', { class: 'small', style: { color: 'var(--ti)' } }, (c.assign || []).length ? (c.assign || []).map(a => `${a.title} — due ${fmt.date(a.due)}`).join(' · ') : 'No assignments yet.')) : null; }), joined.length ? null : h('p', { class: 'small' }, 'You haven’t joined a class yet.')))); return; }
    const students = await P.cohort(), cls = mine[0];
    const concepts = ['state-vector', 'born-rule', 'bases', 'phase', 'bloch', 'entanglement'], names = await P.names(students.map(s => s.id));
    const avg = students.length ? students.reduce((a, s) => a + concepts.reduce((b, k) => b + ((s.bkt || {})[k] ?? .2), 0) / concepts.length, 0) / students.length : 0;
    const peers = P.room ? P.room.peers().length : 0;
    const heat = h('div', { class: 'heat', style: { gridTemplateColumns: `140px repeat(${concepts.length}, 1fr)` } }, h('span'), ...concepts.map(k => h('span', { class: 'lbl' }, k)), ...students.flatMap(s => [h('span', { class: 'small' }, names[s.id] || 'Student'), ...concepts.map(k => { const v = (s.bkt || {})[k] ?? .2; return h('i', { style: { background: `color-mix(in oklab, var(--t-blue-i) ${Math.round(v * 90)}%, var(--t-blue))` }, title: `${Math.round(v * 100)}%` }); })]));
    const wrong = {}; students.forEach(s => (s.wrong || []).forEach(w => { const k = w.item + '|' + w.sig; wrong[k] = wrong[k] || { item: w.item, sig: w.sig, n: 0 }; wrong[k].n++; }));
    const clusters = Object.values(wrong).sort((a, b) => b.n - a.n).slice(0, 6);
    const live = h('button', { type: 'button', class: 'primary', onclick: () => goLive() }, icon('live', 's'), 'Go live');
    el.replaceChildren(h('div', { class: 'page' }, head,
      h('div', { class: 'grid4' }, [['Students', students.length, 'blue'], ['Average mastery', fmt.p(avg, 0), 'lime'], ['Assignments due', (cls?.assign || []).filter(a => new Date(a.due) > new Date()).length, 'rose'], ['Live now', peers, 'lilac']].map(([t, v, tint]) => h('section', { class: 'card tint ' + tint }, h('p', { class: 'lbl', style: { color: 'var(--ti)' } }, t), h('span', { class: 'big' }, String(v))))),
      h('div', { class: 'row', style: { margin: '8px 0 20px' } }, live, h('button', { type: 'button', class: 'btn', onclick: () => { const rows = [['student', ...concepts, 'answers', 'right']].concat(students.map(s => [names[s.id] || s.id, ...concepts.map(k => ((s.bkt || {})[k] ?? .2).toFixed(2)), s.n || 0, s.right || 0])); saveFile('class-grades.csv', rows.map(r => r.join(',')).join('\n'), 'text/csv'); } }, icon('download', 's'), 'Export CSV'), cls ? h('span', { class: 'badge b-violet' }, `Join code ${cls.code}`) : h('span', { class: 'small' }, 'Create a class to get a join code.')),
      h('section', { class: 'card' }, h('div', { class: 'card-h' }, icon('grid'), h('h3', {}, 'Cohort by concept')), students.length ? heat : h('p', { class: 'small' }, 'Students appear here once they join with your code and answer a few questions.')),
      h('section', { class: 'card', style: { marginTop: '16px' } }, h('div', { class: 'card-h' }, icon('eye'), h('h3', {}, 'Common mistakes')), clusters.length ? h('div', { class: 'grid3' }, clusters.map(k => { const [src, idx] = k.item.split(':'), ch = CHALLENGES.find(c => c.id === idx), n = ch ? ch.n : 1; const d = h('div', { class: 'card mistake' }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, ch ? ch.title : k.item), h('span', { class: 'badge b-magenta' }, `${k.n} student${k.n > 1 ? 's' : ''}`))); try { Mini.circuit(Q.parse(n, k.sig), d); } catch (e) { } d.append(h('a', { class: 'btn', href: '#lab', onclick: () => { try { Lab.load(Object.assign(Q.parse(n, k.sig), { name: 'Common mistake' })); } catch (e) { } } }, 'Replay')); return d; })) : h('p', { class: 'small' }, 'Wrong circuits cluster here by what they actually do.')),
      h('section', { class: 'card', style: { marginTop: '16px' } }, h('div', { class: 'card-h' }, icon('cal'), h('h3', {}, 'Assignments')), cls ? assignForm(cls) : h('p', { class: 'small' }, 'Create a class first.'), h('div', { class: 'kv', style: { marginTop: '12px' } }, ...(cls?.assign || []).map(a => h('div', {}, h('span', {}, a.title), h('b', {}, fmt.date(a.due))))))));
    function assignForm(c) { const opts = COURSE.chapters[2].lessons.map(l => ({ value: l.id, label: `2.${l.n} ${l.title}` })).concat([{ value: 'exam-2', label: 'Chapter 2 exam' }], CHALLENGES.map(x => ({ value: 'ch-' + x.id, label: `Challenge · ${x.title}` }))); let v = opts[0].value; const m = Ctl.menu({ label: 'Assign', options: opts, value: v, onChange: x => v = x }); const due = h('input', { type: 'date', class: 'uline', 'aria-label': 'Due date' }); return h('div', { class: 'row' }, m, due, h('button', { type: 'button', class: 'btn', onclick: async () => { if (!due.value) { toast('Pick a due date.'); return; } await P.assign(c, { id: v, title: opts.find(o => o.value === v).label, due: due.value }); render(el); } }, 'Assign')); }
    async function goLive() {
      const circ = 'H0 T0 H0'; await P.setLive({ on: true, circuit: circ, q: 'Shape the odds for H, T, H.', at: Date.now() });
      const agg = { n: 0, sum: { '0': 0, '1': 0 } }, card = h('section', { class: 'card tint blue live-card' }, h('div', { class: 'card-h' }, icon('live'), h('h3', {}, 'Live · H, T, H'), h('button', { type: 'button', class: 'btn', onclick: async () => { await P.setLive({ on: false }); card.remove(); } }, 'End')), h('div', { class: 'live-body' }));
      el.querySelector('.page').insertBefore(card, el.querySelector('.page').children[2]);
      const paint = reveal => { const b = card.querySelector('.live-body'); const avgP = agg.n ? { '0': agg.sum['0'] / agg.n, '1': agg.sum['1'] / agg.n } : { '0': 0, '1': 0 }; b.replaceChildren(h('p', { class: 'small', style: { color: 'var(--ti)' } }, `${agg.n} prediction${agg.n === 1 ? '' : 's'} in`), Mini.hist(avgP, ['0', '1'], { w: 260, hgt: 110 }), reveal ? h('p', { class: 'delta' }, `Actual: |0⟩ ${fmt.p(Grade.exactDist(Q.parse(1, circ))['0'], 1)}`) : h('button', { type: 'button', class: 'btn', onclick: () => paint(true) }, 'Reveal the real result')); };
      P.onPredict(v => { agg.n++; agg.sum['0'] += v['0'] || 0; agg.sum['1'] += v['1'] || 0; paint(false); }); paint(false);
    }
  }
  return { render };
})();

const Landing = (() => {
  function render(el) {
    const frame = h('div', { class: 'l-frame' });
    el.replaceChildren(h('div', { class: 'landing' },
      h('nav', { class: 'l-nav', 'aria-label': 'Main' }, h('a', { class: 'l-brand', href: '#landing' }, h('span', { class: 'mark' }, '◉'), 'QUBIQ'), h('div', { class: 'l-links' }, h('a', { href: '#lab' }, 'Product'), h('a', { href: '#learn' }, 'Learn'), h('a', { href: '#algorithms' }, 'Algorithms'), h('a', { href: '#classroom' }, 'For schools')), h('a', { class: 'l-login', href: '#home', onclick: () => Store.get().profile || Store.set('profile', { arrived: new Date().toISOString() }) }, 'Log in'), h('a', { class: 'primary', href: '#arrival' }, 'Start learning')),
      h('header', { class: 'l-hero' }, h('h1', {}, 'Learn quantum by ', h('span', { class: 'squig' }, 'building'), ' it'), h('p', {}, 'Drag gates onto real circuits, watch every qubit respond, and let Qubit — your tutor — point at exactly what changed. From your first superposition to Shor, VQE and QAOA.'), h('div', { class: 'row', style: { justifyContent: 'center' } }, h('a', { class: 'primary', href: '#arrival' }, 'Start learning', icon('arrow', 's')), h('a', { class: 'btn', href: '#lab' }, 'Open the Laboratory'))),
      frame,
      h('section', { class: 'l-feats', 'aria-label': 'What QUBIQ gives you' }, [
        ['course', 'Four structured modules', 'Qubits, gates, entanglement and algorithms: theory, worked maths and examples you can touch, 19 lessons in all.', '#learn'],
        ['lab', 'A real circuit laboratory', 'Drag gates onto wires, see the state change on every edit, and read the same circuit as Qiskit, Cirq, PennyLane or QASM.', '#lab'],
        ['tutor', 'An AI tutor that can see your work', 'It explains your circuit step by step, catches mistakes as you make them, and gives hints instead of answers.', '#learn'],
        ['chart', 'Progress you can trust', 'Checks and module assessments feed a mastery score per concept, so you always know what to study next.', '#progress']
      ].map(([ic, t, d, href]) => h('a', { class: 'l-feat', href }, h('span', { class: 'l-fi' }, icon(ic)), h('b', {}, t), h('p', {}, d))))));
    // a live product frame: the Laboratory in miniature
    const inner = h('div', { class: 'lf-canvas' }); frame.append(h('div', { class: 'lf-bar' }, h('i'), h('i'), h('i'), h('span', { class: 'lbl' }, 'Laboratory / Bell pair')), inner);
    const C = Templates.bell(); const cc = h('div', { class: 'lf-card lf-circ' }, h('p', { class: 'lf-h' }, icon('lab', 's'), 'Bell pair', h('span', { class: 'badge b-violet' }, '2 qubits'))); const sc = h('div'); cc.append(sc); Score(sc, { circ: C, editable: false, playhead: false, minCols: 4 });
    const s = Sim.run(Grade.strip(C)); const sp = h('div', { class: 'lf-card lf-sph' }, h('p', { class: 'lf-h' }, icon('sphere', 's'), 'Bloch spheres'), h('div', { class: 'row' }, Mini.sphere(Sim.bloch(s, 0), 34), Mini.sphere(Sim.bloch(s, 1), 34)), h('p', { class: 'lbl' }, 'arrows shrink: the qubits are entangled'));
    const hs = h('div', { class: 'lf-card tint blue lf-hist' }, h('p', { class: 'lf-h', style: { color: 'var(--ti)' } }, icon('chart', 's'), 'Results'), h('div', { class: 'row', style: { alignItems: 'baseline' } }, h('b', { class: 'big m' }, '50.2%'), h('span', { class: 'delta' }, 'P(00)')), Mini.hist({ '00': .502, '01': 0, '10': 0, '11': .498 }, ['00', '01', '10', '11'], { w: 200, hgt: 70 }));
    const cur = h('div', { class: 'lf-cursor', 'aria-hidden': 'true' }, (() => { const s2 = svg('svg', { width: 22, height: 24, viewBox: '0 0 22 24' }); svg('path', { d: 'M2 2 L19 12 L11 13.5 L7.5 21 Z', fill: '#592EFF', stroke: '#fff', 'stroke-width': 1.6 }, s2); return s2; })(), h('span', { class: 'nm' }, 'QUBIT'), h('div', { class: 'speech' }, 'The CNOT copies q0’s branch into q1 — now they always agree.'));
    const cur2 = h('div', { class: 'lf-cursor c2', 'aria-hidden': 'true' }, (() => { const s2 = svg('svg', { width: 22, height: 24, viewBox: '0 0 22 24' }); svg('path', { d: 'M2 2 L19 12 L11 13.5 L7.5 21 Z', fill: '#F843C2', stroke: '#fff', 'stroke-width': 1.6 }, s2); return s2; })(), h('span', { class: 'nm', style: { background: '#FFAAE6' } }, 'SOFIA'));
    inner.append(h('span', { class: 'lf-lk l1' }, 'final state'), h('span', { class: 'lf-lk l2' }, '1,000 shots'), cc, sp, hs, cur, cur2);
  }
  return { render };
})();
