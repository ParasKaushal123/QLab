/* =====================================================================
   WORKBENCH — the Laboratory's circuit page.
   Wires you can add and remove; a toolbox you drag from; the state
   re-simulated on every drop; displays that sit on the wires (Bloch,
   chance, amplitudes, density) and animate with the clock t; code on the
   right, always open, regenerated on every edit and parsed back when typed.
   One truth: the grid compiles to IR ops, and both the simulator and the
   code generator read those same ops.
===================================================================== */
ICON_DATA.pause = [['rect', { x: 6, y: 4, width: 4, height: 16, rx: 1 }], ['rect', { x: 14, y: 4, width: 4, height: 16, rx: 1 }]];
ICON_DATA.trash = [['path', { d: 'M3 6h18' }], ['path', { d: 'M8 6V4h8v2' }], ['path', { d: 'M19 6l-1 14H6L5 6' }]];

const Workbench = (() => {
  const ROW = 56, GUT = 92, OUTW = 132, MAXQ = 16;
  const PI = Math.PI;
  /* ---------------- gate catalogue ---------------- */
  const G1 = { H: 'Hadamard', X: 'Pauli X (NOT)', Y: 'Pauli Y', Z: 'Pauli Z', S: 'S = Z^½', SDG: 'S† = Z^-½', T: 'T = Z^¼', TDG: 'T† = Z^-¼', SX: '√X = X^½', SXDG: '√X† = X^-½' };
  const DESC = {
    H: 'Swaps the Z and X axes. Turns |0⟩ into |+⟩, an equal superposition.', X: 'Flips |0⟩ ↔ |1⟩. Half a turn around the X axis. In a column with controls it draws as ⊕.',
    Y: 'Half a turn around the Y axis.', Z: 'Half a turn around the Z axis: flips the phase of |1⟩.', S: 'Quarter turn around Z.', SDG: 'Quarter turn back around Z.',
    T: 'Eighth turn around Z.', TDG: 'Eighth turn back around Z.', SX: 'Quarter turn around X.', SXDG: 'Quarter turn back around X.',
    CTRL: 'Control. Every gate in this column acts only when this wire is |1⟩.', ACTRL: 'Anti-control. Gates in this column act only when this wire is |0⟩.',
    MEASURE: 'Measure in the Z basis. After this the wire is classical: it can still control gates, but gates can’t act on it.',
    SWAP: 'Place two in one column to exchange those two wires.',
    BLOCH: 'Bloch sphere of this wire at this point. A shorter arrow means the wire is entangled with others.',
    CHANCE: 'Chance of reading 1 on each covered wire (one wire), or the distribution over the covered wires. Drag the handle to cover more wires.',
    AMPS: 'Amplitudes of the covered wires: circle size is magnitude, the line is the phase. Greyed when those wires are entangled with the rest.',
    DENSITY: 'Density matrix of one or two wires. Off-diagonal entries are coherence.',
    RX: 'Rotation about X by an angle. Type any expression; use t for the clock.', RY: 'Rotation about Y by an angle. Type any expression; use t for the clock.',
    RZ: 'Rotation about Z by an angle. Type any expression; use t for the clock.', P: 'Phase shift of |1⟩ by an angle. Type any expression; use t for the clock.',
    RZZ: 'ZZ interaction on two neighbouring wires.', RXX: 'XX interaction on two neighbouring wires.', RYY: 'YY interaction on two neighbouring wires.', ISWAP: 'Swaps two neighbouring wires with a phase of i.',
    QFT: 'Quantum Fourier transform over the covered wires (top wire is the most significant bit).', IQFT: 'Inverse quantum Fourier transform.',
    INC: 'Adds 1 to the number held by the covered wires (mod 2^k).', DEC: 'Subtracts 1 from the number held by the covered wires (mod 2^k).', REV: 'Reverses the order of the covered wires.'
  };
  const POW = { XH: ['X', '1/2'], XHD: ['X', '-1/2'], YH: ['Y', '1/2'], YHD: ['Y', '-1/2'], XQ: ['X', '1/4'], XQD: ['X', '-1/4'], YQ: ['Y', '1/4'], YQD: ['Y', '-1/4'],
    XT: ['X', 't'], XTD: ['X', '-t'], YT: ['Y', 't'], YTD: ['Y', '-t'], ZT: ['Z', 't'], ZTD: ['Z', '-t'] };
  const SPAN = { CHANCE: [1, 5, 1], AMPS: [1, 5, 2], DENSITY: [1, 2, 1], QFT: [2, 8, 3], IQFT: [2, 8, 3], INC: [1, 8, 3], DEC: [1, 8, 3], REV: [2, 8, 3], RZZ: [2, 2, 2], RXX: [2, 2, 2], RYY: [2, 2, 2], ISWAP: [2, 2, 2] };
  const PARAM = { RX: 1, RY: 1, RZ: 1, P: 1, RZZ: 1, RXX: 1, RYY: 1 };
  const DISPLAY = { BLOCH: 1, CHANCE: 1, AMPS: 1, DENSITY: 1 };
  function kind(k) { if (k === 'CTRL' || k === 'ACTRL') return 'ctrl'; if (DISPLAY[k]) return 'display'; if (k === 'MEASURE') return 'measure'; if (k === 'SWAP') return 'swap'; if (POW[k]) return 'pow'; return 'gate'; }
  function fam(k) {
    if (DISPLAY[k]) return 'disp'; if (k === 'CTRL' || k === 'ACTRL') return 'ctl'; if (k === 'MEASURE') return 'meas';
    if (POW[k]) return POW[k][1].includes('t') ? 'time' : 'phase';
    if (['H', 'X', 'Y', 'Z'].includes(k)) return 'pauli'; if (['S', 'SDG', 'T', 'TDG', 'SX', 'SXDG'].includes(k)) return 'phase';
    if (PARAM[k]) return 'rot'; return 'two';
  }
  const title = k => G1[k] || { CTRL: 'Control', ACTRL: 'Anti-control', MEASURE: 'Measurement', SWAP: 'Swap', BLOCH: 'Bloch sphere', CHANCE: 'Chance display', AMPS: 'Amplitude display', DENSITY: 'Density matrix',
    RX: 'Rx(θ)', RY: 'Ry(θ)', RZ: 'Rz(θ)', P: 'Phase P(φ)', RZZ: 'ZZ(θ)', RXX: 'XX(θ)', RYY: 'YY(θ)', ISWAP: 'iSWAP', QFT: 'Fourier transform', IQFT: 'Inverse Fourier transform', INC: 'Increment +1', DEC: 'Decrement −1', REV: 'Reverse wires' }[k]
    || (POW[k] ? `${POW[k][0]}^${POW[k][1]}` : k);
  const TOOLBOX = [
    ['Probes', [['MEASURE'], ['CTRL'], ['ACTRL']]],
    ['Displays', [['BLOCH'], ['CHANCE'], ['AMPS'], ['DENSITY']]],
    ['Half turns', [['H'], ['X'], ['Y'], ['Z'], ['SWAP']]],
    ['Quarter turns', [['S'], ['SDG'], ['SX'], ['SXDG'], ['YH'], ['YHD']]],
    ['Eighth turns', [['T'], ['TDG'], ['XQ'], ['XQD'], ['YQ'], ['YQD']]],
    ['Spinning', [['XT'], ['XTD'], ['YT'], ['YTD'], ['ZT'], ['ZTD']]],
    ['Parametrised', [['RX', 'pi/2'], ['RY', 'pi/2'], ['RZ', 'pi/2'], ['P', 'pi/4']]],
    ['Formulaic', [['RX', '2*pi*t'], ['RY', 'pi*t**2'], ['RZ', 'pi*sin(2*pi*t)'], ['P', '2*pi*t']]],
    ['Two-qubit', [['RZZ', 'pi/2'], ['RXX', 'pi/2'], ['RYY', 'pi/2'], ['ISWAP']]],
    ['Multi-qubit', [['QFT'], ['IQFT'], ['INC'], ['DEC'], ['REV']]]
  ];
  /* ---------------- expressions ---------------- */
  const normExpr = s => String(s).trim().replace(/\^/g, '**').replace(/π/g, 'pi').replace(/\b(np|numpy|sympy|math)\./g, '');
  const envFor = t => ({ t });
  function evalE(e, t) { // simlib's evaluator + sin/cos/exp
    const s = String(e).replace(/\b(np|numpy|sympy|math)\./g, '').replace(/\*\*/g, '^');
    if (!/\b(sin|cos|exp)\s*\(/.test(s)) return Sim.evalExpr(s, envFor(t));
    let out = s, guard = 0;
    while (/\b(sin|cos|exp)\s*\(/.test(out) && guard++ < 20) out = out.replace(/\b(sin|cos|exp)\s*\(([^()]*)\)/, (m, f, a) => `(${Math[f](Sim.evalExpr(a, envFor(t)))})`);
    return Sim.evalExpr(out, envFor(t));
  }
  const pretty = e => String(e).replace(/\*\*2\b/g, '²').replace(/\*\*3\b/g, '³').replace(/\*\*/g, '^').replace(/\bpi\b/g, 'π').replace(/\*/g, '·').replace(/\s+/g, '');
  const usesT = e => /\bt\b/.test(String(e));
  /* ---------------- state ---------------- */
  let S, undo = [], redo = [], root, E = {}, mounted = false, lang = Store.get().wbLang || 'qiskit';
  let t = 0, playing = true, speed = 1, raf = null, lastTs = 0, plan = null, dirty = true, fromCode = false, sel = null, runs = [], hoverCell = null;
  const blank = n => Array(n).fill(null);
  const cell = (k, p, span) => { const c = { k }; if (PARAM[k]) c.p = normExpr(p ?? 'pi/2'); if (SPAN[k]) c.span = span ?? SPAN[k][2]; return c; };
  function tok(s) {
    if (!s || s === '-') return null; if (s === '•') return cell('CTRL'); if (s === '◦') return cell('ACTRL'); if (s === 'M') return cell('MEASURE'); if (s === 'SW') return cell('SWAP');
    const m = s.match(/^([A-Z]+)(\d)?(?::(.+))?$/); if (!m || DISPLAY[m[1]]) return null; return cell(m[1], m[3], m[2] ? +m[2] : undefined);
  }
  const grid = (n, cols, init) => ({ n, init: init || Array(n).fill('0'), cols: cols.map(c => { const a = blank(n); c.forEach((x, w) => a[w] = tok(x)); return a; }) });
  const TEMPLATES = [
    ['Welcome: entangle and spin', () => grid(3, [['H', '-', 'XT'], ['•', 'X'], ['BLOCH', 'BLOCH', 'BLOCH'], ['AMPS3']])],
    ['Bell pair', () => grid(2, [['H'], ['•', 'X'], ['BLOCH', 'BLOCH'], ['DENSITY2']])],
    ['GHZ on 4 qubits', () => grid(4, [['H'], ['•', 'X'], ['-', '•', 'X'], ['-', '-', '•', 'X'], ['CHANCE4']])],
    ['Spinning qubits', () => grid(3, [['XT', 'H', 'YT'], ['-', 'ZT'], ['BLOCH', 'BLOCH', 'BLOCH'], ['CHANCE', 'CHANCE', 'CHANCE']])],
    ['Interference: H · Zᵗ · H', () => grid(1, [['H'], ['BLOCH'], ['ZT'], ['BLOCH'], ['H'], ['CHANCE']])],
    ['Teleport a spinning qubit', () => grid(3, [['XT'], ['BLOCH', 'H'], ['-', '•', 'X'], ['•', 'X'], ['H'], ['M', 'M'], ['-', '•', 'X'], ['•', '-', 'Z'], ['-', '-', 'BLOCH']])],
    ['Grover search for |11⟩', () => grid(2, [['H', 'H'], ['CHANCE2'], ['•', 'Z'], ['H', 'H'], ['X', 'X'], ['•', 'Z'], ['X', 'X'], ['H', 'H'], ['CHANCE2']])],
    ['Fourier transform of |5⟩', () => grid(3, [['X', '-', 'X'], ['AMPS3'], ['QFT3'], ['AMPS3']])],
    ['Counter: +1 each column', () => grid(3, [['CHANCE3'], ['INC3'], ['CHANCE3'], ['INC3'], ['CHANCE3'], ['INC3'], ['CHANCE3']])],
    ['Entanglement shrinks the arrow', () => grid(2, [['RY:pi*t'], ['BLOCH'], ['•', 'X'], ['BLOCH', 'BLOCH'], ['DENSITY2']])]
  ];
  const snap = () => JSON.stringify({ n: S.n, init: S.init, cols: S.cols, name: S.name });
  function commit(label) { if (undo[undo.length - 1] !== S._before) { } undo.push(S._before); if (undo.length > 200) undo.shift(); redo = []; S._before = null; normalise(); dirty = true; persist(); render(); if (label) announce(label); }
  function begin() { S._before = snap(); }
  function change(fn, label) { begin(); fn(); commit(label); }
  function restoreSnap(j) { const o = JSON.parse(j); S = Object.assign({ name: S.name }, o); dirty = true; persist(); render(); }
  function doUndo() { if (!undo.length) return; redo.push(snap()); restoreSnap(undo.pop()); announce('Undone'); }
  function doRedo() { if (!redo.length) return; undo.push(snap()); restoreSnap(redo.pop()); announce('Redone'); }
  function persist() { Store.set('wb', { n: S.n, init: S.init, cols: S.cols, name: S.name }); }
  function normalise() {
    S.cols = S.cols.filter(c => c.some(Boolean));
    S.cols.forEach(c => c.forEach((x, w) => { if (x && x.span) { x.span = Math.max(SPAN[x.k][0], Math.min(x.span, SPAN[x.k][1], S.n - w)); if (x.span < SPAN[x.k][0]) c[w] = null; } }));
  }
  function load(state, name) { S = Object.assign({ name: name || state.name || 'Untitled circuit' }, JSON.parse(JSON.stringify(state))); S.cols = S.cols.map(c => { const a = blank(S.n); c.forEach((x, w) => { if (w < S.n && !(x && DISPLAY[x.k])) a[w] = x; }); return a; }); normalise(); dirty = true; }
  /* ---------------- geometry of a column ---------------- */
  function owners(col) { const o = blank(col.length); col.forEach((x, w) => { if (x) for (let k = 0; k < (x.span || 1) && w + k < o.length; k++) o[w + k] = w; }); return o; }
  function place(c, w, x, insert) {
    const n = S.n, span = x.span || 1;
    if (span > n) { toast(`${title(x.k)} needs ${span} qubits. Add ${span - n} more.`); return false; }
    if (insert) S.cols.splice(c, 0, blank(n));
    while (S.cols.length <= c) S.cols.push(blank(n));
    w = Math.max(0, Math.min(w, n - span)); let col = S.cols[c];
    // dropping onto part of a wider gate (or a wide gate onto others) opens a new column instead of erasing them
    const clash = col.some((y, j) => y && !(j + (y.span || 1) - 1 < w || j > w + span - 1) && ((y.span || 1) > 1 || span > 1) && !(j === w && (y.span || 1) === span));
    if (clash && !insert) { S.cols.splice(c + 1, 0, blank(n)); col = S.cols[c + 1]; }
    col.forEach((y, j) => { if (y && !(j + (y.span || 1) - 1 < w || j > w + span - 1)) col[j] = null; });
    col[w] = x; return true;
  }
  /* ---------------- grid → IR ops (the one compiler) ---------------- */
  let UID = 1;
  const mk = (g, q, c, p, meta, extra) => Object.assign({ id: UID++, g, q, c: c.slice(), p: p || [], meta }, extra || {});
  function compile() {
    const n = S.n, ops = [], cols = [], errors = new Map(), measured = new Map();
    const prep = [];
    S.init.forEach((v, w) => { const m = { gc: -1, w: [w] }; ({ '1': [['X']], '+': [['H']], '-': [['X'], ['H']], 'i': [['H'], ['S']], '-i': [['H'], ['SDG']] }[v] || []).forEach(([g]) => prep.push(mk(g, [w], [], [], m))); });
    ops.push(...prep);
    S.cols.forEach((col, gc) => {
      const cOps = [], disp = [], ctr = [], anti = [], swaps = [], err = (w, msg) => errors.set(`${gc}:${w}`, msg);
      col.forEach((x, w) => { if (!x) return; if (x.k === 'CTRL') ctr.push(w); else if (x.k === 'ACTRL') anti.push(w); else if (x.k === 'SWAP') swaps.push(w); });
      const cs = [...ctr, ...anti].sort((a, b) => a - b), hasCtl = cs.length > 0;
      const wasMeasured = w => measured.has(w) && measured.get(w) < gc;
      const meta = (w, span) => ({ gc, w: Array.from({ length: span || 1 }, (_, i) => w + i) });
      anti.forEach(w => cOps.push(mk('X', [w], [], [], { gc, w: [w], anti: true })));
      const core = [];
      col.forEach((x, w) => {
        if (!x) return; const K = kind(x.k), span = x.span || 1, wires = Array.from({ length: span }, (_, i) => w + i);
        if (K === 'ctrl' || K === 'swap') return;
        if (K === 'display') { disp.push({ x, w, span, gc }); return; }
        if (K === 'measure') { if (hasCtl) return err(w, 'A measurement can’t be controlled. Move it to its own column.'); if (wasMeasured(w)) return err(w, 'This wire is already measured.'); measured.set(w, gc); core.push(mk('M', [w], [], [], meta(w), { cb: w })); return; }
        if (wires.some(wasMeasured)) return err(w, 'This wire was measured earlier. Quantum gates can’t act on it now (it can still control).');
        if (wires.some(q => cs.includes(q))) return;
        const M = meta(w, span), c = cs;
        try {
          if (PARAM[x.k]) evalE(x.p, 0.3);
        } catch (e) { return err(w, `Can’t read the angle: ${e.message}`); }
        const out = expand(x, w, wires, c, M); core.push(...out);
      });
      if (swaps.length) {
        if (swaps.length !== 2) swaps.forEach(w => err(w, 'Swaps come in pairs: put exactly two in this column.'));
        else if (swaps.some(wasMeasured)) swaps.forEach(w => err(w, 'Can’t swap a measured wire.'));
        else core.push(mk('SWAP', swaps.slice(), cs.filter(q => !swaps.includes(q)), [], { gc, w: swaps.slice() }));
      }
      if (hasCtl && !core.length && col.some(x => x && (kind(x.k) === 'gate' || kind(x.k) === 'pow'))) { }
      cOps.push(...core);
      anti.forEach(w => cOps.push(mk('X', [w], [], [], { gc, w: [w], anti: true })));
      if (!core.length) cOps.length = 0; // lone anti-controls do nothing
      ops.push(...cOps);
      cols.push({ ops: cOps, disp, measured: new Set([...measured.entries()].filter(([, c]) => c <= gc).map(([w]) => w)) });
    });
    ops.forEach((o, i) => o.col = i);
    const ir = { n, nc: n, ops, params: {}, defs: {} };
    return { ir, prep, cols, errors, measured, timeDep: ops.some(o => o.p.some(usesT)) };
  }
  function expand(x, w, wires, c, M) {
    const k = x.k, out = [], add = (g, q, ctl, p) => out.push(mk(g, q, ctl ? c : [], p, M));
    if (G1[k]) { add(k, [w], true); return out; }
    if (PARAM[k]) { if (SPAN[k]) add(k, [w, w + 1], true, [x.p]); else add(k, [w], true, [x.p]); return out; }
    if (k === 'ISWAP') { add('ISWAP', [w, w + 1], true); return out; }
    if (POW[k]) {
      const [ax, e] = POW[k], num = /t/.test(e) ? null : evalE(e, 0);
      const ph = num == null ? (e.startsWith('-') ? `-pi*${e.slice(1)}` : `pi*${e}`) : num * PI;
      const coreG = num === .5 && ax === 'X' ? ['SX', []] : num === -.5 && ax === 'X' ? ['SXDG', []] : num === .25 ? ['T', []] : num === -.25 ? ['TDG', []] : num === .5 ? ['S', []] : num === -.5 ? ['SDG', []] : ['P', [ph]];
      const pre = ax === 'X' ? (coreG[0].startsWith('SX') ? [] : ['H']) : ax === 'Y' ? (coreG[0].startsWith('SX') ? ['SDG'] : ['SDG', 'H']) : [];
      pre.forEach(g => add(g, [w], false)); add(coreG[0], [w], true, coreG[1]); pre.slice().reverse().forEach(g => add(g === 'SDG' ? 'S' : g, [w], false));
      return out;
    }
    const n = wires.length;
    if (k === 'QFT' || k === 'IQFT') {
      const seq = [];
      for (let j = 0; j < n; j++) { seq.push(['H', [wires[j]], [], []]); for (let m = j + 1; m < n; m++) seq.push(['P', [wires[j]], [wires[m]], [PI / 2 ** (m - j)]]); }
      for (let j = 0; j < Math.floor(n / 2); j++) seq.push(['SWAP', [wires[j], wires[n - 1 - j]], [], []]);
      const list = k === 'QFT' ? seq : seq.slice().reverse().map(([g, q, cc, p]) => [g, q, cc, p.map(v => -v)]);
      list.forEach(([g, q, cc, p]) => out.push(mk(g, q, [...c, ...cc], p, M))); return out;
    }
    if (k === 'INC' || k === 'DEC') {
      const seq = []; for (let j = 0; j < n; j++) seq.push(['X', [wires[j]], wires.slice(j + 1)]);
      (k === 'INC' ? seq : seq.reverse()).forEach(([g, q, cc]) => out.push(mk(g, q, [...c, ...cc], [], M))); return out;
    }
    if (k === 'REV') { for (let j = 0; j < Math.floor(n / 2); j++) out.push(mk('SWAP', [wires[j], wires[n - 1 - j]], c, [], M)); return out; }
    return out;
  }
  /* ---------------- IR ops → grid (used by the code editor and Lab.load) ---------------- */
  function fromOps(n, ops, keepDisplays) {
    const cols = [], last = Array(n).fill(-1), excl = new Set(), warn = [];
    const colAt = i => { while (cols.length <= i) cols.push(blank(n)); return cols[i]; };
    for (const o of Sim.sorted ? ops : ops) {
      const g = o.g, q = o.q || [], c = o.c || [];
      if (g === 'BARRIER' || g === 'I') continue;
      if (o.cond || g === 'RESET' || g === 'SUB' || g === 'PERM') { warn.push(`${g === 'SUB' ? 'Sub-circuit' : o.cond ? 'Classically conditioned gate' : g} skipped`); continue; }
      let cells = [];
      const P = v => typeof v === 'number' ? Code.fmtNum(v) : String(v);
      if (g === 'M') cells = [[q[0], cell('MEASURE')]];
      else if (g === 'SWAP') cells = [[q[0], cell('SWAP')], [q[1], cell('SWAP')]];
      else if (['RXX', 'RYY', 'RZZ', 'ISWAP'].includes(g)) { if (Math.abs(q[0] - q[1]) !== 1) { warn.push(`${g} on non-neighbouring wires skipped`); continue; } cells = [[Math.min(...q), cell(g, P(o.p[0] ?? 'pi/2'), 2)]]; }
      else if (PARAM[g]) cells = [[q[0], cell(g, P(o.p[0]))]];
      else if (G1[g]) cells = [[q[0], cell(g)]];
      else if (g === 'U') { const [a, b, l] = (o.p || []).map(v => typeof v === 'number' ? v : NaN); if ([a, b, l].some(isNaN)) { warn.push('Symbolic U gate skipped'); continue; } cells = [[q[0], cell('RZ', Code.fmtNum(l))], [q[0], cell('RY', Code.fmtNum(a))], [q[0], cell('RZ', Code.fmtNum(b))]]; }
      else { warn.push(`${g} skipped`); continue; }
      const seqCells = g === 'U' ? cells.map(cl => [cl]) : [cells];
      for (const group of seqCells) {
        const wires = [...c, ...group.flatMap(([w, x]) => Array.from({ length: x.span || 1 }, (_, i) => w + i))];
        let col = Math.max(...wires.map(w => last[w])) + 1;
        const needExcl = c.length > 0 || g === 'SWAP';
        for (; ; col++) { const cc = colAt(col), own = owners(cc); if (excl.has(col)) continue; if (needExcl ? cc.some(Boolean) : wires.some(w => own[w] != null)) continue; break; }
        const cc = colAt(col); group.forEach(([w, x]) => cc[w] = x); c.forEach(w => cc[w] = cell('CTRL'));
        if (needExcl) excl.add(col); wires.forEach(w => last[w] = col);
      }
    }
    if (keepDisplays) keepDisplays.forEach(({ gc, w, x }) => { const span = x.span || 1; if (w + span > n) return; let at = gc; const free = i => { const cc = colAt(i), own = owners(cc); return !excl.has(i) && Array.from({ length: span }, (_, k) => own[w + k] == null).every(Boolean); }; if (!free(at)) at = cols.length; colAt(at)[w] = x; });
    return { cols, warn };
  }
  function fromIR(circ) {
    const flat = Sim.expand(circ).filter(o => o.g !== 'PERM' || true);
    const { cols, warn } = fromOps(circ.n, flat);
    return { state: { n: circ.n, init: Array(circ.n).fill('0'), cols }, warn };
  }
  /* ---------------- simulation ---------------- */
  let frame = null; // {final, disp: Map(key → data), wires: [...]}
  function simulate() {
    if (dirty || !plan) { plan = compile(); dirty = false; if (!fromCode) renderCode(); fromCode = false; paintLint(); }
    const n = S.n, env = envFor(t), s = Sim.zero(n), disp = new Map();
    for (const o of plan.prep) Sim.applyUnitary(s, o, env);
    DCAN.size || null;
    plan.cols.forEach(col => {
      for (const o of col.ops) if (o.g !== 'M') { try { Sim.applyUnitary(s, o.p.length ? Object.assign({}, o, { p: o.p.map(v => typeof v === 'number' ? v : evalE(v, t)) }) : o, env); } catch (e) { } }
      for (const d of col.disp) disp.set(`${d.gc}:${d.w}`, measureDisplay(s, d, col.measured));
    });
    const probs = Sim.probs(s), wires = [];
    const measuredAll = new Set(plan.measured.keys());
    for (let q = 0; q < n; q++) { const b = Sim.bloch(s, q); if (measuredAll.has(q)) { b[0] = 0; b[1] = 0; } wires.push({ p1: Sim.probOne(s, q), bloch: b, purity: n > 1 && n <= 12 ? Sim.purity(s, [q]) : 1 }); }
    frame = { s, probs, disp, wires };
  }
  function measureDisplay(s, d, measured) {
    const wires = Array.from({ length: d.span }, (_, i) => d.w + i), k = d.x.k;
    if (k === 'BLOCH') { const b = Sim.bloch(s, d.w); if (measured.has(d.w)) { b[0] = 0; b[1] = 0; } return { bloch: b }; }
    if (k === 'CHANCE') { if (d.span === 1) return { p1: Sim.probOne(s, d.w) }; const m = Sim.marginal(Sim.probs(s), s.n, wires), D = 1 << d.span, arr = new Float64Array(D); for (const key in m) arr[parseInt(key, 2)] = m[key]; return { dist: arr }; }
    const { D, rho } = Sim.reduced(s, wires);
    const mIdx = wires.map((w, i) => measured.has(w) ? 1 << (wires.length - 1 - i) : 0).reduce((a, b) => a | b, 0);
    if (mIdx) for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) if ((i & mIdx) !== (j & mIdx)) { rho[2 * (i * D + j)] = 0; rho[2 * (i * D + j) + 1] = 0; }
    if (k === 'DENSITY') return { rho, D };
    // AMPS: exact amplitudes when the display covers every wire; otherwise the pure reduced state if there is one
    if (d.span === s.n && !mIdx) return { re: Float64Array.from(s.re), im: Float64Array.from(s.im), D, coherent: true };
    let pur = 0; for (let i = 0; i < 2 * D * D; i++) pur += rho[i] * rho[i];
    const re = new Float64Array(D), im = new Float64Array(D);
    if (pur > .999) { let j = 0; for (let i = 1; i < D; i++) if (rho[2 * (i * D + i)] > rho[2 * (j * D + j)]) j = i; const r = Math.sqrt(rho[2 * (j * D + j)]) || 1; for (let i = 0; i < D; i++) { re[i] = rho[2 * (i * D + j)] / r; im[i] = rho[2 * (i * D + j) + 1] / r; } return { re, im, D, coherent: true }; }
    for (let i = 0; i < D; i++) re[i] = Math.sqrt(Math.max(0, rho[2 * (i * D + i)])); return { re, im, D, coherent: false };
  }
  /* ---------------- drawing helpers (canvas) ---------------- */
  const DPR = () => Math.min(2, window.devicePixelRatio || 1);
  function cv(w, hgt, cls) { const c = h('canvas', { class: cls || '', width: Math.round(w * DPR()), height: Math.round(hgt * DPR()), style: { width: w + 'px', height: hgt + 'px' } }); c._w = w; c._h = hgt; return c; }
  function ctxOf(c) { const x = c.getContext('2d'); x.setTransform(DPR(), 0, 0, DPR(), 0, 0); x.clearRect(0, 0, c._w, c._h); return x; }
  const AZ = 20 * PI / 180, EL = 16 * PI / 180;
  function proj(x, y, z) { const u = y * Math.cos(AZ) - x * Math.sin(AZ), dep = x * Math.cos(AZ) + y * Math.sin(AZ), v = z * Math.cos(EL) - dep * Math.sin(EL); return [u, v, dep]; }
  function drawBloch(c, vec, big) {
    const g = ctxOf(c), W = c._w, cx = W / 2, cy = c._h / 2, R = W / 2 - (big ? 14 : 3);
    const grd = g.createRadialGradient(cx - R * .35, cy - R * .4, R * .1, cx, cy, R); grd.addColorStop(0, '#FFFFFF'); grd.addColorStop(1, '#ECE8FF');
    g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, R, 0, 2 * PI); g.fill(); g.strokeStyle = '#CFC7F5'; g.lineWidth = 1; g.stroke();
    const P = (x, y, z) => { const [u, v] = proj(x, y, z); return [cx + R * u, cy - R * v]; };
    for (const back of [true, false]) { g.beginPath(); let first = true; for (let a = 0; a <= 64; a++) { const th = a / 64 * 2 * PI, [u, v, dep] = proj(Math.cos(th), Math.sin(th), 0); if ((dep < 0) !== back) { first = true; continue; } const X = cx + R * u, Y = cy - R * v; first ? g.moveTo(X, Y) : g.lineTo(X, Y); first = false; } g.setLineDash(back ? [2, 3] : []); g.strokeStyle = back ? '#D8D2F4' : '#BDB2EE'; g.stroke(); }
    g.setLineDash([]);
    if (big) { g.strokeStyle = '#E3DEF8'; [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach(a => { const [x1, y1] = P(...a), [x2, y2] = P(...a.map(v => -v)); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); });
      g.fillStyle = '#8C8A96'; g.font = '600 10px ' + cssv('--mono'); g.textAlign = 'center'; const lab = (t, a) => { const [x, y] = P(...a); g.fillText(t, x, y + 3); }; lab('|0⟩', [0, 0, 1.2]); lab('|1⟩', [0, 0, -1.22]); lab('x', [1.22, 0, 0]); lab('y', [0, 1.18, 0]); }
    const [x, y, z] = vec, L = Math.hypot(x, y, z); const [ex, ey] = P(x, y, z), [sx, sy] = P(x, y, 0);
    if (big && L > .05) { g.strokeStyle = 'rgba(89,46,255,.25)'; g.setLineDash([2, 2]); g.beginPath(); g.moveTo(cx, cy); g.lineTo(sx, sy); g.lineTo(ex, ey); g.stroke(); g.setLineDash([]); }
    g.strokeStyle = '#592EFF'; g.lineWidth = big ? 2.5 : 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(ex, ey); g.stroke();
    g.fillStyle = '#592EFF'; g.beginPath(); g.arc(ex, ey, big ? 5 : 3, 0, 2 * PI); g.fill();
    if (L < .98) { g.fillStyle = 'rgba(248,67,194,.9)'; g.beginPath(); g.arc(cx, cy, 2, 0, 2 * PI); g.fill(); }
  }
  function drawAmpGrid(c, re, im, D, coherent, rows, cols, opts = {}) {
    const g = ctxOf(c), s = Math.min((c._w - 4) / cols, (c._h - 4) / rows), ox = (c._w - s * cols) / 2, oy = (c._h - s * rows) / 2;
    for (let i = 0; i < D; i++) {
      const r = Math.floor(i / cols), k = i % cols, x = ox + k * s + s / 2, y = oy + r * s + s / 2, R = s / 2 - 1.5, a = Math.hypot(re[i], im[i]);
      g.fillStyle = '#FFFFFF'; g.strokeStyle = '#E0DCF2'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, R, 0, 2 * PI); g.fill(); g.stroke();
      if (a > 1e-6) { g.fillStyle = coherent ? 'rgba(89,46,255,.28)' : 'rgba(140,138,150,.3)'; g.beginPath(); g.arc(x, y, Math.max(1, R * Math.min(1, a)), 0, 2 * PI); g.fill();
        if (coherent) { const ph = Math.atan2(im[i], re[i]); g.strokeStyle = '#592EFF'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + R * Math.cos(ph), y - R * Math.sin(ph)); g.stroke(); } }
      if (opts.hi === i) { g.strokeStyle = '#592EFF'; g.lineWidth = 2; g.strokeRect(x - s / 2 + 1, y - s / 2 + 1, s - 2, s - 2); }
    }
    return { s, ox, oy };
  }
  function drawDensity(c, rho, D) {
    const re = new Float64Array(D * D), im = new Float64Array(D * D); for (let i = 0; i < D * D; i++) { re[i] = rho[2 * i]; im[i] = rho[2 * i + 1]; }
    drawAmpGrid(c, re, im, D * D, true, D, D);
  }
  function drawDist(c, arr) {
    const g = ctxOf(c), D = arr.length, bh = (c._h - 4) / D, W = c._w;
    for (let i = 0; i < D; i++) { const y = 2 + i * bh; g.fillStyle = '#F2F0FA'; g.fillRect(2, y + 1, W - 4, bh - 2); g.fillStyle = '#592EFF'; g.fillRect(2, y + 1, (W - 4) * arr[i], bh - 2); }
  }
  /* ---------------- layout ---------------- */
  function cellW(x) {
    if (!x) return 40; const k = x.k, sp = x.span || 1;
    if (k === 'AMPS') { const rows = 2 ** Math.ceil(sp / 2), cols = 2 ** Math.floor(sp / 2), s = Math.min(26, (sp * ROW - 12) / rows); return Math.max(40, cols * s + 8); }
    if (k === 'DENSITY') { const D = 2 ** sp, s = Math.min(22, (sp * ROW - 12) / D); return D * s + 8; }
    if (k === 'CHANCE') return sp === 1 ? 40 : 58;
    if (PARAM[k]) return Math.max(40, Math.min(132, 18 + 6.6 * pretty(x.p).length));
    if (['QFT', 'IQFT'].includes(k)) return 46;
    return 40;
  }
  const colWidth = col => Math.max(52, ...col.map(x => x ? cellW(x) + 14 : 0));
  /* ---------------- rendering ---------------- */
  function layout(el) {
    root = h('div', { class: 'wb' }); el.replaceChildren(root);
    const TB = h('div', { class: 'wb-top', role: 'toolbar', 'aria-label': 'Circuit tools' });
    E.name = h('input', { class: 'wb-name', 'aria-label': 'Circuit name', spellcheck: 'false', autocomplete: 'off' });
    E.name.addEventListener('change', () => { S.name = E.name.value.trim() || 'Untitled circuit'; persist(); topbar(); });
    const btn = (ic, label, on, opts = {}) => { const b = h('button', { type: 'button', class: 'wb-tb' + (opts.text ? ' txt' : ''), title: label, 'aria-label': label }, icon(ic), opts.text ? h('span', {}, opts.text) : null); b.addEventListener('click', on); return b; };
    E.qn = h('span', { class: 'wb-qn', 'aria-live': 'polite' });
    E.tplBtn = btn('list', 'Load an example circuit', () => tplMenu(E.tplBtn), { text: 'Examples' });
    E.play = btn('pause', 'Pause the clock (Space)', () => setPlaying(!playing));
    E.tRange = h('input', { type: 'range', min: 0, max: 1, step: .001, class: 'wb-t', 'aria-label': 'Clock t' }); E.tRange.addEventListener('input', () => { t = +E.tRange.value; setPlaying(false); kick(); });
    E.tVal = h('span', { class: 'wb-tval mono' });
    E.speed = h('select', { class: 'wb-sel', 'aria-label': 'Clock speed' }, [['0.25', '¼×'], ['0.5', '½×'], ['1', '1×'], ['2', '2×']].map(([v, l]) => h('option', { value: v, selected: v === '1' }, l))); E.speed.addEventListener('change', () => speed = +E.speed.value);
    E.clock = h('div', { class: 'wb-clock', title: 'The clock t runs from 0 to 1 and drives every gate or angle that uses t' }, E.play, h('span', { class: 'lbl-t' }, 't ='), E.tVal, E.tRange, E.speed);
    TB.append(h('div', { class: 'wb-left' }, h('span', { class: 'wb-mark' }, icon('lab')), E.name),
      h('span', { class: 'wb-sep' }),
      btn('minus', 'Remove the last qubit', () => setQubits(S.n - 1)), E.qn, btn('plus', 'Add a qubit', () => setQubits(S.n + 1)),
      h('span', { class: 'wb-sep' }), btn('undo', 'Undo (⌘Z)', doUndo), btn('redo', 'Redo (⌘⇧Z)', doRedo), btn('trash', 'Clear the circuit', () => { if (!S.cols.length) return; change(() => { S.cols = []; S.init = S.init.map(() => '0'); }, 'Circuit cleared'); toast('Circuit cleared.', () => doUndo()); }),
      h('span', { class: 'wb-sep' }), E.tplBtn, E.clock, h('span', { class: 'grow' }),
      h('a', { class: 'wb-tb txt', href: '#canvas', title: 'Open this circuit on the canvas view with its cards, optimiser and device panels' }, icon('grid'), h('span', {}, 'Canvas view')));
    // toolbox
    E.dock = h('div', { class: 'wb-dock', role: 'group', 'aria-label': 'Toolbox. Drag a gate onto a wire, or click it to add it to the selected wire. Scroll sideways for more.' });
    TOOLBOX.filter(([name]) => name !== 'Displays').forEach(([name, items]) => E.dock.append(h('div', { class: 'wb-grp' }, h('div', { class: 'wb-grp-h' }, name), h('div', { class: 'wb-tiles' }, items.map(([k, p]) => tile(k, p))))));
    E.dock.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { E.dock.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    // circuit card
    E.grid = h('div', { class: 'wb-grid' }); E.gridWrap = h('div', { class: 'wb-gridwrap' }, E.grid);
    E.lint = h('div', { class: 'wb-lint', 'aria-live': 'polite' });
    E.circ = h('section', { class: 'wb-card wb-circ', 'aria-label': 'Circuit' }, h('div', { class: 'wb-card-h' }, h('h3', {}, 'Circuit'), h('span', { class: 'wb-hint' }, 'Drag gates up from the toolbox · drag one off to delete · click the simulation block to inspect')), E.gridWrap, E.lint);
    // results
    E.hist = h('div', { class: 'wb-hist' }); E.histNote = h('p', { class: 'wb-note' });
    E.ampsC = h('div', { class: 'wb-amps' }); E.ampsNote = h('p', { class: 'wb-note' });
    E.qubits = h('div', { class: 'wb-qubits' });
    E.runBody = h('div', { class: 'wb-runs' });
    const card = (t, sub, ...kids) => h('section', { class: 'wb-card wb-simcard' }, h('div', { class: 'wb-card-h' }, h('h3', {}, t), sub ? h('span', { class: 'wb-hint' }, sub) : null), ...kids);
    E.results = h('div', { class: 'wb-results' },
      card('Probabilities', 'exact, from the final state', E.hist, E.histNote),
      card('Amplitudes', 'size is magnitude, line is phase', E.ampsC, E.ampsNote),
      card('Each qubit', 'Bloch vector at the end of the circuit', E.qubits),
      runCard(),
      h('section', { class: 'wb-card wb-simcard wb-cmpcard' }, h('div', { class: 'wb-card-h' }, h('h3', {}, 'Compare SDKs'), h('span', { class: 'wb-hint' }, 'run the same circuit on several backends and measure how far apart they are')), E.cmpHost = h('div', { class: 'wb-cmp' })));
    try { Compare.mount(E.cmpHost, () => boundCirc()); } catch (e) { E.cmpHost.append(h('p', { class: 'wb-note' }, 'Compare is unavailable: ' + e.message)); }
    E.main = h('div', { class: 'wb-main' }, E.circ);
    // code
    E.code = h('textarea', { spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', wrap: 'off', 'aria-label': 'Circuit code' });
    E.hl = h('pre', { 'aria-hidden': 'true' }); E.gut = h('div', { class: 'gut', 'aria-hidden': 'true' });
    E.codeMsg = h('p', { class: 'wb-codemsg', 'aria-live': 'polite' });
    E.langs = h('div', { class: 'wb-langs', role: 'tablist', 'aria-label': 'Language' }, [['qiskit', 'Qiskit'], ['cirq', 'Cirq'], ['pennylane', 'PennyLane'], ['qasm', 'OpenQASM 3']].map(([k, l]) => { const b = h('button', { type: 'button', role: 'tab', 'data-l': k, 'aria-selected': String(k === lang) }, l); b.addEventListener('click', () => { lang = k; Store.set('wbLang', k); E.langs.querySelectorAll('button').forEach(x => x.setAttribute('aria-selected', String(x.dataset.l === k))); renderCode(true); }); return b; }));
    const tabBtn = (k, ic, label) => { const b = h('button', { type: 'button', role: 'tab', 'data-side': k, 'aria-selected': 'false' }, icon(ic, 's'), label); b.addEventListener('click', () => setSide(k)); return b; };
    E.sideTabs = h('div', { class: 'wb-sidetabs', role: 'tablist', 'aria-label': 'Right panel' }, tabBtn('code', 'code', 'Code'), tabBtn('sim', 'sphere', 'Simulation'), E.tutorTab = tabBtn('tutor', 'tutor', 'Tutor'));
    E.tutorPane = h('div', { class: 'wb-tutorpane', role: 'tabpanel', 'aria-label': 'Tutor', hidden: true }); buildTutor();
    E.simPane = h('div', { class: 'wb-simpane', role: 'tabpanel', 'aria-label': 'Simulation' }, E.results);
    E.codePane = h('div', { class: 'wb-codepane', role: 'tabpanel', 'aria-label': 'Code' },
      h('div', { class: 'wb-code-h' }, h('span', { class: 'wb-live' }, h('i'), 'live'), h('span', { class: 'wb-hint' }, 'regenerates on every edit'), h('span', { class: 'grow' }),
        h('button', { type: 'button', class: 'btn bare', title: 'Copy code', onclick: () => copyText(E.code.value, 'Code copied.') }, icon('copy', 's')),
        h('button', { type: 'button', class: 'btn bare', title: 'Download', onclick: () => saveFile((S.name || 'circuit').replace(/\W+/g, '_').toLowerCase() + (lang === 'qasm' ? '.qasm' : '.py'), E.code.value) }, icon('download', 's'))),
      E.langs, h('div', { class: 'codebox wb-codebox' }, E.gut, E.hl, E.code), E.codeMsg);
    E.scriptPane = h('div', { class: 'wb-scriptpane', hidden: true });
    E.codeMode = h('div', { class: 'wb-codemode', role: 'tablist', 'aria-label': 'Code mode' }, [['circuit', 'Circuit code'], ['script', 'Python script']].map(([k, l]) => { const b = h('button', { type: 'button', role: 'tab', 'data-m': k, 'aria-selected': String(k === 'circuit') }, l); b.addEventListener('click', () => setCodeMode(k)); return b; }));
    E.codePane.prepend(E.codeMode); E.codePane.append(E.scriptPane);
    E.codeSide = h('aside', { class: 'wb-code', 'aria-label': 'Code, simulation and tutor' }, E.sideTabs, E.codePane, E.simPane, E.tutorPane);
    E.split = h('div', { class: 'wb-split', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Resize code panel', tabindex: 0 });
    root.append(TB, E.main, E.split, E.codeSide, E.dock);
    setSide(['sim', 'tutor'].includes(Store.get().wbSide) ? Store.get().wbSide : 'code', true);
    E.tip = h('div', { class: 'wb-tip', hidden: true, role: 'tooltip' }); document.body.append(E.tip);
    wireEvents();
  }
  let side = 'code', codeMode = 'circuit', scriptMounted = false;
  function setCodeMode(k) {
    codeMode = k; E.codeMode.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.m === k)));
    [...E.codePane.children].forEach(c => { if (c !== E.codeMode) c.hidden = k === 'script' ? c !== E.scriptPane : c === E.scriptPane; });
    if (k === 'script' && !scriptMounted) { scriptMounted = true; try { ScriptCards.mount(E.scriptPane); } catch (e) { E.scriptPane.replaceChildren(h('p', { class: 'wb-note' }, 'Script mode could not start: ' + e.message)); } }
    if (k === 'circuit') renderCode(true);
  }
  function setSide(k, quiet) {
    side = k; Store.set('wbSide', k);
    E.sideTabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.side === k)));
    E.codePane.hidden = k !== 'code'; E.simPane.hidden = k !== 'sim'; E.tutorPane.hidden = k !== 'tutor'; if (k === 'tutor') refreshTutor(true); root.classList.toggle('side-sim', k === 'sim');
    if (E.dblock) E.dblock.classList.toggle('on', k === 'sim');
    if (!quiet) { if (k === 'code') renderCode(true); smooth.forEach((v, key) => { if (key[0] === 'q') smooth.delete(key); }); kick(); announce(k === 'sim' ? 'Simulation panel open' : k === 'tutor' ? 'Tutor panel open' : 'Code panel open'); }
  }
  /* ---------------- Tutor tab: live explanation, mistake checks, ask the AI ---------------- */
  let tutorT = 0, tutorIssues = [];
  function tutorCirc() { const P = plan || compile(); const lab = o => { if (!o.meta || o.meta.gc < 0 || o.meta.anti) return o; const x = S.cols[o.meta.gc] && S.cols[o.meta.gc][o.meta.w[0]]; return x ? Object.assign({}, o, { meta: Object.assign({}, o.meta, { label: title(x.k) + (x.p ? '(' + pretty(x.p) + ')' : '') }) }) : o; }; return { n: S.n, nc: S.n, ops: P.ir.ops.map(lab), params: { t } }; }
  function buildTutor() {
    E.tIssues = h('div', { class: 'wb-tissues' }); E.tSteps = h('ol', { class: 'wb-tsteps' }); E.tChat = h('div', { class: 'wb-tchat' });
    E.tMode = h('button', { type: 'button', class: 'wb-tmode', onclick: () => { AI.setMode(AI.mode() === 'local' ? 'auto' : 'local'); paintMode(); } });
    const paintMode = () => { const can = AI.claude || AI.server.available; E.tMode.textContent = AI.provider() === 'local' ? (can ? `Use ${AI.claude ? 'Claude' : AI.server.provider === 'claude' ? 'Claude API' : 'Gemini'}` : 'AI: built-in') : 'Use built-in only'; E.tMode.title = AI.label(); E.tMode.disabled = AI.provider() === 'local' && !can && AI.mode() !== 'local'; };
    AI.onChange(paintMode); paintMode();
    E.tutorPane.append(
      h('section', { class: 'wb-tsec' }, h('div', { class: 'wb-tsh' }, icon('check', 's'), h('h4', {}, 'Checks'), h('span', { class: 'wb-hint' }, 'mistakes and simplifications, live')), E.tIssues),
      h('section', { class: 'wb-tsec' }, h('div', { class: 'wb-tsh' }, icon('play', 's'), h('h4', {}, 'What your circuit does'), h('span', { class: 'wb-hint' }, 'step by step, updates on every edit')), E.tSteps),
      h('section', { class: 'wb-tsec grow' }, E.tChat, h('div', { class: 'wb-tfoot' }, E.tMode)));
    E.chat = AIChat.mount(E.tChat, () => ({ circuit: tutorCirc(), where: 'lab', onIssue: fixIssue }), { compact: true, placeholder: 'Ask about this circuit…', suggestions: ['Explain my circuit step by step', 'Is anything wrong?', 'Is it entangled?', 'What is superposition?'] });
  }
  function fixIssue(i) {
    if (!i.cells) return; change(() => i.cells.forEach(c => { if (S.cols[c.gc]) S.cols[c.gc][c.w] = null; }), `${i.fix}: ${i.title}`);
    render(); toast(`${i.fix}. Undo with ⌘Z.`);
  }
  function hlCol(k) { E.grid.querySelectorAll('.wb-g.hl').forEach(g => g.classList.remove('hl')); if (k == null || k < 0) return; E.grid.querySelectorAll(`.wb-g[data-c="${k}"]`).forEach(g => g.classList.add('hl')); }
  function refreshTutor(now) {
    clearTimeout(tutorT);
    tutorT = setTimeout(() => {
      if (!E.tIssues) return; let C; try { C = tutorCirc(); } catch (e) { return; }
      let issues = []; try { issues = Insight.diagnose(C, { lab: true }); } catch (e) { }
      tutorIssues = issues; const warn = issues.filter(i => i.sev !== 'info').length;
      E.tutorTab.replaceChildren(icon('tutor', 's'), 'Tutor', issues.length ? h('span', { class: 'wb-tcount ' + (warn ? 'warn' : 'info'), 'aria-label': `${issues.length} notes` }, String(issues.length)) : '');
      if (side !== 'tutor') return;
      E.tIssues.replaceChildren(...(issues.length ? issues.slice(0, 6).map(i => h('div', { class: 'wb-issue ' + i.sev }, h('span', { class: 'wb-isev' }, i.sev === 'error' ? 'Error' : i.sev === 'warn' ? 'Check' : 'Tip'),
        h('div', {}, h('b', {}, i.title), h('p', {}, i.detail), h('div', { class: 'wb-iact' }, i.fix ? h('button', { type: 'button', class: 'wb-ibtn', onclick: () => fixIssue(i) }, i.fix) : null, h('button', { type: 'button', class: 'wb-ibtn ghost', onclick: () => E.chat.ask(`Why is this a problem: ${i.title}?`) }, 'Why?')))))
        : [h('p', { class: 'wb-ok' }, icon('check', 's'), 'No mistakes found.')]));
      let N = null; try { N = Insight.narrate(C); } catch (e) { }
      E.tSteps.replaceChildren(...(N ? N.steps.map(st => h('li', { class: (st.changed || st.label === 'Start' ? '' : 'quiet') + (st.key >= 0 ? ' wb-hlable' : ''), tabindex: st.key >= 0 ? 0 : null, onmouseenter: () => hlCol(st.key), onfocus: () => hlCol(st.key), onmouseleave: () => hlCol(null), onblur: () => hlCol(null), title: st.key >= 0 ? 'Highlights this step on the circuit' : null }, h('div', { class: 'wb-tsl' }, h('b', {}, st.label), st.gates.length ? h('span', { class: 'mono' }, st.gates.join(' · ')) : null),
        h('p', {}, st.lines.join(' ')), h('p', { class: 'wb-tstate mono' }, st.state))) : [h('li', {}, h('p', {}, 'Step-by-step explanations appear here.'))]));
      if (N && N.note) E.tSteps.append(h('li', {}, h('p', {}, N.note)));
    }, now ? 0 : 180);
  }
  function runCard() {
    E.backend = h('select', { class: 'wb-sel', 'aria-label': 'Backend' });
    E.noise = h('select', { class: 'wb-sel', 'aria-label': 'Noise (browser engine)', title: 'Noise for the browser engine. SDK backends use their own device noise.' }, [['off', 'Ideal'], ['light', 'Light noise'], ['device', 'Device-like noise'], ['heavy', 'Heavy noise']].map(([v, l]) => h('option', { value: v, selected: v === (Store.get().wbNoise || 'off') }, l)));
    E.noise.addEventListener('change', () => Store.set('wbNoise', E.noise.value));
    E.shots = h('select', { class: 'wb-sel', 'aria-label': 'Shots' }, ['100', '1000', '4000', '10000'].map(v => h('option', { value: v, selected: v === '1000' }, v + ' shots')));
    E.runBtn = h('button', { type: 'button', class: 'btn primary' }, icon('play', 's'), 'Run');
    E.runBtn.addEventListener('click', () => runShots());
    E.rdot = h('span', { class: 'wb-rdot', title: 'Runner status' }); E.rtxt = h('span', { class: 'wb-rtxt' }, 'checking runner…');
    fillBackends(null);
    return h('section', { class: 'wb-card wb-runcard' }, h('div', { class: 'wb-card-h' }, h('h3', {}, 'Measure'), h('span', { class: 'wb-hint' }, 'sample shots on the browser engine or a real SDK through the runner')),
      h('div', { class: 'row wb-runrow' }, E.backend, E.noise, E.shots, E.runBtn, h('span', { class: 'wb-rstat' }, E.rdot, E.rtxt)), E.runBody);
  }
  const RUNNER = () => Runner.url();
  const DEFAULT_BACKENDS = [['browser', 'QUBIQ browser engine'], ['aer.statevector', 'Qiskit Aer · statevector'], ['aer.fake_sherbrooke', 'Qiskit Aer · FakeSherbrooke noise'], ['cirq.simulator', 'Cirq · Simulator'], ['pennylane.default.qubit', 'PennyLane · default.qubit'], ['pennylane.lightning.qubit', 'PennyLane · lightning.qubit'], ['qbraid.cirq', 'qBraid → Cirq']];
  function fillBackends(list) {
    const cur = E.backend.value || 'browser';
    const items = list ? [['browser', 'QUBIQ browser engine'], ...list.filter(b => b.available).map(b => [b.id, `${b.sdk} · ${String(b.method || b.id).length > 34 ? b.id : b.method}`])] : DEFAULT_BACKENDS;
    const offline = !list;
    E.backend.replaceChildren(h('optgroup', { label: 'In this page' }, h('option', { value: 'browser' }, items[0][1])), h('optgroup', { label: list ? 'Runner (online)' : 'Runner (needs a local runner)' }, items.slice(1).map(([v, l]) => {
      const o = h('option', { value: v }, l);
      if (offline) { o.disabled = true; o.title = 'Offline — start the runner'; }
      return o;
    })));
    E.backend.value = items.some(([v]) => v === cur) ? cur : 'browser';
    if (offline && E.backend.value !== 'browser') E.backend.value = 'browser';
  }
  async function checkRunner() {
    try { const list = await Runner.backends(); fillBackends(list); E.rdot.className = 'wb-rdot on'; E.rtxt.textContent = 'runner online'; E.rdot.title = 'Runner online at ' + RUNNER(); if (window.App && App.setRunnerStatus) App.setRunnerStatus(true); return true; }
    catch (e) { fillBackends(null); E.rdot.className = 'wb-rdot off'; E.rtxt.textContent = 'runner offline'; E.rdot.title = 'Runner offline at ' + RUNNER(); if (window.App && App.setRunnerStatus) App.setRunnerStatus(false); return false; }
  }
  function tile(k, p) {
    const x = cell(k, p), b = h('button', { type: 'button', class: `wb-tile f-${fam(k)}`, 'data-k': k, 'aria-label': `${title(k)}${p ? ' ' + pretty(p) : ''}. Drag onto a wire.` });
    b.append(gateFace(x, true)); b._cell = x;
    b.addEventListener('pointerdown', e => startDrag(e, x, null, b));
    b.addEventListener('mouseenter', () => showTip(b, x)); b.addEventListener('mouseleave', hideTip); b.addEventListener('focus', () => showTip(b, x)); b.addEventListener('blur', hideTip);
    b.addEventListener('click', () => { if (Drag.just) return; addToWire(JSON.parse(JSON.stringify(x))); });
    return b;
  }
  function gateFace(x, small) {
    const k = x.k, f = h('span', { class: 'gf' });
    if (k === 'CTRL') { f.append(h('span', { class: 'dot' })); return f; }
    if (k === 'ACTRL') { f.append(h('span', { class: 'dot hollow' })); return f; }
    if (k === 'MEASURE') { const s = svg('svg', { viewBox: '0 0 24 24', class: 'meter' }); svg('path', { d: 'M4 17a8 8 0 0 1 16 0', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8 }, s); svg('path', { d: 'M12 17l5-7', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round' }, s); f.append(s); return f; }
    if (k === 'SWAP') { f.append(h('span', { class: 'big' }, '×')); return f; }
    if (DISPLAY[k] && small) { f.append(h('span', { class: 'disp-ic ' + k.toLowerCase() }, { BLOCH: 'Bloch', CHANCE: '%', AMPS: 'Amps', DENSITY: 'ρ' }[k])); return f; }
    if (POW[k]) { const [ax, e] = POW[k]; f.append(h('span', { class: 'pw' }, ax, h('sup', {}, e.replace('1/2', '½').replace('1/4', '¼')))); return f; }
    if (PARAM[k]) { f.append(h('span', { class: 'pn' }, { RX: 'Rx', RY: 'Ry', RZ: 'Rz', P: 'P', RZZ: 'ZZ', RXX: 'XX', RYY: 'YY' }[k]), h('span', { class: 'pe' }, small && pretty(x.p).length > 6 ? 'f(t)' : pretty(x.p))); if (usesT(x.p)) f.classList.add('tdep'); return f; }
    const lab = { SDG: 'S†', TDG: 'T†', SX: '√X', SXDG: '√X†', ISWAP: 'iSW', QFT: 'QFT', IQFT: 'QFT†', INC: '+1', DEC: '−1', REV: 'Rev' }[k] || k;
    f.append(h('span', { class: lab.length > 2 ? 'mid' : 'big' }, lab)); return f;
  }
  function matrixText(k) {
    const G = Sim.G[k]; if (!G || !G.m) return null; const M = G.m([]), f = ([r, i]) => { const R = Math.abs(r) < 1e-9 ? 0 : r, I = Math.abs(i) < 1e-9 ? 0 : i, n = v => { const a = Math.abs(v); return (Math.abs(a - Math.SQRT1_2) < 1e-9 ? '√½' : Math.abs(a - .5) < 1e-9 ? '½' : +a.toFixed(3) + ''); }; if (!I) return (R < 0 ? '−' : '') + n(R); if (!R) return (I < 0 ? '−' : '') + (Math.abs(I) === 1 ? '' : n(I)) + 'i'; return `${R < 0 ? '−' : ''}${n(R)}${I < 0 ? '−' : '+'}${n(I)}i`; };
    return [[f(M[0]), f(M[1])], [f(M[2]), f(M[3])]];
  }
  function showTip(anchor, x, extra) {
    const k = x.k, m = matrixText(k) || (POW[k] ? null : null), r = anchor.getBoundingClientRect();
    E.tip.replaceChildren(h('b', {}, title(k) + (x.p ? ` = ${pretty(x.p)}` : '')), h('p', {}, extra || DESC[k] || (POW[k] ? `${POW[k][0]} raised to the power ${POW[k][1]}${POW[k][1].includes('t') ? ': it turns continuously as the clock t runs' : ''}.` : '')),
      m ? h('div', { class: 'wb-mat mono' }, h('span', {}, m[0][0]), h('span', {}, m[0][1]), h('span', {}, m[1][0]), h('span', {}, m[1][1])) : null);
    E.tip.hidden = false; const tw = E.tip.offsetWidth, th = E.tip.offsetHeight;
    let left = Math.min(innerWidth - tw - 8, Math.max(8, r.left + r.width / 2 - tw / 2)), top = r.bottom + 8; if (top + th > innerHeight - 8) top = r.top - th - 8;
    E.tip.style.left = left + 'px'; E.tip.style.top = top + 'px';
  }
  const hideTip = () => { if (E.tip) E.tip.hidden = true; };
  /* ---------------- the grid ---------------- */
  let colX = [], colW = [], nCols = 0;
  function render() {
    if (!root) return;
    E.name.value = S.name || 'Untitled circuit'; E.qn.textContent = `${S.n} qubit${S.n > 1 ? 's' : ''}`; topbar();
    if (dirty) plan = null; DCAN.clear();
    const n = S.n, cols = S.cols.slice(); const extra = 1; nCols = cols.length + extra;
    colW = []; colX = []; let x = GUT; for (let i = 0; i < nCols; i++) { const w = i < cols.length ? colWidth(cols[i]) : 52; colX.push(x); colW.push(w); x += w; }
    const ampOn = n <= 6, aRows = 2 ** Math.ceil(n / 2), aCols = 2 ** Math.floor(n / 2), aS = Math.min(22, Math.max(9, (n * ROW - 30) / aRows)), ampW = ampOn ? aCols * aS + 4 : 0;
    const BX = x + 10, BW = 118 + (ampOn ? ampW + 16 : 0);
    const Wd = BX + BW + 20, Ht = n * ROW + 8 + (n < MAXQ ? 40 : 0); E.grid.style.width = Wd + 'px'; E.grid.style.height = Ht + 'px';
    const P = compileQuick(); E.grid.replaceChildren();
    const lines = svg('svg', { class: 'wb-lines', width: Wd, height: Ht });
    for (let w = 0; w < n; w++) {
      const y = w * ROW + ROW / 2 + 4, mAt = P.measured.get(w), xm = mAt != null ? colX[mAt] + colW[mAt] / 2 : null;
      svg('line', { x1: GUT - 8, y1: y, x2: xm ?? BX, y2: y, class: 'wire' }, lines);
      if (xm != null) { svg('line', { x1: xm, y1: y - 2, x2: BX, y2: y - 2, class: 'wire cl' }, lines); svg('line', { x1: xm, y1: y + 2, x2: BX, y2: y + 2, class: 'wire cl' }, lines); }
    }
    cols.forEach((col, c) => {
      const own = owners(col), cx = colX[c] + colW[c] / 2, ctrls = col.map((y, w) => y && (y.k === 'CTRL' || y.k === 'ACTRL') ? w : -1).filter(w => w >= 0);
      const targets = col.map((y, w) => y && !DISPLAY[y.k] && y.k !== 'CTRL' && y.k !== 'ACTRL' && y.k !== 'MEASURE' ? w : -1).filter(w => w >= 0);
      const involved = [...ctrls, ...targets.flatMap(w => [w, w + (col[w].span || 1) - 1])];
      const swaps = col.map((y, w) => y && y.k === 'SWAP' ? w : -1).filter(w => w >= 0);
      if ((ctrls.length && targets.length) || swaps.length === 2) { const lo = Math.min(...involved), hi = Math.max(...involved); svg('line', { x1: cx, y1: lo * ROW + ROW / 2 + 4, x2: cx, y2: hi * ROW + ROW / 2 + 4, class: 'ctl' + (ctrls.some(w => P.measured.has(w) && P.measured.get(w) < c) ? ' cl' : '') }, lines); }
      col.forEach((y, w) => { if (y) E.grid.append(gateEl(y, c, w, cx, !!ctrls.length, P)); });
      own.forEach((o, w) => { });
    });
    E.grid.prepend(lines);
    // column shading + wire labels + outputs
    for (let w = 0; w < n; w++) {
      const y = w * ROW + 4;
      const init = h('button', { type: 'button', class: 'wb-init', title: 'Initial state. Click to cycle |0⟩ |1⟩ |+⟩ |−⟩ |i⟩ |−i⟩', 'aria-label': `Qubit ${w} starts in ${ketLabel(S.init[w])}. Click to change.` }, ketLabel(S.init[w]));
      init.addEventListener('click', () => change(() => { const seq = ['0', '1', '+', '-', 'i', '-i']; S.init[w] = seq[(seq.indexOf(S.init[w]) + 1) % seq.length]; }, `Qubit ${w} starts in ${ketLabel(S.init[w])}`));
      const del = h('button', { type: 'button', class: 'wb-delq', title: `Remove qubit ${w}`, 'aria-label': `Remove qubit ${w}` }, icon('x', 's')); del.addEventListener('click', () => removeWire(w));
      E.grid.append(h('div', { class: 'wb-wl', style: { top: y + 'px', height: ROW + 'px' } }, h('span', { class: 'wb-qname mono' }, 'q' + w), init, n > 1 ? del : null));
    }
    // the simulation block: follows the last gate, never dragged; click it to open the Simulation panel
    E.dblock = h('button', { type: 'button', class: 'wb-dblock' + (side === 'sim' ? ' on' : ''), style: { left: BX + 'px', top: '6px', width: BW + 'px', height: (n * ROW - 4) + 'px' }, title: 'Open the simulation panel', 'aria-label': 'Live simulation of the circuit. Open the simulation panel.' });
    const rowsEl = h('div', { class: 'wb-drows' });
    for (let w = 0; w < n; w++) rowsEl.append(h('div', { class: 'wb-drow', style: { height: ROW + 'px' } }, E['bo' + w] = cv(38, 38, 'wb-mini'), h('div', { class: 'wb-pc' }, E['pv' + w] = h('b', { class: 'mono' }, '–'), h('span', { class: 'wb-pbar' }, E['pb' + w] = h('i')))));
    E.dblock.append(rowsEl);
    E.bAmps = null; if (ampOn) { E.bAmps = cv(ampW, aRows * aS + 4, 'wb-damps'); E.bAmps._rows = aRows; E.bAmps._cols = aCols; E.dblock.append(E.bAmps); }
    E.dblock.append(h('span', { class: 'wb-dtag' }, icon('sphere', 's'), side === 'sim' ? 'Showing' : 'Open'));
    E.dblock.addEventListener('click', () => { if (Drag.just) return; setSide(side === 'sim' ? 'code' : 'sim'); render(); });
    E.grid.append(E.dblock);
    if (n < MAXQ) { const add = h('button', { type: 'button', class: 'wb-addq', style: { top: (n * ROW + 8) + 'px' }, title: 'Add a qubit' }, icon('plus', 's'), 'qubit'); add.addEventListener('click', () => setQubits(S.n + 1)); E.grid.append(add); }
    E.grid.append(E.drop = h('div', { class: 'wb-drop', hidden: true }), E.ins = h('div', { class: 'wb-ins', hidden: true }));
    buildResults(); kick();
  }
  function compileQuick() { if (!plan || dirty) { plan = compile(); dirty = false; renderCode(); paintLint(); } return plan; }
  const ketLabel = v => ({ '0': '|0⟩', '1': '|1⟩', '+': '|+⟩', '-': '|−⟩', 'i': '|i⟩', '-i': '|−i⟩' }[v]);
  function gateEl(x, c, w, cx, hasCtl, P) {
    const span = x.span || 1, cw = cellW(x), top = w * ROW + 4 + 8, hgt = span * ROW - 16, err = P.errors.get(`${c}:${w}`);
    const k = x.k, isX = k === 'X' && hasCtl;
    const cls = ['wb-g', 'f-' + fam(k), DISPLAY[k] ? 'disp' : '', k === 'CTRL' || k === 'ACTRL' ? 'ctrl' : '', k === 'SWAP' ? 'swap' : '', isX ? 'oplus' : '', err ? 'err' : '', sel && sel.c === c && sel.w === w ? 'sel' : ''].filter(Boolean).join(' ');
    const el = h('div', { class: cls, tabindex: 0, role: 'button', 'aria-label': `${title(k)}${x.p ? ' ' + pretty(x.p) : ''} on q${w}${span > 1 ? '–q' + (w + span - 1) : ''}, column ${c + 1}${err ? '. Problem: ' + err : ''}`, style: { left: (cx - cw / 2) + 'px', top: top + 'px', width: cw + 'px', height: hgt + 'px' } });
    el.dataset.c = c; el.dataset.w = w;
    if (isX) el.append(h('span', { class: 'oplus-c' }));
    else if (DISPLAY[k]) el.append(displayEl(x, c, w, cw, hgt));
    else el.append(gateFace(x));
    if (err) el.append(h('span', { class: 'wb-errtag' }, '!'));
    if (SPAN[k] && SPAN[k][0] !== SPAN[k][1]) { const hd = h('span', { class: 'wb-handle', title: 'Drag to cover more or fewer wires', 'aria-hidden': 'true' }); hd.addEventListener('pointerdown', e => { e.stopPropagation(); resizeDrag(e, c, w); }); el.append(hd); }
    el.addEventListener('pointerdown', e => { if (e.button > 0) return; startDrag(e, x, { c, w }, el); });
    el.addEventListener('click', () => { if (Drag.just) return; select(c, w, el); });
    el.addEventListener('keydown', e => { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteAt(c, w); } else if (e.key === 'Enter') select(c, w, el); });
    el.addEventListener('mouseenter', () => { hoverCell = { c, w }; litCode(); if (err) showTip(el, x, err); });
    el.addEventListener('mouseleave', () => { hoverCell = null; litCode(); hideTip(); });
    return el;
  }
  const DCAN = new Map();
  function displayEl(x, c, w, cw, hgt) {
    const k = x.k, key = `${c}:${w}`, span = x.span || 1; let can;
    if (k === 'BLOCH') can = cv(Math.min(cw, hgt), Math.min(cw, hgt));
    else if (k === 'CHANCE' && span === 1) { const fill = h('i'), txt = h('b', { class: 'mono' }); const wrap = h('span', { class: 'wb-ch1' }, fill, txt); DCAN.set(key, { k, span, fill, txt }); return wrap; }
    else if (k === 'CHANCE') can = cv(cw - 8, hgt - 8);
    else can = cv(cw - 6, hgt - 6);
    const rec = { k, span, can }; DCAN.set(key, rec);
    if (k === 'AMPS') can.addEventListener('mousemove', ev => ampHover(ev, rec, key)), can.addEventListener('mouseleave', () => { rec.hi = null; hideTip(); });
    return can;
  }
  function ampHover(ev, rec, key) {
    const d = frame && frame.disp.get(key); if (!d) return; const D = d.D, rows = 2 ** Math.ceil(rec.span / 2), cols = 2 ** Math.floor(rec.span / 2), r = rec.can.getBoundingClientRect();
    const s = Math.min((rec.can._w - 4) / cols, (rec.can._h - 4) / rows), ox = (rec.can._w - s * cols) / 2, oy = (rec.can._h - s * rows) / 2;
    const i = Math.floor((ev.clientY - r.top - oy) / s) * cols + Math.floor((ev.clientX - r.left - ox) / s); if (i < 0 || i >= D) return; rec.hi = i;
    const bits = i.toString(2).padStart(rec.span, '0'), a = [d.re[i], d.im[i]];
    showTip(rec.can, { k: 'AMPS' }, d.coherent ? `|${bits}⟩  amplitude ${fmtC(a)} · chance ${(100 * (a[0] ** 2 + a[1] ** 2)).toFixed(1)}% · phase ${Math.round(Math.atan2(a[1], a[0]) * 180 / PI)}°` : `|${bits}⟩  chance ${(100 * a[0] ** 2).toFixed(1)}%. These wires are entangled with others, so they have no amplitudes of their own.`);
  }
  const fmtC = ([r, i]) => `${r.toFixed(3)}${i < 0 ? ' − ' : ' + '}${Math.abs(i).toFixed(3)}i`;
  /* ---------------- per-frame painting ---------------- */
  const smooth = new Map();
  function lerpVec(key, v) { const cur = smooth.get(key); if (!cur) { smooth.set(key, v.slice()); return { v, moving: false }; } let mv = false; for (let i = 0; i < 3; i++) { const d = v[i] - cur[i]; if (Math.abs(d) > 1e-3) mv = true; cur[i] += d * (playing && plan && plan.timeDep ? .55 : .22); } return { v: cur, moving: mv }; }
  function paint() {
    let moving = false; if (!frame) return false;
    DCAN.forEach((rec, key) => {
      const d = frame.disp.get(key); if (!d) return;
      if (rec.k === 'BLOCH') { const r = lerpVec('d' + key, d.bloch); moving = moving || r.moving; drawBloch(rec.can, r.v, false); }
      else if (rec.k === 'CHANCE' && rec.span === 1) { rec.fill.style.height = (d.p1 * 100).toFixed(1) + '%'; rec.txt.textContent = Math.round(d.p1 * 100) + '%'; }
      else if (rec.k === 'CHANCE') drawDist(rec.can, d.dist);
      else if (rec.k === 'AMPS') drawAmpGrid(rec.can, d.re, d.im, d.D, d.coherent, 2 ** Math.ceil(rec.span / 2), 2 ** Math.floor(rec.span / 2), { hi: rec.hi });
      else if (rec.k === 'DENSITY') drawDensity(rec.can, d.rho, d.D);
    });
    frame.wires.forEach((wv, w) => {
      const c = E['bo' + w]; if (!c) return; const r = lerpVec('o' + w, wv.bloch); moving = moving || r.moving; drawBloch(c, r.v, false);
      E['pv' + w].textContent = (wv.p1 * 100).toFixed(wv.p1 > .001 && wv.p1 < .999 ? 1 : 0) + '%'; E['pb' + w].style.width = (wv.p1 * 100) + '%';
    });
    if (E.bAmps) drawAmpGrid(E.bAmps, frame.s.re, frame.s.im, 2 ** S.n, true, E.bAmps._rows, E.bAmps._cols);
    if (side === 'sim') { paintResults(); moving = paintQubits() || moving; }
    E.tVal.textContent = t.toFixed(2); if (!E.tRange.matches(':active')) E.tRange.value = t;
    return moving;
  }
  function kick() { if (!raf) { lastTs = 0; raf = requestAnimationFrame(tick); } }
  function visible() { return root && root.isConnected && !root.closest('.view').hidden; }
  function tick(ts) {
    raf = null; if (!visible()) return;
    const dt = lastTs ? Math.min(.05, (ts - lastTs) / 1000) : 0; lastTs = ts;
    const td = plan ? plan.timeDep : true;
    if (playing && td) t = (t + dt * speed / 4) % 1;
    simulate(); E.clock.classList.toggle('idle', !plan.timeDep); root.classList.toggle('live', playing && plan.timeDep);
    const moving = paint();
    if ((playing && plan.timeDep) || moving) raf = requestAnimationFrame(tick);
  }
  function setPlaying(p) { playing = p; E.play.replaceChildren(icon(p ? 'pause' : 'play')); E.play.title = p ? 'Pause the clock (Space)' : 'Run the clock (Space)'; E.play.setAttribute('aria-label', E.play.title); if (p) kick(); }
  /* ---------------- results cards ---------------- */
  let histBars = [], ampsCan = null, qCans = [];
  function buildResults() {
    const n = S.n; histBars = [];
    E.hist.replaceChildren(); E.hist.classList.toggle('dense', n > 4);
    if (n <= 6) { for (let i = 0; i < 2 ** n; i++) { const bar = h('i'), val = h('span', { class: 'v' }), lab = h('span', { class: 'k mono' }, i.toString(2).padStart(n, '0')); const col = h('div', { class: 'hb' }, val, h('span', { class: 'track' }, bar), lab); histBars.push({ bar, val, col, i }); E.hist.append(col); } }
    E.ampsC.replaceChildren(); ampsCan = null;
    if (n <= 8) { const cols = 2 ** Math.ceil(n / 2), rows = 2 ** Math.floor(n / 2), s = Math.min(44, Math.max(16, 380 / cols)); ampsCan = cv(cols * s + 4, rows * s + 4, 'wb-ampbig'); ampsCan._rows = rows; ampsCan._cols = cols; E.ampsC.append(ampsCan); ampsCan.addEventListener('mousemove', ev => { const r = ampsCan.getBoundingClientRect(), g = drawAmpGrid(ampsCan, frame.s.re, frame.s.im, 2 ** n, true, rows, cols), i = Math.floor((ev.clientY - r.top - g.oy) / g.s) * cols + Math.floor((ev.clientX - r.left - g.ox) / g.s); if (i >= 0 && i < 2 ** n) { const a = [frame.s.re[i], frame.s.im[i]]; showTip(ampsCan, { k: 'AMPS' }, `|${i.toString(2).padStart(n, '0')}⟩  ${fmtC(a)} · ${(100 * (a[0] ** 2 + a[1] ** 2)).toFixed(1)}% · phase ${Math.round(Math.atan2(a[1], a[0]) * 180 / PI)}°`); } }); ampsCan.addEventListener('mouseleave', hideTip); E.ampsNote.textContent = `Rows and columns count up in binary: |${'0'.repeat(n)}⟩ top left, reading left to right. Hover a cell for its value.`; }
    else E.ampsNote.textContent = `${2 ** n} amplitudes are too many to draw. Put an amplitude display on up to five wires instead.`;
    E.qubits.replaceChildren(); qCans = [];
    for (let q = 0; q < n; q++) { const c = cv(n > 6 ? 76 : 96, n > 6 ? 76 : 96), p = h('b', { class: 'mono' }), pur = h('span', { class: 'badge' }); qCans.push({ c, p, pur }); E.qubits.append(h('div', { class: 'wb-q' }, h('span', { class: 'wb-qlab mono' }, 'q' + q), c, h('div', { class: 'wb-qmeta' }, p, pur))); }
  }
  function paintResults() {
    const n = S.n, P = frame.probs;
    if (n <= 6) { let mx = 0; for (let i = 0; i < P.length; i++) mx = Math.max(mx, P[i]); histBars.forEach(b => { const p = P[b.i]; b.bar.style.height = (p * 100) + '%'; b.val.textContent = p > .0005 ? (p * 100).toFixed(p > .1 ? 0 : 1) + '%' : ''; b.col.classList.toggle('hot', p > 1e-9 && p >= mx - 1e-9); }); E.histNote.textContent = `Percent chance of each outcome. q0 is the leftmost bit.`; }
    else {
      const top = []; for (let i = 0; i < P.length; i++) if (P[i] > 1e-9) top.push([i, P[i]]); top.sort((a, b) => b[1] - a[1]);
      const show = top.slice(0, 24); E.hist.replaceChildren(...show.map(([i, p]) => h('div', { class: 'hb' }, h('span', { class: 'v' }, (p * 100).toFixed(1)), h('span', { class: 'track' }, h('i', { style: { height: p / show[0][1] * 100 + '%' } })), h('span', { class: 'k mono' }, i.toString(2).padStart(n, '0')))));
      E.histNote.textContent = `${top.length} outcomes are possible; showing the ${show.length} most likely (bars scaled to the largest).`;
    }
    if (ampsCan) drawAmpGrid(ampsCan, frame.s.re, frame.s.im, 2 ** n, true, ampsCan._rows, ampsCan._cols);
  }
  function paintQubits() {
    let moving = false;
    frame.wires.forEach((wv, q) => { const Q = qCans[q]; if (!Q) return; const r = lerpVec('q' + q, wv.bloch); moving = moving || r.moving; drawBloch(Q.c, r.v, true); Q.p.textContent = `P(1) ${(wv.p1 * 100).toFixed(1)}%`;
      const ent = wv.purity < .995; Q.pur.textContent = S.n === 1 ? 'pure' : S.n > 12 ? '' : ent ? `entangled · purity ${wv.purity.toFixed(2)}` : 'not entangled'; Q.pur.className = 'badge ' + (ent ? 'b-magenta' : 'b-ink'); Q.pur.hidden = !Q.pur.textContent; });
    return moving;
  }
  /* ---------------- shots: browser engine or runner ---------------- */
  function measuredWires() { const m = [...compileQuick().measured.keys()].sort((a, b) => a - b); return m.length ? m : [...Array(S.n).keys()]; }
  function exactDist(qs) { const m = Sim.marginal(frame.probs, S.n, qs); return m; }
  const NOISE = { light: { p1: 0.001, p2: 0.01, readout: 0.01 }, device: { p1: 0.003, p2: 0.02, readout: 0.02 }, heavy: { p1: 0.02, p2: 0.06, readout: 0.05 } };
  function boundCirc() { const P = plan || compile(); return { n: S.n, nc: S.n, name: S.name, ops: P.ir.ops.map(o => Object.assign({}, o, { p: (o.p || []).map(v => typeof v === 'number' ? v : evalE(v, t)) })), params: { t } }; }
  async function runShots() {
    simulate(); const be = E.backend.value, shots = +E.shots.value, qs = measuredWires(), seed = Math.floor(Math.random() * 1e6);
    const exact = exactDist(qs);
    if (be === 'browser' && E.noise.value !== 'off') {
      const nz = NOISE[E.noise.value], C = boundCirc();
      let r; try { r = Sim.sample(C, shots, { seed, noise: nz }); } catch (e) { runError('Noisy simulation failed: ' + e.message); return; }
      const keyQs = r.keys || qs, ex = exactDist(keyQs);
      addRun({ counts: r.counts, shots, prov: { sdk: 'QUBIQ browser engine', where: 'browser', seed, shots, method: `${r.method || 'density matrix'} · ${E.noise.selectedOptions[0].textContent.toLowerCase()} (1q ${nz.p1 * 100}%, 2q ${nz.p2 * 100}%, readout ${nz.readout * 100}%)`, t: plan.timeDep ? +t.toFixed(3) : null }, exact: ex, qs: keyQs }); return;
    }
    if (be === 'browser') {
      const rng = Sim.mulberry(seed), keys = Object.keys(exact), cum = []; let acc = 0; keys.forEach(k => { acc += exact[k]; cum.push(acc); });
      const counts = {}; for (let i = 0; i < shots; i++) { const r = rng() * acc; let j = cum.findIndex(c => r <= c); if (j < 0) j = keys.length - 1; counts[keys[j]] = (counts[keys[j]] || 0) + 1; }
      addRun({ counts, shots, prov: { sdk: 'QUBIQ browser engine', where: 'browser', seed, shots, method: 'statevector sampling', t: plan.timeDep ? +t.toFixed(3) : null }, exact, qs }); return;
    }
    const ir = { version: 'qlab-ir/1', name: S.name, n: S.n, nc: S.n, ops: plan.ir.ops.map(o => { const r = { g: o.g, q: o.q, col: o.col }; if (o.c.length) r.c = o.c; if (o.p.length) r.p = o.p.map(v => typeof v === 'number' ? v : String(v)); if (o.g === 'M') r.cb = o.cb; return r; }) };
    E.runBtn.disabled = true; const pend = h('div', { class: 'wb-run pending' }, h('span', { class: 'spin' }), `Running on ${E.backend.selectedOptions[0].textContent}…`); E.runBody.prepend(pend);
    try {
      const j = await Runner.run({ ir, backend: be, shots, seed, options: { bind: { t } } }, { timeout: 60000 });
      pend.remove(); E.rdot.className = 'wb-rdot on';
      addRun({ counts: j.counts, shots, prov: j.provenance, exact: exactDist(j.keys || qs), qs: j.keys || qs });
    } catch (e) {
      pend.remove();
      if (e && e.status) { runError(`The runner refused this circuit: ${e.message || ('HTTP ' + e.status)}`); }
      else { E.rdot.className = 'wb-rdot off'; if (window.App && App.setRunnerStatus) App.setRunnerStatus(false); runOffline(); }
    }
    finally { E.runBtn.disabled = false; }
  }
  function runOffline() {
    const cmd = 'QLAB_SANDBOX=local uvicorn qlab_runner.app:app --port 8765  # or: docker compose up runner';
    const url = h('input', { class: 'uline mono', value: RUNNER(), 'aria-label': 'Runner address' }); url.addEventListener('change', () => { Runner.setUrl(url.value.trim()); checkRunner(); });
    E.runBody.prepend(h('div', { class: 'wb-run off' }, h('b', {}, 'Offline — start the runner'), h('p', {}, 'Nothing ran. SDK backends need the QUBIQ runner; results are never faked with the browser engine. Start it, then run again:'),
      h('div', { class: 'row' }, h('code', { class: 'mono' }, cmd), h('button', { type: 'button', class: 'btn bare', onclick: () => copyText(cmd, 'Command copied.') }, icon('copy', 's'))), h('label', { class: 'small' }, 'Runner address ', url),
      h('p', { class: 'small' }, h('button', { type: 'button', class: 'btn bare', onclick: () => { checkRunner(); } }, 'Test connection'))));
  }
  function runError(msg) { E.runBody.prepend(h('div', { class: 'wb-run off' }, h('b', {}, 'Run failed'), h('p', {}, msg))); }
  function addRun(R) {
    runs.unshift(R); runs = runs.slice(0, 4);
    const keys = [...new Set([...Object.keys(R.exact), ...Object.keys(R.counts)])].sort(), tot = Object.values(R.counts).reduce((a, b) => a + b, 0) || 1;
    let tvd = 0; keys.forEach(k => tvd += Math.abs((R.counts[k] || 0) / tot - (R.exact[k] || 0))); tvd /= 2;
    const pv = R.prov || {};
    const mx = Math.max(...keys.map(k => R.counts[k] || 0), 1), shown = keys.length > 32 ? keys.filter(k => R.counts[k]).sort((a, b) => R.counts[b] - R.counts[a]).slice(0, 32) : keys;
    const el = h('div', { class: 'wb-run' }, Runner.provenanceBadge(Object.assign({ shots: R.shots }, pv)),
      h('div', { class: 'wb-counts' }, shown.map(k => h('div', { class: 'hb' }, h('span', { class: 'v' }, String(R.counts[k] || 0)), h('span', { class: 'track' }, h('i', { style: { height: ((R.counts[k] || 0) / mx * 100) + '%' } }), h('em', { style: { bottom: ((R.exact[k] || 0) * tot / mx * 100) + '%' } })), h('span', { class: 'k mono' }, k)))),
      h('p', { class: 'wb-note' }, `Measured q${R.qs.join(', q')} · distance from the exact distribution (TVD) ${tvd.toFixed(3)}. The tick on each bar is the ideal, noise-free expectation.${/noise/.test(pv.method || '') ? ' Simulated with ' + pv.method.split(' · ').slice(1).join(' · ') + '.' : ''}`));
    E.runBody.prepend(el); while (E.runBody.children.length > 4) E.runBody.lastChild.remove();
  }
  /* ---------------- code panel ---------------- */
  let codeMap = [], lineOf = new Map();
  function renderCode(force) {
    if (!E.code) return; if (document.activeElement === E.code && !force) return;
    const P = plan || compile(), g = Code.gen(lang, P.ir); codeMap = g.map.slice(); let text = fnFix(g.text);
    if (P.timeDep) { const note = lang === 'qasm' ? `// t is the page's clock (0 → 1). Bind it before running, e.g. t = 0.25.` : `# t is the page's clock (0 → 1). Bind it before running, e.g. t = 0.25.`; text += '\n' + note; codeMap.push(null); }
    const disp = S.cols.flatMap((c, gc) => c.map((x, w) => x && DISPLAY[x.k] ? `${title(x.k).toLowerCase()} on q${w}${x.span > 1 ? '–q' + (w + x.span - 1) : ''} after step ${gc + 1}` : null)).filter(Boolean);

    E.code.value = text; lineOf = new Map(); codeMap.forEach((id, i) => { if (id != null) { const o = P.ir.ops.find(x => x.id === id); if (o) { const key = o.meta.gc; if (!lineOf.has(key)) lineOf.set(key, []); lineOf.get(key).push({ i, o }); } } });
    E.codeMsg.textContent = 'In sync with the circuit. Edit the code and the circuit follows.'; E.codeMsg.className = 'wb-codemsg';
    paintCode();
  }
  function fnFix(text) { // sin/cos/exp in angles: name them for each SDK
    if (!/\b(sin|cos|exp)\(/.test(text)) return text;
    if (lang === 'qasm') return text;
    const pre = lang === 'cirq' ? 'sympy.' : 'np.';
    text = text.replace(/(^|[^.\w])(sin|cos|exp)\(/g, (m, a, f) => `${a}${pre}${f}(`);
    if (lang === 'qiskit' && !/import numpy as np/.test(text)) text = text.replace(/\n/, '\nimport numpy as np\n'), codeMap.splice(1, 0, null);
    return text;
  }
  function paintCode(bad) { E.hl.innerHTML = Code.highlight(E.code.value); E.gut.textContent = E.code.value.split('\n').map((_, i) => i + 1).join('\n'); if (bad) bad.forEach(ln => { const l = E.hl.querySelector(`.cl[data-ln="${ln}"]`); l && l.classList.add('bad'); }); litCode(); syncScroll(); }
  function litCode() {
    if (!E.hl) return; E.hl.querySelectorAll('.cl.lit').forEach(l => l.classList.remove('lit'));
    const focus = hoverCell || sel; if (!focus || !plan) return;
    const list = (lineOf.get(focus.c) || []).filter(({ o }) => o.meta.w.includes(focus.w) || o.c.includes(focus.w) || o.q.includes(focus.w));
    list.forEach(({ i }) => { const l = E.hl.querySelector(`.cl[data-ln="${i + 1}"]`); l && l.classList.add('lit'); });
    E.grid && E.grid.querySelectorAll('.wb-g.codelit').forEach(g => g.classList.remove('codelit'));
  }
  function syncScroll() { E.hl.scrollTop = E.code.scrollTop; E.hl.scrollLeft = E.code.scrollLeft; E.gut.scrollTop = E.code.scrollTop; }
  let parseT = null;
  function onCodeInput() {
    paintCode(); clearTimeout(parseT);
    parseT = setTimeout(() => {
      const r = Code.parse(lang, E.code.value);
      if (r.errors && r.errors.length) { E.codeMsg.textContent = r.errors[0].msg; E.codeMsg.className = 'wb-codemsg bad'; paintCode(r.errors.map(e => e.ln)); return; }
      if (!r.n) { E.codeMsg.textContent = 'Declare the qubits first, e.g. qc = QuantumCircuit(2).'; E.codeMsg.className = 'wb-codemsg bad'; return; }
      if (r.n > MAXQ) { E.codeMsg.textContent = `Up to ${MAXQ} qubits here.`; E.codeMsg.className = 'wb-codemsg bad'; return; }
      const keep = [];
      const { cols, warn } = fromOps(r.n, r.ops.map(o => Object.assign({}, o, { p: (o.p || []).map(v => typeof v === 'string' ? normExpr(v) : v) })), keep);
      begin(); S.n = r.n; S.init = Array(r.n).fill('0'); S.cols = cols; fromCode = true;
      undo.push(S._before); redo = []; S._before = null; normalise(); dirty = true; persist();
      plan = compile(); dirty = false; paintLint(); lineOf = new Map(); render();
      E.codeMsg.textContent = warn.length ? `Circuit updated. ${[...new Set(warn)].join('; ')}.` : 'Circuit updated from your code.'; E.codeMsg.className = 'wb-codemsg ok';
    }, 450);
  }
  /* ---------------- lint ---------------- */
  function paintLint() {
    if (!E.lint) return; const P = plan; const errs = [...P.errors.entries()];
    let m = null; try { const bound = Object.assign({}, P.ir, { ops: P.ir.ops.map(o => Object.assign({}, o, { p: o.p.map(v => typeof v === 'number' ? v : 0) })) }); m = Passes.metrics(bound); } catch (e) { }
    E.lint.replaceChildren(
      h('span', { class: 'wb-met' }, h('span', {}, 'gates ', h('b', {}, String(P.ir.ops.filter(o => o.g !== 'M').length))), m ? h('span', {}, 'depth ', h('b', {}, String(m.depth))) : null, m ? h('span', {}, 'two-qubit ', h('b', {}, String(m.cx))) : null, P.timeDep ? h('span', { class: 'badge b-violet' }, 'animated by t') : null),
      ...errs.slice(0, 3).map(([key, msg]) => { const [c, w] = key.split(':'); return h('span', { class: 'wb-err' }, `Column ${+c + 1}, q${w}: ${msg}`); }));
    refreshTutor();
  }
  /* ---------------- edits ---------------- */
  function setQubits(n) {
    n = Math.max(1, Math.min(MAXQ, n)); if (n === S.n) { if (n === MAXQ) toast(`Up to ${MAXQ} qubits in the browser.`); return; }
    if (n < S.n) { removeWire(S.n - 1); return; }
    change(() => { S.n = n; S.init.push('0'); S.cols.forEach(c => c.push(null)); }, `${n} qubits`);
    smooth.clear();
  }
  function removeWire(w) {
    if (S.n <= 1) return;
    change(() => {
      S.cols = S.cols.map(col => { const out = blank(S.n - 1); col.forEach((x, j) => { if (!x) return; const sp = x.span || 1; if (j === w && sp === 1) return; if (j === w) { x.span = sp - 1; out[j] = x; return; } if (j < w && j + sp - 1 >= w) { x.span = sp - 1; out[j] = x; return; } out[j > w ? j - 1 : j] = x; }); return out; });
      S.init.splice(w, 1); S.n--; sel = null;
    }, `Qubit ${w} removed`); smooth.clear();
  }
  function deleteAt(c, w) { const x = S.cols[c] && S.cols[c][w]; if (!x) return; change(() => { S.cols[c][w] = null; sel = null; }, `${title(x.k)} removed`); closeInsp(); }
  function addToWire(x) {
    const w = sel ? sel.w : 0, span = x.span || 1; let c = 0;
    for (c = S.cols.length - 1; c >= 0; c--) { const own = owners(S.cols[c]); if (Array.from({ length: Math.min(span, S.n - w) }, (_, i) => own[Math.min(w, S.n - span) + i]).some(o => o != null)) break; }
    c = c + 1; if (x.span > S.n) { toast(`${title(x.k)} needs ${x.span} qubits.`); return; }
    change(() => place(c, w, x), `${title(x.k)} added to q${Math.min(w, S.n - span)}`);
  }
  /* ---------------- selection + inspector ---------------- */
  let insp = null;
  function select(c, w, el) {
    sel = { c, w }; E.grid.querySelectorAll('.wb-g.sel').forEach(g => g.classList.remove('sel')); el.classList.add('sel'); litCode(); openInsp(c, w, el);
  }
  function closeInsp() { if (insp) { insp.remove(); insp = null; } }
  function openInsp(c, w, el) {
    closeInsp(); const x = S.cols[c][w]; if (!x) return;
    const body = [h('div', { class: 'wb-insp-h' }, h('b', {}, title(x.k)), h('span', { class: 'mono small' }, `q${w}${x.span > 1 ? '–q' + (w + x.span - 1) : ''} · column ${c + 1}`)), h('p', { class: 'small' }, DESC[x.k] || '')];
    if (PARAM[x.k]) {
      const inp = h('input', { class: 'uline mono', value: pretty(x.p).replace(/·/g, '*'), 'aria-label': 'Angle expression', spellcheck: 'false' });
      const msg = h('p', { class: 'small', 'aria-live': 'polite' });
      const rng = h('input', { type: 'range', min: -2 * PI, max: 2 * PI, step: PI / 64, 'aria-label': 'Angle' }); try { rng.value = evalE(x.p, t); } catch (e) { }
      const apply = v => { let e; try { e = normExpr(v); evalE(e, .3); } catch (er) { msg.textContent = er.message; msg.className = 'small bad'; return; } msg.textContent = usesT(e) ? 'Uses the clock t, so it animates.' : ''; msg.className = 'small'; begin(); x.p = e; commit(); };
      inp.addEventListener('change', () => apply(inp.value.replace(/π/g, 'pi'))); inp.addEventListener('keydown', e => { if (e.key === 'Enter') { inp.blur(); } });
      rng.addEventListener('input', () => { if (!S._before) begin(); x.p = normExpr(Code.fmtNum(+rng.value)); inp.value = x.p; dirty = true; plan = null; kick(); renderLight(c, w); });
      rng.addEventListener('change', () => { if (S._before) commit(); });
      body.push(h('label', { class: 'small lbl' }, 'Angle (radians; pi, t, sin, cos allowed)'), inp, rng, msg,
        h('div', { class: 'row wrap' }, ['pi/4', 'pi/2', 'pi', '2*pi*t', 'pi*t**2'].map(v => h('button', { type: 'button', class: 'chip', onclick: () => { inp.value = v; apply(v); } }, pretty(v)))));
      setTimeout(() => inp.focus(), 0);
    }
    if (SPAN[x.k] && SPAN[x.k][0] !== SPAN[x.k][1]) {
      const [lo, hi] = SPAN[x.k], val = h('b', { class: 'mono' }, String(x.span));
      const step = d => { const ns = Math.max(lo, Math.min(hi, S.n - w, x.span + d)); if (ns === x.span) return; change(() => { const col = S.cols[c]; x.span = ns; col.forEach((y, j) => { if (y && j !== w && !(j + (y.span || 1) - 1 < w || j > w + ns - 1)) col[j] = null; }); }); };
      body.push(h('div', { class: 'row' }, h('span', { class: 'small' }, 'Covers'), h('button', { type: 'button', class: 'btn bare', 'aria-label': 'Cover fewer wires', onclick: () => step(-1) }, icon('minus', 's')), val, h('button', { type: 'button', class: 'btn bare', 'aria-label': 'Cover more wires', onclick: () => step(1) }, icon('plus', 's')), h('span', { class: 'small' }, 'wires')));
    }
    body.push(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: () => deleteAt(c, w) }, icon('trash', 's'), 'Delete'), h('button', { type: 'button', class: 'btn bare', onclick: () => { const cp = JSON.parse(JSON.stringify(x)); change(() => place(c + 1, w, cp, true), 'Duplicated'); closeInsp(); } }, icon('copy', 's'), 'Duplicate')));
    insp = h('div', { class: 'pop wb-insp', role: 'dialog', 'aria-label': title(x.k) }, ...body);
    E.main.append(insp);
    const r = el.getBoundingClientRect(), mr = E.main.getBoundingClientRect();
    insp.style.left = Math.max(8, Math.min(mr.width - 300, r.left - mr.left + E.main.scrollLeft - 20)) + 'px'; insp.style.top = (r.bottom - mr.top + E.main.scrollTop + 10) + 'px';
  }
  function renderLight(c, w) { const el = E.grid.querySelector(`.wb-g[data-c="${c}"][data-w="${w}"]`); if (el) { const x = S.cols[c][w]; const f = el.querySelector('.gf'); f && f.replaceWith(gateFace(x)); } renderCode(); }
  /* ---------------- drag & drop ---------------- */
  function hit(e, span) {
    const r = E.grid.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const wr = E.gridWrap.getBoundingClientRect();
    if (e.clientX < wr.left - 10 || e.clientX > wr.right + 10 || e.clientY < wr.top - 20 || e.clientY > wr.bottom + 20) return null;
    let w = Math.floor((y - 4) / ROW); w = Math.max(0, Math.min(S.n - span, w));
    if (x < GUT - 20) return null;
    let c = colX.findIndex((cx, i) => x >= cx && x < cx + colW[i]); if (c < 0) c = x >= GUT ? nCols - 1 : 0;
    const edge = x - colX[c], insert = c <= S.cols.length && edge < 9 && S.cols.length > 0;
    if (c > S.cols.length) c = S.cols.length;
    return { c, w, insert };
  }
  function startDrag(e, x, from, srcEl) {
    if (e.button > 0) return; const sx = e.clientX, sy = e.clientY; let ghost = null, started = false, tgt = null, copy = e.altKey;
    const span = x.span || 1;
    const move = ev => {
      if (!started) { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return; started = true; hideTip(); closeInsp(); ghost = h('div', { class: `wb-ghost wb-g f-${fam(x.k)}` + (DISPLAY[x.k] ? ' disp' : '') }, gateFace(x, true)); ghost.style.height = (span * ROW - 16) + 'px'; ghost.style.width = Math.max(40, Math.min(120, cellW(x))) + 'px'; document.body.append(ghost); if (from && !copy) srcEl.classList.add('lifting'); document.body.classList.add('wb-dragging'); }
      ghost.style.transform = `translate(${ev.clientX - 20}px, ${ev.clientY - 20}px)`;
      tgt = hit(ev, Math.min(span, S.n)); paintDrop(tgt, span);
      if (from && !copy) ghost.classList.toggle('trash', !tgt);
    };
    const up = ev => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      if (!started) return; Drag.just = true; setTimeout(() => Drag.just = false, 0);
      ghost.remove(); document.body.classList.remove('wb-dragging'); srcEl.classList.remove('lifting'); E.drop.hidden = true; E.ins.hidden = true;
      const cp = JSON.parse(JSON.stringify(x));
      if (!tgt) { if (from && !copy) { deleteAt(from.c, from.w); toast(`${title(x.k)} removed.`, () => doUndo()); } return; }
      if (from && !copy && tgt.c === from.c && tgt.w === from.w && !tgt.insert) return;
      change(() => {
        let c = tgt.c;
        if (from && !copy) { S.cols[from.c][from.w] = null; if (tgt.insert && tgt.c <= from.c) { } }
        place(c, tgt.w, cp, tgt.insert);
      }, `${title(x.k)} placed on q${tgt.w}`);
      sel = null;
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  function paintDrop(tgt, span) {
    if (!tgt) { E.drop.hidden = true; E.ins.hidden = true; return; }
    if (tgt.insert) { E.drop.hidden = true; E.ins.hidden = false; E.ins.style.left = (colX[tgt.c] - 2) + 'px'; E.ins.style.height = (S.n * ROW) + 'px'; return; }
    E.ins.hidden = true; E.drop.hidden = false; const w = colW[tgt.c] || 52; E.drop.style.left = (colX[tgt.c] + 4) + 'px'; E.drop.style.width = (w - 8) + 'px'; E.drop.style.top = (tgt.w * ROW + 8) + 'px'; E.drop.style.height = (Math.min(span, S.n) * ROW - 8) + 'px';
  }
  function resizeDrag(e, c, w) {
    const x = S.cols[c][w], [lo, hi] = SPAN[x.k], y0 = e.clientY, s0 = x.span; begin(); let changed = false;
    const move = ev => { const ns = Math.max(lo, Math.min(hi, S.n - w, s0 + Math.round((ev.clientY - y0) / ROW))); if (ns !== x.span) { const col = S.cols[c]; x.span = ns; col.forEach((y, j) => { if (y && j !== w && !(j + (y.span || 1) - 1 < w || j > w + ns - 1)) col[j] = null; }); changed = true; dirty = true; render(); } };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); Drag.just = true; setTimeout(() => Drag.just = false, 0); if (changed) commit(`Covers ${x.span} wires`); else S._before = null; };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  }
  /* ---------------- misc wiring ---------------- */
  function tplMenu(anchor) {
    const old = document.querySelector('.wb-menu'); if (old) { old.remove(); return; }
    const m = h('div', { class: 'pop wb-menu', role: 'menu' }, h('div', { class: 'wb-mh' }, 'Examples'), ...TEMPLATES.map(([name, f]) => h('button', { type: 'button', role: 'menuitem', class: 'wb-mi', onclick: () => { m.remove(); change(() => { const st = f(); S.n = st.n; S.init = st.init; S.cols = st.cols; S.name = name; }, `Loaded ${name}`); smooth.clear(); t = 0; setPlaying(true); } }, name)), h('div', { class: 'wb-mh' }, 'Build your own'), h('button', { type: 'button', role: 'menuitem', class: 'wb-mi strong', onclick: () => { m.remove(); blockDialog(); } }, icon('layers', 's'), 'Block library: Grover-SAT, QPE, Shor-15, QAOA, adders…'));
    document.body.append(m); const r = anchor.getBoundingClientRect(); m.style.left = r.left + 'px'; m.style.top = (r.bottom + 6) + 'px'; m.style.position = 'fixed';
    setTimeout(() => addEventListener('pointerdown', function off(ev) { if (!m.contains(ev.target)) { m.remove(); removeEventListener('pointerdown', off); } }));
  }
  function blockDialog() {
    const box = h('div', { class: 'wb-dlgbody' }), close = () => { dlg.remove(); removeEventListener('keydown', esc); };
    const dlg = h('div', { class: 'wb-dlg', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Block library' }, h('div', { class: 'wb-dlgcard' }, h('div', { class: 'wb-dlgh' }, h('h3', {}, 'Block library'), h('p', {}, 'Parameterised generators for bigger circuits. Pick one, adjust its parameters, build it, then open it here.'), h('button', { type: 'button', class: 'btn bare wb-dlgx', 'aria-label': 'Close', onclick: () => close() }, icon('x', 's'))), box));
    const esc = e => { if (e.key === 'Escape') close(); };
    dlg.addEventListener('pointerdown', e => { if (e.target === dlg) close(); }); addEventListener('keydown', esc);
    document.body.append(dlg);
    try { Blocks.mount(box, { onOpen: () => { close(); smooth.clear(); render(); toast('Block opened in the Laboratory.'); } }); } catch (e) { box.textContent = 'The block library could not load: ' + e.message; }
    const f = box.querySelector('select'); f && f.focus();
  }
  function wireEvents() {
    E.code.addEventListener('input', onCodeInput); E.code.addEventListener('scroll', syncScroll);
    E.code.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const s = E.code.selectionStart; E.code.setRangeText('    ', s, E.code.selectionEnd, 'end'); onCodeInput(); } });
    E.code.addEventListener('blur', () => { if (E.codeMsg.classList.contains('ok')) setTimeout(() => renderCode(true), 0); });
    E.code.addEventListener('click', codeCursor); E.code.addEventListener('keyup', codeCursor);
    E.main.addEventListener('pointerdown', e => { if (insp && !insp.contains(e.target) && !e.target.closest('.wb-g')) { closeInsp(); sel = null; E.grid.querySelectorAll('.wb-g.sel').forEach(g => g.classList.remove('sel')); litCode(); } });
    E.main.addEventListener('scroll', () => { hideTip(); });
    addEventListener('keydown', e => {
      if (!visible()) return; const tag = (e.target.tagName || '').toLowerCase(), typing = tag === 'textarea' || tag === 'input' || tag === 'select';
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
      else if (e.key === ' ' && !typing && !e.target.closest('button')) { e.preventDefault(); setPlaying(!playing); }
      else if (e.key === 'Escape') { closeInsp(); }
    });
    // resizable code panel
    const setW = w => { w = Math.max(300, Math.min(innerWidth * .6, w)); root.style.setProperty('--wb-code', w + 'px'); Store.set('wbCodeW', w); };
    if (Store.get().wbCodeW) root.style.setProperty('--wb-code', Store.get().wbCodeW + 'px');
    E.split.addEventListener('pointerdown', e => { const x0 = e.clientX, w0 = E.codeSide.getBoundingClientRect().width; const mv = ev => setW(w0 - (ev.clientX - x0)); const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); document.body.classList.remove('wb-resizing'); }; document.body.classList.add('wb-resizing'); addEventListener('pointermove', mv); addEventListener('pointerup', up); });
    E.split.addEventListener('keydown', e => { const w = E.codeSide.getBoundingClientRect().width; if (e.key === 'ArrowLeft') setW(w + 24); if (e.key === 'ArrowRight') setW(w - 24); });
  }
  function codeCursor() {
    const ln = E.code.value.slice(0, E.code.selectionStart).split('\n').length - 1, id = codeMap[ln]; E.grid.querySelectorAll('.wb-g.codelit').forEach(g => g.classList.remove('codelit'));
    if (id == null || !plan) return; const o = plan.ir.ops.find(x => x.id === id); if (!o || o.meta.gc < 0) return;
    o.meta.w.forEach(w => { const g = E.grid.querySelector(`.wb-g[data-c="${o.meta.gc}"][data-w="${w}"]`); g && g.classList.add('codelit'); });
  }
  function topbar() { App.top(['Laboratory', S.name || 'Untitled circuit'], []); }
  /* ---------------- public ---------------- */
  function mount(el) {
    const saved = Store.get().wb; load(saved && saved.cols ? saved : TEMPLATES[0][1](), saved ? saved.name : TEMPLATES[0][0]);
    layout(el); mounted = true; render(); setPlaying(!matchMedia('(prefers-reduced-motion: reduce)').matches); checkRunner();
  }
  function onShow() { if (!mounted) return; topbar(); render(); checkRunner(); }
  function loadIR(circ) {
    const { state, warn } = fromIR(circ); const st = Object.assign(state, { name: circ.name || 'Circuit' });
    if (!mounted) { Store.set('wb', st); return; }
    change(() => { S.n = st.n; S.init = st.init; S.cols = st.cols; S.name = st.name; }, `Loaded ${st.name}`); smooth.clear();
    if (warn.length) toast(`Loaded, with changes: ${[...new Set(warn)].join('; ')}.`);
  }
  // test hooks (node): compile a grid state to IR / simulate without a DOM
  function _compile(state) { const keep = S; S = Object.assign({ name: 'x' }, JSON.parse(JSON.stringify(state))); const P = compile(); S = keep; return P; }
  function ir() { const P = compile(); return { n: S.n, nc: S.n, name: S.name, ops: P.ir.ops.map(o => ({ id: o.id, g: o.g, q: o.q.slice(), c: o.c.slice(), p: o.p.map(v => typeof v === 'number' ? v : String(v)), col: o.col, cb: o.cb })), defs: {}, params: { t } }; }
  // hooks for the first-visit tutorial (tour.js)
  const tour = {
    state: () => S, side: () => side, setSide: k => { if (mounted) setSide(k); },
    fresh() { if (!mounted) return; change(() => { S.n = 2; S.init = ['0', '0']; S.cols = []; S.name = 'Your first circuit'; }, 'New circuit'); smooth.clear(); setSide('code', true); render(); }
  };
  return { mount, onShow, load: loadIR, ir, TEMPLATES, grid, _compile, fromOps, evalE, tour };
})();
// Open-in-lab from the rest of the app goes to the workbench too.
if (typeof Lab !== 'undefined') { const _ll = Lab.load; Lab._load = _ll; Lab.load = c => { Workbench.load(c); }; }
