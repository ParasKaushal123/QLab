/* =====================================================================
   SCRIPTCARDS — Script mode: run Python on the runner, show what it did.
   A CodeMirror-lite editor (no external dependency; it reuses the
   .codebox styling and Code.highlight when present), Run via
   Runner.exec(), stdout / stderr / matplotlib figures, and one card per
   discovered circuit (name, SDK, definition line) with:
     - Open on canvas (Workbench.load, falling back to Lab.load),
     - Run on… (any Backends backend, via Backends.runCircuit),
     - Compare (TVD + fidelity between two cards' results).
   Starter scripts for qiskit / cirq / pennylane.
   Browser-only at mount time; loading this file never touches the DOM.
===================================================================== */
const ScriptCards = (() => {
  const STARTERS = {
    qiskit: [
      'from qiskit import QuantumCircuit',
      'from qiskit_aer import AerSimulator',
      '',
      'qc = QuantumCircuit(2)',
      'qc.h(0)',
      'qc.cx(0, 1)',
      'qc.measure_all()',
      'print(qc.count_ops())',
      "print(AerSimulator().run(qc, shots=1000).result().get_counts())",
    ].join('\n'),
    cirq: [
      'import cirq',
      '',
      'q = cirq.LineQubit.range(2)',
      'circuit = cirq.Circuit(cirq.H(q[0]), cirq.CNOT(q[0], q[1]))',
      'circuit.append(cirq.measure(q[0], q[1], key="ab"))',
      'print(circuit)',
      'print(cirq.Simulator().run(circuit, repetitions=1000).histogram(key="ab"))',
    ].join('\n'),
    pennylane: [
      'import pennylane as qml',
      '',
      'dev = qml.device("default.qubit", wires=2, shots=1000)',
      '',
      '',
      '@qml.qnode(dev)',
      'def circuit():',
      '    qml.Hadamard(wires=0)',
      '    qml.CNOT(wires=[0, 1])',
      '    return qml.counts(wires=[0, 1])',
      '',
      '',
      'print(circuit())',
    ].join('\n'),
  };
  const has = (g, f) => typeof g !== 'undefined' && g && typeof g[f] === 'function';
  const esc0 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* discovered sandbox IR → a canvas circuit (ops get fresh ids via IR.op) */
  function toCircuit(ir, fallbackName) {
    const n = Math.max(1, (ir && ir.n) | 0 || 1);
    const ops = ((ir && ir.ops) || []).map(o => IR.op(o.g, (o.q || []).slice(),
      { c: (o.c || []).slice(), p: (o.p || []).slice(), col: o.col || 0, cb: o.cb, cond: o.cond }));
    return { n, nc: (ir && ir.nc) || n, name: (ir && ir.name) || fallbackName || 'Script circuit',
      ops, defs: (ir && ir.defs) || {}, params: (ir && ir.params) || {} };
  }
  function openOnCanvas(circ) {
    if (typeof Workbench !== 'undefined' && Workbench && typeof Workbench.load === 'function') { Workbench.load(circ); location.hash = '#lab'; return; }
    if (typeof Lab !== 'undefined' && Lab && typeof Lab.load === 'function') { Lab.load(circ); location.hash = '#canvas'; return; }
    if (typeof toast === 'function') toast('No canvas is mounted to open this on.');
  }
  function topOf(counts, shots) {
    const e = Object.entries(counts || {}).sort((a, b) => b[1] - a[1])[0];
    return e ? `${e[0]} (${e[1]}${shots ? '/' + shots : ''})` : '—';
  }
  function errLine(text) {
    const m = String(text || '').match(/(?:script|"<script>"|File "<script>")[,"]*\s*,?\s*line\s+(\d+)/i) || String(text || '').match(/line (\d+)/i);
    return m ? +m[1] : null;
  }

  function mount(el) {
    let code = null;
    try { code = (typeof Store !== 'undefined' && Store.get().script) || STARTERS.qiskit; } catch (e) { code = STARTERS.qiskit; }
    let starter = 'qiskit', busy = false, last = null, results = [], badLn = null;
    const E = {};
    const say = msg => { E.status.textContent = msg; if (typeof announce === 'function') announce(msg); };

    const paint = () => {
      E.hl.innerHTML = (typeof Code !== 'undefined' && Code.highlight) ? Code.highlight(E.ta.value) : esc0(E.ta.value);
      E.gut.textContent = E.ta.value.split('\n').map((_, i) => i + 1).join('\n');
      E.hl.querySelectorAll('.cl.bad').forEach(l => l.classList.remove('bad'));
      if (badLn != null) { const l = E.hl.querySelector(`.cl[data-ln="${badLn}"]`); l && l.classList.add('bad'); }
      E.hl.scrollTop = E.ta.scrollTop; E.hl.scrollLeft = E.ta.scrollLeft; E.gut.scrollTop = E.ta.scrollTop;
    };
    const setCode = t => { E.ta.value = t; badLn = null; paint(); try { if (typeof Store !== 'undefined') Store.set('script', t); } catch (e) { } };

    const root = h('div', { class: 'scriptcards' });
    E.starter = h('select', { class: 'wb-sel', 'aria-label': 'Starter script' },
      [['qiskit', 'Qiskit starter'], ['cirq', 'Cirq starter'], ['pennylane', 'PennyLane starter']]
        .map(([v, l]) => h('option', { value: v, selected: v === starter }, l)));
    E.starter.addEventListener('change', () => { starter = E.starter.value; setCode(STARTERS[starter]); say(`Starter: ${starter}.`); });
    E.run = h('button', { type: 'button', class: 'btn primary' }, 'Run');
    E.run.addEventListener('click', run);
    E.status = h('span', { class: 'small', 'aria-live': 'polite' }, 'Scripts run in a sandbox on the runner.');
    const bar = h('div', { class: 'row wrap', style: { gap: '8px', marginBottom: '10px' } }, E.starter, E.run, E.status);

    E.gut = h('div', { class: 'gut', 'aria-hidden': 'true' });
    E.hl = h('pre', { 'aria-hidden': 'true' });
    E.ta = h('textarea', { spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', wrap: 'off', 'aria-label': 'Python script', style: { minHeight: '220px' } });
    E.ta.value = code;
    E.ta.addEventListener('input', () => { badLn = null; paint(); try { if (typeof Store !== 'undefined') Store.set('script', E.ta.value); } catch (e) { } });
    E.ta.addEventListener('scroll', paint);
    E.ta.addEventListener('keydown', e => {
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const s = E.ta.selectionStart; E.ta.setRangeText('    ', s, E.ta.selectionEnd, 'end');
        E.ta.selectionStart = E.ta.selectionEnd = s + 4; paint();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(); }
    });
    const editor = h('div', { class: 'codebox', style: { maxHeight: '340px' } }, E.gut, E.hl, E.ta);

    E.out = h('div', { class: 'sc-out' });
    E.cards = h('div', { class: 'sc-cards' });
    E.compare = h('div', { class: 'sc-compare' });
    root.append(bar, editor, E.out, h('h3', { class: 'vtitle', style: { marginTop: '14px' } }, 'Discovered circuits'), E.cards, E.compare);
    el.replaceChildren(root);
    paint();

    function showOutput(r) {
      E.out.replaceChildren();
      const pre = (t, cls) => h('pre', { class: cls || 'small mono', style: { whiteSpace: 'pre-wrap' } }, t);
      if (r.stdout) E.out.append(h('p', { class: 'lbl' }, 'stdout'), pre(r.stdout));
      if (r.stderr) E.out.append(h('p', { class: 'lbl' }, 'stderr'), pre(r.stderr, 'small mono bad'));
      if (!r.ok) {
        E.out.append(h('p', { class: 'lbl' }, 'error'), pre(r.error || 'The script failed.', 'small mono bad'));
        const ln = errLine(r.error);
        if (ln != null) { badLn = ln; paint(); say(`Error at script line ${ln}.`); }
      }
      (r.problems || []).forEach(p => E.out.append(h('p', { class: 'note' }, 'Not convertible: ' + p)));
      (r.figures || []).slice(0, 8).forEach((f, i) =>
        E.out.append(h('img', { src: 'data:image/png;base64,' + f, alt: `Figure ${i + 1}`, style: { maxWidth: '100%', marginTop: '8px' } })));
      if (r.ok && !r.stdout && !(r.figures || []).length) E.out.append(h('p', { class: 'small' }, 'Ran cleanly with no output.'));
    }

    function cardEl(c, i) {
      const ops = (c.ir && c.ir.ops ? c.ir.ops.length : '—');
      const title = h('p', { class: 'serif', style: { fontSize: '18px' } }, c.name || `circuit ${i + 1}`);
      const sub = h('p', { class: 'small' }, `${c.sdk || 'unknown SDK'}${c.line != null ? ` · defined at line ${c.line}` : ''} · ${ops} ops`);
      const open = h('button', { type: 'button', class: 'btn', onclick: () => { try { openOnCanvas(toCircuit(c.ir, c.name)); } catch (e) { say(e.message); } } }, 'Open on canvas');
      const backs = (typeof Backends !== 'undefined' && Backends.LIST ? Backends.LIST : [{ id: 'browser', name: 'Browser' }])
        .map(b => h('option', { value: b.id }, b.name));
      const sel = h('select', { class: 'wb-sel', 'aria-label': `Backend for ${c.name || 'circuit'}` }, backs);
      try { sel.value = 'browser'; } catch (e) { }
      const shots = h('select', { class: 'wb-sel', 'aria-label': 'Shots' }, ['100', '1000', '4000'].map(v => h('option', { value: v, selected: v === '1000' }, v)));
      const res = h('p', { class: 'small mono', 'aria-live': 'polite' });
      const go = h('button', { type: 'button', class: 'btn', onclick: async () => {
        if (typeof Backends === 'undefined') { res.textContent = 'No backends here.'; return; }
        res.textContent = 'Running…';
        try {
          const circ = toCircuit(c.ir, c.name);
          const r = await Backends.runCircuit({ circuit: circ, backend: sel.value, shots: +shots.value });
          results[i] = r; paintCompare();
          res.textContent = `Top ${topOf(r.counts, r.shots || +shots.value)} · ${r.meta ? r.meta.method : ''}`;
          say(`${c.name || 'Circuit'}: top outcome ${topOf(r.counts)}.`);
        } catch (e) { res.textContent = String((e && e.message) || e); }
      } }, 'Run on…');
      return h('div', { class: 'card sc-card', style: { marginTop: '8px' } }, title, sub, h('div', { class: 'row wrap', style: { gap: '8px' } }, open, sel, shots, go), res);
    }

    function paintCompare() {
      E.compare.replaceChildren();
      const ready = results.map((r, i) => r ? i : -1).filter(i => i >= 0);
      if (ready.length < 2) { E.compare.append(h('p', { class: 'small' }, 'Run two circuits on a backend to compare them.')); return; }
      const opt = i => h('option', { value: i }, (last.circuits[i] && last.circuits[i].name) || `circuit ${i + 1}`);
      const a = h('select', { class: 'wb-sel', 'aria-label': 'First circuit' }, ready.map(opt));
      const b = h('select', { class: 'wb-sel', 'aria-label': 'Second circuit' }, ready.map(opt));
      try { b.value = ready[1]; } catch (e) { }
      const out = h('p', { class: 'small mono', 'aria-live': 'polite' });
      const go = h('button', { type: 'button', class: 'btn', onclick: () => {
        const A = results[+a.value], B = results[+b.value];
        if (!A || !B) { out.textContent = 'Run both circuits first.'; return; }
        if (typeof Backends === 'undefined' || !Backends.tvd) { out.textContent = 'Comparison needs Backends.tvd.'; return; }
        const t = Backends.tvd(A, B);
        out.textContent = `TVD ${t.tvd.toFixed(3)} · fidelity ${t.fidelity.toFixed(3)}${t.tvd < .05 ? ' · agree' : ' · differ'}`;
      } }, 'Compare');
      E.compare.append(h('div', { class: 'row wrap', style: { gap: '8px', marginTop: '10px' } }, a, b, go), out);
    }

    async function run() {
      if (busy) return;
      if (typeof Runner === 'undefined' || !Runner.exec) { say('The Runner client is not loaded.'); return; }
      busy = true; E.run.disabled = true; say('Running…'); E.out.replaceChildren(h('p', { class: 'small' }, 'Running in the sandbox…'));
      try {
        const r = await Runner.exec(E.ta.value);
        last = r; results = []; badLn = null; paint();
        showOutput(r);
        E.cards.replaceChildren();
        (r.circuits || []).forEach((c, i) => E.cards.append(cardEl(c, i)));
        if (!(r.circuits || []).length) E.cards.append(h('p', { class: 'small' }, 'No circuits found. Assign a QuantumCircuit / cirq.Circuit / QNode to a variable, or call qlab.show(obj, name).'));
        else say(`${r.circuits.length} circuit${r.circuits.length > 1 ? 's' : ''} discovered.`);
        paintCompare();
      } catch (e) {
        E.out.replaceChildren(h('p', { class: 'err' }, 'Offline — start the runner at ' + ((typeof Runner !== 'undefined' && Runner.url) ? Runner.url() : 'localhost:8765') + ' (' + ((e && e.message) || e) + ')'));
        say('Runner offline.');
      } finally { busy = false; E.run.disabled = false; }
    }
    paint();
    return { run };
  }
  return { mount, STARTERS, toCircuit };
})();
