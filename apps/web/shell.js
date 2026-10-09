/* SHELL — frame, sidebar, top bar, router (bare #tokens), ⌘K palette. */
const App = (() => {
  const NAV = [['home', 'Home', 'home'], ['tutor', 'Tutor', 'tutor'], ['learn', 'Learn', 'course'], ['progress', 'Progress', 'chart'], ['lab', 'Laboratory', 'lab'], ['algorithms', 'Algorithms', 'algorithms'], ['practice', 'Practice', 'practice'], ['notebook', 'Notebook', 'notebook'], ['validation', 'Validation', 'check']];
  const VIEWS = ['arrival', 'placement', 'home', 'course', 'lesson', 'exam', 'lab', 'canvas', 'algorithms', 'alg', 'practice', 'challenge', 'notebook', 'classroom', 'tests', 'validation', 'learn', 'mlesson', 'assess', 'progress'];
  let labMounted = false, canvasMounted = false, current = null, live = null;
  const $v = id => document.getElementById('view-' + id);
  /* ---- top bar API for pages ---- */
  function top(crumb, pills = []) { const c = document.getElementById('crumb'); c.replaceChildren(...[].concat(crumb).map((x, i, a) => typeof x === 'string' ? h('span', { class: i < a.length - 1 ? 'dim' : '' }, x + (i < a.length - 1 ? '  /' : '')) : x)); const host = document.getElementById('top-pills'); host.replaceChildren(...pills.filter(Boolean)); if (!document.getElementById('runner-dot')) { const d = h('span', { id: 'runner-dot', class: 'wb-rdot off', title: 'Runner status: unknown', style: { marginLeft: '8px' } }); const t = h('span', { id: 'runner-txt', class: 'small', style: { marginLeft: '6px' } }, 'runner ?'); host.append(d, t); Runner.onStatus(on => { d.className = 'wb-rdot ' + (on ? 'on' : 'off'); d.title = on ? 'Runner online at ' + Runner.url() : 'Runner offline — start the runner'; t.textContent = on ? 'runner online' : 'runner offline'; }); Runner.checkRunner().catch(() => {}); setInterval(() => { if ((document.body.dataset.view === 'lab' || document.body.dataset.view === 'canvas') && !document.hidden) Runner.checkRunner().catch(() => {}); }, 20000); } }
  function setRunnerStatus(on) { const d = document.getElementById('runner-dot'), t = document.getElementById('runner-txt'); if (!d) return; d.className = 'wb-rdot ' + (on ? 'on' : 'off'); if (t) t.textContent = on ? 'runner online' : 'runner offline'; }
  function sidebar() {
    const S = document.querySelector('.side'), prof = Store.get().profile || {}, name = prof.name || Platform.name || 'You';
    const classes = Platform.classes || [], pinned = (Store.get().notes || []).filter(n => n.circuit).slice(0, 4);
    const pal = [['var(--sky)', '#0B5566'], ['var(--pink)', '#7A1F5E'], ['var(--lime)', '#3F5A0A'], ['#FFE9B8', '#6B4A00']];
    S.replaceChildren(
      h('div', { class: 'ws' }, h('span', { class: 'mark', 'aria-hidden': 'true' }, (() => { const s = svg('svg', { width: 18, height: 18, viewBox: '0 0 24 24' }); svg('circle', { cx: 12, cy: 12, r: 8.5, fill: 'none', stroke: '#DFFF9D', 'stroke-width': 2 }, s); svg('line', { x1: 12, y1: 12, x2: 17.5, y2: 6.5, stroke: '#fff', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, s); svg('circle', { cx: 12, cy: 12, r: 2, fill: '#fff' }, s); return s; })()), h('b', {}, 'QUBIQ'), h('span', { class: 'grow' }), h('button', { type: 'button', 'aria-label': 'Search and ask (⌘K)', title: 'Search and ask  ⌘K', onclick: palette }, icon('search'))),
      h('nav', { class: 'nav', 'aria-label': 'Spaces' }, NAV.map(([id, label, ic]) => h('a', { href: '#' + id, 'data-nav': id, title: label, 'aria-label': label }, icon(ic), h('span', {}, label)))),
      h('h4', {}, 'Classes'), h('div', { class: 'sub' }, classes.map((c, i) => h('a', { href: '#classroom' }, h('span', { class: 'av', style: { background: pal[i % 4][0], color: pal[i % 4][1] } }, (c.name || '?')[0].toUpperCase()), c.name)), h('a', { href: '#classroom' }, h('span', { class: 'av', style: { background: 'var(--white)', color: 'var(--muted)', border: '1px dashed var(--hair2)' } }, '+'), classes.length ? 'Instructor view' : 'Start or join a class')),
      h('h4', {}, 'Pinned'), h('div', { class: 'sub' }, pinned.length ? pinned.map(n => h('a', { href: '#lab', onclick: () => Lab.load(n.circuit) }, h('span', { class: 'thumb-s' }, icon('grid', 's')), n.title)) : h('a', { href: '#lab' }, h('span', { class: 'thumb-s' }, icon('plus', 's')), 'Save a circuit with ⌘S')),
      h('div', { class: 'me' }, h('span', { class: 'av' }, name[0].toUpperCase()), h('div', {}, h('b', {}, name), h('span', {}, Platform.id ? 'Signed in' : 'On this device'))));
    markNav();
  }
  function markNav() { const map = { canvas: 'lab', lesson: 'learn', exam: 'learn', course: 'learn', mlesson: 'learn', assess: 'learn', alg: 'algorithms', challenge: 'practice', arrival: 'home', placement: 'home', tests: 'notebook', classroom: '' }; const v = document.body.dataset.view; document.querySelectorAll('.nav a').forEach(a => a.toggleAttribute('aria-current', a.dataset.nav === (map[v] ?? v))); document.querySelectorAll('.nav a[aria-current]').forEach(a => a.setAttribute('aria-current', 'page')); }
  /* ---- ⌘K: jump anywhere or ask Qubit ---- */
  function palette() {
    if (document.getElementById('palette')) return; const items = [['Home', '#home'], ['Learn: modules', '#learn'], ['Progress', '#progress'], ...(typeof LEARN !== 'undefined' ? LEARN.lessons().map(x => [`${x.m.title} · ${x.l.title}`, '#m-' + x.l.id]).concat(LEARN.modules.map(m => [`${m.title} · assessment`, '#assess-' + m.id])) : []), ['Course map', '#course'], ['Laboratory', '#lab'], ['Algorithms', '#algorithms'], ['Practice', '#practice'], ['Notebook', '#notebook'], ['Classroom', '#classroom'], ['Validation', '#validation'], ['Verification', '#tests'], ...COURSE.chapters[2].lessons.map(l => [`Lesson 2.${l.n} · ${l.title}`, '#' + l.id]), ...(window.ALGOS || []).map(a => [`Algorithm · ${a.title}`, '#alg-' + a.id])];
    const inp = h('input', { class: 'uline', placeholder: 'Jump to… or ask Qubit anything', 'aria-label': 'Search or ask', style: { width: '100%', height: '48px', fontSize: '16px' } }), list = h('div', { role: 'listbox', style: { marginTop: '10px', maxHeight: '320px', overflow: 'auto' } });
    const box = h('div', { id: 'palette', class: 'pop', role: 'dialog', 'aria-label': 'Search and ask', style: { position: 'fixed', left: '50%', top: '16vh', transform: 'translateX(-50%)', width: 'min(560px,92vw)' } }, inp, list);
    const close = () => { box.remove(); removeEventListener('keydown', esc, true); }; const esc = e => { if (e.key === 'Escape') close(); };
    const paint = () => { const q = inp.value.trim().toLowerCase(), hits = items.filter(([t]) => !q || t.toLowerCase().includes(q)).slice(0, 8); list.replaceChildren(...(q ? [h('button', { type: 'button', class: 'btn bare', style: { width: '100%', justifyContent: 'flex-start' }, onclick: () => { close(); App.pendingAsk = inp.value.trim(); location.hash = '#home'; if (current === 'home') route(); } }, icon('tutor'), `Ask Qubit: “${inp.value.trim()}”`)] : []), ...hits.map(([t, href]) => h('a', { href, class: 'btn bare', style: { width: '100%', justifyContent: 'flex-start' }, onclick: close }, icon('arrow', 's'), t))); };
    inp.addEventListener('input', paint); inp.addEventListener('keydown', e => { if (e.key === 'Enter') { const f = list.querySelector('a,button'); f && f.click(); } });
    document.body.append(box); addEventListener('keydown', esc, true); setTimeout(() => addEventListener('pointerdown', function off(ev) { if (!box.contains(ev.target)) { close(); removeEventListener('pointerdown', off); } })); paint(); inp.focus();
  }
  /* ---- router ---- */
  function route() {
    let k = location.hash.slice(1); const prof = Store.get().profile;
    if (!k) k = prof ? 'home' : 'landing'; if (k === 'today') k = 'home';
    let view = k, arg = null;
    if (/^l-\d+-\d+$/.test(k)) { view = 'lesson'; arg = k; } else if (/^exam-\d+$/.test(k)) { view = 'exam'; arg = +k.split('-')[1]; } else if (/^alg-[\w-]+$/.test(k)) { view = 'alg'; arg = k.slice(4); } else if (/^ch-[\w-]+$/.test(k)) { view = 'challenge'; arg = k.slice(3); } else if (/^c-[\w-]+$/.test(k)) { view = 'lab'; arg = k.slice(2); } else if (/^m-[a-z]\d+$/.test(k)) { view = 'mlesson'; arg = k.slice(2); } else if (/^assess-[\w-]+$/.test(k)) { view = 'assess'; arg = k.slice(7); }
    if (k === 'tutor') view = 'home';
    if (view !== 'landing' && !VIEWS.includes(view)) view = 'home';
    live && live.destroy && live.destroy(); live = null;
    document.body.dataset.view = view; document.querySelectorAll('#main > .view').forEach(e => e.hidden = e.id !== 'view-' + view);
    const el = view === 'landing' ? $v('landing') : $v(view);
    el.classList.toggle('board-view', ['lab', 'canvas', 'course', 'alg', 'challenge'].includes(view));
    top({ arrival: ['Welcome'], placement: ['Placement'] }[view] || ''); markNav();
    const R = { landing: () => Landing.render(el), arrival: () => { Tour.pending = true; location.replace('#lab'); return null; }, placement: () => Journey.placement(el), home: () => Home.render(el, { focusAsk: k === 'tutor' }), course: () => CourseMap.render(el), lesson: () => Course.lesson(el, arg), exam: () => Course.exam(el, arg), algorithms: () => Algos.gallery(el), alg: () => Algos.page(el, arg), practice: () => Practice.list(el), challenge: () => Practice.challenge(el, arg), notebook: () => Notebook.render(el), classroom: () => Classroom.render(el), tests: () => testsView(el), validation: () => Validation.render(el), learn: () => Learn.hub(el), mlesson: () => Learn.lesson(el, arg), assess: () => Learn.assess(el, arg), progress: () => Learn.progress(el),
      lab: () => { if (arg) { try { Workbench.load(Share.decode(arg)); } catch (e) { toast('That share link is damaged.'); } } if (!labMounted) { Workbench.mount(el); labMounted = true; } else Workbench.onShow(); return Tour.pending ? Tour.start() : null; },
      canvas: () => { if (!canvasMounted) { Lab.mount(el); canvasMounted = true; } try { Lab._load(Workbench.ir(), 'From the circuit page'); } catch (e) { } Lab.onShow(); } };
    live = R[view] ? R[view]() : null;
    if (current !== k && view !== 'lab' && view !== 'canvas') { el.scrollTop = 0; const h1 = el.querySelector('h1'); if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); } }
    current = k;
  }
  function testsView(el) {
    const T = PHYSICS_TESTS(Sim), ok = T.filter(t => t.pass).length; top(['Notebook', 'Verification']);
    el.replaceChildren(h('div', { class: 'page' }, h('header', { class: 'page-head' }, h('h1', { class: 'display' }, `${ok} of ${T.length} physics checks pass`), h('p', { class: 'prose' }, 'The simulator re-derives these results in your browser every time this page opens: Grover, CHSH, H₂ at 0.735 Å, Shor, phase estimation, teleportation and the basic identities.')),
      h('div', { class: 'card' }, h('table', { class: 'tbl' }, h('tr', {}, h('th', {}, 'Check'), h('th', {}, 'Result'), h('th', {}, 'Computed')), ...T.map(t => h('tr', {}, h('td', {}, t.name), h('td', {}, h('span', { class: 'badge ' + (t.pass ? 'b-lime' : 'b-magenta') }, t.pass ? 'pass' : 'fail')), h('td', { class: 'mono' }, String(t.got))))))));
  }
  function start() {
    // anything that "opens a circuit in the Lab" (algorithms, pinned circuits, script cards, tutor builds) lands in the Laboratory
    if (typeof Lab !== 'undefined' && Lab.load && !Lab.load._wb) { const orig = Lab.load; Lab.load = function (c, ...rest) { try { orig.call(Lab, c, ...rest); } catch (e) { } try { Workbench.load(c); } catch (e) { toast('That circuit could not be opened in the Laboratory: ' + e.message); } }; Lab.load._wb = true; }
    const main = document.getElementById('main'); VIEWS.forEach(v => main.append(h('div', { class: 'view', id: 'view-' + v, hidden: true })));
    const tg = document.querySelector('.top .side-tg'); tg.append(icon('panel'));
    const setSide = c => { document.body.classList.toggle('side-collapsed', c); tg.setAttribute('aria-label', c ? 'Expand the sidebar' : 'Collapse the sidebar'); tg.title = (c ? 'Expand' : 'Collapse') + ' the sidebar ([)'; tg.setAttribute('aria-pressed', String(c)); Store.set('sideCollapsed', c); };
    setSide(!!Store.get().sideCollapsed); tg.addEventListener('click', () => setSide(!document.body.classList.contains('side-collapsed')));
    addEventListener('keydown', e => { if (e.key === '[' && !e.metaKey && !e.ctrlKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) && !document.activeElement?.closest?.('.score')) setSide(!document.body.classList.contains('side-collapsed')); });
    document.querySelector('.top .back').append(icon('back')); document.querySelector('.top .back').addEventListener('click', () => history.length > 1 ? history.back() : (location.hash = '#home'));
    addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette(); } });
    sidebar(); Store.on(() => { clearTimeout(App._sb); App._sb = setTimeout(sidebar, 300); });
    addEventListener('hashchange', route); route(); Platform.init().then(sidebar);
  }
  return { start, top, route, palette, sidebar, pendingAsk: null, setRunnerStatus };
})();
/* share by link: #c-<base64url of the circuit> */
const Share = {
  encode(C) { const t = JSON.stringify({ n: C.n, nc: C.nc, name: C.name, params: C.params, ops: C.ops.map(o => [o.g, o.q, o.c, o.p, o.col, o.cb, o.cond]) }); return btoa(unescape(encodeURIComponent(t))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  decode(s) { const t = decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))), d = JSON.parse(t); return { n: d.n, nc: d.nc, name: d.name || 'Shared circuit', params: d.params || {}, defs: {}, ops: d.ops.map(([g, q, c, p, col, cb, cond]) => IR.op(g, q, { c: c || [], p: p || [], col, cb, cond })) }; },
  link(C) { return location.href.split('#')[0] + '#c-' + Share.encode(C); }
};
