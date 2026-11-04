import { dailyReturn, type ChangeLog, type Holding, type ManualNavs } from './calc';
import type { Fund, Market } from './mufap';

/** Everything lives in this phone's browser storage. Nothing is sent anywhere. */

const KEYS = {
  holdings: 'keeper.holdings.v1',
  market: 'keeper.market.v1',
  snapshots: 'keeper.snapshots.v1',
  changes: 'keeper.changes.v1',
  manualNavs: 'keeper.manualNavs.v1',
};

export interface Snapshot {
  /** Latest NAV date of the portfolio, YYYY-MM-DD */
  date: string;
  value: number;
  invested: number;
}

export interface Backup {
  app: 'keeper';
  version: 1;
  exportedAt: string;
  holdings: Holding[];
  snapshots: Snapshot[];
  manualNavs?: ManualNavs;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const loadHoldings = () => read<Holding[]>(KEYS.holdings, []);
export const saveHoldings = (h: Holding[]) => write(KEYS.holdings, h);

export const loadMarket = () => read<Market | null>(KEYS.market, null);
export const saveMarket = (m: Market) => write(KEYS.market, m);

export const loadSnapshots = () => read<Snapshot[]>(KEYS.snapshots, []);

/** Records the portfolio's value for its NAV date, replacing an earlier record for the same date. */
export function recordSnapshot(s: Snapshot): Snapshot[] {
  const list = loadSnapshots().filter(x => x.date !== s.date);
  list.push(s);
  list.sort((a, b) => a.date.localeCompare(b.date));
  const trimmed = list.slice(-730);
  write(KEYS.snapshots, trimmed);
  return trimmed;
}

export const loadChanges = () => read<ChangeLog>(KEYS.changes, {});

/** Saves each fund's newest daily change, keeping the last 14 dates per fund. */
export function recordChanges(funds: Fund[]): ChangeLog {
  const log = loadChanges();
  for (const f of funds) {
    const d = dailyReturn(f);
    if (d === null) continue;
    const dates = { ...log[f.id], [f.date]: { nav: f.nav, d } };
    log[f.id] = Object.fromEntries(Object.entries(dates).sort(([a], [b]) => a.localeCompare(b)).slice(-14));
  }
  write(KEYS.changes, log);
  return log;
}

export const loadManualNavs = () => read<ManualNavs>(KEYS.manualNavs, {});
export const saveManualNavs = (m: ManualNavs) => write(KEYS.manualNavs, m);

export function makeBackup(): Backup {
  return { app: 'keeper', version: 1, exportedAt: new Date().toISOString(), holdings: loadHoldings(), snapshots: loadSnapshots(), manualNavs: loadManualNavs() };
}

/** Validates a backup file's contents and restores it. Throws a readable error if the file isn't a Keeper backup. */
export function restoreBackup(text: string): Backup {
  let data: Partial<Backup>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a Keeper backup.");
  }
  if (data.app !== 'keeper' || !Array.isArray(data.holdings)) throw new Error("That file isn't a Keeper backup.");
  const holdings = data.holdings.filter(
    (h): h is Holding => !!h && typeof h.fundId === 'string' && Number(h.units) > 0,
  ).map(h => ({
    fundId: h.fundId,
    name: String(h.name ?? ''),
    units: Number(h.units),
    invested: Number(h.invested) || 0,
    ...(typeof h.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(h.since) ? { since: h.since } : {}),
  }));
  const snapshots = Array.isArray(data.snapshots)
    ? data.snapshots.filter((s): s is Snapshot => !!s && typeof s.date === 'string' && isFinite(Number(s.value)))
    : [];
  saveHoldings(holdings);
  write(KEYS.snapshots, snapshots);
  saveManualNavs(data.manualNavs && typeof data.manualNavs === 'object' ? data.manualNavs : {});
  return { app: 'keeper', version: 1, exportedAt: String(data.exportedAt ?? ''), holdings, snapshots };
}

/** Asks the browser not to clear Keeper's storage when the phone runs low on space. */
export async function requestPersistence(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* not supported; the backup file is the fallback */
  }
}
