"""Execution on real SDK backends. Every result carries provenance: the SDK and version
that actually ran it, the backend/method, seed, shots and wall time."""
from __future__ import annotations

import importlib.metadata as md
import math
import os
import time
from typing import Any, Optional

import numpy as np

from .build import cbit, noise_label, pennylane_body, to_cirq, to_qiskit
from .ir import Circuit

LIMIT_STATE = 20  # largest n for which a full state is returned


def ver(pkg: str) -> str:
    try:
        return md.version(pkg)
    except md.PackageNotFoundError:
        return "not installed"


def _perm_from_little(n: int) -> np.ndarray:
    """index map: ours (q0 = most significant) ← little-endian (q0 = least significant)."""
    idx = np.arange(1 << n)
    rev = np.zeros_like(idx)
    for k in range(n):
        rev |= ((idx >> (n - 1 - k)) & 1) << k
    return rev


def parse_observable(text: str, n: int) -> list[tuple[float, list[tuple[str, int]]]]:
    terms = []
    src = text.replace("−", "-").replace(" - ", " + -").replace("- ", "-")
    for part in [p.strip() for p in src.split("+") if p.strip()]:
        toks = part.replace("*", " ").split()
        coef, ops = 1.0, []
        for t in toks:
            if t in ("-",):
                coef = -coef
                continue
            try:
                coef *= float(t)
                continue
            except ValueError:
                pass
            P, q = t[0].upper(), int(t[1:].lstrip("_"))
            if P not in "IXYZ" or q >= n:
                raise ValueError(f"bad Pauli term '{t}'")
            if P != "I":
                ops.append((P, q))
        terms.append((coef, ops))
    return terms


_PM = {"X": np.array([[0, 1], [1, 0]]), "Y": np.array([[0, -1j], [1j, 0]]), "Z": np.array([[1, 0], [0, -1]])}


def pauli_matrix(n: int, ops: list[tuple[str, int]]) -> np.ndarray:
    m = np.array([[1]], dtype=complex)
    d = dict((q, P) for P, q in ops)
    for q in range(n):  # q0 is the most significant factor
        m = np.kron(m, _PM[d[q]] if q in d else np.eye(2))
    return m


def expectation(state: np.ndarray, n: int, text: str) -> float:
    rho = state if state.ndim == 2 else np.outer(state, state.conj())
    return float(sum(c * np.real(np.trace(rho @ pauli_matrix(n, ops))) for c, ops in parse_observable(text, n)))


def _counts_from_bits(rows: np.ndarray) -> dict[str, int]:
    out: dict[str, int] = {}
    for r in rows:
        k = "".join(str(int(b)) for b in r)
        out[k] = out.get(k, 0) + 1
    return out


# ---------------------------------------------------------------- backends
def backends() -> list[dict[str, Any]]:
    ibm = bool(os.environ.get("QLAB_IBM_TOKEN"))
    qb = bool(os.environ.get("QBRAID_API_KEY"))
    B = [
        {"id": "aer.statevector", "sdk": "Qiskit Aer", "pkg": "qiskit-aer", "method": "statevector", "maxQubits": 30, "noise": True, "state": True, "dynamic": True},
        {"id": "aer.density_matrix", "sdk": "Qiskit Aer", "pkg": "qiskit-aer", "method": "density_matrix", "maxQubits": 14, "noise": True, "state": True, "dynamic": True},
        {"id": "aer.matrix_product_state", "sdk": "Qiskit Aer", "pkg": "qiskit-aer", "method": "matrix_product_state", "maxQubits": 100, "noise": False, "state": False, "dynamic": True},
        {"id": "aer.stabilizer", "sdk": "Qiskit Aer", "pkg": "qiskit-aer", "method": "stabilizer", "maxQubits": 5000, "noise": False, "state": False, "dynamic": True, "clifford": True},
        {"id": "aer.automatic", "sdk": "Qiskit Aer", "pkg": "qiskit-aer", "method": "automatic", "maxQubits": 30, "noise": True, "state": False, "dynamic": True},
        {"id": "aer.fake_sherbrooke", "sdk": "Qiskit Aer", "pkg": "qiskit-aer", "method": "noise model from FakeSherbrooke (127 q)", "maxQubits": 20, "noise": "device", "state": False, "dynamic": False},
        {"id": "aer.fake_kyiv", "sdk": "Qiskit Aer", "pkg": "qiskit-aer", "method": "noise model from FakeKyiv (127 q)", "maxQubits": 20, "noise": "device", "state": False, "dynamic": False},
        {"id": "cirq.simulator", "sdk": "Cirq", "pkg": "cirq-core", "method": "cirq.Simulator", "maxQubits": 24, "noise": True, "state": True, "dynamic": True},
        {"id": "cirq.density_matrix", "sdk": "Cirq", "pkg": "cirq-core", "method": "cirq.DensityMatrixSimulator", "maxQubits": 12, "noise": True, "state": True, "dynamic": True},
        {"id": "pennylane.default.qubit", "sdk": "PennyLane", "pkg": "pennylane", "method": "default.qubit", "maxQubits": 24, "noise": False, "state": True, "dynamic": True},
        {"id": "pennylane.default.mixed", "sdk": "PennyLane", "pkg": "pennylane", "method": "default.mixed", "maxQubits": 12, "noise": True, "state": True, "dynamic": False},
        {"id": "pennylane.lightning.qubit", "sdk": "PennyLane", "pkg": "pennylane-lightning", "method": "lightning.qubit", "maxQubits": 26, "noise": False, "state": True, "dynamic": False},
        {"id": "qbraid.cirq", "sdk": "qBraid", "pkg": "qbraid", "method": "qbraid.transpile(qiskit→cirq) then cirq.Simulator", "maxQubits": 20, "noise": False, "state": True, "dynamic": False},
        {"id": "qbraid.device", "sdk": "qBraid", "pkg": "qbraid", "method": "QbraidProvider device", "available": qb, "reason": None if qb else "set QBRAID_API_KEY", "maxQubits": 32, "noise": "device", "state": False, "dynamic": False},
        {"id": "ibm.hardware", "sdk": "IBM Quantum", "pkg": "qiskit-ibm-runtime", "method": "SamplerV2 on a real QPU (queued)", "available": ibm, "reason": None if ibm else "set QLAB_IBM_TOKEN", "maxQubits": 127, "noise": "device", "state": False, "dynamic": False},
    ]
    for b in B:
        b["version"] = ver(b["pkg"])
        b.setdefault("available", b["version"] != "not installed")
    return B


