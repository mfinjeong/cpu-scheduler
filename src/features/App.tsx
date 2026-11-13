import { useState } from 'react';
import { parseInput } from '../engine/parse.ts';
import { simulate } from '../engine/simulate.ts';
import { PRESETS, type Preset } from '../engine/presets.ts';
import type { Algorithm, SimResult, ValidationError } from '../engine/types.ts';
import { ALGORITHM_LABEL, PRESET_GOALS, message, num, pct } from '../content/text.ts';

type Row = { key: number; id: string; arrival: string; burst: string };
let nextKey = 0;
const row = (id: string, arrival = '', burst = ''): Row => ({ key: nextKey++, id, arrival, burst });
const fromPreset = (p: Preset): Row[] => p.processes.map((x) => row(x.id, String(x.arrival), String(x.burst)));
const freeId = (rows: Row[]) => {
  for (let i = 1; ; i++) if (!rows.some((r) => r.id.toLowerCase() === `p${i}`)) return `P${i}`;
};

export function App() {
  const [rows, setRows] = useState<Row[]>(() => fromPreset(PRESETS[3]));
  const [algorithm, setAlgorithm] = useState<Algorithm>('RR');
  const [quantum, setQuantum] = useState('10');
  const [presetId, setPresetId] = useState<string>('P2');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [result, setResult] = useState<SimResult | null>(null);
  const [stale, setStale] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  // FR-04 AC2: setiap perubahan input menandai hasil usang.
  const touch = () => { if (result) setStale(true); setPresetId(''); };

  const setCell = (key: number, field: 'id' | 'arrival' | 'burst', value: string) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
    touch();
  };

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setRows(fromPreset(p));
    setAlgorithm(p.config.algorithm);
    setQuantum(p.config.quantum ? String(p.config.quantum) : '');
    setErrors([]);
    if (result) setStale(true);
    setPresetId(id);
  };

  const run = () => {
    const parsed = parseInput(
      rows.map(({ id, arrival, burst }) => ({ id, arrival, burst })),
      algorithm === 'RR' ? { algorithm, quantum } : { algorithm },
    );
    if (!parsed.ok) {
      setErrors(parsed.errors);
      // Fokus ke kolom salah pertama (FR-01 AC3).
      queueMicrotask(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setErrors([]);
    setResult(simulate(parsed.processes, parsed.config));
    setStale(false);
    setSelected(null);
  };

  const clear = () => {
    setRows([row('P1')]);
    setQuantum('');
    setResult(null);
    setStale(false);
    setErrors([]);
    setPresetId('');
  };

  const errFor = (field: ValidationError['field'], r?: number) =>
    errors.filter((e) => e.field === field && e.row === r);

  const cell = (r: Row, i: number, field: 'id' | 'arrival' | 'burst', label: string) => {
    const errs = errFor(field, i);
    const errId = `err-${field}-${r.key}`;
    return (
      <td>
        <input
          aria-label={`${label} baris ${i + 1}`}
          value={r[field]}
          inputMode={field === 'id' ? 'text' : 'numeric'}
          autoComplete="off"
          aria-invalid={errs.length > 0}
          aria-describedby={errs.length ? errId : undefined}
          onChange={(e) => setCell(r.key, field, e.target.value)}
        />
        {errs.length > 0 && <p id={errId} className="err">{errs.map(message).join(' ')}</p>}
      </td>
    );
  };

  const globalErrs = [...errFor('processes'), ...errFor('algorithm')];
  const qErrs = errFor('quantum');
  const shown = result && !stale ? result : null;

  return (
    <>
      <header className="intro">
        <h1>Simulator Penjadwalan CPU</h1>
        <p>Pelajari bagaimana FCFS, SJF non-preemptive, dan Round Robin memilih proses, serta dari mana setiap angka metrik berasal.</p>
        <p className="muted">Batas model: satu CPU, satu burst per proses, tanpa I/O dan tanpa biaya context switch. Satuan waktu ms.</p>
      </header>

      <main>
        <section aria-labelledby="cfg-h" className="panel">
          <h2 id="cfg-h">Konfigurasi</h2>
          <div className="controls">
            <label>Preset
              <select value={presetId} onChange={(e) => applyPreset(e.target.value)}>
                <option value="">Data sendiri</option>
                {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.id} — {ALGORITHM_LABEL[p.config.algorithm]}</option>)}
              </select>
            </label>
            <label>Algoritma
              <select value={algorithm} onChange={(e) => { setAlgorithm(e.target.value as Algorithm); touch(); }}>
                {(Object.keys(ALGORITHM_LABEL) as Algorithm[]).map((a) => <option key={a} value={a}>{ALGORITHM_LABEL[a]}</option>)}
              </select>
            </label>
            {algorithm === 'RR' && (
              <label>Quantum (ms)
                <input
                  value={quantum}
                  inputMode="numeric"
                  aria-invalid={qErrs.length > 0}
                  aria-describedby={qErrs.length ? 'err-quantum' : undefined}
                  onChange={(e) => { setQuantum(e.target.value); touch(); }}
                />
                {qErrs.length > 0 && <span id="err-quantum" className="err">{qErrs.map(message).join(' ')}</span>}
              </label>
            )}
          </div>
          {presetId && <p className="goal">{PRESET_GOALS[presetId as Preset['id']]}</p>}

          <div className="scroll">
            <table className="input">
              <caption>Data proses (1–6). Angka memakai titik desimal, contoh 4 atau 4.0.</caption>
              <thead><tr><th scope="col">ID</th><th scope="col">AT (ms)</th><th scope="col">BT (ms)</th><th scope="col"><span className="sr">Aksi</span></th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.key}>
                    {cell(r, i, 'id', 'ID')}
                    {cell(r, i, 'arrival', 'AT')}
                    {cell(r, i, 'burst', 'BT')}
                    <td>
                      <button type="button" disabled={rows.length <= 1}
                        onClick={() => { setRows((rs) => rs.filter((x) => x.key !== r.key)); touch(); }}>
                        Hapus<span className="sr"> baris {i + 1}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {globalErrs.length > 0 && <p className="err" role="alert">{globalErrs.map(message).join(' ')}</p>}
          <div className="actions">
            <button type="button" disabled={rows.length >= 6} onClick={() => { setRows((rs) => [...rs, row(freeId(rs))]); touch(); }}>Tambah proses</button>
            <button type="button" className="primary" onClick={run}>Jalankan Simulasi</button>
            <button type="button" onClick={clear}>Bersihkan Input</button>
          </div>
          <p role="status" className="status">
            {errors.length > 0 ? `Ada ${errors.length} kesalahan input. Perbaiki kolom yang ditandai.`
              : stale ? 'Perlu dihitung ulang: input berubah sejak simulasi terakhir.' : ''}
          </p>
        </section>

        {shown && <Results result={shown} selected={selected} onSelect={setSelected} />}
      </main>
    </>
  );
}

