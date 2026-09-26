/* =====================================================================
   KIT — DOM helpers, storage, motion, drag, typographic controls, math,
   leader lines, toasts, and the simulator worker bridge.
===================================================================== */
const Sim = SIMLIB();
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs) { const v = attrs[k]; if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v); else if (k === 'style' && typeof v === 'object') { for (const sk in v) sk.startsWith('--') ? e.style.setProperty(sk, v[sk]) : (e.style[sk] = v[sk]); } else e.setAttribute(k, v === true ? '' : v); }
  kids.flat(Infinity).forEach(c => c != null && c !== false && e.append(c.nodeType ? c : document.createTextNode(c)));
  return e;
}
const NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cssv = (n, el = document.body) => getComputedStyle(el).getPropertyValue(n).trim();
const LOCALE = (() => { for (const l of (navigator.languages || [navigator.language || 'en-IN'])) { try { new Intl.NumberFormat(l); return l; } catch (e) { } } return 'en-IN'; })();
const fmt = {
  n: x => Math.round(x).toLocaleString(LOCALE), p: (x, d = 1) => (x * 100).toFixed(d) + '%', f: (x, d = 3) => (Math.abs(x) < 5e-13 ? 0 : x).toFixed(d),
  date: iso => new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }),
  time: iso => new Date(iso).toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' }),
  cplx: (r, i, d = 3) => { r = Math.abs(r) < 5e-7 ? 0 : r; i = Math.abs(i) < 5e-7 ? 0 : i; if (!i) return r.toFixed(d); if (!r) return i.toFixed(d) + 'i'; return `${r.toFixed(d)} ${i < 0 ? '−' : '+'} ${Math.abs(i).toFixed(d)}i`; },
  ang: x => { const k = x / Math.PI; for (const d of [1, 2, 3, 4, 6, 8]) { const m = k * d; if (Math.abs(m - Math.round(m)) < 1e-6) { const n = Math.round(m); if (n === 0) return '0'; return `${n === 1 ? '' : n === -1 ? '−' : n}π${d === 1 ? '' : '/' + d}`; } } return x.toFixed(3); }
};
function announce(msg) { const r = $('#live'); if (!r) return; r.textContent = ''; setTimeout(() => r.textContent = msg, 30); }
function toast(msg, undo) {
  const t = $('#toast'); t.replaceChildren(h('span', {}, msg)); if (undo) t.append(h('button', { type: 'button', class: 'btn', onclick: () => { undo(); t.hidden = true; announce('Restored.'); } }, 'Undo'));
  t.hidden = false; announce(msg); clearTimeout(t._t); t._t = setTimeout(() => t.hidden = true, undo ? 6500 : 3400);
}

/* ---------------- storage: per viewer, synced to the platform when signed in ---------------- */
const Store = (() => {
  const K = 'qlab.v2';
  const blank = () => ({ notes: [], progress: {}, attempts: [], bkt: {}, profile: null, lab: null, jobs: [], depth: null, lang: 'en', seen: {}, drafts: {}, certs: [], best: {} });
  let data = blank(), subs = new Set(), syncFn = null, t = null;
  try { const raw = localStorage.getItem(K); if (raw) data = Object.assign(blank(), JSON.parse(raw)); } catch (e) { }
  const save = () => { try { localStorage.setItem(K, JSON.stringify(data)); } catch (e) { } clearTimeout(t); t = setTimeout(() => syncFn && syncFn(data), 800); subs.forEach(f => f(data)); };
  const S = {
    get: () => data, save, on(f) { subs.add(f); return () => subs.delete(f); },
    setSync(f) { syncFn = f; }, merge(remote) { if (!remote) return; for (const k of Object.keys(blank())) { if (Array.isArray(data[k]) && Array.isArray(remote[k])) { const ids = new Set(data[k].map(x => x.id || JSON.stringify(x))); remote[k].forEach(x => { if (!ids.has(x.id || JSON.stringify(x))) data[k].push(x); }); } else if (data[k] && typeof data[k] === 'object' && remote[k] && typeof remote[k] === 'object') data[k] = Object.assign({}, remote[k], data[k]); else if (data[k] == null) data[k] = remote[k]; } save(); },
    note(n) { const id = 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); data.notes.unshift(Object.assign({ id, at: new Date().toISOString(), reviews: 0, due: Date.now() + 864e5 }, n)); save(); return id; },
    removeNote(id) { const i = data.notes.findIndex(n => n.id === id); if (i < 0) return null; const [n] = data.notes.splice(i, 1); save(); return { n, i }; },
    restoreNote(x) { data.notes.splice(x.i, 0, x.n); save(); },
    reviewed(id, ok) { const n = data.notes.find(n => n.id === id); if (!n) return; n.reviews = ok ? n.reviews + 1 : 0; n.due = Date.now() + 864e5 * Math.pow(2.2, n.reviews); save(); },
    progress(key, v) { data.progress[key] = Math.max(data.progress[key] || 0, v); save(); },
    attempt(a) { a = Object.assign({ at: Date.now(), id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4) }, a); data.attempts.push(a); if (data.attempts.length > 800) data.attempts.shift(); if (a.concept) Knowledge.update(a.concept, a.ok); save(); return a; },
    job(j) { data.jobs.unshift(Object.assign({ id: 'j' + Date.now().toString(36), at: new Date().toISOString() }, j)); data.jobs.length = Math.min(data.jobs.length, 60); save(); },
    set(k, v) { data[k] = v; save(); }, reset() { data = blank(); save(); }
  };
  return S;
})();
/* Bayesian knowledge tracing, one tracker per concept */
const Knowledge = {
  P: { init: .2, learn: .15, guess: .2, slip: .1 },
  update(concept, ok) { const d = Store.get().bkt, p = d[concept] ?? this.P.init, { guess: g, slip: s, learn: l } = this.P;
    const post = ok ? p * (1 - s) / (p * (1 - s) + (1 - p) * g) : p * s / (p * s + (1 - p) * (1 - g)); d[concept] = post + (1 - post) * l; },
  get(c) { return Store.get().bkt[c] ?? this.P.init; },
  weakest(concepts) { return concepts.slice().sort((a, b) => this.get(a) - this.get(b))[0]; }
};

