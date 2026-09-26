/* =====================================================================
   STAGE VIEWS — layers of one Stage: Spheres · Field · Table · Histogram ·
   Q-sphere · Density · Unitary · Observables. All read the same state.
===================================================================== */
const VIEW_NAMES = [['spheres', 'Spheres'], ['field', 'Field'], ['table', 'Table'], ['histogram', 'Histogram'], ['qsphere', 'Q-sphere'], ['density', 'Density'], ['unitary', 'Unitary'], ['observables', 'Observables']];
function StageViews(host, { get, initial = ['spheres', 'field', 'histogram'], onPick, noise } = {}) {
  let on = new Set(initial), obsText = 'Z0 Z1', tableThresh = 1e-6, tableSort = 'index', densPart = 're', spheres = [], lastN = -1;
  const words = Ctl.words(VIEW_NAMES.map(([v, l]) => ({ value: v, label: l })), [...on], v => { on = new Set(v); render(); onPick && onPick([...on]); }, { multi: true, label: 'Stage layers' });
  const body = h('div', { class: 'views' });
  host.replaceChildren(h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'baseline' } }, words), body);
  const blocks = {};
  const block = (k, title) => { if (!blocks[k]) blocks[k] = h('section', { class: 'vblock', 'aria-label': title }, h('h3', { class: 'vtitle' }, title), h('div', { class: 'vbody' })); return blocks[k]; };
  function render() {
    const { circ: C, upto } = get(); if (!C) return;
    const s = C.n <= 12 ? Sim.run(C, upto) : null; body.replaceChildren();
    for (const [k, title] of VIEW_NAMES) { if (!on.has(k)) continue; const b = block(k, title), vb = b.lastChild; body.append(b); try { draw(k, vb, C, s, upto); } catch (e) { vb.replaceChildren(h('p', { class: 'small' }, e.message)); } }
  }
  function draw(k, vb, C, s, upto) {
    const n = C.n;
    if (!s && k !== 'histogram') { vb.replaceChildren(h('p', { class: 'small' }, `${n} qubits is beyond the browser statevector (12). Run on the Stabiliser backend for Clifford circuits.`)); return; }
    const branch = s && s.branch && s.branch.length ? h('p', { class: 'lbl', style: { marginBottom: '6px' } }, `One branch of a mid-circuit measurement: ${s.branch.map(b => `q${b.q}→${b.v}`).join(', ')}`) : null;
    if (k === 'spheres') {
      const R = n > 6 ? 34 : 42, gap = R * 2 + 44, W = Math.max(n * gap, 240), H = R * 2 + 56;
      let sv = vb.querySelector('svg.sph-row');
      if (!sv || lastN !== n) { vb.replaceChildren(); sv = svg('svg', { class: 'sph-row', role: 'img', 'aria-label': 'Bloch sphere for each qubit; arrow length is purity' }); vb.append(h('div', { class: 'scroll-x' }, sv)); sv.setAttribute('viewBox', `0 0 ${W} ${H}`); sv.setAttribute('width', W); sv.setAttribute('height', H); sv.threads = svg('g', {}, sv);
        spheres = Array.from({ length: n }, (_, i) => { const sp = Ink.sphere(sv, { cx: gap / 2 + i * gap, cy: R + 14, R, labels: false, tipR: 3.6 }); const t = svg('text', { class: 'q-slab', x: gap / 2 + i * gap, y: 2 * R + 44 }, sv); t.textContent = 'q' + i; return sp; }); lastN = n; }
      if (branch && !vb.querySelector('p.lbl')) vb.prepend(branch);
      const nzS = noise ? noise() : null; let dm = null; if (nzS && n <= 6) { try { dm = Sim.densityRun(C, nzS, upto); } catch (e) { dm = null; } }
      const blochDM = q => { const N = 1 << n, m = 1 << (n - 1 - q); let z = 0, re = 0, im = 0; for (let i = 0; i < N; i++) { const [d] = dm.get(i, i); z += (i & m) ? -d : d; if (!(i & m)) { const [a, b] = dm.get(i, i | m); re += a; im += b; } } return [2 * re, -2 * im, z]; };
      spheres.forEach((sp, i) => sp.to(dm ? blochDM(i) : Sim.bloch(s, i), .3));
      let nzNote = vb.querySelector('.nz-note'); if (dm) { if (!nzNote) { nzNote = h('p', { class: 'lbl nz-note' }); vb.append(nzNote); } nzNote.textContent = 'With your noise model: arrows shorten as the qubits lose coherence (density-matrix simulation).'; } else if (nzNote) nzNote.remove();
      sv.threads.replaceChildren();
      if (n <= 8) for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) { const t = Sim.tie(s, a, b); if (t < .05) continue; const x1 = gap / 2 + a * gap + R, x2 = gap / 2 + b * gap - R, y = R + 14, sag = (1 - t) * 18 + (b - a - 1) * 20, mid = (x1 + x2) / 2; const d = b - a === 1 ? `M${x1} ${y}Q${mid} ${y + sag} ${x2} ${y}` : `M${x1 - 14} ${y + R * .7}Q${mid} ${y + R + 18 + sag} ${x2 + 14} ${y + R * .7}`; const p = svg('path', { class: 'q-thread', d, 'stroke-width': (.6 + 1.3 * t).toFixed(2), opacity: (.3 + .7 * t).toFixed(2) }, sv.threads); const tt = svg('title', {}, p); tt.textContent = `q${a}–q${b} tied ${t.toFixed(2)}`; }
      const S1 = n > 1 ? Array.from({ length: n }, (_, q) => { const L = Math.hypot(...Sim.bloch(s, q)); const pp = (1 + L) / 2; return pp >= 1 - 1e-12 ? 0 : -(pp * Math.log2(pp) + (1 - pp) * Math.log2(1 - pp)); }) : null;
      let cap = vb.querySelector('.sph-cap'); if (!cap) { cap = h('p', { class: 'metrics sph-cap' }); vb.append(cap); }
      cap.replaceChildren(...(S1 ? S1.map((e, q) => h('span', {}, 'S(q', q, ') ', h('b', {}, e.toFixed(3)))) : []), n > 1 && n <= 10 ? h('span', {}, 'S(first half | rest) ', h('b', {}, Sim.entropy(s, [...Array(Math.floor(n / 2)).keys()]).toFixed(3)), ' bits') : '');
      return;
    }
    vb.replaceChildren(); if (branch) vb.append(branch);
    if (k === 'field') { const sv = svg('svg', { role: 'img', 'aria-label': 'Field: one disk per basis state; area is probability, needle is phase' }); const box = h('div', { class: 'scroll-x' }, sv); vb.append(box); const num = h('p', { class: 'nums', style: { minHeight: '20px' } }); vb.append(num); const r = Ink.field(sv, s, { n, per: Math.max(2, Math.min(16, Math.floor((host.clientWidth || 640) / 64))), cell: 62, R: 23, max: 64, onHover: i => { const p = s.re[i] ** 2 + s.im[i] ** 2; num.textContent = `${Sim.ket(i, n)}  amplitude ${fmt.cplx(s.re[i], s.im[i], 4)}  ·  P ${p.toFixed(4)}  ·  phase ${fmt.ang(Sim.phase(s, i))}`; } }); if (r.shown < r.total) vb.append(h('p', { class: 'lbl' }, `Showing the ${r.shown} largest of ${r.total} amplitudes.`)); return; }
    if (k === 'table') {
      const rows = []; for (let i = 0; i < s.re.length; i++) { const p = s.re[i] ** 2 + s.im[i] ** 2; if (p >= tableThresh) rows.push([i, s.re[i], s.im[i], p, Sim.phase(s, i)]); }
      if (tableSort === 'prob') rows.sort((a, b) => b[3] - a[3]);
      const ctl = h('div', { class: 'row' }, Ctl.words([{ value: 'index', label: 'By basis' }, { value: 'prob', label: 'By probability' }], tableSort, v => { tableSort = v; render(); }, { label: 'Sort' }), Ctl.menu({ label: 'Hide amplitudes below', options: [{ value: 1e-6, label: 'Hide |a|² < 10⁻⁶' }, { value: .001, label: 'Hide |a|² < 0.001' }, { value: .01, label: 'Hide |a|² < 0.01' }, { value: 0, label: 'Show every basis state' }], value: tableThresh, onChange: v => { tableThresh = v; render(); } }),
        h('button', { type: 'button', class: 'btn', onclick: () => copyText(Code.statevectorText(s, n, 'numpy'), 'NumPy statevector copied.') }, 'Copy as NumPy'), h('button', { type: 'button', class: 'btn', onclick: () => copyText(Code.statevectorText(s, n, 'latex'), 'LaTeX copied.') }, 'Copy as LaTeX'));
      const tbl = h('table', { class: 'tbl' }, h('caption', { class: 'sr' }, 'Statevector'), h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Basis'), h('th', { scope: 'col', class: 'num' }, 'Amplitude a + bi'), h('th', { scope: 'col', class: 'num' }, '|a|²'), h('th', { scope: 'col', class: 'num' }, 'Phase'))), h('tbody', {}, rows.slice(0, 512).map(([i, re, im, p, ph]) => h('tr', { class: p < 1e-9 ? 'dim' : '' }, h('td', { class: 'mono' }, Sim.ket(i, n)), h('td', { class: 'num' }, fmt.cplx(re, im, 4)), h('td', { class: 'num' }, p.toFixed(4)), h('td', { class: 'num' }, fmt.ang(ph))))));
      vb.append(ctl, h('div', { class: 'scroll-x', style: { maxHeight: '340px', overflowY: 'auto' } }, tbl)); if (rows.length > 512) vb.append(h('p', { class: 'lbl' }, `${rows.length - 512} more rows hidden; copy as NumPy for all of them.`)); return;
    }
    if (k === 'histogram') { const p = s ? Sim.probs(s) : null; if (!p) { vb.append(h('p', { class: 'small' }, 'Run on the Stabiliser backend to see outcomes.')); return; } const keys = Array.from({ length: p.length }, (_, i) => i.toString(2).padStart(n, '0')), ideal = {}; keys.forEach((kk, i) => ideal[kk] = p[i]); const sv = svg('svg', { role: 'img', 'aria-label': 'Ideal probability of each outcome' }); vb.append(h('div', { class: 'scroll-x' }, sv)); Ink.histogram(sv, { keys, ideal, series: [{ fill: true, counts: Object.fromEntries(keys.map((kk, i) => [kk, p[i] * 1e6])), shots: 1e6 }], width: Math.min(900, Math.max(320, (host.clientWidth || 600) - 10)), height: 180 }); vb.append(h('p', { class: 'lbl' }, 'Ideal probabilities at the playhead. Runs pour real shots below.')); return; }
    if (k === 'qsphere') { if (n > 5) { vb.append(h('p', { class: 'small' }, 'The Q-sphere reads well up to 5 qubits.')); return; } const sv = svg('svg', { role: 'img', 'aria-label': 'Q-sphere: basis states placed by number of ones; dot size is amplitude, colour is phase' }); vb.append(sv); Ink.qsphere(sv, s, n, 300); return; }
    if (k === 'density') {
      if (n > 6) { vb.append(h('p', { class: 'small' }, 'The density matrix is drawn up to 6 qubits (4,096 cells).')); return; }
      const nz = noise ? noise() : null, N = 1 << n; const mk = d => { const M = []; for (let i = 0; i < N; i++) { const r = []; for (let j = 0; j < N; j++) { const [re, im] = d.get(i, j); r.push(densPart === 're' ? re : im); } M.push(r); } return M; };
      const ctl = h('div', { class: 'row' }, Ctl.words([{ value: 're', label: 'Real part' }, { value: 'im', label: 'Imaginary part' }], densPart, v => { densPart = v; render(); }, { label: 'Density matrix part' }), h('span', { class: 'lbl' }, nz ? 'with your noise model' : 'pure state (switch noise on in the run bar)'));
      const sv = svg('svg', { role: 'img', 'aria-label': 'Density matrix heat map' }); vb.append(ctl, sv);
      const d = nz && n <= 7 ? Sim.densityRun(C, nz, upto) : Sim.densityPure(s);
      Ink.heat(sv, mk(d), { size: Math.min(320, 40 * N), signed: true, cellText: (i, j, v) => `ρ[${i.toString(2).padStart(n, '0')},${j.toString(2).padStart(n, '0')}] = ${v.toFixed(4)}` });
      let pur = 0; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const [re, im] = d.get(i, j); pur += re * re + im * im; }
      const red = Array.from({ length: n }, (_, q) => { const r = nz ? null : Sim.reduced(s, [q]); return r ? `q${q}: [[${r.rho[0].toFixed(2)}, ${fmt.cplx(r.rho[2], r.rho[3], 2)}], [·, ${r.rho[6].toFixed(2)}]]` : null; }).filter(Boolean);
      vb.append(h('p', { class: 'metrics' }, h('span', {}, 'Tr ρ² ', h('b', {}, pur.toFixed(4))), h('span', {}, pur > .9999 ? 'pure' : 'mixed')), red.length ? h('p', { class: 'metrics' }, 'Reduced: ', ...red.map(t => h('span', {}, t))) : ''); return;
    }
    if (k === 'unitary') {
      if (n > 6) { vb.append(h('p', { class: 'small' }, 'The unitary is drawn up to 6 qubits.')); return; }
      if (C.ops.some(o => Sim.G[o.g] && Sim.G[o.g].nonunitary && o.g !== 'BARRIER' && o.g !== 'M')) { vb.append(h('p', { class: 'small' }, 'Reset and mid-circuit measurement aren’t unitary; the view shows the unitary part only.')); }
      const U = Sim.unitary({ n, ops: C.ops.filter(o => o.col < (upto ?? Infinity)), params: C.params }), N = 1 << n, M = [];
      for (let i = 0; i < N; i++) { const r = []; for (let j = 0; j < N; j++) { const re = U[j].re[i], im = U[j].im[i]; r.push({ mag: Math.hypot(re, im), ph: Math.atan2(im, re) }); } M.push(r); }
      const sv = svg('svg', { role: 'img', 'aria-label': 'Circuit unitary: brightness is magnitude, colour is phase' }); vb.append(sv); Ink.heat(sv, M, { size: Math.min(320, 40 * N), cellText: (i, j, v) => `U[${i.toString(2).padStart(n, '0')},${j.toString(2).padStart(n, '0')}] = ${v.mag.toFixed(3)} ∠ ${fmt.ang(v.ph)}` });
      vb.append(h('p', { class: 'lbl' }, 'Columns are inputs, rows are outputs. Colour is phase, as on the field.')); return;
    }
    if (k === 'observables') {
      const out = h('div', { class: 'nums', 'aria-live': 'polite' }), err = h('p', { class: 'err' });
      const calc = t => { obsText = t; try { const terms = Sim.parseObservable(t, n); const v = Sim.expectation(s, terms); out.textContent = `⟨ ${t} ⟩ = ${v.toFixed(6)}`; err.textContent = ''; } catch (e) { err.textContent = e.message; out.textContent = ''; } };
      const inp = Ctl.field({ label: 'Observable', value: obsText, placeholder: 'Z0 Z1 + 0.5 X0', mono: true, onInput: calc }); inp.style.width = '100%';
      vb.append(h('label', { class: 'lbl', for: 'obs-in' }, 'Pauli sum, e.g. Z0 Z1 + 0.5 X0 − 1.2 Y2'), inp, out, err); inp.id = 'obs-in'; calc(obsText); return;
    }
  }
  render();
  return { render, words, get on() { return [...on]; }, set(v) { on = new Set(v); words.set(v); render(); }, get obs() { return obsText; } };
}
async function copyText(text, msg) { try { await navigator.clipboard.writeText(text); toast(msg || 'Copied.'); } catch (e) { const ta = h('textarea', { style: { position: 'fixed', left: '-9999px' } }, text); document.body.append(ta); ta.select(); try { document.execCommand('copy'); toast(msg || 'Copied.'); } catch (e2) { toast('Select the text and press Ctrl+C or ⌘C.'); } ta.remove(); } }
async function saveFile(filename, data, mime = 'text/plain') {
  const dl = await Cap.use('downloads');
  if (dl) { try { await dl.save({ filename, data: data instanceof Blob ? data : new Blob([data], { type: mime }) }); toast(`${filename} saved.`); return; } catch (e) { if (e.code === 'declined') { toast('Download cancelled.'); return; } } }
  if (typeof data === 'string') copyText(data, `Downloads aren’t available here, so ${filename} was copied to your clipboard.`); else toast('Downloads aren’t available in this view.');
}
