/* =====================================================================
   HOME — greeting, the big "Ask Qubit" box, recent questions, and tinted
   live metric cards (mastery, next up, streak, recent runs, circuits).
===================================================================== */
const Mini = {
  sphere(v, R = 40) { const W = R * 2 + 24, s = svg('svg', { class: 'mini-sphere', viewBox: `0 0 ${W} ${W}`, width: W, height: W, role: 'img', 'aria-label': 'Bloch sphere preview' }); const S = Ink.sphere(s, { cx: W / 2, cy: W / 2, R, labels: false, tipR: 3.5 }); S.st.v = v; S.draw(); s.S = S; return s; },
  ring(f, size = 64, color = 'var(--ti,var(--violet))', label) { const r = size / 2 - 5, c = 2 * Math.PI * r, s = svg('svg', { class: 'ring-p', viewBox: `0 0 ${size} ${size}`, width: size, height: size, role: 'img', 'aria-label': label || `${Math.round(f * 100)}%` }); svg('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: 'currentColor', 'stroke-opacity': .14, 'stroke-width': 6 }, s); svg('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: color, 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-dasharray': `${c * Math.max(0.001, f)} ${c}`, transform: `rotate(-90 ${size / 2} ${size / 2})` }, s); return s; },
  bars(vals, { max, labels } = {}) { const m = max || Math.max(1, ...vals); return h('div', { class: 'bars', role: 'img', 'aria-label': labels || vals.join(', ') }, vals.map(v => h('i', { style: { height: (v ? Math.max(6, v / m * 84) : 0) + 'px' }, title: String(v) }))); },
  hist(prob, keys, { w = 220, hgt = 90, color = 'var(--ti,var(--t-blue-i))' } = {}) { const s = svg('svg', { viewBox: `0 0 ${w} ${hgt + 16}`, width: w, height: hgt + 16, role: 'img', 'aria-label': keys.map(k => `${k} ${fmt.p(prob[k] || 0, 0)}`).join(', ') }); const step = w / keys.length, bw = Math.min(14, step * .5); keys.forEach((k, i) => { const x = step * i + (step - bw) / 2, v = prob[k] || 0; svg('rect', { x, y: 0, width: bw, height: hgt, rx: 5, fill: 'currentColor', 'fill-opacity': .08 }, s); svg('rect', { x, y: hgt - v * hgt, width: bw, height: Math.max(2, v * hgt), rx: 5, fill: color }, s); if (keys.length <= 8) { const t = svg('text', { x: x + bw / 2, y: hgt + 13, 'text-anchor': 'middle', 'font-size': 10, 'font-family': 'var(--mono)', fill: 'currentColor' }, s); t.textContent = k; } }); return s; },
  circuit(C, host) { const d = h('div', { class: 'mini-circ' }); host.append(d); Score(d, { circ: IR.clone(C), editable: false, compact: true, playhead: false, minCols: 2 }); return d; }
};
const Home = (() => {
  const days = n => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (n - 1 - i)); return d; });
  function render(el, { focusAsk } = {}) {
    App.top(['Home']);
    const S = Store.get(), prof = S.profile || {}, name = prof.name || Platform.name, ch = COURSE.chapters[2], L = Journey.nextLesson(), A = S.attempts || [];
    const hr = new Date().getHours(), greet = hr < 5 ? 'Up late' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    /* ask box */
    const ta = h('textarea', { rows: 2, placeholder: 'Ask Qubit anything — “why does my Grover overshoot?”', 'aria-label': 'Ask Qubit' }), ans = h('div', { class: 'ask-ans', 'aria-live': 'polite', hidden: true });
    let attach = false; const at = h('button', { type: 'button', class: 'ab-ic', 'aria-pressed': 'false', title: 'Attach your current Laboratory circuit', 'aria-label': 'Attach your current Laboratory circuit' }, icon('at'));
    at.addEventListener('click', () => { attach = !attach; at.setAttribute('aria-pressed', String(attach)); chip.hidden = !attach; });
    const chip = h('span', { class: 'badge b-violet', hidden: true }, icon('lab', 's'), (S.lab && S.lab.name) || 'Lab circuit');
    const send = h('button', { type: 'button', class: 'ab-send', 'aria-label': 'Send' }, icon('send'));
    async function ask(q) { q = (q || ta.value).trim(); if (!q) return; ans.hidden = false; ans.replaceChildren(h('p', { class: 'small' }, 'Qubit is thinking…')); const ctx = { circuit: attach && S.lab ? IR.clone(S.lab) : null, mode: 'guide', where: 'Home (question box)', depth: S.depth || 'formal', fallback: 'Ask about a gate, a state or an algorithm — or attach your Lab circuit with @ and ask about it.' };
      const r = await Tutor.ask(q, ctx, { onText: t => ans.replaceChildren(h('div', { class: 'prose', html: Tex.prose(t) })) }); ans.replaceChildren(h('p', { class: 'lbl' }, icon('tutor', 's'), ' Qubit'), h('div', { class: 'prose', html: Tex.prose(r.text || '') }), r.build ? h('a', { class: 'btn', href: '#lab', onclick: () => Lab.load(r.build) }, 'Open it in the Laboratory') : null);
      const asks = [{ q, at: Date.now() }].concat((Store.get().asks || []).filter(x => x.q !== q)).slice(0, 8); Store.set('asks', asks); ta.value = ''; }
    send.addEventListener('click', () => ask()); ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } });
    const asks = S.asks || [], starters = ['Why does H·H give |0⟩ every time?', 'What makes a Bell pair entangled?', 'Why does Grover overshoot after the best iteration?', 'What is a relative phase?'];
    /* numbers */
    const seen = new Set(A.map(a => a.concept)); const concepts = ch.lessons.map(l => [l.title, seen.has(l.concept) ? Knowledge.get(l.concept) : 0]), mastery = concepts.reduce((a, [, v]) => a + v, 0) / concepts.length;
    const D14 = days(14), perDay = D14.map(d => A.filter(a => a.at >= +d && a.at < +d + 864e5).length), thisWk = perDay.slice(7).reduce((a, b) => a + b, 0), lastWk = perDay.slice(0, 7).reduce((a, b) => a + b, 0);
    const done = ch.lessons.filter(l => (S.progress[l.id] || 0) >= 1).length, frac = ch.lessons.reduce((a, l) => a + Math.min(1, S.progress[l.id] || 0), 0) / ch.lessons.length;
    let streak = 0; for (let i = D14.length - 1; i >= 0; i--) { if (perDay[i]) streak++; else if (i < D14.length - 1) break; }
    const due = (S.notes || []).filter(n => n.task && n.due <= Date.now()), job = (S.jobs || [])[0];
    const circuits = [S.lab && S.lab.ops ? S.lab : null, ...(S.notes || []).filter(n => n.circuit).map(n => Object.assign({}, n.circuit, { name: n.title }))].filter(Boolean).slice(0, 3);
    const nextV = { 'l-2-1': [.866, 0, .5], 'l-2-2': [0, 0, -1], 'l-2-3': [0, -1, 0], 'l-2-4': [0, 1, 0], 'l-2-5': [.612, .612, .5] }[L ? L.id : 'l-2-5'];
    const sph = Mini.sphere(nextV, 46); let k = 0, t = null; const path = [[0, 0, 1], nextV, [1, 0, 0], nextV]; const loop = () => { sph.S.to(path[k++ % path.length], 1); if (!Motion.reduced) t = setTimeout(loop, 2200); }; loop();
    /* layout */
    el.replaceChildren(h('div', { class: 'page home' },
      h('h1', { class: 'greet' }, `${greet}${name ? ', ' + name : ''} `, h('span', { 'aria-hidden': 'true' }, '☀')),
      h('div', { class: 'ask-row' },
        h('div', { class: 'askbox' }, ta, h('div', { class: 'ab-foot' }, at, h('button', { type: 'button', class: 'ab-ic', title: 'Recent questions', 'aria-label': 'Recent questions', onclick: () => el.querySelector('.recent a')?.focus() }, icon('history')), chip, h('span', { class: 'grow' }), send), ans),
        h('div', { class: 'recent' }, h('p', { class: 'lbl' }, asks.length ? 'Recent questions' : 'Try asking'), ...(asks.length ? asks.slice(0, 5).map(x => x.q) : starters).map(q => h('a', { href: '#home', onclick: e => { e.preventDefault(); ta.value = q; ask(q); } }, icon('chat', 's'), h('span', {}, q))))),
      h('div', { class: 'grid2' },
        h('section', { class: 'card tint blue metric' }, h('div', { class: 'card-h' }, icon('trend'), h('h3', {}, 'Mastery this week')),
          h('div', { class: 'metric-body' }, h('div', {}, h('div', { class: 'row', style: { alignItems: 'baseline' } }, h('span', { class: 'big' }, `${Math.round(mastery * 100)}%`), h('span', { class: 'delta' }, A.length ? (thisWk >= lastWk ? `↑ ${thisWk - lastWk}` : `↓ ${lastWk - thisWk}`) + ' answers vs last week' : 'start a lesson to begin')), h('p', { class: 'small', style: { color: 'var(--ti)', margin: '4px 0 14px' } }, 'Practice over the last 14 days'), Mini.bars(perDay, { labels: `Answers per day: ${perDay.join(', ')}` })),
            h('div', { class: 'kv' }, h('p', { class: 'lbl', style: { color: 'var(--ti)' } }, 'Chapter 2 by lesson'), ...concepts.map(([t2, v]) => h('div', {}, h('span', {}, t2), h('b', {}, `${Math.round(v * 100)}%`)))))),
        h('section', { class: 'card tint rose metric' }, h('div', { class: 'card-h' }, icon('target'), h('h3', {}, 'Next up')),
          h('div', { class: 'next-body' }, h('div', { class: 'ring-wrap' }, Mini.ring(frac, 96), h('b', {}, `${Math.round(frac * 100)}%`)), h('div', {}, h('p', { class: 'lbl', style: { color: 'var(--ti)' } }, `Chapter 2 · ${done} of ${ch.lessons.length} lessons`), h('h2', { class: 'nx-title' }, L ? L.title : 'Chapter exam'), h('p', { class: 'small', style: { color: 'var(--ti)' } }, L ? `Lesson 2.${L.n} · ${L.minutes} min · ${S.depth || 'intuition'} depth` : '12 items · 70% passes'), h('a', { class: 'btn', href: L ? '#' + L.id : '#exam-2', style: { marginTop: '12px' } }, (S.progress[L?.id] || 0) > 0 ? 'Continue' : 'Open', icon('arrow', 's'))), sph))),
      h('div', { class: 'grid3' },
        h('section', { class: 'card tint lime metric' }, h('div', { class: 'card-h' }, icon('flame'), h('h3', {}, 'Streak & review')), h('div', { class: 'row', style: { alignItems: 'baseline' } }, h('span', { class: 'big m' }, String(streak)), h('span', { class: 'delta' }, streak === 1 ? 'day' : 'days')),
          h('div', { class: 'dots', role: 'img', 'aria-label': `Active on ${perDay.filter(Boolean).length} of the last 14 days` }, D14.map((d, i) => h('i', { class: perDay[i] ? 'on' : '', title: d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' }) }))),
          h('p', { class: 'small', style: { color: 'var(--ti)', marginTop: '12px' } }, due.length ? `${due.length} card${due.length > 1 ? 's' : ''} due for review` : 'No cards due — field notes come back a day after you keep them.'), due.length ? h('a', { class: 'btn', href: '#notebook', style: { marginTop: '10px' } }, 'Review now') : null),
        h('section', { class: 'card tint lilac metric' }, h('div', { class: 'card-h' }, icon('chart'), h('h3', {}, 'Recent runs')),
          job && job.counts ? h('div', {}, h('div', { class: 'row', style: { alignItems: 'baseline' } }, h('span', { class: 'big m' }, fmt.p(Math.max(...Object.values(job.counts)) / job.shots, 0)), h('span', { class: 'delta' }, `P(${job.top.split(' ')[0]})`)), Mini.hist(Object.fromEntries(Object.entries(job.counts).map(([k2, v]) => [k2, v / job.shots])), Object.keys(job.counts).sort(), { w: 240 }), h('div', { class: 'row', style: { marginTop: '8px' } }, h('span', { class: 'badge b-violet' }, job.backend), h('span', { class: 'badge b-ink' }, `${fmt.n(job.shots)} shots`), h('span', { class: 'lbl' }, fmt.time(job.at))))
            : h('p', { class: 'small', style: { color: 'var(--ti)' } }, 'Runs from the Laboratory land here with their histogram and backend.'), h('a', { class: 'btn', href: '#lab', style: { marginTop: '12px' } }, job ? 'Open the Lab' : 'Make a first run')),
        h('section', { class: 'card metric' }, h('div', { class: 'card-h' }, icon('lab'), h('h3', {}, 'Continue building')), circuits.length ? h('div', { class: 'thumbs' }, circuits.map(c => { const a = h('a', { class: 'thumb', href: '#lab', onclick: () => Lab.load(c) }); Mini.circuit(c, a); a.append(h('span', {}, c.name || 'Untitled circuit')); return a; })) : h('div', { class: 'empty' }, h('p', { class: 'empty-h' }, 'Drop your ', h('span', { class: 'squig' }, 'first'), ' gate'), h('a', { class: 'btn', href: '#lab' }, 'Open the Laboratory')))),
      h('section', { class: 'card rec' }, h('div', { class: 'rec-cursor', 'aria-hidden': 'true' }, (() => { const s = svg('svg', { width: 22, height: 24, viewBox: '0 0 22 24' }); svg('path', { d: 'M2 2 L19 12 L11 13.5 L7.5 21 Z', fill: '#592EFF', stroke: '#fff', 'stroke-width': 1.6 }, s); return s; })(), h('span', {}, 'QUBIT')),
        h('div', { class: 'rec-body' }, h('p', { class: 'lbl' }, 'Recommended by Qubit'), h('h2', {}, L ? `Lesson 2.${L.n} · ${L.title}` : 'The Chapter 2 exam'), h('p', { class: 'small' }, Journey.whyLine(L))), h('a', { class: 'primary', href: L ? '#' + L.id : '#exam-2' }, 'Start', icon('arrow', 's')))));
    if (App.pendingAsk) { const q = App.pendingAsk; App.pendingAsk = null; ta.value = q; ask(q); } else if (focusAsk) ta.focus();
    return { destroy() { clearTimeout(t); } };
  }
  return { render };
})();

/* =====================================================================
   COURSE MAP — the curriculum as a journey canvas.
===================================================================== */
const CourseMap = (() => {
  const KEY_STATE = { 'l-2-1': [.866, 0, .5], 'l-2-2': [0, 0, -1], 'l-2-3': [0, -1, 0], 'l-2-4': [0, 1, 0], 'l-2-5': [.612, .612, .5] };
  const LEVEL = { I: 'Foundations', II: 'Algorithms', III: 'Hardware', IV: 'Algorithms' };
  let level = 'All';
  function render(el) {
    const S = Store.get(), ch = COURSE.chapters[2], nx = Journey.nextLesson();
    const lev = Ctl.words(['All', 'Foundations', 'Algorithms', 'Hardware'].map(v => ({ value: v, label: v })), level, v => { level = v; paint(); }, { label: 'Level' });
    const dep = Ctl.dial({ value: S.depth || 'intuition', onChange: v => Store.set('depth', v) });
    App.top(['Course', 'Map'], [lev, dep, Ctl.menu({ label: 'Tutor language', options: LANGS, value: S.lang, onChange: v => Store.set('lang', v) })]);
    el.replaceChildren(); const host = h('div', { style: { position: 'absolute', inset: '0' } }); el.append(host);
    const B = Board(host, { id: 'course', fitKeys: ['g2'] });
    // Chapter 2 journey group
    const W = 260, G = 60, gx = 40, gy = 40, lessons = ch.lessons;
    B.add('g2', { x: gx, y: gy, w: (W + G) * (lessons.length + 1) + 20, h: 400, tint: 'lilac', bare: true, resizable: false, cls: 'group-card' }).body.append(h('div', { class: 'grp-h' }, h('span', { class: 'badge b-violet' }, 'Part I · Chapter 2'), h('h2', {}, 'The qubit'), h('span', { class: 'lbl' }, `${lessons.filter(l => (S.progress[l.id] || 0) >= 1).length}/${lessons.length} lessons`)));
    lessons.forEach((l, i) => node(B, l.id, { x: gx + 30 + i * (W + G), y: gy + 110, title: `2.${l.n} ${l.title}`, meta: `${l.minutes} min · ${cap(S.depth || 'intuition')}`, prog: Math.min(1, S.progress[l.id] || 0), href: '#' + l.id, thumb: () => Mini.sphere(KEY_STATE[l.id], 46), mastery: Knowledge.get(l.concept) }));
    const ex = (S.exams || {})[2]; node(B, 'exam-2', { x: gx + 30 + lessons.length * (W + G), y: gy + 110, title: 'Chapter exam', meta: ex ? `${ex.score}/${ex.of}${ex.pass ? ' · passed' : ''}` : '12 items · 70% passes', prog: ex && ex.pass ? 1 : 0, href: '#exam-2', thumb: () => { const d = h('div', { class: 'exam-thumb' }, h('b', { class: 'big m' }, ex ? `${Math.round(ex.score / ex.of * 100)}%` : '12'), h('span', { class: 'lbl' }, ex ? 'your score' : 'items')); return d; } });
    lessons.forEach((l, i) => { const nxt = lessons[i + 1] ? lessons[i + 1].id : 'exam-2', p = Math.round(Math.min(1, S.progress[l.id] || 0) * 100); B.link(l.id, nxt, { label: p >= 100 ? '100%' : p ? `${p}%` : 'Unlocks', cls: p >= 100 ? 'good' : '' }); });
    // the other chapters, by part, as locked nodes
    let y = gy + 480; const locked = [];
    CATALOGUE.forEach(part => { const chs = part.chapters.filter(([n]) => n !== 2); if (!chs.length) return; const gw = (W + G) * chs.length + 20;
      B.add('p' + part.part, { x: gx, y, w: gw, h: 330, bare: true, resizable: false, cls: 'group-card plain' }).body.append(h('div', { class: 'grp-h' }, h('span', { class: 'badge b-ink' }, `Part ${part.part}`), h('h2', {}, part.name), h('span', { class: 'lbl' }, 'In preparation')));
      chs.forEach(([n, title, blurb], i) => { node(B, 'ch' + n, { x: gx + 30 + i * (W + G), y: y + 90, title: `${n} ${title}`, meta: blurb, locked: true, part: part.part, thumb: () => { const s = Mini.sphere([Math.sin(n) * .7, Math.cos(n * 1.7) * .5, Math.cos(n) * .6], 38); s.classList.add('pencil'); return s; } }); if (i) B.link('ch' + chs[i - 1][0], 'ch' + n, {}); locked.push(['ch' + n, part.part]); });
      y += 380; });
    B.link('exam-2', 'ch3', { label: 'Unlocks' });
    function paint() { locked.forEach(([k, p]) => { const c = B.cards.get(k); if (c) c.el.classList.toggle('dimmed', level !== 'All' && LEVEL[p] !== level); }); B.cards.get('g2').el.classList.toggle('dimmed', level !== 'All' && level !== 'Foundations'); lessons.forEach(l => B.cards.get(l.id).el.classList.toggle('dimmed', level !== 'All' && level !== 'Foundations')); }
    paint();
    // toolbar + tutor cursor on the next lesson
    const jump = h('button', { type: 'button', class: 'tb' }, 'Jump to chapter', icon('up', 's')); jump.addEventListener('click', () => B.menuPop(jump, [['Chapter 2 · The qubit', () => B.focusCard(nx ? nx.id : 'exam-2')], ...CATALOGUE.flatMap(p => p.chapters.filter(([n]) => n !== 2).map(([n, t]) => [`Chapter ${n} · ${t}`, () => B.focusCard('ch' + n)]))]));
    Toolbar(host, [{ icon: 'select', title: 'Select', pressed: true, on: () => B.tool = 'select' }, { icon: 'pan', title: 'Pan', on: () => B.tool = 'pan' }, { icon: 'comment', title: 'Ask Qubit', on: () => { App.pendingAsk = null; location.hash = '#tutor'; } }, '|', jump, '|', ...zoomControls(B)]);
    const qc = Cursor(B, { name: 'Qubit' }); setTimeout(() => { const t = B.cards.get(nx ? nx.id : 'exam-2'); if (t) { qc.at(t.el, .8, .15); qc.say(`<b>Next for you:</b> ${esc(nx ? nx.title : 'the chapter exam')}. ${esc(Journey.whyLine(nx))}`); } }, 500);
    return { destroy() { B.destroy(); } };
  }
  const cap = s => s[0].toUpperCase() + s.slice(1);
  function node(B, key, o) {
    const c = B.add(key, { x: o.x, y: o.y, w: 260, bare: true, resizable: false, dragAll: true, cls: 'lnode' + (o.locked ? ' locked' : '') });
    const a = h(o.locked ? 'div' : 'a', { class: 'ln-in', href: o.href || null, draggable: 'false' }, h('div', { class: 'ln-thumb' }, o.thumb ? o.thumb() : null, o.prog >= 1 ? h('span', { class: 'ln-check', 'aria-label': 'Completed' }, icon('check', 's')) : null, o.locked ? h('span', { class: 'ln-lock', 'aria-label': 'Locked' }, icon('lock', 's')) : null),
      h('div', { class: 'ln-body' }, h('h3', {}, o.title), h('p', { class: 'lbl' }, o.meta)), !o.locked ? h('div', { class: 'ln-ring' }, Mini.ring(o.mastery ?? o.prog ?? 0, 34, 'var(--violet)', `Mastery ${Math.round((o.mastery ?? 0) * 100)}%`)) : null);
    c.body.append(a); c.head.remove();
    return c;
  }
  return { render };
})();
