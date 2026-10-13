import { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computePortfolio, type Holding } from './lib/calc';
import { fetchMarket, type Fund, type Market } from './lib/mufap';
import {
  loadHoldings, loadMarket, loadSnapshots, recordSnapshot, requestPersistence, saveHoldings, saveMarket,
} from './lib/store';
import { dateLabel, timeAgo } from './lib/format';
import Summary from './components/Summary';
import FundStrip from './components/FundStrip';
import CategoryBreakdown from './components/CategoryBreakdown';
import AllocationPie from './components/AllocationPie';
import LazySection from './components/LazySection';
import HoldingsEditor from './components/HoldingsEditor';
import BackupView from './components/BackupView';
import { DEMO_HOLDINGS, isDemo } from './demo';

// Loaded in its own file, only when the chart is about to scroll into view.
const PnlChart = lazy(() => import('./components/PnlChart'));

const STALE_MS = 30 * 60 * 1000;
type View = 'home' | 'edit' | 'backup';

export default function App() {
  const [demo] = useState(isDemo);
  const [holdings, setHoldings] = useState<Holding[]>(() => (isDemo() ? DEMO_HOLDINGS : loadHoldings()));
  const [market, setMarket] = useState<Market | null>(loadMarket);
  const [snapshots, setSnapshots] = useState(loadSnapshots);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('home');
  const [, setTick] = useState(0);
  const marketRef = useRef(market);
  marketRef.current = market;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const m = await fetchMarket();
      saveMarket(m);
      setMarket(m);
    } catch (e) {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;
      setError(offline ? "You're offline. Showing the last prices Keeper saved." : e instanceof Error && e.message !== 'Failed to fetch' ? e.message : "Couldn't reach MUFAP. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    requestPersistence();
    const refreshIfStale = () => {
      const m = marketRef.current;
      if (!m || Date.now() - new Date(m.fetchedAt).getTime() > STALE_MS) refresh();
      setTick(t => t + 1);
    };
    refreshIfStale();
    const onVisible = () => { if (document.visibilityState === 'visible') refreshIfStale(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const fundsById = useMemo(() => new Map<string, Fund>((market?.funds ?? []).map(f => [f.id, f])), [market]);
  const portfolio = useMemo(() => computePortfolio(holdings, fundsById), [holdings, fundsById]);

  // Keep one value record per NAV date for the chart, once every held fund has a price.
  useEffect(() => {
    if (demo || !holdings.length || !portfolio.date || portfolio.positions.some(p => !p.fund)) return;
    setSnapshots(recordSnapshot({ date: portfolio.date, value: Math.round(portfolio.value), invested: Math.round(portfolio.invested) }));
  }, [holdings.length, portfolio]);

  function onSaveHoldings(next: Holding[]) {
    if (!demo) saveHoldings(next);
    setHoldings(next);
    setView('home');
  }

  function onReorder(fundIds: string[]) {
    const next = fundIds.map(id => holdings.find(h => h.fundId === id)).filter((h): h is Holding => !!h);
    if (!demo) saveHoldings(next);
    setHoldings(next);
  }

  if (view === 'edit') {
    return (
      <HoldingsEditor
        funds={market?.funds ?? []}
        holdings={holdings}
        loadingFunds={loading && !market}
        onSave={onSaveHoldings}
        onCancel={() => setView('home')}
      />
    );
  }

  if (view === 'backup') {
    return (
      <BackupView
        onBack={() => setView('home')}
        onRestored={() => { setHoldings(loadHoldings()); setSnapshots(loadSnapshots()); setView('home'); }}
      />
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Keeper</div>
        <div className="topbar-actions">
          <button type="button" className="icon-btn" onClick={refresh} disabled={loading} aria-label="Refresh prices">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className={loading ? 'spin' : ''}>
              <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className="text-btn" onClick={() => setView('backup')}>Backup</button>
        </div>
      </header>

      <main className="content">
        {demo && (
          <p className="demo-banner">
            Demo with sample holdings. Nothing you change here is saved.{' '}
            <a href="./" onClick={e => { e.preventDefault(); location.hash = ''; location.reload(); }}>Exit demo</a>
          </p>
        )}
        <p className={`status ${error ? 'status-err' : ''}`} role="status">
          {error ?? (loading && !market ? 'Loading prices from MUFAP…' : market
            ? `Prices from MUFAP · updated ${timeAgo(market.fetchedAt)}${loading ? ' · refreshing…' : ''}`
            : '')}
        </p>

        {holdings.length === 0 ? (
          <section className="empty">
            <h1>Track your funds in one place</h1>
            <p>Add the funds you own and how many units you hold. Keeper prices them every time you open it, using MUFAP's daily NAVs. Your holdings stay on this phone.</p>
            <button type="button" className="primary" onClick={() => setView('edit')} disabled={!market && loading}>
              Add your funds
            </button>
          </section>
        ) : !market ? (
          error ? (
            <section className="panel">
              <h2>Prices couldn't load</h2>
              <p className="muted">Keeper needs MUFAP's prices once before it can show your funds. Check your connection and try again.</p>
              <button type="button" className="primary" onClick={refresh} disabled={loading}>Try again</button>
            </section>
          ) : (
            <>
              <div className="panel skeleton" style={{ minHeight: 190 }} aria-label="Loading your portfolio" />
              <div className="panel skeleton" style={{ minHeight: 220 }} />
            </>
          )
        ) : (
          <>
            <Summary portfolio={portfolio} />
            <FundStrip
              positions={portfolio.positions}
              latestDate={portfolio.date}
              onEdit={() => setView('edit')}
              onReorder={onReorder}
            />
            {portfolio.mixedDates && (
              <p className="note">Your funds have different NAV dates. Each card shows the date of its own latest NAV. Today's total adds up each fund's latest day ({dateLabel(portfolio.date)} is the newest).</p>
            )}
            <AllocationPie portfolio={portfolio} />
            <CategoryBreakdown portfolio={portfolio} />
            <LazySection height={300} label="profit/loss chart">
              <PnlChart positions={portfolio.positions} snapshots={snapshots} />
            </LazySection>
          </>
        )}
      </main>
    </div>
  );
}
