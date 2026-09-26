# QUBIQ: Implementation Plan to Finish the Workbench

Status date: 26 September 2026. This plan covers everything in the Build Prompt that is not done yet. It is ordered so that each phase leaves the app shippable and honest.

**How to read this plan.** Each phase lists:

- the goal;
- tasks with the files they touch;
- **acceptance tests** (a phase is done only when these pass);
- an estimate in focused engineer-days (d).

The phases after P1 can run in parallel where the dependency graph allows.

---

## 0. Where we are

| Area | State |
|---|---|
| Design system and all learning surfaces (course, algorithms, Practice, Notebook, Classroom, Laboratory composer) | ✅ shipped (artifact v4) |
| IR v1 (JSON Schema, TS, pydantic) | ✅ |
| Runner: `/run`, `/run/batch` SSE, `/compare`, `/exec`, `/convert`, `/transpile`, `/backends`, `/health`, `/ibm/jobs` | ✅ code; ✅ smoke-tested locally (IBM untested, needs a token) |
| Real SDK execution: Aer (7 modes), Cirq (2), PennyLane (3), qBraid (1 local, 1 remote) | ✅ verified |
| Shared noise model, provenance object | ✅ |
| Cross-validation | 🟡 starter: 5 circuits × 4 backends, 31 checks green |
| Dockerfiles and compose | 🟡 written, not yet run (no daemon in the build environment) |
| Frontend ↔ runner wiring, provenance badges, offline state | ❌, and this is the **only current honesty violation** |
| Every other Build Prompt feature | ❌ (below) |

## Definition of done (from the Build Prompt) and where each item lands

| # | Criterion | Phase |
|---|---|---|
| D1 | A 10-qubit circuit runs on Aer, Cirq and PennyLane from the UI | P1 (runner side already green in crossval) |
| D2 | ≥ 40 circuits × 4 backends validation, all green, with a Validation page | P2 |
| D3 | Scripts discovered as circuit cards | P4 |
| D4 | Block Library builds Grover-SAT, QPE, Shor-15 and QAOA in < 1 min each | P5 |
| D5 | Experiment grid: 2 params × 3 noise levels × 3 backends | P6 |
| D6 | VQE H₂ within 1.6 mHa on PennyLane with parameter-shift | P7 |
| D7 | `docker compose up` runs the whole stack | P0 |
| D8 | No mislabelled SDK anywhere | P1 (plus a CI lint in P11) |

## Dependency graph

```
P0 infra ──► P1 runner client ──┬─► P2 validation ──► P11 CI/release
                                ├─► P3 compare card
                                ├─► P4 script mode ──► P5 blocks/registers
                                ├─► P6 experiments ──► P7 variational
                                ├─► P8 noise & mitigation
                                ├─► P9 debugging tools
                                └─► P10 projects/sharing
P12 browser engine to 20 q, Pyodide spike (independent)
P13 course completion (independent)
```

**Total estimate:** about 74 engineer-days. With two people working the parallel tracks after P1, that is about 7–8 calendar weeks.

---

## P0: Infrastructure hardening (3 d)

**Goal:** `docker compose up` gives a working stack on a clean machine (D7).

**Tasks:**

1. Run `docker compose build && up` on a Docker host. Fix image issues:
   - numpy/scipy wheels for arm64;
   - `docker.io` inside the runner image vs a socket-proxy container;
   - the sandbox image name resolution.
2. Replace the raw `/var/run/docker.sock` mount with `tecnativa/docker-socket-proxy`, allowing only `containers/create|start|wait|delete` (`docker-compose.yml`).
3. Warm the process pool on start-up: an `@app.on_event("startup")` hook that submits a 1-qubit run to each worker, so the 10 s import cost is not paid by the first user (`app.py`).
4. Enforce per-request limits in `run.py`:
   - `shots × 2ⁿ` budget;
   - `n ≤ backend.maxQubits` (already partly done);
   - a 60 s wall-clock timeout per run via `future.result(timeout)`. Also kill and recycle a worker that hangs.
