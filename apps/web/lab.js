/* =====================================================================
   LABORATORY — composer + IDE. The margin is the tutor's margin.
   SEE: every qubit, the score in time, code beneath, the chosen layers.
   MANIPULATE: drag gates; rewire; lasso into blocks; parametrise & sweep;
     optimise; transpile to a chip; run on several backends at once.
   DISCOVER: the state is a story in time; ideal and noisy results share bins.
===================================================================== */
const Lab = (() => {
  let C, score, views, tcase, tutor, code, lang = 'qiskit', panel = 'missions', results = {}, active = new Set(['browser']), shots = 1000, seed = '', noiseOn = false;
  let noise = { p1: .001, p2: .01, t1: 120, t2: 90, readout: .02 }, hist = [], hpos = -1, root, E = {}, mounted = false, optPreview = null, device = 'heavyhex', routedView = null, sweep = null;
  const clone = c => JSON.parse(JSON.stringify(c));
  function snapshot(label) { hist = hist.slice(0, hpos + 1); hist.push({ c: clone(C), label, at: Date.now() }); if (hist.length > 120) hist.shift(); hpos = hist.length - 1; }
  function restore(i) { if (i < 0 || i >= hist.length) return; hpos = i; C = IR.clone(hist[i].c); score.set(C); refresh(false); announce(`History: ${hist[i].label}`); }
  function changed(c, label, fresh) { C = c; if (!fresh) Object.values(results).forEach(r => r.stale = true); snapshot(label || 'Edit'); refresh(); if (label) announce(label); persist(); }
  function persist() { Store.set('lab', clone(C)); }
  function load(c, label = 'Loaded') { C = IR.clone(c); C.defs = C.defs || {}; C.params = C.params || {}; C.nc = C.nc ?? C.n; results = {}; if (mounted) { score.set(C, true); snapshot(label); refresh(); persist(); } }
  /* ---------------- layout: the Lab is a canvas of cards ---------------- */
  let B, qc, SV = new Map(), pills = [], drawer = { code: false, insp: false };
  const VIEW_POS = { spheres: [860, 40, 430], field: [600, 460, 400], hist: [40, 460, 520], table: [1040, 460, 400], qsphere: [860, 820, 360], density: [40, 880, 420], unitary: [480, 880, 380], observables: [1240, 820, 380] };
  const VIEW_ICON = { spheres: 'sphere', field: 'grid', hist: 'chart', table: 'table', qsphere: 'sphere', density: 'layers', unitary: 'grid', observables: 'gauge' };
  function layout(el) {
    root = h('div', { class: 'lab', style: { position: 'absolute', inset: '0' } }); el.replaceChildren(root);
    B = Board(root, { id: 'lab' });
    const cc = B.add('circuit', { x: 40, y: 40, w: 780, icon: 'lab', cls: 'big-card circuit-card', title: 'Circuit', menu: [['Add a state view', () => addViewPop()], ['Save to Notebook (⌘S)', save], ['Import code', () => openImport()], ['Tidy the canvas', () => B.relayout()]] });
    cc.head.querySelector('h3').replaceWith(h('div', { class: 'cc-title' }, h('label', { class: 'sr', for: 'lab-name' }, 'Circuit name'), E.name = h('input', { id: 'lab-name', class: 'lab-name', autocomplete: 'off', spellcheck: 'false' }), E.badges = h('span', { class: 'row' })));
    cc.body.append(E.scoreHost = h('div'), E.lint = h('div', { class: 'lint', 'aria-live': 'polite' }), E.tplMsg = h('p', { class: 'small', 'aria-live': 'polite' }));
    E.metrics = h('div', { class: 'corner-pill', style: { left: '16px', top: '14px' }, 'aria-live': 'polite' }); root.append(E.metrics);
    (Store.get().labCards || ['spheres', 'field', 'hist', 'table']).forEach(k => addView(k, true));
    // code drawer
    E.codeSec = h('section', { class: 'drawer code-drawer', 'aria-label': 'Code', hidden: true },
      h('div', { class: 'dr-h' }, icon('code'), h('h3', {}, 'Code'), E.langs = h('div'), h('span', { class: 'grow' }), h('button', { type: 'button', class: 'btn bare', onclick: () => copyText(E.code.value, 'Code copied.') }, icon('copy', 's'), 'Copy'), h('button', { type: 'button', class: 'btn bare', onclick: () => openImport() }, icon('import', 's'), 'Import'), h('button', { type: 'button', class: 'btn bare', 'aria-label': 'Close code', onclick: () => toggle('code', false) }, icon('x'))),
      h('div', { class: 'codebox', id: 'lab-codebox' }, E.gut = h('div', { class: 'gut', 'aria-hidden': 'true' }), E.hl = h('pre', { 'aria-hidden': 'true' }), h('label', { class: 'sr', for: 'lab-code' }, 'Circuit code'), E.code = h('textarea', { id: 'lab-code', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', wrap: 'off' })),
      E.codeMsg = h('p', { class: 'codemsg', 'aria-live': 'polite' }));
    // inspector
    E.insp = h('aside', { class: 'drawer insp', 'aria-label': 'Inspector', hidden: true }, h('div', { class: 'dr-h' }, icon('panel'), h('h3', {}, 'Inspector'), h('span', { class: 'grow' }), h('button', { type: 'button', class: 'btn bare', 'aria-label': 'Close inspector', onclick: () => toggle('insp', false) }, icon('x'))), E.panelWords = h('div'), E.panel = h('div', { class: 'panel' }));
    E.ask = h('div', { class: 'lab-ask' }, E.tutorHost = h('div'));
    root.append(E.codeSec, E.insp, E.ask);
    // floating toolbar: tools · gate tray · more · template search · undo/redo · zoom
    E.case = h('div', { class: 'typecase tray-case', role: 'toolbar', 'aria-label': 'Gates' });
    E.tpl = h('input', { id: 'lab-tpl', class: 'uline mono', placeholder: '/ ghz 5', autocomplete: 'off', spellcheck: 'false', list: 'lab-tpl-list', 'aria-label': 'Type a template: bell, ghz 5, qft 4, grover 101, qaoa 5 p=2' });
    const more = h('button', { type: 'button', class: 'tb', 'aria-haspopup': 'true', title: 'All gates' }, 'More gates', icon('up', 's')); more.addEventListener('click', () => morePop(more));
    const tools = [{ icon: 'select', title: 'Select', pressed: true, on: b => setTool('select', b) }, { icon: 'pan', title: 'Pan (or hold Space)', pressed: false, on: b => setTool('pan', b) }, { icon: 'comment', title: 'Ask Qubit about this circuit', on: () => { E.ask.classList.add('open'); tutor && tutor.input.focus(); } }];
    Toolbar(root, [...tools, '|', E.case, more, '|', E.tpl, h('datalist', { id: 'lab-tpl-list' }, Templates.LIST.map(t => h('option', { value: t.label }, t.hint))), '|', { icon: 'undo', title: 'Undo (⌘Z)', on: () => restore(hpos - 1) }, { icon: 'redo', title: 'Redo (⌘⇧Z)', on: () => restore(hpos + 1) }, { icon: 'panel', title: 'Inspector', on: () => toggle('insp') }, '|', ...zoomControls(B)]);
    function setTool(t, b) { B.tool = t; b.parentNode.querySelectorAll('.tb[aria-pressed]').forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); }
    qc = Cursor(B, { name: 'Qubit' });
  }
  function addView(k, quiet) {
    if (B.cards.has(k)) { B.focusCard(k); return; }
    const [x, y, w] = VIEW_POS[k] || [200, 900, 380], title = k === 'hist' ? 'Results' : (VIEW_NAMES.find(v => v[0] === k) || [k, k])[1];
    const c = B.add(k, { x, y, w, title, icon: VIEW_ICON[k], menu: [['Remove this card', () => { B.remove(k); SV.delete(k); saveCards(); }]] });
    if (k === 'hist') { c.body.append(h('div', { class: 'res-top' }, E.big = h('div', { class: 'res-big' }), E.ring = h('span', { class: 'res-ring', hidden: true })), E.runline = h('div', { class: 'runline' }), E.hist = h('div', { class: 'scroll-x' }), E.legend = h('div', { class: 'legend', 'aria-live': 'polite' }), E.compare = h('p', { class: 'small' }), E.runNote = h('p', { class: 'small', 'aria-live': 'polite' })); new ResizeObserver(() => drawHist()).observe(c.el); }
    else { c.body.classList.add('solo'); SV.set(k, StageViews(c.body, { get: () => ({ circ: C, upto: score ? score.playhead : Infinity }), initial: [k], noise: () => noiseOn ? noise : null })); }
    B.link('circuit', k, { label: '', key: k });
    if (!quiet) { saveCards(); refresh(); B.focusCard(k); }
  }
  const saveCards = () => Store.set('labCards', [...B.cards.keys()].filter(k => k !== 'circuit' && k !== 'chip' && k !== 'opt'));
  function addViewPop() { const opts = [['hist', 'Results'], ...VIEW_NAMES.filter(v => v[0] !== 'histogram')].filter(([k]) => !B.cards.has(k)); B.menuPop(B.cards.get('circuit').head.querySelector('.more'), opts.length ? opts.map(([k, l]) => [l, () => addView(k)]) : [['Every view is already on the canvas', () => { }]]); }
  function morePop(anchor) {
    const old = root.querySelector('.gates-pop'); if (old) { old.remove(); return; }
    const titles = ['Paulis and Hadamard', 'Phase', 'Rotations', 'Controlled', 'Swaps and multi-control', 'Two-qubit rotations', 'Measure, reset and tools'];
    const p = h('div', { class: 'pop gates-pop', role: 'dialog', 'aria-label': 'All gates' }); GATESET.full.forEach((g, i) => { const sec = h('div', { class: 'case-sect' }, h('p', { class: 'lbl' }, titles[i]), h('div')); p.append(sec); TypeCase(sec.lastChild, { groups: [g], getScore: () => score }); });
    root.append(p); const off = e => { if (!p.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) { p.remove(); removeEventListener('pointerdown', off, true); } }; setTimeout(() => addEventListener('pointerdown', off, true));
  }
  function toggle(which, on) { drawer[which] = on ?? !drawer[which]; (which === 'code' ? E.codeSec : E.insp).hidden = !drawer[which]; root.classList.toggle(which + '-open', drawer[which]); if (which === 'code' && drawer.code) renderCode(true); pills.forEach(p => p.dataset.drawer === which && p.setAttribute('aria-pressed', String(drawer[which]))); }
  function openPanel(p) { panel = p; toggle('insp', true); renderPanel(); }
  function labelLinks() { if (!B) return; const ph = score ? score.playhead : Infinity, step = ph === Infinity ? 'final state' : `after step ${ph}`; SV.forEach((_, k) => B.label(k, step)); const r = results[[...active][0]] || Object.values(results)[0]; B.label('hist', r ? `${fmt.n(r.shots || shots)} shots${r.stale ? ' · stale' : ''}` : 'Run ⌘↵'); }
  /* ---------------- refresh ---------------- */
  function refresh(anim = true) {
    if (document.activeElement !== E.name) E.name.value = C.name || 'Untitled circuit';
    const m = Passes.metrics(C); paintMetrics(m);
    E.badges.replaceChildren(h('span', { class: 'badge b-violet' }, `${C.n} qubit${C.n > 1 ? 's' : ''}`), h('span', { class: 'badge b-ink' }, `depth ${m.depth}`), ...(noiseOn ? [h('span', { class: 'badge b-magenta' }, 'noisy')] : []));
    renderCode(); views.render(); drawHist(); renderLint(); renderPanel(); labelLinks();
  }
  function paintMetrics(m) { E.metrics.replaceChildren(...[['width', m.width], ['depth', m.depth], ['gates', m.gates], ['CX', m.cx], ['T', m.tcount == null ? '–' : m.tcount]].flatMap(([k, v], i) => [i ? h('span', { class: 'sep' }, '·') : null, h('span', {}, k, ' ', h('b', {}, String(v)))]).filter(Boolean)); }
  /* ---------------- code ---------------- */
  let codeMap = [], codeTimer;
  function renderCode(force) {
    const g = Code.gen(lang, C); codeMap = g.map;
    if (force || document.activeElement !== E.code) { E.code.value = g.text; E.codeMsg.className = 'codemsg'; E.codeMsg.textContent = 'Edit any line; valid code redraws the score. Loops and functions need a server backend.'; }
    paintCode();
  }
  function paintCode() { E.hl.innerHTML = Code.highlight ? Code.highlight(E.code.value) : esc(E.code.value); E.gut.textContent = E.code.value.split('\n').map((_, i) => i + 1).join('\n'); linkLines(); }
  function linkLines(id) { const ph = score ? score.playhead : Infinity; $$('.cl', E.hl).forEach((l, i) => { const oid = codeMap[i], op = oid && C.ops.find(o => o.id === oid); l.classList.toggle('ran', !!op && op.col < ph); l.classList.toggle('lit', !!oid && (oid === id || score.selection.includes(oid))); }); }
  function onCodeInput() {
    paintCode(); clearTimeout(codeTimer);
    codeTimer = setTimeout(() => {
      const r = Code.parse(lang, E.code.value);
      $$('.cl', E.hl).forEach(l => l.classList.toggle('bad', r.errors.some(x => x.ln === +l.dataset.ln)));
      if (r.errors.length) { E.codeMsg.className = 'codemsg err'; E.codeMsg.textContent = r.errors[0].msg + (r.errors.length > 1 ? ` (+${r.errors.length - 1} more)` : ''); if (tutor) tutor.speak(`Line ${r.errors[0].ln}: ${r.errors[0].msg.replace(/^Line \d+:?\s*/, '')}`); return; }
      if (r.n > 12) { E.codeMsg.className = 'codemsg'; E.codeMsg.textContent = `${r.n} qubits: the score draws it; run it on the Stabiliser backend if it’s Clifford.`; }
      const next = { n: r.n, nc: r.nc, name: C.name, params: C.params, defs: {}, ops: r.ops.map(o => IR.op(o.g, o.q, Object.assign({}, o, { col: 0 }))) };
      next.ops = Passes.asap(next.ops, next.n).map(o => Object.assign(next.ops.find(x => x.id === o.id), { col: o.col }));
      C = next; score.set(C); Object.values(results).forEach(x => x.stale = true); snapshot('Code edit'); E.codeMsg.className = 'codemsg'; E.codeMsg.textContent = 'In sync with the score.';
      const g = Code.gen(lang, C); codeMap = g.map; views.render(); drawHist(); renderLint(); renderPanel(); persist(); linkLines();
    }, 380);
  }
  /* ---------------- run & results ---------------- */
  async function run() {
    if (E.run.disabled) return; E.run.disabled = true; E.run.replaceChildren(h('span', { class: 'spin', 'aria-hidden': 'true' }), 'Running…'); E.runline.classList.add('on'); E.ring && (E.ring.hidden = false);
    const ids = [...active], t0 = performance.now(), sd = E.seed.value.trim() ? +E.seed.value.trim() : undefined, nz = noiseOn ? noise : null;
    const outcomes = await Promise.all(ids.map(id => Backends.runCircuit({ circuit: C, backend: id, shots, noise: nz, seed: sd }).then(r => ({ id, r })).catch(e => ({ id, err: e.message }))));
    await Motion.wait(Math.max(0, 350 - (performance.now() - t0)));
    E.run.disabled = false; E.run.replaceChildren(icon('play', 's'), 'Run'); E.runline.classList.remove('on'); E.ring && (E.ring.hidden = true); labelLinks();
    const errs = outcomes.filter(o => o.err); outcomes.filter(o => o.r).forEach(({ id, r }) => { results[id] = Object.assign(r, { anim: 0, stale: false }); Motion.to(results[id], { anim: 1, duration: .6, ease: 'power2.out', onUpdate: drawHist }); Store.job({ counts: Object.keys(r.counts).length <= 64 ? r.counts : undefined, backend: r.meta.backend, shots: r.shots || shots, method: r.meta.method, ms: Math.round(r.meta.ms), name: C.name, circuit: clone(C), top: topOf(r), note: r.meta.note || '' }); });
    E.runNote.textContent = errs.length ? errs.map(e => `${Backends.LIST.find(b => b.id === e.id).name}: ${e.err}`).join(' ') : `${ids.length} backend${ids.length > 1 ? 's' : ''} · ${Math.round(performance.now() - t0)} ms`;
    drawHist(); Store.progress('lab', 1);
    const main = results[ids[0]]; if (main) announce(`Most common outcome ${topOf(main)}.`);
  }
  const topOf = r => { const e = Object.entries(r.counts).sort((a, b) => b[1] - a[1])[0]; return e ? `${e[0]} (${e[1]})` : '—'; };
  function drawHist() {
    const ids = Object.keys(results).filter(k => results[k]); const W = Math.max(320, Math.min(980, E.hist.clientWidth || 640));
    if (!E.hist) return; const cw = E.hist.parentNode.clientWidth - 4; const W2 = Math.max(260, Math.min(980, cw || 480));
    if (!ids.length) { E.big.replaceChildren(h('span', { class: 'lbl' }, 'No runs yet')); E.hist.replaceChildren(); E.legend.replaceChildren(h('span', { class: 'small' }, 'Choose backends in the top bar and press Run (⌘↵). Every backend’s results overlay on the same bins.')); E.compare.textContent = ''; return; }
    const keys = new Set(); ids.forEach(id => Object.keys(results[id].counts).forEach(k => keys.add(k))); const any = results[ids[0]]; const kl = any.keys ? any.keys.length : C.n;
    let allKeys = [...keys].sort(); if (kl <= 6) { allKeys = Array.from({ length: 1 << kl }, (_, i) => i.toString(2).padStart(kl, '0')); }
    const colors = ['var(--magenta)', 'var(--cyan)', 'var(--limepop)', '#F5A524', 'var(--t-rose-i)', 'var(--muted)'], dashes = ['4 3', '1.5 2.5', '7 3', '3 2 1 2', '2 2', '6 2'];
    const series = ids.map((id, i) => Object.assign({}, results[id], { fill: i === 0, color: colors[(i - 1 + colors.length) % colors.length], dash: dashes[i % dashes.length] }));
    const ideal = any.exact || null; const sv = svg('svg', { role: 'img', 'aria-label': 'Measurement histogram' }); E.hist.replaceChildren(sv);
    Ink.histogram(sv, { keys: allKeys, ideal, series, width: W2, height: 190 }); const top = Object.entries(any.counts).sort((a, b) => b[1] - a[1])[0]; if (top) E.big.replaceChildren(h('span', { class: 'lbl' }, `P(${top[0]})`), h('b', { class: 'big m' }, fmt.p(top[1] / (any.shots || shots), 1)), h('span', { class: 'badge b-cyan' }, Backends.LIST.find(b => b.id === ids[0]).name));
    E.legend.replaceChildren(...ids.map((id, i) => { const r = results[id], B = Backends.LIST.find(b => b.id === id); return h('span', {}, h('i', { class: 'sw', style: i === 0 ? { background: 'var(--t-blue-i)' } : { border: `1.3px dashed ${series[i].color}` } }), `${B.name} · ${fmt.n(r.shots || shots)} shots · ${r.meta.method}${r.meta.note ? ' · ' + r.meta.note : ''}${r.meta.routed ? ` · ${r.meta.routed.swaps} SWAPs after routing` : ''}${r.stale ? ' · out of date' : ''}`); }), ideal ? h('span', { class: 'lbl' }, '· dotted ticks: exact odds') : '');
    if (ids.length > 1) { const base = results[ids[0]]; E.compare.replaceChildren(...ids.slice(1).map(id => { const c = Backends.tvd(base, results[id]); return h('span', { style: { marginRight: '18px' } }, `${Backends.LIST.find(b => b.id === ids[0]).name} vs ${Backends.LIST.find(b => b.id === id).name}: TVD ${c.tvd.toFixed(3)}, fidelity ${c.fidelity.toFixed(3)}`); })); } else E.compare.textContent = '';
  }
  /* ---------------- lint & pencil ---------------- */
  function renderLint() {
    const sug = Lint.review(C), warn = Lint.warnings(C); score.pencil(sug.slice(0, 3));
    E.lint.replaceChildren(...sug.slice(0, 2).map(s => h('div', { class: 'pencil-note' }, h('p', { class: 'note' }, s.text), h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: () => applySuggestion(s) }, 'Ink It In'), h('button', { type: 'button', class: 'btn', onclick: () => { score.pencil([]); E.lint.firstChild && E.lint.firstChild.remove(); } }, 'Keep Mine')))),
      ...warn.slice(0, 3).map(w => h('p', { class: 'note', style: { marginTop: '10px' } }, w.text)));
  }
  function applySuggestion(s) { const ids = s.ops.map(o => o.id); if (s.kind === 'cancel') C.ops = C.ops.filter(o => !ids.includes(o.id)); else if (s.kind === 'merge') { const [a, b] = s.ops.map(o => C.ops.find(x => x.id === o.id)); if (s.into === a.g && a.p.length) a.p = [typeof a.p[0] === 'number' && typeof b.p[0] === 'number' ? a.p[0] + b.p[0] : `(${a.p[0]}) + (${b.p[0]})`]; else a.g = s.into; C.ops = C.ops.filter(o => o !== b); } else if (s.kind === 'add') { s.ops.forEach(o => IR.insert(C, IR.op(o.g, o.q, o))); }
    IR.compact(C); score.set(C); changed(C, 'Suggestion inked in'); toast('Suggestion inked in.', () => restore(hpos - 1)); }
  /* ---------------- margin panels ---------------- */
  const PANELS = [['missions', 'Missions'], ['inspect', 'Inspect'], ['params', 'Parameters'], ['optimise', 'Optimise'], ['device', 'Device'], ['noise', 'Noise'], ['history', 'History'], ['jobs', 'Jobs']];

  const MISSIONS = [
    { id: 'fake-plus', title: 'A convincing forgery', text: 'Make a 3-qubit state that Z measurements can’t tell apart from |+⟩|+⟩|+⟩ — all eight outcomes equally likely — but which is a different state.', check: c => { if (c.n !== 3 || Sim.isDynamic(c)) return false; const s = Sim.run(Grade.strip(c)), p = Sim.probs(s); if (Array.from(p).some(x => Math.abs(x - .125) > 1e-6)) return false; return Sim.fidelity(s, Sim.run(Q.parse(3, 'H*'))) < .99; }, hint: 'Phases are invisible to Z measurements.' },
    { id: 'ghz', title: 'Tie three together', text: 'Prepare the GHZ state (|000⟩ + |111⟩)/√2 and watch the threads between the spheres.', check: c => c.n === 3 && Grade.check(c, { n: 3, answer: 'H0 CX0.1 CX1.2', match: 'state' }).ok },
    { id: 'toffoli', title: 'Toffoli from scratch', text: 'Build a Toffoli using only H, T, T† and CX — at most 15 gates. It must match CCX exactly.', check: c => c.n === 3 && Grade.check(c, { n: 3, answer: 'CCX0.1.2', match: 'unitary', limit: 15, gates: ['H', 'T', 'TDG', 'CX'] }).ok, start: () => Object.assign(Q.parse(3, ''), { name: 'Toffoli from scratch' }) },
    { id: 'route-qft', title: 'Route a QFT', text: 'Transpile a 4-qubit QFT onto the heavy-hex chip (Device panel) so routing adds no more than 12 extra CNOTs. Reorder or rewrite the circuit if you need to.', check: c => { try { if (c.n !== 4 || !Sim.sameUnitary(4, Grade.strip(c).ops, Q.parse(4, 'QFT0.1.2.3').ops).ok) return false; return Passes.route(c, Passes.DEVICES.heavyhex()).swaps * 3 <= 12; } catch (e) { return false; } }, start: () => Object.assign(Q.parse(4, 'QFT0.1.2.3'), { name: 'QFT, 4 qubits' }) },
    { id: 'grover90', title: 'Find 101', text: 'Write a 3-qubit circuit that reads 101 with probability at least 90%, without simply preparing it: start from H on every qubit and use only H, X, CZ and CCZ-style controls.', check: c => c.n === 3 && Grade.check(c, { n: 3, match: 'peak', key: '101', min: .9 }).ok && Sim.expand(c).filter(o => o.g === 'H').length >= 6 }];
  function renderMissions(P) {
    const done = Store.get().missions || {};
    P.append(h('p', { class: 'small', style: { marginTop: '14px' } }, 'Open-ended goals for the bench. Each one checks itself as you build.'));
    MISSIONS.forEach(m => { const ok = !!done[m.id] || m.check(C); if (ok && !done[m.id]) { Store.set('missions', Object.assign({}, done, { [m.id]: new Date().toISOString() })); toast(`Mission complete: ${m.title}.`); }
      P.append(h('div', { class: 'mission' + (ok ? ' is-done' : '') }, h('p', { class: 'serif m-title' }, h('span', { class: 'mark', 'aria-hidden': 'true' }, ok ? '●' : '○'), m.title), h('p', { class: 'small' }, m.text), m.hint && !ok ? h('p', { class: 'note' }, m.hint) : null, !ok && m.start ? h('button', { type: 'button', class: 'btn', onclick: () => load(m.start(), m.title) }, 'Load the Starting Circuit') : null)); });
  }
  function renderPanel() {
    E.panelWords.replaceChildren(Ctl.words(PANELS.map(([v, l]) => ({ value: v, label: l })), panel, v => { panel = v; renderPanel(); }, { label: 'Margin' }));
    const P = E.panel; P.replaceChildren();
    if (panel === 'missions') { renderMissions(P); return; }
    if (panel === 'inspect') {
      const ids = score.selection, sel = C.ops.filter(o => ids.includes(o.id));
      if (!sel.length) { P.append(h('p', { class: 'small', style: { marginTop: '14px' } }, 'Select a gate to see what it does, edit its parameters, rewire it or condition it on a measurement. Lasso several to group them into a named block (⌘G).')); return; }
      if (sel.length > 1) { P.append(h('p', { class: 'small', style: { marginTop: '14px' } }, `${sel.length} gates selected.`), h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: () => group(ids) }, 'Group into Block…'), h('button', { type: 'button', class: 'btn', onclick: () => score.removeSel() }, 'Remove'), h('button', { type: 'button', class: 'btn', onclick: () => { IR.compact(C); score.set(C); changed(C, 'Compacted'); } }, 'Compact'))); return; }
      const o = sel[0], G = Sim.G[o.g] || {};
      P.append(h('p', { class: 'serif', style: { fontSize: '22px', marginTop: '14px' } }, o.g === 'SUB' ? o.sub : Sim.displayName(o), h('span', { class: 'ket', style: { marginLeft: '10px' } }, `${(o.c || []).length ? (o.c.map(q => 'q' + q).join(',') + ' → ') : ''}${o.q.map(q => 'q' + q).join(',')} · step ${Math.floor(o.col) + 1}`)));
      P.append(h('p', { class: 'note', style: { marginTop: '6px' } }, o.g === 'SUB' ? `A block of ${(C.defs[o.sub] || { ops: [] }).ops.length} gates. Double-click it on the score to edit inside.` : Explain.gate(o, 'formal')));
      (o.p || []).forEach((pv, k) => { const names = o.g === 'U' ? ['θ', 'φ', 'λ'] : ['θ']; const isNum = typeof pv === 'number';
        const sl = Ctl.slider({ label: names[k] || 'θ', min: -2 * Math.PI, max: 2 * Math.PI, step: Math.PI / 64, value: isNum ? pv : 0, fmt: v => fmt.ang(v), onInput: v => { o.p[k] = v; score.render(); views.render(); renderCode(); }, onChange: () => changed(C, `${Sim.displayName(o)} ${names[k] || 'θ'} set`) });
        const fld = Ctl.field({ label: `${names[k]} as an expression`, value: isNum ? '' : String(pv), placeholder: 'or a symbol: theta, 2*gamma, pi/8', mono: true, onEnter: t => { if (!t) return; try { o.p[k] = Sim.evalExpr(t, {}); } catch (e) { o.p[k] = t; const syms = (t.match(/[A-Za-zθγβ_]\w*/g) || []).filter(s => !['pi', 'e', 'sqrt'].includes(s)); syms.forEach(s => { const key = s.replace('θ', 'theta').replace('γ', 'gamma').replace('β', 'beta'); if (!(key in C.params)) C.params[key] = .5; }); } changed(C, 'Parameter set'); } });
        fld.style.width = '100%'; P.append(h('div', { style: { marginTop: '8px' } }, sl, fld)); });
      if ((o.c || []).length === 1 && o.q.length === 1) P.append(h('button', { type: 'button', class: 'btn', onclick: () => { [o.c[0], o.q[0]] = [o.q[0], o.c[0]]; score.set(C); changed(C, 'Flipped'); } }, 'Flip Control and Target'));
      if (o.g !== 'M' && o.g !== 'BARRIER' && o.g !== 'SUB') { const cb = C.nc ?? C.n; P.append(h('div', { class: 'row', style: { marginTop: '8px' } }, h('span', { class: 'lbl' }, 'Run only if'), Ctl.menu({ label: 'Classical condition', options: [{ value: 'none', label: 'always' }, ...Array.from({ length: cb }, (_, b) => [{ value: `b${b}:1`, label: `c${b} = 1` }, { value: `b${b}:0`, label: `c${b} = 0` }]).flat(), ...Array.from({ length: Math.min(8, 1 << cb) }, (_, v) => ({ value: `r:${v}`, label: `c = ${v}` }))], value: o.cond ? (o.cond.reg != null ? `r:${o.cond.val}` : `b${o.cond.bit}:${o.cond.val}`) : 'none', onChange: v => { if (v === 'none') delete o.cond; else if (v[0] === 'r') o.cond = { reg: 'c', val: +v.slice(2) }; else { const [b, val] = v.slice(1).split(':'); o.cond = { bit: +b, val: +val }; } score.set(C); changed(C, 'Condition set'); } }))); }
      P.append(h('div', { class: 'row', style: { marginTop: '6px' } }, h('button', { type: 'button', class: 'btn', onclick: () => score.removeSel() }, 'Remove'), h('button', { type: 'button', class: 'btn', onclick: () => tutor.run(`Explain the ${Sim.displayName(o)} at step ${Math.floor(o.col) + 1} and what it does to this state.`, { selected: o.id, selectedText: `${Sim.displayName(o)} at step ${Math.floor(o.col) + 1}` }) }, 'Ask the Tutor')));
      return;
    }
    if (panel === 'params') {
      const keys = Object.keys(C.params || {});
      if (!keys.length) { P.append(h('p', { class: 'small', style: { marginTop: '14px' } }, 'No symbolic parameters yet. Select a rotation and type a symbol such as theta or 2*gamma in its expression field; it appears here with a slider, and you can sweep it.')); return; }
      keys.forEach(k => P.append(Ctl.slider({ label: k, min: -Math.PI, max: Math.PI, step: Math.PI / 128, value: C.params[k], fmt: v => v.toFixed(3), onInput: v => { C.params[k] = v; views.render(); }, onChange: () => { Object.values(results).forEach(r => r.stale = true); drawHist(); persist(); } })));
      const target = h('div'), sv = svg('svg', { role: 'img', 'aria-label': 'Sweep result' });
      P.append(h('h3', { class: 'vtitle', style: { marginTop: '18px' } }, 'Sweep'), h('p', { class: 'small' }, 'Sweep one parameter from −π to π and plot the observable in the Observables layer (or P(0…0) when it’s off).'), h('div', { class: 'row' }, Ctl.menu({ label: 'Parameter to sweep', options: keys.map(k => ({ value: k, label: k })), value: sweep || keys[0], onChange: v => sweep = v }), h('button', { type: 'button', class: 'btn', onclick: () => doSweep(sweep || keys[0], sv) }, 'Sweep')), h('div', { class: 'scroll-x' }, sv));
      return;
    }
    if (panel === 'optimise') {
      P.append(h('p', { class: 'small', style: { marginTop: '14px' } }, 'Passes: cancel inverse pairs, merge rotations, fuse S·S→Z and T·T→S, commute diagonal gates through controls and X-type gates through CNOT targets, drop identity rotations. Or translate to the IBM basis {CX, RZ, SX, X}.'));
      P.append(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: () => previewOpt('opt') }, 'Preview Optimisation'), h('button', { type: 'button', class: 'btn', onclick: () => previewOpt('basis') }, 'Translate to {CX, RZ, SX, X}')));
      if (optPreview) { const a = Passes.metrics(C), b = Passes.metrics(optPreview.circ); P.append(h('table', { class: 'tbl', style: { marginTop: '10px' } }, h('tr', {}, h('th', {}, ''), h('th', { class: 'num' }, 'Before'), h('th', { class: 'num' }, 'After')), ...[['Depth', 'depth'], ['Gates', 'gates'], ['Two-qubit', 'twoQ'], ['CX (translated)', 'cx']].map(([l, k]) => h('tr', {}, h('td', {}, l), h('td', { class: 'num' }, a[k]), h('td', { class: 'num' }, b[k])))),
        h('p', { class: 'note' }, optPreview.kind === 'opt' ? `Removed gates are struck through in pencil on the score (${optPreview.removed.length}).` : 'Same unitary, written in the hardware basis.'), h('p', { class: 'small' }, `Equivalence check: ${C.n <= 6 && !Sim.isDynamic(C) ? (Sim.sameUnitary(C.n, Sim.expand(C), optPreview.circ.ops, C.params).ok ? 'identical unitary (up to global phase)' : 'differs — not applied') : 'skipped (large or dynamic circuit)'}`),
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'act', onclick: async () => { const c = IR.clone(Object.assign({}, optPreview.circ, { name: C.name, defs: {}, params: C.params })), before = Passes.metrics(C), after = Passes.metrics(c); (optPreview.removed || []).forEach(o => { const g = score.el.querySelector(`[data-id="${o.id}"]`); g && g.classList.add('fading'); }); countDown(before, after); optPreview = null; B.remove('opt'); await Motion.wait(700); score.pencil([]); load(c, 'Optimised'); toast('Optimisation applied.', () => restore(hpos - 1)); } }, 'Apply'), h('button', { type: 'button', class: 'btn', onclick: () => { optPreview = null; B.remove('opt'); score.pencil([]); renderPanel(); renderLint(); } }, 'Discard'))); }
      return;
    }
    if (panel === 'device') {
      const devs = [{ value: 'linear', label: 'Linear chain' }, { value: 'ring', label: 'Ring' }, { value: 'grid', label: 'Grid 3 × 4' }, { value: 'heavyhex', label: 'Heavy-hex, 27 qubits' }];
      P.append(h('p', { class: 'small', style: { marginTop: '14px' } }, 'Translate to {CX, RZ, SX, X}, place logical qubits on the chip and insert SWAPs wherever a CNOT spans non-neighbours.'), h('div', { class: 'row' }, Ctl.menu({ label: 'Coupling map', options: devs, value: device, onChange: v => { device = v; routedView = null; renderPanel(); } }), h('button', { type: 'button', class: 'btn', onclick: () => { try { const D = device === 'linear' ? Passes.DEVICES.linear(Math.max(C.n, 5)) : device === 'ring' ? Passes.DEVICES.ring(Math.max(C.n, 6)) : Passes.DEVICES[device](); routedView = Passes.route(C, D); } catch (e) { routedView = { error: e.message }; } renderPanel(); if (!routedView.error) stageChip(routedView); } }, 'Transpile')));
      if (routedView) { if (routedView.error) P.append(h('p', { class: 'err' }, routedView.error)); else { const sv = svg('svg', { role: 'img', 'aria-label': `Chip drawing with ${routedView.swaps} SWAPs inserted` }); P.append(sv); drawChip(sv, routedView); const b = Passes.metrics(C), a = Passes.metrics(routedView.circ); P.append(h('p', { class: 'metrics' }, h('span', {}, 'SWAPs ', h('b', {}, routedView.swaps)), h('span', {}, 'CX before ', h('b', {}, b.cx)), h('span', {}, 'CX after ', h('b', {}, a.cx + 3 * routedView.swaps)), h('span', {}, 'depth after ', h('b', {}, a.depth))), h('p', { class: 'small' }, 'Placement: ' + Object.entries(routedView.initial).map(([q, p]) => `q${q}→Q${p}`).join(', ')), h('button', { type: 'button', class: 'btn', onclick: () => { const r = routedView; load(Object.assign(IR.fromList(r.dev.n, []), { name: `${C.name} on ${r.dev.name}`, ops: r.circ.ops.map(o => IR.op(o.g, o.q, o)) }), 'Transpiled'); } }, 'Open the Routed Circuit')); } }
      return;
    }
    if (panel === 'noise') {
      P.append(h('p', { class: 'small', style: { marginTop: '14px' } }, 'Used by Aer (noisy), by the Browser when noise is on, and by the Density layer. IBM hardware uses a calibration-derived model with routing penalties.'),
        Ctl.slider({ label: '1-qubit error', min: 0, max: .05, step: .0005, value: noise.p1, fmt: v => fmt.p(v, 2), onInput: v => noise.p1 = v, onChange: () => views.render() }),
        Ctl.slider({ label: '2-qubit error', min: 0, max: .1, step: .001, value: noise.p2, fmt: v => fmt.p(v, 1), onInput: v => noise.p2 = v, onChange: () => views.render() }),
        Ctl.slider({ label: 'T1 (μs)', min: 5, max: 400, step: 5, value: noise.t1, fmt: v => v + ' μs', onInput: v => noise.t1 = v, onChange: () => views.render() }),
        Ctl.slider({ label: 'T2 (μs)', min: 5, max: 400, step: 5, value: noise.t2, fmt: v => v + ' μs', onInput: v => noise.t2 = Math.min(v, 2 * noise.t1), onChange: () => views.render() }),
        Ctl.slider({ label: 'Readout error', min: 0, max: .1, step: .001, value: noise.readout, fmt: v => fmt.p(v, 1), onInput: v => noise.readout = v }),
        h('button', { type: 'button', class: 'btn', onclick: () => { Object.assign(noise, { p1: .0003, p2: .009, t1: 150, t2: 110, readout: .015 }); renderPanel(); views.render(); } }, 'Use Device-Derived Values'));
      return;
    }
    if (panel === 'history') {
      const sl = Ctl.slider({ label: 'History', min: 0, max: Math.max(0, hist.length - 1), step: 1, value: hpos, fmt: v => hist[v] ? hist[v].label : '', onInput: v => restore(v) });
      P.append(h('p', { class: 'small', style: { marginTop: '14px' } }, 'Scrub back through every edit. ⌘Z / ⌘⇧Z step one at a time.'), sl, h('ol', { class: 'hist' }, hist.slice(-12).map((x, i, arr) => h('li', { class: hist.indexOf(x) === hpos ? 'now' : '' }, h('button', { type: 'button', class: 'btn', onclick: () => restore(hist.indexOf(x)) }, `${x.label} · ${fmt.time(new Date(x.at).toISOString())}`)))));
      return;
    }
    if (panel === 'jobs') {
      const J = Store.get().jobs; if (!J.length) { P.append(h('p', { class: 'small', style: { marginTop: '14px' } }, 'No jobs yet. Every run lands here with its backend, time and top result; re-open any job’s circuit.')); return; }
      P.append(h('table', { class: 'tbl', style: { marginTop: '12px' } }, h('tr', {}, h('th', {}, 'When'), h('th', {}, 'Backend'), h('th', {}, 'Top'), h('th', {}, '')), ...J.slice(0, 20).map(j => h('tr', {}, h('td', {}, fmt.time(j.at)), h('td', {}, j.backend + (j.note ? ' (mock)' : '')), h('td', { class: 'mono' }, j.top), h('td', {}, h('button', { type: 'button', class: 'btn', onclick: () => load(Object.assign(j.circuit, { name: j.name }), 'Job re-opened') }, 'Open'))))));
    }
  }
  function countDown(a, b) { const t = { k: 0 }; Motion.to(t, { k: 1, duration: .7, ease: 'power2.out', onUpdate: () => { const m = {}; ['width', 'depth', 'gates', 'cx', 'tcount'].forEach(k => m[k] = typeof a[k] === 'number' ? Math.round(a[k] + ((b[k] ?? a[k]) - a[k]) * t.k) : a[k]); paintMetrics(m); } }); }
  function previewOpt(kind) { if (kind === 'opt') { const r = Passes.optimise(C); optPreview = { kind, circ: r.circ, removed: r.removed }; score.pencil(r.removed.length ? [{ kind: 'cancel', ops: r.removed }] : []); } else { optPreview = { kind, circ: Passes.toBasis(C), removed: [] }; } renderPanel(); optCard(); }
  function optCard() {
    B.remove('opt'); if (!optPreview) return; const a = Passes.metrics(C), b = Passes.metrics(optPreview.circ), d = b.gates - a.gates;
    const c = B.add('opt', { x: 40, y: 860, w: 620, title: optPreview.kind === 'opt' ? 'Optimised' : 'In the {CX, RZ, SX, X} basis', icon: 'optimise', tint: 'lime', menu: [['Close', () => { optPreview = null; B.remove('opt'); score.pencil([]); renderPanel(); }]] });
    const sc = h('div'); c.body.append(h('div', { class: 'row', style: { marginBottom: '8px' } }, h('span', { class: 'big m' }, `${b.gates}`), h('span', { class: 'delta' }, `gates (was ${a.gates}) · depth ${a.depth} → ${b.depth} · CX ${a.cx} → ${b.cx}`)), sc, h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { type: 'button', class: 'btn', onclick: () => E.insp.querySelector('.act')?.click() }, 'Apply'), h('button', { type: 'button', class: 'btn bare', onclick: () => { optPreview = null; B.remove('opt'); score.pencil([]); renderPanel(); } }, 'Discard')));
    Score(sc, { circ: IR.clone(Object.assign({ defs: {}, params: C.params }, optPreview.circ)), editable: false, compact: true, playhead: false });
    B.link('circuit', 'opt', { label: d ? `${d > 0 ? '+' : '−'}${Math.abs(d)} gates` : 'same size', cls: d < 0 ? 'good' : '' }); B.focusCard('opt');
  }
  function stageChip(R) {
    B.remove('chip'); const c = B.add('chip', { x: 700, y: 860, w: 720, title: `On the chip · ${R.dev.name}`, icon: 'cpu', menu: [['Close', () => B.remove('chip')], ['Open the routed circuit', () => E.insp.querySelector('.panel .btn:last-child')?.click()]] });
    const sv = svg('svg', { role: 'img', 'aria-label': `Your circuit placed on ${R.dev.name}, with ${R.swaps} SWAPs` });
    c.body.append(h('div', { class: 'scroll-x' }, sv), h('p', { class: 'metrics' }, h('span', {}, 'SWAPs ', h('b', {}, String(R.swaps))), h('span', {}, 'extra CX ', h('b', {}, String(3 * R.swaps)))));
    drawChip(sv, R, 660); B.link('circuit', 'chip', { label: `+${R.swaps} SWAP${R.swaps === 1 ? '' : 's'}`, cls: R.swaps ? 'bad' : 'good' }); B.focusCard('chip');
    const labs = [...sv.querySelectorAll('text.ql')]; labs.forEach((t, i) => { if (Motion.reduced || !window.gsap) return; gsap.from(t, { attr: { x: 30, y: 30 + i * 22 }, duration: .9, delay: .1 + i * .06, ease: 'power3.inOut' }); });
    [...sv.querySelectorAll('line.swap')].forEach((l, i) => { if (Motion.reduced || !window.gsap) return; const L = Math.hypot(l.x2.baseVal.value - l.x1.baseVal.value, l.y2.baseVal.value - l.y1.baseVal.value); l.style.strokeDasharray = L; gsap.fromTo(l, { strokeDashoffset: L }, { strokeDashoffset: 0, duration: .6, delay: 1 + i * .15 }); });
  }
  function drawChip(sv, R, Wd) {
    const D = R.dev, xs = D.pos.map(p => p[0]), ys = D.pos.map(p => p[1]), minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys), W = Wd || 340, H = Math.max(120, (maxY - minY) / (maxX - minX || 1) * 300 + 60);
    const X = x => 20 + (x - minX) / (maxX - minX || 1) * (W - 40), Y = y => 20 + (y - minY) / (maxY - minY || 1) * (H - 40);
    sv.setAttribute('viewBox', `0 0 ${W} ${H}`); sv.setAttribute('width', W); sv.setAttribute('height', H); sv.classList.add('chart');
    const used = new Set(R.circ.ops.flatMap(o => Sim.wires(o))), swapE = new Set(R.circ.ops.filter(o => o.routed).map(o => o.q.slice().sort((a, b) => a - b).join('-')));
    D.edges.forEach(([a, b]) => svg('line', { x1: X(D.pos[a][0]), y1: Y(D.pos[a][1]), x2: X(D.pos[b][0]), y2: Y(D.pos[b][1]), stroke: swapE.has([a, b].sort((x, y) => x - y).join('-')) ? 'var(--magenta)' : 'var(--hair2)', 'stroke-width': swapE.has([a, b].sort((x, y) => x - y).join('-')) ? 2.5 : 1.2, class: swapE.has([a, b].sort((x, y) => x - y).join('-')) ? 'swap' : null }, sv));
    const inv = {}; Object.entries(R.initial).forEach(([q, p]) => inv[p] = q);
    D.pos.forEach((p, i) => { svg('circle', { cx: X(p[0]), cy: Y(p[1]), r: 9, fill: used.has(i) ? 'var(--violet)' : 'var(--white)', stroke: used.has(i) ? 'var(--violet)' : 'var(--hair2)', 'stroke-width': 1.5 }, sv); if (inv[i] != null) { const t = svg('text', { x: X(p[0]), y: Y(p[1]) - 13, 'text-anchor': 'middle', class: 'ql' }, sv); t.textContent = 'q' + inv[i]; } });
  }
  async function doSweep(k, sv) {
    const pts = [], obs = views.on.includes('observables') ? views.obs : null, base = C.params[k]; let terms = null; try { if (obs) terms = Sim.parseObservable(obs, C.n); } catch (e) { }
    for (let i = 0; i <= 64; i++) { const v = -Math.PI + 2 * Math.PI * i / 64; C.params[k] = v; const s = Sim.run(C); pts.push([v, terms ? Sim.expectation(s, terms) : Sim.probs(s)[0]]); }
    C.params[k] = base; Ink.lines(sv, { series: [{ pts }], width: 360, height: 200, xlabel: k, ylabel: terms ? `⟨${obs}⟩` : 'P(0…0)', xticks: [-Math.PI, -Math.PI / 2, 0, Math.PI / 2, Math.PI].map(x => +x.toFixed(2)) });
    const best = pts.reduce((a, b) => (b[1] < a[1] ? b : a)); announce(`Minimum ${best[1].toFixed(4)} at ${k} = ${best[0].toFixed(3)}.`);
  }
  function group(ids) {
    toggle('insp', true); const P = E.panel; P.replaceChildren(h('p', { class: 'small', style: { marginTop: '14px' } }, 'Name the block. It becomes a reusable gate in the type case.'));
    const f = Ctl.field({ label: 'Block name', placeholder: 'Oracle', onEnter: v => make(v) }); P.append(f, h('button', { type: 'button', class: 'btn', onclick: () => make(f.value.trim()) }, 'Make Block')); f.focus();
    function make(nm) {
      nm = (nm || '').replace(/[^\w-]/g, '').slice(0, 16); if (!nm) { toast('Give the block a name.'); return; }
      const ops = C.ops.filter(o => ids.includes(o.id)), wires = [...new Set(ops.flatMap(o => Sim.wires(o)))].sort((a, b) => a - b), c0 = Math.min(...ops.map(o => Math.floor(o.col)));
      C.defs[nm] = { ops: ops.map(o => Object.assign({}, o, { q: o.q.map(q => wires.indexOf(q)), c: (o.c || []).map(q => wires.indexOf(q)), col: Math.floor(o.col) - c0 })), arity: wires.length };
      C.ops = C.ops.filter(o => !ids.includes(o.id)); IR.insert(C, IR.op('SUB', wires, { sub: nm, col: c0 })); customBlocks.add(nm); score.set(C); changed(C, `Block ${nm} made`); paintCase();
    }
  }
  const customBlocks = new Set();
  function paintCase() { tcase = TypeCase(E.case, { groups: [['H', 'X', 'Y', 'Z', 'S', 'T', 'RY', 'RZ', 'CX', 'M']], getScore: () => score }); }
  function openImport() {
    toggle('insp', true); const P = E.panel; panel = 'import'; E.panelWords.replaceChildren(Ctl.words(PANELS.map(([v, l]) => ({ value: v, label: l })), '', v => { panel = v; renderPanel(); }, { label: 'Margin' }));
    const ta = h('textarea', { class: 'uline mono', rows: 10, style: { width: '100%', resize: 'vertical' }, placeholder: 'Paste OpenQASM 2/3, Qiskit, Cirq or PennyLane code, or Quirk JSON', 'aria-label': 'Code to import' }), msg = h('p', { class: 'err' });
    const file = h('input', { type: 'file', accept: '.qasm,.py,.json,.txt', 'aria-label': 'Import a file', onchange: async e => { const f = e.target.files[0]; if (f) ta.value = await f.text(); } });
    P.replaceChildren(h('p', { class: 'small', style: { marginTop: '14px' } }, 'The format is detected automatically.'), ta, file, msg, h('button', { type: 'button', class: 'act', onclick: () => { const t = ta.value.trim(); try { const c = importAny(t); load(c, 'Imported'); panel = 'inspect'; renderPanel(); toast('Imported.'); } catch (e) { msg.textContent = e.message; } } }, 'Import'));
    ta.focus();
  }
  function importAny(t) {
    if (!t) throw new Error('Paste some code first.');
    if (/^\s*\{/.test(t)) { const q = Code.fromQuirk(t); return { n: q.n, nc: q.n, name: 'Imported from Quirk', ops: q.ops.map(o => IR.op(o.g, o.q, o)), defs: {}, params: {} }; }
    const langG = /OPENQASM|qreg|qubit\[/.test(t) ? 'qasm' : /cirq\./.test(t) ? 'cirq' : /qml\./.test(t) ? 'pennylane' : 'qiskit';
    const r = Code.parse(langG, t); if (r.errors.length) throw new Error(r.errors.slice(0, 3).map(e => e.msg).join(' '));
    const c = { n: r.n, nc: r.nc, name: `Imported ${langG === 'qasm' ? 'OpenQASM' : langG}`, defs: {}, params: {}, ops: r.ops.map(o => IR.op(o.g, o.q, Object.assign({}, o, { col: 0 }))) }; IR.compact(c); return c;
  }
  function exportAs(kind) {
    const nm = (C.name || 'circuit').replace(/[^\w-]+/g, '_');
    if (kind === 'svg') { const s = score.el.cloneNode(true); s.setAttribute('xmlns', NS); const st = document.createElementNS(NS, 'style'); st.textContent = `text{font-family:${cssv('--mono')};fill:${cssv('--ink')}}line,path{stroke:${cssv('--ink')}}rect.box{fill:${cssv('--bg')};stroke:${cssv('--ink')}}.dot{fill:${cssv('--ink')}}`; s.prepend(st); saveFile(nm + '.svg', new XMLSerializer().serializeToString(s), 'image/svg+xml'); return; }
    if (kind === 'png') { const s = score.el.cloneNode(true); s.setAttribute('xmlns', NS); s.querySelectorAll('.ph,.cur').forEach(x => x.remove()); const st = document.createElementNS(NS, 'style'); st.textContent = `text{font-family:monospace;fill:#17191c}line,path{stroke:#17191c}rect.box{fill:#fff;stroke:#17191c}.dot{fill:#17191c}`; s.prepend(st); const W = +s.getAttribute('width'), H = +s.getAttribute('height'); const img = new Image(); img.onload = () => { const cv = h('canvas', { width: W * 2, height: H * 2 }), x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W * 2, H * 2); x.scale(2, 2); x.drawImage(img, 0, 0); cv.toBlob(b => saveFile(nm + '.png', b, 'image/png')); }; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(s)); return; }
    if (kind === 'latex') return saveFile(nm + '.tex', Code.quantikz(C));
    if (kind === 'qasm') return saveFile(nm + '.qasm', Code.gen('qasm', C).text);
    if (kind === 'ipynb') return saveFile(nm + '.ipynb', Code.notebook(C, C.name), 'application/json');
    if (kind === 'json') return saveFile(nm + '.json', JSON.stringify({ format: 'quantum-laboratory/ir-1', circuit: C }, null, 1), 'application/json');
    return saveFile(nm + (kind === 'qiskit' ? '_qiskit.py' : kind === 'cirq' ? '_cirq.py' : '_pennylane.py'), Code.gen(kind, C).text);
  }
  /* ---------------- mount ---------------- */
  function mount(el) {
    root = el; mounted = true; const saved = Store.get().lab; C = saved && saved.ops ? IR.clone(saved) : Templates.bell(); C.defs = C.defs || {}; C.params = C.params || {}; C.nc = C.nc ?? C.n;
    layout(el);
    score = Score(E.scoreHost, { circ: C, editable: true, maxQubits: 12, onChange: changed, onSelect: ids => { if (ids && ids.length) { panel = 'inspect'; toggle('insp', true); } renderPanel(); linkLines(); }, onHover: id => { linkLines(id); }, onPlayhead: () => { views.render(); linkLines(); labelLinks(); }, onGroup: ids => group(ids), onOpenSub: o => { const d = C.defs[o.sub]; if (!d) return; toast(`Inside ${o.sub}: ${d.ops.map(x => Sim.displayName(x)).join(' · ')}. Edit the block by ungrouping it from the Inspect panel.`); } });
    paintCase();
    views = { render() { SV.forEach(v => v.render()); labelLinks(); }, get on() { return [...SV.keys()]; }, get obs() { const o = SV.get('observables'); return o ? o.obs : 'Z0'; } };
    // top bar pills: backend · shots · noise · optimise · device · code · share · export · Run
    const pill = (ic, label, on, extra = {}) => { const b = h('button', Object.assign({ type: 'button', class: 'pill' }, extra), icon(ic, 's'), label); b.addEventListener('click', e => on(b, e)); return b; };
    const backsLabel = () => { const a = [...active]; return a.length === 1 ? Backends.LIST.find(b => b.id === a[0]).name : `${a.length} backends`; };
    const bp = pill('cpu', backsLabel(), b => { const hr = root.getBoundingClientRect(), r = b.getBoundingClientRect(); const old = document.querySelector('.run-pop'); if (old) { old.remove(); return; }
      const p = h('div', { class: 'pop run-pop', style: { position: 'fixed', right: Math.max(12, innerWidth - r.right) + 'px', top: (r.bottom + 8) + 'px', width: '360px' } }, h('p', { class: 'lbl' }, 'Run on (pick several to overlay them)'),
        Ctl.words(Backends.LIST.map(x => ({ value: x.id, label: x.name, title: x.note + (x.kind === 'server' ? ' This page can’t reach a server, so this runs as a labelled offline mock.' : '') })), [...active], v => { active = new Set(v.length ? v : ['browser']); b.lastChild.textContent = backsLabel(); labelLinks(); }, { multi: true, label: 'Backends' }),
        h('div', { class: 'row', style: { marginTop: '12px' } }, Ctl.menu({ label: 'Shots', options: [100, 1000, 4000, 10000].map(v => ({ value: v, label: `${fmt.n(v)} shots` })), value: shots, onChange: v => { shots = v; labelLinks(); } }), h('label', { class: 'lbl', for: 'lab-seed' }, 'Seed'), E.seed));
      document.body.append(p); const off = e => { if (!p.contains(e.target) && !b.contains(e.target) && !e.target.closest('.menu')) { p.remove(); removeEventListener('pointerdown', off, true); } }; setTimeout(() => addEventListener('pointerdown', off, true)); });
    E.seed = h('input', { id: 'lab-seed', class: 'uline mono', style: { width: '90px', height: '36px' }, placeholder: 'random', inputmode: 'numeric' });
    const np = pill('noise', 'Noise', b => { noiseOn = !noiseOn; b.setAttribute('aria-pressed', String(noiseOn)); views.render(); refresh(); if (noiseOn) openPanel('noise'); }, { 'aria-pressed': 'false', title: 'Run the Browser backend and the state cards with your noise model' });
    const op = pill('optimise', 'Optimise', () => { openPanel('optimise'); previewOpt('opt'); });
    const dp = pill('cpu', 'Device', () => openPanel('device'));
    const cp = pill('code', 'Code', () => toggle('code'), { 'data-drawer': 'code', 'aria-pressed': 'false' });
    const sp = pill('share', 'Share', () => copyText(Share.link(C), 'Link copied — anyone you’ve shared this page with can open the circuit.'));
    E.exportMenu = Ctl.menu({ label: 'Export', value: 'x', options: [{ value: 'x', label: 'Export' }, { value: 'svg', label: 'Score as SVG' }, { value: 'png', label: 'Score as PNG' }, { value: 'latex', label: 'LaTeX (quantikz)' }, { value: 'qasm', label: 'OpenQASM 3' }, { value: 'qiskit', label: 'Qiskit Python' }, { value: 'cirq', label: 'Cirq Python' }, { value: 'pennylane', label: 'PennyLane Python' }, { value: 'ipynb', label: 'Jupyter notebook' }, { value: 'json', label: 'Circuit IR (JSON)' }], onChange: v => { if (v !== 'x') exportAs(v); E.exportMenu.set('x'); } });
    E.run = h('button', { type: 'button', class: 'primary', onclick: () => run(), title: 'Run (⌘↵)' }, icon('play', 's'), 'Run');
    pills = [bp, np, op, dp, cp, sp, E.exportMenu, E.run];
    E.langs.replaceChildren(Ctl.words([{ value: 'qiskit', label: 'Qiskit' }, { value: 'cirq', label: 'Cirq' }, { value: 'pennylane', label: 'PennyLane' }, { value: 'qasm', label: 'QASM 3' }], lang, v => { lang = v; renderCode(true); renderLint(); }, { label: 'Code language' }));
    E.name.addEventListener('change', () => { C.name = E.name.value.trim() || 'Untitled circuit'; persist(); top(); });
    E.code.addEventListener('input', onCodeInput); E.code.addEventListener('scroll', () => { E.hl.scrollTop = E.code.scrollTop; E.hl.scrollLeft = E.code.scrollLeft; E.gut.scrollTop = E.code.scrollTop; });
    E.code.addEventListener('blur', () => renderCode(true));
    E.code.addEventListener('keyup', () => { const ln = E.code.value.slice(0, E.code.selectionStart).split('\n').length - 1; const id = codeMap[ln]; score.light(id || null); });
    E.code.addEventListener('keydown', e => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); document.execCommand('insertText', false, '    '); } });
    E.tpl.addEventListener('keydown', e => { if (e.key !== 'Enter') return; e.preventDefault(); const t = Templates.fromText(E.tpl.value); if (!t) { E.tplMsg.textContent = 'No template by that name. Try bell, ghz 4, qft 3, grover 101, qaoa 5 p=2, teleport.'; return; } E.tplMsg.textContent = ''; E.tpl.value = ''; load(t, `${t.name} loaded`); toast(`${t.name} loaded.`, () => restore(hpos - 1)); });
    addEventListener('keydown', e => {
      if (!$('#view-lab') || $('#view-lab').hidden) return; const mod = e.metaKey || e.ctrlKey, inField = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
      if (mod && e.key === 'Enter') { e.preventDefault(); run(); }
      if (mod && e.key.toLowerCase() === 'z' && !inField) { e.preventDefault(); e.shiftKey ? restore(hpos + 1) : restore(hpos - 1); }
    });
    score.el.addEventListener('keydown', e => { if (e.key === ' ') { e.preventDefault(); run(); } });
    tutor = Tutor.mount(E.tutorHost, () => ({ circuit: C, playhead: score.playhead, mode: 'collab', where: 'Laboratory (free building)', depth: Store.get().depth || 'formal', selected: score.selection[0] }), {
      placeholder: 'Describe a circuit, or ask about this one…',
      onBuild: async b => { const t = b.ops ? { n: b.replace ? b.n : C.n, ops: b.ops, name: b.replace ? 'Written by the tutor' : C.name } : b; if (b.replace || !b.ops) { const target = IR.clone(Object.assign({ defs: {}, params: {} }, t)); const ops = target.ops; target.ops = []; load(target, 'Tutor started a circuit'); for (const o of Sim.sorted(ops)) { await Motion.wait(220); C.ops.push(o); score.set(C); renderCode(); views.render(); } changed(C, `${t.name || 'Circuit'} written`); } else { for (const o of b.ops) { await Motion.wait(220); IR.insert(C, o); score.set(C); renderCode(); } changed(C, 'Tutor added gates'); } },
      onPencil: list => { score.pencil(list); E.lint.prepend(h('div', { class: 'pencil-note' }, h('p', { class: 'note' }, list[0].text || 'Pencilled suggestion.'), h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: () => applySuggestion(list[0]) }, 'Ink It In'), h('button', { type: 'button', class: 'btn', onclick: () => { score.pencil([]); renderLint(); } }, 'Keep Mine')))); },
      resolve: t => { const [k, v] = String(t).split(':'); if (k === 'op') return score.el.querySelector(`[data-id="${v}"]`); if (k === 'qubit') return (B.cards.get('spheres')?.el.querySelectorAll('.sph') || [])[+v] || score.el; if (k === 'field') return B.cards.get('field')?.el.querySelector(`.fd[data-i="${v}"]`) || null; if (k === 'histogram') return B.cards.get('hist')?.el || null; if (k === 'code') { toggle('code', true); return E.code; } return null; }
    });
    holdToAsk(score.el, e => { const g = e.target.closest('[data-id]'); if (!g) return null; const o = C.ops.find(x => x.id === +g.dataset.id); return o && { label: `${Sim.displayName(o)} at step ${Math.floor(o.col) + 1}`, id: o.id }; }, tutor);
    // the tutor speaks through the QUBIT cursor on the canvas
    const sayEl = E.tutorHost.querySelector('.say'); new MutationObserver(() => { if (!$('#view-lab') || $('#view-lab').hidden) return; qc.say(sayEl.innerHTML); if (!qc._pointed) qc.at(score.el, .85, .2); qc._pointed = false; }).observe(sayEl, { childList: true, characterData: true, subtree: true });
    Tutor.pointer = el => { if (!$('#view-lab') || $('#view-lab').hidden || !el) return false; qc._pointed = true; const card = el.closest('.bcard'); card && B.focusCard(card.dataset.key); setTimeout(() => qc.at(el, .7, .75), 350); return true; };
    E.ask.addEventListener('focusin', () => E.ask.classList.add('open')); E.ask.addEventListener('focusout', e => { if (!E.ask.contains(e.relatedTarget)) E.ask.classList.remove('open'); });
    snapshot('Opened'); refresh(); setTimeout(() => qc.at(B.cards.get('circuit').el, .82, .92), 300);
  }
  function save() { Store.note({ kind: 'experiment', title: C.name || 'Circuit', text: `${C.n} qubits, ${C.ops.length} gates, depth ${Passes.metrics(C).depth}.`, circuit: clone(C), task: { kind: 'rebuild', label: `Rebuild “${C.name || 'this circuit'}” from memory` } }); Platform.shareCircuit && Platform.offerShare(C); toast('Saved to your Notebook.'); }
  function top() { App.top(['Laboratory', C.name || 'Untitled circuit'], pills); }
  return { mount: el => { mount(el); top(); }, load: c => { if (mounted) load(c); else Store.set('lab', JSON.parse(JSON.stringify(c))); }, get circ() { return C; }, onShow() { top(); drawHist(); views && views.render(); } };
})();
