/** QUBIQ circuit IR v1 — see schema.json. q0 is the leftmost bit of every bitstring. */
export type Gate = 'I' | 'X' | 'Y' | 'Z' | 'H' | 'S' | 'SDG' | 'T' | 'TDG' | 'SX' | 'SXDG' | 'P' | 'RX' | 'RY' | 'RZ' | 'U'
  | 'SWAP' | 'ISWAP' | 'ISWAPDG' | 'RXX' | 'RYY' | 'RZZ' | 'M' | 'RESET' | 'BARRIER';
export type Cond = { bit: number; val: 0 | 1 } | { reg: 'c'; val: number };
export interface Op { g: Gate; q: number[]; c?: number[]; p?: (number | string)[]; cb?: number; cond?: Cond; col?: number; label?: string }
export interface Register { name: string; kind: 'quantum' | 'classical'; start: number; size: number }
export interface Circuit { version?: 'qlab-ir/1'; name?: string; n: number; nc?: number; registers?: Register[]; params?: Record<string, number>; ops: Op[] }
export interface Noise { p1?: number; p2?: number; t1?: number; t2?: number; g1?: number; g2?: number; readout?: number }
export interface Provenance { sdk: string; sdkVersion: string; backend: string; method: string; seed: number | null; shots: number; ms: number; where: 'server' | 'browser'; noise?: string | null }
export interface RunResult { counts: Record<string, number>; keys: number[]; statevector?: [number, number][]; probabilities?: Record<string, number>; expectation?: Record<string, number>; transpiled?: { text: string; format: string; depth: number; ops: Record<string, number> }; provenance: Provenance; warnings: string[] }
