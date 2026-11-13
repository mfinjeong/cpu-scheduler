import type { Algorithm, ParseResult, ProcessInput, SimConfig, ValidationCode, ValidationError } from './types.ts';

const MAX = 999; // A2
const MAX_PROCESSES = 6;
const DECIMAL = /^[+-]?[0-9]+(?:\.[0-9]+)?$/;
const ID = /^[A-Za-z0-9]{1,8}$/; // A1
const ALGORITHMS: readonly Algorithm[] = ['FCFS', 'SJF', 'RR'];

type Field = 'arrival' | 'burst' | 'quantum';
const LOWER: Record<Field, { min: number; code: ValidationCode }> = {
  arrival: { min: 0, code: 'AT_NEGATIVE' },
  burst: { min: 1, code: 'BT_NOT_POSITIVE' },
  quantum: { min: 1, code: 'QUANTUM_NOT_POSITIVE' },
};

// Urutan ADR-002: kosong, format, finite, integer, batas bawah, batas atas.
function parseNumber(raw: unknown, field: Field): number | ValidationCode {
  let n: number;
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (s === '') return 'EMPTY';
    if (!DECIMAL.test(s)) return 'NOT_NUMBER';
    n = Number(s);
  } else if (typeof raw === 'number') {
    n = raw;
  } else {
    return 'NOT_NUMBER';
  }
  if (!Number.isFinite(n)) return 'NOT_NUMBER';
  if (!Number.isInteger(n)) return 'NOT_INTEGER';
  if (n < LOWER[field].min) return LOWER[field].code;
  if (n > MAX) return 'OUT_OF_RANGE';
  return n;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseInput(processes: unknown, config: unknown): ParseResult {
  const errors: ValidationError[] = [];
  const parsed: ProcessInput[] = [];

  if (!Array.isArray(processes) || processes.length < 1) {
    errors.push({ code: 'TOO_FEW', field: 'processes' });
  } else {
    if (processes.length > MAX_PROCESSES) errors.push({ code: 'TOO_MANY', field: 'processes' });
    const seen = new Set<string>();
    processes.forEach((item: unknown, row) => {
      const r = isRecord(item) ? item : {};
      let id = '';
      if (r.id === undefined || r.id === null || (typeof r.id === 'string' && r.id.trim() === '')) {
        errors.push({ code: 'ID_EMPTY', field: 'id', row });
      } else if (typeof r.id !== 'string' || !ID.test(r.id.trim())) {
        errors.push({ code: 'ID_INVALID', field: 'id', row });
      } else {
        id = r.id.trim();
        const key = id.toLowerCase();
        if (seen.has(key)) errors.push({ code: 'ID_DUPLICATE', field: 'id', row });
        seen.add(key);
      }
      const arrival = parseNumber(r.arrival, 'arrival');
      if (typeof arrival === 'string') errors.push({ code: arrival, field: 'arrival', row });
      const burst = parseNumber(r.burst, 'burst');
      if (typeof burst === 'string') errors.push({ code: burst, field: 'burst', row });
      if (typeof arrival === 'number' && typeof burst === 'number') parsed.push({ id, arrival, burst });
    });
  }

  let parsedConfig: SimConfig | undefined;
  const algorithm = isRecord(config) ? config.algorithm : undefined;
  if (!isRecord(config) || !ALGORITHMS.includes(algorithm as Algorithm)) {
    errors.push({ code: 'INVALID_ALGORITHM', field: 'algorithm' });
  } else if (algorithm === 'RR') {
    const quantum = parseNumber(config.quantum, 'quantum');
    if (typeof quantum === 'string') errors.push({ code: quantum, field: 'quantum' });
    else parsedConfig = { algorithm, quantum };
  } else {
    parsedConfig = { algorithm: algorithm as Algorithm };
  }

  if (errors.length > 0 || !parsedConfig) return { ok: false, errors };
  return { ok: true, processes: parsed, config: parsedConfig };
}
