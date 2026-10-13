import { useState } from 'react';
import { makeBackup, restoreBackup } from '../lib/store';
import { MUFAP_URL } from '../lib/mufap';

export default function BackupView({ onBack, onRestored }: { onBack: () => void; onRestored: () => void }) {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  function exportFile() {
    const data = makeBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keeper-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMsg({ text: `Saved a backup with ${data.holdings.length} fund(s). Keep it in Google Drive or send it to yourself.`, ok: true });
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      const b = restoreBackup(await file.text());
      setMsg({ text: `Restored ${b.holdings.length} fund(s).`, ok: true });
      setTimeout(onRestored, 900);
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), ok: false });
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="text-btn" onClick={onBack}>Back</button>
        <div className="brand">Backup</div>
        <span className="topbar-spacer" />
      </header>
      <main className="content stack">
        <section className="panel">
          <h2>Your data stays on this phone</h2>
          <p>Keeper keeps your holdings in this browser's storage. Nothing is uploaded. If you clear site data or change phones, they're gone, so save a backup after you change your holdings.</p>
          <div className="btn-row">
            <button type="button" className="primary" onClick={exportFile}>Save backup file</button>
            <label className="secondary file-btn">
              Restore from file
              <input type="file" accept="application/json,.json" onChange={e => { importFile(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>
          {msg && <p className={msg.ok ? 'ok' : 'error'} role="status">{msg.text}</p>}
        </section>
        <section className="panel">
          <h2>Where the prices come from</h2>
          <p>Every NAV and return is read from MUFAP's public Performance Summary each time you open Keeper (at most every 30 minutes, or when you tap refresh).</p>
          <p><a href={MUFAP_URL} target="_blank" rel="noreferrer">Open MUFAP's Performance Summary</a></p>
          <p className="muted">Money market and income funds report returns as an annual rate. Keeper divides the 1-day rate by 365 to get the day's change, the same convention MUFAP uses.</p>
        </section>
      </main>
    </div>
  );
}
