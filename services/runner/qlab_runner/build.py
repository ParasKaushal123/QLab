"""IR → native SDK objects. Every gate maps to the SDK's own gate with the same matrix
(verified to 1e-9 by tests/crossval). Noise from the QUBIQ noise model is inserted as each
SDK's own channels, in the same order as the browser simulator: after every gate, on each
wire, depolarizing(p) → amplitude damping(γ) → phase damping(λ); readout error as a bit flip
immediately before each measurement.
"""
from __future__ import annotations

import math
from typing import Optional

import numpy as np

from .ir import Circuit, Op, bound_params, RegCond


# ---------------- noise model shared by every SDK ----------------
def channels_for(op: Op, n: int, noise: Optional[dict]) -> list[tuple[str, int, float]]:
    """[(kind, qubit, parameter)] applied after op. kinds: depol (Cirq/PennyLane convention:
    (1-p)ρ + p/3 ΣPρP), amp (γ), phase (λ)."""
    if not noise or op.g in ("M", "RESET", "BARRIER", "I"):
        return []
    wires = op.c + op.q
    multi = len(wires) > 1
    p = (noise.get("p2") if multi else noise.get("p1")) or 0.0
    out = []
    for q in wires:
        if p:
            out.append(("depol", q, p))
        t1 = noise.get("t1")
        if t1:
            dt = ((noise.get("g2") or 300) if multi else (noise.get("g1") or 35)) / 1000.0
            gam = 1 - math.exp(-dt / t1)
            out.append(("amp", q, gam))
            t2 = noise.get("t2")
            if t2:
                tphi = 1 / max(1e-9, 1 / t2 - 1 / (2 * t1))
                lam = 1 - math.exp(-dt / tphi)
                out.append(("phase", q, lam))
    return out


def noise_label(noise: Optional[dict]) -> Optional[str]:
    if not noise:
        return None
    parts = [f"{k}={noise[k]}" for k in ("p1", "p2", "t1", "t2", "readout") if noise.get(k)]
    return "QUBIQ channels: " + ", ".join(parts) if parts else None


def kraus(kind: str, x: float) -> list[np.ndarray]:
    if kind == "depol":
        s = math.sqrt(x / 3)
        return [math.sqrt(1 - x) * np.eye(2), s * np.array([[0, 1], [1, 0]]), s * np.array([[0, -1j], [1j, 0]]), s * np.array([[1, 0], [0, -1]])]
    if kind == "amp":
        return [np.array([[1, 0], [0, math.sqrt(1 - x)]]), np.array([[0, math.sqrt(x)], [0, 0]])]
    if kind == "phase":
        return [np.array([[1, 0], [0, math.sqrt(1 - x)]]), np.array([[0, 0], [0, math.sqrt(x)]])]
    if kind == "flip":
        return [math.sqrt(1 - x) * np.eye(2), math.sqrt(x) * np.array([[0, 1], [1, 0]])]
    raise ValueError(kind)


def u_matrix(t: float, f: float, l: float) -> np.ndarray:
    c, s = math.cos(t / 2), math.sin(t / 2)
    return np.array([[c, -np.exp(1j * l) * s], [np.exp(1j * f) * s, np.exp(1j * (f + l)) * c]])


def cbit(op: Op) -> int:
    return op.cb if op.cb is not None else op.q[0]


