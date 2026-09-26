/* =====================================================================
   COURSE CATALOGUE + CHAPTER 2 · THE QUBIT
   Copy never hard-codes a physics number: {tokens} are filled from
   `nums`, computed by the simulator, and asserted in the content tests.
===================================================================== */
const TX = String.raw;
const CATALOGUE = [
  { part: 'I', name: 'The qubit and its rules', chapters: [
    [1, 'Vectors and amplitudes', 'Complex numbers, inner products and the notation the rest of the course uses.'],
    [2, 'The qubit', 'State vectors, the Born rule, bases, phase, and the Bloch sphere derived.'],
    [3, 'Gates as rotations', 'Paulis, Hadamard, phase gates and the ZYZ decomposition.'],
    [4, 'Many qubits', 'Tensor products, controlled gates and phase kickback.'],
    [5, 'Measurement in depth', 'Projective and general measurements, mid-circuit readout, feed-forward.'],
    [6, 'Entanglement', 'Bell states, separability, reduced states, entropy, CHSH and no-cloning.']] },
  { part: 'II', name: 'Algorithms', chapters: [
    [7, 'Interference and oracles', 'Deutsch–Jozsa, Bernstein–Vazirani and Simon.'],
    [8, 'The Fourier transform', 'The QFT as clocks, its cost, and its approximate form.'],
    [9, 'Phase estimation', 'Controlled powers, precision, and order finding.'],
    [10, 'Shor’s algorithm', 'From factoring to period finding, for N = 15 and 21.'],
    [11, 'Protocols', 'Teleportation, superdense coding, BB84 and entanglement swapping.'],
    [12, 'Grover and amplitude amplification', 'The geometric proof, overshoot, many solutions, and SAT oracles.']] },
  { part: 'III', name: 'Real machines', chapters: [
    [13, 'Noise and density matrices', 'Mixed states, channels, T1 and T2, readout error.'],
    [14, 'Error correction and compilation', 'Repetition, Shor and surface codes; decomposition and routing.']] },
  { part: 'IV', name: 'Near-term algorithms', chapters: [
    [15, 'Variational algorithms', 'VQE for H₂ and QAOA for MaxCut.'],
    [16, 'Simulation and learning', 'Trotterisation, quantum walks and quantum kernels.']] }
];

