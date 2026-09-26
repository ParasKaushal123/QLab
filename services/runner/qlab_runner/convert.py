"""Native SDK objects → QUBIQ IR (and IR → text formats). Used by circuit discovery in the
script sandbox, by /v1/convert, and by the cross-validation suite."""
from __future__ import annotations

import math
from typing import Any

_Q1 = {"id": "I", "x": "X", "y": "Y", "z": "Z", "h": "H", "s": "S", "sdg": "SDG", "t": "T", "tdg": "TDG", "sx": "SX", "sxdg": "SXDG",
       "p": "P", "rx": "RX", "ry": "RY", "rz": "RZ", "u": "U", "u3": "U", "swap": "SWAP", "iswap": "ISWAP", "rxx": "RXX", "ryy": "RYY", "rzz": "RZZ"}
_CTRL = {"cx": ("X", 1), "cy": ("Y", 1), "cz": ("Z", 1), "ch": ("H", 1), "cp": ("P", 1), "crx": ("RX", 1), "cry": ("RY", 1), "crz": ("RZ", 1),
         "ccx": ("X", 2), "cswap": ("SWAP", 1), "ccz": ("Z", 2), "cs": ("S", 1), "csdg": ("SDG", 1), "csx": ("SX", 1), "cu1": ("P", 1)}


def qiskit_to_ir(qc) -> dict[str, Any]:
    """Map a qiskit.QuantumCircuit to IR. Gates we don't model natively are decomposed by
    Qiskit's own transpiler into {u, cx} first, so the IR is always faithful."""
    from qiskit import transpile

    known = set(_Q1) | set(_CTRL) | {"measure", "reset", "barrier", "u1", "u2", "mcx", "delay"}
    if any(ci.operation.name not in known and not getattr(ci.operation, "base_gate", None) for ci in qc.data) or any(ci.operation.name == "if_else" for ci in qc.data):
        if not any(ci.operation.name == "if_else" for ci in qc.data):
            qc = transpile(qc, basis_gates=["u", "cx", "measure", "reset", "barrier"], optimization_level=0)
    qi = {q: i for i, q in enumerate(qc.qubits)}
    ci_ = {c: i for i, c in enumerate(qc.clbits)}
    ops: list[dict] = []

    def emit(inst, qargs, cargs, cond=None):
        name = inst.name
        qs = [qi[q] for q in qargs]
        params = [float(p) for p in getattr(inst, "params", []) if _num(p)]
        extra = {"cond": cond} if cond else {}
        if name == "measure":
            ops.append({"g": "M", "q": qs, "cb": ci_[cargs[0]], **extra}); return
        if name == "reset":
            ops.append({"g": "RESET", "q": qs, **extra}); return
        if name == "barrier":
            ops.append({"g": "BARRIER", "q": qs}); return
        if name == "delay":
            return
        if name == "u1":
            ops.append({"g": "P", "q": qs, "p": params, **extra}); return
        if name == "u2":
            ops.append({"g": "U", "q": qs, "p": [math.pi / 2, params[0], params[1]], **extra}); return
        if name in _Q1:
            ops.append({"g": _Q1[name], "q": qs, "p": params, **extra}); return
        if name in _CTRL:
            g, k = _CTRL[name]
            ops.append({"g": g, "c": qs[:k], "q": qs[k:], "p": params, **extra}); return
        base = getattr(inst, "base_gate", None)
        if base is not None and base.name in _Q1:
            k = inst.num_ctrl_qubits
            if getattr(inst, "ctrl_state", (1 << k) - 1) != (1 << k) - 1:
                raise ValueError("open-controlled gates are not supported yet")
            ops.append({"g": _Q1[base.name], "c": qs[:k], "q": qs[k:], "p": [float(p) for p in base.params if _num(p)], **extra}); return
        raise ValueError(f"gate '{name}' has no IR mapping")

    for ci in qc.data:
        inst = ci.operation
        if inst.name == "if_else":
            cond = inst.condition
            target, val = cond
            if hasattr(target, "__len__") and not hasattr(target, "_register"):
                c = {"reg": "c", "val": int(val)}
            else:
                try:
                    c = {"bit": ci_[target], "val": int(val)}
                except (KeyError, TypeError):
                    c = {"reg": "c", "val": int(val)}
            body = inst.blocks[0]
            bq = {q: ci.qubits[i] for i, q in enumerate(body.qubits)}
            bc = {cc: ci.clbits[i] for i, cc in enumerate(body.clbits)}
            for b in body.data:
                emit(b.operation, [bq[q] for q in b.qubits], [bc[cc] for cc in b.clbits], c)
            continue
        emit(inst, ci.qubits, ci.clbits)
    for i, o in enumerate(ops):
        o["col"] = i
    return {"version": "qlab-ir/1", "name": qc.name, "n": qc.num_qubits, "nc": qc.num_clbits, "ops": ops}


def _num(p) -> bool:
    try:
        float(p)
        return True
    except (TypeError, ValueError):
        return False


