"""AI tutor endpoint: off without a key, grounded request shape, limits, streaming (Gemini mocked)."""
import io
import json

from fastapi.testclient import TestClient
from qlab_runner import tutor as T
from qlab_runner.app import app

client = TestClient(app)


def test_status_off_without_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert client.get("/v1/tutor/status").json()["available"] is False
    r = client.post("/v1/tutor", json={"messages": [{"role": "user", "text": "hi"}]})
    assert r.status_code == 503


def test_answer_and_body(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("QUBIQ_TUTOR_PROVIDER", "gemini")
    seen = {}

    class Resp(io.BytesIO):
        def __enter__(self): return self
        def __exit__(self, *a): return False

    def fake(method, body, stream=False):
        seen["method"], seen["body"] = method, body
        return Resp(json.dumps({"candidates": [{"content": {"parts": [{"text": "H makes |+>."}]}}]}).encode())
    monkeypatch.setattr(T, "_request", fake)
    r = client.post("/v1/tutor", json={"system": "Tutor.", "context": "State: |+>", "messages": [{"role": "user", "text": "What does H do?"}]})
    assert r.status_code == 200, r.text
    assert r.json()["text"] == "H makes |+>."
    last = seen["body"]["contents"][-1]["parts"][0]["text"]
    assert "FACTS:" in last and "State: |+>" in last and "What does H do?" in last
    assert "q0 is the leftmost bit" in seen["body"]["systemInstruction"]["parts"][0]["text"]


def test_stream(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("QUBIQ_TUTOR_PROVIDER", "gemini")

    class Resp:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def __iter__(self):
            for t in ["Hello ", "world"]:
                yield ("data: " + json.dumps({"candidates": [{"content": {"parts": [{"text": t}]}}]}) + "\n").encode()
    monkeypatch.setattr(T, "_request", lambda m, b, stream=False: Resp())
    r = client.post("/v1/tutor", json={"messages": [{"role": "user", "text": "hi"}], "stream": True})
    events = [json.loads(l[5:]) for l in r.text.split("\n") if l.startswith("data:")]
    assert "".join(e.get("text", "") for e in events) == "Hello world" and events[-1] == {"done": True}


def test_rate_limit(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("QUBIQ_TUTOR_PER_MIN", "2")
    T._min.clear(); T._day.clear()
    assert T.allow("x") is None and T.allow("x") is None
    assert T.allow("x") is not None


def test_claude_provider(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    T._min.clear(); T._day.clear()
    st = client.get("/v1/tutor/status").json()
    assert st["available"] and st["provider"] == "claude"
    seen = {}

    class Resp(io.BytesIO):
        def __enter__(self): return self
        def __exit__(self, *a): return False

    def fake(payload):
        seen["p"] = payload
        if payload["stream"]:
            class S:
                def __enter__(self): return self
                def __exit__(self, *a): return False
                def __iter__(self):
                    for t in ["Bell ", "pair."]:
                        yield ("data: " + json.dumps({"type": "content_block_delta", "delta": {"type": "text_delta", "text": t}}) + "\n").encode()
            return S()
        return Resp(json.dumps({"content": [{"type": "text", "text": "A Bell pair."}]}).encode())
    monkeypatch.setattr(T, "_claude_request", fake)
    r = client.post("/v1/tutor", json={"system": "Tutor.", "context": "State: Bell", "messages": [{"role": "user", "text": "What is this?"}]})
    assert r.status_code == 200 and r.json()["text"] == "A Bell pair."
    p = seen["p"]
    assert p["messages"][-1]["role"] == "user" and "FACTS:" in p["messages"][-1]["content"] and "Tutor." in p["system"]
    r = client.post("/v1/tutor", json={"messages": [{"role": "user", "text": "hi"}], "stream": True})
    ev = [json.loads(l[5:]) for l in r.text.split("\n") if l.startswith("data:")]
    assert "".join(e.get("text", "") for e in ev) == "Bell pair." and ev[-1] == {"done": True}
