"""QUBIQ runner — FastAPI service executing QUBIQ IR on real SDK backends.

  uvicorn qlab_runner.app:app --host 0.0.0.0 --port 8765
"""
from __future__ import annotations

import asyncio
import json
import os
from concurrent.futures import ProcessPoolExecutor
from typing import Any, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import db
from . import run as R
from . import sandbox, stats
from .convert import cirq_to_ir, ir_to, qiskit_to_ir
from .limits import check_budget, rate_allow

import logging
import time
import uuid

logger = logging.getLogger("qlab_runner")
logging.basicConfig(level=logging.INFO, format='%(message)s')

app = FastAPI(title="QUBIQ runner", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=os.environ.get("QLAB_CORS", "*").split(","), allow_methods=["*"], allow_headers=["*"])
POOL = ProcessPoolExecutor(max_workers=int(os.environ.get("QLAB_WORKERS", "2")))
STARTED = time.time()
REQ_COUNT: dict[str, int] = {}
ERR_COUNT: dict[str, int] = {}


@app.on_event("startup")
async def _warm():
    # Pre-import SDKs in each worker so no user pays the ~10s first-run cost.
    async def _one(payload):
        loop = asyncio.get_running_loop()
        try:
            await asyncio.wait_for(loop.run_in_executor(POOL, _run, payload), timeout=60)
        except Exception:
            pass
    bell = {"version": "qlab-ir/1", "n": 1, "ops": [{"g": "H", "q": [0], "col": 0}]}
    for be in ("aer.statevector", "cirq.simulator"):
        await _one({"ir": bell, "backend": be, "shots": 8, "seed": 1, "noise": None, "options": {}})
    logger.info('{"event":"warmup","ok":true}')


@app.middleware("http")
async def _log_requests(request, call_next):
    rid = uuid.uuid4().hex[:8]
    t0 = time.perf_counter()
    resp = await call_next(request)
    ms = (time.perf_counter() - t0) * 1000
    try:
        logger.info(json.dumps({"rid": rid, "method": request.method, "path": request.url.path, "status": resp.status_code, "ms": round(ms, 1)}))
    except Exception:
        pass
    return resp


@app.get("/v1/metrics")
def metrics():
    lines = [f'qlab_uptime_seconds {time.time() - STARTED:.1f}']
    for k, v in REQ_COUNT.items():
        lines.append(f'qlab_requests_total{{path="{k}"}} {v}')
    for k, v in ERR_COUNT.items():
        lines.append(f'qlab_errors_total{{path="{k}"}} {v}')
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse("\n".join(lines) + "\n", media_type="text/plain")


def _guard_rate(request, kind: str):
    ip = (request.client.host if request.client else "unknown") if request is not None else "unknown"
    if not rate_allow(f"{kind}:{ip}"):
        from fastapi import HTTPException as HE
        raise HE(429, "Rate limit: try again in a minute.")


@app.get("/v1/validation")
def validation():
    from pathlib import Path
    for cand in (Path(__file__).resolve().parent.parent / "validation.json", Path("validation.json"), Path("/tmp/validation.json")):
        if cand.exists():
            try:
                return json.loads(cand.read_text())
            except Exception:
                pass
    raise HTTPException(404, "No validation.json yet: POST /v1/validation/run or run tests/crossval/report.py")