5. Add structured JSON logging (request id, backend, n, ms) and a `/v1/metrics` endpoint in Prometheus text format.
6. Add rate limiting in redis: a token bucket per IP / per user for `/run` and `/exec` (`services/runner/qlab_runner/limits.py`).
7. Add a gVisor profile: document the `runsc` install and test `QLAB_SANDBOX_RUNTIME=runsc`.

**Acceptance tests:**

- On a fresh VM, `docker compose up` → `curl :8765/v1/health` returns ok, and `:8080` loads the app.
- `/v1/exec` with `import socket; socket.create_connection(("1.1.1.1", 80))` fails. A fork bomb is killed. `open('/etc/passwd','w')` fails. A script allocating 3 GB is killed with the "memory limit" message.
- The 101st `/run` request in a minute from one IP returns 429.

## P1: Runner client, provenance and offline state (4 d), top priority

**Goal:** every SDK-labelled number in the UI really comes from that SDK (D1, D8).

**Tasks:**

1. Add `apps/web/runner.js`, the client:
   - `health()`, `backends()`, `run()`, `batch()` (a fetch-based SSE reader), `exec()`, `convert()`, `transpile()`;
   - base URL from settings (default `http://localhost:8765`, stored in localStorage);
   - AbortController on every call;
   - typed from `packages/ir/index.d.ts` via JSDoc.
2. Rewrite `backends.js`:
   - `runCircuit({circuit, backend})` routes `browser.*` to simlib and everything else to the runner;
   - delete every code path that labels browser results with an SDK name;
   - browser results get `provenance {sdk:"QUBIQ browser engine", where:"browser"}`.
3. Add a `ui.provenanceBadge(prov)` component (`kit.js` and `ui.css`):
   - compact pill `Cirq 1.4.1 · seed 7 · 1024 shots · 12 ms`;
   - expands to the full provenance plus the transpiled circuit.
4. Add the offline state:
   - a runner status dot in the top bar (`shell.js`), polling `/v1/health` every 20 s while the Laboratory is open;
   - when offline, SDK backends in the picker are disabled with the tooltip **"Offline — start the runner"** and a copyable command;
   - Run with an SDK backend selected shows the same message in the result card;
   - **no fallback**.
5. Build the backend picker from `/v1/backends` (`lab.js`):
   - grouped by SDK;
   - shows version, max qubits, noise/state/dynamic chips;
   - unavailable entries show `reason`.
6. Convert composer → IR in `code.js` (`toIR(circuit)`), round-tripping with `qiskit_to_ir` output (bit-order conventions, docs §4).
7. Update Settings → "Runner URL" plus a "Test connection" button.

**Acceptance tests:**

- Stop the runner. Every SDK backend is disabled with the offline message, and zero SDK-labelled results appear anywhere.
- Start the runner. Build a 10-qubit GHZ in the composer, then run it on `aer.statevector`, `cirq.simulator` and `pennylane.default.qubit`. The counts agree, each result shows its badge, and the `where` field is `server`.
- `grep -R "Qiskit\|Cirq\|PennyLane" apps/web/*.js`: every hit is either a runner-provenance render, code generation, or course prose (checked by the P11 lint).
- A Playwright test (`tests/e2e/offline.spec.ts`) covers both states.

## P2: Cross-validation suite and Validation page (6 d)

**Goal:** ≥ 40 circuits × 4 backends, all green, visible in the app (D2).

**Tasks:**

