/**
 * Reads MUFAP's daily "Performance Summary" table, which lists every Pakistani mutual fund with its
 * latest NAV and returns. MUFAP serves it with `Access-Control-Allow-Origin: *`, so the app fetches it directly.
 */

export const MUFAP_URL = 'https://www.mufap.com.pk/Industry/IndustryStatDaily?tab=1';

/** Money market and income funds report annualized returns; equity funds report absolute returns. */
export type ReturnBasis = 'annualized' | 'absolute';

export interface FundReturns {
  d1: number | null;
  mtd: number | null;
  ytd: number | null;
  d15: number | null;
  d30: number | null;
  d90: number | null;
  d180: number | null;
  d270: number | null;
  d365: number | null;
}

export interface Fund {
  id: string;
  name: string;
  sector: string;
  category: string;
  basis: ReturnBasis;
  /** NAV validity date, YYYY-MM-DD */
  date: string;
  nav: number;
  /** Percentages as MUFAP shows them, e.g. -1.04 means -1.04% */
  returns: FundReturns;
}

export interface Market {
  funds: Fund[];
  fetchedAt: string;
}

export async function fetchMarket(signal?: AbortSignal): Promise<Market> {
  const res = await fetch(MUFAP_URL, { signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`MUFAP returned an error (HTTP ${res.status}). Try again in a few minutes.`);
  return { funds: parsePerformance(await res.text()), fetchedAt: new Date().toISOString() };
}

// Column order of the Performance Summary table.
const COL = { sector: 0, category: 1, name: 2, date: 5, nav: 6, ytd: 7, mtd: 8, d1: 9, d15: 10, d30: 11, d90: 12, d180: 13, d270: 14, d365: 15 };

export function parsePerformance(html: string): Fund[] {
  const start = html.indexOf('id="table_id"');
  if (start < 0) throw new Error("MUFAP's page layout changed: the fund table wasn't found.");
  const end = html.indexOf('</table>', start);
  const rows = html.slice(start, end < 0 ? undefined : end).split(/<tr\b/i).slice(1);

  const seen = new Set<string>();
  const funds: Fund[] = [];
  for (const row of rows) {
    const id = row.match(/FundID=(\d+)/i)?.[1];
    if (!id || seen.has(id)) continue;
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => cleanText(m[1]));
    if (cells.length <= COL.d365) continue;
    const nav = num(cells[COL.nav]);
    const date = isoDate(cells[COL.date]);
    if (nav === null || nav <= 0 || !date) continue;
    seen.add(id);
    const rawCategory = cells[COL.category];
    funds.push({
      id,
      name: cells[COL.name],
      sector: cells[COL.sector],
      category: rawCategory.replace(/\s*\((annualized|absolute) return\s*\)\s*$/i, '').trim(),
      basis: /annualized/i.test(rawCategory) ? 'annualized' : 'absolute',
      date,
      nav,
      returns: {
        d1: num(cells[COL.d1]),
        mtd: num(cells[COL.mtd]),
        ytd: num(cells[COL.ytd]),
        d15: num(cells[COL.d15]),
        d30: num(cells[COL.d30]),
        d90: num(cells[COL.d90]),
        d180: num(cells[COL.d180]),
        d270: num(cells[COL.d270]),
        d365: num(cells[COL.d365]),
      },
    });
  }
  if (!funds.length) throw new Error("MUFAP's page layout changed: no funds were found.");

  // Pension schemes list each sub-fund under the same name; add the sub-fund type so names are unique.
  const count = new Map<string, number>();
  funds.forEach(f => count.set(f.name, (count.get(f.name) ?? 0) + 1));
  funds.forEach(f => {
    if ((count.get(f.name) ?? 0) > 1) f.name += ` (${f.category.replace(/^VPS-/, '')})`;
  });
  return funds.sort((a, b) => a.name.localeCompare(b.name));
}

function cleanText(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "1.04" → 1.04, "(1.04)" → -1.04, "N/A" or "" → null */
export function num(s: string): number | null {
  const t = s.replace(/,/g, '').trim();
  const neg = /^\(.*\)$/.test(t);
  const n = parseFloat(t.replace(/[()%]/g, ''));
  if (!isFinite(n)) return null;
  return neg ? -n : n;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** "Oct 12, 2026" → "2026-10-12" */
export function isoDate(s: string): string {
  const m = s.match(/([A-Za-z]{3})\w*\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return '';
  const mon = MONTHS.indexOf(m[1].toLowerCase()) + 1;
  if (!mon) return '';
  return `${m[3]}-${String(mon).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}