@app.post("/v1/validation/run")
async def validation_run():
    # Re-run the crossval suite in the background and refresh validation.json.
    import subprocess
    import sys
    from pathlib import Path
    root = Path(__file__).resolve().parent.parent.parent.parent

    async def _job():
        try:
            proc = await asyncio.create_subprocess_exec(
                sys.executable, "-m", "pytest", "tests/crossval", "-q",
                cwd=str(root), env={**os.environ, "PYTHONPATH": str(root / "services" / "runner")},
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
            await proc.communicate()
            # Best-effort report refresh (report.py writes validation.json next to the runner).
            rep = root / "tests" / "crossval" / "report.py"
            if rep.exists():
                p2 = await asyncio.create_subprocess_exec(sys.executable, str(rep), cwd=str(root))
                await p2.communicate()
        except Exception as e:
            logger.info(json.dumps({"event": "validation_run_error", "error": str(e)}))
    asyncio.create_task(_job())
    return {"ok": True, "status": "started"}


class RunReq(BaseModel):
    ir: dict
    backend: str
    shots: int = Field(1024, ge=1, le=1_000_000)
    seed: Optional[int] = None
    noise: Optional[dict] = None
    options: dict = Field(default_factory=dict)  # {state: bool, observables: [str], bind: {name: value}}


def _run(req: dict) -> dict:
    o = req.get("options") or {}
    try:
        return {"ok": True, **R.run(req["ir"], req["backend"], req.get("shots", 1024), req.get("seed"), req.get("noise"), bool(o.get("state")), o.get("observables"), o.get("bind"))}
    except Exception as e:  # reported per result, never silently replaced by another backend
        return {"ok": False, "backend": req["backend"], "error": f"{type(e).__name__}: {e}"}


@app.get("/v1/health")
def health():
    return {"ok": True, "versions": {k: R.ver(k) for k in ("qiskit", "qiskit-aer", "qiskit-ibm-runtime", "cirq-core", "pennylane", "pennylane-lightning", "qbraid", "numpy", "scipy")}}


@app.get("/v1/backends")
def backends():
    return R.backends()


@app.post("/v1/run")
async def run(req: RunReq, request: Any = None):
    try:
        from fastapi import Request as _Request
        ip = "unknown"
        if isinstance(request, _Request) and request.client:
            ip = request.client.host
        elif request is not None and hasattr(request, "client") and getattr(request, "client", None):
            try:
                ip = request.client.host
            except Exception:
                pass
        if not rate_allow(f"run:{ip}"):
            raise HTTPException(429, "Rate limit: 100 runs/minute per IP. Try again shortly.")
    except HTTPException:
        raise
    except Exception:
        pass
    try:
        ir = req.ir or {}
        n = int(ir.get("n", 1))
        check_budget(n, req.shots)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(422, f"{type(e).__name__}: {e}")
    loop = asyncio.get_running_loop()
    try:
        out = await asyncio.wait_for(loop.run_in_executor(POOL, _run, req.model_dump()), timeout=60)
    except asyncio.TimeoutError:
        ERR_COUNT["/v1/run"] = ERR_COUNT.get("/v1/run", 0) + 1
        raise HTTPException(504, "Run timed out after 60 s (reduce qubits or shots)")
    REQ_COUNT["/v1/run"] = REQ_COUNT.get("/v1/run", 0) + 1
    if not out["ok"]:
        ERR_COUNT["/v1/run"] = ERR_COUNT.get("/v1/run", 0) + 1
        raise HTTPException(422, out["error"])
    return out


class BatchReq(BaseModel):
    runs: list[RunReq]
    exact: Optional[dict[str, float]] = None


@app.post("/v1/run/batch")
async def batch(req: BatchReq):
    """Server-sent events: one `result` event per run as it finishes, then a `compare` event."""
    loop = asyncio.get_running_loop()

    async def gen():
        async def one(i: int, r: RunReq):
            return i, await loop.run_in_executor(POOL, _run, r.model_dump())

        done: dict[int, dict] = {}
        for f in asyncio.as_completed([one(i, r) for i, r in enumerate(req.runs)]):
            i, res = await f
            done[i] = res
            yield f"event: result\ndata: {json.dumps({'index': i, **res})}\n\n"
        ok = {f"{i}:{done[i]['provenance']['backend']}": done[i] for i in done if done[i].get("ok")}
        yield f"event: compare\ndata: {json.dumps(stats.compare(ok, req.exact))}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")


class CompareReq(BaseModel):
    results: dict[str, dict]
    exact: Optional[dict[str, float]] = None