1. Add the corpus `tests/crossval/corpus/*.json`: 40 IR circuits across these categories.

   | Category | Circuits |
   |---|---|
   | Clifford | Bell, GHZ-3/5/10, cluster-4, random Clifford ×3 |
   | Parametric | RX/RY/RZ/U/P sweeps, RXX/RYY/RZZ, ISWAP |
   | Multi-controlled | CCX, CCRY, C3X, CSWAP |
   | Algorithms | QFT-3/5, inverse QFT, Grover-2/3, Deutsch-Jozsa, Bernstein-Vazirani, QPE-3, teleportation (dynamic), phase kickback |
   | Dynamic | mid-circuit measure + reset, register condition, repeat-until-success |
   | Noise | depolarizing only, T1/T2 only, readout only, all three (density backends) |
   | Width | 10, 14 and 20 qubits (state checks capped at 20) |

   Generate them with a `corpus/build.py` script so they are reproducible.
2. Define the backends: `aer.statevector`, `cirq.simulator`, `pennylane.default.qubit`, `qbraid.cirq`. The noise set uses `aer.density_matrix`, `cirq.density_matrix` and `pennylane.default.mixed`.
3. Define the checks per (circuit, backend):
   - statevector or ρ fidelity vs Aer ≥ 1 − 1e-9;
   - χ² p > 1e-3 on 8 000 shots, fixed seed;
   - TVD < 3σ bound;
   - for dynamic circuits, counts only.

   Unsupported combinations are marked `skip(reason)`, never counted as a pass.
4. Add the report `tests/crossval/report.py`: writes `validation.json` (matrix of status, metric and ms, plus SDK versions and git SHA).
5. Add the runner endpoint `GET /v1/validation`: serves the latest `validation.json`. `POST /v1/validation/run` (admin) reruns in the background.
6. Build the Validation page `apps/web/validation.js` (route `#validation`):
   - a 40 × 4 grid of pastel cells: green pass, grey skip, red fail;
   - click a cell to see the metric, the circuit (score renderer) and both results;
   - a header with the versions and the run date.
7. Add a Notebook → "System checks" link to the page.

**Acceptance tests:**

- `pytest tests/crossval` reports ≥ 160 checks, 0 failures; skips are listed with reasons.
- The Validation page shows the same numbers as the JSON.
- Deliberately corrupting a gate mapping in `build.py` (e.g. SDG → S) turns the relevant cells red.

## P3: Compare card (3 d)

**Goal:** run one circuit on N backends and see how they agree.

**Tasks:**

1. Add a Compare card in the Laboratory (`lab.js`, new `compare.js`):
   - multi-select backends;
   - runs via `runner.batch()`, and cells fill as SSE `result` events arrive.
2. Show an overlaid histogram, one colour per backend, with the exact distribution as an outline when n ≤ 20.
3. Show a matrix of TVD and Hellinger fidelity, plus χ² p vs exact per backend. Show a plain-language verdict ("agree within shot noise" / "disagree: p = 2e-7") and a tooltip that explains each metric.
4. Export CSV/JSON of the counts plus provenance (`downloads` capability).

**Acceptance tests:**

- Bell on Aer, Cirq, PennyLane and qBraid: every pair has TVD < 0.05 at 4 000 shots, and the verdict reads "agree".
- The same circuit on Aer vs `aer.fake_sherbrooke`: the verdict flags the disagreement.

## P4: Monaco and Script mode (6 d)

**Goal:** write Qiskit/Cirq/PennyLane Python and get circuits back as cards (D3).

**Tasks:**

1. Load Monaco from `cdn.jsdelivr.net/npm/monaco-editor` (CSP-compatible) with the AMD loader, lazy-loaded when Script mode opens. Tasks:
   - theme it from tokens (light and dark);
   - add Python snippets for each SDK;
   - add `qlab.show()` completions.
2. Add the Script mode tab in the Laboratory: editor | output split, with Run (⌘↵) → `runner.exec()`. Outputs: stdout, stderr (with the traceback line highlighted in the editor), and matplotlib figures.
3. Show discovered circuits as cards (`scriptcards.js`):
   - name, SDK chip, qubits and depth, and a "defined at line N" link that jumps the editor;
   - actions: *Open in composer* (IR → composer), *Run on…*, *Compare*;
   - `problems[]` shown as warnings.
