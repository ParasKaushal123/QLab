/* =====================================================================
   LEARN — the structured modules: hub (#learn), lesson player (#m-q1),
   module assessments (#assess-qubits) and the progress dashboard
   (#progress). Every page has the AI tutor beside it, fed with what the
   learner is reading, the widget they touched last and their mastery.
   Records: Store.learn = { checks, assess, done, time, days } plus
   Store.attempt(...) per answer, which updates Knowledge (BKT mastery).
===================================================================== */
const Learn = (() => {
  const LS = () => Object.assign({ checks: {}, assess: {}, done: {}, time: {}, days: {} }, Store.get().learn || {});
  const save = d => Store.set('learn', d);
  const today = () => new Date().toISOString().slice(0, 10);
  const pct = x => Math.round(x * 100) + '%';
  const checksOf = l => l.blocks.filter(b => b.q).map(b => b.q);
  function lessonState(id) { const x = LEARN.lesson(id); if (!x) return { passed: 0, total: 0, frac: 0, done: false }; const total = checksOf(x.l).length, rec = LS().checks[id] || {}; const passed = Object.values(rec).filter(r => r.ok).length; return { passed, total, frac: total ? passed / total : 0, done: !!LS().done[id] }; }
  function moduleState(m) { const ls = m.lessons.map(l => lessonState(l.id)); const at = LS().assess[m.id] || []; const best = at.reduce((a, r) => Math.max(a, r.score), 0); return { lessons: ls, done: ls.filter(s => s.done).length, frac: ls.reduce((a, s) => a + (s.done ? 1 : s.frac * .8), 0) / ls.length, best, attempts: at.length, passed: best >= m.assessment.pass }; }
  function nextLesson() { for (const { l } of LEARN.lessons()) if (!lessonState(l.id).done) return l; return null; }
  function logTime(id, secs) { if (secs < 2 || secs > 3 * 3600) return; const d = LS(); d.time[id] = (d.time[id] || 0) + secs; d.days[today()] = (d.days[today()] || 0) + secs; save(d); }
  function streak() { const d = LS().days; let s = 0; const t = new Date(); for (;;) { const k = t.toISOString().slice(0, 10); if (d[k]) { s++; t.setDate(t.getDate() - 1); } else { if (s === 0 && k === today()) { t.setDate(t.getDate() - 1); if (d[t.toISOString().slice(0, 10)]) continue; } break; } } return s; }
  function masteryLabel(c) { const tried = Store.get().attempts.some(a => a.concept === c); const v = Knowledge.get(c); return !tried ? ['Not started', 'ns'] : v >= .85 ? ['Mastered', 'ok'] : v >= .5 ? ['Learning', 'mid'] : ['Needs work', 'low']; }
  function progressSummary() {
    const c = LEARN.concepts(), lines = [];
    LEARN.modules.forEach(m => { const s = moduleState(m); lines.push(`Module ${m.n} ${m.title}: ${s.done}/${m.lessons.length} lessons done; assessment best ${s.attempts ? pct(s.best) : 'not taken'}${s.passed ? ' (passed)' : ''}.`); });
    const weak = Object.keys(c).filter(k => Store.get().attempts.some(a => a.concept === k)).sort((a, b) => Knowledge.get(a) - Knowledge.get(b)).slice(0, 4);
    if (weak.length) lines.push('Weakest concepts: ' + weak.map(k => `${CONCEPT_NAMES[k]} (${Knowledge.get(k).toFixed(2)}, lesson ${c[k].lesson} “${c[k].lessonTitle}”)`).join('; ') + '.');
    const nl = nextLesson(); if (nl) lines.push(`Next unfinished lesson: ${nl.id} “${nl.title}”.`);
    return lines.join('\n');
  }

  /* ---------------- a check (mcq / num / build) ---------------- */
  function Check(q, { mode = 'lesson', lesson, index, onResult, chat } = {}) {
    const fb = h('div', { class: 'lc-fb', 'aria-live': 'polite' }), wrap = h('section', { class: 'lc lc-' + q.type });
    const head = h('div', { class: 'lc-h' }, h('span', { class: 'lc-kind' }, { mcq: 'Check', num: 'Calculate', build: 'Build' }[q.type]), h('span', { class: 'lc-concept' }, CONCEPT_NAMES[q.concept] || ''));
    const qEl = h('div', { class: 'lc-q' }); qEl.innerHTML = Tex.prose(q.q);
    wrap.append(head, qEl);
    let answer = null, tries = 0, solved = false;
    const record = ok => { tries++; if (mode !== 'lesson') return; if (lesson) { const d = LS(); d.checks[lesson] = d.checks[lesson] || {}; const r = d.checks[lesson][index] || { ok: false, tries: 0 }; r.tries++; if (ok && !r.ok) { r.ok = true; r.first = r.tries === 1; } d.checks[lesson][index] = r; save(d); }
      Store.attempt({ kind: 'check', concept: q.concept, ok, lesson, first: tries === 1 }); onResult && onResult(ok); };
    const say = (cls, html, extra = []) => { fb.className = 'lc-fb ' + cls; fb.innerHTML = html; extra.forEach(x => x && fb.append(x)); };
    const explainBtn = (choice) => { const b = h('button', { type: 'button', class: 'lc-ai' }, icon('tutor', 's'), 'Explain it another way'); b.addEventListener('click', async () => { b.disabled = true; const box = h('div', { class: 'lc-aibox' }, h('div', { class: 'ai-dots' }, h('i'), h('i'), h('i'))); fb.append(box); const ctx = { check: q, choice, lesson: lesson ? LEARN.lesson(lesson).l : null, lessonText: lesson ? LEARN.lessonText(LEARN.lesson(lesson).l) : '', extra: `Question: ${q.q}\nLearner answered: ${choice != null && q.choices ? q.choices[choice].t : answer}\nCorrect answer: ${q.choices ? q.choices.find(c => c.ok).t : q.answer}` }; try { const r = await AI.ask('Why is my answer wrong, and what is the right way to think about it?', ctx, { persona: 'feedback', onText: t => box.replaceChildren(AIChat.render(t)) }); box.replaceChildren(AIChat.render(r.text)); } catch (e) { box.textContent = e.message; } }); return b; };
    if (q.type === 'mcq') {
      const opts = h('div', { class: 'lc-opts', role: mode === 'lesson' ? null : 'radiogroup' });
      q.choices.forEach((c, i) => { const b = h('button', { type: 'button', class: 'lc-opt', 'aria-pressed': 'false' }); b.innerHTML = Tex.prose(c.t); b.addEventListener('click', () => pick(i, b)); opts.append(b); });
      function pick(i, b) {
        if (mode !== 'lesson') { answer = i; opts.querySelectorAll('.lc-opt').forEach(x => x.setAttribute('aria-pressed', String(x === b))); onResult && onResult(); return; }
        if (solved) return; const c = q.choices[i]; answer = i; record(!!c.ok);
        opts.querySelectorAll('.lc-opt').forEach(x => x.classList.remove('bad'));
        if (c.ok) { solved = true; b.classList.add('good'); opts.querySelectorAll('.lc-opt').forEach(x => x.disabled = true); say('good', `<b>Correct.</b> ${Tex.prose(c.why || '')}`); }
        else { b.classList.add('bad'); say('bad', `<b>Not quite.</b> ${Tex.prose(c.why || 'Try another answer.')}`, [explainBtn(i)]); }
      }
      wrap.append(opts);
    } else if (q.type === 'num') {
      const inp = h('input', { class: 'lc-in mono', type: 'text', inputmode: 'decimal', placeholder: 'Your answer', 'aria-label': 'Your answer' });
      const go = h('button', { type: 'button', class: 'lc-go' }, mode === 'lesson' ? 'Check' : 'Save');
      const parse = v => { v = String(v).trim().replace(/−/g, '-').replace(/,/g, '.'); if (/^-?\d*\.?\d+\s*\/\s*\d+$/.test(v)) { const [a, b] = v.split('/'); return +a / +b; } try { return Sim.evalExpr(v.replace(/π/g, 'pi').replace(/√(\d+)/g, 'sqrt($1)')); } catch (e) { return Number(v); } };
      const submit = () => { const v = parse(inp.value); if (!isFinite(v)) { say('bad', 'Type a number, a fraction like 3/4, or an expression like pi/3.'); return; } answer = v; if (mode !== 'lesson') { go.textContent = 'Saved'; onResult && onResult(); return; } if (solved) return; const ok = Math.abs(v - q.answer) <= q.tol; record(ok); if (ok) { solved = true; inp.disabled = true; go.disabled = true; say('good', `<b>Correct.</b> ${Tex.prose(q.why || '')}`); } else say('bad', `<b>Not yet.</b> ${tries >= 2 ? Tex.prose(q.why || '') : 'Check your working and try again.'}`, [explainBtn(null)]); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }); go.addEventListener('click', submit); inp.addEventListener('input', () => { if (mode !== 'lesson') go.textContent = 'Save'; });
      wrap.append(h('div', { class: 'lc-row' }, inp, go));
    } else if (q.type === 'build') {
      const target = Circ.parse(q.n, q.target), T = Sim.run(target);
      const L = LW.lab({ n: q.n, gates: q.gates, show: ['probs', 'bloch'], askable: false }, { task: true });
      const tgt = h('p', { class: 'lc-target' }); tgt.innerHTML = 'Target: <span class="mono">' + esc(Insight.stateText(T)) + '</span>';
      const go = h('button', { type: 'button', class: 'lc-go' }, mode === 'lesson' ? 'Check my circuit' : 'Save circuit');
      const hint = h('button', { type: 'button', class: 'lc-ai' }, icon('tutor', 's'), 'Hint');
      const submit = () => { const C = L.circuit(); const f = Sim.fidelity(Sim.run(C), T), ok = f > 1 - 1e-6; answer = C; if (mode !== 'lesson') { go.textContent = 'Saved'; onResult && onResult(); return; } if (solved) return; record(ok); if (ok) { solved = true; say('good', `<b>That’s it.</b> Your circuit makes the target state${C.ops.length ? ' with ' + C.ops.length + ' gate' + (C.ops.length > 1 ? 's' : '') : ''}.`); } else { const cmp = Insight.compare(C, target); say('bad', `<b>Not yet.</b> You have <span class="mono">${esc(cmp.now.text)}</span> (overlap with the target ${(f * 100).toFixed(0)}%).${tries >= 2 ? ' One solution: ' + esc(q.solution) + '.' : ''}`); } };
      go.addEventListener('click', submit);
      hint.addEventListener('click', async () => { const box = h('div', { class: 'lc-aibox' }, h('div', { class: 'ai-dots' }, h('i'), h('i'), h('i'))); fb.className = 'lc-fb'; fb.replaceChildren(box); const r = await AI.ask('Give me a hint for this task', { circuit: L.circuit(), target, task: q.q.replace(/\$/g, ''), solutionText: tries >= 2 ? q.solution : null, lesson: lesson ? LEARN.lesson(lesson).l : null }, { onText: t => box.replaceChildren(AIChat.render(t)) }); box.replaceChildren(AIChat.render(r.text)); Store.attempt({ kind: 'hint', concept: q.concept, lesson }); });
      wrap.append(tgt, L.el, h('div', { class: 'lc-row' }, go, mode === 'lesson' ? hint : null));
      wrap._lab = L;
    }
    wrap.append(fb);
    return { el: wrap, get answer() { return answer; }, grade() { if (q.type === 'mcq') return answer != null && !!q.choices[answer].ok; if (q.type === 'num') return answer != null && Math.abs(answer - q.answer) <= q.tol; if (q.type === 'build') { const C = wrap._lab.circuit(); return Sim.fidelity(Sim.run(C), Sim.run(Circ.parse(q.n, q.target))) > 1 - 1e-6; } return false; }, answered() { return q.type === 'build' ? true : answer != null; }, lab: wrap._lab };
  }

  /* ---------------- hub ---------------- */
  function hub(el) {
    App.top(['Learn']);
    const total = LEARN.lessons().length, done = LEARN.lessons().filter(x => lessonState(x.l.id).done).length, nl = nextLesson();
    const head = h('header', { class: 'ln-head' },
      h('div', {}, h('p', { class: 'ln-kicker' }, 'Structured course'), h('h1', { class: 'display' }, 'Learn quantum computing'), h('p', { class: 'prose' }, 'Four modules, from a single qubit to Shor’s algorithm. Every lesson mixes theory and maths with examples you can touch, checks that respond, and a tutor that can see what you’re working on.')),
      h('div', { class: 'ln-hstat' }, ring(done / total, `${done}/${total}`, 'lessons'), h('div', {}, nl ? h('a', { class: 'ln-cta', href: '#m-' + nl.id }, done ? 'Continue: ' : 'Start: ', nl.title, icon('arrow', 's')) : h('span', { class: 'ln-cta done' }, 'All lessons complete'), h('a', { class: 'ln-sub', href: '#progress' }, icon('chart', 's'), 'Your progress and mastery'))));
    const mods = h('div', { class: 'ln-mods' }, LEARN.modules.map(m => { const s = moduleState(m);
      return h('section', { class: 'ln-mod t-' + m.tint }, h('div', { class: 'ln-mh' }, h('span', { class: 'ln-mn mono' }, String(m.n).padStart(2, '0')), h('div', {}, h('h2', {}, m.title), h('p', {}, m.blurb)), ring(s.frac, pct(s.frac), '', 54)),
        h('ol', { class: 'ln-ls' }, m.lessons.map((l, i) => { const st = lessonState(l.id); return h('li', {}, h('a', { href: '#m-' + l.id, class: st.done ? 'done' : st.passed ? 'part' : '' }, h('span', { class: 'ln-dot', 'aria-hidden': 'true' }, st.done ? icon('check', 's') : String(i + 1)), h('span', { class: 'ln-lt' }, l.title), h('span', { class: 'ln-lm' }, st.done ? 'Done' : st.passed ? `${st.passed}/${st.total} checks` : `${l.mins} min`))); })),
        h('a', { class: 'ln-assess' + (s.passed ? ' passed' : ''), href: '#assess-' + m.id }, icon('trophy', 's'), h('span', {}, 'Module assessment'), h('span', { class: 'ln-lm' }, s.attempts ? `best ${pct(s.best)}${s.passed ? ' · passed' : ''}` : `${m.assessment.items.length} questions`))); }));
    const deep = h('a', { class: 'ln-deep', href: '#course' }, icon('course', 's'), h('span', {}, h('b', {}, 'Deep-dive chapters'), ' The full 16-chapter course with the six-beat lesson player (chapter 2, The qubit, is complete).'), icon('arrow', 's'));
    el.replaceChildren(h('div', { class: 'page ln-page' }, head, mods, deep));
  }
  function ring(f, big, small, size = 84) {
    const r = size / 2 - 6, c = 2 * Math.PI * r, s = svg('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: 'ln-ring', role: 'img', 'aria-label': `${Math.round(f * 100)}%` });
    svg('circle', { cx: size / 2, cy: size / 2, r, class: 'ln-rbg' }, s); svg('circle', { cx: size / 2, cy: size / 2, r, class: 'ln-rfg', 'stroke-dasharray': `${(c * Math.max(0, Math.min(1, f))).toFixed(1)} ${c.toFixed(1)}`, transform: `rotate(-90 ${size / 2} ${size / 2})` }, s);
    return h('div', { class: 'ln-rw', style: { width: size + 'px', height: size + 'px' } }, s, h('div', { class: 'ln-rt' }, h('b', {}, big), small ? h('span', {}, small) : null));
  }

  /* ---------------- lesson player ---------------- */
  function lesson(el, id) {
    const x = LEARN.lesson(id); if (!x) { el.replaceChildren(h('div', { class: 'page' }, h('h1', { class: 'display' }, 'Lesson not found'), h('a', { href: '#learn' }, 'Back to Learn'))); return; }
    const { m, l } = x, idx = m.lessons.indexOf(l), t0 = Date.now(), text = LEARN.lessonText(l);
    App.top([h('a', { href: '#learn' }, 'Learn'), m.title, l.title]);
    const prog = h('div', { class: 'ls-prog' }, h('i')), progT = h('span', { class: 'ls-progt' });
    const paintProg = () => { const s = lessonState(id); prog.firstChild.style.width = (s.frac * 100) + '%'; progT.textContent = `${s.passed} of ${s.total} checks`; complete.hidden = s.done; complete.disabled = s.passed < s.total; doneNote.hidden = !s.done; hintNote.hidden = s.done || s.passed === s.total; };
    let active = null, section = '';
    const art = h('article', { class: 'ls-art' });
    let qi = 0; const widgets = [];
    l.blocks.forEach(b => {
      if (b.h) art.append(h('h2', { class: 'ls-h', 'data-sec': b.h }, b.h));
      else if (b.p) { const p = h('p', { class: 'ls-p' }); p.innerHTML = Tex.prose(b.p); art.append(p); }
      else if (b.m) art.append(Tex.into(h('div', { class: 'ls-m' }), b.m, true));
      else if (b.key) { const k = h('div', { class: 'ls-key' }, h('span', { class: 'ls-kl' }, icon('bulb', 's'), 'Key idea')); const p = h('p'); p.innerHTML = Tex.prose(b.key); k.append(p); art.append(k); }
      else if (b.aside) { const k = h('aside', { class: 'ls-aside' }, h('span', { class: 'ls-kl' }, 'Going further')); const p = h('p'); p.innerHTML = Tex.prose(b.aside); k.append(p); art.append(k); }
      else if (b.w) { const W = LW[b.w.type](b.w); widgets.push(W); const box = h('figure', { class: 'ls-w' }, h('span', { class: 'ls-wl' }, icon('lab', 's'), 'Try it'), W.el); box.addEventListener('pointerdown', () => { active = W; }, true); const ab = W.el.querySelector('.lw-askbtn'); if (ab) ab.addEventListener('click', () => { active = W; chat.ask('Explain what this example is showing me right now.', ctxFor(W)); }); art.append(box); }
      else if (b.q) { const i = qi++; const prev = (LS().checks[id] || {})[i]; const C = Check(b.q, { lesson: id, index: i, onResult: () => paintProg() }); if (prev && prev.ok) C.el.classList.add('was-ok'); if (C.lab) C.el.addEventListener('pointerdown', () => { active = C.lab; }, true); art.append(C.el); }
    });
    const sum = h('section', { class: 'ls-sum' }, h('h2', {}, 'Summary'), h('ul', {}, l.summary.map(s => { const li = h('li'); li.innerHTML = Tex.prose(s); return li; })));
    const complete = h('button', { type: 'button', class: 'ln-cta' }, icon('check', 's'), 'Complete lesson');
    const doneNote = h('p', { class: 'ls-done' }, icon('check', 's'), 'Lesson complete.');
    const hintNote = h('p', { class: 'ls-hint' }, 'Answer every check correctly to complete the lesson.');
    complete.addEventListener('click', () => { const d = LS(); d.done[id] = new Date().toISOString(); save(d); Store.progress('L:' + id, 1); paintProg(); toast(`Lesson complete: ${l.title}`); const nx = LEARN.next(id); chat.say(nx ? `Nice work. Next up: **${nx.l.title}**. Or ask me anything about this lesson first.` : 'That was the last lesson. Try the module assessment to check what you know.'); });
    const nx = LEARN.next(id), pv = LEARN.prev(id);
    const nav = h('nav', { class: 'ls-nav' }, pv ? h('a', { href: '#m-' + pv.l.id, class: 'ls-pn' }, icon('back', 's'), pv.l.title) : h('span'), idx === m.lessons.length - 1 ? h('a', { href: '#assess-' + m.id, class: 'ls-pn next' }, 'Module assessment', icon('arrow', 's')) : nx ? h('a', { href: '#m-' + nx.l.id, class: 'ls-pn next' }, nx.l.title, icon('arrow', 's')) : h('span'));
    const head = h('header', { class: 'ls-head' }, h('p', { class: 'ln-kicker' }, `Module ${m.n} · ${m.title} · Lesson ${idx + 1} of ${m.lessons.length}`), h('h1', { class: 'display' }, l.title),
      h('div', { class: 'ls-meta' }, h('span', {}, icon('clock', 's'), `${l.mins} min`), ...l.concepts.map(c => h('span', { class: 'ls-chip' }, CONCEPT_NAMES[c])), h('span', { class: 'grow' }), progT),
      prog, h('div', { class: 'ls-goals' }, h('b', {}, 'You will be able to'), h('ul', {}, l.goals.map(g => h('li', {}, g)))));
    const aside = h('aside', { class: 'ls-tutor' }), side = h('div', { class: 'ls-tutorin' });
    aside.append(side);
    const ctxFor = W => ({ where: 'lesson:' + id, lesson: l, lessonText: text, section, circuit: W && W.circuit ? W.circuit() : null, extra: W && W.extra ? W.extra() : '' });
    const chat = AIChat.mount(side, () => ctxFor(active), { placeholder: `Ask about “${l.title}”…`, greeting: `I’m your tutor for **${l.title}**. Ask me to explain anything on this page, quiz you, or look at the example you’re playing with.`, suggestions: ['Summarise this lesson', 'Explain the key idea more simply', 'Quiz me', 'Explain the example I just used'] });
    el.replaceChildren(h('div', { class: 'page ls-page' }, head, h('div', { class: 'ls-grid' }, h('div', {}, art, sum, h('div', { class: 'ls-end' }, complete, doneNote, hintNote), nav), aside)));
    paintProg();
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) section = e.target.dataset.sec; }), { rootMargin: '-10% 0px -70% 0px' }) : null;
    if (io) art.querySelectorAll('.ls-h').forEach(x => io.observe(x));
    const d = LS(); d.last = id; save(d);
    return { destroy() { io && io.disconnect(); logTime(id, (Date.now() - t0) / 1000); } };
  }

  /* ---------------- module assessment ---------------- */
  function assess(el, mid) {
    const m = LEARN.module(mid); if (!m) { el.replaceChildren(h('div', { class: 'page' }, h('h1', { class: 'display' }, 'Assessment not found'))); return; }
    App.top([h('a', { href: '#learn' }, 'Learn'), m.title, 'Assessment']);
    const A = m.assessment, hist = LS().assess[mid] || [], t0 = Date.now();
    const page = h('div', { class: 'page as-page' }); el.replaceChildren(page);
    function intro() {
      const best = hist.reduce((a, r) => Math.max(a, r.score), 0);
      page.replaceChildren(h('header', { class: 'ls-head' }, h('p', { class: 'ln-kicker' }, `Module ${m.n} · ${m.title}`), h('h1', { class: 'display' }, 'Module assessment'), h('p', { class: 'prose' }, `${A.items.length} questions covering every lesson in this module: multiple choice, calculations and circuits to build. You get your score, a breakdown by concept and personal feedback at the end. Pass mark: ${pct(A.pass)}.`)),
        h('div', { class: 'as-intro' }, h('div', { class: 'as-facts' }, h('div', {}, h('b', {}, String(A.items.length)), h('span', {}, 'questions')), h('div', {}, h('b', {}, pct(A.pass)), h('span', {}, 'to pass')), h('div', {}, h('b', {}, hist.length ? pct(best) : '—'), h('span', {}, 'your best')), h('div', {}, h('b', {}, String(hist.length)), h('span', {}, 'attempts'))),
          h('button', { type: 'button', class: 'ln-cta', onclick: start }, hist.length ? 'Try again' : 'Start the assessment', icon('arrow', 's')), h('p', { class: 'ls-hint' }, 'No feedback until you submit. Take your time; you can go back and change answers.')),
        hist.length ? h('section', { class: 'as-hist' }, h('h2', {}, 'Previous attempts'), h('table', { class: 'as-tbl' }, h('tr', {}, h('th', {}, 'Date'), h('th', {}, 'Score'), h('th', {}, 'Result')), ...hist.slice().reverse().map(r => h('tr', {}, h('td', {}, fmt.date(r.at) + ' ' + fmt.time(r.at)), h('td', { class: 'mono' }, `${r.correct}/${r.total} (${pct(r.score)})`), h('td', {}, r.score >= A.pass ? h('span', { class: 'as-pass' }, 'Passed') : h('span', { class: 'as-fail' }, 'Not yet')))))) : null);
    }
    function start() {
      const items = A.items.map((q, i) => ({ q, i })).sort(() => Math.random() - .5);
      const checks = items.map(it => Check(it.q, { mode: 'assess', onResult: () => paintNav() }));
      let k = 0; const body = h('div', { class: 'as-body' }), dots = h('div', { class: 'as-dots' }), back = h('button', { type: 'button', class: 'lc-go ghost' }, 'Back'), next = h('button', { type: 'button', class: 'lc-go' }, 'Next');
      const count = h('span', { class: 'as-count mono' });
      function show() { body.replaceChildren(checks[k].el); count.textContent = `Question ${k + 1} of ${checks.length}`; back.disabled = k === 0; next.textContent = k === checks.length - 1 ? 'Submit' : 'Next'; paintNav(); }
      function paintNav() { dots.replaceChildren(...checks.map((c, i) => h('button', { type: 'button', class: 'as-dot' + (i === k ? ' on' : '') + (c.answered() ? ' ans' : ''), 'aria-label': `Question ${i + 1}`, onclick: () => { k = i; show(); } }))); }
      back.addEventListener('click', () => { if (k > 0) { k--; show(); } });
      next.addEventListener('click', () => { if (k < checks.length - 1) { k++; show(); return; } const missing = checks.filter(c => !c.answered()).length; if (missing && !confirmSubmit(missing)) return; finish(items, checks); });
      let warned = false; function confirmSubmit(nm) { if (warned) return true; warned = true; toast(`${nm} question${nm > 1 ? 's are' : ' is'} unanswered. Press Submit again to finish anyway.`); return false; }
      page.replaceChildren(h('header', { class: 'as-top' }, h('p', { class: 'ln-kicker' }, `${m.title} · assessment`), count, dots), body, h('div', { class: 'as-ctl' }, back, next));
      show();
    }
    async function finish(items, checks) {
      const res = items.map((it, j) => ({ i: it.i, q: it.q, ok: checks[j].grade(), answer: checks[j].answer }));
      const correct = res.filter(r => r.ok).length, score = correct / res.length, concepts = {};
      res.forEach(r => { const c = r.q.concept; concepts[c] = concepts[c] || { ok: 0, n: 0 }; concepts[c].n++; if (r.ok) concepts[c].ok++; Store.attempt({ kind: 'assess', concept: c, ok: r.ok, module: mid, lesson: r.q.lesson }); });
      const rec = { at: new Date().toISOString(), score, correct, total: res.length, secs: Math.round((Date.now() - t0) / 1000), concepts, wrong: res.filter(r => !r.ok).map(r => r.i) };
      const d = LS(); d.assess[mid] = (d.assess[mid] || []).concat([rec]); save(d); logTime('assess:' + mid, rec.secs);
      const cinfo = LEARN.concepts();
      const report = { score, correct, total: res.length, concepts: Object.entries(concepts).map(([c, v]) => ({ id: c, name: CONCEPT_NAMES[c], score: v.ok / v.n, lesson: cinfo[c] && cinfo[c].lesson, lessonTitle: cinfo[c] && cinfo[c].lessonTitle })) };
      const passed = score >= A.pass;
      const fbBox = h('div', { class: 'as-ai' }, h('div', { class: 'ai-dots' }, h('i'), h('i'), h('i')));
      const review = h('ol', { class: 'as-review' }, res.map(r => { const li = h('li', { class: r.ok ? 'ok' : 'bad' }); const q = h('div', { class: 'as-rq' }); q.innerHTML = Tex.prose(r.q.q); const right = r.q.type === 'mcq' ? r.q.choices.find(c => c.ok).t : r.q.type === 'num' ? String(r.q.answer) : r.q.solution; const why = r.q.type === 'mcq' ? (r.q.choices.find(c => c.ok).why || '') : (r.q.why || ''); const a = h('p', { class: 'as-ra' }); a.innerHTML = `${r.ok ? '✓ Correct' : '✗ Incorrect'} · Answer: ${Tex.prose(right)}${why ? ' — ' + Tex.prose(why) : ''}`; li.append(h('span', { class: 'as-rl' }, CONCEPT_NAMES[r.q.concept]), q, a, ...(r.ok ? [] : [h('a', { class: 'ai-link', href: '#m-' + r.q.lesson }, icon('course', 's'), 'Review: ' + LEARN.lesson(r.q.lesson).l.title)])); return li; }));
      const bars = h('div', { class: 'lw-bars' }); LW.bars(bars, report.concepts.map(c => ({ k: c.name, v: c.score, hot: c.score >= 1 })));
      const chatHost = h('div', { class: 'as-chat' });
      page.replaceChildren(h('header', { class: 'ls-head' }, h('p', { class: 'ln-kicker' }, `Module ${m.n} · ${m.title} · assessment result`), h('h1', { class: 'display' }, passed ? 'Passed' : 'Not passed yet')),
        h('div', { class: 'as-res' }, ring(score, pct(score), `${correct}/${res.length}`, 120), h('div', {}, h('h3', {}, 'By concept'), bars), h('div', { class: 'as-aiw' }, h('h3', {}, icon('tutor', 's'), 'Tutor feedback'), fbBox)),
        h('div', { class: 'as-actions' }, h('button', { type: 'button', class: 'lc-go', onclick: intro }, 'Back to assessment'), passed && LEARN.modules[m.n] ? h('a', { class: 'ln-cta', href: '#m-' + LEARN.modules[m.n].lessons[0].id }, 'Start ' + LEARN.modules[m.n].title, icon('arrow', 's')) : h('a', { class: 'ln-cta', href: '#progress' }, 'See your progress', icon('arrow', 's'))),
        h('section', {}, h('h2', {}, 'Review your answers'), review), h('section', { class: 'as-chatw' }, h('h2', {}, 'Talk it through'), chatHost));
      if (passed) toast(`${m.title} assessment passed with ${pct(score)}.`);
      AIChat.mount(chatHost, () => ({ where: 'assess:' + mid, extra: `Assessment for module ${m.title}: ${correct}/${res.length}. Missed questions: ${res.filter(r => !r.ok).map(r => r.q.q.replace(/\$/g, '')).join(' | ') || 'none'}.\n${progressSummary()}` }), { suggestions: ['Why did I miss those questions?', 'What should I review first?', 'Quiz me on my weakest concept'] });
      try { const r = await AI.ask('Give me feedback on this assessment.', { report, extra: `Module ${m.title} assessment. Concept scores: ${report.concepts.map(c => `${c.name} ${pct(c.score)} (lesson ${c.lesson})`).join(', ')}.` }, { persona: 'report', onText: t => fbBox.replaceChildren(AIChat.render(t)) }); fbBox.replaceChildren(AIChat.render(r.text)); const links = (r.links || []).filter(id => LEARN.lesson(id)); if (links.length) fbBox.append(h('div', { class: 'ai-links' }, links.map(id => h('a', { class: 'ai-link', href: '#m-' + id }, icon('course', 's'), LEARN.lesson(id).l.title)))); } catch (e) { fbBox.textContent = e.message; }
    }
    intro();
  }

  /* ---------------- progress dashboard ---------------- */
  function progress(el) {
    App.top(['Progress']);
    const d = LS(), A = Store.get().attempts, cks = A.filter(a => a.kind === 'check'), first = cks.filter(a => a.first);
    const lessons = LEARN.lessons(), done = lessons.filter(x => d.done[x.l.id]).length;
    const passedMods = LEARN.modules.filter(m => moduleState(m).passed).length;
    const secsAll = Object.values(d.days).reduce((a, b) => a + b, 0), mins = secsAll < 60 ? (secsAll ? '<1' : '0') : Math.round(secsAll / 60);
    const tile = (big, lab, sub) => h('div', { class: 'pg-tile' }, h('b', {}, big), h('span', {}, lab), sub ? h('em', {}, sub) : null);
    const tiles = h('div', { class: 'pg-tiles' }, tile(`${done}/${lessons.length}`, 'lessons complete'), tile(first.length ? pct(first.filter(a => a.ok).length / first.length) : '—', 'right first time', `${first.length} checks`), tile(`${passedMods}/${LEARN.modules.length}`, 'assessments passed'), tile(String(mins), 'minutes studied'), tile(String(streak()), 'day streak'));
    const mods = h('div', { class: 'pg-mods' }, LEARN.modules.map(m => { const s = moduleState(m); return h('a', { class: 'pg-mod t-' + m.tint, href: '#learn' }, h('div', { class: 'pg-mh' }, h('b', {}, `${m.n}. ${m.title}`), h('span', {}, `${s.done}/${m.lessons.length} lessons`)), h('div', { class: 'ls-prog' }, h('i', { style: { width: s.frac * 100 + '%' } })), h('span', { class: 'pg-ms' }, s.attempts ? `Assessment best ${pct(s.best)}${s.passed ? ' · passed' : ''}` : 'Assessment not taken')); }));
    const cons = LEARN.concepts();
    const mastery = h('div', { class: 'pg-mastery' }, LEARN.modules.map(m => h('div', { class: 'pg-mg' }, h('h4', {}, m.title), ...Object.values(cons).filter(c => c.module === m.id).map(c => { const [lab, cls] = masteryLabel(c.id), v = Knowledge.get(c.id); return h('a', { class: 'pg-c ' + cls, href: '#m-' + c.lesson, title: `${CONCEPT_NAMES[c.id]}: mastery ${v.toFixed(2)} — open “${c.lessonTitle}”` }, h('span', { class: 'pg-cn' }, CONCEPT_NAMES[c.id]), h('span', { class: 'pg-cb' }, h('i', { style: { width: (cls === 'ns' ? 0 : v * 100) + '%' } })), h('span', { class: 'pg-cl' }, lab)); }))));
    const days = []; for (let i = 13; i >= 0; i--) { const t = new Date(); t.setDate(t.getDate() - i); const k = t.toISOString().slice(0, 10); days.push({ k, m: (d.days[k] || 0) / 60, lab: t.toLocaleDateString(LOCALE, { weekday: 'narrow' }) }); }
    const mx = Math.max(10, ...days.map(x => x.m));
    const act = h('div', { class: 'lw-cols pg-act' }, days.map(x => h('div', { class: 'lw-col' + (x.k === today() ? ' hot' : ''), title: `${x.k}: ${Math.round(x.m)} min` }, h('i', { style: { height: Math.max(1, x.m / mx * 100) + '%' } }), h('span', { class: 'mono' }, x.lab))));
    const allA = LEARN.modules.flatMap(m => (d.assess[m.id] || []).map(r => Object.assign({ m }, r))).sort((a, b) => b.at.localeCompare(a.at));
    const histT = allA.length ? h('table', { class: 'as-tbl' }, h('tr', {}, h('th', {}, 'Date'), h('th', {}, 'Module'), h('th', {}, 'Score'), h('th', {}, 'Result')), ...allA.slice(0, 12).map(r => h('tr', {}, h('td', {}, fmt.date(r.at)), h('td', {}, r.m.title), h('td', { class: 'mono' }, `${r.correct}/${r.total} (${pct(r.score)})`), h('td', {}, r.score >= r.m.assessment.pass ? h('span', { class: 'as-pass' }, 'Passed') : h('span', { class: 'as-fail' }, 'Not yet'))))) : h('p', { class: 'ls-hint' }, 'No assessments yet. Each module ends with one.');
    const tried = Object.keys(cons).filter(k => A.some(a => a.concept === k)).sort((a, b) => Knowledge.get(a) - Knowledge.get(b));
    const focus = h('ol', { class: 'pg-focus' }, ...(() => { const out = []; const nl = nextLesson(); if (nl) out.push(h('li', {}, h('a', { href: '#m-' + nl.id }, h('b', {}, 'Continue: ' + nl.title), h('span', {}, 'your next unfinished lesson')))); tried.filter(k => Knowledge.get(k) < .85).slice(0, 3).forEach(k => out.push(h('li', {}, h('a', { href: '#m-' + cons[k].lesson }, h('b', {}, 'Review ' + CONCEPT_NAMES[k]), h('span', {}, `mastery ${Math.round(Knowledge.get(k) * 100)}% · ${cons[k].lessonTitle}`))))); LEARN.modules.filter(m => moduleState(m).done === m.lessons.length && !moduleState(m).passed).forEach(m => out.push(h('li', {}, h('a', { href: '#assess-' + m.id }, h('b', {}, `Take the ${m.title} assessment`), h('span', {}, 'all its lessons are done'))))); return out.length ? out : [h('li', {}, h('span', {}, 'Everything is up to date.'))]; })());
    const chatHost = h('div', { class: 'pg-chat' });
    el.replaceChildren(h('div', { class: 'page pg-page' }, h('header', { class: 'ls-head' }, h('p', { class: 'ln-kicker' }, 'Progress and assessment'), h('h1', { class: 'display' }, 'Your progress'), h('p', { class: 'prose' }, 'Mastery is estimated per concept from every check, hint and assessment answer (Bayesian knowledge tracing), so it rises with correct answers and falls with mistakes.')),
      tiles, h('div', { class: 'pg-grid' }, h('div', {}, h('h2', {}, 'Modules'), mods, h('h2', {}, 'Mastery by concept'), mastery, h('h2', {}, 'Assessment history'), histT), h('div', {}, h('section', { class: 'pg-card' }, h('h3', {}, icon('target', 's'), 'Focus next'), focus), h('section', { class: 'pg-card' }, h('h3', {}, icon('cal', 's'), 'Last 14 days'), act), h('section', { class: 'pg-card tall' }, chatHost)))));
    AIChat.mount(chatHost, () => ({ where: 'progress', extra: progressSummary() }), { greeting: 'I can see your lessons, checks and assessments. Ask me what to study next, or to quiz you on a weak spot.', suggestions: ['What should I study next?', 'How am I doing?', 'Quiz me on my weakest concept'] });
  }
  return { hub, lesson, assess, progress, lessonState, moduleState, progressSummary, nextLesson, Check };
})();
