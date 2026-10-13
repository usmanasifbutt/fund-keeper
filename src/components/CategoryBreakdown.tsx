import type { Portfolio } from '../lib/calc';
import { byCategory, type CategoryGroup } from '../lib/insights';
import { pct, rs, tone } from '../lib/format';

const SWATCH: Record<CategoryGroup, string> = {
  Equity: 'var(--c-equity)',
  'Money Market': 'var(--c-mm)',
  Income: 'var(--c-income)',
  'Asset Allocation': 'var(--c-alloc)',
  Other: 'var(--c-other)',
};

export default function CategoryBreakdown({ portfolio }: { portfolio: Portfolio }) {
  const rows = byCategory(portfolio);
  if (!rows.length) return null;
  return (
    <section className="panel" aria-labelledby="cat-h">
      <h2 id="cat-h">By category</h2>
      <div className="alloc" role="img" aria-label={rows.map(r => `${r.group} ${r.share.toFixed(0)}%`).join(', ')}>
        {rows.map(r => <span key={r.group} style={{ width: `${r.share}%`, background: SWATCH[r.group] }} />)}
      </div>
      <div className="cat-table" role="table" aria-label="Profit and loss by category">
        <div className="cat-row cat-headrow" role="row">
          <span role="columnheader">Category</span>
          <span role="columnheader">Today</span>
          <span role="columnheader">Total P/L</span>
        </div>
        {rows.map(r => (
          <div className="cat-row" role="row" key={r.group}>
            <span role="cell" className="cat-name">
              <i style={{ background: SWATCH[r.group] }} aria-hidden="true" />
              <span>
                <b>{r.group}</b>
                <small>{r.share.toFixed(0)}% · {rs(r.value)}</small>
              </span>
            </span>
            <span role="cell" className={tone(r.day)}>{rs(r.day, true)}</span>
            <span role="cell" className={tone(r.total)}>
              {rs(r.total, true)}
              <small>{r.totalPct === null ? '' : pct(r.totalPct)}</small>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
