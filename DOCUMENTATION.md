# QUBIQ: Technical Documentation

Version 0.1 · September 2026 · monorepo `qlab/`

QUBIQ has two parts:

- **A web app** built in the Adora/Steep style. It holds the course, the algorithms journeys, Practice, Notebook, Classroom, and the Laboratory circuit composer.
- **A Python runner service.** It takes a circuit in one shared JSON format (the IR), executes it on real SDKs (Qiskit Aer, Cirq, PennyLane, qBraid, IBM Quantum), and returns the results with provenance.

This document describes the repository as it stands. [§13](#13-status-what-is-real-today) states plainly what is real today and what is still planned. The work that remains is scheduled in `IMPLEMENTATION_PLAN.md`.

---

## Contents

1. [Repository layout](#1-repository-layout)
2. [Architecture](#2-architecture)
3. [Quick start](#3-quick-start)
4. [The circuit IR (qlab-ir/1)](#4-the-circuit-ir-qlab-ir1)
5. [Runner API reference](#5-runner-api-reference)
6. [Backends and provenance](#6-backends-and-provenance)
7. [Noise model: one definition, four SDKs](#7-noise-model-one-definition-four-sdks)
8. [Statistics used by Compare](#8-statistics-used-by-compare)
9. [Script execution sandbox](#9-script-execution-sandbox)
10. [Frontend: module map](#10-frontend-module-map)
11. [Design system](#11-design-system)
12. [Testing](#12-testing)
13. [Status: what is real today](#13-status-what-is-real-today)
14. [Configuration reference](#14-configuration-reference)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Repository layout

```
qlab/
├── apps/web/                  Frontend (vanilla ES modules, no framework, one-file build)
│   ├── *.js, *.css            ~25 modules (see §10)
│   ├── shell.html             Page template (/*CSS*/ and /*JS*/ are replaced at build time)
│   ├── build.py               Concatenates modules into dist/index.html + dist/bundle.js
│   ├── runtests.js            17 physics checks for simlib (node)
│   ├── contenttest.js         34 content/course checks (node)
│   ├── t2.js, t3.js           Compiler and code-generation checks (node)
│   ├── DESIGN.md              Design system reference
│   └── Dockerfile             Builds, then serves dist/ with nginx
├── services/runner/           Python 3.11 FastAPI service
│   ├── qlab_runner/
│   │   ├── app.py             HTTP API (§5)
│   │   ├── ir.py              Pydantic IR models, safe parameter evaluation
│   │   ├── build.py           IR → Qiskit / Cirq / PennyLane builders, shared noise channels
│   │   ├── run.py             Backend registry and execution, provenance
│   │   ├── convert.py         Qiskit/Cirq/PennyLane objects → IR; IR → QASM2/3, Cirq JSON, Braket, pyQuil, pytket
│   │   ├── stats.py           TVD, Hellinger fidelity, χ² goodness of fit
│   │   ├── sandbox.py         Isolated execution of user scripts (docker | local)
│   │   └── harness.py         Runs inside the sandbox; discovers circuits
│   ├── requirements.txt       Pinned SDK versions
│   ├── Dockerfile             Runner API image
│   └── Dockerfile.sandbox     Throwaway image for /v1/exec
├── packages/
│   ├── ir/schema.json         JSON Schema for qlab-ir/1
│   ├── ir/index.d.ts          TypeScript types (Circuit, Op, RunResult, Provenance…)
│   └── sim/                   Browser simulator (simlib, passes, grade, code), shared with apps/web
├── tests/
│   ├── crossval/              Cross-SDK agreement suite (pytest)
│   └── runner/smoke_api.py    End-to-end API smoke test
├── docker-compose.yml         web, runner, sandbox-image, redis, postgres
├── requirements.lock          Full pip freeze of the verified environment
└── .env.example               QLAB_IBM_TOKEN, QBRAID_API_KEY, QLAB_SANDBOX_RUNTIME
```

## 2. Architecture

```
 Browser (apps/web)                               Runner (services/runner)
 ┌──────────────────────────────┐   HTTPS/JSON   ┌───────────────────────────────────┐
 │ Laboratory composer / Script │ ─────────────▶ │ FastAPI  /v1/*                    │
 │ Course · Algorithms · Notebook│                │  ├─ ProcessPool (QLAB_WORKERS)    │
 │                              │ ◀── SSE ────── │  │   run.py → build.py → SDK       │
 │ simlib (in-browser engine)   │                │  ├─ stats.py (Compare)            │
 │  └─ instant previews, ≤ 12 q │                │  ├─ convert.py (import/export)    │
 └──────────────────────────────┘                │  └─ sandbox.py ─▶ docker run      │
                                                 │         qlab-sandbox (no network) │
                                                 └───────────┬───────────────────────┘
                                                   redis (queue, planned)   postgres (projects, planned)
```

**Two engines with honest labels.**

- The browser engine (`simlib`) gives instant feedback while you edit: it drives the amplitude bars, the Bloch spheres and the lesson instruments.
- Anything labelled with an SDK name ("Qiskit Aer", "Cirq", "PennyLane", "qBraid", "IBM") must come from the runner, and every such result carries a `provenance` object that says so. If the runner is unreachable, the UI must show **"Offline — start the runner"**. It must never quietly substitute the browser engine.

> The frontend wiring for this rule is **not done yet**: `apps/web/backends.js` still presents SDK names over the browser engine. This is task P1 in the implementation plan.

**Why an IR.** The Laboratory, the script discovery, the converters and the cross-validation suite all speak one JSON circuit format. Each SDK gets exactly one builder (`build.py`), so gates, parameters, conditions and noise are defined in a single place.

## 3. Quick start

### With Docker (the target deployment)

```bash
cp .env.example .env          # optionally add IBM / qBraid credentials
docker compose build
docker compose up
# web     http://localhost:8080
# runner  http://localhost:8765/docs   (OpenAPI UI)
```

The runner mounts `/var/run/docker.sock` so it can start one sibling `qlab-sandbox` container per `/v1/exec` call. On a host where that is not acceptable, set `QLAB_SANDBOX=local` for development, or run with gVisor (`QLAB_SANDBOX_RUNTIME=runsc`). See [§9](#9-script-execution-sandbox).

> `docker compose up` has **not** been executed end to end yet: the build environment had no Docker daemon. The images and compose file are written; the Python stack inside them is verified (§12).

### Without Docker (development)

```bash
python3.11 -m venv .venv && . .venv/bin/activate
pip install -r services/runner/requirements.txt
cd services/runner
QLAB_SANDBOX=local uvicorn qlab_runner.app:app --port 8765 --reload

# frontend
cd apps/web && python3 build.py && python3 -m http.server -d dist 8080
```

The first request is slow, roughly 10 s, while Qiskit Aer and Cirq import. After that, a small circuit takes tens of milliseconds.

## 4. The circuit IR (qlab-ir/1)

The formal schema lives in `packages/ir/schema.json`, with TS types in `packages/ir/index.d.ts` and pydantic models in `qlab_runner/ir.py`.

```json
{
  "version": "qlab-ir/1",
  "name": "bell",
  "n": 2,
  "nc": 2,
  "params": { "theta": 0.7 },
  "registers": { "q": [{ "name": "a", "size": 2 }], "c": [{ "name": "c", "size": 2 }] },
  "ops": [
    { "g": "H",  "q": [0], "col": 0 },
    { "g": "X",  "c": [0], "q": [1], "col": 1 },
    { "g": "RY", "q": [0], "p": ["theta/2"], "col": 2 },
    { "g": "M",  "q": [0], "cb": 0, "col": 3 },
    { "g": "X",  "q": [1], "cond": { "bit": 0, "val": 1 }, "col": 4 }
  ]
}
```

### Op fields

| field | meaning |
|---|---|
| `g` | Gate name (below) |
| `q` | Target wires (1 for single-qubit gates, 2 for SWAP/ISWAP/RXX/RYY/RZZ) |
| `c` | Control wires. Any gate may be controlled, e.g. `{g:"RY", c:[0,1], q:[2]}` is a CC-RY |
| `p` | Parameters: numbers, or expressions over `params` (`"theta/2"`, `"pi/4"`) |
| `cb` | Classical bit written by `M` |
| `cond` | Classical condition: `{bit, val}` for one bit, or `{reg, val}` for a whole register |
| `col` | Column in the composer; execution order is `(col, index)` |

**Gates:** `I X Y Z H S SDG T TDG SX SXDG P RX RY RZ U SWAP ISWAP RXX RYY RZZ M RESET BARRIER`.

### Conventions (these matter)

- **Bit order.** q0 is the **leftmost** character of every bitstring. A counts key lists the measured classical bits in ascending cb order. This is the composer's reading order. It is the reverse of Qiskit's native order, so the runner converts it (`k[nc-1-cb]` for counts, `_perm_from_little` for statevectors).
- **Register conditions.** For `{reg:"c", val:5}`, c0 is the least significant bit. This matches OpenQASM.
- **No measurements.** If a circuit has no `M` and shots are requested, every qubit is measured into cb = q (`measure_all_if_none`).
- **Parameter expressions** go through a whitelist AST evaluator (`ir.eval_param`): numbers, names in `params`, `pi`, `+ - * / **`, unary minus, and `sin cos sqrt exp`. Nothing else is evaluated.
- **Dynamic circuits.** A circuit is dynamic if it has mid-circuit `M` followed by further gates, `RESET`, or any `cond`. Backends advertise whether they support this (`dynamic` in `/v1/backends`). The per-SDK mapping is:

  | SDK | Mechanism |
  |---|---|
  | Qiskit | `if_test` |
  | Cirq | `SympyCondition` |
  | PennyLane | `qml.measure` / `qml.cond` |

## 5. Runner API reference

Base URL: `http://localhost:8765`. Interactive docs are at `/docs`. All bodies are JSON.

### `GET /v1/health`

Returns `{ok, versions}`, with the installed version of every SDK.

### `GET /v1/backends`

Returns a list of `{id, sdk, pkg, version, method, maxQubits, noise, state, dynamic, available, reason?}`. When `available: false`, `reason` explains why, for example "set QLAB_IBM_TOKEN".

### `POST /v1/run`

Request:

```json
{ "ir": {…}, "backend": "cirq.simulator", "shots": 1024, "seed": 7,
  "noise": { "p1": 0.001, "p2": 0.01, "t1": 100, "t2": 80, "g1": 35, "g2": 300, "readout": 0.02 },
  "options": { "state": true, "observables": ["ZZ", "0.5*XI"], "bind": { "theta": 1.2 } } }
```

Response:

```json
{ "ok": true,
  "counts": { "00": 511, "11": 513 }, "keys": [0, 1],
  "statevector": [[0.7071, 0], [0, 0], [0, 0], [0.7071, 0]],
  "probabilities": { "00": 0.5, "11": 0.5 },
  "expectation": { "ZZ": 1.0 },
  "transpiled": { "text": "…", "format": "…", "depth": 3, "ops": {…} },
  "provenance": { "sdk": "Cirq", "sdkVersion": "1.4.1", "backend": "cirq.simulator",
                  "method": "cirq.Simulator", "seed": 7, "shots": 1024, "ms": 12.4,
                  "where": "server", "noise": "none" },
  "warnings": [] }
```

- A density matrix is returned as `density: {re, im}` in place of `statevector` for mixed-state backends.
- The full state is returned only for n ≤ 20 (`LIMIT_STATE`).
- On errors (unknown backend, unsupported feature, too many qubits) the endpoint returns **422** with the SDK's message. A request is never re-routed to a different backend.

### `POST /v1/run/batch` (Server-Sent Events)

Request: `{ "runs": [RunReq, …], "exact": {"00": 0.5, …}? }`

The response streams:

```
event: result
data: {"index": 1, "ok": true, …run response…}

event: result
data: {"index": 0, "ok": false, "backend": "…", "error": "…"}

event: compare
data: { pairwise TVD / Hellinger, χ² vs exact per backend }
```

`result` events arrive in completion order, and `index` refers to the request order. Failed runs are reported inline and left out of the comparison.

### `POST /v1/compare`

Request: `{ "results": {label: runResponse}, "exact": {…}? }`. Returns the same payload as the batch `compare` event.

### `POST /v1/exec`

Request: `{ "code": "<python source>" }`, maximum 200 000 characters.

Response:

```json
{ "ok": true, "error": null, "stdout": "…", "stderr": "…",
  "circuits": [{ "name": "qc", "sdk": "qiskit", "line": 2, "ir": {…} }],
  "figures": ["<base64 png>"], "problems": [], "isolation": "docker" }
```

Circuits are discovered from module globals, plus anything passed to `qlab.show(obj, name)`. The types found are `qiskit.QuantumCircuit`, `cirq.Circuit` and `pennylane.QNode`, up to 12 per run. Matplotlib figures are captured, up to 8.

### `POST /v1/convert`

Request: `{ "source": IR | "qasm text", "source_format": "ir|qasm2|qasm3", "target": "ir|qasm2|qasm3|cirq|braket|pyquil|pytket" }`

Returns `{ir}` or `{text}`. QASM 2 export refuses dynamic circuits with a clear message.

### `POST /v1/transpile`

Request: `{ "ir": {…}, "target": "fake_sherbrooke|fake_kyiv|basis", "optimization_level": 1, "seed": 11 }`

Returns before/after depth and op counts, the QASM 3 text, and the IR of the transpiled circuit.

### `POST /v1/ibm/jobs` and `GET /v1/ibm/jobs/{id}`

The POST submits to the least-busy real IBM QPU with SamplerV2 and returns `{job, backend}`. The GET polls the job status and returns counts when it is done. Both return **503** unless `QLAB_IBM_TOKEN` is set.

## 6. Backends and provenance

| id | SDK | Method | Max q | Noise | State | Dynamic |
|---|---|---|---|---|---|---|
| `aer.statevector` | Qiskit Aer | statevector | 30 | ✓ | ✓ | ✓ |
| `aer.density_matrix` | Qiskit Aer | density_matrix | 14 | ✓ | ✓ (ρ) | ✓ |
| `aer.matrix_product_state` | Qiskit Aer | MPS | 100 | – | – | ✓ |
| `aer.stabilizer` | Qiskit Aer | stabilizer (Clifford only) | 5000 | – | – | ✓ |
| `aer.automatic` | Qiskit Aer | automatic | 30 | ✓ | – | ✓ |
| `aer.fake_sherbrooke` | Qiskit Aer | device noise, FakeSherbrooke | 20 | device | – | ✓ |
| `aer.fake_kyiv` | Qiskit Aer | device noise, FakeKyiv | 20 | device | – | ✓ |
| `cirq.simulator` | Cirq | `cirq.Simulator` (complex128) | 24 | ✓ | ✓ | ✓ |
| `cirq.density_matrix` | Cirq | `cirq.DensityMatrixSimulator` | 12 | ✓ | ✓ (ρ) | ✓ |
| `pennylane.default.qubit` | PennyLane | default.qubit | 24 | – | ✓ | ✓ |
| `pennylane.default.mixed` | PennyLane | default.mixed | 12 | ✓ | ✓ (ρ) | – |
| `pennylane.lightning.qubit` | PennyLane | lightning.qubit (C++) | 26 | – | ✓ | ✓ |
| `qbraid.cirq` | qBraid | `qbraid.transpile` qiskit→cirq, then Cirq | 20 | – | ✓ | – |
| `qbraid.device` | qBraid | QbraidProvider device | – | – | – | – |
| `ibm.hardware` | IBM Quantum | SamplerV2 on a real QPU | QPU | real | – | ✓ |

**Verified versions** (see `requirements.lock`):

| Package | Version |
|---|---|
| qiskit | 1.2.4 |
| qiskit-aer | 0.15.1 |
| qiskit-ibm-runtime | 0.30.0 |
| cirq-core | 1.4.1 |
| pennylane | 0.38.0 |
| pennylane-lightning | 0.38.0 |
| autoray | 0.6.12 (PennyLane 0.38 breaks with newer autoray) |
| qbraid | 0.8.3 (with ply, pyqasm) |

qBraid has no Qiskit→PennyLane path, so PennyLane circuits are always built by QUBIQ's own `pennylane_body`.

**Provenance rule.** Every result shown in the UI with an SDK name must render a badge from `provenance`, in the form `Cirq 1.4.1 · cirq.Simulator · seed 7 · 1024 shots · 12 ms · server`. Browser-engine results carry `{sdk: "QUBIQ browser engine", where: "browser"}` and must never be labelled with an SDK name.

## 7. Noise model: one definition, four SDKs

A single `noise` object is applied in the same way on every noise-capable backend. After each non-identity gate, the channels below act on every wire the gate touched, in this order:

1. **Depolarizing** with probability `p1` (1-qubit gates) or `p2` (2-qubit gates). We use the Cirq/PennyLane convention, ρ → (1−p)ρ + p/3 (XρX + YρY + ZρZ). Aer's `depolarizing_error(λ)` uses λ = 4p/3, and the builder converts.
2. **Amplitude damping** with γ = 1 − exp(−dt/T1). T1 and T2 are in µs. dt is the gate time `g1` (1-qubit, default 35 ns) or `g2` (multi-qubit, default 300 ns), divided by 1000.
3. **Phase damping**, with λ derived from T2 once the T1 contribution is removed: 1/Tφ = 1/T2 − 1/(2T1), λ = 1 − exp(−dt/Tφ).
4. **Readout error**: a symmetric bit flip with probability `readout`, applied just before `M`.

For Aer, every channel is emitted as an explicit Kraus instruction built from `build.kraus()`, so the maths is identical across SDKs rather than "similar". The `aer.fake_*` backends ignore `noise` and use the device model from `qiskit-ibm-runtime` fake providers.

## 8. Statistics used by Compare

Defined in `qlab_runner/stats.py`:

| Metric | Definition | Reading |
|---|---|---|
| **TVD** | ½ Σ \|p − q\| | 0 is identical, 1 is disjoint |
| **Hellinger fidelity** | (Σ √(p·q))² | Qiskit's definition; 1 is identical |
| **χ² goodness of fit vs exact** | Pearson χ² of observed counts against exact probabilities, with bins whose expected count is below 5 pooled | The p-value is the chance of seeing a deviation this large from shot noise alone. p < 0.001 flags a real disagreement. Counts on zero-probability outcomes give p = 0 with an explanatory note |

`compare(results, exact)` returns a pairwise matrix, plus a χ² result for each backend when `exact` is given.

## 9. Script execution sandbox

`POST /v1/exec` runs arbitrary user Python, so it is isolated.

**`QLAB_SANDBOX=docker` (production).** Each call runs `docker run --rm` of the `qlab-sandbox` image with these settings:

- `--network none`
- `--read-only` root, with a 256 MB `tmpfs /tmp`
- `--cpus 2 --memory 2g --pids-limit 256`
- `--security-opt no-new-privileges --cap-drop ALL`
- non-root uid 10001
- a 30 s wall-clock limit

Add `QLAB_SANDBOX_RUNTIME=runsc` to use gVisor as a second kernel boundary. This is recommended for any multi-tenant deployment.

**`QLAB_SANDBOX=local` (development only).** User code runs in a child process with these limits:

- rlimits on address space (2 GB), CPU (30 s), file size (64 MB) and processes (256)
- an empty environment, with no tokens inherited
- a private temporary cwd
- `unshare --net` (no network) when running as root

This is a convenience, **not a security boundary**.

Inside the sandbox, `harness.py` runs the script with stdout and stderr redirected. It then discovers circuits, converts each one to IR and returns a single JSON line. A conversion failure is reported in `problems`; it does not fail the run.

> Only local mode has been tested so far. That test covered discovery, stdout capture, and network blocked (a DNS failure). Docker mode needs a host with a Docker daemon (see the plan, P0).

## 10. Frontend: module map

Plain browser JavaScript. Each file defines one global module, and `build.py` concatenates them in dependency order into a single HTML file. The same bundle is published as a claude.ai artifact.

| Module | Responsibility |
|---|---|
| `simlib.js` | The browser quantum engine: statevector and density-matrix simulation, gates, measurement, entropy, Bloch vectors, expectation values |
| `tests.js` | Physics test suite (runs in node and in Notebook › System checks) |
| `kit.js` | DOM helpers, storage, motion utilities, formatting |
| `ink.js` | Instruments: amplitude bars, Bloch sphere, histograms, probability wheels |
| `code.js` | One IR, four code generators (Qiskit, Cirq, PennyLane, QASM) plus a parser |
| `passes.js` | Circuit metrics, optimisation passes, routing preview |
| `score.js` | The circuit drawn as staves (read-only rendering used in lessons) |
| `grade.js` | "Q" compact circuit notation and the challenge grader |
| `templates.js` | Named circuits (Bell, GHZ, QFT, Grover, teleportation…) |
| `backends.js` | `runCircuit()` dispatch. **Currently browser-only; to be replaced by the runner client** |
| `views.js`, `stage.js` | Stage views and shared instruments for lessons and journeys |
| `tutor.js` | QUBIT, the margin tutor (grounded hints, optional `sample` capability) |
| `board.js` | Dotted infinite canvas: pan and zoom, cards |
| `course.js`, `course-ch2.js` | Course atlas, six-beat lesson engine, chapter content |
| `journey.js` | First-run "first five minutes" experience |
| `home.js` | Home dashboard |
| `algos.js` | Algorithms gallery and step-through journeys |
| `screens.js` | Practice, Notebook, Classroom (room capability) |
| `workbench.js` | **The circuit page (route `#lab`)**: add or remove qubit wires; two toolboxes to drag gates from (probes, displays, half/quarter/eighth turns, spinning X^t/Y^t/Z^t, parametrised and formula gates, two-qubit and multi-qubit blocks QFT, +1/−1, reverse); a live simulation on every drop; inline Bloch, chance, amplitude and density displays animated by the clock t; an always-open code panel (Qiskit, Cirq, PennyLane, OpenQASM 3) that regenerates on every edit and parses typed code back into the circuit; and a Measure card that samples in the browser or runs on the SDK runner, with an offline state and a provenance badge. Tested by `wbtest.js` (82 checks, including four-SDK code round trips) |
| `lab.js` | Canvas view of the Laboratory (route `#canvas`): cards, optimiser, device routing, missions |
| `platform.js` | Identity, private sync via `db`, capability wiring |
| `shell.js` | Frame, sidebar, top bar, hash router, ⌘K palette |
| `icons-data.js` | Inline icon set (Lucide paths) |

## 11. Design system

The full reference is in `apps/web/DESIGN.md` (tokens in `tokens.css`). In short:

- **Canvas:** a dotted background (`--canvas`) with white cards at 20–24 px radius and soft layered shadows.
- **Accent:** violet `#592EFF`, plus pastel tints for categories (mint, peach, sky, lilac, butter). Tints are never used for meaning alone.
- **Type:** Inter/Geist-style sans for UI and a mono face for code and bitstrings. Tabular numerals are used for every number that changes.
- **Motion:** transform- and opacity-only transitions. `prefers-reduced-motion` is respected.
- **Components:** pills, badges, cards, segmented controls, a command palette, and the QUBIT cursor.
- **Dark mode:** tokens are redefined under `prefers-color-scheme` and `[data-theme="dark"]`.

## 12. Testing

| Suite | Command | Status |
|---|---|---|
| Browser physics | `cd apps/web && node runtests.js` | 17/17 green |
| Course content | `cd apps/web && node contenttest.js` | 34/34 green |
| Circuit page | `cd apps/web && node wbtest.js` | 82/82 green (gate maths, QFT vs DFT, ±1, swaps, errors, code round trips on all templates) |
| Cross-SDK agreement | `PYTHONPATH=services/runner pytest tests/crossval -q` | **31/31 green** (5 circuits, up to 10 qubits, Aer / Cirq / PennyLane / Lightning, statevector fidelity within 1e-9 and χ² on counts) |
| API smoke | `QLAB_SANDBOX=local python tests/runner/smoke_api.py` | green: health, backends (15), run, 422 on bad backend, convert, transpile, SSE batch, exec with discovery, network blocked |

Results verified by hand during development:

- A Bell pair gave correct 50/50 counts on every local backend. `aer.fake_sherbrooke` showed device noise as expected, with about 2.4 % `01` and `10`.
- A 3-qubit parametric circuit (U, RZZ, controlled P, ISWAP, SX, CC-RY) gave fidelity 1.0 against Aer on Cirq, PennyLane, Lightning and qBraid.

## 13. Status: what is real today

**Real and verified:**

- The IR schema and types, in JSON Schema, TypeScript and pydantic.
- The runner, with real execution on 13 local backends across Qiskit Aer, Cirq, PennyLane and qBraid.
- The shared noise model and provenance on every result.
- SSE batch runs, Compare statistics, converters, transpile, and the script sandbox (local mode).
- A cross-validation starter suite.
- The complete frontend: course, algorithms, Laboratory, Practice, Notebook, Classroom and the design system.

**Written but not executed here:**

- The Dockerfiles and `docker-compose.yml`. There was no Docker daemon in the build environment.
- The IBM hardware endpoints, which need a token.
- `qbraid.device`, which needs an API key.
- Docker-mode sandboxing.

**Not built yet** (all scheduled in `IMPLEMENTATION_PLAN.md`):

- The frontend runner client, provenance badges and offline state. Until this ships, SDK-labelled results in the web app are browser-computed, which is a known violation of the "no mislabelled SDK" rule and the first task in the plan.
- The Validation page and the full 40 × 4 suite.
- The Compare card UI, Monaco and Script mode UI, registers UI, and the Block Library.
- The experiment runner, Variational card and VQE, the noise editor UI, and mitigation.
- Breakpoints and assertions, equivalence checking, the resources panel and the entanglement map.
- Projects, versions and sharing (persistence in postgres), redis queueing, and CI.

## 14. Configuration reference

| Variable | Default | Purpose |
|---|---|---|
| `QLAB_SANDBOX` | `local` | `docker` or `local` isolation for `/v1/exec` |
| `QLAB_SANDBOX_IMAGE` | `qlab-sandbox:latest` | Image used in docker mode |
| `QLAB_SANDBOX_RUNTIME` | *(empty)* | `runsc` enables gVisor |
| `QLAB_SANDBOX_TIMEOUT` | `30` | Seconds per script |
| `QLAB_WORKERS` | `2` | Size of the simulation process pool |
| `QLAB_CORS` | `*` | Comma-separated allowed origins |
| `QLAB_IBM_TOKEN` | *(empty)* | Enables `ibm.hardware` and `/v1/ibm/jobs` |
| `QBRAID_API_KEY` | *(empty)* | Enables `qbraid.device` |
| `REDIS_URL`, `DATABASE_URL` | set in compose | Reserved for the job queue and projects (P5, P9) |

## 15. Troubleshooting

- **`AttributeError` from autoray on `import pennylane`.** Pin `autoray==0.6.12` for PennyLane 0.38.
- **Lightning import error.** `pennylane-lightning` must match the `pennylane` version exactly.
- **`No module named ply` during Cirq conversion.** Run `pip install ply pyqasm` (qBraid's QASM path needs them).
- **Cirq and Aer fidelity differ in the 8th decimal.** Cirq defaults to complex64; the runner forces `dtype=np.complex128`.
- **The first run takes about 10 s.** This is the SDK import cost. Warm the pool at start-up (planned in P0) or keep the runner alive.
- **The UI shows "Offline — start the runner".** Start the runner on :8765, or point the web app at it (setting planned in P1).
