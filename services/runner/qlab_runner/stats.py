"""Comparing results: distances between distributions, and a χ² test against the exact
distribution so shot noise can be told apart from real disagreement."""
from __future__ import annotations

import math
from typing import Optional

from scipy import stats as st


def normalise(counts: dict[str, int]) -> dict[str, float]:
    s = sum(counts.values()) or 1
    return {k: v / s for k, v in counts.items()}


def tvd(p: dict[str, float], q: dict[str, float]) -> float:
    ks = set(p) | set(q)
    return 0.5 * sum(abs(p.get(k, 0) - q.get(k, 0)) for k in ks)


def hellinger_fidelity(p: dict[str, float], q: dict[str, float]) -> float:
    ks = set(p) | set(q)
    return sum(math.sqrt(p.get(k, 0) * q.get(k, 0)) for k in ks) ** 2


def chi2_vs_exact(counts: dict[str, int], exact: dict[str, float], min_expected: float = 5.0) -> dict:
    """Pearson χ² goodness of fit of observed counts against an exact distribution. Bins with
    small expected counts are pooled so the test stays valid. Returns the p-value: small p means
    the counts are unlikely under the exact distribution (a real disagreement, not shot noise)."""
    N = sum(counts.values())
    if N == 0:
        return {"chi2": None, "dof": 0, "p": None}
    keys = sorted(set(exact) | set(counts), key=lambda k: -exact.get(k, 0))
    obs, exp, pool_o, pool_e = [], [], 0.0, 0.0
    for k in keys:
        e = exact.get(k, 0) * N
        if e >= min_expected:
            obs.append(counts.get(k, 0))
            exp.append(e)
        else:
            pool_o += counts.get(k, 0)
            pool_e += e
    if pool_e > 0 or pool_o > 0:
        if pool_e == 0 and pool_o > 0:
            return {"chi2": math.inf, "dof": len(obs), "p": 0.0, "note": f"{int(pool_o)} counts landed on outcomes with zero exact probability"}
        obs.append(pool_o)
        exp.append(pool_e)
    if len(obs) < 2:
        return {"chi2": 0.0, "dof": 0, "p": 1.0}
    chi2 = sum((o - e) ** 2 / e for o, e in zip(obs, exp) if e > 0)
    dof = len(obs) - 1
    return {"chi2": chi2, "dof": dof, "p": float(st.chi2.sf(chi2, dof))}


def compare(results: dict[str, dict], exact: Optional[dict[str, float]] = None) -> dict:
    ids = list(results)
    pair = []
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            pa, pb = normalise(results[a]["counts"]), normalise(results[b]["counts"])
            pair.append({"a": a, "b": b, "tvd": tvd(pa, pb), "hellinger": hellinger_fidelity(pa, pb)})
    vs = {k: chi2_vs_exact(r["counts"], exact) for k, r in results.items()} if exact else {}
    return {"pairs": pair, "chi2": vs}
