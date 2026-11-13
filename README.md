# Simulator Penjadwalan CPU

Media pembelajaran interaktif berbahasa Indonesia untuk memahami algoritma penjadwalan CPU **FCFS**, **SJF non-preemptive**, dan **Round Robin**.

## Fitur tersedia

- Input 1–6 proses dengan waktu kedatangan (AT), burst time (BT), serta quantum untuk Round Robin.
- Enam preset contoh, validasi input, dan penanda hasil yang perlu dihitung ulang setelah input berubah.
- Gantt Chart dengan segmen proses dan CPU idle.
- Metrik ST, CT, TAT, WT, RT; rata-rata, total idle, serta utilisasi CPU.
- Rincian substitusi rumus per proses.

Simulasi memakai satu CPU, satu burst per proses, tanpa I/O maupun biaya context switch. Pada Round Robin, kedatangan tepat di akhir quantum masuk antrean sebelum proses aktif dimasukkan kembali. Angka waktu dibatasi sampai 999; pembulatan hanya pada tampilan.

## Status pengembangan

Engine dan UI awal tersedia. Pemutaran langkah, perbandingan, latihan, pengujian E2E lengkap, dan video demo belum selesai. Situs belum di-deploy. Hasil tes bukan bukti efektivitas pembelajaran.

## Menjalankan lokal

Gunakan Node **26.12.1** dan npm **12.0.2**.

```sh
npm ci --ignore-scripts
npm run dev
```

## Pemeriksaan dan build

```sh
npm run lint
npm run typecheck
npm run test:unit
npm run test:acceptance
npm run build
npm run preview
```

Build menghasilkan situs statis di `dist/`. Aplikasi berjalan di browser tanpa server aplikasi, database, atau akun pengguna.

CI mencakup pemindaian secret, audit dependency, lint, typecheck, unit, acceptance, dan build. Pengujian browser, aksesibilitas lengkap, dan kinerja pada perangkat kelas menengah belum terverifikasi.
