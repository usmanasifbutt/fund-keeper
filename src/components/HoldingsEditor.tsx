import { useMemo, useRef, useState } from 'react';
import type { Holding } from '../lib/calc';
import type { Fund } from '../lib/mufap';
import { rs } from '../lib/format';
import FundPicker from './FundPicker';

interface Row {
  key: number;
  fundId: string;
  units: string;
  invested: string;
  /** What is typed in the fund search box */
  text: string;
}

interface Props {
  funds: Fund[];
  holdings: Holding[];
  loadingFunds: boolean;
  onSave: (h: Holding[]) => void;
  onCancel: () => void;
}

export default function HoldingsEditor({ funds, holdings, loadingFunds, onSave, onCancel }: Props) {
  const seq = useRef(0);
  const newRow = (h?: Holding): Row => ({
    key: ++seq.current,
    fundId: h?.fundId ?? '',
    units: h ? String(h.units) : '',
    invested: h?.invested ? String(h.invested) : '',
    text: h?.name ?? '',
  });
  const [rows, setRows] = useState<Row[]>(() => (holdings.length ? holdings.map(newRow) : [newRow()]));
  const [error, setError] = useState<string | null>(null);
  const [badKeys, setBadKeys] = useState<Set<number>>(new Set());
  const byId = useMemo(() => new Map(funds.map(f => [f.id, f])), [funds]);

  const update = (key: number, patch: Partial<Row>) => {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
    setError(null);
  };
  const remove = (key: number) => setRows(prev => (prev.length > 1 ? prev.filter(r => r.key !== key) : [newRow()]));

  function save() {
    const bad = new Set<number>();
    const out: Holding[] = [];
    let msg: string | null = null;
    const seen = new Set<string>();
    for (const r of rows) {
      if (!r.fundId && !r.text.trim() && !r.units && !r.invested) continue;
      const fund = byId.get(r.fundId);
      const u = parseFloat(r.units);
      const inv = r.invested ? parseFloat(r.invested) : 0;
      if (!r.fundId) { bad.add(r.key); msg ??= 'Pick each fund from the list.'; continue; }
      if (seen.has(r.fundId)) { bad.add(r.key); msg ??= `${fund?.name ?? 'A fund'} is listed twice. Combine it into one row.`; continue; }
      if (!(u > 0)) { bad.add(r.key); msg ??= 'Units must be more than 0. Use Remove to drop a fund.'; continue; }
      if (!(inv >= 0)) { bad.add(r.key); msg ??= "Amount invested can't be negative."; continue; }
      seen.add(r.fundId);
      const prior = holdings.find(h => h.fundId === r.fundId);
      out.push({ fundId: r.fundId, name: fund?.name ?? prior?.name ?? '', units: u, invested: inv });
    }
    setBadKeys(bad);
    if (msg) { setError(msg); return; }
    onSave(out);
  }

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="text-btn" onClick={onCancel}>Cancel</button>
        <div className="brand">Holdings</div>
        <button type="button" className="text-btn strong" onClick={save}>Save</button>
      </header>
      <main className="content">
        <p className="status">
          {loadingFunds ? 'Loading the fund list from MUFAP…' : funds.length ? `Search ${funds.length} funds listed on MUFAP.` : "The fund list couldn't load. Go back and refresh."}
        </p>
        <div className="rows">
          {rows.map(r => {
            const fund = byId.get(r.fundId);
            const u = parseFloat(r.units) || 0;
            const inv = parseFloat(r.invested) || 0;
            const value = fund ? u * fund.nav : 0;
            return (
              <section key={r.key} className={`row ${badKeys.has(r.key) ? 'row-bad' : ''}`}>
                <div className="row-top">
                  <FundPicker
                    id={`fund-${r.key}`}
                    funds={funds}
                    selected={fund ?? null}
                    fallbackName={holdings.find(h => h.fundId === r.fundId)?.name}
                    onPick={f => update(r.key, { fundId: f?.id ?? '' })}
                    nextFieldId={`units-${r.key}`}
                    onTextChange={text => update(r.key, { text })}
                  />
                  <button type="button" className="text-btn muted-btn" onClick={() => remove(r.key)}>Remove</button>
                </div>
                {fund && <div className="row-meta">{fund.category} · NAV {fund.nav.toFixed(4)}</div>}
                <div className="fields">
                  <label>
                    <span>Units</span>
                    <input id={`units-${r.key}`} type="number" inputMode="decimal" step="any" min="0" value={r.units}
                      onChange={e => update(r.key, { units: e.target.value })} />
                  </label>
                  <label>
                    <span>Invested (Rs)</span>
                    <input id={`inv-${r.key}`} type="number" inputMode="decimal" step="any" min="0" value={r.invested}
                      onChange={e => update(r.key, { invested: e.target.value })} />
                  </label>
                </div>
                {fund && u > 0 && (
                  <div className="row-calc">
                    Value <b>{rs(value)}</b>
                    {inv > 0 && <> · P/L <b className={value - inv >= 0 ? 'gain' : 'loss'}>{rs(value - inv, true)}</b></>}
                  </div>
                )}
              </section>
            );
          })}
        </div>
        <button type="button" className="secondary" onClick={() => setRows(prev => [...prev, newRow()])}>+ Add fund</button>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="help">
          <p><b>Units:</b> from your purchase confirmation or account statement.</p>
          <p><b>Invested:</b> the total you've paid into that fund, including any front-end load. When you buy more, add the new units and the new amount to both numbers.</p>
          <p><b>Dividend paid as units:</b> update Units from your statement and leave Invested as it is.</p>
        </div>
        <button type="button" className="primary wide" onClick={save}>Save holdings</button>
      </main>
    </div>
  );
}
