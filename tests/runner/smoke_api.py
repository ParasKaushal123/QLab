import sys, json, time
import os; sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../services/runner"))
from fastapi.testclient import TestClient
from qlab_runner.app import app

def main():
    c = TestClient(app)
    print("health", c.get("/v1/health").json()["ok"])
    print("backends", len(c.get("/v1/backends").json()))
    bell = {"version":"qlab-ir/1","n":2,"ops":[{"g":"H","q":[0],"col":0},{"g":"X","c":[0],"q":[1],"col":1},{"g":"M","q":[0],"cb":0,"col":2},{"g":"M","q":[1],"cb":1,"col":3}]}
    t=time.time(); r = c.post("/v1/run", json={"ir":bell,"backend":"cirq.simulator","shots":500,"seed":3}).json(); print("run", r["counts"], r["provenance"]["sdk"], round(time.time()-t,1))
    r = c.post("/v1/run", json={"ir":bell,"backend":"nope","shots":10}); print("bad backend", r.status_code, r.json()["detail"][:60])
    r = c.post("/v1/convert", json={"source":bell,"source_format":"ir","target":"qasm3"}).json(); print("convert", r["text"].splitlines()[2])
    r = c.post("/v1/transpile", json={"ir":bell,"target":"basis"}).json(); print("transpile", r["after"])
    with c.stream("POST","/v1/run/batch", json={"runs":[{"ir":bell,"backend":"aer.statevector","shots":400,"seed":1},{"ir":bell,"backend":"pennylane.default.qubit","shots":400,"seed":1}],"exact":{"00":0.5,"11":0.5}}) as s:
        ev=[l for l in s.iter_lines() if l.startswith("event:")]; print("sse", ev)
    code = "from qiskit import QuantumCircuit\nqc = QuantumCircuit(2)\nqc.h(0); qc.cx(0,1); qc.measure_all()\nprint('hi')\n"
    t=time.time(); r = c.post("/v1/exec", json={"code":code}).json(); print("exec", r["ok"], r["stdout"].strip(), [x["name"]+":"+str(x["line"]) for x in r["circuits"]], r["isolation"], r.get("error"), round(time.time()-t,1))
    r = c.post("/v1/exec", json={"code":"import urllib.request\nurllib.request.urlopen('http://example.com',timeout=3)"}).json(); print("net", r["ok"], (r["error"] or "")[-80:])

if __name__ == "__main__":
    main()
