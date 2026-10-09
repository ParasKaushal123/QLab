/* =====================================================================
   THE FIRST FIVE MINUTES — Arrival (the H·H experiment, before any
   sign-up), Placement (three Stage tasks), and Today (home).
===================================================================== */
const Journey = (() => {
  /* ---------------- Arrival ---------------- */
  function arrival(el) {
    let step = 0, sphere, tray, shaper, ops = 0; const E = {};
    const R = 150, SW = 2 * R + 120, SH = 2 * R + 80;
    const sv = svg('svg', { class: 'arr-sphere', viewBox: `0 0 ${SW} ${SH}`, width: SW, height: SH, role: 'img', 'aria-label': 'A qubit, drawn as an arrow in a sphere' });
    sphere = Ink.sphere(sv, { cx: SW / 2, cy: SH / 2, R, tipR: 7 });
    const hmark = h('button', { type: 'button', class: 'gmark chip-pauli fam-single big', 'aria-label': 'H gate. Drag it onto the sphere, or press to apply.' }, 'H');
    el.replaceChildren(h('div', { class: 'arrival' },
      h('div', { class: 'arr-stage' }, h('div', { class: 'arr-drop', id: 'arr-drop' }, sv, E.dropHint = h('span', { class: 'arr-hint lbl', 'aria-hidden': 'true' }, 'drop here')), E.trayHost = h('div', { class: 'arr-tray' })),
      h('div', { class: 'arr-copy' }, h('p', { class: 'lbl wordmark' }, 'QUBIQ'), E.copy = h('div', { class: 'arr-text', 'aria-live': 'polite' }), E.act = h('div', { class: 'arr-act' }))));
    tray = Stage.Tray(E.trayHost, { keys: ['0', '1'], height: 170, label: 'Where a hundred measurements landed' });
    const drop = el.querySelector('#arr-drop');
    let dragging = false;
    hmark.addEventListener('pointerdown', e => { Drag.start(e, 'H', { onMove: ev => { const r = drop.getBoundingClientRect(); drop.classList.toggle('hot', ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom); }, onDrop: ev => { const r = drop.getBoundingClientRect(); drop.classList.remove('hot'); if (ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom) applyH(); }, onCancel: () => drop.classList.remove('hot') }); });
    hmark.addEventListener('click', () => { if (!Drag.just) applyH(); });
    let busy = false;
    async function applyH() { if (busy || (step !== 0 && step !== 3)) return; busy = true; ops++; const aa = Sim.axisAngle(Sim.G.H.m()); await sphere.rotate(aa.axis, aa.angle, 1.1); busy = false; step = step === 0 ? 1 : 4; render(); }
    async function measure() { busy = true; tray.clear(); if (step === 4 && E.guess) tray.ghost(E.guess, 100); const p = ops % 2 ? { '0': .5, '1': .5 } : { '0': 1, '1': 0 }; const c = await tray.pour(Stage.sampleKeys(p, 100), { maxAnimated: 100 }); busy = false; step = step === 1 ? 2 : 5; E.first = E.first || c; render(); }
    function copy(...ps) { E.copy.replaceChildren(...ps.map((p, i) => typeof p === 'string' ? h(i === 0 ? 'h1' : 'p', { class: i === 0 ? 'arr-h fade' : 'arr-p fade' }, p) : p)); }
    function render() {
      E.act.replaceChildren(); E.dropHint.hidden = !(step === 0 || step === 3); E.trayHost.style.visibility = step === 0 || (step === 1 && !E.first) ? 'hidden' : 'visible';
      if (step === 0) { copy('This is a qubit.', 'Right now it points up, at |0⟩ — measure it and you’ll read 0 every time. Drag the H onto it.'); E.act.append(hmark, h('span', { class: 'lbl' }, 'or press it')); }
      if (step === 1) { copy('Now it points sideways.', 'Halfway between 0 and 1. Ask it a hundred times and see what comes out.'); E.act.append(h('button', { type: 'button', class: 'act', onclick: measure }, 'Measure 100 Copies')); }
      if (step === 2) { const c = E.first; copy('Heads or tails.', `${c['0'] || 0} zeros and ${c['1'] || 0} ones — about half each, like a fair coin. So what does a second H do? A coin flipped twice is still a coin.`);
        const sh = h('div', { class: 'arr-shape' }); E.act.append(h('p', { class: 'lbl' }, 'Shape your guess for H, then H'), sh, h('button', { type: 'button', class: 'act', onclick: () => { E.guess = shaper.value; step = 3; tray.clear(); render(); } }, 'Lock In My Guess'));
        shaper = Stage.Shaper(sh, { keys: ['0', '1'], height: 140, label: 'Your guess for two H gates' }); }
      if (step === 3) { copy('Your guess is locked.', 'The qubit still sits on the equator after its first H. Drag a second H onto it.'); E.act.append(hmark); ops = 1; }
      if (step === 4) { copy('Back where it started.', 'Two half-turns about the same tilted axis bring the arrow home. Measure a hundred copies.'); E.act.append(h('button', { type: 'button', class: 'act', onclick: measure }, 'Measure 100 Copies')); tray.ghost(E.guess, 100); }
      if (step === 5) {
        const was = E.guess && E.guess['0'] > .9;
        copy('That shouldn’t happen with a coin.', `All one hundred came out 0.${was ? ' You saw it coming — most people don’t.' : ' Your dashed guess expected a coin.'} The first H didn’t pick a side. It split the qubit into two paths, and the second H made them interfere: the paths to 1 cancelled, the paths to 0 added up.`,
          h('p', { class: 'arr-p fade' }, 'That is the whole trick of quantum computing, and the rest of this course is how to use it.'));
        const name = Ctl.field({ label: 'Your name (optional)', placeholder: 'Your name (optional)' });
        E.act.append(h('div', { class: 'arr-join' }, name, h('button', { type: 'button', class: 'act', onclick: () => { Store.set('profile', Object.assign({}, Store.get().profile, { name: name.value.trim() || null, arrived: new Date().toISOString(), guessedInterference: !!was })); Store.note({ kind: 'field', lesson: 'arrival', title: 'Arrival', text: 'One H makes a coin; two H’s make certainty. The paths interfered.', task: { kind: 'recall', label: 'Why did H·H give 0 every time?' } }); location.hash = '#placement'; } }, 'Keep Going: Find My Starting Point', h('span', { 'aria-hidden': 'true' }, '→')), h('a', { class: 'btn', href: '#course', onclick: () => Store.set('profile', Object.assign({}, Store.get().profile, { arrived: new Date().toISOString() })) }, 'Skip to the Course')));
      }
    }
    render();
    const mv = e => sphere.follow((e.clientX / innerWidth - .5) * 2, (e.clientY / innerHeight - .5) * 2); addEventListener('pointermove', mv, { passive: true });
    return { destroy() { removeEventListener('pointermove', mv); } };
  }

  /* ---------------- Placement ---------------- */
  function placement(el) {
    const results = []; let t = 0; const E = {};
    const TASKS = [
      { title: 'Set a state', q: 'Point the arrow along +y — the state |+i⟩. Use any of the gates.', kind: 'stage' },
      { title: 'Predict by shaping', q: 'This circuit is H, then Z, then H. Shape the histogram you expect from 1,000 shots.', kind: 'shape', circuit: 'H0 Z0 H0' },
      { title: 'Build a Bell pair', q: 'Build a two-qubit circuit whose qubits always agree — half the time 00, half the time 11.', kind: 'bell' }];
    el.replaceChildren(h('div', { class: 'split place' },
      h('div', { class: 'stagecol' }, h('p', { class: 'lbl' }, 'Placement'), E.track = h('ol', { class: 'place-track' }), E.stage = h('section', { class: 'beat-stage fade' })),
      h('aside', { class: 'margin' }, h('div', { class: 'mhead' }, h('h1', {}, 'Three short tasks')), E.voice = h('div', { class: 'voice' }, h('p', { class: 'say-m' }, 'No marks and no timer. What you can already do decides where the course starts you and how deep it reads. Skip anything you haven’t met — that’s information too.')))));
    function track() { E.track.replaceChildren(...TASKS.map((x, i) => h('li', { class: i < t ? 'done' : i === t ? 'now' : '' }, h('span', { class: 'mono' }, String(i + 1)), x.title, i < t ? h('span', { class: 'lbl' }, results[i] ? ' · got it' : ' · not yet') : null))); }
    function next(ok) { results[t] = ok; t++; track(); if (t < TASKS.length) show(); else finish(); }
    function show() {
      const T = TASKS[t]; E.stage.replaceChildren(h('h2', { class: 'big-q' }, T.q)); const host = h('div'); E.stage.append(host); const fb = h('p', { class: 'small', 'aria-live': 'polite' });
      const skip = h('button', { type: 'button', class: 'btn', onclick: () => next(false) }, 'I Haven’t Met This Yet');
      if (T.kind === 'stage') { let s = null; const Qs = Stage.QubitStage(host, { gates: ['H', 'X', 'Z', 'S', 'T'], onState: st => s = st });
        E.stage.append(h('div', { class: 'row' }, h('button', { type: 'button', class: 'act', onclick: () => { const b = Sim.bloch(Qs.state, 0); if (b[1] > .98) next(true); else fb.textContent = `The arrow points at (${b.map(x => fmt.f(x, 2)).join(', ')}). +y is on the equator, a quarter-turn from +x.`; } }, 'Check'), skip), fb); }
      if (T.kind === 'shape') { const C = Q.parse(1, T.circuit), sc = h('div'); host.append(sc); Course.miniScore(sc, C); const sh = h('div'); host.append(sh); const S = Stage.Shaper(sh, { keys: ['0', '1'] });
        E.stage.append(h('div', { class: 'row' }, h('button', { type: 'button', class: 'act', onclick: () => { const ex = Grade.exactDist(C), d = Grade.tvd(S.value, ex); next(d <= .2); } }, 'Lock In'), skip)); }
      if (T.kind === 'bell') { let C = { n: 2, nc: 2, ops: [], defs: {}, params: {} }; const cs = h('div', { class: 'typecase' }), sc = h('div'); host.append(cs, sc);
        const S = Score(sc, { circ: C, editable: true, fixedQubits: true, maxQubits: 2, minQubits: 2, gates: ['H', 'X', 'CX', 'Z'], minCols: 6, onChange: c => C = c }); TypeCase(cs, { groups: [['H', 'X', 'Z', 'CX']], getScore: () => S });
        E.stage.append(h('div', { class: 'row' }, h('button', { type: 'button', class: 'act', onclick: () => { const r = Grade.check(S.circ, { n: 2, answer: 'H0 CX0.1', match: 'probs' }); if (r.ok) next(true); else fb.textContent = 'Not yet: run it in your head — which outcomes can appear? You need only 00 and 11, equally often.'; } }, 'Check'), skip), fb); }
    }
    function finish() {
      const c = results.filter(Boolean).length, dep = c >= 2 ? 'formal' : 'intuition', start = c === 3 ? 'g1' : c === 2 ? 'q3' : 'q1';
      Store.set('depth', dep); Store.set('placement', { results, at: new Date().toISOString(), start }); results.forEach((ok, i) => Store.attempt({ concept: ['bloch', 'phase', 'bell'][i], ok, kind: 'placement' }));
      const why = c === 3 ? 'You already move the arrow, read interference and build entanglement. Skip ahead to Module 2, Gates, where the maths behind all three begins.' : c === 2 ? 'You have the basics. Start at Phase and bases in Module 1, where most people’s intuition first breaks.' : 'Start at the very beginning of Module 1, From bits to qubits: every idea arrives as a picture before it arrives as an equation.';
      E.stage.replaceChildren(h('h2', { class: 'big-q' }, `${c} of 3.`), h('p', { class: 'prose' }, why), h('p', { class: 'small', style: { marginTop: '10px' } }, 'You can change the depth any time with the dial in the margin of a lesson.'), h('div', { class: 'row', style: { marginTop: '22px' } }, h('a', { class: 'act go', href: '#m-' + start }, 'Start the lesson now', h('span', { 'aria-hidden': 'true' }, '→')), h('a', { class: 'btn', href: '#learn' }, 'See all modules')));
      E.voice.replaceChildren(h('p', { class: 'say-m' }, 'Done. Your answers seeded the model of what you know; every exercise from here refines it.'));
    }
    track(); show();
  }

  /* ---------------- Today ---------------- */
  function nextLesson() { const ch = COURSE.chapters[2], P = Store.get().progress, pl = Store.get().placement; const pend = ch.lessons.filter(l => (P[l.id] || 0) < 1);
    if (pl && pl.start && (P[pl.start] || 0) < 1) return ch.lessons.find(l => l.id === pl.start); return pend[0] || null; }
  function whyLine(L) {
    const pl = Store.get().placement, A = Store.get().attempts, miss = A.filter(a => !a.ok && a.mis).slice(-5), prof = Store.get().profile || {};
    if (!L) return 'Chapter 2 is complete. The chapter exam will ink it in for good.';
    if (miss.length) { const m = miss[miss.length - 1].mis; const say = { 'hidden-value': 'Last time you treated a superposition as a hidden 0-or-1.', 'global-phase': 'Last time a global phase looked meaningful to you.', 'odds-as-quota': 'Last time the odds looked like a quota for a few shots.', 'basis-blind': 'Last time you assumed randomness doesn’t depend on the question.', 'sphere-angle': 'Last time sphere angles and state angles got mixed up.', 'phase-blind': 'Last time two states with equal odds looked identical.' }[m]; if (say) return `${say} “${L.title}” is where that gets settled.`; }
    if (pl && pl.results && pl.results[1] === false && L.id === 'l-2-4') return 'In placement you predicted H·Z·H as a coin. This lesson is about the phase that makes it certain.';
    if (prof.guessedInterference === false && L.id === 'l-2-1') return 'At Arrival you expected two H’s to act like two coin flips. This lesson starts with what the qubit is actually holding.';
    return `Next in order. It takes about ${L.minutes} minutes and ends with a field note.`;
  }
  function today(el) {
    const prof = Store.get().profile || {}, L = nextLesson(), due = Store.get().notes.filter(n => n.task && n.due <= Date.now()).slice(0, 3), ch = COURSE.chapters[2], lab = Store.get().lab;
    const now = new Date(), hr = now.getHours(), greet = hr < 5 ? 'Late night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    const mini = svg('svg', { class: 'today-sphere', viewBox: '0 0 280 260', width: 280, height: 260, role: 'img', 'aria-label': L ? `A preview of “${L.title}”` : 'The qubit' });
    const S = Ink.sphere(mini, { cx: 140, cy: 130, R: 96, tipR: 5 });
    // the next lesson's key moment, looping quietly
    const path = { 'l-2-1': [[0, 0, 1], [.866, 0, .5], [1, 0, 0]], 'l-2-2': [[.866, 0, .5], [0, 0, 1], [.866, 0, .5], [0, 0, -1]], 'l-2-3': [[1, 0, 0], [0, 1, 0], [0, -1, 0]], 'l-2-4': [[1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, -1, 0]], 'l-2-5': [[0, 0, 1], [.612, .612, .5], [0, 1, 0]] }[L ? L.id : 'l-2-5'];
    let k = 0, timer = null; const loop = () => { S.to(path[k % path.length], 1.1); k++; if (!Motion.reduced) timer = setTimeout(loop, 1900); }; loop();
    const rev = h('div', { class: 'review' });
    if (!due.length) rev.append(h('p', { class: 'small' }, Store.get().notes.length ? 'Nothing is due. Field notes come back a day after you keep them, then at growing intervals.' : 'Field notes you keep at the end of each lesson come back here for a three-minute review.'));
    due.forEach(n => { const ans = h('p', { class: 'note', hidden: true }, n.text), acts = h('div', { class: 'row', hidden: true });
      acts.append(h('button', { type: 'button', class: 'btn', onclick: () => { Store.reviewed(n.id, true); item.classList.add('is-done'); acts.replaceChildren(h('span', { class: 'lbl' }, 'Back in ' + Math.round(Math.pow(2.2, n.reviews)) + ' days')); } }, 'I Had It'), h('button', { type: 'button', class: 'btn', onclick: () => { Store.reviewed(n.id, false); item.classList.add('is-done'); acts.replaceChildren(h('span', { class: 'lbl' }, 'Back tomorrow')); } }, 'I Didn’t'));
      const item = h('div', { class: 'rev-item' }, h('p', { class: 'serif rev-q' }, n.task.label), h('button', { type: 'button', class: 'btn', onclick: e => { e.currentTarget.remove(); ans.hidden = false; acts.hidden = false; } }, 'Reveal'), ans, acts); rev.append(item); });
    const labBlock = h('div', { class: 'today-lab' });
    el.replaceChildren(h('div', { class: 'page today' },
      h('header', { class: 'today-head' }, h('p', { class: 'lbl' }, now.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' })), h('h1', { class: 'display' }, `${greet}${prof.name ? ', ' + prof.name : ''}.`)),
      h('section', { class: 'today-next' },
        h('div', { class: 'tn-copy' }, h('p', { class: 'lbl' }, L ? `Next · Chapter 2, lesson ${L.n} · ${L.minutes} min` : 'Chapter 2'), h('h2', { class: 'tn-title' }, L ? L.title : 'Chapter 2 is complete'), h('p', { class: 'note' }, whyLine(L)),
          h('div', { class: 'row', style: { marginTop: '18px' } }, L ? h('a', { class: 'act go', href: '#' + L.id }, (Store.get().progress[L.id] || 0) > 0 ? 'Continue' : 'Begin', h('span', { 'aria-hidden': 'true' }, '→')) : h('a', { class: 'act go', href: '#exam-2' }, 'Take the Chapter Exam', h('span', { 'aria-hidden': 'true' }, '→')), h('a', { class: 'btn', href: '#course' }, 'See the Atlas')),
          h('ol', { class: 'tn-lessons' }, ch.lessons.map(l => { const p = Store.get().progress[l.id] || 0; return h('li', { class: p >= 1 ? 'done' : l === L ? 'now' : '' }, h('span', { class: 'mono' }, `2.${l.n}`), ' ', l.title); }))),
        mini),
      h('div', { class: 'today-row' },
        h('section', {}, h('h2', { class: 'sect-h' }, 'Three-minute review'), rev),
        h('section', {}, h('h2', { class: 'sect-h' }, 'Last in the Laboratory'), labBlock))));
    if (lab && lab.ops && lab.ops.length) { const sc = h('div'); labBlock.append(h('p', { class: 'serif', style: { fontSize: '20px' } }, lab.name || 'Untitled circuit'), sc, h('a', { class: 'btn', href: '#lab' }, 'Open It in the Laboratory')); Course.miniScore(sc, IR.clone(lab), lab.n); }
    else labBlock.append(h('p', { class: 'small' }, 'Nothing built yet. The Laboratory is an open bench: twelve qubits, four SDKs, and a few missions to start you off.'), h('a', { class: 'btn', href: '#lab' }, 'Open the Laboratory'));
    return { destroy() { clearTimeout(timer); } };
  }
  return { arrival, placement, today, nextLesson, whyLine };
})();