def run(ir: dict, backend: str, shots: int = 1024, seed: Optional[int] = None, noise: Optional[dict] = None,
        want_state: bool = False, observables: Optional[list[str]] = None, bind: Optional[dict] = None) -> dict[str, Any]:
    C = Circuit.model_validate(ir)
    info = next((b for b in backends() if b["id"] == backend), None)
    if info is None:
        raise ValueError(f"unknown backend '{backend}'")
    if not info["available"]:
        raise RuntimeError(f"{info['sdk']} backend '{backend}' is not configured: {info.get('reason')}")
    if C.n > info["maxQubits"]:
        raise ValueError(f"{backend} is limited to {info['maxQubits']} qubits here; this circuit has {C.n}")
    if noise and info["noise"] is False:
        raise ValueError(f"{backend} has no noise support; pick aer.density_matrix, cirq.density_matrix or pennylane.default.mixed")
    t0 = time.perf_counter()
    warnings: list[str] = []
    sdk_name = backend.split(".")[0]
    if sdk_name == "aer":
        out = _run_aer(C, info, shots, seed, noise, want_state, bind, warnings)
    elif sdk_name == "cirq":
        out = _run_cirq(C, info, shots, seed, noise, want_state, bind, warnings)
    elif sdk_name == "pennylane":
        out = _run_pennylane(C, info, shots, seed, noise, want_state, bind, warnings)
    elif backend == "qbraid.cirq":
        out = _run_qbraid_cirq(C, info, shots, seed, want_state, bind, warnings)
    elif backend == "ibm.hardware":
        raise RuntimeError("IBM hardware jobs are queued: POST /v1/ibm/jobs")
    else:
        raise RuntimeError(f"{backend} is not runnable from this service")
    ms = (time.perf_counter() - t0) * 1000
    state = out.pop("state", None)
    if observables and state is not None:
        out["expectation"] = {o: expectation(state, C.n, o) for o in observables}
    if want_state and state is not None:
        if state.ndim == 1:
            out["statevector"] = [[float(z.real), float(z.imag)] for z in state]
            probs = np.abs(state) ** 2
        else:
            out["density"] = {"re": np.real(state).tolist(), "im": np.imag(state).tolist()}
            probs = np.real(np.diag(state))
        out["probabilities"] = {format(i, f"0{C.n}b"): float(p) for i, p in enumerate(probs) if p > 1e-12}
    out["provenance"] = {"sdk": info["sdk"], "sdkVersion": info["version"], "backend": backend, "method": info["method"], "seed": seed, "shots": shots,
                         "ms": round(ms, 1), "where": "server", "noise": noise_label(noise) if noise else None,
                         "versions": {k: ver(k) for k in ("qiskit", "qiskit-aer", "cirq-core", "pennylane", "qbraid")} if sdk_name == "qbraid" else None}
    out["warnings"] = warnings
    return out