# ================= Qiskit =================
def to_qiskit(C: Circuit, env: Optional[dict] = None, *, measure: bool = True, noise: Optional[dict] = None, measure_all_if_none: bool = True):
    from qiskit import ClassicalRegister, QuantumCircuit, QuantumRegister
    from qiskit.circuit import library as L
    from qiskit.quantum_info import Kraus

    env = {**C.params, **(env or {})}
    has_m = any(o.g == "M" for o in C.ops)
    nc = max(C.nc or 0, C.n if (measure and not has_m and measure_all_if_none) else 0, 1 + max([cbit(o) for o in C.ops if o.g == "M"], default=-1))
    qr, cr = QuantumRegister(C.n, "q"), ClassicalRegister(max(nc, 1), "c")
    qc = QuantumCircuit(qr, cr, name=C.name or "circuit")
    one = {"I": L.IGate, "X": L.XGate, "Y": L.YGate, "Z": L.ZGate, "H": L.HGate, "S": L.SGate, "SDG": L.SdgGate, "T": L.TGate, "TDG": L.TdgGate, "SX": L.SXGate, "SXDG": L.SXdgGate}

    def gate(op: Op):
        p = bound_params(op, env)
        g = op.g
        if g in one:
            G = one[g]()
        elif g == "P":
            G = L.PhaseGate(p[0])
        elif g == "RX":
            G = L.RXGate(p[0])
        elif g == "RY":
            G = L.RYGate(p[0])
        elif g == "RZ":
            G = L.RZGate(p[0])
        elif g == "U":
            G = L.UGate(*p[:3])
        elif g == "SWAP":
            G = L.SwapGate()
        elif g == "ISWAP":
            G = L.iSwapGate()
        elif g == "ISWAPDG":
            G = L.iSwapGate().inverse()
        elif g == "RXX":
            G = L.RXXGate(p[0])
        elif g == "RYY":
            G = L.RYYGate(p[0])
        elif g == "RZZ":
            G = L.RZZGate(p[0])
        else:
            raise ValueError(g)
        if op.c:
            G = G.control(len(op.c))
        return G

    # Qiskit orders qubits little-endian; our q0 is the leftmost bit. We keep qubit indices
    # identical (qr[k] is our q_k) and convert bit order only when reading results.
    def body(op: Op):
        if op.g == "M":
            if noise and noise.get("readout"):
                qc.append(Kraus(kraus("flip", noise["readout"])).to_instruction(), [qr[op.q[0]]])
            qc.measure(qr[op.q[0]], cr[cbit(op)])
        elif op.g == "RESET":
            qc.reset(qr[op.q[0]])
        elif op.g == "BARRIER":
            qc.barrier(*[qr[q] for q in op.q])
        else:
            qc.append(gate(op), [qr[q] for q in op.c + op.q])
            for kind, q, x in channels_for(op, C.n, noise):
                qc.append(Kraus(kraus(kind, x)).to_instruction(), [qr[q]])

    for op in C.ordered():
        if not measure and op.g == "M":
            continue
        if op.cond is not None:
            cond = (cr, op.cond.val) if isinstance(op.cond, RegCond) else (cr[op.cond.bit], op.cond.val)
            with qc.if_test(cond):
                body(op)
        else:
            body(op)
    if measure and not has_m and measure_all_if_none:
        for q in range(C.n):
            if noise and noise.get("readout"):
                qc.append(Kraus(kraus("flip", noise["readout"])).to_instruction(), [qr[q]])
            qc.measure(qr[q], cr[q])
    return qc


# ================= Cirq =================
def to_cirq(C: Circuit, env: Optional[dict] = None, *, measure: bool = True, noise: Optional[dict] = None, measure_all_if_none: bool = True):
    import cirq
    import sympy

    env = {**C.params, **(env or {})}
    Q = cirq.LineQubit.range(C.n)
    one = {"I": cirq.I, "X": cirq.X, "Y": cirq.Y, "Z": cirq.Z, "H": cirq.H, "S": cirq.S, "SDG": cirq.S ** -1, "T": cirq.T, "TDG": cirq.T ** -1,
           "SX": cirq.XPowGate(exponent=0.5), "SXDG": cirq.XPowGate(exponent=-0.5)}

    def gate(op: Op):
        p = bound_params(op, env)
        g = op.g
        if g in one:
            return one[g]
        if g == "P":
            return cirq.ZPowGate(exponent=p[0] / math.pi)
        if g == "RX":
            return cirq.rx(p[0])
        if g == "RY":
            return cirq.ry(p[0])
        if g == "RZ":
            return cirq.rz(p[0])
        if g == "U":
            return cirq.MatrixGate(u_matrix(*p[:3]))
        if g == "SWAP":
            return cirq.SWAP
        if g == "ISWAP":
            return cirq.ISWAP
        if g == "ISWAPDG":
            return cirq.ISWAP ** -1
        if g == "RXX":
            return cirq.XXPowGate(exponent=p[0] / math.pi, global_shift=-0.5)
        if g == "RYY":
            return cirq.YYPowGate(exponent=p[0] / math.pi, global_shift=-0.5)
        if g == "RZZ":
            return cirq.ZZPowGate(exponent=p[0] / math.pi, global_shift=-0.5)
        raise ValueError(g)

    chan = {"depol": lambda x: cirq.depolarize(x), "amp": lambda x: cirq.amplitude_damp(x), "phase": lambda x: cirq.phase_damp(x)}
    ops = []
    has_m = any(o.g == "M" for o in C.ops)
    for op in C.ordered():
        if op.g == "BARRIER" or (not measure and op.g == "M"):
            continue
        if op.g == "M":
            if noise and noise.get("readout"):
                ops.append(cirq.bit_flip(noise["readout"]).on(Q[op.q[0]]))
            new = [cirq.measure(Q[op.q[0]], key=f"c{cbit(op)}")]
        elif op.g == "RESET":
            new = [cirq.ResetChannel().on(Q[op.q[0]])]
        else:
            G = gate(op)
            if op.c:
                G = G.controlled(num_controls=len(op.c))
            new = [G.on(*[Q[w] for w in op.c + op.q])]
            new += [chan[k](x).on(Q[q]) for k, q, x in channels_for(op, C.n, noise)]
        if op.cond is not None:
            if isinstance(op.cond, RegCond):
                bits = sorted({cbit(o) for o in C.ops if o.g == "M"})
                expr = sum((sympy.Symbol(f"c{b}") * (2 ** b) for b in bits), sympy.Integer(0))
                cond = cirq.SympyCondition(sympy.Eq(expr, op.cond.val))
            else:
                cond = cirq.SympyCondition(sympy.Eq(sympy.Symbol(f"c{op.cond.bit}"), op.cond.val))
            new = [o.with_classical_controls(cond) for o in new]
        ops += new
    if measure and not has_m and measure_all_if_none:
        for q in range(C.n):
            if noise and noise.get("readout"):
                ops.append(cirq.bit_flip(noise["readout"]).on(Q[q]))
            ops.append(cirq.measure(Q[q], key=f"c{q}"))
    circuit = cirq.Circuit(ops, strategy=cirq.InsertStrategy.EARLIEST)
    return circuit, Q


