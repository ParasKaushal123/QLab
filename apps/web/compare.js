/* =====================================================================
   COMPARE — multi-backend compare card. Pick several runner backends,
   stream results over Runner.batch() SSE, overlay them on one histogram
   (Ink.histogram), show the TVD/Hellinger matrix from Runner.compare(),
   a plain-language verdict, and CSV export.
   API: Compare.mount(el, getCircuit).
===================================================================== */
const Compare = (() => {
  const COLORS = ['var(--magenta)', 'var(--cyan)', 'var(--limepop)', '#F5A524', 'var(--t-rose-i)', 'var(--muted)'];
  const DASHES = ['4 3', '1.5 2.5', '7 3', '3 2 1 2', '2 2', '6 2'];
  const LEGACY = new Set(['aer', 'aer_noisy', 'cirq', 'pennylane', 'qbraid', 'ibm']);
  const DEFAULTS = ['aer.statevector', 'cirq.simulator', 'pennylane.default.qubit', 'pennylane.lightning.qubit'];
  const TVD_AGREE = 0.05, P_DISAGREE = 0.001;

  const availBackends = () => Backends.LIST.filter(b => b.kind === 'server' && !LEGACY.has(b.id));
  const bname = id => { const b = Backends.LIST.find(x => x.id === id); return b ? b.name : id; };

  function toIR(C) {
    const ops = Sim.expand({ n: C.n, ops: C.ops || [] }).map(o => {
      const r = { g: o.g, q: o.q.slice(), col: o.col | 0 };
      if ((o.c || []).length) r.c = o.c.slice();
      if ((o.p || []).length) r.p = o.p.map(v => typeof v === 'number' ? v : String(v));
      if (o.g === 'M') r.cb = o.cb ?? o.q[0];
      if (o.cond) r.cond = o.cond;
      return r;
    });
    return { version: 'qlab-ir/1', n: C.n, nc: C.nc ?? C.n, params: C.params || {}, ops };
  }
  function exactOf(C) {
    try {
      if (!C || C.n > 12 || Sim.isDynamic(C)) return null;
      const p = Sim.probs(Sim.run(C)), out = {};
      for (let i = 0; i < p.length; i++) if (p[i] > 1e-12) out[i.toString(2).padStart(C.n, '0')] = p[i];
      return out;
    } catch (e) { return null; }
  }
  function verdictOf(cmp, labels) {
    if (!cmp || !cmp.pairs || !cmp.pairs.length) return labels.length < 2 ? 'Pick at least two backends and press Compare.' : 'No comparison yet — press Compare.';
    let worst = cmp.pairs[0];
    cmp.pairs.forEach(p => { if (p.tvd > worst.tvd) worst = p; });
    const ps = Object.entries(cmp.chi2 || {}).filter(([, v]) => v && v.p != null);
    const minP = ps.length ? ps.reduce((a, b) => (a[1].p < b[1].p ? a : b)) : null;
    const smallP = ps.filter(([, v]) => v.p < P_DISAGREE);
    if (worst.tvd <= TVD_AGREE && !smallP.length) {
      const pTxt = minP ? ` Smallest χ² p-value is ${minP[1].p.toFixed(3)} (${bname(minP[0])}), well above ${(P_DISAGREE)}.` : '';
      return `Agree: ${labels.map(bname).join(', ')} give the same distribution within shot noise (largest TVD ${worst.tvd.toFixed(3)} between ${bname(worst.a)} and ${bname(worst.b)}).${pTxt}`;
    }
    const bits = [`largest TVD ${worst.tvd.toFixed(3)} (${bname(worst.a)} vs ${bname(worst.b)}, fidelity ${worst.hellinger.toFixed(3)})`];
    if (smallP.length) bits.push(smallP.map(([k, v]) => `${bname(k)} χ² p = ${v.p.toExponential(1)}`).join('; '));
    return `Disagree: ${bits.join('. ')}. A p-value below ${P_DISAGREE} means the gap is real, not shot noise.`;
  }
  function toCSV(labels, byLabel, cmp, shots) {
    const L = ['backend,outcome,counts,probability'];
    labels.forEach(l => {
      const r = byLabel[l]; if (!r || !r.counts) return;
      Object.keys(r.counts).sort().forEach(k => L.push([l, k, r.counts[k], (r.counts[k] / shots).toFixed(6)].join(',')));
    });
    L.push('', 'backend_a,backend_b,tvd,hellinger_fidelity');
    (cmp.pairs || []).forEach(p => L.push([p.a, p.b, p.tvd.toFixed(6), p.hellinger.toFixed(6)].join(',')));
    L.push('', 'backend,chi2,dof,p,note');
    Object.entries(cmp.chi2 || {}).forEach(([k, v]) => L.push([k, v.chi2 ?? '', v.dof ?? '', v.p ?? '', v.note ? `"${String(v.note).replace(/"/g, '""')}"` : ''].join(',')));
    return L.join('\n');
  }

  function mount(el, getCircuit) {
    const avail = availBackends();
    let selected = DEFAULTS.filter(id => avail.some(b => b.id === id));
    if (!selected.length) selected = avail.slice(0, 3).map(b => b.id);
    let shots = 1024, running = false;
    let order = [], byLabel = {}, errors = {}, cmp = null, exact = null;

    el.replaceChildren();
    const backWords = Ctl.words(avail.map(b => ({ value: b.id, label: b.name, title: b.note })), selected, v => { selected = v; }, { multi: true, label: 'Backends' });
    const shotsMenu = Ctl.menu({ label: 'Shots', options: [100, 1000, 4000, 10000].map(v => ({ value: v, label: `${fmt.n(v)} shots` })), value: shots, onChange: v => { shots = v; } });
    const seedInp = h('input', { class: 'uline mono', style: { width: '90px' }, placeholder: 'random', inputmode: 'numeric', 'aria-label': 'Seed' });
    const runBtn = h('button', { type: 'button', class: 'primary' }, 'Compare');
    const csvBtn = h('button', { type: 'button', class: 'btn', disabled: true }, 'Export CSV');
    const status = h('p', { class: 'small', 'aria-live': 'polite' }, 'Pick backends, then press Compare.');
    const histSvg = svg('svg', { role: 'img', 'aria-label': 'Overlaid measurement histogram' });
    const legend = h('div', { class: 'legend', 'aria-live': 'polite' });
    const verdictEl = h('p', { class: 'prose', 'aria-live': 'polite' });
    const matrixHost = h('div', { class: 'scroll-x' });
    el.replaceChildren(
      h('div', { class: 'row' }, backWords),
      h('div', { class: 'row', style: { marginTop: '8px' } }, shotsMenu, h('label', { class: 'lbl', for: 'cmp-seed' }, 'Seed'), seedInp, runBtn, csvBtn),
      status,
      h('div', { class: 'scroll-x' }, histSvg), legend, verdictEl, matrixHost);
    seedInp.id = 'cmp-seed';

    function drawHist() {
      const W = Math.max(280, Math.min(980, (el.clientWidth || 640) - 8));
      const keys = [...new Set(order.flatMap(l => Object.keys(byLabel[l].counts || {})))].sort();
      if (!order.length || !keys.length) { histSvg.replaceChildren(); return; }
      const series = order.map((l, i) => Object.assign({}, byLabel[l], {
        fill: i === 0, color: COLORS[(i - 1 + COLORS.length) % COLORS.length], dash: DASHES[i % DASHES.length],
      }));
      Ink.histogram(histSvg, { keys, ideal: exact, series, width: W, height: 190 });
      legend.replaceChildren(...order.map((l, i) => h('span', {},
        h('i', { class: 'sw', style: i === 0 ? { background: 'var(--t-blue-i)' } : { border: `1.3px dashed ${series[i].color}` } }),
        `${bname(l)} · ${fmt.n(shots)} shots`)),
        ...Object.entries(errors).map(([l, m]) => h('span', { class: 'err' }, `${bname(l)}: ${m}`)),
        exact ? h('span', { class: 'lbl' }, '· dotted ticks: exact odds') : '');
    }
    function drawMatrix() {
      matrixHost.replaceChildren();
      if (!cmp || !order.length) return;
      const pairOf = (a, b) => (cmp.pairs || []).find(p => (p.a === a && p.b === b) || (p.a === b && p.b === a));
      const cellTxt = (a, b) => {
        if (a === b) return '—';
        const p = pairOf(a, b);
        return p ? `TVD ${p.tvd.toFixed(3)} · F ${p.hellinger.toFixed(3)}` : '–';
      };
      const tbl = h('table', { class: 'tbl' },
        h('tr', {}, h('th', {}, ''), ...order.map(l => h('th', {}, bname(l)))),
        ...order.map(a => h('tr', {}, h('td', {}, h('b', {}, bname(a))),
          ...order.map(b => h('td', { class: 'mono' }, cellTxt(a, b))))));
      matrixHost.append(tbl,
        h('div', {}, ...order.map(l => {
          const v = (cmp.chi2 || {})[l];
          return h('p', { class: 'small' }, v && v.p != null ? `${bname(l)}: χ² ${v.chi2 == null ? '–' : (+v.chi2).toFixed(2)} (dof ${v.dof}), p = ${v.p.toExponential(2)}${v.note ? ' · ' + v.note : ''}` : `${bname(l)}: no exact reference, χ² skipped`);
        })));
      verdictEl.textContent = verdictOf(cmp, order);
    }
    async function run() {
      if (running) return;
      const C = getCircuit && getCircuit();
      if (!C) { status.textContent = 'Open or build a circuit first.'; return; }
      if (!selected.length) { status.textContent = 'Pick at least one backend.'; return; }
      const sd = seedInp.value.trim();
      const seed = sd === '' ? undefined : +sd;
      if (seed !== undefined && !Number.isFinite(seed)) { status.textContent = 'The seed must be a number, or left blank for random.'; return; }
      running = true; runBtn.disabled = true; csvBtn.disabled = true;
      order = []; byLabel = {}; errors = {}; cmp = null; exact = exactOf(C);
      status.textContent = `Running on ${selected.length} backend${selected.length > 1 ? 's' : ''}…`;
      verdictEl.textContent = ''; drawHist(); drawMatrix();
      let ir;
      try { ir = toIR(C); } catch (e) { status.textContent = e.message; running = false; runBtn.disabled = false; return; }
      const runs = selected.map(backend => ({ ir, backend, shots, seed }));
      try {
        await Runner.batch({ runs, exact: exact || undefined }, ev => {
          if (ev.type === 'result') {
            const d = ev.data, label = runs[d.index] ? runs[d.index].backend : `run-${d.index}`;
            if (d.ok) {
              if (!order.includes(label)) order.push(label);
              byLabel[label] = { counts: d.counts || {}, shots, anim: 1 };
            } else errors[label] = d.error || 'failed';
            status.textContent = `${order.length + Object.keys(errors).length} of ${runs.length} finished…`;
            drawHist();
          } else if (ev.type === 'compare' && ev.data) cmp = ev.data;
        });
        if (!cmp) {
          const forCmp = {};
          order.forEach(l => { forCmp[l] = { counts: byLabel[l].counts }; });
          cmp = await Runner.compare(forCmp, exact || undefined);
        }
        const bad = Object.keys(errors);
        status.textContent = bad.length ? `${order.length} backend${order.length === 1 ? '' : 's'} answered; ${bad.length} failed.` : `${order.length} backend${order.length === 1 ? '' : 's'} · ${fmt.n(shots)} shots each.`;
        drawHist(); drawMatrix(); csvBtn.disabled = !order.length;
        announce(verdictOf(cmp, order));
      } catch (e) {
        status.textContent = `Offline — start the runner at ${Runner.url()} (${e.message || e}).`;
      }
      running = false; runBtn.disabled = false;
    }
    runBtn.addEventListener('click', run);
    csvBtn.addEventListener('click', () => {
      if (!order.length) return;
      saveFile('compare.csv', toCSV(order, byLabel, cmp || { pairs: [], chi2: {} }, shots), 'text/csv');
    });
    drawHist();
    return { run, destroy() { runBtn.removeEventListener('click', run); } };
  }
  return { mount };
})();
