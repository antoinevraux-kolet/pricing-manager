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
}

export interface PricingData {
  zones: string[];
  allowances: string[];
  values: Record<string, Record<string, CellMetrics | null>>;
  zoneCosts: Record<string, number | null>;
  costDateRange: { from: string; to: string };
  weekStart: string;
}

function formatWeekLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `Week of ${day}/${month}/${year}`;
}

function getThisMonday(): string {
  const today = new Date();
  const day = today.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() + diff);
  return monday.toISOString().split('T')[0];
}

export default function App() {
  const [weeks, setWeeks] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>(getThisMonday());
  const [data, setData] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/pricing/weeks')
      .then((res) => res.json())
      .then((w: string[]) => {
        setWeeks(w);
        if (w.length > 0) setSelectedWeek(w[0]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/pricing?week=${selectedWeek}`)
      .then((res) => {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
      .then((json: PricingData) => setData(json))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedWeek]);

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
          <label className={styles.label} htmlFor="week-select">
            Week
          </label>
          <select
            id="week-select"
            className={styles.select}
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
          >
            {weeks.length === 0 ? (
              <option value={selectedWeek}>{formatWeekLabel(selectedWeek)}</option>
            ) : (
              weeks.map((w) => (
                <option key={w} value={w}>
                  {formatWeekLabel(w)}
                </option>
              ))
            )}
          </select>
        </div>

        {loading && <div className={styles.state}>Loading…</div>}
        {error && <div className={styles.stateError}>Error: {error}</div>}
        {!loading && !error && data && <PricingTable data={data} />}
      </main>
    </div>
  );
}