/* ---------------- motion ---------------- */
const Motion = {
  reduced: (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })(),
  to(obj, vars) {
    const v = Object.assign({}, vars); if (Motion.reduced) { v.duration = .001; v.delay = 0; }
    if (window.gsap) return gsap.to(obj, v);
    const keys = Object.keys(v).filter(k => typeof v[k] === 'number' && !['duration', 'delay'].includes(k)), from = {}; keys.forEach(k => from[k] = obj[k]);
    const dur = (v.duration ?? .3) * 1000; let t0 = null, dead = false; const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const step = ts => { if (dead) return; if (t0 === null) t0 = ts; const t = Math.min(1, (ts - t0) / Math.max(1, dur)), e = ease(t); keys.forEach(k => obj[k] = from[k] + (v[k] - from[k]) * e); v.onUpdate && v.onUpdate(); if (t < 1) requestAnimationFrame(step); else v.onComplete && v.onComplete(); };
    setTimeout(() => requestAnimationFrame(step), (v.delay || 0) * 1000); return { kill() { dead = true; } };
  },
  wait(ms) { return new Promise(r => setTimeout(r, Motion.reduced ? 0 : ms)); }
};

/* ---------------- drag with click + keyboard alternatives ---------------- */
const Drag = {
  just: false,
  start(e, label, { onMove, onDrop, onCancel } = {}) {
    if (e.button > 0) return false;
    const x0 = e.clientX, y0 = e.clientY; let moved = false, ghost = null;
    const mv = ev => { if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 5) { moved = true; ghost = h('div', { class: 'drag-ghost', 'aria-hidden': 'true' }, label); document.body.append(ghost); document.body.classList.add('dragging'); }
      if (moved) { ghost.style.transform = `translate(${ev.clientX - 20}px,${ev.clientY - 20}px)`; onMove && onMove(ev); } };
    const end = (ev, cancel) => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', cc); removeEventListener('keydown', esc); document.body.classList.remove('dragging'); ghost && ghost.remove();
      if (moved) { Drag.just = true; setTimeout(() => Drag.just = false, 60); if (!cancel) onDrop && onDrop(ev); else onCancel && onCancel(); } };
    const up = ev => end(ev, false), cc = ev => end(ev, true), esc = ev => { if (ev.key === 'Escape') end(ev, true); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', cc); addEventListener('keydown', esc);
    return true;
  }
};

