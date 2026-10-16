import { useState } from 'react';
import type { Fund } from '../lib/mufap';
import { dateLabel, rs, units as fmtUnits } from '../lib/format';

interface Props {
  idPrefix: string;
  fund: Fund;
  onAdd: (units: number, amount: number) => void;
  onCancel: () => void;
}

/** Inline form to add a new purchase (or dividend units) on top of a fund's existing totals. */
export default function AddPurchase({ idPrefix, fund, onAdd, onCancel }: Props) {
  const [amount, setAmount] = useState('');
  const [units, setUnits] = useState('');
  const [error, setError] = useState<string | null>(null);

  const amt = parseFloat(amount) || 0;
  const estimate = amt > 0 ? Math.round((amt / fund.nav) * 10000) / 10000 : 0;

  function add() {
    const u = parseFloat(units);
    if (!(u > 0)) { setError('Enter the units you received (from your confirmation SMS or email).'); return; }
    if (!(amt >= 0)) { setError("Amount can't be negative."); return; }
    onAdd(u, amt);
  }

  return (
    <div className="add-purchase">
      <div className="add-title">Add more to this fund</div>
      <div className="fields">
        <label>
          <span>Amount paid (Rs)</span>
          <input id={`${idPrefix}-amt`} type="number" inputMode="decimal" step="any" min="0" value={amount} autoFocus
            onChange={e => { setAmount(e.target.value); setError(null); }} />
        </label>
        <label>
          <span>Units received</span>
          <input id={`${idPrefix}-units`} type="number" inputMode="decimal" step="any" min="0" value={units}
            onChange={e => { setUnits(e.target.value); setError(null); }} />
        </label>
      </div>
      {estimate > 0 && (
        <p className="add-hint">
          ≈ {fmtUnits(estimate)} units at the latest NAV ({fund.nav.toFixed(4)} on {dateLabel(fund.date)}), with no front-end load.{' '}
          <button type="button" className="link-btn" onClick={() => { setUnits(String(estimate)); setError(null); }}>Use estimate</button>
          <br />Your confirmation has the exact units, priced at your dealing day's NAV.
        </p>
      )}
      <p className="add-hint">Dividend paid as units? Enter the units and leave the amount at 0.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="primary" onClick={add}>
          Add{parseFloat(units) > 0 ? ` ${fmtUnits(parseFloat(units))} units` : ''}{amt > 0 ? ` · ${rs(amt)}` : ''}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
