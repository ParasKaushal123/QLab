/* =====================================================================
   VALIDATION — route #validation. Fetches GET /v1/validation (the nightly
   cross-SDK report) with a local fallback message, renders the circuit ×
   backend grid (green pass / grey skip / red fail), and drills down into
   any cell: the metric, the circuit on a read-only Score, under a
   versions+date header.
===================================================================== */
const Validation = (() => {
  const COL = { pass: '#DFF0C2', skip: '#E6E6E1', fail: '#F3C1C1' };
  function statusOf(c) {
    if (c.pass === true || c.ok === true) return 'pass';
    if (c.pass === false || c.ok === false) return 'fail';
    const s = String(c.status || c.state || '').toLowerCase().trim();
    if (['pass', 'passed', 'ok', 'success', 'green'].includes(s)) return 'pass';
    if (['skip', 'skipped', 'na', 'n/a', 'grey', 'gray', 'missing', 'unsupported'].includes(s)) return 'skip';
    if (['fail', 'failed', 'error', 'red'].includes(s)) return 'fail';
    return s === '' ? 'skip' : 'fail';
  }
  function nameOf(v, fb) { return typeof v === 'string' ? v : (v && (v.name || v.id)) || fb; }
  /* Accept the shapes report.py might write: {checks|cells|results:[…]},
     {matrix:{circuit:{backend:cell}}}, circuits as names / objects / map. */
  function normalize(data) {
    data = data || {};
    let list = [];
    if (Array.isArray(data.checks)) list = data.checks;
    else if (Array.isArray(data.cells)) list = data.cells;
    else if (Array.isArray(data.results)) list = data.results;
    else if (data.matrix && typeof data.matrix === 'object') {
      Object.entries(data.matrix).forEach(([cn, row]) => Object.entries(row || {}).forEach(([b, cell]) =>
        list.push(Object.assign({ circuit: cn, backend: b }, typeof cell === 'object' ? cell : { status: cell }))));
    }
    const circuits = [], circuitIR = {}, backends = [];
    const backendOf = c => typeof c.backend === 'string' ? c.backend : nameOf(c.backend, 'backend');
    const circuitName = c => typeof c.circuit === 'string' ? c.circuit : nameOf(c.circuit, c.name || c.id || 'circuit');
    if (Array.isArray(data.circuits)) data.circuits.forEach(c => {
      if (typeof c === 'string') circuits.push(c);
      else if (c && (c.name || c.id)) { circuits.push(c.name || c.id); circuitIR[c.name || c.id] = c.ir || c.circuit || c; }
    });
    else if (data.circuits && typeof data.circuits === 'object') Object.entries(data.circuits).forEach(([k, v]) => {
      circuits.push(k); circuitIR[k] = (v && (v.ir || v.circuit)) || v;
    });
    if (Array.isArray(data.backends)) data.backends.forEach(b => backends.push(nameOf(b, 'backend')));
    const cells = new Map();
    list.forEach(c => {
      const cn = circuitName(c), b = backendOf(c);
      if (!circuits.includes(cn)) circuits.push(cn);
      if (!backends.includes(b)) backends.push(b);
      const ir = c.ir || c.circuitIR || (typeof c.circuit === 'object' ? c.circuit : null);
      if (ir && !circuitIR[cn]) circuitIR[cn] = ir;
      cells.set(cn + '‖' + b, Object.assign({}, c, { circuit: cn, backend: b }));
    });
    return {
      circuits, backends, cells, circuitIR,
      versions: data.versions || data.sdk_versions || data.sdkVersions || null,
      date: data.date || data.run_at || data.runAt || data.created || null,
      sha: data.sha || data.git_sha || data.git || data.revision || null,
    };
  }
  function metricLines(c) {
    const L = [`Status: ${statusOf(c)}`];
    const f = c.fidelity ?? c.f ?? c.hellinger;
    if (f != null) L.push(`Fidelity ${(+f).toFixed(9)}`);
    if (c.tvd != null) L.push(`TVD ${(+c.tvd).toFixed(4)}`);
    const p = c.p ?? c.pvalue ?? c.p_value;
    if (p != null) L.push(`χ² p = ${(+p).toExponential(2)}${c.chi2 != null ? ` (χ² ${(+c.chi2).toFixed(2)}, dof ${c.dof ?? '–'})` : ''}`);
    if (c.metric != null && typeof c.metric !== 'object') L.push(`Metric ${c.metric}`);
    if (c.ms != null) L.push(`${Math.round(c.ms)} ms`);
    if (c.reason || c.note) L.push(String(c.reason || c.note));
    return L;
  }
  function toScoreCirc(irLike, name) {
    try {
      const n = irLike.n || irLike.qubits || 2;
      const ops = (irLike.ops || []).map(o => IR.op(o.g || 'H', (o.q || [0]).slice(),
        { c: (o.c || []).slice(), p: (o.p || []).slice(), col: o.col || 0, cb: o.cb, cond: o.cond }));
      return { n, nc: irLike.nc ?? n, name: name || irLike.name || 'circuit', params: irLike.params || {}, defs: {}, ops };
    } catch (e) { return null; }
  }
  async function fetchReport() {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 10000);
    try {
      const r = await fetch(Runner.url() + '/v1/validation', { signal: ctl.signal });
      if (!r.ok) { const t = await r.text().catch(() => ''); throw Object.assign(new Error(t || ('HTTP ' + r.status)), { status: r.status }); }
      return await r.json();
    } finally { clearTimeout(tm); }
  }
  function headerText(rep) {
    const bits = [];
    if (rep.date) bits.push('run ' + fmt.date(new Date(rep.date).toISOString()));
    if (rep.sha) bits.push('git ' + String(rep.sha).slice(0, 12));
    if (rep.versions) bits.push(Object.entries(rep.versions).map(([k, v]) => `${k} ${v}`).join(' · '));
    return bits.join(' — ');
  }
  function render(el) {
    App.top(['Validation']);
    el.replaceChildren(h('div', { class: 'page' },
      h('header', { class: 'page-head' }, h('h1', { class: 'display' }, 'Validation'), h('p', { class: 'prose' }, 'Loading the nightly cross-SDK report…'))));
    const page = el.firstChild;
    fetchReport().then(
      data => paint(page, normalize(data)),
      e => fallback(page, e));
  }
  function fallback(page, e) {
    const notFound = e && (e.status === 404 || /404|No validation\.json/i.test(e.message || ''));
    page.replaceChildren(
      h('header', { class: 'page-head' }, h('h1', { class: 'display' }, 'Validation'), h('p', { class: 'prose' }, 'Every SDK must agree on every circuit before we trust it.')),
      h('div', { class: 'card' },
        h('p', { class: 'prose' }, notFound
          ? 'No validation.json on the runner yet. Generate it with POST /v1/validation/run, or run tests/crossval/report.py next to the runner.'
          : `Offline — start the runner at ${Runner.url()} (${(e && e.message) || e}).`),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn', onclick: () => render(page.parentElement) }, 'Retry'),
          h('button', { type: 'button', class: 'btn', onclick: rerun }, 'Run validation now'))));
  }
  async function rerun() {
    try { await fetch(Runner.url() + '/v1/validation/run', { method: 'POST' }); toast('Validation re-run started; come back in a few minutes.'); }
    catch (e) { toast(`Offline — start the runner at ${Runner.url()}.`); }
  }
  function paint(page, rep) {
    const counts = { pass: 0, skip: 0, fail: 0 };
    rep.cells.forEach(c => { counts[statusOf(c)]++; });
    const total = rep.cells.size;
    const drill = h('div', { class: 'card', hidden: true });
    const grid = h('div', {
      role: 'grid', 'aria-label': 'Cross-SDK validation matrix',
      style: { display: 'grid', gridTemplateColumns: `minmax(120px,1.4fr) repeat(${Math.max(1, rep.backends.length)}, minmax(40px,1fr))`, gap: '4px', alignItems: 'stretch' },
    });
    grid.append(h('span', { class: 'lbl' }, ''));
    rep.backends.forEach(b => grid.append(h('span', { class: 'lbl', style: { overflow: 'hidden', textOverflow: 'ellipsis' }, title: b }, b)));
    rep.circuits.forEach(cn => {
      grid.append(h('span', { class: 'mono small', style: { alignSelf: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }, title: cn }, cn));
      rep.backends.forEach(b => {
        const c = rep.cells.get(cn + '‖' + b), st = c ? statusOf(c) : 'skip';
        const label = c ? `${cn} on ${b}: ${st}. ${metricLines(c).join('. ')}` : `${cn} on ${b}: not run`;
        const cell = h('button', {
          type: 'button', role: 'gridcell', 'aria-label': label, title: label,
          class: 'vcell ' + st,
          style: { background: COL[st], border: '1px solid var(--hair2)', borderRadius: '8px', minHeight: '30px', cursor: 'pointer' },
          onclick: () => openDrill(drill, rep, c || { circuit: cn, backend: b, status: 'skip', reason: 'Not in this report.' }),
        }, st === 'pass' ? '✓' : st === 'fail' ? '✕' : '–');
        grid.append(cell);
      });
    });
    page.replaceChildren(
      h('header', { class: 'page-head' },
        h('h1', { class: 'display' }, total ? `${counts.pass} of ${total} checks pass` : 'Validation'),
        h('p', { class: 'prose' }, 'Every circuit on every backend must agree: statevector fidelity within 1e-9 and χ² on counts. Red cells are real disagreements; grey cells were skipped with a reason.'),
        h('p', { class: 'small' }, headerText(rep) || 'No version metadata in this report.'),
        h('div', { class: 'row' },
          h('span', { class: 'badge b-lime' }, `${counts.pass} pass`),
          h('span', { class: 'badge b-ink' }, `${counts.skip} skip`),
          counts.fail ? h('span', { class: 'badge b-magenta' }, `${counts.fail} fail`) : null,
          h('span', { class: 'grow' }),
          h('button', { type: 'button', class: 'btn', onclick: rerun }, 'Run validation now'))),
      h('div', { class: 'card' }, h('div', { class: 'scroll-x' }, grid),
        h('p', { class: 'small' }, 'Select any cell for the metric and the circuit.')),
      drill);
    announce(`${counts.pass} of ${total} validation checks pass.`);
  }
  function openDrill(drill, rep, c) {
    drill.hidden = false;
    drill.replaceChildren(
      h('h3', { class: 'vtitle' }, `${c.circuit} on ${c.backend}`),
      h('p', { class: 'small' }, headerText(rep) || ''),
      h('ul', { class: 'small' }, metricLines(c).map(t => h('li', {}, t))));
    const ir = rep.circuitIR[c.circuit];
    const sc = ir && ir.ops ? toScoreCirc(ir, c.circuit) : null;
    if (sc) { const host = h('div', { class: 'scroll-x' }); drill.append(host); Score(host, { circ: sc, editable: false, compact: true, playhead: false }); }
    else drill.append(h('p', { class: 'small' }, 'This report does not include the circuit IR, so there is no score to draw.'));
    drill.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  return { render };
})();
