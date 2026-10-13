import type { Portfolio } from '../lib/calc';
import { dateLabel, pct, rs, tone } from '../lib/format';

export default function Summary({ portfolio: p }: { portfolio: Portfolio }) {
  const up = p.positions.filter(x => (x.day ?? 0) > 0.5).length;
  const down = p.positions.filter(x => (x.day ?? 0) < -0.5).length;
  return (
    <section className="summary" aria-label="Portfolio summary">
      <div className="summary-label">
        Today's profit/loss · all {p.positions.length} fund{p.positions.length === 1 ? '' : 's'}
        {!p.mixedDates && p.date ? ` · NAV ${dateLabel(p.date)}` : ''}
      </div>
      <div className={`summary-day ${tone(p.day)}`}>
        {rs(p.day, true)} <span>{pct(p.dayPct)}</span>
      </div>
      {p.positions.length > 1 && (
        <div className="summary-split">
          <span className="gain">{up} up</span> · <span className="loss">{down} down</span>
          {p.positions.length - up - down > 0 && <> · {p.positions.length - up - down} flat</>}
        </div>
      )}
      <dl className="kpis">
        <div><dt>Value</dt><dd>{rs(p.value)}</dd></div>
        <div><dt>Invested</dt><dd>{rs(p.invested)}</dd></div>
        <div>
          <dt>Total P/L</dt>
          <dd className={tone(p.total)}>{rs(p.total, true)} <small>{p.invested > 0 ? pct(p.totalPct) : ''}</small></dd>
        </div>
      </dl>
    </section>
  );
}