# ---------------- Qiskit Aer ----------------
def _run_aer(C: Circuit, info, shots, seed, noise, want_state, bind, warnings):
    from qiskit import transpile
    from qiskit_aer import AerSimulator

    fake = None
    if info["id"].startswith("aer.fake_"):
        from qiskit_ibm_runtime import fake_provider
        fake = {"aer.fake_sherbrooke": fake_provider.FakeSherbrooke, "aer.fake_kyiv": fake_provider.FakeKyiv}[info["id"]]()
        sim = AerSimulator.from_backend(fake)
    else:
        sim = AerSimulator(method=info["method"])
    qc = to_qiskit(C, bind, noise=noise)
    tqc = transpile(qc, sim, seed_transpiler=seed if seed is not None else 11, optimization_level=1)
    res = sim.run(tqc, shots=shots, seed_simulator=seed).result()
    raw = res.get_counts()
    cbs = C.measured_cbs() or list(range(C.n))
    nc = len(qc.clbits)
    counts: dict[str, int] = {}
    for k, v in raw.items():
        k = k.replace(" ", "")
        key = "".join(k[nc - 1 - cb] for cb in cbs)  # Qiskit prints c0 on the right
        counts[key] = counts.get(key, 0) + v
    out: dict[str, Any] = {"counts": counts, "keys": cbs, "rawQiskitCounts": raw}
    try:
        from qiskit import qasm3
        text = qasm3.dumps(tqc)
    except Exception:
        text = str(tqc.draw(output="text"))
    ops = {k: int(v) for k, v in tqc.count_ops().items()}
    out["transpiled"] = {"text": text[:20000], "format": "openqasm3", "depth": tqc.depth(), "ops": ops, "target": fake.name if fake else f"AerSimulator({info['method']})"}
    if fake is not None:
        warnings.append(f"Calibration snapshot bundled with qiskit-ibm-runtime {ver('qiskit-ibm-runtime')} ({fake.name}); circuits are routed onto its coupling map.")
    if want_state and C.n <= LIMIT_STATE and fake is None and info["method"] in ("statevector", "density_matrix", "automatic"):
        if C.is_dynamic():
            warnings.append("No full state for a dynamic circuit (it differs per shot).")
        else:
            qs = to_qiskit(C, bind, measure=False, noise=noise, measure_all_if_none=False)
            method = "density_matrix" if (noise or info["method"] == "density_matrix") else "statevector"
            if method == "density_matrix":
                qs.save_density_matrix()
            else:
                qs.save_statevector()
            s = AerSimulator(method=method)
            r = s.run(transpile(qs, s, optimization_level=0), shots=1, seed_simulator=seed).result()
            perm = _perm_from_little(C.n)
            if method == "density_matrix":
                rho = np.asarray(r.data(0)["density_matrix"])
                out["state"] = rho[np.ix_(perm, perm)]
            else:
                out["state"] = np.asarray(r.get_statevector())[perm]
    return out


# ---------------- Cirq ----------------
def _run_cirq(C: Circuit, info, shots, seed, noise, want_state, bind, warnings):
    import cirq

    circuit, Q = to_cirq(C, bind, noise=noise)
    sim = cirq.DensityMatrixSimulator(seed=seed, dtype=np.complex128) if (info["id"] == "cirq.density_matrix" or noise) else cirq.Simulator(seed=seed, dtype=np.complex128)
    if noise and info["id"] == "cirq.simulator":
        warnings.append("Noise channels need mixed states: ran on cirq.DensityMatrixSimulator.")
    res = sim.run(circuit, repetitions=shots)
    cbs = C.measured_cbs() or list(range(C.n))
    cols = [res.records[f"c{cb}"][:, -1, 0] for cb in cbs]
    counts = _counts_from_bits(np.stack(cols, axis=1))
    out: dict[str, Any] = {"counts": counts, "keys": cbs, "transpiled": {"text": str(circuit)[:20000], "format": "cirq-diagram", "depth": len(circuit), "ops": _cirq_ops(circuit)}}
    if want_state and C.n <= LIMIT_STATE:
        if C.is_dynamic():
            warnings.append("No full state for a dynamic circuit (it differs per shot).")
        else:
            c2, Q2 = to_cirq(C, bind, measure=False, noise=noise, measure_all_if_none=False)
            if noise or info["id"] == "cirq.density_matrix":
                r = cirq.DensityMatrixSimulator(seed=seed, dtype=np.complex128).simulate(c2, qubit_order=Q2)
                out["state"] = np.asarray(r.final_density_matrix)
            else:
                r = cirq.Simulator(seed=seed, dtype=np.complex128).simulate(c2, qubit_order=Q2)
                out["state"] = np.asarray(r.final_state_vector)
    return out


