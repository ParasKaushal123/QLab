"""Generate the 40-circuit cross-validation corpus (IMPLEMENTATION_PLAN.md P3).

Run from the repo root (stdlib only, no SDKs needed)::

    python tests/crossval/corpus/build.py [--out tests/crossval/corpus]

Writes 40 deterministic IR JSON files ``NN_<name>.json`` into the corpus
directory. Every file is ``{version, name, n, ops with col}`` plus optional
``category`` metadata and, for the noise category, a ``noise`` dict that is
passed as the ``noise`` argument to ``qlab_runner.run`` (it is not part of the
IR itself). A couple of circuits also carry ``params`` to exercise symbolic
parameter binding. There is no randomness and no timestamp in the output, so
re-running the script reproduces the corpus byte-for-byte.

Categories (matching P3): clifford, parametric, multi-controlled, algorithms,
dynamic, noise — including widths 10, 14 and 20.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

VERSION = "qlab-ir/1"
CORPUS_DIR = Path(__file__).parent


def op(g, q, c=None, p=None, cb=None, cond=None):
    d = {"g": g, "q": list(q)}
    if c:
        d["c"] = list(c)
    if p is not None:
        d["p"] = list(p)
    if cb is not None:
        d["cb"] = cb
    if cond is not None:
        d["cond"] = cond
    return d


def circ(name, n, ops, category, noise=None, params=None):
    for i, o in enumerate(ops):
        o["col"] = i
    d = {"version": VERSION, "name": name, "n": n, "ops": ops, "category": category}
    if params:
        d["params"] = dict(params)
    if noise:
        d["noise"] = dict(noise)
    return d


def qft_ops(n, prep=()):
    ops = list(prep)
    for j in range(n):
        ops.append(op("H", [j]))
        for k in range(j + 1, n):
            ops.append(op("P", [j], [k], [math.pi / 2 ** (k - j)]))
    return ops


def ghz_ops(n):
    return [op("H", [0])] + [op("X", [k + 1], [k]) for k in range(n - 1)]


def ladder(n, start=0):
    return [op("X", [k + 1], [k]) for k in range(start, n - 1)]


# ---------------------------------------------------------------- clifford
def clifford_circuits():
    out = []
    out.append(circ("clifford_bell_2", 2, [op("H", [0]), op("X", [1], [0])], "clifford"))
    out.append(circ("clifford_ghz_5", 5, ghz_ops(5), "clifford"))
    out.append(circ(
        "clifford_stab_4", 4,
        [op("H", [0]), op("H", [1]), op("H", [2]), op("SX", [3]),
         op("X", [1], [0]), op("Z", [2], [1]), op("X", [3], [2]),
         op("S", [0]), op("SDG", [1]), op("H", [2]),
         op("SWAP", [0, 3]), op("BARRIER", [0, 1, 2, 3]),
         op("X", [2], [0, 1])],
        "clifford"))
    ring = [op("H", [k]) for k in range(6)]
    ring += [op("S", [k]) for k in range(0, 6, 2)]
    ring += [op("Z", [(k + 1) % 6], [k]) for k in range(6)]  # CZ ring -> graph state
    out.append(circ("clifford_graph_6", 6, ring, "clifford"))
    w10 = [op("H", [k]) for k in range(10)]
    w10 += [op("S", [k]) for k in range(1, 10, 2)]
    w10 += ladder(10)
    w10 += [op("Z", [k + 2], [k]) for k in range(0, 8, 3)]
    w10 += [op("H", [k]) for k in range(0, 10, 3)]
    out.append(circ("clifford_wide_10", 10, w10, "clifford"))
    w20 = [op("H", [k]) for k in range(20)]
    w20 += [op("S", [k]) for k in range(0, 20, 4)]
    w20 += ladder(20)
    w20 += [op("Z", [k + 5], [k]) for k in range(0, 15, 5)]
    out.append(circ("clifford_wide_20", 20, w20, "clifford"))
    return out


# -------------------------------------------------------------- parametric
def parametric_circuits():
    out = []
    out.append(circ(
        "param_rxry_2", 2,
        [op("RX", [0], p=[0.7]), op("RY", [1], p=[1.1]),
         op("RZZ", [0, 1], p=[0.9]), op("X", [1], [0])],
        "parametric"))
    out.append(circ(
        "param_u_rzz_3", 3,
        [op("RY", [0], p=[0.7]), op("U", [1], p=[0.3, 1.1, -0.4]),
         op("RZZ", [0, 1], p=[0.9]), op("P", [2], [0], p=[math.pi / 5]),
         op("ISWAP", [1, 2]), op("SX", [0]), op("RY", [2], [0, 1], p=[1.3])],
        "parametric"))
    ans4 = [op("RY", [k], p=[0.2 * k + 0.1]) for k in range(4)]
    ans4 += ladder(4)
    ans4 += [op("RZZ", [0, 1], p=[0.5]), op("RZZ", [2, 3], p=[-0.3])]
    ans4 += [op("RX", [k], p=[0.4 - 0.1 * k]) for k in range(4)]
    out.append(circ("param_ansatz_4", 4, ans4, "parametric"))
    out.append(circ(
        "param_rxx_4", 4,
        [op("RXX", [0, 1], p=[0.6]), op("RYY", [1, 2], p=[-0.4]),
         op("RZZ", [2, 3], p=[1.2]), op("RX", [0], p=[0.5]),
         op("RY", [3], p=[-0.9]), op("RZ", [1], p=[0.25]),
         op("X", [2], [0]), op("SWAP", [1, 3])],
        "parametric"))
    out.append(circ(
        "param_expr_2", 2,
        [op("RX", [0], p=["theta"]), op("RY", [1], p=["2*gamma"]),
         op("RZZ", [0, 1], p=["theta+gamma"]), op("P", [1], p=["pi/4"]),
         op("X", [1], [0])],
        "parametric", params={"theta": 0.7, "gamma": 1.1}))
    w10 = [op("RZ", [k], p=[0.1 * k]) for k in range(10)]
    w10 += [op("RY", [k], p=[0.05 * k + 0.2]) for k in range(10)]
    w10 += ladder(10)
    w10 += [op("RZZ", [k, k + 1], p=[0.3 + 0.05 * k]) for k in range(0, 9, 2)]
    out.append(circ("param_wide_10", 10, w10, "parametric"))
    w14 = [op("RX", [k], p=[0.15 + 0.02 * k]) for k in range(14)]
    w14 += [op("RYY", [k, k + 1], p=[0.4]) for k in range(0, 13, 2)]
    w14 += ladder(14)
    w14 += [op("RZ", [k], p=[0.1 * k]) for k in range(14)]
    out.append(circ("param_wide_14", 14, w14, "parametric"))
    return out


# ---------------------------------------------------------- multi-controlled
def multi_controlled_circuits():
    out = []
    out.append(circ(
        "mc_toffoli_3", 3,
        [op("H", [0]), op("H", [1]), op("X", [2], [0, 1]),
         op("H", [0]), op("X", [1], [0])],
        "multi-controlled"))
    out.append(circ(
        "mc_toffoli_4", 4,
        [op("H", [0]), op("H", [1]), op("H", [2]),
         op("X", [3], [0, 1, 2]), op("P", [0], p=[0.5])],
        "multi-controlled"))
    out.append(circ(
        "mc_phase_4", 4,
        [op("H", [k]) for k in range(4)]
        + [op("P", [3], [0, 1, 2], p=[math.pi / 3]),
           op("P", [2], [0, 1], p=[math.pi / 4]),
           op("X", [1], [0])],
        "multi-controlled"))
    out.append(circ(
        "mc_u_3", 3,
        [op("H", [0]), op("H", [1]),
         op("U", [2], [0, 1], p=[0.5, 0.2, -0.7]),
         op("X", [0], [1])],
        "multi-controlled"))
    out.append(circ(
        "mc_wide_10", 10,
        [op("H", [k]) for k in [0, 1, 2, 3, 4, 7, 8]]
        + [op("X", [5], [3, 4]), op("X", [6], [0, 1, 2]),
           op("P", [7], [5], p=[math.pi / 4]), op("X", [9], [6, 8])],
        "multi-controlled"))
    out.append(circ(
        "mc_wide_14", 14,
        [op("H", [k]) for k in range(7)]
        + [op("X", [7], [0, 1, 2]), op("X", [8], [3, 4, 5]),
           op("X", [9], [7]), op("X", [10], [8]),
           op("H", [11]), op("H", [12]),
           op("U", [11], [9], p=[0.4, -0.3, 0.9]),
           op("P", [12], [10], p=[math.pi / 6]),
           op("X", [13], [11, 12])],
        "multi-controlled"))
    return out


# --------------------------------------------------------------- algorithms
def algorithm_circuits():
    out = []
    out.append(circ("algo_qft_4", 4, qft_ops(4, [op("X", [0]), op("X", [2])]), "algorithms"))
    out.append(circ("algo_qft_5", 5, qft_ops(5, [op("X", [1]), op("X", [3])]), "algorithms"))
    out.append(circ("algo_qft_6", 6, qft_ops(6, [op("X", [0])]), "algorithms"))
    out.append(circ("algo_ghz_10", 10, ghz_ops(10), "algorithms"))
    out.append(circ("algo_qft_10", 10, qft_ops(10, [op("X", [0]), op("X", [5])]), "algorithms"))
    out.append(circ("algo_ghz_14", 14, ghz_ops(14), "algorithms"))
    out.append(circ("algo_ghz_20", 20, ghz_ops(20), "algorithms"))
    lay20 = [op("H", [k]) for k in range(20)]
    lay20 += [op("RZ", [k], p=[0.05 * k + 0.1]) for k in range(20)]
    lay20 += ladder(20)
    lay20 += [op("RZZ", [k, k + 1], p=[0.2 + 0.01 * k]) for k in range(0, 19, 2)]
    lay20 += [op("RX", [k], p=[0.3 - 0.01 * k]) for k in range(20)]
    out.append(circ("algo_layer_20", 20, lay20, "algorithms"))
    ent14 = [op("H", [k]) for k in range(14)]
    ent14 += ladder(14)
    ent14 += [op("RZ", [k], p=[0.2 + 0.03 * k]) for k in range(14)]
    ent14 += [op("X", [k], [k + 1]) for k in range(13, -1, -1)]
    out.append(circ("algo_entangle_14", 14, ent14, "algorithms"))
    return out


# ----------------------------------------------------------------- dynamic
def dynamic_circuits():
    out = []
    out.append(circ(
        "dyn_feedforward_2", 2,
        [op("H", [0]), op("M", [0], cb=0),
         op("X", [1], cond={"bit": 0, "val": 1}),
         op("M", [1], cb=1)],
        "dynamic"))
    out.append(circ(
        "dyn_reset_3", 3,
        [op("H", [0]), op("M", [0], cb=0), op("RESET", [0]),
         op("H", [0]), op("X", [1], [0]),
         op("M", [1], cb=1), op("M", [2], cb=2)],
        "dynamic"))
    out.append(circ(
        "dyn_midmeasure_3", 3,
        [op("H", [0]), op("X", [1], [0]), op("M", [0], cb=0),
         op("H", [0]), op("X", [2], [0]),
         op("M", [1], cb=1), op("M", [2], cb=2)],
        "dynamic"))
    out.append(circ(
        "dyn_regcond_4", 4,
        [op("H", [0]), op("H", [1]),
         op("M", [0], cb=0), op("M", [1], cb=1),
         op("X", [2], cond={"reg": "c", "val": 1}),
         op("X", [3], cond={"reg": "c", "val": 2}),
         op("M", [2], cb=2), op("M", [3], cb=3)],
        "dynamic"))
    w10 = [op("H", [k]) for k in range(10)]
    w10 += [op("M", [k], cb=k) for k in range(5)]
    w10 += [op("X", [5], cond={"bit": 0, "val": 1}),
            op("X", [6], cond={"bit": 1, "val": 1}),
            op("X", [7], [5, 6]), op("X", [8], [7]), op("X", [9], [8])]
    w10 += [op("M", [k], cb=k) for k in range(5, 10)]
    out.append(circ("dyn_wide_10", 10, w10, "dynamic"))
    return out


# ------------------------------------------------------------------- noise
def noise_circuits():
    out = []
    out.append(circ(
        "noise_bell_2", 2, [op("H", [0]), op("X", [1], [0])],
        "noise", noise={"p1": 0.002, "p2": 0.02}))
    out.append(circ(
        "noise_ghz_4", 4, ghz_ops(4),
        "noise", noise={"p1": 0.001, "p2": 0.01, "readout": 0.02}))
    out.append(circ(
        "noise_param_3", 3,
        [op("RY", [0], p=[0.7]), op("U", [1], p=[0.3, 1.1, -0.4]),
         op("RZZ", [0, 1], p=[0.9]), op("P", [2], [0], p=[math.pi / 5]),
         op("ISWAP", [1, 2])],
        "noise", noise={"p1": 0.003, "p2": 0.03, "t1": 120.0, "t2": 80.0}))
    out.append(circ(
        "noise_chain_6", 6, [op("H", [0])] + ladder(6),
        "noise", noise={"p1": 0.001, "p2": 0.015, "t1": 200.0, "t2": 150.0, "readout": 0.01}))
    out.append(circ(
        "noise_wide_10", 10, [op("H", [k]) for k in range(10)] + ladder(10),
        "noise", noise={"p1": 0.001, "p2": 0.01}))
    out.append(circ(
        "noise_readout_3", 3,
        [op("H", [0]), op("H", [1]), op("H", [2]),
         op("X", [1], [0]), op("X", [2], [1])],
        "noise", noise={"readout": 0.05}))
    out.append(circ(
        "noise_t1t2_4", 4,
        [op("RX", [k], p=[0.5 + 0.1 * k]) for k in range(4)] + ladder(4),
        "noise", noise={"p1": 0.001, "t1": 100.0, "t2": 60.0}))
    return out


BUILDERS = [clifford_circuits, parametric_circuits, multi_controlled_circuits,
            algorithm_circuits, dynamic_circuits, noise_circuits]


def build_all():
    circuits = []
    for fn in BUILDERS:
        circuits.extend(fn())
    assert len(circuits) == 40, f"expected 40 circuits, got {len(circuits)}"
    names = [c["name"] for c in circuits]
    assert len(set(names)) == len(names), "duplicate circuit names"
    return circuits


def main(out_dir: str | Path = CORPUS_DIR) -> list[str]:
    dest = Path(out_dir)
    dest.mkdir(parents=True, exist_ok=True)
    written = []
    for i, c in enumerate(build_all(), 1):
        path = dest / f"{i:02d}_{c['name']}.json"
        path.write_text(json.dumps(c, indent=2) + "\n")
        written.append(str(path))
    print(f"wrote {len(written)} circuits to {dest}")
    return written


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Generate the 40-circuit crossval corpus.")
    ap.add_argument("--out", default=str(CORPUS_DIR))
    main(ap.parse_args().out)