/* ---------------- typographic controls ---------------- */
const Ctl = {
  // an ink rule with a draggable tick (ARIA slider)
  slider({ label, min = 0, max = 1, step = .01, value = 0, fmt: f = v => v.toFixed(2), onInput, onChange, notches, id }) {
    let v = value;
    const rule = h('div', { class: 'rule', role: 'slider', tabindex: 0, 'aria-label': label, 'aria-valuemin': min, 'aria-valuemax': max, id });
    const done = h('div', { class: 'done' }), tick = h('div', { class: 'tick' }), out = h('span', { class: 'val' });
    if (notches) for (let k = 0; k <= notches; k++) rule.append(h('i', { class: 'notch', style: { left: (k / notches * 100) + '%' } }));
    rule.append(done, tick);
    const set = (x, fire) => { x = Math.min(max, Math.max(min, Math.round((x - min) / step) * step + min)); x = +x.toFixed(10); const changed = x !== v; v = x; const f01 = (v - min) / (max - min || 1); tick.style.left = f01 * 100 + '%'; done.style.width = f01 * 100 + '%'; out.textContent = f(v); rule.setAttribute('aria-valuenow', v); rule.setAttribute('aria-valuetext', f(v)); if (fire && changed) onInput && onInput(v); };
    const fromX = e => { const r = rule.getBoundingClientRect(); set(min + (e.clientX - r.left) / r.width * (max - min), true); };
    rule.addEventListener('pointerdown', e => { rule.setPointerCapture(e.pointerId); fromX(e); rule.focus(); const mv = ev => fromX(ev); const up = () => { rule.removeEventListener('pointermove', mv); rule.removeEventListener('pointerup', up); onChange && onChange(v); }; rule.addEventListener('pointermove', mv); rule.addEventListener('pointerup', up); });
    rule.addEventListener('keydown', e => { const big = (max - min) / 10; const k = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: big, PageDown: -big }[e.key]; if (k != null) { e.preventDefault(); set(v + k, true); onChange && onChange(v); } if (e.key === 'Home') { e.preventDefault(); set(min, true); onChange && onChange(v); } if (e.key === 'End') { e.preventDefault(); set(max, true); onChange && onChange(v); } });
    const el = h('div', { class: 'islide' }, h('span', { class: 'lbl' }, label), rule, out);
    set(value, false); el.set = x => set(x, false); el.get = () => v; el.rule = rule; return el;
  },
  // three engraved notches: Intuition · Formal · Research
  dial({ value = 'intuition', onChange, labels = ['Intuition', 'Formal', 'Research'] }) {
    const keys = labels.map(l => l.toLowerCase()), el = h('div', { class: 'dial', role: 'radiogroup', 'aria-label': 'Depth' });
    const btns = keys.map((k, i) => h('button', { type: 'button', role: 'radio', 'aria-checked': k === value ? 'true' : 'false', tabindex: k === value ? 0 : -1, onclick: () => pick(k, true) }, h('i', { 'aria-hidden': 'true' }), labels[i]));
    function pick(k, focus) { value = k; btns.forEach((b, i) => { const on = keys[i] === k; b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); }); onChange && onChange(k); }
    el.addEventListener('keydown', e => { const i = keys.indexOf(value), d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (d) { e.preventDefault(); pick(keys[(i + d + keys.length) % keys.length], true); } });
    el.append(...btns); el.set = k => { value = k; btns.forEach((b, i) => { b.setAttribute('aria-checked', keys[i] === k); b.tabIndex = keys[i] === k ? 0 : -1; }); }; return el;
  },
  // typographic listbox that replaces <select>
  menu({ label, options, value, onChange, id }) {
    const wrap = h('div', { class: 'menu' }), lbId = (id || 'm' + Math.random().toString(36).slice(2, 7)) + '-lb';
    const cur = () => options.find(o => o.value === value) || options[0];
    const btn = h('button', { type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-label': label ? `${label}: ${cur().label}` : cur().label }, cur().label);
    const lb = h('div', { role: 'listbox', id: lbId, tabindex: -1, hidden: true, 'aria-label': label || 'Choose' }); let hot = 0;
    const paint = () => { lb.replaceChildren(...options.map((o, i) => h('div', { role: 'option', id: lbId + '-' + i, 'aria-selected': o.value === value ? 'true' : 'false', class: i === hot ? 'is-hot' : '', onclick: () => choose(i) }, h('span', {}, o.label), o.hint ? h('small', {}, o.hint) : null))); lb.setAttribute('aria-activedescendant', lbId + '-' + hot); };
    const open = () => { hot = Math.max(0, options.findIndex(o => o.value === value)); paint(); lb.hidden = false; btn.setAttribute('aria-expanded', 'true'); lb.focus(); setTimeout(() => addEventListener('pointerdown', away), 0); };
    const close = f => { lb.hidden = true; btn.setAttribute('aria-expanded', 'false'); removeEventListener('pointerdown', away); if (f) btn.focus(); };
    const away = e => { if (!wrap.contains(e.target)) close(false); };
    const choose = i => { value = options[i].value; btn.textContent = options[i].label; btn.setAttribute('aria-label', label ? `${label}: ${options[i].label}` : options[i].label); close(true); onChange && onChange(value); };
    btn.addEventListener('click', () => lb.hidden ? open() : close(true));
    btn.addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); } });
    lb.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { hot = Math.min(options.length - 1, hot + 1); paint(); e.preventDefault(); } else if (e.key === 'ArrowUp') { hot = Math.max(0, hot - 1); paint(); e.preventDefault(); } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(hot); } else if (e.key === 'Escape' || e.key === 'Tab') { close(e.key === 'Escape'); } else if (e.key === 'Home') { hot = 0; paint(); } else if (e.key === 'End') { hot = options.length - 1; paint(); } });
    wrap.append(btn, lb); wrap.set = v => { value = v; btn.textContent = cur().label; }; wrap.setOptions = o => { options = o; btn.textContent = cur().label; }; return wrap;
  },
  // a row of plain words that underline when active
  words(options, value, onChange, { multi = false, label } = {}) {
    const el = h('div', { class: 'words', role: 'group', 'aria-label': label });
    const sel = new Set(multi ? value : [value]);
    const paint = () => el.replaceChildren(...options.map(o => h('button', { type: 'button', 'aria-pressed': sel.has(o.value) ? 'true' : 'false', title: o.title || null, onclick: () => { if (multi) { if (o.locked) return; sel.has(o.value) ? sel.delete(o.value) : sel.add(o.value); onChange([...sel]); } else { sel.clear(); sel.add(o.value); onChange(o.value); } paint(); } }, o.label)));
    paint(); el.set = v => { sel.clear(); (multi ? v : [v]).forEach(x => sel.add(x)); paint(); }; return el;
  },
  field({ label, value = '', placeholder, onInput, onEnter, id, type = 'text', mono }) {
    const inp = h('input', { class: 'uline' + (mono ? ' mono' : ''), id, type, value, placeholder, autocomplete: 'off', spellcheck: 'false', 'aria-label': label });
    inp.addEventListener('input', () => onInput && onInput(inp.value.trim())); inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); onEnter && onEnter(inp.value.trim()); } }); return inp;
  }
};

