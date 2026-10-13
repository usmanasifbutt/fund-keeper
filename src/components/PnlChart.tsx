import { useId, useMemo, useState } from 'react';
import type { Position } from '../lib/calc';
import type { Snapshot } from '../lib/store';
import { estimatePast, pnlHistory, shiftDate, type PnlPoint } from '../lib/insights';
import { dateLabel, rs, tone } from '../lib/format';

const RANGES: [string, number][] = [['1M', 31], ['3M', 92], ['6M', 183], ['1Y', 366], ['All', 100000]];
const W = 340;
const H = 170;
const M = { top: 12, right: 8, bottom: 22, left: 8 };

const dayNum = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86400000;

/** Total profit/loss over time: recorded days (solid) plus estimates from MUFAP's period returns (dashed). */
export default function PnlChart({ positions, snapshots }: { positions: Position[]; snapshots: Snapshot[] }) {
  const all = useMemo(() => pnlHistory(estimatePast(positions), snapshots), [positions, snapshots]);
  const [range, setRange] = useState('3M');
  const uid = useId().replace(/:/g, '');
  const [active, setActive] = useState<number | null>(null);

  const pts = useMemo(() => {
    if (all.length < 2) return all;
    const days = RANGES.find(r => r[0] === range)![1];
    const cutoff = shiftDate(all[all.length - 1].date, -days);
    const inRange = all.filter(p => p.date >= cutoff);
    return inRange.length >= 2 ? inRange : all.slice(-2);
  }, [all, range]);

  if (pts.length < 2) {
    return (
      <section className="panel">
        <h2>Profit/loss over time</h2>
        <p className="muted">Not enough history yet. The chart fills in as you open Keeper on new NAV days.</p>
      </section>
    );
  }

  const t0 = dayNum(pts[0].date);
  const t1 = dayNum(pts[pts.length - 1].date);
  const values = pts.map(p => p.pnl);
  let lo = Math.min(0, ...values);
  let hi = Math.max(0, ...values);
  const pad = (hi - lo || 1) * 0.08;
  lo -= pad; hi += pad;
  const x = (iso: string) => M.left + ((dayNum(iso) - t0) / (t1 - t0 || 1)) * (W - M.left - M.right);
  const y = (v: number) => M.top + ((hi - v) / (hi - lo)) * (H - M.top - M.bottom);
  const path = (list: PnlPoint[]) => list.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.pnl).toFixed(1)}`).join('');

  const firstActual = pts.findIndex(p => !p.estimated);
  const estPart = firstActual === -1 ? pts : pts.slice(0, firstActual + 1);
  const actPart = firstActual === -1 ? [] : pts.slice(firstActual);
  const shown = pts[active ?? pts.length - 1];
  const spansYears = pts[0].date.slice(0, 4) !== pts[pts.length - 1].date.slice(0, 4);
  const axisLabel = (iso: string) => (spansYears ? `${dateLabel(iso)} ’${iso.slice(2, 4)}` : dateLabel(iso));
  const midDate = shiftDate(pts[0].date, Math.round((t1 - t0) / 2));

  function onPointer(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(x(p.date) - px) < Math.abs(x(pts[best].date) - px)) best = i; });
    setActive(best);
  }

  return (
    <section className="panel chart" aria-labelledby="chart-h">
      <div className="chart-head">
        <h2 id="chart-h">Profit/loss over time</h2>
        <div className="seg" role="group" aria-label="Time range">
          {RANGES.map(([r]) => (
            <button key={r} type="button" aria-pressed={range === r} className={range === r ? 'on' : ''}
              onClick={() => { setRange(r); setActive(null); }}>{r}</button>
          ))}
        </div>
      </div>
      <div className="readout" aria-live="polite">
        <b className={tone(shown.pnl)}>{rs(shown.pnl, true)}</b>
        <span>{dateLabel(shown.date)} {shown.date.slice(0, 4)} · {shown.estimated ? 'estimated' : 'recorded'}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img"
        aria-label={`Total profit and loss from ${dateLabel(pts[0].date)} to ${dateLabel(pts[pts.length - 1].date)}, between ${rs(Math.min(...values), true)} and ${rs(Math.max(...values), true)}`}
        onPointerDown={onPointer} onPointerMove={e => { if (e.buttons || e.pointerType === 'mouse') onPointer(e); }}
        onPointerLeave={() => setActive(null)}>
        <line x1={M.left} x2={W - M.right} y1={y(0)} y2={y(0)} className="chart-zero" />
        <text x={W - M.right} y={y(0) - 4} textAnchor="end" className="chart-label">Rs 0</text>
        <defs>
          <clipPath id={`above-${uid}`}><rect x="0" y="0" width={W} height={y(0)} /></clipPath>
          <clipPath id={`below-${uid}`}><rect x="0" y={y(0)} width={W} height={H - y(0)} /></clipPath>
        </defs>
        {(['above', 'below'] as const).map(side => (
          <g key={side} clipPath={`url(#${side}-${uid})`} className={side === 'above' ? 'line-gain' : 'line-loss'}>
            {estPart.length > 1 && <path d={path(estPart)} className="chart-line chart-est" />}
            {actPart.length > 1 && <path d={path(actPart)} className="chart-line" />}
          </g>
        ))}
        {pts.map((p, i) => p.estimated && (
          <circle key={p.date} cx={x(p.date)} cy={y(p.pnl)} r={2.5} className="chart-est-dot" data-i={i} />
        ))}
        {active !== null && <line x1={x(shown.date)} x2={x(shown.date)} y1={M.top} y2={H - M.bottom} className="chart-cursor" />}
        <circle cx={x(shown.date)} cy={y(shown.pnl)} r={4} className={`chart-dot ${shown.pnl < 0 ? 'dot-loss' : 'dot-gain'}`} />
        <text x={M.left} y={H - 6} className="chart-label">{axisLabel(pts[0].date)}</text>
        {t1 - t0 >= 4 && <text x={x(midDate)} y={H - 6} textAnchor="middle" className="chart-label">{axisLabel(midDate)}</text>}
        <text x={W - M.right} y={H - 6} textAnchor="end" className="chart-label">{axisLabel(pts[pts.length - 1].date)}</text>
      </svg>
      {pts.some(p => p.estimated) && (
        <p className="chart-note">
          <span>Green is above Rs 0 (profit), red is below (loss).</span>
          <span><i className="legend-dash" aria-hidden="true" />Estimated: what your units in the funds you held on each date were worth, minus what you invested in them.</span>
          <span><i className="legend-solid" aria-hidden="true" />Recorded each day you open Keeper.</span>
          {positions.some(p => !p.holding.since) && (
            <span>Funds without a first-invested date are treated as held for the whole year. Add the date in Edit to start the estimate from when you bought.</span>
          )}
        </p>
      )}
    </section>
  );
}