4. Two-way sync: composer → "Export to script" generates code with `code.js`; editing the script and re-running updates the cards (no live AST sync, by design).
5. Show errors as Monaco markers from the traceback line numbers.
6. Enforce limits in the UI: a 200 KB code cap and a 30 s spinner with cancel.

**Acceptance tests:**

- The sample script defines `qc` (Qiskit), `c` (Cirq) and `@qml.qnode circuit` → 3 cards with correct line numbers. Opening each in the composer and running it on Aer gives the same distribution as running the script's own simulator.
- `raise ValueError` on line 7 → the marker appears on line 7.
- A script with `plt.plot` → the figure is rendered.

## P5: Registers, custom blocks and the Block Library (8 d)

**Goal:** structured circuits at algorithm scale (D4).

**Tasks:**

1. Registers in the composer (`lab.js`):
   - named quantum and classical registers (IR `registers` already exists);
   - wire labels `a[0]`;
   - register-level conditions in the gate inspector.
2. Custom blocks (subcircuits):
   - select gates, then "Make block" → IR `defs: {name: {n, params, ops}}` plus op `{g:"CALL", name, q, p}`;
   - add `CALL` and `defs` to `schema.json`, `index.d.ts` and `ir.py`;
   - the runner inlines blocks in `Circuit.ordered()`;
   - blocks render as a collapsed box, with expand to inspect;
   - also support controlled blocks and inverse blocks (`CALL` with `inv: true`, `c: [...]`).
3. Block Library panel (`blocks.js`): generators parameterised by a small form, each producing IR.

   | Block | Parameters |
   |---|---|
   | Grover-SAT | CNF clauses → phase oracle with ancillas, diffuser, optimal iterations |
   | QPE | unitary block, precision bits, inverse QFT |
   | Shor-15 | a ∈ {2, 7, 8, 11, 13}, modular multiplication by hard-coded permutation blocks, 4 counting qubits (textbook construction, labelled as such) |
   | QAOA | graph editor (≤ 10 nodes) and p layers → cost/mixer blocks with symbolic γ, β |
   | Also | QFT/IQFT, adder, GHZ, W state, amplitude encoding |

4. Add a "Build" flow: pick a block, fill the form, insert. A timer in the test records how long it takes to build.

**Acceptance tests:**

- Grover-SAT on (x0∨x1)∧(¬x0∨x2) gives the satisfying assignments with > 90 % probability on Aer.
- QPE on P(2π·0.375) with 3 bits reads 011 with probability 1.
- Shor-15 with a = 7 shows peaks at 0, 4, 8, 12, and the classical post-processing returns 3 × 5.
- QAOA p = 1 on a 4-node ring gives cut ≥ 3 after optimisation (uses P7).
- A Playwright script builds each of the four in under 60 s wall time.

## P6: Experiment runner (5 d)

**Goal:** parameter sweeps × noise × backends as a grid (D5).

**Tasks:**

1. Experiment definition (IR sidecar `experiment.json`):
   - `{circuit, sweep: {theta: linspace(0, π, 7), phi: [..]}, noise: [none, low, high], backends: [...], shots, seed, observable?}`.
2. Runner `POST /v1/experiments`: expands the grid, enqueues runs in **redis** (RQ or arq), and streams progress over SSE `GET /v1/experiments/{id}/events`. Results are persisted in postgres table `experiment_runs`.
3. Experiment card (`experiments.js`):
   - grid preview with the total run count and estimated time;
   - progress bar;
   - results as small multiples (one mini-plot per backend × noise, the swept parameter on the x-axis, ⟨O⟩ or P(target) on the y-axis) plus a heatmap for 2-D sweeps;
   - CSV export.
4. Cancel and resume: runs are idempotent by hash `(ir, backend, params, noise, seed, shots)`, which also gives a cache.

**Acceptance tests:**