@app.post("/v1/compare")
def compare(req: CompareReq):
    return stats.compare(req.results, req.exact)


class ExecReq(BaseModel):
    code: str = Field(max_length=200_000)


@app.post("/v1/exec")
async def exec_(req: ExecReq):
    return await asyncio.get_running_loop().run_in_executor(None, sandbox.execute, req.code)


class ConvertReq(BaseModel):
    source: Any
    source_format: str  # ir | qasm2 | qasm3 | qiskit-qasm
    target: str        # ir | qasm2 | qasm3 | cirq | braket | pyquil


@app.post("/v1/convert")
def convert(req: ConvertReq):
    try:
        if req.source_format == "ir":
            ir = req.source
        elif req.source_format in ("qasm2", "qasm3"):
            from qiskit import qasm2, qasm3
            qc = qasm2.loads(req.source, custom_instructions=qasm2.LEGACY_CUSTOM_INSTRUCTIONS) if req.source_format == "qasm2" else qasm3.loads(req.source)
            ir = qiskit_to_ir(qc)
        else:
            raise ValueError(f"unknown source format '{req.source_format}'")
        return {"ir": ir} if req.target == "ir" else {"text": ir_to(req.target, ir)}
    except Exception as e:
        raise HTTPException(422, f"{type(e).__name__}: {e}")


class TranspileReq(BaseModel):
    ir: dict
    target: str = "fake_sherbrooke"   # fake_sherbrooke | fake_kyiv | basis
    optimization_level: int = 1
    seed: int = 11


@app.post("/v1/transpile")
def transpile_(req: TranspileReq):
    from qiskit import qasm3, transpile
    from qiskit_ibm_runtime import fake_provider
    from .build import to_qiskit
    from .ir import Circuit

    qc = to_qiskit(Circuit.model_validate(req.ir), measure_all_if_none=False)
    kw = {"basis_gates": ["cx", "rz", "sx", "x"]} if req.target == "basis" else {"backend": {"fake_sherbrooke": fake_provider.FakeSherbrooke, "fake_kyiv": fake_provider.FakeKyiv}[req.target]()}
    t = transpile(qc, optimization_level=req.optimization_level, seed_transpiler=req.seed, **kw)
    return {"before": {"depth": qc.depth(), "ops": dict(qc.count_ops())}, "after": {"depth": t.depth(), "ops": dict(t.count_ops())},
            "qasm3": qasm3.dumps(t)[:50000], "ir": qiskit_to_ir(t) if t.num_qubits <= 40 else None, "sdk": f"qiskit {R.ver('qiskit')}"}


@app.post("/v1/ibm/jobs")
def ibm_submit(req: RunReq):
    tok = os.environ.get("QLAB_IBM_TOKEN")
    if not tok:
        raise HTTPException(503, "IBM Quantum is not configured: set QLAB_IBM_TOKEN on the runner")
    from qiskit import transpile
    from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2
    from .build import to_qiskit
    from .ir import Circuit

    svc = QiskitRuntimeService(channel="ibm_quantum", token=tok)
    be = svc.least_busy(operational=True, simulator=False)
    qc = transpile(to_qiskit(Circuit.model_validate(req.ir)), be, optimization_level=1)
    job = SamplerV2(mode=be).run([qc], shots=req.shots)
    return {"job": job.job_id(), "backend": be.name}


@app.get("/v1/ibm/jobs/{job_id}")
def ibm_status(job_id: str):
    tok = os.environ.get("QLAB_IBM_TOKEN")
    if not tok:
        raise HTTPException(503, "IBM Quantum is not configured")
    from qiskit_ibm_runtime import QiskitRuntimeService
    job = QiskitRuntimeService(channel="ibm_quantum", token=tok).job(job_id)
    st = str(job.status())
    out = {"job": job_id, "status": st}
    if st in ("DONE", "JobStatus.DONE"):
        out["counts"] = job.result()[0].data.c.get_counts()
    return out