const CH2 = {
  id: 2, title: 'The qubit', minutes: 40,
  blurb: 'Five lessons that build the qubit from scratch: what a state is, what measurement does to it, which questions you can ask, why phase hides, and why a sphere holds it all.',
  lessons: [
  /* ----------------------------------------------------------------- 2·1 */
  { id: 'l-2-1', n: 1, title: 'State vectors and kets', concept: 'state-vector', minutes: 8,
    nums: { th: () => fmt.ang(2 * Math.asin(.5)), a0: () => fmt.f(Math.cos(Math.PI / 6), 3), a1: () => fmt.f(Math.sin(Math.PI / 6), 3), amp: () => fmt.f(Math.sqrt(.36), 1) },
    expect: { th: 'π/3', a0: '0.866', a1: '0.500', amp: '0.6' },
    discover: { q: 'A bit is 0 or 1. What else can a qubit be?', scene: { gates: ['X', 'H'] }, prompt: 'Tap X and watch the disks on the right. Reset, then tap H.', goal: i => Math.abs(i.bloch[2]) < .05, done: 'Two half-full disks: the qubit is holding an amplitude for 0 and an amplitude for 1 at the same time.' },
    explore: { scene: { theta: true }, prompt: 'Tilt the arrow with θ until the |1⟩ disk holds a quarter of the ink.', goal: i => Math.abs(i.odds['1'] - .25) < .02, done: 'At θ = {th} the amplitudes are {a0} and {a1}. Square them and they add to exactly 1.', loop: 'Look at the size of the |1⟩ disk, not the length of the arrow: a disk’s area is a probability.' },
    manipulate: { goal: 'Write a circuit that prepares |ψ⟩ = (√3/2)|0⟩ + (1/2)|1⟩.', n: 1, gates: ['RY', 'X', 'H'], spec: { answer: 'RY0(pi/3)', match: 'state' },
      hints: ['Which gate tilts the arrow by an angle you choose?', 'Place an RY on q0. Its θ slider appears under the score when you select it.', 'RY(θ)|0⟩ = cos(θ/2)|0⟩ + sin(θ/2)|1⟩. You need sin(θ/2) = 1/2.'], partial: 'RY0(pi/2)' },
    predict: { kind: 'bins', circuit: 'RY0(pi/3)', q: 'You’ll measure this state 1,000 times. Shape the tray you expect.' },
    understand: {
      intuition: 'A qubit’s state is a pair of numbers — one amplitude for |0⟩, one for |1⟩. Square each and you get the odds of reading that answer, so the squares must add to 1. The arrow is a picture of that pair: tilt it and ink flows from one disk into the other.',
      formal: TX`A pure qubit state is a unit vector in $\mathbb{C}^2$: $|\psi\rangle=\alpha|0\rangle+\beta|1\rangle$ with $|\alpha|^2+|\beta|^2=1$. In components, $|0\rangle=\begin{pmatrix}1\\0\end{pmatrix}$ and $|1\rangle=\begin{pmatrix}0\\1\end{pmatrix}$. A **ket** is a column; its **bra** $\langle\psi|$ is the conjugate transpose, and $\langle\phi|\psi\rangle$ is the inner product.`,
      derive: { circuit: 'RY0(pi/3)', steps: [
        [TX`R_Y(\theta)|0\rangle=\begin{pmatrix}\cos\frac\theta2&-\sin\frac\theta2\\\sin\frac\theta2&\cos\frac\theta2\end{pmatrix}\begin{pmatrix}1\\0\end{pmatrix}`, 'The rotation acts on the column for |0⟩.', 0],
        [TX`=\cos\tfrac\theta2\,|0\rangle+\sin\tfrac\theta2\,|1\rangle`, 'Read off the first column of the matrix.', 1],
        [TX`\theta=\tfrac\pi3:\quad\tfrac{\sqrt3}{2}|0\rangle+\tfrac12|1\rangle`, 'Put in your angle.', 1],
        [TX`\left(\tfrac{\sqrt3}{2}\right)^2+\left(\tfrac12\right)^2=\tfrac34+\tfrac14=1`, 'Normalised, as every state must be.', 1]] },
      research: TX`For $n$ qubits the state is a unit vector in $\mathbb{C}^{2^n}$: $2^n$ complex amplitudes, or $2^{n+1}-2$ real parameters once normalisation and global phase are removed. Fifty qubits already need $2^{50}\approx10^{15}$ amplitudes, which is why brute-force classical simulation of general circuits stalls around 45–50 qubits even on supercomputers — and why this Laboratory stops at 12 in a browser.`,
      cite: 'P. A. M. Dirac, “A new notation for quantum mechanics”, Math. Proc. Cambridge Phil. Soc. 35, 416 (1939). Nielsen & Chuang, Quantum Computation and Quantum Information, §1.2 and §2.1.'
    },
    code: 'RY0(pi/3) M0',
    exercises: [
      { kind: 'build', q: 'Prepare |1⟩ using only H and Z.', n: 1, gates: ['H', 'Z'], spec: { answer: 'H0 Z0 H0', match: 'state', limit: 3 } },
      { kind: 'shape', q: 'Shape the odds for RY(2π/3)|0⟩.', circuit: 'RY0(2*pi/3)' },
      { kind: 'probe', q: 'The state (|0⟩ + |1⟩)/√2 is secretly either 0 or 1 — we just don’t know which.', a: false, mis: 'hidden-value', why: 'A hidden 0-or-1 would still give 50/50 after a second H. At Arrival it gave |0⟩ every time: the two amplitudes interfered, which a hidden coin can’t do.' },
      { kind: 'num', q: 'What real, positive amplitude on |1⟩ gives a 36% chance of reading 1?', a: .6, tol: .005, why: 'Probability is the amplitude squared, so the amplitude is √0.36 = {amp}.' }],
    note: 'A state is two amplitudes whose squares add to 1.'
  },
  /* ----------------------------------------------------------------- 2·2 */
  { id: 'l-2-2', n: 2, title: 'The Born rule and measurement', concept: 'born-rule', minutes: 8,
    nums: { p90: () => fmt.f(Math.pow(Math.sin(2.4981 / 2), 2), 3), pk: () => fmt.f(4 * .25 * Math.pow(.75, 3), 3), p38: () => fmt.f(Math.pow(Math.sin(3 * Math.PI / 8), 2), 3) },
    expect: { p90: '0.900', pk: '0.422', p38: '0.854' },
    discover: { q: 'If the odds of 1 are 25%, what does one measurement give?', scene: { start: 'RY0(pi/3)', measure: true }, prompt: 'Measure the qubit. Each tap prepares a fresh copy and asks it once. Ask ten times.', goal: i => i.measured >= 10, done: 'Every answer was a plain 0 or 1. The 25% never appears in a single shot — only in the pile.' },
    explore: { scene: { theta: true, measure: true, pour: 200 }, prompt: 'Find the tilt where 1 comes up half the time. Pour 200 shots to check.', goal: i => i.poured && Math.abs(i.frac1 - .5) < .06, done: 'Near θ = π/2 the pile splits evenly. The odds are the squared amplitudes — nothing more, nothing less.', loop: 'Watch the |1⟩ disk while you tilt: when its area is half, the pile will be too.' },
    manipulate: { goal: 'Make a circuit whose measurement reads 1 with probability 0.9.', n: 1, gates: ['RY', 'H', 'X'], spec: { answer: 'RY0(2.4981)', match: 'probs' },
      hints: ['The chance of 1 after RY(θ) is sin²(θ/2). What θ makes that 0.9?', 'One RY on q0 is enough. Select it and drag θ; watch the odds under the score.', 'sin(θ/2) = √0.9 ≈ 0.949, so θ ≈ 2.50 rad — just under 4π/5.'], partial: 'RY0(pi/2)' },
    predict: { kind: 'bins', circuit: 'H0 M0 H0 M0', q: 'H, then measure, then H again, then measure. At Arrival two H’s gave |0⟩ every time. What happens with a measurement in between?' },
    understand: {
      intuition: 'Measurement asks the qubit one question — 0 or 1? The answer comes out with probability equal to the squared amplitude. And the question changes the qubit: afterwards it *is* its answer. That’s why the measurement in the middle wiped out the interference you saw at Arrival — there was only one path left.',
      formal: TX`**Born rule.** Measuring $|\psi\rangle=\alpha|0\rangle+\beta|1\rangle$ in the computational basis gives $0$ with probability $|\alpha|^2$ and $1$ with probability $|\beta|^2$, after which the state is $|0\rangle$ or $|1\rangle$. For a projective measurement $\{P_m\}$: $p(m)=\langle\psi|P_m|\psi\rangle$ and $|\psi\rangle\mapsto P_m|\psi\rangle/\sqrt{p(m)}$.`,
      derive: { circuit: 'H0 M0 H0', steps: [
        [TX`H|0\rangle=\tfrac1{\sqrt2}(|0\rangle+|1\rangle)`, 'The first H makes two equal amplitudes.', 0],
        [TX`p(0)=\left|\tfrac1{\sqrt2}\right|^2=\tfrac12\ \Rightarrow\ |0\rangle\ \text{or}\ |1\rangle`, 'The measurement keeps one branch.', 1],
        [TX`H|0\rangle=|+\rangle,\qquad H|1\rangle=|-\rangle`, 'The second H acts on whichever branch survived.', 2],
        [TX`p(0)=\tfrac12\cdot\tfrac12+\tfrac12\cdot\tfrac12=\tfrac12`, 'Both branches give 50/50: nothing is left to interfere.', 2]] },
      research: TX`Measurements generalise to POVMs $\{E_m\}$ with $E_m\succeq0$ and $\sum_m E_m=I$, realised by coupling to an ancilla and measuring it projectively (Naimark’s dilation). The **deferred-measurement principle** says any mid-circuit measurement can be moved to the end by replacing classical control with quantum control; real mid-circuit readout with feed-forward is now routine on superconducting and trapped-ion hardware and underlies teleportation and error correction.`,
      cite: 'M. Born, Zeitschrift für Physik 37, 863 (1926). Nielsen & Chuang §2.2.3 and §4.4.'
    },
    code: 'RY0(2.4981) M0',
    exercises: [
      { kind: 'shape', q: 'Two tilts in a row, π/2 then π/4. Shape the odds.', circuit: 'RY0(pi/2) RY0(pi/4)' },
      { kind: 'num', q: 'RY(θ)|0⟩ reads 1 with probability 0.25. What is θ in radians (0 ≤ θ ≤ π)?', a: Math.PI / 3, tol: .01, why: 'sin²(θ/2) = 0.25 gives θ/2 = π/6, so θ = π/3 ≈ 1.047.' },
      { kind: 'probe', q: 'If P(1) = 0.25, then in four shots you will see exactly one 1.', a: false, mis: 'odds-as-quota', why: 'Shots are independent. Exactly one 1 in four shots happens with probability {pk} — less than half the time.' },
      { kind: 'build', q: 'Make a circuit that reads 1 every single time, using only RY.', n: 1, gates: ['RY'], spec: { answer: 'RY0(pi)', match: 'probs' } }],
    note: 'Measurement returns a plain 0 or 1 with odds |amplitude|², and leaves the qubit in its answer.'
  },
  /* ----------------------------------------------------------------- 2·3 */
  { id: 'l-2-3', n: 3, title: 'Bases: Z, X and Y', concept: 'bases', minutes: 8,
    nums: { pX: () => fmt.f(Math.pow((Math.cos(Math.PI / 6) + Math.sin(Math.PI / 6)) / Math.SQRT2, 2), 3) },
    expect: { pX: '0.933' },
    discover: { q: 'Is |+⟩ random?', scene: { start: 'H0', bases: true }, prompt: 'The qubit is |+⟩. Along Z its odds are 50/50. Now ask the question along X instead.', goal: i => i.basis === 'X', done: 'Along X there is no randomness at all: |+⟩ every time. Whether an answer is random depends on the question you ask.' },
    explore: { scene: { gates: ['H', 'S', 'SDG', 'X', 'Z'], bases: true }, prompt: 'Build a state that is certain along Y. Switch the basis to check.', goal: i => Math.abs(i.bloch[1]) > .99, done: 'Pointing along ±y: certain along Y, and a coin along both Z and X.', loop: 'Y lives on the equator, a quarter-turn from X. Which gate turns the arrow about z by a quarter?' },
    manipulate: { goal: 'Prepare |−i⟩ = (|0⟩ − i|1⟩)/√2, the state that points along −y.', n: 1, gates: ['H', 'S', 'SDG', 'X', 'Z'], spec: { answer: 'H0 SDG0', match: 'state' },
      hints: ['Where on the sphere is −y, and which gate gets you onto the equator first?', 'Start with H: that puts the arrow at +x.', 'From +x, a quarter-turn the other way about z — S† — lands on −y.'], partial: 'H0' },
    predict: { kind: 'arrow', circuit: 'H0 S0 H0', q: 'Where does H, then S, then H leave the arrow? Drag the ghost.' },
    understand: {
      intuition: 'Every measurement picks an axis. Z asks “up or down?”, X asks “front or back?”, Y asks “left or right?”. A state that is certain along one axis is perfectly random along the other two — no qubit can give sharp answers to all three questions.',
      formal: TX`The eigenbases of the Pauli operators are $Z:\ \{|0\rangle,|1\rangle\}$, $X:\ |\pm\rangle=\tfrac1{\sqrt2}(|0\rangle\pm|1\rangle)$ and $Y:\ |\pm i\rangle=\tfrac1{\sqrt2}(|0\rangle\pm i|1\rangle)$. Measuring along $X$ is $H$ followed by a $Z$ measurement, since $H|\pm\rangle=|0\rangle,|1\rangle$; measuring along $Y$ is $S^\dagger$, then $H$, then $Z$.`,
      derive: { circuit: 'H0 H0', steps: [
        [TX`|+\rangle=\tfrac1{\sqrt2}(|0\rangle+|1\rangle)`, 'Start on the equator, at +x.', 0],
        [TX`H|+\rangle=\tfrac12\big[(|0\rangle+|1\rangle)+(|0\rangle-|1\rangle)\big]`, 'Rotate the X question onto Z.', 1],
        [TX`=|0\rangle`, 'The |1⟩ terms cancel.', 1],
        [TX`p_X(+)=|\langle+|+\rangle|^2=1,\qquad p_Z(0)=|\langle0|+\rangle|^2=\tfrac12`, 'Certain along X, a coin along Z.', 1]] },
      research: TX`Bases whose overlaps all satisfy $|\langle a|b\rangle|^2=1/d$ are **mutually unbiased**. In $d=2$ the three Pauli eigenbases form the largest such set; MUBs underlie BB84 key distribution and optimal state tomography. The trade-off here is exact: for any qubit state $\langle X\rangle^2+\langle Y\rangle^2+\langle Z\rangle^2\le1$, with equality for pure states.`,
      cite: 'W. K. Wootters & B. D. Fields, Annals of Physics 191, 363 (1989). Nielsen & Chuang §2.2.5.'
    },
    code: 'H0 SDG0 M0',
    exercises: [
      { kind: 'build', q: 'Prepare |−⟩: certain along X, reading −.', n: 1, gates: ['H', 'X', 'Z'], spec: { answer: 'X0 H0', match: 'state' } },
      { kind: 'shape', q: 'This is RY(π/3)|0⟩ measured along X (an H before the Z readout). Shape the odds.', circuit: 'RY0(pi/3) H0' },
      { kind: 'probe', q: 'A state that is 50/50 along Z must be 50/50 along X as well.', a: false, mis: 'basis-blind', why: '|+⟩ is 50/50 along Z and certain along X.' },
      { kind: 'num', q: '|+i⟩ is measured along X. What is the probability of reading +?', a: .5, tol: .005, why: '|+i⟩ points along +y, a quarter-turn from +x: |⟨+|+i⟩|² = 1/2.' }],
    note: 'Certain along one axis means a coin along the other two.'
  },
  /* ----------------------------------------------------------------- 2·4 */
  { id: 'l-2-4', n: 4, title: 'Global and relative phase', concept: 'phase', minutes: 9,
    nums: { pT: () => fmt.f(Math.pow(Math.cos(Math.PI / 8), 2), 3), phi: () => fmt.ang(2 * Math.PI / 3) },
    expect: { pT: '0.854', phi: '2π/3' },
    discover: { q: 'Can you see a phase?', scene: { theta: false, phi: true, theta0: Math.PI / 2, phiLabel: 'Phase of |1⟩' }, prompt: 'Turn the needle of |1⟩ all the way round. Watch the arrow — and watch the odds.', goal: i => i.turned >= Math.PI * 1.5, done: 'The arrow circled the whole equator and the odds never moved. A relative phase is invisible to a Z measurement.' },
    explore: { scene: { phi: true, theta0: Math.PI / 2, bases: true, basis0: 'X', phiLabel: 'Phase of |1⟩' }, prompt: 'Now the qubit is measured along X — an H before the readout. Find the phase that makes − certain.', goal: i => i.basis === 'X' && i.odds['−'] > .98, done: 'At φ = π the H turns the phase into certainty. Phase stays hidden until something makes the paths interfere.', loop: 'Keep the X basis selected and turn the needle slowly: watch the − bar, not the arrow.' },
    manipulate: { goal: 'Using exactly two H gates, with any phase gates between them, make the measurement read 1 every time.', n: 1, gates: ['H', 'Z', 'S', 'SDG', 'T', 'TDG', 'P', 'RZ'], spec: { answer: 'H0 Z0 H0', match: 'probs', count: { H: 2 } },
      hints: ['Between two H’s, what relative phase turns “certain 0” into “certain 1”?', 'You need a phase of π on |1⟩ between the H’s.', 'Z is a phase of π. So are S·S and T·T·T·T.'], partial: 'H0 H0' },
    predict: { kind: 'needle', circuit: 'H0 T0', q: 'H, then T. What relative phase is left on |1⟩? Turn the needle to your guess; the experiment reads it out through an H.' },
    understand: {
      intuition: 'Only the *difference* in phase between the two amplitudes matters. Turn both by the same amount — a global phase — and no experiment anywhere can tell. Turn one relative to the other and nothing changes along Z; but the moment an H mixes the paths, that phase decides which way they interfere.',
      formal: TX`States that differ by a global phase, $|\psi\rangle$ and $e^{i\gamma}|\psi\rangle$, give identical statistics for every measurement, since $|\langle m|e^{i\gamma}\psi\rangle|^2=|\langle m|\psi\rangle|^2$. A relative phase does change the state: $\tfrac1{\sqrt2}(|0\rangle+e^{i\varphi}|1\rangle)$ has Z-odds $\tfrac12,\tfrac12$ for every $\varphi$, but X-odds $p(+)=\cos^2\tfrac\varphi2$.`,
      derive: { circuit: 'H0 T0 H0', steps: [
        [TX`H|0\rangle=\tfrac1{\sqrt2}(|0\rangle+|1\rangle)`, 'Two equal paths.', 0],
        [TX`P(\varphi):\ \tfrac1{\sqrt2}(|0\rangle+e^{i\varphi}|1\rangle)`, 'Only the |1⟩ path turns: a relative phase.', 1],
        [TX`H:\ \tfrac12\big[(1+e^{i\varphi})|0\rangle+(1-e^{i\varphi})|1\rangle\big]`, 'The two paths to each outcome add up.', 2],
        [TX`p(0)=\tfrac14\,|1+e^{i\varphi}|^2=\cos^2\tfrac\varphi2`, 'φ = 0 gives certain 0; φ = π gives certain 1.', 2],
        [TX`\varphi=\tfrac\pi4\ (T):\quad p(0)\approx{pT}`, 'Your T gate.', 2]] },
      research: TX`Global phase is unobservable — but a *controlled* version of a gate turns its global phase into a relative phase between the control’s branches. This **phase kickback** is the engine of phase estimation and Shor’s algorithm. Relative phases acquired by cyclic evolution (Berry and Pancharatnam phases) are measurable interferometrically and are used in geometric quantum gates.`,
      cite: 'M. V. Berry, Proc. R. Soc. Lond. A 392, 45 (1984). Nielsen & Chuang §2.2.7 and §5.2.'
    },
    code: 'H0 T0 H0 M0',
    exercises: [
      { kind: 'build', q: 'Using only H and S, make the result read 1 every time.', n: 1, gates: ['H', 'S'], spec: { answer: 'H0 S0 S0 H0', match: 'probs' } },
      { kind: 'probe', q: 'Z and −Z are different gates, so some measurement can tell them apart.', a: false, mis: 'global-phase', why: '−Z = e^{iπ}Z differs only by a global phase. Every measurement statistic is identical.' },
      { kind: 'shape', q: 'H, then S, then H. Shape the odds.', circuit: 'H0 S0 H0' },
      { kind: 'num', q: 'After H, P(φ), H the chance of reading 0 is 0.25. What is φ in [0, π], in radians?', a: 2 * Math.PI / 3, tol: .01, why: 'cos²(φ/2) = 0.25 gives φ/2 = π/3, so φ = {phi} ≈ 2.094.' }],
    note: 'Phase stays hidden until paths interfere, and only relative phase ever matters.'
  },
  /* ----------------------------------------------------------------- 2·5 */
  { id: 'l-2-5', n: 5, title: 'The Bloch sphere, derived', concept: 'bloch', minutes: 9,
    nums: { rx: () => fmt.f(Math.sin(Math.PI / 3) * Math.cos(Math.PI / 4), 3), rz: () => fmt.f(Math.cos(Math.PI / 3), 3), z23: () => fmt.f(Math.cos(2 * Math.PI / 3), 1) },
    expect: { rx: '0.612', rz: '0.500', z23: '-0.5' },
    discover: { q: 'Why does a sphere hold every qubit?', scene: { theta: true, phi: true }, prompt: 'Two controls, two angles. Point the arrow along +y: tilt to the equator, then turn.', goal: i => i.bloch[1] > .98, done: 'θ tilts the arrow away from |0⟩; φ turns it around the vertical axis. Two angles reach every point — that’s a sphere.' },
    explore: { scene: { start: 'H0', gates: ['T', 'S', 'H'] }, prompt: 'The arrow starts at +x. Tap T until it comes back where it started, counting the turns.', goal: i => i.ops.filter(o => o.g === 'T').length >= 8 && i.bloch[0] > .99, done: 'Eight eighth-turns make one full circle. Every single-qubit gate is a rotation of this sphere.', loop: 'Each T turns the arrow by π/4 about z. How many make 2π?' },
    manipulate: { goal: 'Point the arrow at θ = π/3, φ = π/4 — Bloch vector ({rx}, {rx}, {rz}).', n: 1, gates: ['RY', 'RZ', 'H', 'S', 'T'], spec: { answer: 'RY0(pi/3) RZ0(pi/4)', match: 'state' },
      hints: ['Two moves: one sets the latitude, one the longitude. Which comes first?', 'Tilt with RY first, then turn with RZ (or T).', 'RY(π/3) sets θ; then RZ(π/4) — or a T — turns it to φ = π/4.'], partial: 'RY0(pi/3)' },
    predict: { kind: 'arrow', circuit: 'RY0(pi/2) T0', q: 'RY(π/2), then T. Drag the ghost to where the arrow ends.' },
    understand: {
      intuition: 'Two complex amplitudes are four real numbers. Normalisation removes one; global phase — invisible, as you saw — removes another. Two angles remain, latitude and longitude, and two angles make a sphere. The poles are the Z answers, the equator holds the equal superpositions, and the arrow’s shadow on each axis is the average you would measure along it.',
      formal: TX`Every pure state can be written $|\psi\rangle=\cos\tfrac\theta2|0\rangle+e^{i\varphi}\sin\tfrac\theta2|1\rangle$ with $\theta\in[0,\pi]$ and $\varphi\in[0,2\pi)$. It maps to the Bloch vector $\vec r=(\sin\theta\cos\varphi,\ \sin\theta\sin\varphi,\ \cos\theta)$, where $r_k=\langle\psi|\sigma_k|\psi\rangle$. Single-qubit unitaries act as rotations: $U=e^{i\alpha}R_{\hat n}(\beta)=e^{i\alpha}e^{-i\beta\,\hat n\cdot\vec\sigma/2}$.`,
      derive: { circuit: 'RY0(pi/3) RZ0(pi/4)', steps: [
        [TX`|\psi\rangle=\alpha|0\rangle+\beta|1\rangle,\quad|\alpha|^2+|\beta|^2=1`, 'Four real numbers, one constraint.', 0],
        [TX`=e^{i\gamma}\big(\cos\tfrac\theta2|0\rangle+e^{i\varphi}\sin\tfrac\theta2|1\rangle\big)`, 'Factor out the global phase γ — it can’t be observed.', 0],
        [TX`\langle Z\rangle=\cos^2\tfrac\theta2-\sin^2\tfrac\theta2=\cos\theta`, 'Height on the sphere.', 1],
        [TX`\langle X\rangle+i\langle Y\rangle=2\,\overline{\alpha}\beta=\sin\theta\,e^{i\varphi}`, 'Longitude is the relative phase.', 2],
        [TX`\theta=\tfrac\pi3,\ \varphi=\tfrac\pi4:\quad\vec r=({rx},\,{rx},\,{rz})`, 'Your target.', 2]] },
      research: TX`Mixed states fill the ball: $\rho=\tfrac12(I+\vec r\cdot\vec\sigma)$ with $|\vec r|\le1$, and purity is $\mathrm{Tr}\,\rho^2=\tfrac12(1+|\vec r|^2)$ — the shrinking arrows of Chapter 6. There is no sphere for two qubits: their pure states form $\mathbb{CP}^3$, a 6-dimensional space, which is why the Laboratory draws one sphere per qubit plus threads for the correlations between them.`,
      cite: 'F. Bloch, Physical Review 70, 460 (1946). Nielsen & Chuang §1.2 and Exercise 4.2.'
    },
    code: 'RY0(pi/3) RZ0(pi/4) M0',
    exercises: [
      { kind: 'build', q: 'Using only H and T, turn |0⟩ into the state at θ = π/2, φ = 3π/4.', n: 1, gates: ['H', 'T'], spec: { answer: 'H0 T0 T0 T0', match: 'state' } },
      { kind: 'shape', q: 'Tilt to θ = 2π/3, then turn about z. Shape the Z odds.', circuit: 'RY0(2*pi/3) RZ0(pi/2)' },
      { kind: 'probe', q: '|0⟩ and |1⟩ are orthogonal states even though their arrows are 180° apart, not 90°.', a: true, mis: 'sphere-angle', why: 'Angles on the sphere are twice the angles between state vectors: |⟨a|b⟩|² = cos²(Θ/2). Θ = 180° gives 0 — orthogonal.' },
      { kind: 'num', q: 'What is ⟨Z⟩ for the state at θ = 2π/3?', a: -.5, tol: .01, why: '⟨Z⟩ = cos θ = cos(2π/3) = {z23}.' }],
    note: 'Two angles: θ from |0⟩, φ around z. Every gate is a rotation of this sphere.'
  }],
  exam: [
    { kind: 'shape', q: 'RY(π/2) then RY(π/6). Shape the odds.', circuit: 'RY0(pi/2) RY0(pi/6)', concept: 'born-rule' },
    { kind: 'shape', q: 'H, Z, H. Shape the odds.', circuit: 'H0 Z0 H0', concept: 'phase' },
    { kind: 'shape', q: 'H, T, T, H. Shape the odds.', circuit: 'H0 T0 T0 H0', concept: 'phase' },
    { kind: 'build', q: 'Prepare |−⟩ using only RY and Z.', n: 1, gates: ['RY', 'Z'], spec: { answer: 'RY0(pi/2) Z0', match: 'state' }, concept: 'bases' },
    { kind: 'build', q: 'Prepare |+i⟩ using only H and S.', n: 1, gates: ['H', 'S'], spec: { answer: 'H0 S0', match: 'state' }, concept: 'bases' },
    { kind: 'build', q: 'Make a circuit that reads 1 with probability 0.75, using only RY.', n: 1, gates: ['RY'], spec: { answer: 'RY0(2*pi/3)', match: 'probs' }, concept: 'state-vector' },
    { kind: 'code', q: 'Write Qiskit code that prepares |−⟩ on qubit 0 of a one-qubit circuit.', lang: 'qiskit', starter: 'from qiskit import QuantumCircuit\n\nqc = QuantumCircuit(1)\n', n: 1, spec: { answer: 'X0 H0', match: 'state' }, concept: 'bases' },
    { kind: 'probe', q: 'Measuring |+⟩ along Z and getting 0 shows it was |0⟩ all along.', a: false, mis: 'hidden-value', why: 'Before the measurement the state was |+⟩ — certain along X. The Z question created the answer.', concept: 'born-rule' },
    { kind: 'probe', q: 'Multiplying a state by e^{iπ/2} changes its X-basis odds.', a: false, mis: 'global-phase', why: 'That is a global phase: no statistic of any measurement changes.', concept: 'phase' },
    { kind: 'probe', q: '|+⟩ and |−⟩ have the same Z odds but are different states.', a: true, mis: 'phase-blind', why: 'They differ by a relative phase of π, which an X measurement reads perfectly.', concept: 'phase' },
    { kind: 'num', q: 'After H, P(π/3), H, what is the probability of reading 0?', a: .75, tol: .01, why: 'cos²(π/6) = 0.75.', concept: 'phase' },
    { kind: 'num', q: 'What is the Bloch x-component of RY(π/3)|0⟩?', a: Math.sin(Math.PI / 3), tol: .01, why: 'sin θ cos φ = sin(π/3) ≈ 0.866.', concept: 'bloch' }]
};
const COURSE = { chapters: { 2: CH2 }, lesson(id) { for (const ch of Object.values(this.chapters)) { const l = ch.lessons.find(x => x.id === id); if (l) return { ch, l }; } return null; } };