- A 2-param (3 × 3) × 3-noise × 3-backend grid = 81 runs completes, and each cell has provenance.
- Killing the runner mid-way and restarting resumes from the cache.
- The noiseless ⟨Z⟩ curves of all three backends overlay within 3σ.

## P7: Variational card and VQE (6 d)

**Goal:** VQE for H₂ within 1.6 mHa (chemical accuracy) on PennyLane with parameter-shift (D6).

**Tasks:**

1. Runner `POST /v1/variational` (a long job via the queue):
   - inputs: `{ansatz IR with symbolic params, hamiltonian: [[coef, "ZZII"],…], backend, optimizer: adam|spsa|cobyla|gd, gradient: parameter-shift|finite-diff|spsa|adjoint, steps, lr, init}`.
   - Streams `{step, energy, params, grad_norm}` over SSE.
2. The PennyLane path uses `qml.qnode(..., diff_method="parameter-shift")` with `qml.expval(qml.Hamiltonian)` and PennyLane optimisers. The Aer and Cirq paths use our own parameter-shift over `run.expectation`.
3. Hamiltonian library:
   - H₂ at 0.735 Å (STO-3G, 4-qubit Jordan-Wigner, coefficients hard-coded and verified against `qml.qchem` when available);
   - LiH (frozen-core, 4 q);
   - Heisenberg, TFIM, MaxCut.
   - Exact ground energies are computed by numpy diagonalisation for the reference line.
4. Variational card (`variational.js`):
   - live energy vs step plot with the exact line and a ±1.6 mHa band;
   - parameter trajectories;
   - final state amplitudes;
   - "ansatz" picker (UCCSD-lite double excitation, hardware-efficient).
5. Add an H₂ bond-length sweep as an experiment preset (reuses P6), producing the dissociation curve.

**Acceptance tests:**

- `pennylane.default.qubit`, parameter-shift, Adam lr 0.1, ≤ 100 steps: |E − E_exact| < 1.6 × 10⁻³ Ha, where E_exact(H₂, 0.735 Å, STO-3G) ≈ −1.13730 Ha (asserted against numpy diagonalisation, not a literal). This goes into pytest `tests/variational/test_h2.py`.
- The same on `aer.statevector` with our parameter-shift: agreement within 1e-6.

## P8: Noise editor, fake devices and mitigation (6 d)

**Tasks:**

1. Noise editor card (`noise.js`):
   - p1, p2, T1, T2, gate times and readout, with presets (ideal / near-term / noisy);
   - a live preview of the Bloch-vector shrink and fidelity decay for a chosen gate;
   - the same object is sent to every backend (documentation §7).
2. Fake devices:
   - a coupling-map view for FakeSherbrooke/FakeKyiv, via `/v1/transpile` returning the layout;
   - show SWAP overhead;
   - "run on device noise".
3. Readout mitigation. Runner `POST /v1/mitigate/readout`:
   - calibrate 2ⁿ (n ≤ 6) or tensored per-qubit confusion matrices;
   - apply by constrained least squares (scipy `nnls`) to counts;
   - return raw and mitigated.
4. ZNE. Runner `POST /v1/mitigate/zne`:
   - unitary folding (G → G G† G) at scale factors [1, 3, 5];
   - Richardson and linear extrapolation of ⟨O⟩;
   - return the points plus the fit;
   - implemented in-house (no mitiq dependency needed, optional).
5. UI: a "Mitigation" section on results showing a raw vs mitigated comparison, with badges noting the method and scale factors in provenance.

**Acceptance tests:**

- Bell on `aer.fake_sherbrooke`: readout mitigation raises P(00)+P(11) by ≥ 50 % of the gap to 1.
- ZNE on a 5-layer CNOT chain with p2 = 0.02: the extrapolated ⟨ZZ⟩ error is ≤ ½ the raw error.
- A noise object with all channels gives the same ρ (fidelity > 1 − 1e-9) on `aer.density_matrix`, `cirq.density_matrix` and `pennylane.default.mixed` (already covered by the P2 noise category).