function Results({ result, selected, onSelect }: { result: SimResult; selected: string | null; onSelect: (id: string) => void }) {
  const { segments, metrics, summary } = result;
  const total = summary.lastCompletion;
  const ids = metrics.map((m) => m.id);
  const color = (id: string | null) => (id === null ? 'idle' : `c${ids.indexOf(id) % 6}`);
  const ticks = [...new Set([0, ...segments.map((s) => s.end)])];
  const sel = metrics.find((m) => m.id === selected);

  return (
    <>
      <section aria-labelledby="gantt-h" className="panel">
        <h2 id="gantt-h">Gantt Chart</h2>
        <div className="scroll">
          <div className="gantt" style={{ minWidth: `${Math.max(100, total * 1.2)}%` }} aria-hidden="true">
            {segments.map((s, i) => (
              <div key={i} className={`seg ${color(s.processId)}${s.continuesSameProcess ? ' cont' : ''}`}
                style={{ flexGrow: s.end - s.start }}
                title={`${s.processId ?? 'IDLE'} ${s.start}–${s.end} ms`}>
                {s.kind === 'IDLE' ? 'IDLE' : s.processId}
              </div>
            ))}
          </div>
          <div className="axis" style={{ minWidth: `${Math.max(100, total * 1.2)}%` }} aria-hidden="true">
            {ticks.map((t) => <span key={t} style={{ left: `${(t / total) * 100}%` }}>{t}</span>)}
          </div>
        </div>
        <ol className="sr" aria-label="Daftar segmen jadwal">
          {segments.map((s, i) => (
            <li key={i}>{s.kind === 'IDLE' ? 'CPU idle' : s.processId} dari {s.start} sampai {s.end} ms
              {s.continuesSameProcess ? ', quantum habis lalu proses yang sama lanjut' : ''}</li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="res-h" className="panel">
        <h2 id="res-h">Hasil</h2>
        <div className="scroll">
          <table>
            <caption>Metrik per proses (ms). Pilih proses untuk melihat rumus.</caption>
            <thead><tr>{['Proses', 'AT', 'BT', 'ST', 'CT', 'TAT', 'WT', 'RT'].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.id} aria-selected={m.id === selected}>
                  <th scope="row">
                    <button type="button" className={`chip ${color(m.id)}`} aria-pressed={m.id === selected} onClick={() => onSelect(m.id)}>{m.id}</button>
                  </th>
                  {[m.arrival, m.burst, m.start, m.completion, m.turnaround, m.waiting, m.response].map((v, i) => <td key={i}>{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="summary">
          <div><dt>Rata-rata TAT</dt><dd>{num(summary.avgTurnaround)}</dd></div>
          <div><dt>Rata-rata WT</dt><dd>{num(summary.avgWaiting)}</dd></div>
          <div><dt>Rata-rata RT</dt><dd>{num(summary.avgResponse)}</dd></div>
          <div><dt>Total idle</dt><dd>{summary.totalIdle} ms</dd></div>
          <div><dt>Utilisasi CPU</dt><dd>{pct(summary.utilization)}</dd></div>
        </dl>
        {sel && (
          <div className="formula" aria-live="polite">
            <h3>Rincian {sel.id}</h3>
            <ul>
              <li>TAT = CT − AT = {sel.completion} − {sel.arrival} = {sel.turnaround}</li>
              <li>WT = TAT − BT = {sel.turnaround} − {sel.burst} = {sel.waiting}</li>
              <li>RT = ST − AT = {sel.start} − {sel.arrival} = {sel.response}</li>
            </ul>
            <p>Segmen layanan: {segments.filter((s) => s.processId === sel.id && s.kind === 'RUN').map((s) => `${s.start}–${s.end}`).join(', ')} ms</p>
          </div>
        )}
      </section>
    </>
  );
}
