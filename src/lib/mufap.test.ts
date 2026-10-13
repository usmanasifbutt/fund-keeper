import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isoDate, num, parsePerformance } from './mufap';

const html = readFileSync(new URL('./__fixtures__/performance-2026-10-13.html', import.meta.url), 'utf8');

describe('parsePerformance', () => {
  const funds = parsePerformance(html);
  const byName = (n: string) => funds.find(f => f.name === n)!;

  it('reads a money market fund with annualized returns', () => {
    const f = byName('Meezan Cash Fund');
    expect(f).toMatchObject({ id: '12820', basis: 'annualized', date: '2026-10-13', nav: 53.0895, category: 'Shariah Compliant Money Market' });
    expect(f.returns).toEqual({ d1: 11.06, mtd: 9.78, ytd: 10, d15: 9.83, d30: 9.96, d90: 9.99, d180: 9.85, d270: 9.72, d365: 9.8 });
  });

  it('reads an equity fund with negative returns in brackets', () => {
    const f = byName('Alhamra Islamic Stock Fund');
    expect(f).toMatchObject({ id: '12733', basis: 'absolute', date: '2026-10-12', nav: 28.61 });
    expect(f.returns.d1).toBe(-1.04);
    expect(f.returns.ytd).toBe(-9.58);
  });

  it('makes pension sub-fund names unique', () => {
    const names = funds.filter(f => f.name.startsWith('ABL Islamic Pension Fund')).map(f => f.name);
    expect(names.length).toBe(3);
    expect(new Set(names).size).toBe(3);
    expect(names).toContain('ABL Islamic Pension Fund (Shariah Compliant Equity)');
  });

  it('fails clearly when the table is missing', () => {
    expect(() => parsePerformance('<html></html>')).toThrow(/layout changed/);
  });
});

describe('helpers', () => {
  it('parses numbers', () => {
    expect(num('(2.62)')).toBe(-2.62);
    expect(num('1,234.5')).toBe(1234.5);
    expect(num('N/A')).toBeNull();
    expect(num('')).toBeNull();
  });
  it('parses dates', () => {
    expect(isoDate('Oct 12, 2026')).toBe('2026-10-12');
    expect(isoDate('Sep 1, 2026')).toBe('2026-09-01');
    expect(isoDate('-')).toBe('');
  });
});