## P9: Debugging tools (6 d)

**Tasks:**

1. Breakpoints. Click a column gutter to set one. The runner `POST /v1/debug` returns snapshots of the statevector or ρ at each breakpoint (Aer `save_statevector(label)` / Cirq `simulate_moment_steps` / PennyLane snapshots; qml.Snapshot). The UI steps through them with ink instruments.
2. Assertions: `ASSERT` pseudo-ops `{g:"ASSERT", kind:"classical|superposition|entangled|product|state", q:[..], expect}`, checked on snapshots (classical means a computational basis state; entangled means reduced purity < 1 − ε). Failures are shown on the circuit.
3. Equivalence: `POST /v1/equivalence {a, b}` compares unitaries up to global phase (n ≤ 12, `qiskit.quantum_info.Operator.equiv`), otherwise uses random-state fidelity tests. The UI offers "Is this the same as…?", especially original vs optimised in `passes.js`.
4. Resources panel: qubits, depth, 2q-count, T-count, gate histogram, and transpiled depth/SWAPs for a chosen fake device (`/v1/transpile`).
5. Entanglement map: pairwise mutual information I(A:B) and single-qubit entropies from the state, drawn as a graph (nodes are qubits sized by S, edges weighted by I). Browser-side for n ≤ 12, otherwise runner-side.

**Acceptance tests:**

- The GHZ-3 breakpoint after H shows |+00⟩ and after the CNOTs shows GHZ.
- An "entangled(0,1)" assertion passes on Bell and fails when the CNOT is removed.
- Equivalence: `H·X·H` ≡ `Z` passes, and `S` ≢ `T` fails.
- The entanglement map of a Bell ⊗ |0⟩ shows one edge of weight 2 bits.

## P10: Projects, versions and sharing (6 d)

**Tasks:**

1. Postgres schema (`services/runner/migrations/001_init.sql` via alembic):
   - `users` (opaque id from the claude.ai `user` capability or a local account);
   - `projects(id, owner, title, created)`;
   - `versions(id, project, parent, ir jsonb, script text, note, created)`;
   - `experiment_runs`;
   - `shares(token, project, version, role)`.
2. API `/v1/projects` CRUD, `/v1/projects/{id}/versions` (append-only), `/v1/share` (create a read-only token). Auth uses bearer tokens for the standalone deployment. In the claude.ai artifact deployment, the existing `db` capability stays the store and the API is not used.
3. UI:
   - Projects list on Home;
   - an autosave draft with explicit "Save version" (with a note);
   - version timeline with diff (gate-level diff of IR: added, removed, moved ops, highlighted in the composer);
   - "Share" → a read-only link that opens the circuit in view mode with "Duplicate to my projects".
4. Export and import of a `.qlab.json` bundle (IR, script, experiments, provenance).

**Acceptance tests:**

- Create, save 3 versions, and diff v1↔v3 to show the right ops. The share link opens read-only in a private window. Duplicate creates a new project.
- A migration round-trip on an empty DB passes.

## P11: CI, release and the honesty lint (3 d)

**Tasks:**

1. GitHub Actions workflow `ci.yml`:
   - web: node tests (runtests, contenttest, t2), build, and Playwright e2e (offline + online with a runner service container);
   - runner: ruff, mypy (lenient), pytest (crossval, variational, api);
   - images: build all three Dockerfiles; on tags, push to GHCR.
2. Honesty lint (`tests/lint_provenance.py`): a static check that every render path that prints an SDK name in a result context goes through `provenanceBadge`, plus an e2e check that with the runner stopped the DOM contains no element with `data-result-sdk` other than `browser`.
3. Nightly job: full crossval (with the 20-qubit width set). Publish `validation.json` as a build artifact, and the Validation page reads it.
4. Release checklist: version bump, CHANGELOG, and re-publishing the artifact bundle.

