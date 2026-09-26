"""Executes untrusted user Python.

QLAB_SANDBOX=docker (production, the default in docker-compose): every run gets a fresh
container from the qlab-sandbox image with --network none, a read-only root filesystem,
a tmpfs /tmp, 2 CPUs, 2 GB RAM, 256 pids, no new privileges, the default seccomp profile
(and --runtime runsc when QLAB_SANDBOX_RUNTIME=runsc for gVisor), killed after 30 s.

QLAB_SANDBOX=local (development only): a child process with CPU/memory/file-size rlimits,
an empty environment, a private /tmp, `unshare --net` when available, and the same timeout.
This is NOT a security boundary against a determined attacker; use docker in production.
"""
from __future__ import annotations

import json
import os
try:
    import resource
except ImportError:
    resource = None
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

TIMEOUT = int(os.environ.get("QLAB_SANDBOX_TIMEOUT", "30"))
MEM = 2 * 1024 ** 3
IMAGE = os.environ.get("QLAB_SANDBOX_IMAGE", "qlab-sandbox:latest")
PKG = Path(__file__).resolve().parent.parent


def _limits():
    if resource:
        resource.setrlimit(resource.RLIMIT_AS, (MEM, MEM))
        resource.setrlimit(resource.RLIMIT_CPU, (TIMEOUT, TIMEOUT + 1))
        resource.setrlimit(resource.RLIMIT_FSIZE, (64 * 1024 ** 2, 64 * 1024 ** 2))
        resource.setrlimit(resource.RLIMIT_NPROC, (256, 256))
    if hasattr(os, "setsid"):
        os.setsid()


def execute(code: str) -> dict:
    mode = os.environ.get("QLAB_SANDBOX", "local")
    payload = json.dumps({"code": code})
    if mode == "docker":
        cmd = ["docker", "run", "--rm", "-i", "--network", "none", "--read-only", "--tmpfs", "/tmp:rw,size=256m",
               "--cpus", "2", "--memory", "2g", "--pids-limit", "256", "--security-opt", "no-new-privileges", "--cap-drop", "ALL"]
        if os.environ.get("QLAB_SANDBOX_RUNTIME"):
            cmd += ["--runtime", os.environ["QLAB_SANDBOX_RUNTIME"]]
        cmd += [IMAGE, "python", "-m", "qlab_runner.harness"]
        kw = {}
        isolation = "docker"
    else:
        tmp = tempfile.mkdtemp(prefix="qlab-sbx-")
        default_path = os.environ.get("PATH", "") if sys.platform == "win32" else "/usr/bin:/bin"
        env = {"PATH": default_path, "HOME": tmp, "TMPDIR": tmp, "PYTHONPATH": str(PKG), "MPLBACKEND": "Agg", "OMP_NUM_THREADS": "2"}
        cmd = [sys.executable, "-I", "-m", "qlab_runner.harness"]
        isolation = "local process" + (" (rlimits)" if resource else "")
        if shutil.which("unshare") and hasattr(os, "geteuid") and os.geteuid() == 0:
            probe = subprocess.run(["unshare", "--net", "true"], capture_output=True)
            if probe.returncode == 0:
                cmd = ["unshare", "--net"] + cmd
                isolation += " + no network namespace"
        kw = {"env": env, "cwd": tmp}
        if sys.platform != "win32":
            kw["preexec_fn"] = _limits
        cmd[cmd.index("-I")] = "-s"  # keep site-packages, ignore user site; PYTHONPATH still applies
    try:
        p = subprocess.run(cmd, input=payload, capture_output=True, text=True, timeout=TIMEOUT + 5, **kw)
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": f"Timed out after {TIMEOUT} s.", "stdout": "", "stderr": "", "circuits": [], "figures": [], "problems": [], "isolation": isolation}
    try:
        out = json.loads(p.stdout.strip().splitlines()[-1])
    except Exception:
        err = (p.stderr or "")[-4000:]
        if p.returncode in (-9, 137):
            err = "Killed: the script exceeded the memory or CPU limit (2 GB, 30 s).\n" + err
        out = {"ok": False, "error": err or "The sandbox returned no result.", "stdout": p.stdout[-4000:], "stderr": "", "circuits": [], "figures": [], "problems": []}
    out["isolation"] = isolation
    return out
