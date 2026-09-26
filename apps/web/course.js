/* =====================================================================
   COURSE — Atlas, the six-beat lesson player, exercises, chapter exam.
   Beats advance only by action. A wrong prediction loops back to Explore.
===================================================================== */
const BEATS = ['Discover', 'Explore', 'Manipulate', 'Predict', 'Experiment', 'Understand'];
const Course = (() => {
  const fill = (s, L) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => L && L.nums && L.nums[k] ? L.nums[k]() : m);
  const prose = (s, L) => Tex.prose(fill(s, L));
  const depth = () => Store.get().depth || 'intuition';
  const beatsOf = () => Store.get().beats || {};
  function setBeat(id, b) { const all = Object.assign({}, beatsOf()); all[id] = Math.max(all[id] || 0, b); Store.set('beats', all); Store.progress(id, b / 6); }
  function lessonDone(id) { return (Store.get().progress[id] || 0) >= 1; }
  function mastery(ch) { const L = ch.lessons; return L.reduce((a, l) => a + Math.min(1, (Store.get().progress[l.id] || 0) * .6 + Knowledge.get(l.concept) * .4 * ((Store.get().progress[l.id] || 0) > 0 ? 1 : 0)), 0) / L.length; }

  /* ---------------- small shared pieces ---------------- */
  function miniScore(host, dsl, n = 1, playhead) { const c = typeof dsl === 'string' ? Q.parse(n, dsl) : dsl; const s = Score(host, { circ: c, editable: false, compact: true, minCols: Math.max(3, IR.cols(c) + 1) }); if (playhead != null) s.setPlayhead(playhead); return s; }
  function oddsBars(host, prob, keys) { host.replaceChildren(...keys.map(k => h('div', { class: 'qs-bar' }, h('span', { class: 'mono' }, `|${k}⟩`), h('i', { style: { '--s': (prob[k] || 0).toFixed(4) } }), h('b', { class: 'mono' }, fmt.f(prob[k] || 0, 3))))); }
  function keysFor(C) { const qs = Sim.measuredQubits(C) || [...Array(C.n).keys()]; return Array.from({ length: 1 << qs.length }, (_, i) => i.toString(2).padStart(qs.length, '0')); }
  // parameter slider for the selected gate of an editable score
  function paramEditor(host, score, onChange) {
    const paint = () => { const ids = score.selection, o = score.circ.ops.find(x => ids.includes(x.id)); host.replaceChildren(); if (!o || !(o.p || []).length) return;
      o.p.forEach((pv, k) => host.append(Ctl.slider({ label: `${Sim.displayName(o).split('(')[0]} ${['θ', 'φ', 'λ'][k]}`, min: -Math.PI, max: Math.PI, step: Math.PI / 48, value: typeof pv === 'number' ? pv : 0, fmt: v => fmt.ang(v), notches: 8, onInput: v => { o.p[k] = v; score.render(); onChange('Parameter set', true); }, onChange: () => onChange('Parameter set') }))); };
    return { paint };
  }
  // editable code box with highlighting (lightweight; four SDKs)
  function CodeBox(host, { value = '', lang = 'qiskit', editable = true, tall } = {}) {
    const gut = h('div', { class: 'gut', 'aria-hidden': 'true' }), pre = h('pre', { 'aria-hidden': 'true' }), ta = h('textarea', { spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', wrap: 'off', 'aria-label': `${lang} code`, readonly: editable ? null : true });
    const box = h('div', { class: 'codebox' + (tall ? ' tall' : '') }, gut, pre, ta); host.replaceChildren(box);
    const paint = () => { pre.innerHTML = Code.highlight(ta.value); gut.textContent = ta.value.split('\n').map((_, i) => i + 1).join('\n'); };
    ta.addEventListener('input', paint); ta.addEventListener('scroll', () => { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; gut.scrollTop = ta.scrollTop; });
    ta.addEventListener('keydown', e => { if (e.key === 'Tab' && !e.shiftKey && editable) { e.preventDefault(); document.execCommand('insertText', false, '    '); } });
    ta.value = value; paint(); const n = value.split('\n').length; box.style.height = Math.min(420, Math.max(120, n * 20 + 28)) + 'px';
    return { el: box, get value() { return ta.value; }, set(v) { ta.value = v; paint(); const k = v.split('\n').length; box.style.height = Math.min(420, Math.max(120, k * 20 + 28)) + 'px'; }, ta };
  }

  /* ---------------- exercises (lessons, exam, placement) ---------------- */
  function Exercise(host, e, { L, index, onResult, exam } = {}) {
    const wrap = h('section', { class: 'ex', 'aria-label': `Exercise ${index + 1}` }), fb = h('div', { class: 'ex-fb', 'aria-live': 'polite' });
    const kindLab = { shape: 'Predict', build: 'Build', probe: 'Misconception check', num: 'Calculate', code: 'Code' }[e.kind];
    const bcls = { shape: 'b-cyan', build: 'b-violet', probe: 'b-magenta', num: 'b-lime', code: 'b-ink' }[e.kind]; wrap.append(h('div', { class: 'ex-head' }, h('span', { class: 'ex-n mono' }, String(index + 1).padStart(2, '0')), h('span', { class: 'badge ' + bcls }, { shape: 'Predict', build: 'Circuit', probe: 'Misconception', num: 'Calculate', code: 'Code' }[e.kind])), h('p', { class: 'ex-q', html: prose(e.q, L) }));
    host.append(wrap); let done = false;
    const result = (ok, extra = {}) => { const first = !done; done = done || ok; const a = Store.attempt(Object.assign({ concept: e.concept || (L && L.concept), ok, kind: e.kind, item: (L ? L.id : 'exam') + ':' + index }, extra)); onResult && onResult(ok, first, a); wrap.classList.toggle('is-right', ok); };
    const say = (ok, html) => { fb.className = 'ex-fb ' + (ok ? 'right' : 'wrong'); fb.innerHTML = html; };
    if (e.kind === 'shape') {
      const C = Q.parse(1, e.circuit), keys = keysFor(C), sc = h('div', { class: 'ex-score' }), sh = h('div'); wrap.append(sc, sh); miniScore(sc, C);
      const S = Stage.Shaper(sh, { keys });
      wrap.append(h('div', { class: 'row' }, h('button', { type: 'button', class: 'primary', onclick: () => { const ex = Grade.exactDist(C), d = Grade.tvd(S.value, ex), ok = d <= .1; say(ok, `${ok ? 'Close enough' : 'Not quite'} — the exact odds are ${keys.map(k => `|${k}⟩ ${fmt.p(ex[k] || 0, 1)}`).join(', ')}. Your shape was off by ${fmt.p(d, 0)} of the probability.`); result(ok, { tvd: d }); } }, 'Check')), fb);
    }
    if (e.kind === 'build') {
      const C = { n: e.n, nc: e.n, ops: [], defs: {}, params: {} }, sc = h('div', { class: 'ex-score' }), cs = h('div', { class: 'typecase', role: 'toolbar', 'aria-label': 'Gates you may use' }), pe = h('div', { class: 'ex-param' }), live = h('div', { class: 'qs-odds small-odds' });
      wrap.append(cs, sc, pe, live);
      let S; const update = () => { oddsBars(live, Grade.exactDist(C), keysFor({ n: C.n, ops: [] })); fb.textContent = ''; }; const edit = (c) => { Object.assign(C, c); PE.paint(); update(); };
      S = Score(sc, { circ: C, editable: true, fixedQubits: true, maxQubits: e.n, minQubits: e.n, gates: e.gates, compact: true, minCols: 6, onChange: edit, onSelect: () => PE.paint() });
      const PE = paramEditor(pe, S, update); TypeCase(cs, { groups: [e.gates], getScore: () => S }); edit(C);
      wrap.append(h('div', { class: 'row' }, h('button', { type: 'button', class: 'primary', onclick: () => {
        const spec = Object.assign({ n: e.n, gates: e.gates }, e.spec), r = Grade.check(S.circ, spec);
        if (r.ok) { say(true, 'It behaves exactly like the reference.'); result(true); return; }
        let msg = r.why || 'Not yet.'; const d = !r.why && Grade.diagnose(S.circ, spec);
        if (d) { const f = (s) => { const p = Sim.probs(s); return Array.from(p).map((x, i) => x > 1e-6 ? `${fmt.f(x, 2)} ${Sim.ket(i, e.n)}` : null).filter(Boolean).join(' + '); };
          msg = d.phaseOnly ? 'Every input goes to the right place, but the relative phases between inputs differ.' : `On input ${Sim.ket(parseInt(d.input, 2), e.n)} yours gives <span class="mono">${esc(f(d.mine))}</span>; the target gives <span class="mono">${esc(f(d.want))}</span>.` + (d.step != null && d.gates.length ? ` Your circuit leaves the reference path at step ${d.step + 1} (${d.gates.map(g => esc(Sim.displayName(g))).join(', ')}).` : '');
          if (d.gates && d.gates.length) S.select(d.gates.map(g => g.id)); }
        say(false, msg); result(false, { sig: Q.text(S.circ), step: d && d.step }); } }, 'Check'), h('button', { type: 'button', class: 'btn', onclick: () => { S.set({ n: e.n, nc: e.n, ops: [], defs: {}, params: {} }, true); edit(S.circ); } }, 'Clear')), fb);
    }
    if (e.kind === 'probe') {
      const pick = v => { const ok = v === e.a; say(ok, `${ok ? 'Right.' : 'Not so.'} ${prose(e.why, L)}`); result(ok, { mis: ok ? null : e.mis }); btns.forEach(b => b.setAttribute('aria-pressed', b.dataset.v === String(v))); };
      const btns = [true, false].map(v => h('button', { type: 'button', class: 'pill', 'data-v': String(v), 'aria-pressed': 'false', onclick: () => pick(v) }, v ? 'True' : 'False'));
      wrap.append(h('div', { class: 'row' }, ...btns), fb);
    }
    if (e.kind === 'num') {
      const inp = h('input', { class: 'uline mono', inputmode: 'decimal', autocomplete: 'off', 'aria-label': 'Your answer', placeholder: 'e.g. 0.5' });
      const check = () => { const raw = inp.value.trim().replace(',', '.'); let v; try { v = Sim.evalExpr(raw, {}); } catch (x) { v = NaN; } if (!raw || isNaN(v)) { inp.setAttribute('aria-invalid', 'true'); say(false, 'Type a number — decimals or expressions like pi/3 both work.'); return; } inp.removeAttribute('aria-invalid'); const ok = Math.abs(v - e.a) <= e.tol; say(ok, `${ok ? 'Right.' : `Not quite — you gave ${fmt.f(v, 3)}.`} ${prose(e.why, L)}`); result(ok); };
      inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') check(); });
      wrap.append(h('div', { class: 'row' }, inp, h('button', { type: 'button', class: 'primary', onclick: check }, 'Check')), fb);
    }
    if (e.kind === 'code') {
      const cb = h('div'); wrap.append(cb); const CB = CodeBox(cb, { value: e.starter || '', lang: e.lang });
      wrap.append(h('div', { class: 'row' }, h('button', { type: 'button', class: 'primary', onclick: () => { const r = Code.parse(e.lang, CB.value); if (r.errors.length) { say(false, esc(r.errors[0].msg)); result(false); return; } const C = { n: Math.max(r.n || 1, e.n), nc: r.nc, ops: r.ops.map(o => IR.op(o.g, o.q, o)), params: {} }; const g = Grade.check(C, Object.assign({ n: e.n }, e.spec)); say(g.ok, g.ok ? 'Your code prepares the right state.' : (g.why || 'It runs, but the state it prepares is different.')); result(g.ok); } }, 'Run tests')), fb);
    }
    return wrap;
  }

  /* ---------------- Atlas ---------------- */
  function drawMini(sv, m) {
    // chapter drawing: a sphere, pencil when untouched, inked in with mastery
    sv.replaceChildren(); sv.setAttribute('viewBox', '0 0 120 120'); const S = Ink.sphere(sv, { cx: 60, cy: 60, R: 42, labels: false, tipR: 3.5 });
    S.st.v = [Math.sin(1.1) * Math.cos(.8), Math.sin(1.1) * Math.sin(.8), Math.cos(1.1)]; S.draw(); sv.style.setProperty('--ink-level', (.25 + .75 * m).toFixed(2)); sv.classList.toggle('pencil', m < .02);
  }
  function atlas(el) {
    const ch2 = COURSE.chapters[2], m2 = mastery(ch2), ex = (Store.get().exams || {})[2];
    const rows = CATALOGUE.map(part => h('section', { class: 'part' }, h('h2', { class: 'part-h' }, h('span', { class: 'mono' }, `Part ${part.part}`), ' ', part.name),
      ...part.chapters.map(([n, title, blurb]) => { const open = !!COURSE.chapters[n];
        if (!open) return h('div', { class: 'chap is-later' }, h('span', { class: 'chap-n' }, String(n)), h('div', {}, h('h3', {}, title), h('p', { class: 'small' }, blurb)), h('span', { class: 'lbl' }, 'In preparation'));
        const ch = COURSE.chapters[n], sv = svg('svg', { class: 'chap-mini', width: 120, height: 120, role: 'img', 'aria-label': `Chapter ${n} drawing, ${Math.round(mastery(ch) * 100)}% inked in` }); drawMini(sv, mastery(ch));
        return h('div', { class: 'chap is-open' }, h('span', { class: 'chap-n' }, String(n)),
          h('div', {}, h('h3', {}, title), h('p', { class: 'small' }, ch.blurb),
            h('ol', { class: 'lessons' }, ch.lessons.map(l => { const p = Store.get().progress[l.id] || 0; return h('li', {}, h('a', { href: '#' + l.id }, h('span', { class: 'mark', 'aria-hidden': 'true' }, p >= 1 ? '●' : p > 0 ? '◐' : '○'), h('span', {}, `${n}.${l.n}  ${l.title}`), h('span', { class: 'lbl' }, p >= 1 ? 'done' : p > 0 ? `${BEATS[Math.min(5, Math.round(p * 6))]}` : `${l.minutes} min`))); }),
              h('li', {}, h('a', { href: '#exam-' + n }, h('span', { class: 'mark', 'aria-hidden': 'true' }, ex && ex.pass ? '●' : '○'), h('span', {}, 'Chapter exam'), h('span', { class: 'lbl' }, ex ? `${ex.score}/${ex.of}${ex.pass ? ' · passed' : ''}` : '12 items'))))),
          sv); }))) ;
    el.replaceChildren(h('div', { class: 'page atlas' },
      h('header', { class: 'page-head' }, h('p', { class: 'lbl' }, 'Course'), h('h1', { class: 'display' }, 'Atlas'), h('p', { class: 'prose' }, 'Sixteen chapters in four parts, from one qubit to algorithms on noisy machines. Each chapter’s drawing starts in pencil and inks in as you master it.'),
        h('p', { class: 'small' }, `Chapter 2 is ${Math.round(m2 * 100)}% inked in.`)),
      ...rows));
  }

  /* ---------------- the lesson player ---------------- */
  function lesson(el, id) {
    const found = COURSE.lesson(id); if (!found) { el.replaceChildren(h('p', { class: 'prose', style: { padding: '40px' } }, 'That lesson doesn’t exist.')); return; }
    const { ch, l: L } = found; let beat = Math.min(5, beatsOf()[L.id] || 0), looped = false, prediction = null, cleanup = [];
    const E = {};
    App.top(['Course', `Chapter ${ch.id} · ${ch.title}`, `${ch.id}.${L.n} ${L.title}`]);
    const root = h('div', { class: 'lesson2' },
      h('div', { class: 'l-stage' },
        h('div', { class: 'l-top' }, E.track = h('nav', { class: 'beats', 'aria-label': 'Lesson beats' })),
        h('section', { class: 'stage-card' }, E.stage = h('div', { class: 'beat-stage', 'aria-live': 'polite' }))),
      h('aside', { class: 'reading' },
        h('p', { class: 'lbl' }, h('a', { href: '#course' }, `Chapter ${ch.id} · ${ch.title}`), ` · lesson ${L.n} of ${ch.lessons.length} · ${L.minutes} min`),
        h('h1', { class: 'r-title' }, L.title),
        h('div', { class: 'row', style: { marginTop: '14px' } }, E.dial = Ctl.dial({ value: depth(), onChange: v => { Store.set('depth', v); if (beat === 5) renderUnderstand(); } })),
        E.voice = h('div', { class: 'voice' }), E.hints = h('div', { class: 'hints' }), E.tutor = h('div', { class: 'r-tutor' })));
    el.replaceChildren(root);
    E.inline = h('div', { class: 'inline-voice' }); E.track.after(E.inline);
    const mq = matchMedia('(max-width: 1000px)'), place = () => { if (mq.matches) E.inline.append(E.voice, E.hints); else E.tutor.before(E.voice, E.hints); }; mq.addEventListener('change', place); place(); const life = [() => mq.removeEventListener('change', place)];
    const tutor = Tutor.mount(E.tutor, () => ({ circuit: E.circ || null, mode: 'guide', where: `Lesson ${ch.id}.${L.n} “${L.title}”, beat ${BEATS[beat]}`, depth: depth(), fallback: fill(L.understand.intuition, L) }), { placeholder: 'Ask about this beat…', onPencil: list => E.score && E.score.pencil(list), resolve: t => { const [k, v] = String(t).split(':'); if (k === 'op' && E.score) return E.score.el.querySelector(`[data-id="${v}"]`); if (k === 'qubit') return E.stage.querySelector('.qs-sphere'); return E.stage.querySelector('.tray, .shaper-wrap') || null; } });
    function track() {
      E.track.replaceChildren(h('ol', {}, BEATS.map((b, i) => h('li', { class: i < beat ? 'done' : i === beat ? 'now' : 'later' }, h('button', { type: 'button', disabled: i > (beatsOf()[L.id] || 0) ? true : null, 'aria-current': i === beat ? 'step' : null, onclick: () => { if (i !== beat) go(i); } }, h('span', { class: 'bi', 'aria-hidden': 'true' }, i < beat ? icon('check', 's') : String(i + 1)), b)))));
    }
    function voice(...parts) { E.voice.replaceChildren(...parts.filter(Boolean).map(p => typeof p === 'string' ? h('p', { class: 'say-m', html: prose(p, L) }) : p)); }
    function continueBtn(label, to) { return h('button', { type: 'button', class: 'primary go', onclick: () => go(to) }, label, icon('arrow', 's')); }
    function go(b) { cleanup.forEach(f => f()); cleanup = []; beat = b; setBeat(L.id, b); E.hints.replaceChildren(); E.score = null; E.circ = null; track(); E.stage.classList.remove('loop', 'understand'); E.stage.replaceChildren(); E.stage.classList.remove('fade'); void E.stage.offsetWidth; E.stage.classList.add('fade');
      [renderScene.bind(null, 'discover'), renderScene.bind(null, 'explore'), renderManipulate, renderPredict, renderExperiment, renderUnderstand][b](); window.scrollTo({ top: 0, behavior: Motion.reduced ? 'auto' : 'smooth' }); }

    /* ---- Discover / Explore: a live qubit scene with a goal ---- */
    function renderScene(kind) {
      const B = L[kind], sc = B.scene, info = { measured: 0, poured: false, frac1: 0, turned: 0, lastPhi: null }; let reached = false;
      if (kind === 'discover') E.stage.append(h('h2', { class: 'big-q' }, B.q));
      else E.stage.append(h('p', { class: 'beat-q serif' }, fill(B.prompt, L)));
      if (kind === 'explore' && looped) { E.stage.classList.add('loop'); }
      const host = h('div'), extra = h('div', { class: 'scene-extra' }); E.stage.append(host, extra);
      const Qs = Stage.QubitStage(host, Object.assign({}, sc, { basis: sc.basis0, onState: (s, i) => { Object.assign(info, i); if (i.manual && info.lastPhi != null) { let d = i.manual.phi - info.lastPhi; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; info.turned += Math.abs(d); } if (i.manual) info.lastPhi = i.manual.phi; check(); } }));
      let tray = null;
      if (sc.measure || sc.pour) {
        const th = h('div', { class: 'scene-tray' }); extra.append(th); tray = Stage.Tray(th, { keys: ['0', '1'], height: 150, label: 'Measurement results', cap: sc.pour || 40 });
        const row = h('div', { class: 'row' }); extra.append(row);
        if (sc.measure) row.append(h('button', { type: 'button', class: 'btn', onclick: async ev => { const b = ev.currentTarget; b.disabled = true; const [p0] = Qs.odds(), v = Math.random() < p0 ? 0 : 1; await Qs.collapse(v); tray.pour([String(v)]); info.measured++; b.disabled = false; check(); } }, 'Measure Once'));
        if (sc.pour) row.append(h('button', { type: 'button', class: 'btn', onclick: async ev => { const b = ev.currentTarget; b.disabled = true; tray.clear(); const [p0] = Qs.odds(); const ks = Stage.sampleKeys({ '0': p0, '1': 1 - p0 }, sc.pour); const c = await tray.pour(ks, { maxAnimated: 60 }); info.poured = true; info.frac1 = (c['1'] || 0) / sc.pour; b.disabled = false; check(); } }, `Pour ${sc.pour} Shots`));
      }
      voice(kind === 'discover' ? B.prompt : null, kind === 'explore' && looped ? h('p', { class: 'note loopnote' }, fill(L.explore.loop, L)) : null);
      function check() { if (reached || !B.goal(info)) return; reached = true; Store.attempt({ concept: L.concept, ok: true, kind }); voice(h('p', { class: 'say-m done', html: prose(B.done, L) }), continueBtn(kind === 'discover' ? 'Explore' : 'Now Build It', kind === 'discover' ? 1 : 2)); announce(fill(B.done, L)); }
      check();
    }

    /* ---- Manipulate: build on the score ---- */
    function renderManipulate() {
      const M = L.manipulate, n = M.n, spec = Object.assign({ n, gates: M.gates }, M.spec); let C = { n, nc: n, ops: [], defs: {}, params: {} }, ok = false, hint = 0, t0 = Date.now();
      E.stage.append(h('p', { class: 'beat-q serif', html: prose(M.goal, L) }));
      const cs = h('div', { class: 'typecase', role: 'toolbar', 'aria-label': 'Gates for this task' }), sc = h('div', { class: 'lesson-score' }), pe = h('div', { class: 'ex-param' });
      const live = h('div', { class: 'build-live' }), sph = svg('svg', { class: 'qs-sphere', viewBox: '0 0 220 200', width: 220, height: 200, role: 'img', 'aria-label': 'Where your circuit points the qubit' }), odds = h('div', { class: 'qs-odds' }), meter = h('div', { class: 'meter', role: 'meter', 'aria-label': 'How close your state is to the target', 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i'), h('span', { class: 'lbl' }));
      live.append(sph, h('div', {}, h('p', { class: 'lbl' }, 'Odds'), odds, h('p', { class: 'lbl', style: { marginTop: '14px' } }, 'Closeness to the target'), meter));
      E.stage.append(cs, sc, pe, live); const S1 = Ink.sphere(sph, { cx: 110, cy: 100, R: 72, tipR: 4.5 });
      const edit = (c, label) => { C = c; PE.paint(); update(); }; const update = () => { C = S ? S.circ : C; E.circ = C; const s = Sim.run(Grade.strip(C)); S1.to(Sim.bloch(s, 0), .35); oddsBars(odds, Grade.exactDist(C), keysFor({ n, ops: [] })); const r = Grade.check(C, spec); meter.firstChild.style.transform = `scaleX(${Math.max(0, r.score).toFixed(4)})`; meter.lastChild.textContent = fmt.p(Math.max(0, r.score), 0); meter.setAttribute('aria-valuenow', Math.round(r.score * 100));
        if (r.ok && !ok) { ok = true; Store.attempt({ concept: L.concept, ok: hint < 3, kind: 'manipulate', hints: hint, secs: Math.round((Date.now() - t0) / 1000) }); voice(h('p', { class: 'say-m done' }, 'That’s it — your circuit makes exactly the target state.'), continueBtn('Predict', 3)); S.pencil([]); }
        else if (!r.ok && r.why && C.ops.length) voice(M.goal && fill(M.goal, L), h('p', { class: 'small err' }, r.why)); };
      const S = Score(sc, { circ: C, editable: true, fixedQubits: true, maxQubits: n, minQubits: n, gates: M.gates, minCols: 8, onChange: edit, onSelect: () => PE.paint() }); E.score = S;
      const PE = paramEditor(pe, S, update); TypeCase(cs, { groups: [M.gates], getScore: () => S }); edit(C);
      voice('Drag gates from the case onto the score, or tap a gate and then a cell. Select a rotation to set its angle.');
      const ladder = () => { E.hints.replaceChildren(h('p', { class: 'lbl' }, 'Stuck here?'), ...M.hints.slice(0, hint).map((t, i) => h('p', { class: 'hint', html: `<span class="mono">${i + 1}</span> ${prose(t, L)}` })),
        hint < 3 ? h('button', { type: 'button', class: 'btn', onclick: () => { hint++; if (hint === 2) { const b = [...cs.querySelectorAll('.gmark')].find(x => x.textContent === (LABEL[Q.parse(n, M.partial).ops[0]?.g] || Q.parse(n, M.partial).ops[0]?.g)); b && b.classList.add('flash'); } if (hint === 3) S.ghost(Q.parse(n, M.partial).ops); ladder(); } }, ['Ask a Question', 'Show Me Where', 'Pencil a Partial Fix'][hint]) : null); };
      ladder();
    }

    /* ---- Predict: by shaping ---- */
    function renderPredict() {
      const P = L.predict, C = Q.parse(1, P.circuit), wrap = h('div', { class: 'predict' }); E.circ = C;
      E.stage.append(h('p', { class: 'beat-q serif', html: prose(P.q, L) }), h('div', { class: 'predict-circ' }, h('span', { class: 'lbl' }, 'The circuit'), (() => { const d = h('div'); miniScore(d, C); return d; })()), wrap);
      let get; const commit = h('button', { type: 'button', class: 'primary go', onclick: () => { prediction = get(); Store.set('predictions', Object.assign({}, Store.get().predictions, { [L.id]: prediction })); go(4); } }, 'Commit and Run the Experiment', h('span', { 'aria-hidden': 'true' }, '→'));
      if (P.kind === 'bins') { const S = Stage.Shaper(wrap, { keys: keysFor(C) }); get = () => ({ kind: 'bins', v: S.value }); voice('Drag each bar to the height you expect. The bars always add up to 100%.'); }
      if (P.kind === 'arrow') { const G = Stage.GhostSphere(wrap, { value: [0, 0, 1] }); get = () => ({ kind: 'arrow', v: G.value }); voice('Drag the ghost arrow to where you think the qubit ends up. The experiment will reconstruct the real arrow from measurements along Z, X and Y.'); }
      if (P.kind === 'needle') { const N = Stage.Needle(wrap, { value: 0, label: 'Your guess for the phase of |1⟩', R: 84 }); get = () => ({ kind: 'needle', v: N.value }); voice('Turn the needle to the phase you expect. A phase can’t be read directly, so the experiment adds an H and pours shots: the odds of 0 will be cos²(φ/2).'); }
      E.stage.append(h('div', { class: 'row', style: { marginTop: '18px' } }, commit));
    }

    /* ---- Experiment: pour, compare, loop back if wrong ---- */
    async function renderExperiment() {
      const P = L.predict, C = Q.parse(1, P.circuit); prediction = prediction || (Store.get().predictions || {})[L.id]; E.circ = C;
      if (!prediction) { go(3); return; }
      const out = h('div', { class: 'exp-out', 'aria-live': 'polite' }); let pass = false, summary = '';
      E.stage.append(h('p', { class: 'beat-q serif' }, 'The experiment'));
      if (P.kind === 'bins' || P.kind === 'needle') {
        const run = P.kind === 'needle' ? Q.parse(1, P.circuit + ' H0') : C, ex = Grade.exactDist(run), keys = keysFor(run), th = h('div'); E.stage.append(th, out);
        const pred = P.kind === 'bins' ? prediction.v : { '0': Math.cos(prediction.v / 2) ** 2, '1': Math.sin(prediction.v / 2) ** 2 };
        const T = Stage.Tray(th, { keys, height: 230, label: '1,000 shots, with your prediction drawn as dashed lines' }); T.ghost(pred, 1000);
        voice('Your prediction is drawn as dashed lines. Pouring 1,000 shots…');
        const c = await T.pour(Stage.sampleKeys(ex, 1000));
        const obs = {}; keys.forEach(k => obs[k] = (c[k] || 0) / 1000); const d = Grade.tvd(pred, obs);
        if (P.kind === 'bins') { pass = d <= .15; summary = `Your shape was off by ${fmt.p(d, 0)} of the probability.`; }
        else { const s = Sim.run(C), actual = ((Sim.phase(s, 1) - Sim.phase(s, 0)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); let e = Math.abs(actual - prediction.v); e = Math.min(e, 2 * Math.PI - e); pass = e <= Math.PI / 8 + 1e-6; summary = `You guessed φ = ${fmt.ang(prediction.v)}; the phase was ${fmt.ang(actual)}.`; }
      } else if (P.kind === 'arrow') {
        const s = Sim.run(C), trays = h('div', { class: 'tomo' }), gs = h('div'); E.stage.append(h('div', { class: 'tomo-wrap' }, gs, trays), out);
        const G = Stage.GhostSphere(gs, { value: prediction.v, R: 100 }); const est = [];
        voice('To see an arrow you have to ask three questions. 300 shots along each of Z, X and Y rebuild it.');
        for (const [b, pre] of [['X', ' H0'], ['Y', ' SDG0 H0'], ['Z', '']]) { const th = h('div', { class: 'tomo-t' }, h('p', { class: 'lbl' }, `Along ${b}`)); trays.append(th); const td = h('div'); th.append(td); const ex = Grade.exactDist(Q.parse(1, P.circuit + pre)); const T = Stage.Tray(td, { keys: ['0', '1'], height: 130, grain: 2, cap: 300 }); const c = await T.pour(Stage.sampleKeys(ex, 300), { maxAnimated: 40 }); est.push(((c['0'] || 0) - (c['1'] || 0)) / 300); }
        const r = [est[0], est[1], est[2]]; G.reveal(r.map(x => x / Math.max(1, V3.len(r)))); const a = Math.acos(Math.max(-1, Math.min(1, (r[0] * prediction.v[0] + r[1] * prediction.v[1] + r[2] * prediction.v[2]) / (V3.len(r) || 1)))) * 180 / Math.PI;
        pass = a <= 30; summary = `The measured arrow is (${r.map(x => fmt.f(x, 2)).join(', ')}). Your ghost was ${Math.round(a)}° away.`;
      }
      Store.attempt({ concept: L.concept, ok: pass, kind: 'predict' });
      out.replaceChildren(h('div', { class: 'insight tint ' + (pass ? 'lime' : 'rose') }, h('span', { class: 'ins-ic' }, icon(pass ? 'check' : 'x')), h('div', {}, h('b', {}, pass ? 'Your prediction held' : 'The experiment disagreed'), h('p', {}, summary))));
      if (pass) voice(h('p', { class: 'say-m done' }, pass ? `${summary} Now the why.` : ''), continueBtn('Understand', 5));
      else { looped = true; voice(h('p', { class: 'say-m' }, `${summary} Go back and look again — the scene will point you to what to watch.`), h('button', { type: 'button', class: 'primary go', onclick: () => go(1) }, 'Back to Explore', h('span', { 'aria-hidden': 'true' }, '↺')), h('button', { type: 'button', class: 'btn', onclick: () => go(5) }, 'Skip to the explanation')); }
    }

    /* ---- Understand: depth, derivation, code, exercises, field note ---- */
    function renderUnderstand() {
      const U = L.understand, d = depth(), lv = { intuition: 0, formal: 1, research: 2 }[d]; E.stage.replaceChildren(); E.stage.classList.add('understand');
      const sec = (title, ic, ...kids) => h('section', { class: 'u-sec fade' }, h('h2', { class: 'u-h' }, icon(ic, 's'), title), ...kids);
      // reading column: the words, at the chosen depth
      voice(h('div', { class: 'r-lede', html: prose(U.intuition, L) }),
        lv >= 1 ? h('div', { class: 'r-sec' }, h('h3', {}, 'Formal statement'), h('div', { class: 'prose', html: prose(U.formal, L) })) : h('p', { class: 'small depth-hint' }, 'Switch to Formal for the statement in Dirac notation and a derivation you can scrub; Research adds the general theory and a primary source.'),
        lv >= 2 ? h('div', { class: 'r-sec' }, h('h3', {}, 'Research'), h('div', { class: 'prose', html: prose(U.research, L) }), h('p', { class: 'cite' }, U.cite)) : null);
      // stage card: everything you do
      if (lv >= 1) { const dv = h('div'); E.stage.append(sec('Derivation', 'layers', h('p', { class: 'small' }, 'Scrub through the steps. The circuit and the sphere follow along.'), dv)); scrubber(dv, U.derive); }
      const cd = h('div'); E.stage.append(sec('In code', 'code', cd)); codeBlock(cd, Q.parse(1, L.code, { name: L.title }));
      const exs = h('div', { class: 'exs' }); let right = 0; E.stage.append(sec('Exercises', 'practice', exs));
      L.exercises.forEach((x, i) => Exercise(exs, x, { L, index: i, onResult: (ok, first) => { if (ok && first) { right++; if (right === L.exercises.length) announce('All exercises correct.'); } } }));
      const kept = Store.get().notes.some(n => n.lesson === L.id);
      const fn = h('div', { class: 'fieldnote' }, h('p', {}, L.note), h('div', { class: 'meta' }, `Field note · ${ch.id}.${L.n} ${L.title}`));
      const keep = h('button', { type: 'button', class: 'btn', disabled: kept ? true : null, onclick: () => { Store.note({ kind: 'field', lesson: L.id, title: L.title, text: L.note, task: { kind: 'recall', label: `${L.title}: what’s the one idea?` } }); Store.progress(L.id, 1); keep.disabled = true; keep.textContent = 'Kept in your Notebook'; toast('Field note kept. It comes back for review tomorrow.'); } }, kept ? 'Kept in your Notebook' : 'Keep this note');
      E.stage.append(sec('Field note', 'notebook', fn, h('div', { class: 'row', style: { marginTop: '12px' } }, keep)));
      const nx = ch.lessons[L.n];
      E.stage.append(h('nav', { class: 'next' }, nx ? h('a', { class: 'primary', href: '#' + nx.id }, `Next: ${nx.title}`, icon('arrow', 's')) : h('a', { class: 'primary', href: `#exam-${ch.id}` }, 'Take the chapter exam', icon('arrow', 's')), h('a', { class: 'btn', href: '#course' }, 'Course map')));
      if (!kept) Store.progress(L.id, .95);
    }
    function scrubber(host, D) {
      const C = Q.parse(1, D.circuit), steps = D.steps; let k = 0;
      const eq = h('div', { class: 'eqn', 'aria-live': 'polite' }), why = h('p', { class: 'why' }), sd = h('div', { class: 'd-score' }), sv = svg('svg', { class: 'qs-sphere', viewBox: '0 0 180 170', width: 180, height: 170, role: 'img', 'aria-label': 'State at this step' }), S1 = Ink.sphere(sv, { cx: 90, cy: 85, R: 60, tipR: 4 });
      const count = h('span', { class: 'mono lbl' });
      const sl = Ctl.slider({ label: 'Step', min: 0, max: steps.length - 1, step: 1, value: 0, notches: steps.length - 1, fmt: v => `${v + 1} / ${steps.length}`, onInput: v => set(v) });
      host.append(h('div', { class: 'deriv' }, h('div', { class: 'd-main' }, eq, why, sl, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: () => set(Math.max(0, k - 1), true) }, '← Previous'), h('button', { type: 'button', class: 'btn', onclick: () => set(Math.min(steps.length - 1, k + 1), true) }, 'Next →'), count)), h('div', { class: 'd-side' }, sd, sv)));
      const sc = miniScore(sd, C, 0);
      function set(v, fromBtn) { const dir = v > k ? 1 : v < k ? -1 : 0; k = v; if (fromBtn) sl.set(v); const [tex, w, col] = steps[k];
        const html = Tex.html(fill(tex, L), true); if (dir && !Motion.reduced && window.gsap) { gsap.fromTo(eq, { opacity: 0, y: 10 * dir }, { opacity: 1, y: 0, duration: .35, ease: 'power2.out' }); } eq.innerHTML = html; why.textContent = fill(w, L); count.textContent = `step ${k + 1} of ${steps.length}`;
        sc.setPlayhead(col + 1); S1.to(Sim.bloch(Sim.run(C, col + 1), 0), .35); }
      set(0);
    }
    function codeBlock(host, C) {
      let lang = 'qiskit'; const box = h('div'), res = h('div', { class: 'scroll-x' }), note = h('p', { class: 'small' });
      const paint = () => CB.set(Code.gen(lang, C).text);
      host.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, Ctl.words([{ value: 'qiskit', label: 'Qiskit' }, { value: 'cirq', label: 'Cirq' }, { value: 'pennylane', label: 'PennyLane' }, { value: 'qasm', label: 'OpenQASM 3' }], lang, v => { lang = v; paint(); }, { label: 'Language' }),
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: () => copyText(CB.value, 'Code copied.') }, 'Copy'), h('button', { type: 'button', class: 'btn', onclick: async () => { const r = await Backends.runCircuit({ circuit: C, backend: 'browser', shots: 1000 }); const s = svg('svg', { role: 'img', 'aria-label': 'Result of running the code' }); res.replaceChildren(s); Ink.histogram(s, { keys: Object.keys(r.exact || r.counts).sort(), ideal: r.exact, series: [Object.assign(r, { fill: true })], width: 360, height: 150 }); note.textContent = `1,000 shots on the browser simulator in ${Math.round(r.meta.ms)} ms.`; } }, 'Run It'), h('a', { class: 'btn', href: '#lab', onclick: () => Lab.load(Object.assign(IR.clone(C), { name: C.name || L.title })) }, 'Open in the Laboratory'))), box, res, note);
      const CB = CodeBox(box, { value: '', lang, editable: false }); paint();
    }
    track(); go(beat);
    return { destroy() { cleanup.forEach(f => f()); life.forEach(f => f()); } };
  }

  /* ---------------- chapter exam ---------------- */
  function exam(el, chId) {
    const ch = COURSE.chapters[chId]; if (!ch) { el.replaceChildren(h('p', { class: 'prose', style: { padding: '40px' } }, 'That exam isn’t available yet.')); return; }
    const res = new Array(ch.exam.length).fill(null), tally = h('p', { class: 'mono lbl' }), items = h('div', { class: 'exs' }), out = h('div', { 'aria-live': 'polite' });
    const upd = () => { const n = res.filter(r => r !== null).length; tally.textContent = `${n} of ${ch.exam.length} answered`; submit.disabled = n < ch.exam.length; };
    const submit = h('button', { type: 'button', class: 'primary go', onclick: () => { const score = res.filter(Boolean).length, of = res.length, pass = score / of >= .7; const all = Object.assign({}, Store.get().exams, { [chId]: { score, of, pass, at: new Date().toISOString() } }); Store.set('exams', all);
      out.replaceChildren(h('div', { class: 'insight tint ' + (pass ? 'lime' : 'rose') }, h('span', { class: 'ins-ic' }, icon(pass ? 'trophy' : 'x')), h('div', {}, h('b', {}, pass ? `Passed — ${score} of ${of}` : `${score} of ${of} — you need ${Math.ceil(of * .7)} to pass`))), h('p', { class: 'small' }, pass ? 'Chapter 2 is inked into your Atlas. Your answers have updated the model of what you know.' : 'The items you missed are marked below. Revisit their lessons, then try again.'), h('a', { class: 'btn', href: '#course' }, 'Back to the Atlas')); out.scrollIntoView({ behavior: Motion.reduced ? 'auto' : 'smooth', block: 'center' }); } }, 'Submit the Exam');
    App.top(['Course', `Chapter ${ch.id}`, 'Exam']); el.replaceChildren(h('div', { class: 'page exam' }, h('header', { class: 'page-head' }, h('p', { class: 'lbl' }, `Chapter ${ch.id} · ${ch.title}`), h('h1', { class: 'display' }, 'Chapter exam'), h('p', { class: 'prose' }, `${ch.exam.length} items: predictions you shape, circuits you build, one piece of code, and checks for the common misconceptions. First answers count; 70% passes.`)), items, h('div', { class: 'row exam-foot' }, submit, tally), out));
    ch.exam.forEach((x, i) => Exercise(items, x, { index: i, exam: true, onResult: (ok, first) => { if (res[i] === null) res[i] = ok; upd(); } }));
    upd();
  }
  return { atlas, lesson, exam, Exercise, CodeBox, mastery, miniScore, keysFor, oddsBars, paramEditor, fill };
})();
