# ADR-002 — Kontrak trace dan validasi

Status: diusulkan; menunggu review backend, frontend, dan QA sebelum `src/engine/types.ts` dibekukan.

## Context
PRD v2 §10.3 belum membedakan state pra-keputusan, ID proses `IDLE`, dan input form mentah.

## Constraints
UI tidak menghitung ulang scheduler atau validasi. Informasi PRD tidak boleh berkurang. Engine murni dan deterministik.

## Alternatives
- Tidak mengubah kontrak: latihan membocorkan jawaban dan `IDLE` ambigu.
- UI merekonstruksi state: menduplikasi aturan scheduler; ditolak.
- Melarang ID `IDLE`: menyembunyikan masalah tipe; ditolak.
- Snapshot pra-keputusan dan tagged union: dipilih.

## Decision
### Trace
- `Step.state` adalah keadaan setelah semua event pada langkah itu.
- `Decision.before: Snapshot` adalah keadaan setelah COMPLETE/QUANTUM_EXPIRED, ARRIVAL, dan REQUEUE, tetapi sebelum DISPATCH/IDLE_START.
- `Decision.chosen` bertipe `{ kind: 'RUN'; processId: string } | { kind: 'IDLE' }`.
- `ALL_DONE` bukan soal latihan.
- Saat soal aktif di waktu `t`, UI hanya merender segmen dengan `end <= t`. Segmen terakhir dirender tanpa informasi `continuesSameProcess` (garis batas quantum, `data-*`, label aksesibilitas). Segmen lain tidak masuk DOM.
- Saat soal aktif, UI hanya merender `Decision.before`, `candidates`, dan trace sebelum langkah soal. Jawaban, alasan keputusan, event langkah soal, data masa depan, Gantt masa depan, metrik, dan live region terkait tidak dirender.

### Parsing dan validasi
- Engine menyediakan `parseInput(processes: unknown, config: unknown)` yang mengembalikan `{ ok: true; processes: ProcessInput[]; config: SimConfig } | { ok: false; errors: ValidationError[] }`.
- Baris mentah: `{ id: unknown; arrival: unknown; burst: unknown }`; kolom numerik menerima `string` atau `number`.
- `processes` bukan array menghasilkan satu `TOO_FEW`, `field: 'processes'`, tanpa `row`.
- ID wajib string. `null`/`undefined` menghasilkan `ID_EMPTY`; tipe lain (mis. angka `42`, boolean, objek) menghasilkan `ID_INVALID` tanpa coercion.
- ID di-`trim` sebelum divalidasi; `ID_DUPLICATE` ditandai pada kemunculan kedua dan seterusnya; trace memakai ID hasil `trim` dengan kapitalisasi asli.
- Teks numerik setelah `trim` memakai grammar `^[+-]?[0-9]+(?:\.[0-9]+)?$`; `1.0` valid sebagai 1.
- Prioritas: `EMPTY`, `NOT_NUMBER`, non-finite sebagai `NOT_NUMBER`, `NOT_INTEGER`, batas bawah, `OUT_OF_RANGE`.
- Boolean, `null`, `undefined`, dan tipe tidak didukung pada kolom numerik menghasilkan `NOT_NUMBER`.
- Batas A2: AT, BT, quantum maksimal 999. A1: ID 1–8 huruf/angka ASCII, unik tanpa membedakan kapital.
- `ValidationError.field` mencakup `id`, `arrival`, `burst`, `quantum`, `processes`, `algorithm`; `row` 0-based dan hanya untuk galat baris.
- Config bukan objek, algoritma hilang, atau algoritma selain `FCFS | SJF | RR` menghasilkan satu `INVALID_ALGORITHM` tanpa memvalidasi quantum. Validasi proses tetap berjalan.
- `simulate` tidak menerima teks: sebelum validasi domain, `arrival`/`burst`/`quantum` bukan `number` menghasilkan `NOT_NUMBER`; `id` bukan string atau berbeda dari hasil `trim` menghasilkan `ID_INVALID`. Normalisasi hanya milik `parseInput`.
- `simulate` memvalidasi ulang dan melempar `SimulationValidationError` dengan `name` serta `errors: ValidationError[]`; tidak ada hasil parsial.

## Consequences
Trace bertambah satu snapshot per keputusan. Koma desimal ditolak; UI perlu petunjuk input. Kontrak lebih tahan terhadap pemanggilan langsung engine.

## Evidence
Keputusan berasal dari diskusi tim dan PRD v2 §4, §5, §10.3, §16. Belum ada `types.ts`, implementasi engine, atau tes yang dijalankan.

## Verification
G0: review kontrak dan acceptance check. G1: QA mengeksekusi kasus parser, galat `simulate`, `Decision.before`, tabrakan ID `IDLE`, serta bocoran latihan. Target <50 ms memerlukan benchmark G1, bukan perhitungan jumlah segmen.

## Rollback trigger
Bila kasus preset/latihan tidak dapat direpresentasikan tanpa logika scheduler di UI, hentikan implementasi terkait dan ubah ADR melalui prosedur §13.3.
