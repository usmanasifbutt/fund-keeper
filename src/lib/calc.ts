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
  /** Rupee change on `dayDate` */
  day: number | null;
  /** Percent change on `dayDate` */
  dayPct: number | null;
  /** The date `day` refers to: the portfolio's day if the fund has it, otherwise the fund's latest NAV date */
  dayDate: string;
  total: number;
  totalPct: number | null;
  /** True when the fund has no change for the portfolio's day, so it's left out of the day total */
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
  /** Funds left out of the day total because they have no change for that date */
  staleCount: number;
  /** The phone's date, YYYY-MM-DD */
  today: string;
  /** True when the day total is for today */
  dayIsToday: boolean;
  /** The single date the day total is for */
  dayDate: string;
}

/** A fund's NAV and one-day return (as a fraction) on a past date. */
export interface DayChange {
  nav: number;
  d: number;
}

/** Past daily changes saved on this phone, by fund ID then date, because MUFAP only lists the newest one. */
export type ChangeLog = Record<string, Record<string, DayChange>>;

/** Today's date on this device as YYYY-MM-DD (the phone's local time, i.e. Pakistan time for you). */
export function localToday(): string {
  return new Date().toLocaleDateString('en-CA');
}

/** A NAV entered by hand because MUFAP doesn't have that date yet. */
export interface ManualNav {
  date: string;
  nav: number;
}

/** Manual NAVs by fund ID, oldest first. */
export type ManualNavs = Record<string, ManualNav[]>;

/**
 * Lays manual NAVs over MUFAP's funds. MUFAP always wins: entries for its date or older are dropped.
 * Returns the funds to price with, the remaining entries, and each entry's change for showing past days.
 */
export function applyManualNavs(funds: Fund[], manual: ManualNavs) {
  const byId = new Map(funds.map(f => [f.id, f]));
  const kept: ManualNavs = {};
  const log: ChangeLog = {};
  for (const [id, entries] of Object.entries(manual)) {
    const fund = byId.get(id);
    if (!fund) continue;
    const newer = entries.filter(e => e.date > fund.date).sort((a, b) => a.date.localeCompare(b.date));
    if (!newer.length) continue;
    kept[id] = newer;
    let prevNav = fund.nav;
    let lastD = 0;
    log[id] = {};
    for (const e of newer) {
      lastD = e.nav / prevNav - 1;
      log[id][e.date] = { nav: e.nav, d: lastD };
      prevNav = e.nav;
    }
    const last = newer[newer.length - 1];
    byId.set(id, { ...fund, nav: last.nav, date: last.date, manual: true, manualD: lastD });
  }
  return { funds: byId, kept, log };
}

/** The last Monday–Friday before `iso` (YYYY-MM-DD). Public holidays aren't known. */
export function previousWorkingDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  do d.setUTCDate(d.getUTCDate() - 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

/** One-day return as a fraction. Annualized returns are converted with MUFAP's 365-day convention. */
export function dailyReturn(fund: Fund): number | null {
  if (fund.manualD !== undefined) return fund.manualD;
  const r = fund.returns.d1;
  if (r === null) return null;
  return fund.basis === 'annualized' ? r / 100 / 365 : r / 100;
}

export function computePortfolio(
  holdings: Holding[],
  fundsById: Map<string, Fund>,
  today = localToday(),
  log: ChangeLog = {},
): Portfolio {
  const change = (units: number, c: DayChange) => {
    const before = c.nav / (1 + c.d);
    return { day: units * (c.nav - before), base: units * before, dayPct: c.d * 100 };
  };
  const latestChange = (fund: Fund): DayChange | null => {
    const d = dailyReturn(fund);
    return d === null ? null : { nav: fund.nav, d };
  };

  const funds = holdings.map(h => fundsById.get(h.fundId) ?? null);
  const dates = [...new Set(funds.map(f => f?.date).filter((d): d is string => !!d))].sort();
  const latest = dates[dates.length - 1] ?? '';

  // A fund's change on one date: its newest figure if that's the date, otherwise what this phone saved.
  const changeOn = (fund: Fund | null, date: string): DayChange | null => {
    if (!fund) return null;
    if (fund.date === date) return latestChange(fund);
    return log[fund.id]?.[date] ?? null;
  };

  // The day total is always for one date: today if any fund has it, otherwise the last working day,
  // otherwise (a holiday, or nothing saved for that day) the newest date any fund has.
  const dayIsToday = funds.some(f => f && f.date >= today);
  let dayDate = dayIsToday ? today : previousWorkingDay(today);
  if (!dayIsToday && !funds.some(f => changeOn(f, dayDate))) dayDate = latest;

  let day = 0;
  let base = 0;
  const positions = holdings.map((holding, i): Position => {
    const fund = funds[i];
    const value = fund ? holding.units * fund.nav : 0;
    const counted = fund && dayIsToday && fund.date >= today ? latestChange(fund) : changeOn(fund, dayDate);
    const shown = counted ?? (fund ? latestChange(fund) : null);
    const c = shown ? change(holding.units, shown) : null;
    if (counted && c) {
      day += c.day;
      base += c.base;
    }
    return {
      holding,
      fund,
      value,
      day: c ? c.day : null,
      dayPct: c ? c.dayPct : null,
      dayDate: counted ? dayDate : fund?.date ?? '',
      total: value - holding.invested,
      totalPct: holding.invested > 0 ? (value / holding.invested - 1) * 100 : null,
      stale: !counted,
    };
  });
  const value = sum(positions.map(p => p.value));
  const invested = sum(positions.map(p => p.holding.invested));
  return {
    positions,
    value,
    invested,
    day,
    dayPct: base > 0 ? (day / base) * 100 : 0,
    total: value - invested,
    totalPct: invested > 0 ? (value / invested - 1) * 100 : 0,
    date: latest,
    mixedDates: dates.length > 1,
    staleCount: positions.filter(p => p.stale).length,
    today,
    dayIsToday,
    dayDate,
  };
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
