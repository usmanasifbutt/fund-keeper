import type { Position } from '../lib/calc';
import { dateLabel, pct, rs, tone, units } from '../lib/format';

export default function FundCard({ position: p, latestDate }: { position: Position; latestDate: string }) {
  const f = p.fund;
  if (!f) {
    return (
      <article className="card card-missing">
        <h3>{p.holding.name || 'Unknown fund'}</h3>
        <p className="muted">This fund isn't in MUFAP's list today, so it can't be priced. If it was closed or renamed, remove it in Edit holdings.</p>
      </article>
    );
  }
  const pa = f.basis === 'annualized' ? ' p.a.' : '';
  const stale = latestDate && f.date < latestDate;
  return (
    <article className="card">
      <header className="card-head">
        <h3>{f.name}</h3>
        <div className="card-meta">
          {f.category} · NAV {f.nav.toFixed(4)}
          <span className={stale ? 'chip chip-warn' : 'chip'}>{dateLabel(f.date)}</span>
        </div>
        {p.holding.since && <div className="since">Holding since {dateLabel(p.holding.since)} {p.holding.since.slice(0, 4)}</div>}
      </header>
      <dl className="card-grid">
        {p.stale ? (
          <div><dt>Today</dt><dd className="muted">No update<small>Last: {p.day === null ? '–' : rs(p.day, true)} on {dateLabel(f.date)}</small></dd></div>
        ) : (
          <div><dt>Today</dt><dd className={tone(p.day)}>{p.day === null ? '–' : rs(p.day, true)}<small>{pct(p.dayPct, f.basis === 'annualized' ? 3 : 2)}</small></dd></div>
        )}
        <div><dt>Value</dt><dd>{rs(p.value)}<small>{units(p.holding.units)} units</small></dd></div>
        <div><dt>Total P/L</dt><dd className={tone(p.total)}>{rs(p.total, true)}<small>{p.holding.invested > 0 ? pct(p.totalPct) : 'Add amount invested'}</small></dd></div>
      </dl>
      <div className="returns" aria-label="Fund returns from MUFAP">
        <span>MTD <b className={tone(f.returns.mtd)}>{pct(f.returns.mtd)}{pa}</b></span>
        <span>YTD <b className={tone(f.returns.ytd)}>{pct(f.returns.ytd)}{pa}</b></span>
        <span>1Y <b className={tone(f.returns.d365)}>{pct(f.returns.d365)}{pa}</b></span>
      </div>
    </article>
  );
}