def _cirq_ops(circuit) -> dict[str, int]:
    d: dict[str, int] = {}
    for op in circuit.all_operations():
        k = str(op.gate) if op.gate is not None else type(op).__name__
        k = k.split("(")[0]
        d[k] = d.get(k, 0) + 1
    return d


# ---------------- PennyLane ----------------
def _run_pennylane(C: Circuit, info, shots, seed, noise, want_state, bind, warnings):
    import pennylane as qml

    name = info["method"]
    if noise and name != "default.mixed":
        name = "default.mixed"
        warnings.append("Noise channels need mixed states: ran on default.mixed.")
    dyn = C.is_dynamic()
    if dyn and name != "default.qubit":
        raise ValueError(f"{name} does not run mid-circuit measurement here; use pennylane.default.qubit")
    kw = {"wires": C.n, "shots": shots}
    try:
        dev = qml.device(name, seed=seed, **kw) if seed is not None else qml.device(name, **kw)
    except TypeError:
        dev = qml.device(name, **kw)
        warnings.append(f"{name} does not take a seed; results are not seed-reproducible.")
    apply, measured = pennylane_body(C, bind, noise=noise)
    cbs = C.measured_cbs() or list(range(C.n))
    if dyn:
        @qml.qnode(dev, mcm_method="one-shot")
        def qn():
            mids = apply()
            return [qml.sample(op=mids[cb]) for cb in cbs]
        cols = [np.asarray(x).reshape(-1) for x in qn()]
        counts = _counts_from_bits(np.stack(cols, axis=1))
    else:
        wires = [q for cb, q, _ in measured] if measured else list(range(C.n))

        @qml.qnode(dev)
        def qn():
            apply()
            return qml.counts(wires=wires)
        raw = qn()
        counts = {k: int(v) for k, v in raw.items() if int(v)}
    out: dict[str, Any] = {"counts": counts, "keys": cbs}
    try:
        out["transpiled"] = {"text": qml.draw(qn)(), "format": "pennylane-draw", "depth": None, "ops": {}}
    except Exception:
        pass
    if want_state and C.n <= LIMIT_STATE and not dyn:
        sdev = qml.device(name if name != "lightning.qubit" else "lightning.qubit", wires=C.n)
        apply2, _ = pennylane_body(C, bind, noise=noise, measure=False)

        @qml.qnode(sdev)
        def st():
            apply2()
            return qml.state() if name != "default.mixed" else qml.density_matrix(wires=list(range(C.n)))
        out["state"] = np.asarray(st())
    return out


# ---------------- qBraid ----------------
def _run_qbraid_cirq(C: Circuit, info, shots, seed, want_state, bind, warnings):
    """A genuine qBraid path: our Qiskit circuit is converted by qbraid.transpile to Cirq,
    then executed on cirq.Simulator. Qubit identity is preserved by qBraid's LineQubit mapping."""
    import cirq
    from qbraid.transpiler import transpile as qbt

    if C.is_dynamic():
        raise ValueError("qBraid conversion of dynamic circuits is not supported here")
    qc = to_qiskit(C, bind, measure=False, measure_all_if_none=False)
    cc = qbt(qc, "cirq")
    qubits = sorted(cc.all_qubits())
    if len(qubits) != C.n:  # idle qubits dropped by conversion
        qubits = cirq.LineQubit.range(C.n)
    r = cirq.Simulator(seed=seed, dtype=np.complex128).simulate(cc, qubit_order=qubits)
    sv = np.asarray(r.final_state_vector)
    # qBraid keeps Qiskit's qubit indices → q_k is LineQubit(k), q0 most significant: same as ours.
    cbs = C.measured_cbs() or list(range(C.n))
    qmap = {cbit(o): o.q[0] for o in C.ops if o.g == "M"} or {q: q for q in range(C.n)}
    rng = np.random.default_rng(seed)
    probs = np.abs(sv) ** 2
    idx = rng.choice(len(probs), size=shots, p=probs / probs.sum())
    rows = np.array([[(i >> (C.n - 1 - qmap[cb])) & 1 for cb in cbs] for i in idx])
    warnings.append("Sampled from the Cirq final state (measurements are terminal).")
    return {"counts": _counts_from_bits(rows), "keys": cbs, "state": sv, "transpiled": {"text": str(cc)[:20000], "format": "cirq-diagram (via qBraid)", "depth": len(cc), "ops": _cirq_ops(cc)}}