**Acceptance tests:** a PR that mislabels a browser result fails CI.

## P12: Browser engine to 20 qubits and the Pyodide spike (4 d)

**Tasks:**

1. `simlib.js`:
   - move the statevector to `Float64Array` interleaved re/im;
   - apply gates in-place with bit-mask loops (no per-amplitude objects);
   - move the heavy loops to a Web Worker.

   Target: a 20-qubit, depth-50 circuit in < 2 s on a laptop. Keep the density matrix capped at 10 q.
2. Instruments degrade gracefully above 12 q: top-k amplitudes, a histogram only, no full Bloch grid.
3. Pyodide spike (time-boxed to 1.5 d): load Pyodide from jsdelivr and try `pip install cirq-core` (pure Python) in the browser. Measure load time and memory. Write up whether a "no-runner" Script mode for Cirq-only is viable. Any result must be badged `Cirq (Pyodide, in-browser)`. Qiskit Aer and Lightning cannot run there, since they are native extensions.

**Acceptance tests:**

- The `runtests.js` physics suite still passes.
- New benchmark `bench.js`: 20 q QFT < 2 s, plus a 20 q GHZ statevector norm check.
- The spike write-up is in `docs/pyodide.md`.

## P13: Course completion (≈ 8 d, content)

**Tasks:**

1. Chapter 6 (algorithms) and chapter 12 (hardware and noise), in the existing six-beat lesson format (`course*.js`). Chapter 12 uses P8's noise editor and fake devices as its interactive instruments.
2. Fill the remaining chapters' lessons from the course atlas outline. Each lesson needs:
   - a hook, an instrument, a prediction, a derivation, a challenge graded by `grade.js`, and a recap;
   - `contenttest.js` extended per lesson (at least 2 checks each).
3. Add a "Run for real" button in lessons that routes to the Laboratory with the circuit preloaded and SDK backends selected (uses P1).

**Acceptance tests:** `contenttest.js` passes with the new totals, and every challenge has a solution that the grader accepts.

---

## Suggested schedule (two engineers)

| Week | Engineer A (runner / infra) | Engineer B (frontend) |
|---|---|---|
| 1 | P0 | P1 |
| 2 | P2 corpus + report | P1 finish, P3 |
| 3 | P6 queue + persistence | P2 Validation page, P4 |
| 4 | P7 variational | P4 finish, P5 registers/blocks |
| 5 | P8 mitigation, P9 runner endpoints | P5 Block Library, P6/P7 cards |
| 6 | P10 API + migrations, P11 CI | P8/P9 UI, P10 UI |
| 7 | P12, hardening | P13 content, polish, accessibility pass |

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| SDK version drift breaks conversions (autoray, lightning pairing, qBraid paths) | Pinned `requirements.txt` plus `requirements.lock`; the nightly crossval catches drift. Upgrade one SDK at a time |
| Sandbox escape via docker.sock | Socket proxy (P0), gVisor, no secrets in the sandbox env, a separate runner host for multi-tenant use |
| Long simulations starve the pool | Per-run timeout, the qubit × shots budget, the queue for experiments and VQE, and worker recycling |
| The artifact CSP blocks the runner URL | The published artifact is the offline learning build, and it states "Laboratory SDK backends need a local runner". The full workbench is served by `apps/web` from compose |
| Shor-15 is a textbook special case | It is labelled as a compiled construction in the UI, and the modular exponentiation is not claimed to be general |
| The IBM queue takes hours | Async jobs with polling, a job list in Projects, and a clear queued/running/done status |

## Open decisions (defaults assumed)

1. **Auth for the standalone deployment.** Default: local accounts with bearer tokens. OAuth later.
2. **Job queue library.** Default: `arq` (asyncio and redis, fits FastAPI).
3. **Monaco vs CodeMirror 6.** Default: Monaco, per the Build Prompt. CodeMirror is the fallback if bundle size becomes an issue.