# ------------------------------------------------------------- Auth & Projects API
class SignupReq(BaseModel):
    email: str
    password: str
    name: str = "Learner"


class LoginReq(BaseModel):
    email: str
    password: str


class ProjectCreateReq(BaseModel):
    title: str
    ir: dict
    script: str = ""
    note: str = "Initial version"


class ProjectUpdateReq(BaseModel):
    title: str


class VersionCreateReq(BaseModel):
    ir: dict
    script: str = ""
    note: str = ""


class ShareCreateReq(BaseModel):
    project_id: str


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid authorization header")
    token = authorization.split(" ", 1)[1]
    payload = db.decode_token(token)
    if not payload:
        raise HTTPException(401, "Invalid or expired session")
    user = db.get_user_by_id(payload.get("sub"))
    if not user:
        raise HTTPException(401, "User not found")
    return user


@app.post("/v1/auth/signup")
def signup(req: SignupReq):
    try:
        user = db.create_user(req.email, req.password, req.name)
        token = db.create_token(user["id"], user["email"], user["name"])
        return {"token": token, "user": user}
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/v1/auth/login")
def login(req: LoginReq):
    user = db.authenticate_user(req.email, req.password)
    if not user:
        raise HTTPException(401, "Invalid email or password")
    token = db.create_token(user["id"], user["email"], user["name"])
    return {"token": token, "user": user}


@app.get("/v1/me")
def me(user: dict = Depends(get_current_user)):
    return {"user": user}


@app.get("/v1/projects")
def get_projects(user: dict = Depends(get_current_user)):
    return db.list_projects(user["id"])


@app.post("/v1/projects")
def create_project_(req: ProjectCreateReq, user: dict = Depends(get_current_user)):
    return db.create_project(user["id"], req.title, req.ir, req.script, req.note)


@app.get("/v1/projects/{proj_id}")
def get_project_(proj_id: str, user: dict = Depends(get_current_user)):
    p = db.get_project(proj_id, user["id"])
    if not p:
        raise HTTPException(404, "Project not found")
    return p


@app.put("/v1/projects/{proj_id}")
def update_project_(proj_id: str, req: ProjectUpdateReq, user: dict = Depends(get_current_user)):
    if not db.update_project_title(proj_id, user["id"], req.title):
        raise HTTPException(404, "Project not found")
    return {"ok": True}


@app.delete("/v1/projects/{proj_id}")
def delete_project_(proj_id: str, user: dict = Depends(get_current_user)):
    if not db.delete_project(proj_id, user["id"]):
        raise HTTPException(404, "Project not found")
    return {"ok": True}


@app.post("/v1/projects/{proj_id}/versions")
def save_version_(proj_id: str, req: VersionCreateReq, user: dict = Depends(get_current_user)):
    try:
        return db.save_version(proj_id, user["id"], req.ir, req.script, req.note)
    except ValueError:
        raise HTTPException(404, "Project not found")


@app.get("/v1/projects/{proj_id}/versions")
def list_versions_(proj_id: str, user: dict = Depends(get_current_user)):
    try:
        return db.list_versions(proj_id, user["id"])
    except ValueError:
        raise HTTPException(404, "Project not found")


@app.get("/v1/progress")
def get_progress_(user: dict = Depends(get_current_user)):
    return db.get_progress(user["id"])


@app.put("/v1/progress")
def save_progress_(data: dict, user: dict = Depends(get_current_user)):
    db.save_progress(user["id"], data)
    return {"ok": True}


@app.post("/v1/share")
def create_share_(req: ShareCreateReq, user: dict = Depends(get_current_user)):
    try:
        token = db.create_share(req.project_id, user["id"])
        return {"token": token, "url": f"/#share/{token}"}
    except ValueError as e:
        raise HTTPException(404, str(e))


@app.get("/v1/share/{token}")
def get_shared_(token: str):
    s = db.get_shared(token)
    if not s:
        raise HTTPException(404, "Shared circuit not found or link has expired")
    return s

