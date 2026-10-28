import { describe, expect, it } from 'vitest';
import { computePortfolio, dailyReturn } from './calc';
import type { Fund } from './mufap';

const fund = (p: Partial<Fund> & Pick<Fund, 'id' | 'nav' | 'basis' | 'date'>, d1: number | null): Fund => ({
  name: p.id, sector: 'Open-End Funds', category: '', ...p,
  returns: { d1, mtd: null, ytd: null, d15: null, d30: null, d90: null, d180: null, d270: null, d365: null },
});

const meezanCash = fund({ id: 'MCF', nav: 53.0895, basis: 'annualized', date: '2026-10-13' }, 11.06);
const alhamra = fund({ id: 'AISF', nav: 28.61, basis: 'absolute', date: '2026-10-12' }, -1.04);
const funds = new Map([meezanCash, alhamra].map(f => [f.id, f]));

describe('dailyReturn', () => {
  it('converts an annualized 1-day return with a 365-day year', () => {
    // Meezan Cash moved 53.0734 → 53.0895, i.e. 0.0303%, matching 11.06% / 365.
    expect(dailyReturn(meezanCash)! * 100).toBeCloseTo(53.0895 / 53.0734 * 100 - 100, 4);
  });
  it('uses an absolute 1-day return as is', () => {
    expect(dailyReturn(alhamra)).toBeCloseTo(-0.0104, 10);
  });
});

describe('computePortfolio', () => {
  const p = computePortfolio(
    [
      { fundId: 'AISF', name: 'Alhamra Islamic Stock Fund', units: 3500, invested: 95000 },
      { fundId: 'MCF', name: 'Meezan Cash Fund', units: 1900, invested: 100000 },
    ],
    funds,
  );

  it('values each holding at its NAV', () => {
    expect(p.positions[0].value).toBeCloseTo(100135, 6);
    expect(p.positions[1].value).toBeCloseTo(100870.05, 2);
  });

  it("works out each fund's day change from its return", () => {
    // Previous NAV = 28.61 / (1 - 0.0104) = 28.9107…; change = 3500 × (28.61 − 28.9107)
    expect(p.positions[0].day).toBeCloseTo(-1052.38, 1);
    expect(p.positions[1].day).toBeCloseTo(30.56, 1);
  });

  it('adds up totals and flags mixed NAV dates', () => {
    expect(p.value).toBeCloseTo(201005.05, 2);
    expect(p.invested).toBe(195000);
    expect(p.total).toBeCloseTo(6005.05, 2);
    expect(p.date).toBe('2026-10-13');
    expect(p.mixedDates).toBe(true);
  });

  it('keeps a holding whose fund is missing, with zero value', () => {
    const q = computePortfolio([{ fundId: 'GONE', name: 'Closed Fund', units: 10, invested: 500 }], funds);
    expect(q.positions[0].fund).toBeNull();
    expect(q.value).toBe(0);
    expect(q.positions[0].day).toBeNull();
  });
});

describe("today's total", () => {
  const eq = (date: string) => fund({ id: 'AISF', nav: 28.89, basis: 'absolute', date }, 0.59);
  const mm = (date: string) => fund({ id: 'MCF', nav: 53.177, basis: 'annualized', date }, 10.95);
  const holdings = [
    { fundId: 'AISF', name: 'Alhamra', units: 1000, invested: 28000 },
    { fundId: 'MCF', name: 'Meezan Cash', units: 1000, invested: 53000 },
  ];
  const run = (a: string, b: string, today: string) =>
    computePortfolio(holdings, new Map([eq(a), mm(b)].map(f => [f.id, f])), today);

  it('counts both funds when both have published today', () => {
    const p = run('2026-10-28', '2026-10-28', '2026-10-28');
    expect(p.staleCount).toBe(0);
    expect(p.day).toBeCloseTo(p.positions[0].day! + p.positions[1].day!, 10);
  });

  it('counts only the fund that has published today', () => {
    const p = run('2026-10-27', '2026-10-28', '2026-10-28');
    expect(p.positions[0].stale).toBe(true);
    expect(p.staleCount).toBe(1);
    expect(p.day).toBeCloseTo(p.positions[1].day!, 10);
    expect(p.value).toBeCloseTo(28890 + 53177, 6); // value still includes both
  });

  it("shows 0 when no fund has published today, not yesterday's change", () => {
    const p = run('2026-10-27', '2026-10-27', '2026-10-28');
    expect(p.staleCount).toBe(2);
    expect(p.day).toBe(0);
    expect(p.dayPct).toBe(0);
    expect(p.today).toBe('2026-10-28');
  });
});