/* ---------------- math: KaTeX → native MathML (no web fonts needed) ---------------- */
const Tex = {
  html(tex, display = false) { try { if (window.katex) return katex.renderToString(tex, { output: 'mathml', displayMode: display, throwOnError: false, strict: false, trust: false }); } catch (e) { } return `<code>${esc(tex)}</code>`; },
  into(el, tex, display) { el.innerHTML = this.html(tex, display); return el; },
  // inline $…$ inside prose
  prose(s) { return esc(s).replace(/\$\$(.+?)\$\$/g, (_, t) => `<div class="tex-block">${this.html(t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'), true)}</div>`).replace(/\$(.+?)\$/g, (_, t) => this.html(t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'))).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code>$1</code>'); }
};

/* ---------------- leader line from margin text to a stage object ---------------- */
const Leader = {
  el: null,
  show(from, to, ms = 9000) {
    if (!to || !from) return this.hide();
    if (!this.el) { this.el = svg('svg', { class: 'leader', 'aria-hidden': 'true' }); document.body.append(this.el); this.line = svg('line', {}, this.el); this.dot = svg('circle', { class: 'dot', r: 2.5 }, this.el); this.ring = svg('circle', {}, this.el); addEventListener('scroll', () => this.place(), { passive: true, capture: true }); addEventListener('resize', () => this.place()); }
    this.from = from; this.to = to; this.el.style.display = ''; this.place(); clearTimeout(this._t); this._t = setTimeout(() => this.hide(), ms);
  },
  place() {
    if (!this.to || !this.el || this.el.style.display === 'none') return;
    if (!document.contains(this.to) || !document.contains(this.from)) return this.hide();
    const a = this.from.getBoundingClientRect(), b = this.to.getBoundingClientRect(), wide = innerWidth > 1000;
    const x1 = wide ? a.left - 10 : a.left + 16, y1 = wide ? a.top + 12 : a.top - 6, x2 = b.left + b.width / 2, y2 = b.top + b.height / 2, r = Math.min(80, Math.max(12, Math.max(b.width, b.height) / 2 + 6));
    const L = Math.hypot(x2 - x1, y2 - y1) || 1, ex = x2 - (x2 - x1) / L * r, ey = y2 - (y2 - y1) / L * r;
    Object.entries({ x1, y1, x2: ex, y2: ey }).forEach(([k, v]) => this.line.setAttribute(k, v)); this.dot.setAttribute('cx', x1); this.dot.setAttribute('cy', y1);
    this.ring.setAttribute('cx', x2); this.ring.setAttribute('cy', y2); this.ring.setAttribute('r', r);
  },
  hide() { if (this.el) this.el.style.display = 'none'; }
};

/* ---------------- fixed-composition stage scaled into its column ---------------- */
function fitStage(outer) {
  const inner = outer.firstElementChild;
  const ro = new ResizeObserver(() => { const portrait = !!outer.dataset.pw && outer.clientWidth < 700, W = +(portrait ? outer.dataset.pw : outer.dataset.w), H = +(portrait ? outer.dataset.ph : outer.dataset.h);
    inner.classList.toggle('portrait', portrait); inner.style.width = W + 'px'; inner.style.height = H + 'px'; const s = Math.min(1, outer.clientWidth / W); inner.style.transform = `scale(${s})`; outer.style.height = H * s + 'px'; inner.dataset.cw = W; });
  ro.observe(outer);
}
function boardPoint(inner, e) { const r = inner.getBoundingClientRect(), W = +(inner.dataset.cw || inner.parentElement.dataset.w), s = r.width / W; return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s }; }

