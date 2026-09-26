"""QUBIQ circuit IR v1 — pydantic models mirroring packages/ir/schema.json.

Conventions (identical to the browser simulator):
  * q0 is the LEFTMOST character of every bitstring we return;
  * counts keys run over the measured classical bits in ascending cb order (c0 leftmost);
  * a register condition {reg:'c', val:v} reads c0 as the least-significant bit.
"""
from __future__ import annotations

import ast
import math
import operator
from typing import Literal, Optional, Union

from pydantic import BaseModel, Field, model_validator

GATES_1Q = {"I", "X", "Y", "Z", "H", "S", "SDG", "T", "TDG", "SX", "SXDG", "P", "RX", "RY", "RZ", "U"}
GATES_2Q = {"SWAP", "ISWAP", "ISWAPDG", "RXX", "RYY", "RZZ"}
NONUNITARY = {"M", "RESET", "BARRIER"}
NPARAMS = {"P": 1, "RX": 1, "RY": 1, "RZ": 1, "U": 3, "RXX": 1, "RYY": 1, "RZZ": 1}
Gate = Literal["I", "X", "Y", "Z", "H", "S", "SDG", "T", "TDG", "SX", "SXDG", "P", "RX", "RY", "RZ", "U",
               "SWAP", "ISWAP", "ISWAPDG", "RXX", "RYY", "RZZ", "M", "RESET", "BARRIER"]


class BitCond(BaseModel):
    bit: int
    val: Literal[0, 1]


class RegCond(BaseModel):
    reg: Literal["c"] = "c"
    val: int


class Op(BaseModel):
    g: Gate
    q: list[int]
    c: list[int] = Field(default_factory=list)
    p: list[Union[float, str]] = Field(default_factory=list)
    cb: Optional[int] = None
    cond: Optional[Union[BitCond, RegCond]] = None
    col: float = 0
    label: Optional[str] = None

    @model_validator(mode="after")
    def _arity(self):
        if self.g in GATES_2Q and len(self.q) != 2:
            raise ValueError(f"{self.g} needs exactly 2 target qubits")
        if self.g in GATES_1Q | {"M", "RESET"} and len(self.q) != 1:
            raise ValueError(f"{self.g} acts on exactly 1 target qubit")
        need = NPARAMS.get(self.g, 0)
        if len(self.p) < need:
            raise ValueError(f"{self.g} needs {need} parameter(s)")
        if set(self.c) & set(self.q):
            raise ValueError("a qubit cannot be both control and target")
        return self


class Register(BaseModel):
    name: str
    kind: Literal["quantum", "classical"]
    start: int
    size: int


class Circuit(BaseModel):
    version: Optional[str] = "qlab-ir/1"
    name: Optional[str] = None
    n: int = Field(ge=1, le=1000)
    nc: Optional[int] = None
    registers: list[Register] = Field(default_factory=list)
    params: dict[str, float] = Field(default_factory=dict)
    ops: list[Op] = Field(default_factory=list)

    @model_validator(mode="after")
    def _bounds(self):
        if self.nc is None:
            self.nc = self.n
        for o in self.ops:
            for w in o.q + o.c:
                if not 0 <= w < self.n:
                    raise ValueError(f"qubit {w} outside a {self.n}-qubit register")
        return self

    # ---- helpers shared by every backend ----
    def ordered(self) -> list[Op]:
        """Execution order: by time slice, stable in list order (same as the browser)."""
        return [o for _, o in sorted(enumerate(self.ops), key=lambda t: (t[1].col, t[0]))]

    def measured_cbs(self) -> list[int]:
        cbs = sorted({(o.cb if o.cb is not None else o.q[0]) for o in self.ops if o.g == "M"})
        return cbs

    def is_dynamic(self) -> bool:
        ops = self.ordered()
        for i, o in enumerate(ops):
            if o.cond is not None or o.g == "RESET":
                return True
            if o.g == "M":
                q = o.q[0]
                if any(x.g not in ("M", "BARRIER") and (q in x.q + x.c or x.cond is not None) for x in ops[i + 1:]):
                    return True
        return False

    def unitary_ops(self) -> list[Op]:
        return [o for o in self.ordered() if o.g not in NONUNITARY]


# ---------- safe parameter expressions: "2*gamma", "pi/4", "-(theta)" ----------
_BIN = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv, ast.Pow: operator.pow}
_FUN = {"sqrt": math.sqrt, "sin": math.sin, "cos": math.cos, "tan": math.tan, "asin": math.asin, "acos": math.acos, "atan": math.atan, "exp": math.exp, "log": math.log}
_CONST = {"pi": math.pi, "e": math.e, "π": math.pi}


def eval_param(x: Union[float, str], env: dict[str, float]) -> float:
    if isinstance(x, (int, float)):
        return float(x)
    src = str(x).replace("π", "pi").replace("θ", "theta").replace("γ", "gamma").replace("β", "beta").replace("^", "**")

    def ev(n):
        if isinstance(n, ast.Expression):
            return ev(n.body)
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
            return float(n.value)
        if isinstance(n, ast.Name):
            if n.id in env:
                return float(env[n.id])
            if n.id in _CONST:
                return _CONST[n.id]
            raise ValueError(f"unbound parameter '{n.id}'")
        if isinstance(n, ast.BinOp) and type(n.op) in _BIN:
            return _BIN[type(n.op)](ev(n.left), ev(n.right))
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, (ast.USub, ast.UAdd)):
            v = ev(n.operand)
            return -v if isinstance(n.op, ast.USub) else v
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id in _FUN and len(n.args) == 1:
            return _FUN[n.func.id](ev(n.args[0]))
        raise ValueError(f"unsupported expression '{src}'")

    return ev(ast.parse(src, mode="eval"))


def bound_params(op: Op, env: dict[str, float]) -> list[float]:
    return [eval_param(x, env) for x in op.p]
