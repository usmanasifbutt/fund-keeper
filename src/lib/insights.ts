import type { Portfolio, Position } from './calc';
import type { FundReturns } from './mufap';
import type { Snapshot } from './store';

// ---------- By category ----------

export const CATEGORY_GROUPS = ['Equity', 'Money Market', 'Income', 'Asset Allocation', 'Other'] as const;
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];

/** Folds MUFAP's ~40 categories (Islamic, conventional, pension sub-funds) into a few groups. */
export function categoryGroup(category: string): CategoryGroup {
  const c = category.toLowerCase();
  if (c.includes('money market')) return 'Money Market';
  if (/equity|index tracker|exchange traded/.test(c)) return 'Equity';
  if (/income|debt|sovereign|fixed rate|fixed return|gilt|capital protected/.test(c)) return 'Income';
  if (/asset allocation|balanced|fund of funds|commodit/.test(c)) return 'Asset Allocation';
  return 'Other';
}

export interface CategoryRow {
  group: CategoryGroup;
  funds: number;
  value: number;
  invested: number;
  day: number;
  total: number;
  totalPct: number | null;
  /** Share of portfolio value, 0–100 */
  share: number;
}

export function byCategory(p: Portfolio): CategoryRow[] {
  const rows = new Map<CategoryGroup, CategoryRow>();
  for (const pos of p.positions) {
    const group = pos.fund ? categoryGroup(pos.fund.category) : 'Other';
    const row = rows.get(group) ?? { group, funds: 0, value: 0, invested: 0, day: 0, total: 0, totalPct: null, share: 0 };
    row.funds += 1;
    row.value += pos.value;
    row.invested += pos.holding.invested;
    if (!pos.stale) row.day += pos.day ?? 0; // funds without a recent NAV don't count towards today
    rows.set(group, row);
  }
  return [...rows.values()]
    .map(r => ({
      ...r,
      total: r.value - r.invested,
      totalPct: r.invested > 0 ? (r.value / r.invested - 1) * 100 : null,
      share: p.value > 0 ? (r.value / p.value) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

// ---------- Profit/loss over time ----------

export interface PnlPoint {
  date: string;
  pnl: number;
  /** True for points worked out from MUFAP's period returns rather than recorded by the app */
  estimated: boolean;
}

const HORIZONS: [number, keyof FundReturns][] = [
  [365, 'd365'], [270, 'd270'], [180, 'd180'], [90, 'd90'], [30, 'd30'], [15, 'd15'], [1, 'd1'],
];

/**
 * Estimates total P/L at past dates from each fund's 1–365 day returns, using today's units and cost.
 * A fund with a first-invested date counts only from that date; a fund without one is treated as held all along.
 * Skips a date if a fund held then has no return for it (e.g. a young fund).
 */
export function estimatePast(positions: Position[]): PnlPoint[] {
  if (!positions.length || positions.some(p => !p.fund)) return [];
  const latest = positions.reduce((d, p) => (p.fund!.date > d ? p.fund!.date : d), '');
  const out: PnlPoint[] = [];
  for (const [days, key] of HORIZONS) {
    const date = shiftDate(latest, -days);
    let value = 0;
    let invested = 0;
    let held = 0;
    let ok = true;
    for (const p of positions) {
      if (p.holding.since && p.holding.since > date) continue; // not bought yet
      const f = p.fund!;
      const r = f.returns[key];
      if (r === null || r === undefined) { ok = false; break; }
      const growth = f.basis === 'annualized' ? (r / 100) * (days / 365) : r / 100;
      value += p.holding.units * (f.nav / (1 + growth));
      invested += p.holding.invested;
      held += 1;
    }
    if (ok && held > 0) out.push({ date, pnl: value - invested, estimated: true });
  }
  // When every fund has a first-invested date, start the line at zero on the earliest one.
  if (positions.every(p => p.holding.since)) {
    const first = positions.map(p => p.holding.since!).sort()[0];
    if (first < latest && first >= shiftDate(latest, -365) && !out.some(p => p.date === first)) {
      out.push({ date: first, pnl: 0, estimated: true });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Recorded snapshots win; estimates fill in only before the first recorded day. */
export function pnlHistory(estimated: PnlPoint[], snapshots: Snapshot[]): PnlPoint[] {
  const actual = snapshots.map(s => ({ date: s.date, pnl: s.value - s.invested, estimated: false }));
  const first = actual[0]?.date ?? '9999-12-31';
  return [...estimated.filter(e => e.date < first), ...actual].sort((a, b) => a.date.localeCompare(b.date));
}

export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
