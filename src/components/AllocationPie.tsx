import { useState } from 'react';
import type { Portfolio } from '../lib/calc';
import { rs } from '../lib/format';

const COLORS = ['--f1', '--f2', '--f3', '--f4', '--f5', '--f6', '--f7', '--f8'].map(v => `var(${v})`);
const R = 52;
const C = 2 * Math.PI * R;

type Basis = 'invested' | 'value';

/** Donut chart of each fund's share of the money invested (or of current value). */
export default function AllocationPie({ portfolio }: { portfolio: Portfolio }) {
  const [basis, setBasis] = useState<Basis>('invested');
  const [active, setActive] = useState<number | null>(null);

  const slices = portfolio.positions
    .map((p, i) => ({
      id: p.holding.fundId,
      name: p.fund?.name ?? p.holding.name,
      amount: basis === 'invested' ? p.holding.invested : p.value,
      color: COLORS[i % COLORS.length],
    }))
    .filter(s => s.amount > 0);
  const total = slices.reduce((s, x) => s + x.amount, 0);

  if (!total) {
    return (
      <section className="panel">
        <h2>Share by fund</h2>
        <p className="muted">Add the amount invested for each fund (Edit) to see how your money is split.</p>
      </section>
    );
  }

  let offset = 0;
  const arcs = slices.map(s => {
    const len = (s.amount / total) * C;
    const arc = { ...s, share: (s.amount / total) * 100, len, offset };
    offset += len;
    return arc;
  });
  const focus = active === null ? null : arcs[active];

  return (
    <section className="panel" aria-labelledby="pie-h">
      <div className="chart-head">
        <h2 id="pie-h">Share by fund</h2>
        <div className="seg" role="group" aria-label="Measure">
          <button type="button" aria-pressed={basis === 'invested'} className={basis === 'invested' ? 'on' : ''} onClick={() => setBasis('invested')}>Invested</button>
          <button type="button" aria-pressed={basis === 'value'} className={basis === 'value' ? 'on' : ''} onClick={() => setBasis('value')}>Value</button>
        </div>
      </div>
      <div className="pie-wrap">
        <svg viewBox="0 0 140 140" className="pie" role="img"
          aria-label={arcs.map(a => `${a.name} ${a.share.toFixed(1)}%`).join(', ')}>
          <circle cx="70" cy="70" r={R} className="pie-track" />
          {arcs.map((a, i) => (
            <circle key={a.id} cx="70" cy="70" r={R} fill="none" stroke={a.color}
              strokeWidth={active === i ? 22 : 18}
              strokeDasharray={`${Math.max(a.len - (arcs.length > 1 ? 1.5 : 0), 0.1)} ${C}`}
              strokeDashoffset={-a.offset}
              transform="rotate(-90 70 70)"
              className="pie-slice"
              onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)}
              onClick={() => setActive(active === i ? null : i)} />
          ))}
          <text x="70" y="66" textAnchor="middle" className="pie-big">{focus ? `${focus.share.toFixed(1)}%` : rs(total).replace('Rs ', '')}</text>
          <text x="70" y="82" textAnchor="middle" className="pie-small">{focus ? 'of total' : basis === 'invested' ? 'Rs invested' : 'Rs value'}</text>
        </svg>
        <ul className="pie-legend">
          {arcs.map((a, i) => (
            <li key={a.id} className={active === i ? 'on' : ''}
              onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)}>
              <i style={{ background: a.color }} aria-hidden="true" />
              <span className="pie-name">{a.name}</span>
              <b>{a.share.toFixed(1)}%</b>
              <small>{rs(a.amount)}</small>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
