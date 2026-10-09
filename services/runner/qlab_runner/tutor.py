"""AI tutor proxy: the browser sends grounded facts + a question, this module
asks an LLM and returns (or streams) the answer. API keys live only here, in
environment variables. With no key set, /v1/tutor/status reports unavailable
and the web app uses its built-in tutor instead.

  ANTHROPIC_API_KEY      enables Claude (preferred when set)
  QUBIQ_CLAUDE_MODEL     default claude-sonnet-4-5
  GEMINI_API_KEY         enables Gemini (used when no Anthropic key is set)
  GEMINI_MODEL           default gemini-2.0-flash
  QUBIQ_TUTOR_PROVIDER   force "claude" or "gemini" when both keys are set
  QUBIQ_TUTOR_DAILY      answers per user (or IP) per day, default 200
  QUBIQ_TUTOR_PER_MIN    answers per user (or IP) per minute, default 12
"""
from __future__ import annotations

import datetime
import json
import os
import urllib.error
import urllib.request
from typing import Iterator, Optional

API = "https://generativelanguage.googleapis.com/v1beta/models/{model}:{method}"
MAX_CONTEXT = 14000
MAX_MSG = 4000
MAX_TURNS = 12

GROUNDING = (
    "Rules: Only use numbers, states and facts that appear in FACTS or that are standard textbook quantum "
    "computing. q0 is the leftmost bit of every ket. Never claim to have run code. If FACTS don't cover the "
    "question, say what you'd need. Format: short paragraphs, inline maths between $...$, no headings."
)

_day: dict[str, tuple[str, int]] = {}
_min: dict[str, list[float]] = {}


def provider() -> Optional[str]:
    forced = os.environ.get("QUBIQ_TUTOR_PROVIDER", "").lower()
    has_c, has_g = bool(os.environ.get("ANTHROPIC_API_KEY")), bool(os.environ.get("GEMINI_API_KEY"))
    if forced == "gemini" and has_g:
        return "gemini"
    if forced == "claude" and has_c:
        return "claude"
    return "claude" if has_c else "gemini" if has_g else None


def key() -> Optional[str]:
    p = provider()
    return os.environ.get("ANTHROPIC_API_KEY") if p == "claude" else os.environ.get("GEMINI_API_KEY") if p == "gemini" else None


def model() -> str:
    if provider() == "claude":
        return os.environ.get("QUBIQ_CLAUDE_MODEL", "claude-sonnet-4-5")
    return os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")


def status() -> dict:
    return {"available": bool(key()), "provider": provider(), "model": model() if key() else None}


def allow(who: str) -> Optional[str]:
    """Returns an error message when `who` is over its per-minute or daily budget."""
    import time
    now = time.time()
    per_min = int(os.environ.get("QUBIQ_TUTOR_PER_MIN", "12"))
    daily = int(os.environ.get("QUBIQ_TUTOR_DAILY", "200"))
    win = [t for t in _min.get(who, []) if now - t < 60]
    if len(win) >= per_min:
        return "Too many questions in a minute; wait a moment."
    today = datetime.date.today().isoformat()
    d, n = _day.get(who, (today, 0))
    if d != today:
        n = 0
    if n >= daily:
        return "Today's AI tutor limit is used up; the built-in tutor still works."
    win.append(now)
    _min[who] = win
    _day[who] = (today, n + 1)
    return None


