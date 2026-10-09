# QUBIQ: Technical Systems Documentation

> **Version:** 0.2  
> **Status:** Active Reference & Architecture Specification  
> **Repository:** `qlab/` (monorepo)

QUBIQ is an interactive quantum computing laboratory, compiler, and learning platform. The system is split into two autonomous subsystems:

1. **Client Web Application (`apps/web`):** A zero-dependency single-page application built with plain vanilla ES6+ modules and bundled into a single HTML deliverable. Houses the interactive Laboratory circuit workbench (`#lab`), the 4-module structured curriculum (`#learn`), practice problem grading (`#practice`), algorithms journey players (`#algorithms`), and a personal progress dashboard (`#progress`). Computes exact quantum states up to 16 qubits directly in the client browser.
2. **Quantum Runner Service (`services/runner`):** A Python 3.11 FastAPI microservice that accepts circuits in a unified JSON Intermediate Representation (`qlab-ir/1`), translates them into native objects across 15 SDK backends (Qiskit Aer, Cirq, PennyLane, qBraid, IBM Quantum), executes them with process-pool isolation, and returns unforgeable provenance metadata.

---

## Table of Contents

1. [Repository Layout](#1-repository-layout)
2. [Architecture & System Flow](#2-architecture--system-flow)
3. [Quick Start & Development](#3-quick-start--development)
4. [The Circuit IR (`qlab-ir/1`)](#4-the-circuit-ir-qlab-ir1)
5. [Runner API Reference](#5-runner-api-reference)
6. [Backends and Provenance](#6-backends-and-provenance)
7. [Shared Noise Model Physics](#7-shared-noise-model-physics)
8. [Statistical Metrics (Compare Mode)](#8-statistical-metrics-compare-mode)
9. [Script Execution Sandbox](#9-script-execution-sandbox)
10. [Frontend Architecture & Module Map](#10-frontend-architecture--module-map)
11. [Design System & UI Tokens](#11-design-system--ui-tokens)
12. [Verification & Test Matrix](#12-verification--test-matrix)
13. [Status: What is Real Today](#13-status-what-is-real-today)
14. [Configuration Reference](#14-configuration-reference)
15. [Troubleshooting & Gotchas](#15-troubleshooting--gotchas)

---

## 1. Repository Layout

```
qlab/
├── apps/web/                  Frontend application (vanilla ES6, zero npm dependencies)
│   ├── *.js, *.css            ~35 modular client engines (see §10)
│   ├── shell.html             HTML skeleton with CSS/JS injection points
│   ├── build.py               Concatenates modules into dist/index.html & dist/bundle.js
│   ├── runtests.js            17 physics simulator checks (Node.js)
│   ├── contenttest.js         34 course and lesson checks (Node.js)
│   ├── wbtest.js              82 workbench compiler & code round-trip checks (Node.js)
│   ├── learntest.js           384 curriculum, exercise, and insight diagnostics checks
│   ├── nginx.conf             Production Nginx configuration with gzip & caching
│   ├── DESIGN.md              Visual design system reference
│   └── Dockerfile             Two-stage build serving dist/ with Nginx
├── services/runner/           Python 3.11 FastAPI service
│   ├── qlab_runner/
│   │   ├── app.py             HTTP API endpoints & ASGI routing (§5)
│   │   ├── ir.py              Pydantic models & AST whitelist parameter evaluator
│   │   ├── build.py           IR → Qiskit / Cirq / PennyLane circuit builders
│   │   ├── run.py             Backend registry, process pool, and execution
│   │   ├── convert.py         Multi-way converters (IR ↔ QASM 2/3, Cirq, Braket, PyQuil, pytket)
│   │   ├── stats.py           TVD, Hellinger distance, and χ² goodness-of-fit
│   │   ├── db.py              SQLite / PostgreSQL persistence, JWT auth, project versions
│   │   ├── tutor.py           AI tutor proxy (Claude / Gemini API) with rate-limiting
│   │   ├── sandbox.py         Isolated script execution (Docker or local process rlimits)
│   │   └── harness.py         Script introspection harness: discovers circuits & plots
│   ├── requirements.txt       Pinned Python SDK dependencies
│   ├── Dockerfile             Production runner service image
│   └── Dockerfile.sandbox     Network-isolated container image for /v1/exec
├── packages/
│   ├── ir/schema.json         Canonical JSON Schema for qlab-ir/1
│   ├── ir/index.d.ts          TypeScript definitions for Circuit, Op, and RunResult
│   └── sim/                   Shared browser simulator modules
├── tests/
│   ├── crossval/              Cross-SDK numerical agreement suite (pytest)
│   │   ├── test_crossval.py   Asserts 1e-9 statevector overlap fidelity & χ² counts
│   │   └── generate_validation.py  Generates validation.json for the frontend
│   ├── runner/
│   │   ├── smoke_api.py       End-to-end API integration smoke test
│   │   ├── test_auth_projects.py   Auth, CRUD projects, versions, and progress tests
│   │   └── test_tutor.py      AI tutor proxy unit tests
│   └── lint_provenance.py     Static linter ensuring zero fake SDK provenance
├── docker-compose.yml         5-service stack: web, runner, sandbox-image, redis, postgres
├── pyproject.toml             Root Python test & project metadata
├── vercel.json                Vercel static hosting and route rewrite configuration
├── requirements.lock          Exact pip freeze lockfile of the verified environment
└── .env.example               Environment template for IBM tokens, qBraid keys, and LLM APIs
```

---

## 2. Architecture & System Flow

```
 Client Browser (apps/web)                         Runner Microservice (services/runner :8765)
 ┌──────────────────────────────┐                   ┌─────────────────────────────────────────┐
 │ Laboratory Composer (#lab)   │    HTTPS / JSON   │ FastAPI Gateway (app.py)                │
 │ Structured Course (#learn)   │ ────────────────▶ │  ├─ JWT Auth & DB (db.py: SQLite/Pg)    │
 │ Code Sync Panel (code.js)    │                   │  ├─ Process Pool (QLAB_WORKERS)         │
 │                              │ ◀─── SSE Stream ── │  │   run.py → build.py → SDK Engines   │
 │ Browser Engine (simlib.js)   │   (/v1/run/batch) │  ├─ Statistical Compare (stats.py)      │
 │  └─ Real-time, ≤ 16 qubits   │                   │  ├─ Multi-format Converters (convert.py)│
 │                              │                   │  ├─ AI Proxy (tutor.py: Claude/Gemini)  │
 │ Client AI Tutor (tutor.js)   │                   │  └─ Execution Sandbox (sandbox.py)      │
 │  └─ Offline physics engine   │                   │       └─ Docker container (--net none)  │
 └──────────────────────────────┘                   └────────────────────┬────────────────────┘
                                                                         │
                                                       ┌─────────────────┴─────────────────┐
                                                       │ Real Quantum SDKs                 │
                                                       │ ├─ Qiskit Aer 0.15.1 (state/MPS) │
                                                       │ ├─ Cirq 1.4.1 (Simulator)         │
                                                       │ ├─ PennyLane 0.38 (C++ lightning) │
                                                       │ ├─ qBraid Runtime                 │
                                                       │ └─ IBM Quantum Hardware (queued)  │
                                                       └───────────────────────────────────┘
```

### The Honesty Invariant
We enforce a hard design invariant: **we never fake SDK results.**
- While users place gates or scrub parameters, the in-browser simulator (`simlib.js`) provides instant zero-latency visual feedback for up to 16 qubits. Every browser-simulated run carries the explicit provenance label:
  `{ sdk: "QLab browser engine", where: "browser" }`.
- When an SDK backend (such as `aer.statevector` or `cirq.simulator`) is executed, the circuit is dispatched over HTTP to the Python runner service. The resulting dataset contains complete hardware provenance (SDK version, wall-clock time in ms, random seed, and shot counts).
- If the runner service is unreachable, SDK options display **"Offline — start the runner"**. The UI refuses to quietly substitute browser simulation for an SDK request.

---

## 3. Quick Start & Development

### 1. Running with Docker Compose (Recommended)

```bash
# Copy environment configuration
cp .env.example .env

# Build container images and start all 5 services
docker compose build
docker compose up
```
- **Web Frontend:** `http://localhost:8080`
- **Runner API Documentation:** `http://localhost:8765/docs` (Swagger UI)

The runner container mounts `/var/run/docker.sock` to launch sibling sandboxed containers for `/v1/exec`. In environments where socket mounting is restricted, set `QLAB_SANDBOX=local` in your `.env`.

### 2. Local Development (Without Docker)

#### Step A: Start the Runner Microservice
```bash
# Create and activate an isolated Python 3.11 virtual environment
python -m venv .venv
source .venv/bin/activate    # On Windows: .\.venv\Scripts\Activate.ps1

# Install exact pinned dependencies
pip install -r services/runner/requirements.txt

# Start the FastAPI service
cd services/runner
QLAB_SANDBOX=local uvicorn qlab_runner.app:app --host 127.0.0.1 --port 8765 --reload
```
*Note:* The runner automatically warms its worker process pool upon startup by executing a 1-qubit initialization circuit, avoiding cold-start import penalties on user requests.

#### Step B: Build and Serve the Frontend
In a second terminal window:
```bash
cd apps/web

# Bundle JS and CSS modules into dist/index.html and dist/bundle.js
python build.py

# Serve statically on port 8080
python -m http.server --directory dist 8080
```
Open `http://localhost:8080` in your browser.

---

## 4. The Circuit IR (`qlab-ir/1`)

All frontend tools, code parsers, backend translators, and cross-validation runners operate on the canonical **`qlab-ir/1`** JSON specification ([packages/ir/schema.json](packages/ir/schema.json)).

### Example Circuit Payload
```json
{
  "version": "qlab-ir/1",
  "name": "bell_pair_with_rotation",
  "n": 2,
  "nc": 2,
  "params": { "theta": 0.785398 },
  "registers": {
    "q": [{ "name": "q", "size": 2 }],
    "c": [{ "name": "c", "size": 2 }]
  },
  "ops": [
    { "g": "H",  "q": [0], "col": 0 },
    { "g": "X",  "c": [0], "q": [1], "col": 1 },
    { "g": "RY", "q": [0], "p": ["theta/2"], "col": 2 },
    { "g": "M",  "q": [0], "cb": 0, "col": 3 },
    { "g": "X",  "q": [1], "cond": { "bit": 0, "val": 1 }, "col": 4 }
  ]
}
```

### Operation Schema Reference

| Field | Type | Description |
|---|---|---|
| `g` | string | Gate identifier (25 gates supported, see below) |
| `q` | int[] | Target qubit indices (1 index for single-qubit gates, 2 for two-qubit gates) |
| `c` | int[] | Control qubit indices. **Any gate can be arbitrarily controlled** (e.g., `{g: "RY", c: [0, 1], q: [2]}` yields a CC-RY gate) |
| `p` | (number\|string)[] | Gate parameters: floating-point numbers or algebraic expressions over `params` |
| `cb` | int | Classical bit written by measurement gate `M` |
| `cond` | object | Classical condition: `{bit, val}` for a single bit, or `{reg, val}` for register checks |
| `col` | int | Visual composer column index; circuit execution order sorts by `(col, index)` |

**Supported Gate Set:**
`I`, `X`, `Y`, `Z`, `H`, `S`, `SDG`, `T`, `TDG`, `SX`, `SXDG`, `P`, `RX`, `RY`, `RZ`, `U`, `SWAP`, `ISWAP`, `ISWAPDG`, `RXX`, `RYY`, `RZZ`, `M`, `RESET`, `BARRIER`.

### Critical Engineering Conventions

1. **Bit Order (Big-Endian Display):**
   - $q_0$ is the **leftmost** character in bitstrings (matching visual reading order).
   - Because Qiskit natively orders bitstrings little-endian ($q_0$ rightmost), the runner automatically maps permutations:
     - Shot counts: converted via `k[nc - 1 - cb]`.
     - Statevectors: converted via `_perm_from_little(n)`.
2. **Whitelist Parameter Evaluation (`ir.eval_param`):**
   - Expressions inside `p` (e.g. `"theta / 2"`, `"pi / 4"`) are parsed using Python's `ast` module against an explicit whitelist: numbers, variables declared in `params`, arithmetic operators (`+`, `-`, `*`, `/`, `**`), and math functions (`sin`, `cos`, `sqrt`, `exp`). Python's `eval()` is strictly prohibited.
3. **Dynamic Circuits:**
   - Mid-circuit measurements followed by feed-forward operations map natively to:
     - Qiskit: `QuantumCircuit.if_test()`
     - Cirq: `cirq.SympyCondition`
     - PennyLane: `qml.measure()` and `qml.cond()`

---

## 5. Runner API Reference

Base URL: `http://localhost:8765`. All request and response payloads use JSON.

### Quantum Execution & Transpilation

#### `GET /v1/health`
Returns system status and installed SDK versions.
```json
{
  "ok": true,
  "versions": {
    "qiskit": "1.2.4",
    "qiskit-aer": "0.15.1",
    "cirq-core": "1.4.1",
    "pennylane": "0.38.0",
    "pennylane-lightning": "0.38.0"
  }
}
```

#### `GET /v1/backends`
Returns the complete list of 15 registered backends with their capabilities (max qubits, noise support, statevector availability, dynamic circuit support).

#### `POST /v1/run`
Executes a single circuit on a specified backend.
- **Request Body:**
  ```json
  {
    "ir": { "version": "qlab-ir/1", "n": 2, "ops": [...] },
    "backend": "aer.statevector",
    "shots": 1024,
    "seed": 42,
    "noise": null,
    "options": { "want_state": true }
  }
  ```
- **Response:**
  ```json
  {
    "counts": { "00": 512, "11": 512 },
    "probabilities": { "00": 0.5, "11": 0.5 },
    "statevector": [[0.707106, 0.0], [0.0, 0.0], [0.0, 0.0], [0.707106, 0.0]],
    "provenance": {
      "sdk": "Qiskit Aer",
      "sdkVersion": "0.15.1",
      "backend": "aer.statevector",
      "shots": 1024,
      "seed": 42,
      "ms": 14.2,
      "where": "server"
    }
  }
  ```

#### `POST /v1/run/batch`
Streams execution across multiple backends over Server-Sent Events (SSE). Emits `event: result` as each backend finishes, concluding with an `event: compare` payload.

#### `POST /v1/compare`
Computes statistical distance metrics (Total Variation Distance, Hellinger distance, $\chi^2$ goodness-of-fit) between multiple result count dictionaries.

#### `POST /v1/exec`
Executes user-supplied Python script within an isolated sandbox. Introspects globals and returns discovered quantum circuits, matplotlib figures (as base64 PNG), and captured stdout/stderr.

#### `POST /v1/convert`
Translates between `qlab-ir/1` and external quantum formats (`qasm2`, `qasm3`, `cirq`, `braket`, `pyquil`, `pytket`).

#### `POST /v1/transpile`
Transpiles an IR circuit onto IBM heavy-hex topologies (`fake_sherbrooke`, `fake_kyiv`) or generic basis gate sets (`cx, rz, sx, x`), returning before/after depths and gate counts.

---

### Authentication, Projects & Persistence

#### `POST /v1/auth/signup` & `POST /v1/auth/login`
Creates a user account or validates credentials. Returns a signed JWT token and user profile.

#### `GET /v1/projects` & `POST /v1/projects`
Lists or creates user projects stored in relational persistence (SQLite / PostgreSQL).

#### `POST /v1/projects/{id}/versions`
Saves an immutable circuit revision snapshot under a project.

#### `GET /v1/progress` & `PUT /v1/progress`
Reads or synchronizes Bayesian Knowledge Tracing progress and completed curriculum milestones.

#### `POST /v1/share` & `GET /v1/share/{token}`
Generates or resolves public read-only circuit share tokens for frictionless collaboration.

---

## 6. Backends and Provenance

The runner exposes 15 backends across 4 SDK ecosystems:

| Backend ID | SDK Engine | Execution Mode | Max Qubits | Noise Support | Dynamic Circuits |
|---|---|---|:---:|:---:|:---:|
| `aer.statevector` | Qiskit Aer 0.15.1 | Statevector simulation | 30 | Kraus | Yes |
| `aer.density_matrix` | Qiskit Aer 0.15.1 | Density matrix ($\rho$) | 14 | Kraus | Yes |
| `aer.matrix_product_state` | Qiskit Aer 0.15.1 | Tensor network (MPS) | 100 | None | Yes |
| `aer.stabilizer` | Qiskit Aer 0.15.1 | Clifford tableau | 5000 | None | Yes |
| `aer.automatic` | Qiskit Aer 0.15.1 | Automatic selection | 30 | Kraus | Yes |
| `aer.fake_sherbrooke` | Qiskit Aer 0.15.1 | FakeSherbrooke (127q calibration) | 20 | Device | No |
| `aer.fake_kyiv` | Qiskit Aer 0.15.1 | FakeKyiv (127q calibration) | 20 | Device | No |
| `cirq.simulator` | Cirq 1.4.1 | Wavefunction simulation | 24 | Kraus | Yes |
| `cirq.density_matrix` | Cirq 1.4.1 | Density matrix ($\rho$) | 12 | Kraus | Yes |
| `pennylane.default.qubit` | PennyLane 0.38.0 | Pure state simulation | 24 | None | Yes |
| `pennylane.default.mixed` | PennyLane 0.38.0 | Mixed state simulation | 12 | Kraus | No |
| `pennylane.lightning.qubit` | PennyLane-Lightning | C++ statevector engine | 26 | None | No |
| `qbraid.cirq` | qBraid 0.8.3 | Transpilation to Cirq | 20 | None | No |
| `qbraid.device` | qBraid 0.8.3 | Cloud quantum hardware | 32 | Device | No |
| `ibm.hardware` | IBM Quantum | Real QPU via SamplerV2 | 127 | Real QPU | Yes |

---

## 7. Shared Noise Model Physics

Rather than relying on proprietary noise abstractions, QUBIQ implements an **exact Kraus channel representation** unified across Qiskit Aer, Cirq, and PennyLane ([services/runner/qlab_runner/build.py](services/runner/qlab_runner/build.py)).

### 1. Depolarizing Channel
For 1-qubit gates targeting wire $q$:
$$E_0 = \sqrt{1 - \frac{3p_1}{4}} I, \quad E_1 = \sqrt{\frac{p_1}{4}} X, \quad E_2 = \sqrt{\frac{p_1}{4}} Y, \quad E_3 = \sqrt{\frac{p_1}{4}} Z$$
For 2-qubit gates, the 16 two-qubit Pauli tensor products are scaled by $\sqrt{p_2 / 16}$.

### 2. Amplitude Damping Channel ($T_1$)
Models energy relaxation to ground state $|0\rangle$ over gate duration $\Delta t$:
$$\gamma = 1 - e^{-\Delta t / T_1}$$
$$K_0 = \begin{pmatrix} 1 & 0 \\ 0 & \sqrt{1 - \gamma} \end{pmatrix}, \quad K_1 = \begin{pmatrix} 0 & \sqrt{\gamma} \\ 0 & 0 \end{pmatrix}$$

### 3. Phase Damping Channel ($T_2$)
Models pure dephasing with dephasing time $T_\phi$, where $\frac{1}{T_\phi} = \frac{1}{T_2} - \frac{1}{2T_1}$:
$$\lambda = 1 - e^{-\Delta t / T_\phi}$$
$$K_0 = \begin{pmatrix} 1 & 0 \\ 0 & \sqrt{1 - \lambda} \end{pmatrix}, \quad K_1 = \begin{pmatrix} 0 & 0 \\ 0 & \sqrt{\lambda} \end{pmatrix}$$

### 4. Readout Error
Applied immediately prior to measurement:
$$P(\text{bit flip}) = \text{readout}$$

Because all noise operators are constructed directly from these explicit Kraus matrices, simulation results between Qiskit Aer and Cirq agree to within $10^{-9}$ numerical precision.

---

## 8. Statistical Metrics (Compare Mode)

When comparing results between multiple backends or validating noisy hardware against ideal distributions, `stats.py` evaluates three statistical metrics:

1. **Total Variation Distance (TVD):**
   $$\text{TVD}(P, Q) = \frac{1}{2} \sum_{x \in \{0, 1\}^n} |P(x) - Q(x)|$$
   Bounded in $[0, 1]$. TVD $= 0$ indicates identical distributions.
2. **Hellinger Fidelity:**
   $$F_H(P, Q) = \left( \sum_{x} \sqrt{P(x) Q(x)} \right)^2$$
   Bounded in $[0, 1]$. $F_H = 1$ denotes complete fidelity.
3. **Chi-Squared ($\chi^2$) Goodness-of-Fit:**
   $$\chi^2 = \sum_{x} \frac{(O_x - E_x)^2}{E_x}$$
   Bins with $E_x < 5$ are dynamically pooled to preserve asymptotic validity. Returns test statistic and $p$-value.

---

## 9. Script Execution Sandbox

The `/v1/exec` endpoint accepts arbitrary user Python code and executes it safely:

- **Docker Mode (`QLAB_SANDBOX=docker`):** Production default. Launches an ephemeral container from `qlab-sandbox:latest` with:
  - `--network none` (complete egress/ingress block)
  - `--read-only` root filesystem with a 256MB tmpfs on `/tmp`
  - `--cpus 2`, `--memory 2g`, `--pids-limit 256`
  - `--security-opt no-new-privileges`, `--cap-drop ALL`
  - Hard timeout enforced after 30 seconds.
- **Local Mode (`QLAB_SANDBOX=local`):** Development fallback. Spawns a child process with POSIX `rlimits` (CPU time, virtual memory, file size) and sanitized environment variables. On Windows platforms, safe subprocessing and process tree termination are applied.

Inside the container, `harness.py` executes the script, intercepts `stdout`/`stderr`, harvests `matplotlib` figures as base64-encoded PNGs, scans module scope for `QuantumCircuit` / `cirq.Circuit` instances, and emits a single structured JSON response.

---

## 10. Frontend Architecture & Module Map

The client is written in modular vanilla JavaScript. During build, `apps/web/build.py` merges these files in dependency order into `dist/index.html`.

| Module | Size | Functional Responsibility |
|---|:---:|---|
| `simlib.js` | ~39 KB | **Core Quantum Engine:** Statevector & density matrix evolution, Clifford stabilizer tableaus, measurement sampling, Bloch vectors, entropy. |
| `insight.js` | ~20 KB | **Circuit Narration & Diagnostics:** Real-time plain-English explanation of gate actions, entanglement detection, and AST error heuristics. |
| `ai.js` / `tutor.js` | ~40 KB | **QUBIT AI Tutor:** Grounded chat assistant with tools (`simulate`, `getCircuit`, `lint`, `point`, `proposeEdit`). Falls back to an offline rule-based engine when no API key is provided. |
| `learn.js` / `learn-content.js` | ~90 KB | **Curriculum Engine:** 4 structured modules, 19 interactive lessons, formula rendering, interactive widgets, and mastery tracking. |
| `workbench.js` | ~79 KB | **Circuit Composer (`#lab`):** 16-wire grid, drag-and-drop toolbox, live displays, split code view, and Measure card with honest provenance badges. |
| `code.js` | ~31 KB | **Multi-Language Codegen & Parser:** Two-way live translation between `qlab-ir/1` and Qiskit, Cirq, PennyLane, and OpenQASM 3. |
| `runner.js` | ~8 KB | **HTTP & SSE Runner Client:** Handles `/v1/*` API requests, JWT authentication tokens, Server-Sent Events batch streaming, and runner status polling. |
| `backends.js` | ~8 KB | **Backend Dispatcher:** Routes browser simulations to `simlib.js` and SDK simulations to `runner.js`. Enforces the *"Offline — start the runner"* boundary. |
| `compare.js` | ~11 KB | **Benchmark UI:** Multi-backend execution dashboard with overlaid histograms and TVD / Hellinger metrics. |
| `validation.js` | ~10 KB | **Verification Grid (`#validation`):** Renders the nightly 40×4 cross-SDK verification matrix. |
| `platform.js` | ~5 KB | **Storage & Identity Adapter:** Bridges local browser `Store` and remote server endpoints (`/v1/projects`, `/v1/progress`). |

---

## 11. Design System & UI Tokens

Described in [apps/web/DESIGN.md](apps/web/DESIGN.md):

- **Canvas & Elevation:** Dotted infinite canvas background (`--canvas`), flat clean cards with 20–24px border radii, layered ambient drop shadows.
- **Color Palette:** Accent violet (`#592EFF`), accompanied by semantic pastel tints (mint, peach, sky, lilac, butter). Tints provide secondary categorization and are never used as sole indicators of state.
- **Typography:** `Plus Jakarta Sans` / `Instrument Sans` for UI labels; `JetBrains Mono` for code, registers, and bitstrings. Tabular numerals (`tnum`) applied across all live metric displays.
- **Motion:** CSS transforms and opacity transitions exclusively. Fully respects `prefers-reduced-motion`.

---

## 12. Verification & Test Matrix

We maintain 560+ automated test checks across client physics, curriculum integrity, compiler correctness, and backend SDK mathematical agreement:

| Suite | Execution Command | Checks | Status |
|---|---|:---:|:---:|
| **Browser Physics** | `cd apps/web && node runtests.js` | 17 | **17/17 PASS** ✅ |
| **Course & Beats** | `cd apps/web && node contenttest.js` | 34 | **34/34 PASS** ✅ |
| **Workbench & Round-Trips** | `cd apps/web && node wbtest.js` | 82 | **82/82 PASS** ✅ |
| **Curriculum & Diagnostics** | `cd apps/web && node learntest.js` | 384 | **384/384 PASS** ✅ |
| **Cross-SDK Agreement** | `PYTHONPATH=services/runner pytest tests/crossval -q` | 31 | **31/31 PASS** ✅ |
| **API Smoke Suite** | `QLAB_SANDBOX=local python tests/runner/smoke_api.py` | 9 | **PASS** ✅ |
| **Auth & Persistence** | `PYTHONPATH=services/runner pytest tests/runner/test_auth_projects.py` | 12 | **PASS** ✅ |
| **Provenance Honesty Linter**| `python tests/lint_provenance.py` | 35 files | **PASS** ✅ |

---

## 13. Status: What is Real Today

### Complete & Fully Verified
- `qlab-ir/1` Schema, TypeScript definitions, and Pydantic validation models.
- Python Runner microservice with 13 local verified backends (Qiskit Aer, Cirq, PennyLane, PennyLane-Lightning, qBraid).
- Shared Kraus noise models operating with identical mathematics across SDKs.
- Real-time client code translation and parsing across Qiskit, Cirq, PennyLane, and OpenQASM 3.
- Provenance tracking badges displaying runtime, seed, SDK version, and host environment.
- Persistent user accounts, project revision trees, progress syncing, and anonymous share links (SQLite & PostgreSQL).
- 4-module structured curriculum (19 lessons, 32 assessments) with Bayesian Knowledge Tracing.
- Live circuit narration and AST error detection rules.
- Grounded AI tutor with offline rule-based physics fallback.
- Docker Compose multi-service architecture and Vercel static deployment pipeline.

### Pending Remote Configuration
- `ibm.hardware`: Verified implementation using Qiskit Runtime `SamplerV2`; requires active `QLAB_IBM_TOKEN`.
- `qbraid.device`: Verified integration; requires active `QBRAID_API_KEY`.
- Docker-in-Docker sandbox execution on cloud container hosts without Docker socket passthrough (local sandbox mode utilized instead).

---

## 14. Configuration Reference

| Environment Variable | Default | Description |
|---|---|---|
| `QLAB_SANDBOX` | `local` | Sandbox isolation mode: `docker` or `local` |
| `QLAB_SANDBOX_IMAGE` | `qlab-sandbox:latest` | Container image tag for Docker sandbox runs |
| `QLAB_SANDBOX_RUNTIME` | *(empty)* | Optional container runtime (e.g., `runsc` for gVisor) |
| `QLAB_SANDBOX_TIMEOUT` | `30` | Execution timeout in seconds for user scripts |
| `QLAB_WORKERS` | `2` | Process pool worker count for quantum simulations |
| `QLAB_CORS` | `*` | Allowed CORS origins for FastAPI middleware |
| `DATABASE_URL` | *(empty)* | PostgreSQL connection URL; defaults to local `qlab.db` SQLite |
| `QLAB_SECRET_KEY` | *(development default)* | Secret key for JWT session signing |
| `QLAB_IBM_TOKEN` | *(empty)* | IBM Quantum API token for real QPU job submission |
| `QBRAID_API_KEY` | *(empty)* | qBraid API credentials for cloud devices |
| `ANTHROPIC_API_KEY` | *(empty)* | Enables Claude for AI tutor assistance |
| `GEMINI_API_KEY` | *(empty)* | Enables Gemini for AI tutor assistance |

---

## 15. Troubleshooting & Gotchas

1. **Windows Multiprocessing Spawning:**
   - On Windows, Python uses `spawn` instead of `fork`. Test scripts and entry points importing `qlab_runner.app` must be wrapped in `if __name__ == '__main__':` to prevent child worker processes from re-executing top-level test runners and throwing `BrokenProcessPool` exceptions.
2. **PennyLane and Autoray Compatibility:**
   - PennyLane 0.38 requires `autoray==0.6.12`. Newer releases of autoray introduce breaking changes in array dispatching. Always pin exact versions using `requirements.lock`.
3. **Cirq Numerical Precision:**
   - Cirq simulators default to `complex64`. To match Qiskit Aer's double-precision statevector outputs within $10^{-9}$ tolerance, the runner forces `dtype=np.complex128`.
4. **Vercel Header Regex Syntax:**
   - Vercel's routing engine parses header `source` parameters using `path-to-regexp`. Standard non-capturing regex groups (such as `/(?:bundle\.js|index\.html)`) trigger deployment errors. Use path patterns like `/(.*)` instead.
5. **Cold-Start Latency:**
   - Importing scientific packages like Qiskit, Cirq, and Sympy on process startup can take 8–10 seconds. The runner executes a warmup task on startup to pre-load worker processes. Keep workers alive between requests to ensure low-millisecond execution.
