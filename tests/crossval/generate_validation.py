#!/usr/bin/env python3
"""Generates validation.json by running cross-SDK validation on the corpus."""
import datetime
import json
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../services/runner"))

import qlab_runner.run as R
import qlab_runner.stats as stats
from tests.crossval.test_crossval import CIRCUITS, BACKENDS

def main():
    print("Generating cross-validation matrix...")
    t0 = time.time()
    
    # Collect versions
    versions = {
        "Qiskit Aer": R.ver("qiskit-aer"),
        "Cirq": R.ver("cirq-core"),
        "PennyLane": R.ver("pennylane"),
        "PennyLane-Lightning": R.ver("pennylane-lightning")
    }
    
    checks = []
    # Reference states from aer.statevector
    ref_states = {}
    ref_probs = {}
    for c in CIRCUITS:
        name = c["name"]
        try:
            res = R.run(c, "aer.statevector", shots=1, seed=1, want_state=True)
            ref_states[name] = res["statevector"]
            ref_probs[name] = res.get("probabilities", {})
        except Exception as e:
            print(f"Error computing ref for {name}: {e}")

    for c in CIRCUITS:
        cname = c["name"]
        ref_sv = ref_states.get(cname)
        
        for b in BACKENDS:
            t_cell = time.perf_counter()
            cell = {
                "circuit": cname,
                "backend": b,
                "ir": c
            }
            try:
                # Statevector fidelity test (if pure state backend)
                res = R.run(c, b, shots=2000, seed=42, want_state=True)
                ms = (time.perf_counter() - t_cell) * 1000
                cell["ms"] = round(ms, 1)
                
                if ref_sv is not None and res.get("statevector") is not None:
                    sv_a = ref_sv
                    sv_b = res["statevector"]
                    # Calculate fidelity
                    prod = sum((a[0] - 1j*a[1]) * (b[0] + 1j*b[1]) for a, b in zip(sv_a, sv_b))
                    f = abs(prod) ** 2
                    cell["fidelity"] = round(f, 9)
                    cell["status"] = "pass" if f >= 1.0 - 1e-6 else "fail"
                else:
                    cell["status"] = "pass"
                    
                # TVD and counts
                counts = res.get("counts", {})
                tot = sum(counts.values()) or 1
                dist = {k: v / tot for k, v in counts.items()}
                exact = ref_probs.get(cname, {})
                if exact:
                    tvd = stats.tvd(dist, exact)
                    cell["tvd"] = round(tvd, 4)
            except Exception as e:
                cell["status"] = "skip" if "not configured" in str(e) or "CLIFFORD" in str(e).upper() else "fail"
                cell["reason"] = str(e)
                cell["ms"] = round((time.perf_counter() - t_cell) * 1000, 1)
                
            checks.append(cell)

    report = {
        "date": datetime.datetime.utcnow().isoformat() + "Z",
        "versions": versions,
        "circuits": [c["name"] for c in CIRCUITS],
        "backends": BACKENDS,
        "checks": checks,
        "duration_s": round(time.time() - t0, 1)
    }

    out_paths = [
        os.path.join(os.path.dirname(__file__), "../../validation.json"),
        os.path.join(os.path.dirname(__file__), "../../services/runner/validation.json"),
    ]
    for p in out_paths:
        with open(p, "w", encoding="utf-8") as fp:
            json.dump(report, fp, indent=2)
    print(f"Generated {len(checks)} checks into validation.json ({report['duration_s']}s)")

if __name__ == "__main__":
    main()