def cirq_to_ir(circuit) -> dict[str, Any]:
    """Cirq → Qiskit (via qBraid's transpiler) → IR. LineQubit(k) becomes q_k."""
    from qbraid.transpiler import transpile as qbt
    import cirq

    qs = sorted(circuit.all_qubits())
    if all(isinstance(q, cirq.LineQubit) for q in qs) and qs:
        n = max(q.x for q in qs) + 1
        if len(qs) != n:  # keep idle LineQubits so indices survive the conversion
            circuit = circuit + cirq.Circuit([cirq.I(cirq.LineQubit(k)) for k in range(n) if cirq.LineQubit(k) not in qs])
    qc = qbt(circuit, "qiskit")
    ir = qiskit_to_ir(qc)
    ir["name"] = "cirq circuit"
    return ir


_PL = {"Identity": "I", "PauliX": "X", "PauliY": "Y", "PauliZ": "Z", "Hadamard": "H", "S": "S", "T": "T", "SX": "SX", "PhaseShift": "P", "RX": "RX", "RY": "RY", "RZ": "RZ",
       "U3": "U", "SWAP": "SWAP", "ISWAP": "ISWAP", "IsingXX": "RXX", "IsingYY": "RYY", "IsingZZ": "RZZ", "CNOT": ("X", 1), "CZ": ("Z", 1), "CY": ("Y", 1), "Toffoli": ("X", 2),
       "CRX": ("RX", 1), "CRY": ("RY", 1), "CRZ": ("RZ", 1), "ControlledPhaseShift": ("P", 1), "CSWAP": ("SWAP", 1), "CH": ("H", 1)}


def pennylane_to_ir(qnode, args=(), kwargs=None) -> dict[str, Any]:
    import pennylane as qml

    kwargs = kwargs or {}
    tape = qml.workflow.construct_tape(qnode)(*args, **kwargs) if hasattr(qml.workflow, "construct_tape") else qml.tape.make_qscript(qnode.func)(*args, **kwargs)
    wires = list(qnode.device.wires) if qnode.device.wires else list(tape.wires)
    wi = {w: i for i, w in enumerate(wires)}
    ops = []
    for op in tape.operations:
        name = op.name
        adj = name.startswith("Adjoint(")
        if adj:
            name = name[8:-1]
        ws = [wi[w] for w in op.wires]
        params = [float(p) for p in op.parameters]
        m = _PL.get(name)
        if m is None:
            dec = op.decomposition()
            sub = pennylane_ops_to_ir(dec, wi)
            ops += sub
            continue
        if isinstance(m, tuple):
            g, k = m
            ops.append({"g": g, "c": ws[:k], "q": ws[k:], "p": params})
        else:
            g = m
            if adj:
                g = {"S": "SDG", "T": "TDG", "SX": "SXDG", "ISWAP": "ISWAPDG"}.get(g, g)
                if g in ("RX", "RY", "RZ", "P", "RXX", "RYY", "RZZ"):
                    params = [-p for p in params]
            ops.append({"g": g, "q": ws, "p": params})
    for i, o in enumerate(ops):
        o["col"] = i
    meas = [m for m in tape.measurements]
    mwires = sorted({wi[w] for m in meas for w in (m.wires or [])})
    for k, q in enumerate(mwires):
        ops.append({"g": "M", "q": [q], "cb": q, "col": len(ops)})
    return {"version": "qlab-ir/1", "name": getattr(qnode, "__name__", "qnode"), "n": len(wires), "ops": ops}


def pennylane_ops_to_ir(ops, wi) -> list[dict]:
    out = []
    for op in ops:
        m = _PL.get(op.name)
        ws = [wi[w] for w in op.wires]
        params = [float(p) for p in op.parameters]
        if m is None:
            out += pennylane_ops_to_ir(op.decomposition(), wi)
        elif isinstance(m, tuple):
            out.append({"g": m[0], "c": ws[:m[1]], "q": ws[m[1]:], "p": params})
        else:
            out.append({"g": m, "q": ws, "p": params})
    return out


def ir_to(fmt: str, ir: dict) -> str:
    from .build import to_cirq, to_qiskit
    from .ir import Circuit

    C = Circuit.model_validate(ir)
    if fmt == "qasm3":
        from qiskit import qasm3
        return qasm3.dumps(to_qiskit(C, measure_all_if_none=False))
    if fmt == "qasm2":
        from qiskit import qasm2, transpile
        qc = to_qiskit(C, measure_all_if_none=False)
        if C.is_dynamic():
            raise ValueError("OpenQASM 2 cannot express these classical conditions; export OpenQASM 3")
        return qasm2.dumps(transpile(qc, basis_gates=["u", "cx", "measure", "reset", "barrier", "h", "x", "y", "z", "s", "sdg", "t", "tdg", "rx", "ry", "rz", "swap", "ccx"], optimization_level=0))
    if fmt == "cirq":
        c, _ = to_cirq(C, measure_all_if_none=False)
        import cirq
        return cirq.to_json(c)
    if fmt in ("braket", "pyquil", "pytket"):
        from qbraid.transpiler import transpile as qbt
        obj = qbt(to_qiskit(C, measure=False, measure_all_if_none=False), fmt)
        return str(obj)
    raise ValueError(f"unknown format '{fmt}'")
