# QUBIQ

An interactive quantum-computing course and circuit workbench. The web app runs circuits on real SDKs (Qiskit Aer, Cirq, PennyLane, qBraid, IBM Quantum) through a Python runner, and every result carries provenance.

```bash
docker compose build && docker compose up      # web :8080 · runner :8765/docs
# or, without Docker:
pip install -r services/runner/requirements.txt
cd services/runner && QLAB_SANDBOX=local uvicorn qlab_runner.app:app --port 8765
PYTHONPATH=services/runner pytest tests/crossval -q
```

- **docs/DOCUMENTATION.md**: architecture, IR, API, backends, noise, sandbox, frontend map, testing, status.
- **docs/IMPLEMENTATION_PLAN.md**: the phased plan to finish the workbench, with acceptance tests.
