/* =====================================================================
   SCORE — the circuit as staves in time. Crisp ink marks, a playhead on
   the score, lasso, rewiring, lenses, sub-circuit blocks, keyboard cursor.
===================================================================== */
let UID = 1;
const newId = () => UID++;
const IR = {
  op(g, q, extra = {}) { return Object.assign({ id: newId(), g, q: q.slice(), c: [], p: [], col: 0 }, extra, { c: (extra.c || []).slice(), p: (extra.p || []).slice() }); },
  clone(c) { const x = JSON.parse(JSON.stringify(c)); x.ops.forEach(o => { o.id = o.id || newId(); UID = Math.max(UID, o.id + 1); }); return x; },
  fromList(n, list, extra = {}) { return Object.assign({ n, nc: n, ops: list.map(([g, q, col, o]) => IR.op(g, q, Object.assign({ col }, o || {}))), defs: {}, params: {} }, extra); },
  cols(c) { return Math.max(0, ...c.ops.map(o => Math.floor(o.col) + 1)); },
  compact(c) { c.ops = Passes.asap(c.ops, c.n).map(o => Object.assign(c.ops.find(x => x.id === o.id), { col: o.col })); return c; },
  occupied(c, col, qs, except = []) { const lo = Math.min(...qs), hi = Math.max(...qs); return c.ops.some(o => !except.includes(o) && Math.floor(o.col) === col && !(Sim.span(o)[1] < lo || Sim.span(o)[0] > hi)); },
  insert(c, op) { if (IR.occupied(c, op.col, Sim.wires(op), [op])) c.ops.forEach(o => { if (o !== op && o.col >= op.col) o.col++; }); if (!c.ops.includes(op)) c.ops.push(op); return op; }
};
const GATESET = {
  basic: ['H', 'X', 'Y', 'Z', 'S', 'T', 'CX', 'CZ', 'SWAP', 'M'],
  full: [['I', 'X', 'Y', 'Z', 'H'], ['S', 'SDG', 'T', 'TDG', 'SX', 'P'], ['RX', 'RY', 'RZ', 'U'], ['CX', 'CY', 'CZ', 'CH', 'CP', 'CRX', 'CRY', 'CRZ'], ['SWAP', 'ISWAP', 'CCX', 'CSWAP', 'MCX', 'MCZ'], ['RXX', 'RYY', 'RZZ'], ['M', 'RESET', 'BARRIER', 'IFX', 'LENS']]
};
/* palette entries → how to build the op at a cell */
const PALETTE = {
  CX: { g: 'X', nc: 1 }, CY: { g: 'Y', nc: 1 }, CZ: { g: 'Z', nc: 1 }, CH: { g: 'H', nc: 1 }, CP: { g: 'P', nc: 1 }, CRX: { g: 'RX', nc: 1 }, CRY: { g: 'RY', nc: 1 }, CRZ: { g: 'RZ', nc: 1 },
  CCX: { g: 'X', nc: 2 }, CSWAP: { g: 'SWAP', nc: 1 }, MCX: { g: 'X', nc: 3 }, MCZ: { g: 'Z', nc: 3 }, IFX: { g: 'X', cond: true }
};
const LABEL = { SDG: 'S†', TDG: 'T†', SX: '√X', SXDG: '√X†', ISWAP: 'iSW', MCX: 'MCX', MCZ: 'MCZ', IFX: 'if c', LENS: 'lens', BARRIER: '┊', RESET: '|0⟩', M: 'M' };
function paletteChip(k) { if (PALETTE[k]) return k === 'IFX' ? 'meas' : 'ctl'; if (k === 'LENS' || k === 'BARRIER') return 'meta'; if (['SWAP', 'ISWAP', 'RXX', 'RYY', 'RZZ'].includes(k)) return 'two'; if (['M', 'RESET'].includes(k)) return 'meas'; if (['S', 'SDG', 'T', 'TDG', 'P'].includes(k)) return 'phase'; if (['RX', 'RY', 'RZ', 'U'].includes(k)) return 'rot'; return 'pauli'; }
function paletteFam(k) { if (PALETTE[k]) return k === 'IFX' ? 'measure' : 'control'; if (k === 'LENS') return 'meta'; const G = Sim.G[k]; return G ? (G.fam === 'rot' ? 'phase' : G.fam) : 'single'; }
function paletteTitle(k) { const t = { CX: 'CNOT (controlled-X)', CY: 'Controlled-Y', CZ: 'Controlled-Z', CH: 'Controlled-H', CP: 'Controlled phase', CRX: 'Controlled RX', CRY: 'Controlled RY', CRZ: 'Controlled RZ', CCX: 'Toffoli (CCX)', CSWAP: 'Fredkin (CSWAP)', MCX: 'Multi-controlled X', MCZ: 'Multi-controlled Z', IFX: 'X conditioned on a classical bit', LENS: 'Lens: probe the state at a step' }[k]; return t || (Sim.G[k] ? Sim.G[k].title : k); }
function defaultParams(g) { return { P: [Math.PI / 2], RX: [Math.PI / 2], RY: [Math.PI / 2], RZ: [Math.PI / 2], U: [Math.PI / 2, 0, Math.PI], RXX: [Math.PI / 2], RYY: [Math.PI / 2], RZZ: [Math.PI / 2] }[g] || []; }
function buildOp(key, n, col, q) {
  const P = PALETTE[key];
  if (key === 'LENS') return { lens: true };
  if (P && P.cond) return IR.op('X', [q], { col, cond: { bit: 0, val: 1 } });
  if (P) { const need = P.nc + Sim.G[P.g].nt; if (n < need) return { error: `${paletteTitle(key)} needs ${need} qubits. Add ${need - n} more.` };
    let start = Math.min(q, n - need); const wires = Array.from({ length: need }, (_, i) => start + i); return IR.op(P.g, wires.slice(P.nc), { c: wires.slice(0, P.nc), p: defaultParams(P.g), col }); }
  const G = Sim.G[key]; if (!G) return { error: 'Unknown gate.' };
  if (key === 'BARRIER') return IR.op('BARRIER', [...Array(n).keys()], { col });
  if (G.nt === 2) { if (n < 2) return { error: 'Two-qubit gates need 2 qubits.' }; const a = Math.min(q, n - 2); return IR.op(key, [a, a + 1], { p: defaultParams(key), col }); }
  return IR.op(key, [q], { p: defaultParams(key), col, cb: key === 'M' ? q : undefined });
}