/* ---------------- simulator worker (heavy runs never block the page) ---------------- */
const Work = (() => {
  let w = null, seq = 0; const pend = new Map();
  const handler = `self.onmessage = e => { const { id, type, arg } = e.data; try { let r;
    if (type === 'sample') r = arg.stab ? Sim.stabSample(arg.circ, arg.shots, arg.seed) : Sim.sample(arg.circ, arg.shots, arg);
    else if (type === 'density') { const d = Sim.densityRun(arg.circ, arg.noise || {}, arg.upto ?? Infinity); r = { n: d.n, re: Array.from(d.v.re), im: Array.from(d.v.im) }; }
    else if (type === 'qaoaGrid') { const out = []; for (let i = 0; i < arg.res; i++) { const row = []; for (let j = 0; j < arg.res; j++) row.push(Sim.qaoa(arg.n, arg.edges, [arg.gmax * i / (arg.res - 1)], [arg.bmax * j / (arg.res - 1)]).expect); out.push(row); } r = out; }
    else if (type === 'h2curve') r = arg.Rs.map(R => { const H = Sim.h2(R); return { R, E0: H.E0, Ehf: H.Ehf }; });
    self.postMessage({ id, ok: true, r }); } catch (err) { self.postMessage({ id, ok: false, err: String(err.message || err) }); } };`;
  function boot() { if (w !== null) return w; try { const src = SIMLIB.toString() + '\nconst Sim = SIMLIB();\n' + handler; w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))); w.onmessage = e => { const p = pend.get(e.data.id); if (!p) return; pend.delete(e.data.id); e.data.ok ? p.res(e.data.r) : p.rej(new Error(e.data.err)); }; w.onerror = () => { w = false; }; } catch (e) { w = false; } return w; }
  function local(type, arg) {
    if (type === 'sample') return arg.stab ? Sim.stabSample(arg.circ, arg.shots, arg.seed) : Sim.sample(arg.circ, arg.shots, arg);
    if (type === 'density') { const d = Sim.densityRun(arg.circ, arg.noise || {}, arg.upto ?? Infinity); return { n: d.n, re: Array.from(d.v.re), im: Array.from(d.v.im) }; }
    if (type === 'qaoaGrid') { const out = []; for (let i = 0; i < arg.res; i++) { const row = []; for (let j = 0; j < arg.res; j++) row.push(Sim.qaoa(arg.n, arg.edges, [arg.gmax * i / (arg.res - 1)], [arg.bmax * j / (arg.res - 1)]).expect); out.push(row); } return out; }
    if (type === 'h2curve') return arg.Rs.map(R => { const H = Sim.h2(R); return { R, E0: H.E0, Ehf: H.Ehf }; });
  }
  return { call(type, arg) { const W = boot(); if (!W) return Promise.resolve().then(() => local(type, arg)); const id = ++seq; return new Promise((res, rej) => { pend.set(id, { res, rej }); W.postMessage({ id, type, arg: JSON.parse(JSON.stringify(arg)) }); }).catch(() => local(type, arg)); } };
})();

/* ---------------- capability access (platform) ---------------- */
const Cap = (() => { const cache = {}; return { use(name) { if (name === 'sample' || !window.claude || !claude.use) return Promise.resolve(null); /* 'sample' (Claude) is never used */ return cache[name] || (cache[name] = claude.use(name).catch(() => null)); } }; })();
