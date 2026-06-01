import { useEffect, useState } from 'react';
import PricingTable from './components/PricingTable';
import ComparisonTableV0 from './components/ComparisonTableV0';
import ComparisonTable from './components/ComparisonTable';
import styles from './App.module.css';

export interface CellMetrics {
  orders: number;
  avgPrice: number;
  revenue: number;
  grossRevenueTtc: number;
  netRevenueHt: number;
  netRevenueAfterFees: number;
  networkCost: number;
  grossMargin: number;
  grossMarginPct: number;
  consumptionRate: number;
  projectedConsumptionRate: number | null;
  competitorMinPrice: number | null;
}

export interface PricingData {
  zones: string[];
  allowances: string[];
  values: Record<string, Record<string, CellMetrics | null>>;
  zoneCosts: Record<string, number | null>;
  costDateRange: { from: string; to: string };
}

export interface ComparisonRow {
  zoneCode: string;
  dataAllowanceGb: string;
  priceBefore: number | null;
  priceAfter: number | null;
  ordersBefore: number;
  ordersAfter: number;
  revDayBefore: number;
  revDayAfter: number;
  costDayBefore: number;
  costDayAfter: number;
  marginDayBefore: number;
  marginDayAfter: number;
  nPlansBefore: number;
  nPlansAfter: number;
  nExpiredBefore: number;
  nExpiredAfter: number;
  projCostDayBefore: number;
  projCostDayAfter: number;
  projMarginDayBefore: number;
  projMarginDayAfter: number;
}

export interface ProjectionAssumption {
  zoneCode: string;
  dataAllowanceGb: string;
  avgCostPerGb: number | null;
  avgConsumptionRate: number | null;
}

export interface ComparisonData {
  rows: ComparisonRow[];
  nDays: number;
  beforeFrom: string;
  beforeTo: string;
  afterFrom: string;
  afterTo: string;
  projCostFrom: string;
  projCostTo: string;
  projAssumptions: ProjectionAssumption[];
}

export interface OrderComparisonRow {
  zoneCode: string;
  dataGb: string;
  priceBeforeEur: number | null;
  priceBeforeUsd: number | null;
  priceAfterEur: number | null;
  priceAfterUsd: number | null;
  ordersBefore: number;
  ordersAfter: number;
  grossRevBefore: number;
  grossRevAfter: number;
  netRevBefore: number;
  netRevAfter: number;
}

export interface OrderComparisonData {
  rows: OrderComparisonRow[];
  nDays: number;
  beforeFrom: string;
  beforeTo: string;
  afterFrom: string;
  afterTo: string;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split('T')[0];
}

type View = 'pricing' | 'comparison' | 'comparison2';

