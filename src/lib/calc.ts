import type { Fund } from './mufap';

export interface Holding {
  fundId: string;
  /** Fund name when saved, shown if the fund disappears from MUFAP's list */
  name: string;
  units: number;
  /** Total rupees paid into the fund, including loads. Reinvested dividends are not added here. */
  invested: number;
  /** Optional date of the first purchase, YYYY-MM-DD. Limits the estimated history to when you held the fund. */
  since?: string;
}

export interface Position {
  holding: Holding;
  fund: Fund | null;
  value: number;
  /** Rupee change on the fund's latest NAV day */
  day: number | null;
  /** Percent change on the fund's latest NAV day */
  dayPct: number | null;
  total: number;
  totalPct: number | null;
  /** True when the fund's NAV is 2+ working days behind the newest NAV, so its day change is old news */
  stale: boolean;
}

export interface Portfolio {
  positions: Position[];
  value: number;
  invested: number;
  day: number;
  dayPct: number;
  total: number;
  totalPct: number;
  /** Latest NAV date across held funds */
  date: string;
  /** True when held funds have different NAV dates */
  mixedDates: boolean;
  /** Funds left out of today's total because their NAV hasn't been updated */
  staleCount: number;
}

/** A fund this many working days behind the newest NAV is treated as not updated. */
export const STALE_WORKING_DAYS = 2;

/** Working days (Mon–Fri) after `from`, up to and including `to`. Both are YYYY-MM-DD. */
export function workingDaysAfter(from: string, to: string): number {
  let n = 0;
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) n += 1;
  }
  return n;
}

/** One-day return as a fraction. Annualized returns are converted with MUFAP's 365-day convention. */
export function dailyReturn(fund: Fund): number | null {
  const r = fund.returns.d1;
  if (r === null) return null;
  return fund.basis === 'annualized' ? r / 100 / 365 : r / 100;
}

export function computePortfolio(holdings: Holding[], fundsById: Map<string, Fund>): Portfolio {
  const positions = holdings.map((holding): Position => {
    const fund = fundsById.get(holding.fundId) ?? null;
    const value = fund ? holding.units * fund.nav : 0;
    const d = fund ? dailyReturn(fund) : null;
    const day = fund && d !== null ? holding.units * (fund.nav - fund.nav / (1 + d)) : null;
    return {
      holding,
      fund,
      value,
      day,
      dayPct: d === null ? null : d * 100,
      total: value - holding.invested,
      totalPct: holding.invested > 0 ? (value / holding.invested - 1) * 100 : null,
      stale: false,
    };
  });
  const dates = [...new Set(positions.map(p => p.fund?.date).filter((d): d is string => !!d))].sort();
  const latest = dates[dates.length - 1] ?? '';
  for (const p of positions) {
    p.stale = !!p.fund && workingDaysAfter(p.fund.date, latest) >= STALE_WORKING_DAYS;
  }
  // Today's change counts only funds that have published a recent NAV.
  const current = positions.filter(p => !p.stale);
  const value = sum(positions.map(p => p.value));
  const invested = sum(positions.map(p => p.holding.invested));
  const day = sum(current.map(p => p.day ?? 0));
  const prev = sum(current.map(p => p.value)) - day;
  return {
    positions,
    value,
    invested,
    day,
    dayPct: prev > 0 ? (day / prev) * 100 : 0,
    total: value - invested,
    totalPct: invested > 0 ? (value / invested - 1) * 100 : 0,
    date: latest,
    mixedDates: dates.length > 1,
    staleCount: positions.length - current.length,
  };
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
