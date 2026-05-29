import { useEffect, useState } from 'react';
import PricingTable from './components/PricingTable';
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

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split('T')[0];
}

export default function App() {
  const today = getToday();
  const defaultFrom = subtractDays(today, 7);

  const [pendingFrom, setPendingFrom] = useState<string>(defaultFrom);
  const [pendingTo, setPendingTo] = useState<string>(today);
  const [appliedRange, setAppliedRange] = useState<{ from: string; to: string }>({ from: defaultFrom, to: today });

  const [data, setData] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/pricing?from=${appliedRange.from}&to=${appliedRange.to}`)
      .then((res) => {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
      .then((json: PricingData) => setData(json))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [appliedRange.from, appliedRange.to]);

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <span className={styles.logoMark}>K</span>
            <span className={styles.logoText}>olet</span>
          </div>
          <h1 className={styles.title}>Pricing Manager</h1>
        </div>
      </header>

      <main className={styles.main}>
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

        {loading && <div className={styles.state}>Loading…</div>}
        {error && <div className={styles.stateError}>Error: {error}</div>}
        {!loading && !error && data && <PricingTable data={data} />}
      </main>
    </div>
  );
}
