<a name="top"></a>

# QUBIQ · Interactive Quantum Laboratory & Workbench

[![Python 3.11](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Qiskit 1.2.4](https://img.shields.io/badge/Qiskit-1.2.4-6929C4?logo=qiskit&logoColor=white)](https://qiskit.org/)
[![Cirq 1.4.1](https://img.shields.io/badge/Cirq-1.4.1-4285F4)](https://quantumai.google/cirq)
[![PennyLane 0.38](https://img.shields.io/badge/PennyLane-0.38.0-FBB040)](https://pennylane.ai/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.141-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Tests Passing](https://img.shields.io/badge/tests-560%2B%20passing-brightgreen)](tests/)
[![Cross-SDK Parity](https://img.shields.io/badge/cross--SDK%20parity-1e--9%20fidelity-blueviolet)](tests/crossval)
[![OS Compatibility](https://img.shields.io/badge/OS-Linux%2C%20Windows%2C%20macOS-0078D4)](docker-compose.yml)
[![Deployment](https://img.shields.io/badge/deploy-Docker%2C%20Vercel-black)](vercel.json)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

⭐ Star us on GitHub: your support motivates us a lot! 🙏😊

[![Share on X](https://img.shields.io/badge/share-000000?logo=x&logoColor=white)](https://x.com/intent/tweet?text=Check%20out%20QUBIQ%20-%20an%20interactive%20quantum%20workbench%20and%20course%20with%20real%20SDK%20execution%20and%20cross-SDK%20validation!)
[![Share on LinkedIn](https://img.shields.io/badge/share-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/sharing/share-offsite/?url=https://github.com/your-org/qubiq)
[![Share on Reddit](https://img.shields.io/badge/share-FF4500?logo=reddit&logoColor=white)](https://www.reddit.com/submit?title=QUBIQ%20-%20Interactive%20Quantum%20Laboratory%20%26%20Workbench)
[![Share on Telegram](https://img.shields.io/badge/share-0088CC?logo=telegram&logoColor=white)](https://t.me/share/url?url=https://github.com/your-org/qubiq&text=Check%20out%20QUBIQ%20on%20GitHub)

An interactive quantum computing laboratory, circuit composer, and 4-module structured course. You drag gates onto wires, see statevectors, Bloch spheres, and probabilities evolve in real time, inspect the circuit as bi-directional Qiskit, Cirq, PennyLane, or OpenQASM 3 code, and run jobs on **real quantum SDKs** through a lightweight Python runner service with verified provenance.

---

## Table of Contents
- [About](#-about)
- [Quickstart](#-quickstart)
- [What's New](#-whats-new)
- [Cross-SDK Parity & Verification](#-cross-sdk-parity--verification)
- [How to Install and Run](#-how-to-install-and-run)
- [Documentation](#-documentation)
- [Feedback and Contributions](#-feedback-and-contributions)
- [License](#-license)
- [Contacts](#-contacts)

---

## 🚀 About

Most quantum learning tools force an awkward choice: toy web visualizers that cannot export real code, or bare Jupyter notebooks where you cannot see what a state looks like without writing boilerplate matplotlib plotting scripts.

We built **QUBIQ** to eliminate that compromise. It is a two-part engineering system:

1. **A zero-bloat client workbench (`apps/web`):** Built with pure vanilla ES6 modules concatenated into a single HTML bundle. No React runtime, no Webpack bundle overhead, no node_modules required to serve production traffic. The in-browser simulation engine (`simlib.js`) computes exact statevectors and density matrices for up to 16 qubits directly on the client.
2. **A real-SDK runner microservice (`services/runner`):** A Python 3.11 FastAPI service that takes a unified JSON circuit IR (`qlab-ir/1`), translates it into native objects across **Qiskit Aer**, **Cirq**, **PennyLane**, **qBraid**, or **IBM Quantum**, runs the circuit, and returns the result with an unforgeable provenance payload.

### Core Engineering Principles
- **No Faked SDK Results:** If a result badge says `Qiskit Aer 0.15.1 · 1000 shots`, it actually came from Qiskit Aer running on a Python process. If the runner service is offline, the interface explicitly displays *"Offline — start the runner"*. We never silently fake backend execution in browser JavaScript.
- **Bi-Directional Code Sync:** Switch between Qiskit, Cirq, PennyLane, and OpenQASM 3 on the fly. Edit the code in the split panel, and the circuit canvas re-parses and updates in reverse.
- **Shared Noise Physics:** Noise models (depolarizing, amplitude damping with $T_1$, phase damping with $T_2$, and readout error) are written as exact Kraus operators unified across all SDK backends down to $10^{-9}$ numerical agreement.
- **Grounded AI Tutor:** The tutor voice (QUBIT) is hard-grounded against the simulator state. Every probability, amplitude, or entanglement measurement it mentions is computed by the simulator, not halluncinated by an LLM. When no API key is provided, an offline rule-based physics engine takes over seamlessly.

---

## ⚡ Quickstart

### Method 1: Docker Compose (Recommended full stack)

```bash
# Clone the repository
git clone https://github.com/your-org/qubiq.git
cd qubiq

# Start web client, runner, sandbox image, redis, and postgres
docker compose build
docker compose up
```

- Web Application: **[http://localhost:8080](http://localhost:8080)**
- Runner OpenAPI Documentation: **[http://localhost:8765/docs](http://localhost:8765/docs)**

---

### Method 2: Local Development (Without Docker)

#### 1. Start the Python Runner Service
```bash
# Set up Python 3.11 environment
python -m venv .venv
# Linux / macOS:
source .venv/bin/activate
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1

# Install runner dependencies
pip install -r services/runner/requirements.txt

# Run FastAPI service
cd services/runner
uvicorn qlab_runner.app:app --host 127.0.0.1 --port 8765
```

#### 2. Build and Serve the Frontend
In a separate terminal window:
```bash
cd apps/web

# Bundle JS and CSS into dist/index.html
python build.py

# Serve statically
python -m http.server --directory dist 8080
```
Open **[http://localhost:8080](http://localhost:8080)** in your browser.

---

### Method 3: Run the Test Suites

We verify every physics calculation, UI gate transformation, and cross-SDK agreement check:

```bash
# Frontend physics & compiler tests (133 checks)
cd apps/web
node runtests.js       # 17/17 physics checks (Bell, Shor, H2 VQE, QFT, Stabilizer)
node contenttest.js    # 34/34 course checks
node wbtest.js         # 82/82 workbench checks (25 gate matrices & 4-SDK code round-trips)
node learntest.js      # 384/384 curriculum checks

# Backend cross-SDK validation & API tests (root directory)
cd ../..
PYTHONPATH=services/runner pytest tests/crossval -q     # 31/31 cross-SDK checks
PYTHONPATH=services/runner pytest tests/runner/test_auth_projects.py -v
python tests/runner/smoke_api.py                        # Full API smoke test
```

---

## ✨ What's New

### Version 0.2 — The Curriculum & Diagnostics Update
- **4 Structured Learning Modules (`#learn`):** 19 interactive lessons covering Qubits, Unitary Gates, Entanglement, and Quantum Algorithms, ending with rigorous module assessments.
- **Live Circuit Narration (`insight.js`):** A step-by-step explanatory voice in the Laboratory that dynamically updates on every wire edit, highlighting exactly which qubits moved, when relative phase shifted, and when two wires became entangled.
- **AST Error Detection & Linter:** Live circuit heuristics that automatically detect dead controls (e.g. CNOT controlled on $|0\rangle$), adjacent self-canceling gates ($H \cdot H$, $X \cdot X$), and unmeasured wires with one-click cleanup buttons.
- **Bayesian Knowledge Tracing (BKT):** Learner mastery is tracked per concept ($p_{\text{init}}=0.20, p_{\text{transit}}=0.15, p_{\text{guess}}=0.20, p_{\text{slip}}=0.10$) and rendered on a personal Progress dashboard.
- **Python Script Execution Mode (`/v1/exec`):** Write arbitrary Python using Qiskit or Cirq in the browser, execute it inside an isolated sandbox, and automatically discover and import generated circuits onto the workbench canvas.
- **Cross-SDK Comparison Card:** Run identical circuits across multiple backends simultaneously over Server-Sent Events (SSE), with overlaid count distribution histograms, Total Variation Distance (TVD), and Hellinger fidelity tables.
- **Cloud Persistence & Auth (`db.py`):** User accounts, project revision trees, progress syncing, and shareable read-only project tokens powered by SQLite and PostgreSQL.

---

## 🎓 Cross-SDK Parity & Verification

We enforce mathematical agreement across all SDK implementations. We do not assume libraries agree; our test suite asserts it.

Every non-trivial circuit in our test corpus is evaluated against Qiskit Aer (`aer.statevector`), Google Cirq (`cirq.simulator`), and PennyLane (`pennylane.default.qubit` and `pennylane.lightning.qubit`):

```
Statevector Overlap Fidelity:  F = |⟨ψ_ref | ψ_target⟩|² ≥ 1.0 - 10⁻⁹
Shot Counts Consistency:       χ² goodness-of-fit (p > 0.001) & TVD ≤ 3σ
```

### Verification Matrix Summary

| Circuit | Wires | Target Operations | Aer | Cirq | PennyLane | Lightning |
|---|:---:|---|:---:|:---:|:---:|:---:|
| **Bell State** | 2 | $H, \text{CNOT}$ | `PASS` | `PASS` ($F=1.0$) | `PASS` ($F=1.0$) | `PASS` ($F=1.0$) |
| **GHZ-5** | 5 | $H, \text{CNOT}^{\otimes 4}$ | `PASS` | `PASS` ($F=1.0$) | `PASS` ($F=1.0$) | `PASS` ($F=1.0$) |
| **QFT-4** | 4 | $H, \text{CR}_k, \text{SWAP}$ | `PASS` | `PASS` ($F=1.0$) | `PASS` ($F=1.0$) | `PASS` ($F=1.0$) |
| **Parametric-3** | 3 | $U, R_{zz}, CP(\theta), \text{iSWAP}, \sqrt{X}, CC\text{-}R_y$ | `PASS` | `PASS` ($F=1.0$) | `PASS` ($F=1.0$) | `PASS` ($F=1.0$) |
| **Wide-10** | 10 | $H^{\otimes 10}, \text{CZ}$ cluster network | `PASS` | `PASS` ($F=1.0$) | `PASS` ($F=1.0$) | `PASS` ($F=1.0$) |

To inspect the live matrix directly in the app, navigate to the `#validation` route.

---

## 📦 How to Install and Run

### 1. Docker Production Stack
Our `docker-compose.yml` runs 5 production-isolated services:
- **`web`**: Nginx 1.27 Alpine serving pre-built static assets with gzip compression, security headers, and aggressive caching.
- **`runner`**: FastAPI service running under Python 3.11 with process pooling.
- **`sandbox-image`**: Minimal, network-isolated container image (`--network none`, read-only root) for user script execution.
- **`redis`**: Token bucket rate-limiting and job caching.
- **`postgres`**: Relational persistence for accounts, project version trees, and learner progress.

```bash
docker compose up -d
```

### 2. Standalone Frontend on Vercel
Because the frontend (`apps/web`) compiles into a completely self-contained static directory (`dist/index.html` + `dist/bundle.js` + `dist/validation.json`), it deploys to Vercel with zero server overhead:

```bash
# Deploy with Vercel CLI
npx vercel --prod
```
The repository includes a battle-tested [vercel.json](vercel.json) that automatically handles static generation, security headers, and validation endpoint rewrites.

---

## 📚 Documentation

Detailed engineering documentation is located in the [docs/](docs/) directory:

- 📖 **[DOCUMENTATION.md](DOCUMENTATION.md)**: Full systems architecture, `qlab-ir/1` schema specification, bit-order conversion mechanics, 15 backend capability matrix, Kraus noise operator derivations, sandbox design, and module map.
- 🎓 **[AI_TUTOR_AND_LEARNING.md](docs/AI_TUTOR_AND_LEARNING.md)**: Curriculum breakdown, Bayesian Knowledge Tracing specifications, diagnostic heuristics, and Gemini / Claude API proxy integration.
- 📐 **[DESIGN.md](apps/web/DESIGN.md)**: Adora/Steep design system reference: color tokens, typography scales, accessibility rules, and canvas styling.
- 🗺️ **[IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)**: Phased engineering roadmap, technical debt register, and milestone tracker.

---

## 🤝 Feedback and Contributions

QUBIQ is open source and actively developed. If you discover a gate matrix mismatch, an edge case in our OpenQASM 3 parser, or an unsupported dynamic circuit branch in a backend, we want to know.

- **Found a bug?** Submit a reproduction script or circuit IR to [GitHub Issues](https://github.com/your-org/qubiq/issues).
- **Proposing a feature?** Start a thread on [GitHub Discussions](https://github.com/your-org/qubiq/discussions).
- **Submitting code?** Ensure all physics tests (`node apps/web/runtests.js`), compiler checks (`node apps/web/wbtest.js`), and cross-SDK validation (`pytest tests/crossval`) pass before opening a PR.

---

## 📃 License

Distributed under the **Apache License 2.0**. See [LICENSE](LICENSE) for details.

You are free to use, modify, distribute, and embed this workbench for academic, commercial, or research purposes.

---

## 🗨️ Contacts

- **GitHub Issues:** [github.com/your-org/qubiq/issues](https://github.com/your-org/qubiq/issues)
- **Security Inquiries:** Open a security advisory on GitHub or email the maintainers directly.

[Back to top](#top)
