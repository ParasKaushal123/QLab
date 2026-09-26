"""Runs INSIDE the sandbox (a throwaway container or a locked-down child process).
Reads {code} as JSON on stdin, executes it, discovers circuits, prints one JSON object."""
from __future__ import annotations

import base64
import contextlib
import io
import json
import sys
import traceback
import types


def main() -> None:
    req = json.loads(sys.stdin.read())
    code = req["code"]
    shown: list = []
    qlab = types.ModuleType("qlab")
    qlab.show = lambda obj, name=None: shown.append((name, obj)) or obj
    sys.modules["qlab"] = qlab
    try:
        import matplotlib
        matplotlib.use("Agg")
    except Exception:
        pass
    out, err = io.StringIO(), io.StringIO()
    g: dict = {"__name__": "__main__"}
    ok, error = True, None
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        try:
            exec(compile(code, "<script>", "exec"), g)
        except BaseException:
            ok = False
            error = traceback.format_exc(limit=6).replace('File "<script>"', "script")
    circuits, problems = discover(g, shown, code)
    figures = []
    try:
        import matplotlib.pyplot as plt
        for num in plt.get_fignums()[:8]:
            buf = io.BytesIO()
            plt.figure(num).savefig(buf, format="png", dpi=110, bbox_inches="tight")
            figures.append(base64.b64encode(buf.getvalue()).decode())
    except Exception:
        pass
    print(json.dumps({"ok": ok, "error": error, "stdout": out.getvalue()[-20000:], "stderr": err.getvalue()[-8000:], "circuits": circuits, "problems": problems, "figures": figures}))


def discover(g: dict, shown: list, code: str):
    from qlab_runner.convert import cirq_to_ir, pennylane_to_ir, qiskit_to_ir

    items, seen = [], set()
    for name, obj in [(n, o) for n, o in shown] + [(k, v) for k, v in g.items() if not k.startswith("_")]:
        if id(obj) in seen:
            continue
        kind = None
        try:
            from qiskit import QuantumCircuit
            if isinstance(obj, QuantumCircuit):
                kind = "qiskit"
        except Exception:
            pass
        if kind is None:
            try:
                import cirq
                if isinstance(obj, cirq.Circuit):
                    kind = "cirq"
            except Exception:
                pass
        if kind is None:
            try:
                import pennylane as qml
                if isinstance(obj, qml.QNode):
                    kind = "pennylane"
            except Exception:
                pass
        if kind:
            seen.add(id(obj))
            items.append((name or kind, kind, obj))
    circuits, problems = [], []
    lines = code.splitlines()
    for name, kind, obj in items[:12]:
        try:
            ir = qiskit_to_ir(obj) if kind == "qiskit" else cirq_to_ir(obj) if kind == "cirq" else pennylane_to_ir(obj)
            ir["name"] = name
            line = next((i + 1 for i, l in enumerate(lines) if l.strip().startswith(f"{name} =") or l.strip().startswith(f"def {name}(") or l.strip().startswith(f"{name}=")), None)
            circuits.append({"name": name, "sdk": kind, "line": line, "ir": ir})
        except Exception as e:  # report, don't fail the run
            problems.append(f"{name} ({kind}): {e}")
    return circuits, problems


if __name__ == "__main__":
    main()
