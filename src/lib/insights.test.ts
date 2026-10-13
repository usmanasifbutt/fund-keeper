import { describe, expect, it } from 'vitest';
import { computePortfolio } from './calc';
import { byCategory, categoryGroup, estimatePast, pnlHistory, shiftDate } from './insights';
import type { Fund, FundReturns } from './mufap';

const none: FundReturns = { d1: null, mtd: null, ytd: null, d15: null, d30: null, d90: null, d180: null, d270: null, d365: null };
const mk = (id: string, category: string, basis: Fund['basis'], nav: number, r: Partial<FundReturns>): Fund =>
  ({ id, name: id, sector: '', category, basis, date: '2026-10-13', nav, returns: { ...none, ...r } });

const equity = mk('EQ', 'Shariah Compliant Equity', 'absolute', 30, { d1: 1, d30: 10, d365: 50 });
const cash = mk('MM', 'Shariah Compliant Money Market', 'annualized', 50, { d1: 10, d30: 10, d365: 10 });
const funds = new Map([equity, cash].map(f => [f.id, f]));
const portfolio = computePortfolio(
  [
    { fundId: 'EQ', name: 'EQ', units: 100, invested: 2500 }, // value 3000
    { fundId: 'MM', name: 'MM', units: 20, invested: 900 },  // value 1000
  ],
  funds,
);

describe('categoryGroup', () => {
  it.each([
    ['Shariah Compliant Equity', 'Equity'],
    ['VPS-Shariah Compliant Equity', 'Equity'],
    ['Index Tracker', 'Equity'],
    ['Shariah Compliant Money Market', 'Money Market'],
    ['VPS-Money Market', 'Money Market'],
    ['Shariah Compliant Income', 'Income'],
    ['VPS-Debt', 'Income'],
    ['Shariah Compliant Asset Allocation', 'Asset Allocation'],
    ['Shariah Compliant Fixed Rate / Return', 'Income'],
    ['Something New', 'Other'],
  ])('%s → %s', (cat, group) => expect(categoryGroup(cat)).toBe(group));
});

describe('byCategory', () => {
  it('totals value, P/L and share per group, largest first', () => {
    const rows = byCategory(portfolio);
    expect(rows.map(r => r.group)).toEqual(['Equity', 'Money Market']);
    expect(rows[0]).toMatchObject({ value: 3000, invested: 2500, total: 500, share: 75 });
    expect(rows[1]).toMatchObject({ value: 1000, invested: 900, total: 100, share: 25 });
  });
});

describe('estimatePast', () => {
  const pts = estimatePast(portfolio.positions);

  it('dates each point back from the latest NAV date', () => {
    expect(pts.map(p => p.date)).toEqual(['2025-10-13', '2026-09-13', '2026-10-12']);
    expect(pts.every(p => p.estimated)).toBe(true);
  });

  it('undoes absolute and annualized returns', () => {
    // 365 days ago: equity 100 × 30/1.5 = 2000, cash 20 × 50/1.10 = 909.09 → P/L = 2909.09 − 3400
    expect(pts[0].pnl).toBeCloseTo(2000 + 20 * 50 / 1.1 - 3400, 6);
    // 30 days ago: equity 100 × 30/1.10, cash 20 × 50/(1 + 0.10 × 30/365)
    expect(pts[1].pnl).toBeCloseTo(100 * 30 / 1.1 + 20 * 50 / (1 + 0.1 * 30 / 365) - 3400, 6);
  });
});

describe('estimatePast with first-invested dates', () => {
  const withSince = (eqSince?: string, mmSince?: string) => computePortfolio(
    [
      { fundId: 'EQ', name: 'EQ', units: 100, invested: 2500, ...(eqSince ? { since: eqSince } : {}) },
      { fundId: 'MM', name: 'MM', units: 20, invested: 900, ...(mmSince ? { since: mmSince } : {}) },
    ],
    funds,
  ).positions;

  it('leaves out a fund before its first-invested date, along with its cost', () => {
    // Equity bought on 1 Oct: the 30-day point (13 Sep) only has the money market fund.
    const pts = estimatePast(withSince('2026-10-01'));
    const sep = pts.find(p => p.date === '2026-09-13')!;
    expect(sep.pnl).toBeCloseTo(20 * 50 / (1 + 0.1 * 30 / 365) - 900, 6);
  });

  it('starts at zero on the earliest date when every fund has one, and drops earlier points', () => {
    const pts = estimatePast(withSince('2026-10-01', '2026-09-20'));
    expect(pts[0]).toEqual({ date: '2026-09-20', pnl: 0, estimated: true });
    expect(pts.some(p => p.date < '2026-09-20')).toBe(false);
    expect(pts.map(p => p.date)).toEqual(['2026-09-20', '2026-10-12']);
  });

  it('treats funds without a date as held all along', () => {
    expect(estimatePast(withSince(undefined, '2026-09-20')).map(p => p.date)).toEqual(['2025-10-13', '2026-09-13', '2026-10-12']);
  });
});

describe('pnlHistory', () => {
  it('keeps estimates only before the first recorded day', () => {
    const est = [
      { date: '2026-09-13', pnl: 1, estimated: true },
      { date: '2026-10-12', pnl: 2, estimated: true },
    ];
    const merged = pnlHistory(est, [{ date: '2026-10-10', value: 4000, invested: 3400 }]);
    expect(merged).toEqual([
      { date: '2026-09-13', pnl: 1, estimated: true },
      { date: '2026-10-10', pnl: 600, estimated: false },
    ]);
  });
});

it('shifts dates across month and year ends', () => {
  expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
  expect(shiftDate('2026-01-05', -365)).toBe('2025-01-05');
});
