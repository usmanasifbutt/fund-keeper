import { useState } from 'react';
import type { ManualNav } from '../lib/calc';
import type { Fund } from '../lib/mufap';
import { shiftDate } from '../lib/insights';
import { dateLabel } from '../lib/format';

interface Props {
  idPrefix: string;
  /** The fund as MUFAP lists it */
  fund: Fund;
  /** Manual NAVs for this fund, oldest first */
  entries: ManualNav[];
  today: string;
  onSave: (entry: ManualNav) => void;
  onRemove: (date: string) => void;
  onClose: () => void;
}

/** Inline form to enter a NAV that MUFAP doesn't have yet. MUFAP replaces it once it catches up. */
export default function NavEditor({ idPrefix, fund, entries, today, onSave, onRemove, onClose }: Props) {
  const lastNav = entries.length ? entries[entries.length - 1].nav : fund.nav;
  const [date, setDate] = useState(today);
  const [nav, setNav] = useState(String(lastNav));
  const [error, setError] = useState<string | null>(null);
  const [confirmBigChange, setConfirmBigChange] = useState(false);

  function save() {
    const n = parseFloat(nav);
    if (!(n > 0)) { setError('Enter a NAV above 0.'); return; }
    if (!date || date > today || date <= fund.date) {
      setError(`Pick a date after ${dateLabel(fund.date)} (MUFAP's latest), and not in the future.`);
      return;
    }
    if (Math.abs(n / lastNav - 1) > 0.1 && !confirmBigChange) {
      setConfirmBigChange(true);
      setError(null);
      return;
    }
    onSave({ date, nav: n });
  }

  return (
    <div className="add-purchase">
      <div className="add-title">Edit NAV</div>
      <div className="fields">
        <label>
          <span>Date</span>
          <input id={`${idPrefix}-date`} type="date" min={shiftDate(fund.date, 1)} max={today} value={date}
            onChange={e => { setDate(e.target.value); setError(null); }} />
        </label>
        <label>
          <span>NAV</span>
          <input id={`${idPrefix}-nav`} type="number" inputMode="decimal" step="any" min="0" value={nav}
            onChange={e => { setNav(e.target.value); setError(null); setConfirmBigChange(false); }} />
        </label>
      </div>
      <p className="add-hint">MUFAP's latest is {fund.nav.toFixed(4)} on {dateLabel(fund.date)}. Its NAV replaces yours once it catches up.</p>
      {entries.length > 0 && (
        <ul className="nav-entries">
          {entries.map(e => (
            <li key={e.date}>
              <span>{dateLabel(e.date)} · {e.nav.toFixed(4)}</span>
              <button type="button" className="link-btn" onClick={() => onRemove(e.date)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      {confirmBigChange && (
        <p className="error" role="alert">That's more than 10% away from the last NAV ({lastNav.toFixed(4)}). Check it, then tap Save anyway.</p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="primary" onClick={save}>{confirmBigChange ? 'Save anyway' : 'Save NAV'}</button>
        <button type="button" className="secondary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