# ================= PennyLane =================
def pennylane_body(C: Circuit, env: Optional[dict] = None, *, noise: Optional[dict] = None, measure: bool = True):
    """Returns (apply_fn, measured) — apply_fn() queues the circuit inside a QNode and returns
    {cb: MeasurementValue} for mid-circuit measurements; measured = [(cb, qubit, is_terminal)]."""
    import pennylane as qml

    env = {**C.params, **(env or {})}
    ordered = C.ordered()
    dyn = C.is_dynamic()
    one = {"I": qml.Identity, "X": qml.PauliX, "Y": qml.PauliY, "Z": qml.PauliZ, "H": qml.Hadamard, "S": qml.S, "T": qml.T, "SX": qml.SX}
    adj = {"SDG": qml.S, "TDG": qml.T, "SXDG": qml.SX}
    chan = {"depol": qml.DepolarizingChannel, "amp": qml.AmplitudeDamping, "phase": qml.PhaseDamping}

    def make(op: Op):
        p = bound_params(op, env)
        g, w = op.g, op.q

        def f():
            if g in one:
                return one[g](wires=w[0])
            if g in adj:
                return qml.adjoint(adj[g](wires=w[0]))
            if g == "P":
                return qml.PhaseShift(p[0], wires=w[0])
            if g == "RX":
                return qml.RX(p[0], wires=w[0])
            if g == "RY":
                return qml.RY(p[0], wires=w[0])
            if g == "RZ":
                return qml.RZ(p[0], wires=w[0])
            if g == "U":
                return qml.U3(p[0], p[1], p[2], wires=w[0])
            if g == "SWAP":
                return qml.SWAP(wires=w)
            if g == "ISWAP":
                return qml.ISWAP(wires=w)
            if g == "ISWAPDG":
                return qml.adjoint(qml.ISWAP(wires=w))
            if g == "RXX":
                return qml.IsingXX(p[0], wires=w)
            if g == "RYY":
                return qml.IsingYY(p[0], wires=w)
            if g == "RZZ":
                return qml.IsingZZ(p[0], wires=w)
            raise ValueError(g)
        return f

    measured: list[tuple[int, int, bool]] = []

    def apply():
        mids: dict[int, object] = {}
        for i, op in enumerate(ordered):
            if op.g == "BARRIER":
                continue
            if op.g == "M":
                if not measure:
                    continue
                if noise and noise.get("readout"):
                    qml.BitFlip(noise["readout"], wires=op.q[0])
                if dyn:
                    mids[cbit(op)] = qml.measure(op.q[0])
                continue
            if op.g == "RESET":
                qml.measure(op.q[0], reset=True)
                continue
            fn = make(op)
            if op.c:
                inner = fn
                fn = (lambda inner=inner, c=op.c: qml.ctrl(inner, control=c)())
            if op.cond is not None:
                if isinstance(op.cond, RegCond):
                    val = sum((mids[b] * (2 ** b) for b in sorted(mids)), 0)
                    qml.cond(val == op.cond.val, fn)()
                else:
                    qml.cond(mids[op.cond.bit] == op.cond.val, fn)()
            else:
                fn()
            for k, q, x in channels_for(op, C.n, noise):
                chan[k](x, wires=q)
        return mids

    last = {}
    for op in ordered:
        if op.g == "M":
            last[cbit(op)] = op.q[0]
    for cb, q in sorted(last.items()):
        measured.append((cb, q, True))
    return apply, measured
