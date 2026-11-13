# ADR-001 — Fondasi aplikasi CPU Scheduler

Status: diputuskan untuk workspace baru; G0 belum lolos.

## Context dan constraints
PRD Simulator Penjadwalan CPU v2; aplikasi statis, tanpa server, DB, autentikasi, penyimpanan persisten, atau layanan runtime pihak ketiga. Izin pengguna mencakup pengerjaan lokal bertahap dan video demo. Push/deploy tidak diizinkan oleh keputusan ini.

## Alternatives
- Tanpa perubahan: tidak memenuhi kebutuhan aplikasi berjalan.
- TypeScript + DOM native: dependency lebih sedikit; pengelolaan banyak panel dan snapshot perlu wiring manual.
- React + TypeScript + Vite: mengikuti rekomendasi PRD dan pembagian kerja; tambahan dependency wajib direview security.

## Decision
Pilih React + TypeScript + Vite; npm dan package-lock.json. Unit dan acceptance memakai `node:test` bawaan Node (menggantikan Vitest; tanpa dependency baru). Batas: runner tidak menjalankan `.tsx`/JSX dan tidak punya DOM, jadi hanya logika `.ts` murni diuji dengannya; perilaku komponen, fokus, live region, dan bocoran DOM diuji Playwright E2E mulai G2. Tes properti memakai generator ber-seed tanpa dependency. Typecheck wajib mencakup berkas tes. Playwright juga untuk rekaman demo aplikasi nyata. Engine TypeScript murni, bebas React/DOM. Tidak ada global state manager.
Versi dependency dan runtime belum dibekukan: DevOps memeriksa kompatibilitas dan security meninjau dependency sebelum G0.

## Ownership dan contracts
Architect: docs/adr dan persetujuan kontrak. Backend: src/engine termasuk types.ts. Frontend: src/features, src/components, src/content. QA: tests/acceptance dan tests/e2e. DevOps: package.json scripts, konfigurasi build/CI dan README. Security: SECURITY.md dan review dependency.
Permintaan kepada DevOps: buat kerangka build dengan stack ini, skrip lint/typecheck/build, lockfile, serta pin Node/npm yang kompatibel. Tidak menambah aplikasi contoh sebagai fitur produk.

## Consequences
Satu kerangka bersama; tidak ada scaffold tandingan. Dependency baru belum berarti disetujui keamanan. Tidak ada klaim target <50 ms sampai benchmark engine tersedia.

## Evidence
Workspace sebelumnya tidak ada. Dibuat dan git init berhasil (exit 0). Runtime teramati: Node v26.12.1, npm 12.0.2; ini bukan pin proyek. Belum ada commit, kode aplikasi, instalasi dependency, build, lint, atau tes.

## Verification dan rollback trigger
G0: ADR dan types.ts ditinjau backend/frontend/QA; review dependency; build dan lint kerangka hijau. G1 menjalankan tes engine, bukan syarat implementasi G0.
Tinjau ulang stack jika kompatibilitas browser/runtime atau dependency gagal memenuhi PRD; perubahan lewat ADR sebelum implementasi lanjut. Jangan hapus pekerjaan tim untuk mengganti scaffold.

## Risk
Dependency/runtime tidak kompatibel | kemungkinan belum diukur | dampak G0 terblokir | eksperimen install lockfile dan build/lint/typecheck | owner DevOps, review Security | deadline sebelum G0.

## Demo
F2: preset P2, Gantt, metrik, stale input. F3: maju/mundur/ulangi. F4–F5: perbandingan, latihan, keyboard dan viewport 360 px. QA mencantumkan commit dan cakupan; rekam aplikasi nyata dalam browser bersih. Video bukan pengganti hasil tes.
