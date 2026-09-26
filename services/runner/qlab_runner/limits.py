"""Per-request budgets and rate limits (P0).

Budgets: shots * 2**n capped (QLAB_MAX_SHOTS_DIM, default 2**24 ~ 16M),
60s wall-clock per run enforced by the caller via future timeout.
Rate limits: in-memory token bucket per key (100 req/min default);
use redis when REDIS_URL is set (best-effort, falls back to memory).
"""
from __future__ import annotations

import os
import time

MAX_DIM = int(os.environ.get("QLAB_MAX_SHOTS_DIM", str(1 << 24)))
RATE_PER_MIN = int(os.environ.get("QLAB_RATE_PER_MIN", "100"))

_buckets: dict[str, list[float]] = {}


def check_budget(n: int, shots: int) -> None:
    dim = shots * (1 << n) if n < 60 else 10 ** 30
    if dim > MAX_DIM:
        raise ValueError(f"Budget exceeded: shots × 2ⁿ = {dim:,} > {MAX_DIM:,} (reduce qubits or shots)")


def rate_allow(key: str, per_min: int = RATE_PER_MIN) -> bool:
    # Try redis first (best-effort).
    redis_url = os.environ.get("REDIS_URL")
    if redis_url:
        try:
            import urllib.parse as up
            # Minimal redis INCR+EXPIRE via socket is overkill; use in-memory
            # when the redis client is not installed.
            import importlib.util as iu
            if iu.find_spec("redis") is not None:
                import redis as _redis
                r = _redis.Redis.from_url(redis_url, socket_timeout=0.2)
                k = f"qlab:rl:{key}:{int(time.time() // 60)}"
                n = r.incr(k)
                if n == 1:
                    r.expire(k, 65)
                return n <= per_min
        except Exception:
            pass
    now = time.time()
    window = [t for t in _buckets.get(key, []) if now - t < 60]
    if len(window) >= per_min:
        _buckets[key] = window
        return False
    window.append(now)
    _buckets[key] = window
    return True
