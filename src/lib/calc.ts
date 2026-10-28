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
  /** True when the fund hasn't published a NAV for today yet, so its day change isn't today's */
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
  /** Funds left out of today's total because they haven't published today's NAV */
  staleCount: number;
  /** The date "today" refers to, YYYY-MM-DD */
  today: string;
}

/** Today's date on this device as YYYY-MM-DD (the phone's local time, i.e. Pakistan time for you). */
export function localToday(): string {
  return new Date().toLocaleDateString('en-CA');
}

/** One-day return as a fraction. Annualized returns are converted with MUFAP's 365-day convention. */
export function dailyReturn(fund: Fund): number | null {
  const r = fund.returns.d1;
  if (r === null) return null;
  return fund.basis === 'annualized' ? r / 100 / 365 : r / 100;
}

export function computePortfolio(holdings: Holding[], fundsById: Map<string, Fund>, today = localToday()): Portfolio {
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
    p.stale = !p.fund || p.fund.date < today;
  }
  // Today's change counts only funds that have published today's NAV; none yet means Rs 0.
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
    today,
  };
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