function Score(host, opt = {}) {
  const CW = opt.compact ? 46 : 56, RH = opt.compact ? 44 : 52, GUT = 48, TOP = 26;
  let C = opt.circ, sel = new Set(), cur = { col: 0, q: 0 }, playhead = Infinity, pencils = [], lit = null, armed = null, lenses = [], ghostOps = [];
  const wrap = h('div', { class: 'score-wrap' }), el = svg('svg', { class: 'score', tabindex: 0, role: 'application', 'aria-roledescription': 'circuit score', 'aria-label': opt.label || 'Circuit score. Arrow keys move the cursor. Letters place gates: H X Y Z S T, C for CNOT, M to measure. Delete removes the selection. F flips a two-qubit gate. [ and ] move the playhead.' });
  wrap.append(el); host.replaceChildren(wrap);
  const cols = () => Math.max(opt.minCols || 10, IR.cols(C) + 3);
  const hasClassical = () => C.ops.some(o => o.g === 'M' || o.cond);
  const X = col => GUT + col * CW + CW / 2, Y = q => TOP + q * RH + RH / 2, cY = () => TOP + C.n * RH + 14;
  const emit = (label, fresh) => { opt.onChange && opt.onChange(C, label, fresh); render(); };
  const kz = r => r.width / (+el.getAttribute('width') || r.width) || 1;
  function cellAt(e) { const r = el.getBoundingClientRect(), k = kz(r), x = (e.clientX - r.left) / k, y = (e.clientY - r.top) / k; if (x < GUT - 24 || y < TOP - 6 || y > TOP + C.n * RH + 6 || x > r.width / k + 4) return null; return { col: Math.max(0, Math.floor((x - GUT) / CW)), q: Math.max(0, Math.min(C.n - 1, Math.floor((y - TOP) / RH))) }; }
  function opAt(col, q) { return C.ops.find(o => Math.floor(o.col) === col && q >= Sim.span(o)[0] && q <= Sim.span(o)[1]); }
  function paramText(o) { return (o.p || []).map(x => typeof x === 'number' ? fmt.ang(x) : String(x)).join(','); }
  function drawGate(o, g) {
    const x = X(Math.floor(o.col)), fam = o.g === 'SUB' ? 'sub' : ((Sim.G[o.g] || {}).fam || 'single'), cs = o.c || [], w = Sim.wires(o), lo = Math.min(...w), hi = Math.max(...w);
    const chip = o.g === 'SUB' ? 'sub' : cs.length ? 'ctl' : ['SWAP', 'ISWAP', 'ISWAPDG', 'RXX', 'RYY', 'RZZ'].includes(o.g) ? 'two' : ['M', 'RESET'].includes(o.g) ? 'meas' : ['S', 'SDG', 'T', 'TDG', 'P'].includes(o.g) ? 'phase' : ['RX', 'RY', 'RZ', 'U'].includes(o.g) ? 'rot' : 'pauli';
    g.setAttribute('class', `g chip-${chip} fam-${fam === 'rot' ? 'phase' : fam}${o.g === 'SUB' ? ' sub' : ''}${sel.has(o.id) ? ' sel' : ''}${lit === o.id ? ' lit' : ''}${playhead !== Infinity && o.col >= playhead ? ' ahead' : ''}${o.pencil ? ' pencil' : ''}`);
    if (o.g === 'BARRIER') { svg('line', { x1: x, x2: x, y1: Y(lo) - RH / 2 + 4, y2: Y(hi) + RH / 2 - 4, stroke: 'var(--graphite)', 'stroke-dasharray': '3 3' }, g); svg('rect', { x: x - 6, y: Y(lo) - RH / 2, width: 12, height: (hi - lo + 1) * RH, fill: 'transparent' }, g); return; }
    if (hi > lo) svg('line', { class: 'link', x1: x, x2: x, y1: Y(lo), y2: Y(hi) }, g);
    cs.forEach((q, k) => svg('circle', { class: 'dot', cx: x, cy: Y(q), r: 5, 'data-role': 'ctrl', 'data-k': k }, g));
    const label = o.g === 'SUB' ? o.sub : (LABEL[o.g] || o.g), par = paramText(o);
    if (o.g === 'X' && cs.length) { svg('circle', { class: 'targ', cx: x, cy: Y(o.q[0]), r: 12, 'data-role': 'targ', 'data-k': 0 }, g); svg('path', { class: 'link', d: `M${x - 11} ${Y(o.q[0])}H${x + 11}M${x} ${Y(o.q[0]) - 11}V${Y(o.q[0]) + 11}` }, g); }
    else if (o.g === 'Z' && cs.length) svg('circle', { class: 'dot', cx: x, cy: Y(o.q[0]), r: 5, 'data-role': 'targ', 'data-k': 0 }, g);
    else if (o.g === 'SWAP') o.q.forEach((q, k) => { svg('path', { class: 'link', d: `M${x - 7} ${Y(q) - 7}L${x + 7} ${Y(q) + 7}M${x + 7} ${Y(q) - 7}L${x - 7} ${Y(q) + 7}`, 'stroke-width': 1.6 }, g); svg('rect', { x: x - 10, y: Y(q) - 10, width: 20, height: 20, fill: 'transparent', 'data-role': 'targ', 'data-k': k }, g); });
    else {
      const t0 = Math.min(...o.q), t1 = Math.max(...o.q), bw = Math.max(34, 12 + 7.5 * Math.max(label.length, par ? par.length * .82 : 0)), top = Y(t0) - 17, H = (t1 - t0) * RH + 34;
      svg('rect', { class: 'box', x: x - bw / 2, y: top, width: bw, height: H, rx: 10, ry: 10, 'data-role': 'box' }, g);
      if (o.g === 'M') { svg('path', { d: `M${x - 9} ${Y(t0) + 6}A 9 9 0 0 1 ${x + 9} ${Y(t0) + 6}M${x} ${Y(t0) + 6}L${x + 6} ${Y(t0) - 6}`, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.2 }, g); }
      else { const tt = svg('text', { x, y: par ? Y(t0) + (t1 - t0) * RH / 2 - 5 : Y(t0) + (t1 - t0) * RH / 2 }, g); tt.textContent = label; if (par) { const pt = svg('text', { class: 'par', x, y: Y(t0) + (t1 - t0) * RH / 2 + 8 }, g); pt.textContent = par; } }
    }
    if (o.g === 'M' && hasClassical()) { svg('line', { x1: x - 1.5, x2: x - 1.5, y1: Y(o.q[0]) + 17, y2: cY(), stroke: 'var(--graphite)' }, g); svg('line', { x1: x + 1.5, x2: x + 1.5, y1: Y(o.q[0]) + 17, y2: cY(), stroke: 'var(--graphite)' }, g); const t = svg('text', { class: 'par', x: x + 12, y: cY() - 6 }, g); t.textContent = (o.cb ?? o.q[0]); }
    if (o.cond) { svg('line', { class: 'cond', x1: x, x2: x, y1: Y(hi) + 17, y2: cY() }, g); svg('circle', { cx: x, cy: cY(), r: 3.5, fill: 'var(--graphite)' }, g); const t = svg('text', { class: 'par', x, y: cY() + 14 }, g); t.textContent = o.cond.reg != null ? `c=${o.cond.val}` : `c${o.cond.bit}=${o.cond.val}`; }
  }
  function render() {
    const nc = cols(), W = GUT + nc * CW + 30, H = TOP + C.n * RH + (hasClassical() ? 44 : 26) + (opt.editable ? 18 : 0);
    el.setAttribute('viewBox', `0 0 ${W} ${H}`); el.setAttribute('width', W); el.setAttribute('height', H); el.replaceChildren();
    const bg = svg('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent', 'data-bg': 1 }, el);
    for (let q = 0; q < C.n; q++) { svg('line', { class: 'wire', x1: GUT - 10, x2: W - 10, y1: Y(q), y2: Y(q) }, el); const t = svg('text', { class: 'qlab', x: 8, y: Y(q) + 4 }, el); t.textContent = 'q' + q; }
    if (hasClassical()) { svg('line', { class: 'cwire', x1: GUT - 10, x2: W - 10, y1: cY() - 1.5, y2: cY() - 1.5 }, el); svg('line', { class: 'cwire', x1: GUT - 10, x2: W - 10, y1: cY() + 1.5, y2: cY() + 1.5 }, el); const t = svg('text', { class: 'qlab', x: 8, y: cY() + 4 }, el); t.textContent = `c/${C.nc ?? C.n}`; }
    // cursor
    svg('rect', { class: 'cur', x: GUT + cur.col * CW + 3, y: TOP + cur.q * RH + 3, width: CW - 6, height: RH - 6 }, el);
    // pencil suggestions (tutor)
    pencils.forEach(pc => { const ops = pc.ops.map(o => C.ops.find(x => x.id === o.id)).filter(Boolean); if (!ops.length) return; const c0 = Math.min(...ops.map(o => Math.floor(o.col))), c1 = Math.max(...ops.map(o => Math.floor(o.col))), w = ops.flatMap(o => Sim.wires(o)), lo = Math.min(...w), hi = Math.max(...w);
      svg('rect', { class: 'pring', x: X(c0) - CW / 2 + 2, y: Y(lo) - RH / 2 + 3, width: (c1 - c0 + 1) * CW - 4, height: (hi - lo + 1) * RH - 6, rx: 18 }, el);
      if (pc.kind === 'cancel') svg('line', { class: 'strike', x1: X(c0) - 16, y1: Y(hi) + 14, x2: X(c1) + 16, y2: Y(lo) - 14 }, el); });
    const layer = svg('g', {}, el);
    Sim.sorted(C.ops.concat(ghostOps)).forEach(o => { const g = svg('g', { 'data-id': o.id, tabindex: -1, role: 'img', 'aria-label': `${Sim.displayName(o)} on ${Sim.wires(o).map(q => 'q' + q).join(', ')}, step ${Math.floor(o.col) + 1}` }, layer); drawGate(o, g); });
    // lenses
    lenses.forEach(col => { const x = GUT + col * CW, s = Sim.run(C, col), p = Sim.probs(s), top = Array.from(p).map((v, i) => [v, i]).filter(a => a[0] > 1e-6).sort((a, b) => b[0] - a[0]).slice(0, 3);
      const lg = svg('g', { class: 'lens', 'data-lens': col, tabindex: 0, role: 'button', 'aria-label': `Lens after step ${col}: ${top.map(([v, i]) => `${Sim.ket(i, C.n)} ${fmt.p(v, 0)}`).join(', ')}. Press to remove.` }, el);
      svg('line', { x1: x, x2: x, y1: TOP - 8, y2: TOP + C.n * RH - 6, stroke: 'var(--ink2)', 'stroke-dasharray': '1 3' }, lg); svg('circle', { cx: x, cy: TOP - 12, r: 6 }, lg);
      top.forEach(([v, i], k) => { const t = svg('text', { x: x + 10, y: TOP + 6 + k * 11 }, lg); t.textContent = `${i.toString(2).padStart(C.n, '0')} ${fmt.p(v, 0)}`; }); });
    // playhead on the score
    if (opt.playhead !== false) {
      const ph = playhead === Infinity ? nc : playhead, x = GUT + ph * CW, g = svg('g', { class: 'ph', 'aria-hidden': 'true' }, el);
      svg('line', { x1: x, x2: x, y1: TOP - 6, y2: TOP + C.n * RH }, g); svg('circle', { class: 'knob', cx: x, cy: TOP - 13, r: 6.5 }, g); const hit = svg('rect', { x: x - 10, y: 0, width: 20, height: TOP + C.n * RH, 'data-ph': 1 }, g);
    }
    if (opt.editable && !opt.fixedQubits) { const t = svg('text', { class: 'addq', x: 8, y: TOP + C.n * RH + (hasClassical() ? 38 : 16), 'data-addq': 1 }, el); t.textContent = C.n < (opt.maxQubits || 12) ? '＋ qubit  (drag down)' : 'max qubits'; if (C.n > (opt.minQubits || 1)) { const r = svg('text', { class: 'addq', x: 160, y: TOP + C.n * RH + (hasClassical() ? 38 : 16), 'data-rmq': 1 }, el); r.textContent = '− last qubit'; } }
    opt.onRender && opt.onRender();
  }
  /* ---------- interactions ---------- */
  function hot(cell) { $$('.hot', el).forEach(x => x.remove()); if (!cell) return; svg('rect', { class: 'hot', x: GUT + cell.col * CW + 3, y: TOP + cell.q * RH + 3, width: CW - 6, height: RH - 6 }, el); }
  function place(key, col, q) {
    if (!opt.editable) return;
    if (opt.gates && !opt.gates.includes(key)) { announce(`${paletteTitle(key)} isn’t allowed here.`); return; }
    const op = buildOp(key, C.n, col, q);
    if (op.error) { announce(op.error); toast(op.error); return; }
    if (op.lens) { if (!lenses.includes(col)) lenses.push(col); render(); announce(`Lens dropped after step ${col}.`); return; }
    IR.insert(C, op); sel = new Set([op.id]); cur = { col: Math.floor(op.col), q };
    emit(`${paletteTitle(key)} on ${Sim.wires(op).map(x => 'q' + x).join(', ')}, step ${Math.floor(op.col) + 1}`);
  }
  function moveSel(dc, dq) {
    const ops = C.ops.filter(o => sel.has(o.id)); if (!ops.length) return false;
    if (ops.some(o => Sim.wires(o).some(q => q + dq < 0 || q + dq >= C.n) || o.col + dc < 0)) { announce('That would move a gate off the register.'); return false; }
    ops.forEach(o => { o.q = o.q.map(q => q + dq); o.c = (o.c || []).map(q => q + dq); if (o.g === 'M' && o.cb != null) o.cb = o.q[0]; o.col = Math.floor(o.col) + dc; });
    ops.sort((a, b) => a.col - b.col).forEach(o => IR.insert(C, o)); return true;
  }
  function removeSel(label) { const gone = C.ops.filter(o => sel.has(o.id)); if (!gone.length) return; C.ops = C.ops.filter(o => !sel.has(o.id)); sel.clear(); emit(label || `${gone.map(o => Sim.displayName(o)).join(', ')} removed`); }
  el.addEventListener('pointerdown', e => {
    const gEl = e.target.closest('[data-id]'), role = e.target.getAttribute('data-role');
    if (e.target.closest('[data-ph]')) { // drag the playhead
      e.preventDefault(); const mv = ev => { const r = el.getBoundingClientRect(); const c = Math.max(0, Math.min(cols(), Math.round(((ev.clientX - r.left) / kz(r) - GUT) / CW))); setPlayhead(c >= IR.cols(C) ? Infinity : c, true); };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); mv(e); return; }
    if (e.target.closest('[data-lens]')) { const col = +e.target.closest('[data-lens]').dataset.lens; lenses = lenses.filter(x => x !== col); render(); return; }
    if (e.target.getAttribute('data-addq') && opt.editable) { const y0 = e.clientY; let done = false; const mv = ev => { if (!done && ev.clientY - y0 > 18) { done = true; addQubit(); } }; const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (!done) addQubit(); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); return; }
    if (e.target.getAttribute('data-rmq') && opt.editable) { removeQubit(); return; }
    if (gEl && opt.editable) {
      const id = +gEl.dataset.id, o = C.ops.find(x => x.id === id); if (!o) return;
      if (e.shiftKey || e.metaKey || e.ctrlKey) { sel.has(id) ? sel.delete(id) : sel.add(id); render(); opt.onSelect && opt.onSelect([...sel]); return; }
      if (!sel.has(id)) { sel = new Set([id]); }
      const start = cellAt(e);
      Drag.start(e, Sim.displayName(o), {
        onMove: ev => hot(cellAt(ev)),
        onDrop: ev => { hot(null); const c = cellAt(ev);
          if (!c) { if (confirmRemoveOnDrop) removeSel(`${Sim.displayName(o)} lifted off the score`); return; }
          if (role === 'ctrl' || role === 'targ') { const k = +e.target.getAttribute('data-k'), arr = role === 'ctrl' ? o.c : o.q; if (Sim.wires(o).includes(c.q) && arr[k] !== c.q) { announce('That qubit is already part of the gate.'); render(); return; } arr[k] = c.q; if (o.g === 'M') o.cb = o.q[0]; IR.insert(C, o); emit(`${Sim.displayName(o)} rewired`); return; }
          const dc = c.col - start.col, dq = c.q - start.q; if (!dc && !dq) return; if (moveSel(dc, dq)) emit(`Moved to step ${Math.floor(o.col) + 1}`); else render(); }
      });
      render(); opt.onSelect && opt.onSelect([...sel]); return;
    }
    // empty area: lasso or click-to-place
    const c0 = cellAt(e); if (!c0) return; const r = el.getBoundingClientRect(), k = kz(r), x0 = (e.clientX - r.left) / k, y0 = (e.clientY - r.top) / k; let box = null, moved = false;
    const mv = ev => { const x1 = (ev.clientX - r.left) / k, y1 = (ev.clientY - r.top) / k; if (!moved && Math.hypot(x1 - x0, y1 - y0) > 6 && opt.editable) { moved = true; box = svg('rect', { class: 'lasso' }, el); } if (box) { box.setAttribute('x', Math.min(x0, x1)); box.setAttribute('y', Math.min(y0, y1)); box.setAttribute('width', Math.abs(x1 - x0)); box.setAttribute('height', Math.abs(y1 - y0)); } };
    const up = ev => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      if (moved) { const x1 = (ev.clientX - r.left) / k, y1 = (ev.clientY - r.top) / k, [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)], [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)];
        sel = new Set(C.ops.filter(o => { const x = X(Math.floor(o.col)); return x >= ax && x <= bx && Sim.wires(o).some(q => Y(q) >= ay && Y(q) <= by); }).map(o => o.id)); box && box.remove(); render(); opt.onSelect && opt.onSelect([...sel]); announce(`${sel.size} gate${sel.size === 1 ? '' : 's'} selected.`); return; }
      cur = c0; if (armed) { place(armed, c0.col, c0.q); return; } sel.clear(); render(); opt.onSelect && opt.onSelect([]); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  });
  let confirmRemoveOnDrop = true;
  el.addEventListener('pointerover', e => { const g = e.target.closest('[data-id]'); opt.onHover && opt.onHover(g ? +g.dataset.id : null); });
  el.addEventListener('pointerleave', () => opt.onHover && opt.onHover(null));
  el.addEventListener('dblclick', e => { const g = e.target.closest('[data-id]'); if (!g) return; const o = C.ops.find(x => x.id === +g.dataset.id); if (o && o.g === 'SUB') opt.onOpenSub && opt.onOpenSub(o); });
  el.addEventListener('keydown', e => {
    const k = e.key, K = k.toUpperCase(), mod = e.metaKey || e.ctrlKey;
    const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
    if (mv && e.altKey && sel.size && opt.editable) { e.preventDefault(); if (moveSel(mv[0], mv[1])) emit('Moved'); return; }
    if (mv) { e.preventDefault(); cur = { col: Math.max(0, Math.min(cols() - 1, cur.col + mv[0])), q: Math.max(0, Math.min(C.n - 1, cur.q + mv[1])) }; const o = opAt(cur.col, cur.q); if (!e.shiftKey) sel = new Set(o ? [o.id] : []); else if (o) sel.add(o.id); render(); opt.onSelect && opt.onSelect([...sel]); announce(o ? `${Sim.displayName(o)} on ${Sim.wires(o).map(q => 'q' + q).join(', ')}, step ${Math.floor(o.col) + 1}` : `Empty, q${cur.q}, step ${cur.col + 1}`); return; }
    if (!opt.editable) return;
    if (mod && K === 'C') { clip = C.ops.filter(o => sel.has(o.id)).map(o => JSON.parse(JSON.stringify(o))); announce(`${clip.length} copied.`); e.preventDefault(); return; }
    if (mod && K === 'X') { clip = C.ops.filter(o => sel.has(o.id)).map(o => JSON.parse(JSON.stringify(o))); removeSel('Cut'); e.preventDefault(); return; }
    if (mod && K === 'V' && clip.length) { e.preventDefault(); const c0 = Math.min(...clip.map(o => Math.floor(o.col))), q0 = Math.min(...clip.flatMap(o => Sim.wires(o))); const fresh = clip.map(o => Object.assign({}, o, { id: newId(), col: cur.col + Math.floor(o.col) - c0, q: o.q.map(q => q - q0 + cur.q), c: (o.c || []).map(q => q - q0 + cur.q) })); if (fresh.some(o => Sim.wires(o).some(q => q >= C.n))) { announce('Not enough qubits below the cursor to paste.'); return; } fresh.forEach(o => IR.insert(C, o)); sel = new Set(fresh.map(o => o.id)); emit(`${fresh.length} pasted`); return; }
    if (mod && K === 'G') { e.preventDefault(); opt.onGroup && opt.onGroup([...sel]); return; }
    if (mod) return;
    const map = { H: 'H', X: 'X', Y: 'Y', Z: 'Z', S: 'S', T: 'T', C: 'CX', M: 'M' };
    if (map[K] && k.length === 1 && !e.altKey) { e.preventDefault(); place(map[K], cur.col, cur.q); return; }
    if (k === 'Enter' && armed) { e.preventDefault(); place(armed, cur.col, cur.q); return; }
    if ((k === 'Delete' || k === 'Backspace') && sel.size) { e.preventDefault(); removeSel(); return; }
    if (K === 'F' && sel.size === 1) { const o = C.ops.find(x => sel.has(x.id)); if (o && (o.c || []).length === 1 && o.q.length === 1) { e.preventDefault(); [o.c[0], o.q[0]] = [o.q[0], o.c[0]]; emit(`${Sim.displayName(o)} flipped: control q${o.c[0]}`); } return; }
    if (k === '[' || k === ']') { e.preventDefault(); const cN = IR.cols(C), v = Math.max(0, Math.min(cN, (playhead === Infinity ? cN : playhead) + (k === ']' ? 1 : -1))); setPlayhead(v >= cN ? Infinity : v, true); return; }
    if (k === 'Escape') { sel.clear(); armed = null; render(); opt.onArm && opt.onArm(null); }
  });
  let clip = [];
  function addQubit() { if (C.n >= (opt.maxQubits || 12)) { announce(`The browser stage holds ${opt.maxQubits || 12} qubits. Larger Clifford circuits run on the stabiliser backend from code.`); return; } C.n++; C.nc = Math.max(C.nc ?? 0, C.n); emit(`q${C.n - 1} added`); }
  function removeQubit() { const q = C.n - 1; const had = C.ops.filter(o => Sim.wires(o).includes(q)); C.ops = C.ops.filter(o => !Sim.wires(o).includes(q)); C.n--; C.nc = C.n; emit(had.length ? `q${q} and ${had.length} gate${had.length > 1 ? 's' : ''} removed` : `q${q} removed`); }
  function setPlayhead(v, fire) { playhead = v; render(); if (fire) opt.onPlayhead && opt.onPlayhead(v); }
  render();
  return {
    el, wrap, render, place, get circ() { return C; }, set(c, fresh) { C = c; sel.clear(); pencils = []; if (fresh) { playhead = Infinity; lenses = []; } render(); },
    setPlayhead, get playhead() { return playhead; }, select(ids) { sel = new Set(ids); render(); }, get selection() { return [...sel]; },
    pencil(list) { pencils = list || []; render(); }, light(id) { lit = id; render(); }, arm(k) { armed = k; }, ghost(ops) { ghostOps = ops || []; render(); },
    cellAt, hot, addQubit, removeQubit, get cursor() { return cur; }, removeSel, emit, setLenses(l) { lenses = l; render(); }
  };
}
/* type case: gate marks you drag onto the score */
function TypeCase(host, { groups, score, allowed, onArm, getScore }) {
  let armed = null;
  function paint() {
    host.replaceChildren(...groups.map(gr => h('div', { class: 'case-group', role: 'group' }, ...gr.map(k => {
      const b = h('button', { type: 'button', class: `gmark chip-${paletteChip(k)} fam-${paletteFam(k)}`, 'aria-pressed': armed === k ? 'true' : 'false', title: paletteTitle(k), 'aria-label': `${paletteTitle(k)}. Drag onto the score, or press then click a cell.`, disabled: allowed && !allowed.includes(k) ? true : null }, LABEL[k] || k);
      b.addEventListener('pointerdown', e => { if (b.disabled) return; const S = getScore(); Drag.start(e, LABEL[k] || k, { onMove: ev => S.hot(S.cellAt(ev)), onDrop: ev => { S.hot(null); const c = S.cellAt(ev); if (c) S.place(k, c.col, c.q); }, onCancel: () => S.hot(null) }); });
      b.addEventListener('click', () => { if (Drag.just) return; armed = armed === k ? null : k; getScore().arm(armed); paint(); onArm && onArm(armed); announce(armed ? `${paletteTitle(k)} armed. Click a cell on the score, or press Enter there.` : 'Disarmed.'); });
      return b;
    }))));
  }
  paint(); return { paint, disarm() { armed = null; getScore().arm(null); paint(); } };
}
