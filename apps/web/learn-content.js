/* =====================================================================
   LEARN CONTENT — four structured modules: Qubits, Gates, Entanglement,
   Algorithms. Each lesson = theory (with maths), interactive examples,
   checks, and a summary. Each module ends in an assessment.
   Block types:  {h} heading · {p} prose ($…$ inline, $$…$$ display) ·
   {m} display maths · {key} key idea · {w} interactive widget ·
   {q} check (mcq | num | build) · {aside} going further.
   Circuits use a tiny text form: "H 0; CX 0 1; RY 0 pi/3" (controls
   first). Every number the text states is asserted in learntest.js.
===================================================================== */
const TXL = String.raw;
const Circ = {
  // "H 0; CX 0 1; RY 0 pi/3; CCX 0 1 2; M 0" → {n, ops}; params may be symbols (sliders)
  parse(n, src) {
    const ops = [], last = new Array(n).fill(-1); let id = 1;
    const CTRL = { CX: ['X', 1], CNOT: ['X', 1], CZ: ['Z', 1], CY: ['Y', 1], CH: ['H', 1], CP: ['P', 1], CRY: ['RY', 1], CRZ: ['RZ', 1], CCX: ['X', 2], CCZ: ['Z', 2], CSWAP: ['SWAP', 1] };
    const PAR = new Set(['RX', 'RY', 'RZ', 'P', 'CP', 'CRY', 'CRZ']);
    String(src || '').split(/[;\n]+/).map(s => s.trim()).filter(Boolean).forEach(tok => {
      const parts = tok.split(/\s+/); let g = parts[0].toUpperCase(); const args = parts.slice(1);
      const p = PAR.has(g) ? [args.pop()] : []; let nc = 0; if (CTRL[g]) [g, nc] = CTRL[g];
      const ws = args.map(Number); const c = ws.slice(0, nc), q = ws.slice(nc);
      const col = Math.max(...ws.map(w => last[w])) + 1; ws.forEach(w => last[w] = col);
      ops.push({ id: id++, g, q, c, p: p.map(v => { const x = Number(v); return isNaN(x) ? (/^[a-z]\w*$/.test(v) ? v : Sim.evalExpr(v)) : x; }), col, cb: g === 'M' ? q[0] : undefined });
    });
    return { n, nc: n, ops, params: {} };
  }
};
const LEARN = (() => {
  const M = [];
  /* =================================================================
     MODULE 1 · QUBITS
  ================================================================= */
  M.push({ id: 'qubits', n: 1, title: 'Qubits', tint: 'violet', blurb: 'What a qubit is, how measurement works, why phase matters, and the Bloch sphere.', lessons: [
    { id: 'q1', title: 'From bits to qubits', mins: 12, concepts: ['state'], goals: ['Write a qubit state in Dirac notation', 'Explain what the amplitudes α and β mean', 'Check that a state is normalised'], blocks: [
      { h: 'A bit has one of two values' },
      { p: 'A classical bit is always either 0 or 1. Everything a computer stores is a long string of them. A register of n bits holds exactly one of its 2ⁿ possible values at any moment.' },
      { h: 'A qubit has two amplitudes' },
      { p: TXL`A qubit is a physical system with two distinguishable states, which we name $|0\rangle$ and $|1\rangle$ (read “ket zero” and “ket one”). The electron spin up or down, a photon’s horizontal or vertical polarisation, or two energy levels of an ion all work. Its state is described by two complex numbers, the amplitudes $\alpha$ and $\beta$:` },
      { m: TXL`|\psi\rangle = \alpha|0\rangle + \beta|1\rangle, \qquad |\alpha|^2 + |\beta|^2 = 1` },
      { p: TXL`As a column vector, $|0\rangle = (1, 0)^T$, $|1\rangle = (0, 1)^T$ and $|\psi\rangle = (\alpha, \beta)^T$. The condition $|\alpha|^2 + |\beta|^2 = 1$ is called normalisation: the vector has length 1.` },
      { key: TXL`A qubit’s state is a unit vector of two complex amplitudes. $|\alpha|^2$ is the probability of reading 0, $|\beta|^2$ the probability of reading 1.` },
      { w: { type: 'bloch', theta: 1.2, phi: 0, show: ['probs', 'formula'], caption: 'Drag the sliders. The arrow is the state; the bars are the chances of reading 0 or 1.' } },
      { h: 'Why amplitudes and not probabilities?' },
      { p: 'Amplitudes can be negative or complex, while probabilities can’t. That extra freedom lets amplitudes cancel each other (interference), which is the resource quantum algorithms exploit. Two states can have identical probabilities and still behave differently later.' },
      { q: { type: 'mcq', concept: 'state', q: TXL`Which of these is a valid qubit state?`, choices: [
        { t: TXL`$0.6|0\rangle + 0.8|1\rangle$`, ok: true, why: TXL`$0.6^2 + 0.8^2 = 0.36 + 0.64 = 1$, so it is normalised.` },
        { t: TXL`$0.5|0\rangle + 0.5|1\rangle$`, why: TXL`$0.25 + 0.25 = 0.5 \neq 1$: the probabilities must add to 1.` },
        { t: TXL`$|0\rangle + |1\rangle$`, why: 'The squared amplitudes add to 2. Divide by √2 to normalise it.' }] } },
      { q: { type: 'num', concept: 'state', q: TXL`A qubit is in $0.6|0\rangle + \beta|1\rangle$ with $\beta$ a positive real number. What is $\beta$?`, answer: 0.8, tol: 0.005, why: TXL`$\beta = \sqrt{1 - 0.6^2} = \sqrt{0.64} = 0.8$.` } },
      { h: 'n qubits' },
      { p: 'Describing n qubits needs one amplitude for every bitstring, so 2ⁿ complex numbers. Fifty qubits need about 10¹⁵ amplitudes: this is why simulating quantum computers classically becomes impossible, and why they might be powerful.' }],
      summary: [TXL`$|\psi\rangle = \alpha|0\rangle + \beta|1\rangle$ with $|\alpha|^2 + |\beta|^2 = 1$.`, 'Amplitudes are complex; probabilities are their squared magnitudes.', 'n qubits are described by 2ⁿ amplitudes.'] },

    { id: 'q2', title: 'Superposition and measurement', mins: 15, concepts: ['born', 'measure'], goals: ['Apply the Born rule', 'Describe what measurement does to a state', 'Estimate probabilities from shots'], blocks: [
      { h: 'The Born rule' },
      { p: TXL`Measuring $\alpha|0\rangle + \beta|1\rangle$ in the computational basis gives 0 with probability $|\alpha|^2$ and 1 with probability $|\beta|^2$. For example $\frac{1}{2}|0\rangle + \frac{\sqrt 3}{2}|1\rangle$ reads 1 with probability $3/4$.` },
      { m: TXL`P(0) = |\langle 0|\psi\rangle|^2 = |\alpha|^2, \qquad P(1) = |\langle 1|\psi\rangle|^2 = |\beta|^2` },
      { h: 'Measurement changes the state' },
      { p: TXL`After the measurement reports 1, the qubit is in $|1\rangle$: measuring again gives 1 every time. The superposition is gone, and the amplitudes cannot be recovered. This is often called collapse. It is why you can’t read out all 2ⁿ amplitudes of a quantum computer: each run gives you one bitstring.` },
      { key: 'Superposition is not “secretly 0 or 1 and we don’t know which”. A secretly-decided coin can’t interfere with itself; a superposition can (you’ll see this in the next lesson).' },
      { h: 'Shots and statistics' },
      { p: 'To learn the probabilities you prepare the same state many times and measure each copy. Each run is a shot. With N shots, the fraction of 1s is close to P(1), with a typical error of about √(P(1−P)/N): four times the shots halves the error.' },
      { w: { type: 'sampler', theta: 2.0944, caption: 'Set the state with the slider, then take shots. Watch the histogram approach the exact bars as the number of shots grows.' } },
      { q: { type: 'num', concept: 'born', q: TXL`A qubit is in $\frac{1}{2}|0\rangle + \frac{\sqrt 3}{2}|1\rangle$. What is the probability of reading 1? (as a decimal)`, answer: 0.75, tol: 0.005, why: TXL`$|\sqrt3/2|^2 = 3/4 = 0.75$.` } },
      { q: { type: 'mcq', concept: 'measure', q: 'You measure a qubit in (|0⟩ + |1⟩)/√2 and get 1. You measure it again straight away. What do you get?', choices: [
        { t: '1, every time', ok: true, why: 'The first measurement left it in |1⟩.' },
        { t: '0 or 1, 50% each', why: 'That would be true for a fresh copy of the state, not for the same qubit after it was measured.' },
        { t: 'Always 0', why: 'Measurement doesn’t flip the result; it keeps the state it reported.' }] } },
      { q: { type: 'build', concept: 'measure', q: TXL`Build the equal superposition $|+\rangle = (|0\rangle + |1\rangle)/\sqrt2$ from $|0\rangle$.`, n: 1, gates: ['H', 'X', 'Z'], target: 'H 0', solution: 'H on q0' } }],
      summary: ['P(outcome) = |amplitude|² (the Born rule).', 'Measurement returns one outcome and leaves the qubit in it.', 'Probabilities are estimated from many shots; error shrinks like 1/√N.'] },

    { id: 'q3', title: 'Phase and bases', mins: 15, concepts: ['phase'], goals: ['Tell global from relative phase', 'Name the |±⟩ and |±i⟩ states', 'See how interference turns phase into probability'], blocks: [
      { h: 'Amplitudes have a phase' },
      { p: TXL`A complex amplitude can be written $re^{i\varphi}$: a size r and an angle φ, the phase. The Born rule only looks at r, so a single measurement can’t see phase. Yet phase is what makes quantum computing different.` },
      { h: 'Global phase is invisible' },
      { p: TXL`Multiplying the whole state by $e^{i\gamma}$ changes nothing that can ever be measured: $|\psi\rangle$ and $e^{i\gamma}|\psi\rangle$ are the same physical state. So we usually make $\alpha$ real and positive.` },
      { h: 'Relative phase is real' },
      { p: TXL`The phase between the two amplitudes does matter. Compare $|+\rangle = (|0\rangle + |1\rangle)/\sqrt2$ and $|-\rangle = (|0\rangle - |1\rangle)/\sqrt2$. Both read 0 or 1 with 50% each, but they are orthogonal states, and one H gate turns them into $|0\rangle$ and $|1\rangle$ respectively.` },
      { m: TXL`|\pm\rangle = \tfrac{1}{\sqrt2}(|0\rangle \pm |1\rangle), \qquad |{\pm i}\rangle = \tfrac{1}{\sqrt2}(|0\rangle \pm i|1\rangle)` },
      { p: TXL`$\{|0\rangle, |1\rangle\}$, $\{|+\rangle, |-\rangle\}$ and $\{|i\rangle, |{-i}\rangle\}$ are three bases. Measuring “in the X basis” means rotating $|\pm\rangle$ onto $|0\rangle/|1\rangle$ with an H and then measuring as usual.` },
      { key: 'Phase is invisible to one measurement but decides how amplitudes add when paths meet. H, P, H turns a phase φ into odds: P(1) = sin²(φ/2).' },
      { w: { type: 'lab', n: 1, circuit: 'H 0; P 0 a; H 0', slider: { name: 'a', label: 'phase φ', min: 0, max: 6.2832, value: 1.5708 }, show: ['probs', 'field', 'bloch'], caption: 'H splits |0⟩ into two paths, P adds a phase φ to the |1⟩ path, and the second H makes the paths meet. Slide φ: the odds follow sin²(φ/2).' } },
      { q: { type: 'mcq', concept: 'phase', q: TXL`Which pair of states can no measurement ever tell apart?`, choices: [
        { t: TXL`$|0\rangle$ and $-|0\rangle$`, ok: true, why: 'They differ by a global phase of −1, which is unobservable.' },
        { t: TXL`$|+\rangle$ and $|-\rangle$`, why: 'They differ by a relative phase: an H maps them to |0⟩ and |1⟩, which a measurement tells apart.' },
        { t: TXL`$|0\rangle$ and $|+\rangle$`, why: '|0⟩ always reads 0; |+⟩ reads 1 half the time.' }] } },
      { q: { type: 'num', concept: 'phase', q: TXL`In the circuit H → P(φ) → H with $\varphi = \pi/2$, what is the probability of reading 1?`, answer: 0.5, tol: 0.005, why: TXL`$\sin^2(\pi/4) = 1/2$.` } },
      { q: { type: 'build', concept: 'phase', q: TXL`Build $|-\rangle = (|0\rangle - |1\rangle)/\sqrt2$ from $|0\rangle$.`, n: 1, gates: ['H', 'X', 'Z', 'S'], target: 'X 0; H 0', solution: 'X then H (or H then Z)' } }],
      summary: ['Global phase is unobservable; relative phase is physical.', '|±⟩ and |±i⟩ are the X and Y bases.', 'Interference converts relative phase into measurable probabilities.'] },

    { id: 'q4', title: 'The Bloch sphere', mins: 14, concepts: ['bloch'], goals: ['Place any single-qubit state on the sphere', 'Read θ and φ from a state', 'See gates as rotations'], blocks: [
      { h: 'Two angles describe every qubit' },
      { p: TXL`Removing the global phase, every single-qubit state can be written with two angles $0 \le \theta \le \pi$ and $0 \le \varphi < 2\pi$:` },
      { m: TXL`|\psi\rangle = \cos\tfrac{\theta}{2}|0\rangle + e^{i\varphi}\sin\tfrac{\theta}{2}|1\rangle` },
      { p: TXL`Read $(\theta, \varphi)$ as the polar and azimuthal angles of a point on a unit sphere: the Bloch sphere. $|0\rangle$ is the north pole, $|1\rangle$ the south pole, and the equator holds the equal superpositions $|+\rangle$ (x axis), $|i\rangle$ (y axis), $|-\rangle$ and $|{-i}\rangle$.` },
      { p: TXL`The height of the point gives the odds: $P(1) = \sin^2(\theta/2) = (1 - z)/2$. The angle around the equator is the relative phase φ.` },
      { w: { type: 'bloch', theta: 1.0472, phi: 0.7854, show: ['probs', 'formula', 'angles'], presets: true, caption: 'Set θ and φ, or jump to a named state. Opposite points are orthogonal states.' } },
      { key: TXL`Opposite points on the sphere are orthogonal states (like $|0\rangle$ and $|1\rangle$, or $|+\rangle$ and $|-\rangle$), even though they are 180° apart, not 90°. That is because of the θ/2 in the formula.` },
      { h: 'Gates are rotations' },
      { p: 'Every single-qubit gate turns the sphere: X is a half-turn about x, Z a half-turn about z, H a half-turn about the axis halfway between x and z. Rx(θ), Ry(θ), Rz(θ) turn by any angle θ. You’ll use these in the Gates module.' },
      { aside: 'Entangled qubits and noisy qubits sit inside the sphere, not on its surface: their arrow is shorter than 1. You’ll meet this in the Entanglement module.' },
      { q: { type: 'num', concept: 'bloch', q: TXL`A qubit on the Bloch sphere has $P(1) = 1/4$. What is θ in radians? (to 2 decimals)`, answer: 1.0472, tol: 0.01, why: TXL`$\sin^2(\theta/2) = 1/4 \Rightarrow \theta/2 = \pi/6 \Rightarrow \theta = \pi/3 \approx 1.05$.` } },
      { q: { type: 'mcq', concept: 'bloch', q: TXL`Where is $|{-i}\rangle$ on the Bloch sphere?`, choices: [
        { t: 'On the equator, on the −y axis', ok: true, why: TXL`θ = π/2 (equal odds) and φ = 3π/2 (−i = e^{i3π/2}).` },
        { t: 'At the south pole', why: 'The south pole is |1⟩, which always reads 1.' },
        { t: 'On the −x axis', why: 'That is |−⟩, with a real minus sign, φ = π.' }] } },
      { q: { type: 'build', concept: 'bloch', q: TXL`Move the state from $|0\rangle$ to $|i\rangle$ (the +y axis).`, n: 1, gates: ['H', 'X', 'Z', 'S', 'T'], target: 'H 0; S 0', solution: 'H then S' } }],
      summary: ['Any qubit: cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩ — a point on the Bloch sphere.', 'Height gives the odds; the angle around the equator is the phase.', 'Single-qubit gates are rotations of the sphere.'] }],
    assessment: { pass: 0.7, items: [
      { type: 'mcq', concept: 'state', lesson: 'q1', q: 'How many complex amplitudes describe a register of 4 qubits?', choices: [{ t: '16', ok: true }, { t: '8', why: 'That is 2 × 4; it is 2⁴.' }, { t: '4', why: 'One amplitude per bitstring, and there are 2⁴ bitstrings.' }] },
      { type: 'num', concept: 'state', lesson: 'q1', q: TXL`$\alpha|0\rangle + \tfrac{1}{3}|1\rangle$ with α real and positive. What is α? (3 decimals)`, answer: 0.9428, tol: 0.002, why: TXL`$\sqrt{1 - 1/9} = \sqrt{8}/3 \approx 0.943$.` },
      { type: 'num', concept: 'born', lesson: 'q2', q: TXL`What is P(0) for $\tfrac{1}{\sqrt5}|0\rangle + \tfrac{2}{\sqrt5}|1\rangle$?`, answer: 0.2, tol: 0.005, why: '(1/√5)² = 1/5.' },
      { type: 'mcq', concept: 'measure', lesson: 'q2', q: 'Why can’t you read all the amplitudes of a state from one copy?', choices: [{ t: 'Each measurement returns one outcome and destroys the superposition', ok: true }, { t: 'The amplitudes change randomly over time', why: 'Without noise, the state evolves deterministically between measurements.' }, { t: 'Detectors are too slow', why: 'It is a law of quantum mechanics, not an engineering limit.' }] },
      { type: 'mcq', concept: 'phase', lesson: 'q3', q: TXL`$|+\rangle$ and $|-\rangle$ are measured in the computational basis. What do you see?`, choices: [{ t: 'The same 50/50 statistics for both', ok: true }, { t: '|+⟩ always reads 0, |−⟩ always reads 1', why: 'That happens only after an H.' }, { t: 'Negative probability for |−⟩', why: 'Probabilities are squared magnitudes and are never negative.' }] },
      { type: 'build', concept: 'phase', lesson: 'q3', q: TXL`Build $|{-i}\rangle = (|0\rangle - i|1\rangle)/\sqrt2$ from $|0\rangle$.`, n: 1, gates: ['H', 'S', 'SDG', 'Z', 'X'], target: 'H 0; SDG 0', solution: 'H then S† (or H, Z, S)' },
      { type: 'mcq', concept: 'bloch', lesson: 'q4', q: 'Two states sit at opposite points of the Bloch sphere. They are:', choices: [{ t: 'Orthogonal', ok: true }, { t: 'Identical up to a phase', why: 'Identical states sit at the same point.' }, { t: 'Entangled', why: 'Entanglement needs two or more qubits.' }] },
      { type: 'num', concept: 'bloch', lesson: 'q4', q: TXL`A state has θ = π/2 on the Bloch sphere. What is P(1)?`, answer: 0.5, tol: 0.005, why: 'sin²(π/4) = 1/2: every point on the equator is 50/50.' }] }
  });
  /* =================================================================
     MODULE 2 · GATES
  ================================================================= */
  M.push({ id: 'gates', n: 2, title: 'Gates', tint: 'cyan', blurb: 'Unitary matrices, the Pauli and Hadamard gates, rotations, many-qubit states and controlled gates.', lessons: [
    { id: 'g1', title: 'Gates are unitary matrices', mins: 14, concepts: ['unitary', 'pauli'], goals: ['Apply a 2×2 gate to a state', 'Know X, Y and Z', 'Explain why gates are reversible'], blocks: [
      { h: 'A gate is a matrix' },
      { p: TXL`A single-qubit gate is a 2×2 complex matrix U. Applying it to a state multiplies the vector: $|\psi'\rangle = U|\psi\rangle$. Because it is linear, it is enough to know what U does to $|0\rangle$ and $|1\rangle$: those are its two columns.` },
      { h: 'The Pauli gates' },
      { m: TXL`X = \begin{pmatrix}0&1\\1&0\end{pmatrix},\quad Y = \begin{pmatrix}0&-i\\i&0\end{pmatrix},\quad Z = \begin{pmatrix}1&0\\0&-1\end{pmatrix}` },
      { p: TXL`X is the quantum NOT: $X|0\rangle = |1\rangle$, $X|1\rangle = |0\rangle$. Z leaves $|0\rangle$ alone and flips the sign of $|1\rangle$: a phase flip, so $Z|+\rangle = |-\rangle$. Y does both, with a factor of i. On the Bloch sphere they are half-turns about x, y and z.` },
      { h: 'Unitary means reversible' },
      { p: TXL`Quantum gates are unitary: $U^\dagger U = I$, where $U^\dagger$ is the conjugate transpose. Unitary matrices keep vectors at length 1, so probabilities still add to 1, and every gate can be undone by applying $U^\dagger$. The Paulis are their own inverses: $X^2 = Y^2 = Z^2 = I$.` },
      { key: 'Every gate is a unitary matrix: it preserves total probability and can be undone. Only measurement is irreversible.' },
      { w: { type: 'lab', n: 1, gates: ['X', 'Y', 'Z', 'H'], show: ['probs', 'field', 'bloch'], caption: 'Tap a gate, then tap the wire. Watch the arrow turn and the amplitudes change. Tap a placed gate to remove it.' } },
      { q: { type: 'mcq', concept: 'pauli', q: TXL`What is $Z|1\rangle$?`, choices: [{ t: TXL`$-|1\rangle$`, ok: true, why: 'Z multiplies the |1⟩ amplitude by −1.' }, { t: TXL`$|0\rangle$`, why: 'That is what X does.' }, { t: TXL`$|1\rangle$`, why: 'Z does change the state, by a sign. On its own that sign is a global phase, but it matters inside superpositions.' }] } },
      { q: { type: 'num', concept: 'unitary', q: TXL`What is the matrix entry $\langle 0|X|1\rangle$ (row 0, column 1 of X)?`, answer: 1, tol: 0.001, why: 'Column 1 of X is X|1⟩ = |0⟩, so its row-0 entry is 1.' } },
      { q: { type: 'mcq', concept: 'unitary', q: 'Which of these could not be a quantum gate?', choices: [{ t: TXL`$\begin{pmatrix}1&0\\0&0\end{pmatrix}$`, ok: true, why: 'It sends |1⟩ to the zero vector: not length-preserving, so not unitary (it is a projector, like a measurement).' }, { t: TXL`$\begin{pmatrix}0&1\\1&0\end{pmatrix}$`, why: 'That is X, which is unitary.' }, { t: TXL`$\begin{pmatrix}1&0\\0&i\end{pmatrix}$`, why: 'That is the S gate, which is unitary.' }] } }],
      summary: ['Gates are unitary matrices; columns are the images of |0⟩ and |1⟩.', 'X flips bits, Z flips phase, Y does both.', 'U†U = I: gates preserve probability and are reversible.'] },

    { id: 'g2', title: 'Hadamard and interference', mins: 14, concepts: ['hadamard', 'interference'], goals: ['Apply H to basis states', 'Explain H·H = I with paths', 'Recognise interference'], blocks: [
      { h: 'The Hadamard gate' },
      { m: TXL`H = \tfrac{1}{\sqrt2}\begin{pmatrix}1&1\\1&-1\end{pmatrix},\qquad H|0\rangle = |+\rangle,\quad H|1\rangle = |-\rangle` },
      { p: 'H turns a basis state into an equal superposition. It is its own inverse, so it also turns |±⟩ back into |0⟩ and |1⟩: it swaps the Z basis and the X basis.' },
      { h: 'Why H·H = I: paths that cancel' },
      { p: TXL`Follow $|0\rangle$ through two H gates. The first H sends it to $|0\rangle$ with amplitude $\tfrac{1}{\sqrt2}$ and to $|1\rangle$ with $\tfrac{1}{\sqrt2}$. The second H sends each of those on again. There are two paths to the final $|1\rangle$:` },
      { m: TXL`\underbrace{\tfrac{1}{\sqrt2}\cdot\tfrac{1}{\sqrt2}}_{0\to0\to1} + \underbrace{\tfrac{1}{\sqrt2}\cdot\left(-\tfrac{1}{\sqrt2}\right)}_{0\to1\to1} = \tfrac12 - \tfrac12 = 0` },
      { p: 'The two routes to |1⟩ have opposite signs and cancel; the two routes to |0⟩ add to 1. This is interference, and it is exactly what a coin can’t do: a coin flipped twice is still 50/50.' },
      { key: 'Interference: amplitudes for different paths to the same outcome add, and can cancel. Quantum algorithms are designed so that wrong answers cancel and right answers add up.' },
      { w: { type: 'lab', n: 1, circuit: 'H 0; H 0', gates: ['H', 'X', 'Z'], show: ['probs', 'field', 'steps'], caption: 'H·H brings |0⟩ back to |0⟩. Try inserting Z between the two H gates: now the paths to |0⟩ cancel instead.' } },
      { q: { type: 'num', concept: 'hadamard', q: TXL`What is the amplitude of $|1\rangle$ in $H|1\rangle$? (decimal, with sign)`, answer: -0.7071, tol: 0.002, why: TXL`$H|1\rangle = (|0\rangle - |1\rangle)/\sqrt2$, so the $|1\rangle$ amplitude is $-1/\sqrt2 \approx -0.707$.` } },
      { q: { type: 'mcq', concept: 'interference', q: 'H, then Z, then H applied to |0⟩ gives:', choices: [{ t: '|1⟩ with certainty', ok: true, why: 'HZH = X. The Z flips the sign of one path, so the paths to |0⟩ cancel.' }, { t: '|0⟩ with certainty', why: 'That is H·H without the Z.' }, { t: '50/50', why: 'The two H gates make the paths interfere completely, so there is no randomness left.' }] } },
      { q: { type: 'build', concept: 'interference', q: 'Using H and Z only, turn |0⟩ into |1⟩.', n: 1, gates: ['H', 'Z'], target: 'X 0', solution: 'H, Z, H' } }],
      summary: ['H|0⟩ = |+⟩, H|1⟩ = |−⟩, H·H = I.', 'Amplitudes of paths to the same outcome add and can cancel.', 'HZH = X: a phase flip in the X basis is a bit flip.'] },

    { id: 'g3', title: 'Phase and rotation gates', mins: 15, concepts: ['rotation'], goals: ['Use S, T and P', 'Use Rx, Ry, Rz', 'Relate rotation angle to probability'], blocks: [
      { h: 'Phase gates' },
      { m: TXL`P(\varphi) = \begin{pmatrix}1&0\\0&e^{i\varphi}\end{pmatrix},\quad S = P(\pi/2),\quad T = P(\pi/4),\quad Z = P(\pi)` },
      { p: TXL`Phase gates leave $|0\rangle$ alone and put a phase on $|1\rangle$: a turn about the z axis of the Bloch sphere. So $T^2 = S$ and $S^2 = Z$. $S^\dagger$ and $T^\dagger$ turn the other way.` },
      { h: 'Rotations about any axis' },
      { m: TXL`R_y(\theta) = \begin{pmatrix}\cos\frac\theta2 & -\sin\frac\theta2\\ \sin\frac\theta2 & \cos\frac\theta2\end{pmatrix},\qquad R_y(\theta)|0\rangle = \cos\tfrac\theta2|0\rangle + \sin\tfrac\theta2|1\rangle` },
      { p: TXL`$R_x(\theta)$, $R_y(\theta)$, $R_z(\theta)$ turn the Bloch sphere by θ about x, y or z. $R_y(\theta)|0\rangle$ has $P(1) = \sin^2(\theta/2)$, so you can dial in any probability. Any single-qubit gate can be written as $R_z(\alpha)R_y(\beta)R_z(\gamma)$ up to a global phase.` },
      { w: { type: 'lab', n: 1, circuit: 'RY 0 a', slider: { name: 'a', label: 'θ', min: 0, max: 6.2832, value: 1.0472 }, show: ['probs', 'bloch'], caption: 'Ry(θ) tips the arrow down from the north pole. P(1) = sin²(θ/2): at θ = π/3 it is 25%, at π it is 100%.' } },
      { key: 'Phase gates (Z, S, T, P, Rz) turn about z and never change the odds of a Z measurement on their own. Rx and Ry change the odds.' },
      { aside: 'The gates H, S and CNOT (the Clifford gates) can be simulated efficiently on a classical computer. Adding T makes the set universal, and T gates are the expensive resource in error-corrected machines.' },
      { q: { type: 'num', concept: 'rotation', q: TXL`What is P(1) for $R_y(\pi/3)|0\rangle$?`, answer: 0.25, tol: 0.005, why: TXL`$\sin^2(\pi/6) = 1/4$.` } },
      { q: { type: 'mcq', concept: 'rotation', q: 'Which is equal to S?', choices: [{ t: 'T·T', ok: true, why: 'T = P(π/4), so T² = P(π/2) = S.' }, { t: 'Z·Z', why: 'Z² = I.' }, { t: 'H·T', why: 'H mixes the basis; it can’t combine with T into a pure phase gate.' }] } },
      { q: { type: 'build', concept: 'rotation', q: TXL`Using H and phase gates, make $|{-i}\rangle$ from $|0\rangle$.`, n: 1, gates: ['H', 'S', 'SDG', 'T', 'Z'], target: 'H 0; SDG 0', solution: 'H then S† (or H, Z, S)' } }],
      summary: ['P(φ) adds phase φ to |1⟩; S = P(π/2), T = P(π/4), Z = P(π).', 'Rx, Ry, Rz rotate the Bloch sphere; Ry(θ)|0⟩ has P(1) = sin²(θ/2).', 'Any single-qubit gate = Rz·Ry·Rz up to global phase.'] },

    { id: 'g4', title: 'Many qubits: tensor products', mins: 14, concepts: ['multi'], goals: ['Write two-qubit states', 'Compute a tensor product', 'Use QUBIQ’s bit ordering'], blocks: [
      { h: 'Two qubits, four amplitudes' },
      { p: TXL`Two qubits have four basis states, $|00\rangle, |01\rangle, |10\rangle, |11\rangle$, and a general state has four amplitudes. In QUBIQ the leftmost bit is q0: $|10\rangle$ means q0 = 1 and q1 = 0. (Qiskit prints bitstrings the other way round; the code panel handles that for you.)` },
      { h: 'Independent qubits combine by the tensor product' },
      { m: TXL`(a|0\rangle + b|1\rangle)\otimes(c|0\rangle + d|1\rangle) = ac|00\rangle + ad|01\rangle + bc|10\rangle + bd|11\rangle` },
      { p: TXL`For example $|+\rangle \otimes |1\rangle = \tfrac{1}{\sqrt2}(|01\rangle + |11\rangle)$. A gate on one qubit acts as $U \otimes I$ on the pair: it changes that qubit and leaves the other alone.` },
      { key: 'n qubits → 2ⁿ amplitudes. States built as tensor products are called product states. Most multi-qubit states are not product states: those are entangled.' },
      { w: { type: 'lab', n: 2, gates: ['H', 'X', 'Z', 'S'], show: ['probs', 'field', 'bloch'], caption: 'With single-qubit gates only, each qubit keeps a full-length arrow: the state stays a product state. Try H on q0 and X on q1.' } },
      { q: { type: 'num', concept: 'multi', q: TXL`What is the amplitude of $|01\rangle$ in $|+\rangle \otimes |1\rangle$?`, answer: 0.7071, tol: 0.002, why: TXL`$|+\rangle\otimes|1\rangle = (|01\rangle + |11\rangle)/\sqrt2$.` } },
      { q: { type: 'num', concept: 'multi', q: 'How many amplitudes describe 10 qubits?', answer: 1024, tol: 0.5, why: '2¹⁰ = 1024.' } },
      { q: { type: 'build', concept: 'multi', q: TXL`Build $|1\rangle \otimes |+\rangle = (|10\rangle + |11\rangle)/\sqrt2$ (q0 is the left bit).`, n: 2, gates: ['H', 'X', 'Z'], target: 'X 0; H 1', solution: 'X on q0 and H on q1' } }],
      summary: ['n qubits: 2ⁿ basis states; in QUBIQ q0 is the leftmost bit.', 'Product states: (a|0⟩+b|1⟩)⊗(c|0⟩+d|1⟩).', 'Single-qubit gates act as U ⊗ I and never create entanglement.'] },

    { id: 'g5', title: 'Controlled gates and CNOT', mins: 16, concepts: ['cnot'], goals: ['Apply CNOT to basis states', 'Explain a control in superposition', 'Understand phase kickback'], blocks: [
      { h: 'CNOT' },
      { p: TXL`The controlled-NOT flips its target when its control is 1: $|c, t\rangle \to |c, t \oplus c\rangle$. On basis states it is a reversible XOR: $|00\rangle\to|00\rangle$, $|01\rangle\to|01\rangle$, $|10\rangle\to|11\rangle$, $|11\rangle\to|10\rangle$.` },
      { m: TXL`\mathrm{CNOT} = |0\rangle\langle0|\otimes I + |1\rangle\langle1|\otimes X` },
      { h: 'A control in superposition' },
      { p: TXL`If the control is in $|+\rangle$, the CNOT acts only on the half of the state where the control is 1: $\tfrac{1}{\sqrt2}(|0\rangle+|1\rangle)|0\rangle \to \tfrac{1}{\sqrt2}(|00\rangle + |11\rangle)$. That output is not a product state: the CNOT has created entanglement. The next module is all about it.` },
      { h: 'Other controlled gates' },
      { p: 'Any gate U has a controlled version. CZ puts a −1 on |11⟩ only, so it is symmetric: it doesn’t matter which qubit you call the control. The Toffoli (CCX) flips its target only when both controls are 1; it can compute AND reversibly.' },
      { h: 'Phase kickback' },
      { p: TXL`If the target is an eigenstate of U, the controlled-U can’t change the target, so the eigenvalue appears as a phase on the control instead. With the target in $|-\rangle$ (the −1 eigenstate of X), a CNOT turns a control $|+\rangle$ into $|-\rangle$. Kickback is how oracles and phase estimation work.` },
      { w: { type: 'lab', n: 2, gates: ['H', 'X', 'Z', 'CNOT', 'CZ'], circuit: 'H 0; CX 0 1', show: ['probs', 'field', 'bloch', 'steps'], caption: 'H then CNOT makes (|00⟩ + |11⟩)/√2: both arrows shrink to nothing. Try X on q1 and H on q1 before the CNOT to see phase kickback flip q0.' } },
      { key: 'Controlled gates act only on the part of the state where the control is 1. With the control in superposition, that creates entanglement; with the target in an eigenstate, it kicks a phase back onto the control.' },
      { q: { type: 'mcq', concept: 'cnot', q: TXL`CNOT with control q0 and target q1 acts on $|10\rangle$. The result is:`, choices: [{ t: TXL`$|11\rangle$`, ok: true, why: 'q0 = 1, so q1 flips.' }, { t: TXL`$|10\rangle$`, why: 'The control is 1, so the target does flip.' }, { t: TXL`$|01\rangle$`, why: 'CNOT never changes the control on basis states.' }] } },
      { q: { type: 'mcq', concept: 'cnot', q: 'Control q0 in |+⟩, target q1 in |−⟩. After a CNOT, q0 is in:', choices: [{ t: '|−⟩', ok: true, why: 'Phase kickback: X|−⟩ = −|−⟩, so the −1 lands on the control’s |1⟩ branch.' }, { t: '|+⟩', why: 'The target is an eigenstate with eigenvalue −1, and that sign goes to the control.' }, { t: 'Entangled with q1', why: 'When the target is an eigenstate, the qubits stay unentangled.' }] } },
      { q: { type: 'build', concept: 'cnot', q: TXL`Make $|11\rangle$ from $|00\rangle$ using one X and one CNOT.`, n: 2, gates: ['X', 'CNOT'], target: 'X 0; X 1', solution: 'X on q0, then CNOT from q0 to q1' } }],
      summary: ['CNOT: |c,t⟩ → |c, t⊕c⟩.', 'A control in superposition creates entanglement.', 'Phase kickback: an eigenvalue of U appears as a phase on the control.'] }],
    assessment: { pass: 0.7, items: [
      { type: 'mcq', concept: 'unitary', lesson: 'g1', q: 'Why must quantum gates be unitary?', choices: [{ t: 'So total probability stays 1 and the evolution is reversible', ok: true }, { t: 'So they can be built from transistors', why: 'Unitarity comes from quantum mechanics, not hardware.' }, { t: 'So they commute with each other', why: 'Most gates don’t commute (XZ ≠ ZX).' }] },
      { type: 'mcq', concept: 'pauli', lesson: 'g1', q: TXL`$Z|+\rangle$ equals:`, choices: [{ t: TXL`$|-\rangle$`, ok: true }, { t: TXL`$|+\rangle$`, why: 'Z flips the sign of the |1⟩ part.' }, { t: TXL`$|1\rangle$`, why: 'Z never changes the odds of a Z measurement.' }] },
      { type: 'num', concept: 'hadamard', lesson: 'g2', q: 'What is P(0) after applying H three times to |0⟩?', answer: 0.5, tol: 0.005, why: 'H³ = H, so the state is |+⟩.' },
      { type: 'build', concept: 'interference', lesson: 'g2', q: 'Using only H and S, turn |0⟩ into |1⟩ (up to a global phase).', n: 1, gates: ['H', 'S'], target: 'X 0', solution: 'H, S, S, H' },
      { type: 'num', concept: 'rotation', lesson: 'g3', q: TXL`What is P(1) for $R_x(\pi/2)|0\rangle$?`, answer: 0.5, tol: 0.005, why: 'Rx(θ) and Ry(θ) both give P(1) = sin²(θ/2) from |0⟩.' },
      { type: 'num', concept: 'multi', lesson: 'g4', q: TXL`What is the amplitude of $|11\rangle$ in $|+\rangle\otimes|+\rangle$?`, answer: 0.5, tol: 0.005, why: 'Each factor contributes 1/√2: (1/√2)² = 1/2.' },
      { type: 'mcq', concept: 'cnot', lesson: 'g5', q: 'Which gate is symmetric in its two qubits?', choices: [{ t: 'CZ', ok: true, why: 'It only puts −1 on |11⟩.' }, { t: 'CNOT', why: 'Swapping control and target changes the gate.' }, { t: 'Toffoli', why: 'It has two controls and one target.' }] },
      { type: 'build', concept: 'cnot', lesson: 'g5', q: TXL`Make $(|01\rangle + |10\rangle)/\sqrt2$ from $|00\rangle$.`, n: 2, gates: ['H', 'X', 'CNOT'], target: 'H 0; X 1; CX 0 1', solution: 'H on q0, X on q1, then CNOT q0→q1' }] }
  });
  /* =================================================================
     MODULE 3 · ENTANGLEMENT
  ================================================================= */
  M.push({ id: 'entanglement', n: 3, title: 'Entanglement', tint: 'magenta', blurb: 'Bell states, telling entangled from separable, correlations, Bell’s inequality and teleportation.', lessons: [
    { id: 'e1', title: 'Bell states', mins: 13, concepts: ['bell'], goals: ['Build all four Bell states', 'Read their measurement statistics'], blocks: [
      { h: 'The simplest entangled state' },
      { p: TXL`H on q0 followed by a CNOT from q0 to q1 turns $|00\rangle$ into` },
      { m: TXL`|\Phi^+\rangle = \tfrac{1}{\sqrt2}\left(|00\rangle + |11\rangle\right)` },
      { p: 'Measuring gives 00 or 11, 50% each, and never 01 or 10. Each qubit on its own is a perfect coin, but the two coins always agree.' },
      { h: 'Four Bell states' },
      { m: TXL`|\Phi^\pm\rangle = \tfrac{1}{\sqrt2}(|00\rangle \pm |11\rangle), \qquad |\Psi^\pm\rangle = \tfrac{1}{\sqrt2}(|01\rangle \pm |10\rangle)` },
      { p: 'They form a basis of two-qubit states (the Bell basis). Starting the H + CNOT circuit from |01⟩, |10⟩ or |11⟩ produces the other three. Running the circuit backwards (CNOT then H) converts a Bell state back to a basis state: that is a Bell measurement.' },
      { w: { type: 'lab', n: 2, gates: ['H', 'X', 'Z', 'CNOT'], presets: [{ label: 'Φ+', src: 'H 0; CX 0 1' }, { label: 'Φ−', src: 'X 0; H 0; CX 0 1' }, { label: 'Ψ+', src: 'H 0; X 1; CX 0 1' }, { label: 'Ψ−', src: 'X 0; H 0; X 1; CX 0 1' }], show: ['probs', 'field', 'bloch'], caption: 'Pick a Bell state. The odds show which pairs appear; the disk colours show the relative sign. Both Bloch arrows have length 0.' } },
      { key: 'In a Bell state neither qubit has a state of its own (its Bloch arrow has length 0), yet their measurement results are perfectly correlated.' },
      { q: { type: 'mcq', concept: 'bell', q: TXL`Measuring $|\Psi^+\rangle$ gives:`, choices: [{ t: '01 or 10, 50% each', ok: true }, { t: '00 or 11, 50% each', why: 'That is Φ±.' }, { t: 'Any of the four, 25% each', why: 'That would be |+⟩|+⟩, which is not entangled.' }] } },
      { q: { type: 'build', concept: 'bell', q: TXL`Build $|\Phi^+\rangle = (|00\rangle + |11\rangle)/\sqrt2$.`, n: 2, gates: ['H', 'X', 'Z', 'CNOT'], target: 'H 0; CX 0 1', solution: 'H on q0, then CNOT q0→q1' } },
      { q: { type: 'build', concept: 'bell', q: TXL`Build $|\Psi^-\rangle = (|01\rangle - |10\rangle)/\sqrt2$.`, n: 2, gates: ['H', 'X', 'Z', 'CNOT'], target: 'X 0; H 0; X 1; CX 0 1', solution: 'X on q0, H on q0, X on q1, then CNOT' } }],
      summary: ['H + CNOT: |00⟩ → Φ+ = (|00⟩+|11⟩)/√2.', 'Four Bell states form a basis.', 'Bell pairs give perfectly correlated results from individually random qubits.'] },

    { id: 'e2', title: 'Separable or entangled?', mins: 15, concepts: ['separable'], goals: ['Test a two-qubit state for entanglement', 'Use the reduced state and its purity'], blocks: [
      { h: 'The product test' },
      { p: TXL`A two-qubit pure state $a|00\rangle + b|01\rangle + c|10\rangle + d|11\rangle$ is a product state exactly when $ad - bc = 0$. For a product state $(\alpha|0\rangle+\beta|1\rangle)(\gamma|0\rangle+\delta|1\rangle)$ we get $ad - bc = \alpha\gamma\beta\delta - \alpha\delta\beta\gamma = 0$. For $|\Phi^+\rangle$, $ad - bc = \tfrac12 \neq 0$.` },
      { m: TXL`\text{entangled} \iff ad - bc \neq 0, \qquad \text{concurrence } C = 2|ad - bc| \in [0, 1]` },
      { h: 'The view from one qubit' },
      { p: TXL`If you only hold q0, all you can know is its reduced state (the partial trace over q1). For a product state it is pure: a full-length Bloch arrow. For an entangled state it is mixed: the arrow is shorter than 1. For a Bell state it has length 0, a completely random qubit. Its purity $\mathrm{tr}\,\rho^2$ goes from 1 (product) down to 1/2 (maximally entangled).` },
      { w: { type: 'lab', n: 2, circuit: 'RY 0 a; CX 0 1', slider: { name: 'a', label: 'θ', min: 0, max: 3.1416, value: 0.7854 }, show: ['probs', 'bloch', 'ent'], caption: 'Ry(θ) then CNOT makes cos(θ/2)|00⟩ + sin(θ/2)|11⟩. Slide θ: at 0 it is a product state; at π/2 it is a Bell state; the arrows shrink as entanglement grows.' } },
      { key: 'Entanglement means the whole has a definite state while its parts don’t. The shorter a qubit’s Bloch arrow, the more entangled it is with the rest.' },
      { q: { type: 'num', concept: 'separable', q: TXL`For $\tfrac12(|00\rangle + |01\rangle + |10\rangle + |11\rangle)$, what is $ad - bc$?`, answer: 0, tol: 0.001, why: TXL`$\tfrac12\cdot\tfrac12 - \tfrac12\cdot\tfrac12 = 0$: it is the product $|+\rangle|+\rangle$.` } },
      { q: { type: 'mcq', concept: 'separable', q: TXL`What is the length of q0’s Bloch vector in $|\Phi^+\rangle$?`, choices: [{ t: '0', ok: true, why: 'q0 alone is completely random: its reduced state is I/2.' }, { t: '1', why: 'A length-1 arrow means q0 has a pure state of its own, which is not the case for an entangled pair.' }, { t: '1/√2', why: 'That would be partly entangled; Bell states are maximally entangled.' }] } },
      { q: { type: 'num', concept: 'separable', q: TXL`What is the concurrence $2|ad - bc|$ of $\cos\tfrac{\pi}{8}|00\rangle + \sin\tfrac{\pi}{8}|11\rangle$? (3 decimals)`, answer: 0.7071, tol: 0.003, why: TXL`$2\cos\tfrac\pi8\sin\tfrac\pi8 = \sin\tfrac\pi4 \approx 0.707$.` } }],
      summary: ['Product ⇔ ad − bc = 0 (for two qubits, pure states).', 'Entangled qubits have mixed reduced states: Bloch arrows shorter than 1.', 'Bell states are maximally entangled: each qubit alone is completely random.'] },

    { id: 'e3', title: 'Correlations, no-signalling, no-cloning', mins: 13, concepts: ['correlation'], goals: ['Predict Bell-pair correlations in different bases', 'Explain why entanglement can’t send messages'], blocks: [
      { h: 'Correlated in every basis' },
      { p: TXL`$|\Phi^+\rangle$ gives equal results when both qubits are measured in Z. It also gives equal results when both are measured in X: applying H to both qubits leaves $|\Phi^+\rangle$ unchanged. A classical pair of coins that always agree can’t also always agree when both are “rotated” into another basis. This is the first hint that entanglement is stronger than shared randomness.` },
      { w: { type: 'lab', n: 2, gates: ['H', 'X', 'Z', 'S', 'CNOT'], presets: [{ label: 'Measure in Z basis', src: 'H 0; CX 0 1' }, { label: 'Measure in X basis', src: 'H 0; CX 0 1; H 0; H 1' }, { label: 'Mixed bases (Z, X)', src: 'H 0; CX 0 1; H 1' }], show: ['probs', 'steps'], caption: 'Same Bell pair, measured three ways. Matching bases → perfectly correlated. Mismatched bases → no correlation at all.' } },
      { h: 'No-signalling' },
      { p: 'If Alice measures her half of a Bell pair, Bob’s qubit instantly becomes correlated with her result. But Bob’s own statistics don’t change at all: his qubit reads 0 or 1 with 50% each whatever Alice does. Only when they compare notes, over an ordinary channel, do the correlations appear. So entanglement can’t carry a message faster than light.' },
      { h: 'No-cloning' },
      { p: TXL`No machine can copy an unknown quantum state: there is no unitary $U$ with $U|\psi\rangle|0\rangle = |\psi\rangle|\psi\rangle$ for every $|\psi\rangle$. (A CNOT copies $|0\rangle$ and $|1\rangle$, but turns $|+\rangle|0\rangle$ into a Bell state, not $|+\rangle|+\rangle$.) If cloning were possible, Bob could copy his qubit many times and detect Alice’s choice of basis, breaking no-signalling.` },
      { key: 'Entanglement gives correlations, not communication. The rules that forbid cloning are the same rules that keep entanglement from sending messages.' },
      { q: { type: 'mcq', concept: 'correlation', q: TXL`Both halves of $|\Phi^+\rangle$ are measured in the X basis. The results are:`, choices: [{ t: 'Always equal', ok: true, why: 'H⊗H maps Φ+ to itself, so X-basis results agree too.' }, { t: 'Always different', why: 'That is Ψ+ in the Z basis.' }, { t: 'Independent', why: 'Independence happens when the bases don’t match (one Z, one X).' }] } },
      { q: { type: 'mcq', concept: 'correlation', q: 'Why can’t Alice send Bob a message by choosing how to measure her half of a Bell pair?', choices: [{ t: 'Bob’s own outcomes stay 50/50 whatever she does', ok: true }, { t: 'The correlation is destroyed when she measures', why: 'The correlation is still there; Bob just can’t see it without her results.' }, { t: 'Entangled qubits must be less than 1 km apart', why: 'Entanglement has been shown over more than 1000 km.' }] } }],
      summary: ['Bell pairs are correlated in more than one basis.', 'No-signalling: local statistics never depend on the distant choice.', 'No-cloning: unknown states can’t be copied.'] },

    { id: 'e4', title: 'Bell’s inequality: CHSH', mins: 16, concepts: ['chsh'], goals: ['State the CHSH bound', 'Compute S for a Bell pair', 'Explain what a violation rules out'], blocks: [
      { h: 'Could the results be pre-arranged?' },
      { p: 'Maybe each pair carries hidden instructions saying what to answer for each measurement. John Bell showed that such local hidden variables make a testable prediction, and quantum mechanics breaks it.' },
      { h: 'The CHSH game' },
      { p: TXL`Alice picks one of two measurement directions $a$ or $a'$, Bob picks $b$ or $b'$; each gets ±1. Let $E(a,b)$ be the average of the product of their answers. Any local hidden-variable model obeys` },
      { m: TXL`S = E(a,b) + E(a,b') + E(a',b) - E(a',b'), \qquad |S| \le 2` },
      { p: TXL`For $|\Phi^+\rangle$ with measurement directions at angles θ in the x–z plane of the Bloch sphere, quantum mechanics predicts $E = \cos(\theta_A - \theta_B)$. With $\theta_a = 0$, $\theta_{a'} = \pi/2$, $\theta_b = \pi/4$, $\theta_{b'} = -\pi/4$:` },
      { m: TXL`S = \cos\tfrac\pi4 + \cos\tfrac\pi4 + \cos\tfrac\pi4 - \cos\tfrac{3\pi}{4} = 4\cdot\tfrac{\sqrt2}{2} = 2\sqrt2 \approx 2.83` },
      { w: { type: 'chsh', caption: 'Turn the four measurement angles. The bar is S; the dashed line is the classical limit 2. The best any quantum strategy can do is 2√2 (Tsirelson’s bound).' } },
      { key: 'Experiments measure S ≈ 2.8 > 2. No theory in which outcomes are fixed in advance and nothing travels faster than light can explain the results (the 2022 Nobel Prize in Physics).' },
      { q: { type: 'num', concept: 'chsh', q: 'What is the largest value of S a Bell pair can reach? (2 decimals)', answer: 2.8284, tol: 0.01, why: '2√2 ≈ 2.83 (Tsirelson’s bound).' } },
      { q: { type: 'mcq', concept: 'chsh', q: 'Measuring S = 2.7 in an experiment rules out:', choices: [{ t: 'Local hidden-variable explanations', ok: true }, { t: 'Quantum mechanics', why: 'Quantum mechanics predicts values up to 2.83.' }, { t: 'Faster-than-light communication being impossible', why: 'No-signalling still holds; the violation is about correlations.' }] } },
      { q: { type: 'num', concept: 'chsh', q: TXL`With $E = \cos(\theta_A - \theta_B)$, what is $E$ when both measure at the same angle?`, answer: 1, tol: 0.001, why: 'cos 0 = 1: perfectly correlated.' } }],
      summary: ['Local hidden variables ⇒ |S| ≤ 2.', 'A Bell pair reaches S = 2√2 ≈ 2.83.', 'Violations rule out local pre-arranged answers.'] },

    { id: 'e5', title: 'Teleportation', mins: 16, concepts: ['teleport'], goals: ['Follow the teleportation protocol', 'Explain why it needs two classical bits'], blocks: [
      { h: 'Moving a state without moving the qubit' },
      { p: 'Alice holds an unknown qubit |ψ⟩ and shares a Bell pair with Bob. She wants Bob to end up with |ψ⟩. She can’t measure |ψ⟩ (that would destroy it) or copy it (no-cloning). Teleportation uses the Bell pair plus two ordinary bits.' },
      { h: 'The protocol' },
      { p: '1. Alice and Bob share Φ+ on q1 (Alice) and q2 (Bob). 2. Alice applies CNOT from q0 (|ψ⟩) to q1, then H on q0. 3. She measures q0 and q1 and sends the two bits to Bob. 4. Bob applies X if q1 read 1, then Z if q0 read 1. His qubit is now |ψ⟩.' },
      { m: TXL`|\psi\rangle|\Phi^+\rangle = \tfrac12\sum_{m_0,m_1}|m_0 m_1\rangle \otimes X^{m_1}Z^{m_0}|\psi\rangle` },
      { p: 'The identity above shows why it works: after Alice’s operations, each of her four outcomes leaves Bob with |ψ⟩ up to a known Pauli, which he undoes. The interactive version replaces measurement + classical control with controlled gates (the principle of deferred measurement), which gives the same result.' },
      { w: { type: 'lab', n: 3, circuit: 'RY 0 a; H 1; CX 1 2; CX 0 1; H 0; CX 1 2; CZ 0 2', slider: { name: 'a', label: 'input θ', min: 0, max: 3.1416, value: 1.0472 }, show: ['bloch', 'steps'], caption: 'Slide θ to choose the input on q0. After the protocol, q2’s arrow matches the input exactly, and q0 no longer holds it.' } },
      { key: 'Teleportation transfers a state using one Bell pair and two classical bits. The original is destroyed (no cloning), and nothing arrives faster than the classical bits (no signalling).' },
      { q: { type: 'num', concept: 'teleport', q: 'How many classical bits must Alice send to teleport one qubit?', answer: 2, tol: 0.001, why: 'Her two measurement results tell Bob which of four Paulis to apply.' } },
      { q: { type: 'mcq', concept: 'teleport', q: 'After teleportation, what is left in Alice’s original qubit?', choices: [{ t: 'Not |ψ⟩: its state was used up by her measurement', ok: true }, { t: 'A copy of |ψ⟩', why: 'That would be cloning.' }, { t: 'Half of |ψ⟩', why: 'States don’t split into halves; Alice is left with a random measurement result.' }] } },
      { q: { type: 'mcq', concept: 'teleport', q: 'If Alice measures 1 on q1 and 0 on q0, Bob applies:', choices: [{ t: 'X', ok: true }, { t: 'Z', why: 'Z is for q0 = 1.' }, { t: 'Nothing', why: 'Only when both bits are 0.' }] } }],
      summary: ['Resources: one Bell pair + two classical bits.', 'Bob fixes his qubit with X^{m1} Z^{m0}.', 'Consistent with no-cloning and no-signalling.'] }],
    assessment: { pass: 0.7, items: [
      { type: 'build', concept: 'bell', lesson: 'e1', q: TXL`Build $|\Phi^-\rangle = (|00\rangle - |11\rangle)/\sqrt2$.`, n: 2, gates: ['H', 'X', 'Z', 'CNOT'], target: 'X 0; H 0; CX 0 1', solution: 'X on q0, H on q0, then CNOT (or Φ+ then Z)' },
      { type: 'mcq', concept: 'bell', lesson: 'e1', q: TXL`Which outcome never appears when measuring $|\Phi^+\rangle$?`, choices: [{ t: '01', ok: true }, { t: '00', why: '00 appears half the time.' }, { t: '11', why: '11 appears half the time.' }] },
      { type: 'mcq', concept: 'separable', lesson: 'e2', q: TXL`Is $\tfrac{1}{\sqrt2}(|00\rangle + |01\rangle)$ entangled?`, choices: [{ t: 'No: it equals |0⟩ ⊗ |+⟩', ok: true, why: 'ad − bc = (1/√2)(0) − (1/√2)(0) = 0.' }, { t: 'Yes: it is a superposition of two-qubit states', why: 'Superposition alone isn’t entanglement; this one factorises.' }, { t: 'Only if measured', why: 'Entanglement is a property of the state, not of measurement.' }] },
      { type: 'num', concept: 'separable', lesson: 'e2', q: TXL`What is the purity of one qubit of a Bell pair?`, answer: 0.5, tol: 0.005, why: 'Its reduced state is I/2, and tr(I/2)² = 1/2.' },
      { type: 'mcq', concept: 'correlation', lesson: 'e3', q: 'Which statement is true?', choices: [{ t: 'Entanglement creates correlations but cannot send information by itself', ok: true }, { t: 'Measuring one qubit of a pair sends a signal to the other', why: 'No-signalling: the other side’s statistics don’t change.' }, { t: 'A CNOT can clone any state', why: 'It copies only |0⟩ and |1⟩.' }] },
      { type: 'num', concept: 'chsh', lesson: 'e4', q: 'What is the maximum of |S| for local hidden-variable models?', answer: 2, tol: 0.001, why: 'The CHSH inequality: |S| ≤ 2.' },
      { type: 'mcq', concept: 'teleport', lesson: 'e5', q: 'Teleportation does not violate relativity because:', choices: [{ t: 'Bob needs Alice’s two classical bits, which travel at most at light speed', ok: true }, { t: 'Bell pairs only work at short range', why: 'Distance is not the limit.' }, { t: 'The state is copied, not moved', why: 'It is moved; no-cloning forbids copying.' }] },
      { type: 'num', concept: 'teleport', lesson: 'e5', q: 'How many Bell pairs are used up to teleport one qubit?', answer: 1, tol: 0.001, why: 'One shared Bell pair per teleported qubit.' }] }
  });
  /* =================================================================
     MODULE 4 · ALGORITHMS
  ================================================================= */
  M.push({ id: 'algorithms', n: 4, title: 'Algorithms', tint: 'lime', blurb: 'Oracles and Deutsch–Jozsa, Bernstein–Vazirani, Grover search, the quantum Fourier transform, phase estimation and Shor.', lessons: [
    { id: 'a1', title: 'Oracles and Deutsch–Jozsa', mins: 16, concepts: ['oracle', 'dj'], goals: ['Build a phase oracle with kickback', 'Run Deutsch–Jozsa and read the answer'], blocks: [
      { h: 'The problem' },
      { p: TXL`You are given a function $f: \{0,1\}^n \to \{0,1\}$ that is promised to be either constant (the same output for every input) or balanced (0 on exactly half the inputs). Which is it? Classically, in the worst case you must check $2^{n-1} + 1$ inputs.` },
      { h: 'An oracle is a reversible f' },
      { p: TXL`Quantum circuits must be reversible, so f is built as an oracle $U_f|x\rangle|y\rangle = |x\rangle|y \oplus f(x)\rangle$. Put the output qubit in $|-\rangle$ and phase kickback turns it into a phase oracle:` },
      { m: TXL`U_f\,|x\rangle|-\rangle = (-1)^{f(x)}|x\rangle|-\rangle` },
      { h: 'The algorithm' },
      { p: TXL`Put the inputs in uniform superposition with H on each, query the phase oracle once, and apply H to each input again. The amplitude of $|0\ldots0\rangle$ is $\frac{1}{2^n}\sum_x (-1)^{f(x)}$: it is ±1 if f is constant and exactly 0 if f is balanced. One query decides.` },
      { w: { type: 'lab', n: 3, measure: [0, 1], presets: [{ label: 'f = 0 (constant)', src: 'X 2; H 0; H 1; H 2; H 0; H 1' }, { label: 'f = 1 (constant)', src: 'X 2; H 0; H 1; H 2; X 2; H 0; H 1' }, { label: 'f = x₀ (balanced)', src: 'X 2; H 0; H 1; H 2; CX 0 2; H 0; H 1' }, { label: 'f = x₀ ⊕ x₁ (balanced)', src: 'X 2; H 0; H 1; H 2; CX 0 2; CX 1 2; H 0; H 1' }], show: ['probs', 'steps'], caption: 'q0 and q1 are the inputs, q2 the output qubit prepared in |−⟩. Pick an oracle: constant functions always read 00, balanced ones never do.' } },
      { key: 'Quantum parallelism alone is not enough: the H gates at the end make the 2ⁿ phase terms interfere so that one measurement answers a global question about f.' },
      { q: { type: 'mcq', concept: 'dj', q: 'Deutsch–Jozsa measures anything other than 00…0. The function is:', choices: [{ t: 'Balanced', ok: true }, { t: 'Constant', why: 'Constant functions give 00…0 with certainty.' }, { t: 'Can’t tell', why: 'The promise (constant or balanced) makes the answer certain.' }] } },
      { q: { type: 'num', concept: 'dj', q: 'Classically, how many evaluations of f guarantee the answer for n = 3 input bits?', answer: 5, tol: 0.001, why: '2^{n−1} + 1 = 4 + 1 = 5.' } },
      { q: { type: 'mcq', concept: 'oracle', q: 'Why is the output qubit prepared in |−⟩?', choices: [{ t: 'So f(x) is kicked back as a phase (−1)^{f(x)} on |x⟩', ok: true }, { t: 'So the output reads 1 at the end', why: 'The output qubit isn’t read at all.' }, { t: 'To entangle the inputs', why: 'With |−⟩ the output stays unentangled.' }] } }],
      summary: ['Oracle: |x⟩|y⟩ → |x⟩|y⊕f(x)⟩; with |−⟩ it becomes a phase (−1)^{f(x)}.', 'Deutsch–Jozsa: H, oracle, H — one query instead of 2^{n−1}+1.', 'Interference turns many phases into one global answer.'] },

    { id: 'a2', title: 'Bernstein–Vazirani', mins: 12, concepts: ['bv'], goals: ['Recover a hidden bit string in one query'], blocks: [
      { h: 'A hidden string' },
      { p: TXL`Now $f(x) = s\cdot x \bmod 2$ for a secret n-bit string s. Classically each query reveals one bit of s, so you need n queries. Quantumly you need one.` },
      { p: TXL`The phase oracle gives $(-1)^{s\cdot x}|x\rangle$. After the final H gates, the Hadamard transform maps $\frac{1}{\sqrt{2^n}}\sum_x (-1)^{s\cdot x}|x\rangle$ exactly to $|s\rangle$.` },
      { m: TXL`H^{\otimes n}\,\tfrac{1}{\sqrt{2^n}}\textstyle\sum_x (-1)^{s\cdot x}|x\rangle = |s\rangle` },
      { p: 'The oracle is easy to build: for each bit of s that is 1, put a CNOT from that input qubit to the output qubit.' },
      { w: { type: 'lab', n: 4, measure: [0, 1, 2], presets: [{ label: 's = 101', src: 'X 3; H 0; H 1; H 2; H 3; CX 0 3; CX 2 3; H 0; H 1; H 2' }, { label: 's = 011', src: 'X 3; H 0; H 1; H 2; H 3; CX 1 3; CX 2 3; H 0; H 1; H 2' }, { label: 's = 110', src: 'X 3; H 0; H 1; H 2; H 3; CX 0 3; CX 1 3; H 0; H 1; H 2' }], show: ['probs', 'steps'], caption: 'Three input qubits (q0–q2) and an output qubit (q3) in |−⟩. One run reveals s.' } },
      { q: { type: 'mcq', concept: 'bv', q: 'The oracle has CNOTs from q0 and q2 into the output. Measuring the inputs gives:', choices: [{ t: '101', ok: true }, { t: '010', why: 'The CNOTs mark the bits of s that are 1.' }, { t: 'A random string', why: 'The result is deterministic.' }] } },
      { q: { type: 'num', concept: 'bv', q: 'How many classical queries are needed to learn a 3-bit s?', answer: 3, tol: 0.001, why: 'Query x = 100, 010, 001: each reveals one bit.' } }],
      summary: ['f(x) = s·x mod 2; one quantum query reveals s.', 'The Hadamard transform turns the phase pattern into |s⟩.'] },

    { id: 'a3', title: 'Grover’s search', mins: 18, concepts: ['grover'], goals: ['Explain amplitude amplification geometrically', 'Choose the number of iterations'], blocks: [
      { h: 'Unstructured search' },
      { p: TXL`Among $N = 2^n$ items exactly one is marked, and an oracle recognises it. Classically you need about N/2 guesses on average. Grover’s algorithm needs about $\frac{\pi}{4}\sqrt N$ queries: a quadratic speed-up.` },
      { h: 'Two reflections make a rotation' },
      { p: TXL`Start in the uniform superposition $|s\rangle$. Each Grover iteration applies the oracle (flip the sign of the marked item) and the diffusion operator $2|s\rangle\langle s| - I$ (reflect every amplitude about the mean). Two reflections are a rotation: each iteration turns the state by $2\theta$ toward the marked item, where $\sin\theta = 1/\sqrt N$.` },
      { m: TXL`P_{\text{success}}(k) = \sin^2\big((2k+1)\theta\big), \qquad k_{\text{best}} \approx \tfrac{\pi}{4}\sqrt N` },
      { w: { type: 'grover', caption: 'Choose the number of qubits and iterations. Success rises like a sine wave and falls again if you overshoot.' } },
      { p: 'For N = 4 (two qubits), θ = 30° and one iteration lands exactly on the answer.' },
      { w: { type: 'lab', n: 2, circuit: 'H 0; H 1; CZ 0 1; H 0; H 1; X 0; X 1; CZ 0 1; X 0; X 1; H 0; H 1', show: ['probs', 'field', 'steps'], caption: 'Two-qubit Grover marking |11⟩: oracle = CZ, diffusion = H, X, CZ, X, H. One iteration gives |11⟩ with certainty.' } },
      { key: 'Grover’s algorithm rotates the state toward the answer by a fixed angle per query. Stop at about (π/4)√N iterations: more iterations rotate past the answer.' },
      { q: { type: 'num', concept: 'grover', q: 'About how many Grover iterations are best for N = 16? (whole number)', answer: 3, tol: 0.001, why: 'θ = arcsin(1/4) ≈ 14.5°; (2k+1)θ ≈ 90° at k ≈ 2.6, so 3 iterations (success ≈ 96%).' } },
      { q: { type: 'num', concept: 'grover', q: 'What is the success probability after 1 iteration with N = 4?', answer: 1, tol: 0.005, why: 'θ = 30°, (2·1+1)·30° = 90°, sin² 90° = 1.' } },
      { q: { type: 'mcq', concept: 'grover', q: 'What happens if you run twice the optimal number of iterations?', choices: [{ t: 'The success probability falls again', ok: true, why: 'The state keeps rotating past the marked item.' }, { t: 'It stays at 100%', why: 'Grover iterations are a rotation, not a projection.' }, { t: 'It becomes 50%', why: 'It oscillates as sin²((2k+1)θ).' }] } }],
      summary: ['Oracle + diffusion = rotation by 2θ, sin θ = 1/√N.', '≈ (π/4)√N iterations: quadratic speed-up.', 'Overshooting lowers the success probability.'] },

    { id: 'a4', title: 'The quantum Fourier transform', mins: 16, concepts: ['qft'], goals: ['State what the QFT does', 'See phases as clock hands', 'Know its cost'], blocks: [
      { h: 'Definition' },
      { m: TXL`\mathrm{QFT}\,|x\rangle = \frac{1}{\sqrt N}\sum_{y=0}^{N-1} e^{2\pi i\,xy/N}\,|y\rangle` },
      { p: TXL`The QFT is the discrete Fourier transform applied to the amplitudes. On a basis state $|x\rangle$ it gives a uniform superposition in which the phase of $|y\rangle$ turns by $2\pi x/N$ per step: every output has the same size $1/\sqrt N$, and the information about x is entirely in the phases.` },
      { h: 'The circuit' },
      { p: 'For n qubits: an H on each qubit followed by controlled phase rotations P(π/2), P(π/4), … from the less significant qubits, then swaps to reverse the order. That is n(n+1)/2 gates, O(n²), versus O(n·2ⁿ) for a classical FFT on 2ⁿ numbers. The catch: you can’t read the amplitudes out, so the QFT is useful only inside algorithms like phase estimation.' },
      { w: { type: 'lab', n: 3, qft: true, slider: { name: 'x', label: 'input x', min: 0, max: 7, step: 1, value: 3, integer: true }, show: ['field', 'probs'], caption: 'Choose x. After the QFT every outcome is equally likely (12.5%), and the needles turn by x/8 of a full turn from one |y⟩ to the next.' } },
      { key: 'The QFT writes a number into phases. Measuring immediately gives a random y; the power comes from feeding those phases into interference.' },
      { q: { type: 'num', concept: 'qft', q: 'After the QFT on 3 qubits applied to any basis state, what is the probability of each outcome?', answer: 0.125, tol: 0.001, why: '|1/√8|² = 1/8.' } },
      { q: { type: 'mcq', concept: 'qft', q: TXL`$\mathrm{QFT}|0\rangle$ is:`, choices: [{ t: 'The uniform superposition, all phases 0', ok: true }, { t: '|0⟩', why: 'The QFT spreads a basis state over all outputs.' }, { t: 'A random basis state', why: 'The QFT is unitary and deterministic.' }] } },
      { q: { type: 'num', concept: 'qft', q: 'How many gates (H plus controlled phases, no swaps) does the QFT on 4 qubits use?', answer: 10, tol: 0.001, why: 'n(n+1)/2 = 4·5/2 = 10.' } }],
      summary: ['QFT|x⟩ = (1/√N) Σ e^{2πixy/N}|y⟩.', 'O(n²) gates for 2ⁿ amplitudes.', 'Its output hides x in phases, used by phase estimation.'] },

    { id: 'a5', title: 'Phase estimation and Shor’s algorithm', mins: 20, concepts: ['qpe', 'shor'], goals: ['Explain phase estimation', 'Follow Shor’s reduction from factoring to period finding'], blocks: [
      { h: 'Phase estimation' },
      { p: TXL`A unitary U has an eigenstate $|u\rangle$ with $U|u\rangle = e^{2\pi i\varphi}|u\rangle$. Phase estimation reads φ into t qubits. Put the t counting qubits in $|+\rangle$, apply controlled-$U^{2^k}$ from counting qubit k (kickback writes phase $2\pi\varphi 2^k$ onto it), then apply the inverse QFT. If φ has an exact t-bit binary expansion, the readout is exactly $\varphi\cdot 2^t$.` },
      { m: TXL`\tfrac{1}{\sqrt{2^t}}\sum_{y} e^{2\pi i \varphi y}|y\rangle \xrightarrow{\ \mathrm{QFT}^{-1}\ } |\varphi\, 2^t\rangle` },
      { w: { type: 'qpe', caption: 'Choose the phase φ and the number of counting qubits t. Exact binary fractions give one sharp peak; others spread over the nearest values.' } },
      { h: 'Shor’s algorithm' },
      { p: TXL`To factor N: pick a random a coprime to N. The function $a^x \bmod N$ repeats with some period r (the order of a). Phase estimation on the unitary $U|y\rangle = |ay \bmod N\rangle$ returns a number close to $j/r$ for random j, and continued fractions recover r. If r is even and $a^{r/2} \not\equiv -1 \pmod N$, then $\gcd(a^{r/2} \pm 1, N)$ are factors.` },
      { p: TXL`Example, N = 15 and a = 7: $7^1 = 7, 7^2 = 49 \equiv 4, 7^3 \equiv 13, 7^4 \equiv 1$, so r = 4. Then $7^2 = 49$, $\gcd(48, 15) = 3$ and $\gcd(50, 15) = 5$: 15 = 3 × 5.` },
      { key: 'Shor’s algorithm factors in polynomial time by finding a period with phase estimation. Only the period finding is quantum; the rest is classical number theory.' },
      { q: { type: 'num', concept: 'qpe', q: TXL`φ = 0.375 with t = 3 counting qubits. What number y does phase estimation read? (as an integer)`, answer: 3, tol: 0.001, why: '0.375 × 2³ = 3 (binary 011).' } },
      { q: { type: 'num', concept: 'shor', q: 'What is the order r of a = 2 modulo N = 15?', answer: 4, tol: 0.001, why: '2, 4, 8, 16 ≡ 1: r = 4.' } },
      { q: { type: 'num', concept: 'shor', q: TXL`Using r = 4 for a = 2, N = 15: what is $\gcd(2^{2} + 1, 15)$?`, answer: 5, tol: 0.001, why: 'gcd(5, 15) = 5.' } },
      { q: { type: 'mcq', concept: 'shor', q: 'Which part of Shor’s algorithm needs a quantum computer?', choices: [{ t: 'Finding the period r of aˣ mod N', ok: true }, { t: 'Computing gcd(a^{r/2} ± 1, N)', why: 'Euclid’s algorithm is fast classically.' }, { t: 'Choosing a at random', why: 'That is classical.' }] } }],
      summary: ['Phase estimation: controlled-U^{2^k} + inverse QFT reads φ.', 'Shor: factoring → order finding → phase estimation.', 'gcd(a^{r/2} ± 1, N) gives the factors.'] }],
    assessment: { pass: 0.7, items: [
      { type: 'mcq', concept: 'oracle', lesson: 'a1', q: TXL`A phase oracle maps $|x\rangle$ to:`, choices: [{ t: TXL`$(-1)^{f(x)}|x\rangle$`, ok: true }, { t: TXL`$|f(x)\rangle$`, why: 'That is not reversible in general.' }, { t: TXL`$|x \oplus f(x)\rangle$`, why: 'The standard oracle XORs into a separate output qubit.' }] },
      { type: 'mcq', concept: 'dj', lesson: 'a1', q: 'Deutsch–Jozsa on a constant f returns:', choices: [{ t: 'All zeros with certainty', ok: true }, { t: 'A random string', why: 'Interference makes the result certain.' }, { t: 'The value f(0)', why: 'A global phase ±1 can’t be seen.' }] },
      { type: 'num', concept: 'bv', lesson: 'a2', q: 'How many oracle queries does Bernstein–Vazirani need for a 20-bit s?', answer: 1, tol: 0.001, why: 'Always one quantum query.' },
      { type: 'num', concept: 'grover', lesson: 'a3', q: 'N = 1024 items. Roughly how many Grover iterations are optimal? (nearest integer)', answer: 25, tol: 1.01, why: '(π/4)√1024 = (π/4)·32 ≈ 25.' },
      { type: 'mcq', concept: 'grover', lesson: 'a3', q: 'Grover’s speed-up over classical search is:', choices: [{ t: 'Quadratic', ok: true }, { t: 'Exponential', why: 'It is √N versus N.' }, { t: 'None', why: 'It needs about √N queries instead of N/2.' }] },
      { type: 'num', concept: 'qft', lesson: 'a4', q: TXL`In QFT$|x\rangle$ on n = 2 qubits (N = 4) with x = 1, by what angle (in units of π) does the phase turn from one $|y\rangle$ to the next?`, answer: 0.5, tol: 0.001, why: '2πx/N = 2π/4 = π/2.' },
      { type: 'num', concept: 'qpe', lesson: 'a5', q: 'Phase estimation with t = 4 reads y = 12. What is φ?', answer: 0.75, tol: 0.001, why: 'φ = y/2ᵗ = 12/16.' },
      { type: 'num', concept: 'shor', lesson: 'a5', q: 'What is the order of 7 modulo 15?', answer: 4, tol: 0.001, why: '7, 4, 13, 1: r = 4.' }] }
  });

  const all = () => M.flatMap(m => m.lessons.map(l => ({ m, l })));
  return {
    modules: M,
    module(id) { return M.find(m => m.id === id) || null; },
    lesson(id) { return all().find(x => x.l.id === id) || null; },
    lessons: all,
    next(id) { const a = all(), i = a.findIndex(x => x.l.id === id); return i >= 0 && i < a.length - 1 ? a[i + 1] : null; },
    prev(id) { const a = all(), i = a.findIndex(x => x.l.id === id); return i > 0 ? a[i - 1] : null; },
    concepts() { const out = {}; M.forEach(m => m.lessons.forEach(l => l.concepts.forEach(c => { out[c] = out[c] || { id: c, module: m.id, lesson: l.id, lessonTitle: l.title }; }))); return out; },
    lessonText(l) { return l.blocks.map(b => b.h || b.p || b.key || b.aside || b.m || (b.q && b.q.q) || '').filter(Boolean).join('\n'); }
  };
})();
const CONCEPT_NAMES = { state: 'Qubit states', born: 'Born rule', measure: 'Measurement', phase: 'Phase', bloch: 'Bloch sphere', unitary: 'Unitary gates', pauli: 'Pauli gates', hadamard: 'Hadamard', interference: 'Interference', rotation: 'Rotations', multi: 'Multi-qubit states', cnot: 'Controlled gates', bell: 'Bell states', separable: 'Separability', correlation: 'Correlations', chsh: 'CHSH', teleport: 'Teleportation', oracle: 'Oracles', dj: 'Deutsch–Jozsa', bv: 'Bernstein–Vazirani', grover: 'Grover search', qft: 'QFT', qpe: 'Phase estimation', shor: 'Shor’s algorithm' };