export default function App() {
  const today = getToday();
  const defaultFrom = subtractDays(today, 7);

  // ── Pricing view state ────────────────────────────────────────────────────
  const [pendingFrom, setPendingFrom] = useState<string>(defaultFrom);
  const [pendingTo, setPendingTo] = useState<string>(today);
  const [appliedRange, setAppliedRange] = useState<{ from: string; to: string }>({ from: defaultFrom, to: today });
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [pricingError, setPricingError] = useState<string | null>(null);

  // ── Comparison view state (shared date controls) ──────────────────────────
  const defaultRefDate = '2026-05-14';
  const [pendingRefDate, setPendingRefDate] = useState<string>(defaultRefDate);
  const [pendingWeeks, setPendingWeeks] = useState<number>(2);
  const [appliedComparison, setAppliedComparison] = useState<{ refDate: string; weeks: number }>({ refDate: defaultRefDate, weeks: 2 });

  // Before / After v0 (old mart_pricing_margin model)
  const [compData, setCompData] = useState<ComparisonData | null>(null);
  const [compLoading, setCompLoading] = useState(false);
  const [compError, setCompError] = useState<string | null>(null);

  // Before / After (new bi_users_orders model)
  const [comp2Data, setComp2Data] = useState<OrderComparisonData | null>(null);
  const [comp2Loading, setComp2Loading] = useState(false);
  const [comp2Error, setComp2Error] = useState<string | null>(null);

  // ── Navigation ────────────────────────────────────────────────────────────
  const [view, setView] = useState<View>('comparison2');

  // ── Fetch pricing ─────────────────────────────────────────────────────────
  useEffect(() => {
    setPricingLoading(true);
    setPricingError(null);
    fetch(`/api/pricing?from=${appliedRange.from}&to=${appliedRange.to}`)
      .then((res) => { if (!res.ok) throw new Error('Network error'); return res.json(); })
      .then((json: PricingData) => setPricingData(json))
      .catch((err: Error) => setPricingError(err.message))
      .finally(() => setPricingLoading(false));
  }, [appliedRange.from, appliedRange.to]);

  // ── Fetch comparison v0 ───────────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'comparison') return;
    setCompLoading(true);
    setCompError(null);
    fetch(`/api/pricing/comparison?refDate=${appliedComparison.refDate}&weeks=${appliedComparison.weeks}`)
      .then((res) => { if (!res.ok) throw new Error('Network error'); return res.json(); })
      .then((json: ComparisonData) => setCompData(json))
      .catch((err: Error) => setCompError(err.message))
      .finally(() => setCompLoading(false));
  }, [view, appliedComparison.refDate, appliedComparison.weeks]);

  // ── Fetch comparison v2 ───────────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'comparison2') return;
    setComp2Loading(true);
    setComp2Error(null);
    fetch(`/api/pricing/comparison2?refDate=${appliedComparison.refDate}&weeks=${appliedComparison.weeks}`)
      .then((res) => { if (!res.ok) throw new Error('Network error'); return res.json(); })
      .then((json: OrderComparisonData) => setComp2Data(json))
      .catch((err: Error) => setComp2Error(err.message))
      .finally(() => setComp2Loading(false));
  }, [view, appliedComparison.refDate, appliedComparison.weeks]);

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <span className={styles.logoMark}>K</span>
            <span className={styles.logoText}>olet</span>
          </div>
          <h1 className={styles.title}>Pricing Manager</h1>
          <nav className={styles.nav}>
            <button
              className={view === 'comparison2' ? styles.navActive : styles.navBtn}
              onClick={() => setView('comparison2')}
            >
              Before / After
            </button>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        {view === 'pricing' && (
          <>
            <div className={styles.toolbar}>
              <label className={styles.label} htmlFor="date-from">From</label>
              <input
                id="date-from"
                type="date"
                className={styles.dateInput}
                value={pendingFrom}
                max={pendingTo}
                onChange={(e) => setPendingFrom(e.target.value)}
              />
              <label className={styles.label} htmlFor="date-to">To</label>
              <input
                id="date-to"
                type="date"
                className={styles.dateInput}
                value={pendingTo}
                min={pendingFrom}
                max={today}
                onChange={(e) => setPendingTo(e.target.value)}
              />
              <button
                className={styles.applyBtn}
                onClick={() => setAppliedRange({ from: pendingFrom, to: pendingTo })}
                disabled={!pendingFrom || !pendingTo || pendingFrom > pendingTo}
              >
                Apply
              </button>
            </div>
            {pricingLoading && <div className={styles.state}>Loading…</div>}
            {pricingError && <div className={styles.stateError}>Error: {pricingError}</div>}
            {!pricingLoading && !pricingError && pricingData && <PricingTable data={pricingData} />}
          </>
        )}

        {(view === 'comparison' || view === 'comparison2') && (
          <div className={styles.toolbar}>
            <label className={styles.label} htmlFor="ref-date">Reference date</label>
            <input
              id="ref-date"
              type="date"
              className={styles.dateInput}
              value={pendingRefDate}
              max={today}
              onChange={(e) => setPendingRefDate(e.target.value)}
            />
            <label className={styles.label} htmlFor="weeks-select">Weeks</label>
            <select
              id="weeks-select"
              className={styles.dateInput}
              value={pendingWeeks}
              onChange={(e) => setPendingWeeks(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 6, 8, 12].map(w => (
                <option key={w} value={w}>{w} {w === 1 ? 'week' : 'weeks'}</option>
              ))}
            </select>
            <button
              className={styles.applyBtn}
              onClick={() => setAppliedComparison({ refDate: pendingRefDate, weeks: pendingWeeks })}
              disabled={!pendingRefDate}
            >
              Apply
            </button>
          </div>
        )}

        {view === 'comparison2' && (
          <>
            {comp2Loading && <div className={styles.state}>Loading…</div>}
            {comp2Error && <div className={styles.stateError}>Error: {comp2Error}</div>}
            {!comp2Loading && !comp2Error && comp2Data && <ComparisonTable data={comp2Data} />}
          </>
        )}

        {view === 'comparison' && (
          <>
            {compLoading && <div className={styles.state}>Loading…</div>}
            {compError && <div className={styles.stateError}>Error: {compError}</div>}
            {!compLoading && !compError && compData && <ComparisonTableV0 data={compData} />}
          </>
        )}
      </main>
    </div>
  );
}
