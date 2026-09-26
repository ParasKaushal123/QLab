"""Cross-validation starter: every circuit runs on every backend and must agree.

  PYTHONPATH=services/runner pytest tests/crossval -q

Checks (the full suite grows this to 40 circuits x 4 backends, see IMPLEMENTATION_PLAN.md P2):
  * statevector fidelity vs Aer >= 1 - 1e-9 for state-capable backends
  * sampled counts: chi-square p-value vs exact probabilities > 1e-3, fixed seeds
"""
import math

import numpy as np
import pytest

from qlab_runner import run as R
from qlab_runner import stats

BACKENDS = ["aer.statevector", "cirq.simulator", "pennylane.default.qubit", "pennylane.lightning.qubit"]


def op(g, q, c=None, p=None):
    d = {"g": g, "q": q}
    if c:
        d["c"] = c
    if p:
        d["p"] = p
    return d


def circ(name, n, ops):
    for i, o in enumerate(ops):
        o["col"] = i
    return {"version": "qlab-ir/1", "name": name, "n": n, "ops": ops}


CIRCUITS = [
    circ("bell", 2, [op("H", [0]), op("X", [1], [0])]),
    circ("ghz5", 5, [op("H", [0])] + [op("X", [k + 1], [k]) for k in range(4)]),
    circ("param3", 3, [op("RY", [0], p=[0.7]), op("U", [1], p=[0.3, 1.1, -0.4]), op("RZZ", [0, 1], p=[0.9]),
                       op("P", [2], [0], p=[math.pi / 5]), op("ISWAP", [1, 2]), op("SX", [0]), op("RY", [2], [0, 1], p=[1.3])]),
    circ("qft4", 4, [op("X", [0]), op("X", [2])] + [x for j in range(4) for x in
                     [op("H", [j])] + [op("P", [j], [k], p=[math.pi / 2 ** (k - j)]) for k in range(j + 1, 4)]]),
    circ("wide10", 10, [op("H", [k]) for k in range(10)] + [op("RZ", [k], p=[0.1 * k]) for k in range(10)]
         + [op("X", [k + 1], [k]) for k in range(9)]),
]


def sv(r):
    return np.array([complex(a, b) for a, b in r["statevector"]])


@pytest.fixture(scope="module")
def reference():
    return {c["name"]: R.run(c, "aer.statevector", 1, 1, want_state=True) for c in CIRCUITS}


@pytest.mark.parametrize("backend", BACKENDS[1:])
@pytest.mark.parametrize("c", CIRCUITS, ids=lambda c: c["name"])
def test_statevector_agrees(c, backend, reference):
    r = R.run(c, backend, 1, 1, want_state=True)
    f = abs(np.vdot(sv(reference[c["name"]]), sv(r))) ** 2
    assert f == pytest.approx(1.0, abs=1e-9), f"{backend} fidelity {f}"
    assert r["provenance"]["backend"] == backend


@pytest.mark.parametrize("backend", BACKENDS)
@pytest.mark.parametrize("c", CIRCUITS[:4], ids=lambda c: c["name"])
def test_counts_consistent(c, backend, reference):
    exact = reference[c["name"]]["probabilities"]
    r = R.run(c, backend, 4000, 11)
    p = stats.chi2_vs_exact(r["counts"], exact)["p"]
    assert p > 1e-3, f"{backend}: chi2 p={p}"
