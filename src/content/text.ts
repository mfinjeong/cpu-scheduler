import type { ValidationCode, ValidationError } from '../engine/types.ts';
import type { Preset } from '../engine/presets.ts';

// RULE-31: koma desimal; non-bulat selalu dua angka (contoh PRD: 24,40).
export const num = (n: number): string =>
  Number.isInteger(n)
    ? String(n)
    : new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).format(n);

export const pct = (ratio: number): string => `${num(ratio * 100)}%`;

const MESSAGES: Record<ValidationCode, string> = {
  EMPTY: 'Kolom wajib diisi.',
  NOT_NUMBER: 'Isi dengan angka desimal, contoh 4 atau 4.0.',
  NOT_INTEGER: 'Harus bilangan bulat.',
  AT_NEGATIVE: 'AT tidak boleh kurang dari 0.',
  BT_NOT_POSITIVE: 'BT harus lebih dari 0.',
  QUANTUM_NOT_POSITIVE: 'Quantum harus lebih dari 0.',
  ID_EMPTY: 'ID wajib diisi.',
  ID_DUPLICATE: 'ID sudah dipakai proses lain.',
  ID_INVALID: 'ID hanya 1–8 huruf atau angka.',
  TOO_MANY: 'Maksimal 6 proses.',
  TOO_FEW: 'Minimal 1 proses.',
  OUT_OF_RANGE: 'Nilai maksimal 999.',
  INVALID_ALGORITHM: 'Pilih algoritma FCFS, SJF, atau Round Robin.',
};

export const message = (e: ValidationError): string => MESSAGES[e.code];

export const PRESET_GOALS: Record<Preset['id'], string> = {
  NP1: 'FCFS dengan semua proses datang bersamaan: urutan input menentukan giliran.',
  NP2: 'SJF non-preemptive: BT terkecil dipilih hanya dari proses yang sudah datang.',
  P1: 'Round Robin quantum 10 pada data NP1: bandingkan response time dengan FCFS.',
  P2: 'Round Robin dengan kedatangan bertahap: kedatangan masuk antrean sebelum requeue.',
  I1: 'FCFS dengan CPU idle di antara kedatangan.',
  I2: 'Contoh idle dan batas quantum tanpa pesaing, bukan contoh perebutan CPU.',
};

export const ALGORITHM_LABEL = { FCFS: 'FCFS', SJF: 'SJF non-preemptive', RR: 'Round Robin' } as const;
