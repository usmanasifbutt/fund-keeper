import type { Portfolio } from '../lib/calc';
import { dateLabel, pct, rs, tone } from '../lib/format';

export default function Summary({ portfolio: p }: { portfolio: Portfolio }) {
  const current = p.positions.filter(x => !x.stale);
  const stale = p.positions.filter(x => x.stale);
  const up = current.filter(x => (x.day ?? 0) > 0.5).length;
  const down = current.filter(x => (x.day ?? 0) < -0.5).length;
  const flat = current.length - up - down;
  return (
    <section className="summary" aria-label="Portfolio summary">
      <div className="summary-label">
        Today's profit/loss · {dateLabel(p.today)}
        {p.positions.length > 1 ? ` · ${current.length} of ${p.positions.length} funds updated` : ''}
      </div>
      <div className={`summary-day ${tone(p.day)}`}>
        {rs(p.day, true)} <span>{pct(p.dayPct)}</span>
      </div>
      {current.length > 1 && (
        <div className="summary-split">
          <span className="gain">{up} up</span> · <span className="loss">{down} down</span>
          {flat > 0 && <> · {flat} flat</>}
        </div>
      )}
      {stale.length > 0 && (
        <p className="summary-stale">
          {current.length === 0 ? `No fund has published its ${dateLabel(p.today)} NAV yet. ` : ''}
          Waiting for today's NAV: {stale.map(x => x.fund ? `${x.fund.name} (last ${dateLabel(x.fund.date)})` : x.holding.name).join(', ')}.
        </p>
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