def build_body(system: str, context: str, messages: list[dict]) -> dict:
    sys_text = (system or "You are a quantum computing tutor.")[:2000] + "\n\n" + GROUNDING
    contents = []
    msgs = [m for m in (messages or []) if str(m.get("text", "")).strip()][-MAX_TURNS:]
    for i, m in enumerate(msgs):
        role = "model" if m.get("role") in ("model", "assistant", "bot") else "user"
        text = str(m.get("text", ""))[:MAX_MSG]
        if i == len(msgs) - 1 and role == "user":
            text = f"FACTS:\n{(context or '')[:MAX_CONTEXT]}\n\nQUESTION:\n{text}"
        contents.append({"role": role, "parts": [{"text": text}]})
    if not contents or contents[-1]["role"] != "user":
        raise ValueError("The last message must be the learner's question.")
    return {
        "systemInstruction": {"parts": [{"text": sys_text}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 900},
        "safetySettings": [],
    }


# ---------------- Claude (Anthropic Messages API) ----------------
def to_claude(body: dict, stream: bool) -> dict:
    """Converts the provider-neutral body (Gemini shape) to a Messages API request."""
    msgs = [{"role": "assistant" if c["role"] == "model" else "user", "content": c["parts"][0]["text"]} for c in body["contents"]]
    while msgs and msgs[0]["role"] != "user":
        msgs.pop(0)
    return {"model": model(), "max_tokens": 900, "temperature": 0.4, "system": body["systemInstruction"]["parts"][0]["text"], "messages": msgs, "stream": stream}


def _claude_request(payload: dict):
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=json.dumps(payload).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "x-api-key": key() or "", "anthropic-version": "2023-06-01"})
    return urllib.request.urlopen(req, timeout=90)


def _claude_answer(body: dict) -> str:
    try:
        with _claude_request(to_claude(body, False)) as r:
            j = json.loads(r.read().decode())
            return "".join(b.get("text", "") for b in j.get("content", []) if b.get("type") == "text")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Claude returned HTTP {e.code}") from None


def _claude_stream(body: dict) -> Iterator[str]:
    try:
        with _claude_request(to_claude(body, True)) as r:
            for raw in r:
                line = raw.decode("utf-8", "ignore").strip()
                if not line.startswith("data:"):
                    continue
                try:
                    ev = json.loads(line[5:])
                except json.JSONDecodeError:
                    continue
                if ev.get("type") == "content_block_delta" and ev.get("delta", {}).get("type") == "text_delta":
                    yield "data: " + json.dumps({"text": ev["delta"]["text"]}) + "\n\n"
                elif ev.get("type") == "error":
                    yield "data: " + json.dumps({"error": str(ev.get("error", {}).get("message", "Claude error"))[:200]}) + "\n\n"
                    return
        yield "data: " + json.dumps({"done": True}) + "\n\n"
    except urllib.error.HTTPError as e:
        yield "data: " + json.dumps({"error": f"Claude returned HTTP {e.code}"}) + "\n\n"
    except Exception as e:
        yield "data: " + json.dumps({"error": str(e)[:200]}) + "\n\n"


def _request(method: str, body: dict, stream: bool = False):
    url = API.format(model=model(), method=method) + ("?alt=sse" if stream else "")
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "x-goog-api-key": key() or ""})
    return urllib.request.urlopen(req, timeout=60)


def _text(obj: dict) -> str:
    try:
        return "".join(p.get("text", "") for p in obj["candidates"][0]["content"]["parts"])
    except (KeyError, IndexError, TypeError):
        return ""


def answer(body: dict) -> str:
    if provider() == "claude":
        return _claude_answer(body)
    try:
        with _request("generateContent", body) as r:
            return _text(json.loads(r.read().decode()))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Gemini returned HTTP {e.code}") from None


def stream(body: dict) -> Iterator[str]:
    """Yields Server-Sent Events: data: {"text": "..."} … then data: {"done": true}."""
    if provider() == "claude":
        yield from _claude_stream(body)
        return
    try:
        with _request("streamGenerateContent", body, stream=True) as r:
            for raw in r:
                line = raw.decode("utf-8", "ignore").strip()
                if not line.startswith("data:"):
                    continue
                try:
                    t = _text(json.loads(line[5:]))
                except json.JSONDecodeError:
                    continue
                if t:
                    yield "data: " + json.dumps({"text": t}) + "\n\n"
        yield "data: " + json.dumps({"done": True}) + "\n\n"
    except urllib.error.HTTPError as e:
        yield "data: " + json.dumps({"error": f"Gemini returned HTTP {e.code}"}) + "\n\n"
    except Exception as e:  # network errors
        yield "data: " + json.dumps({"error": str(e)[:200]}) + "\n\n"
