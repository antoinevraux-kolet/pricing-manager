import ComparisonTable from './components/ComparisonTable';
import styles from './App.module.css';

export interface OrderComparisonRow {
  zoneCode: string;
  dataGb: string;
  priceBeforeEur: number | null;
  priceBeforeUsd: number | null;
  priceAfterEur: number | null;
  priceAfterUsd: number | null;
  ordersBefore: number;
  ordersAfter: number;
  catalogRevBefore: number;
  catalogRevAfter: number;
  discountBefore: number;
  discountAfter: number;
  grossRevBefore: number;
  grossRevAfter: number;
  netRevBefore: number;
  netRevAfter: number;
  totalCostBefore: number;
  totalCostAfter: number;
}

export interface OrderComparisonData {
  rows: OrderComparisonRow[];
  nDays: number;
  beforeFrom: string;
  beforeTo: string;
  afterFrom: string;
  afterTo: string;
}

export interface DestinationVisitsData {
  before: Record<string, number>;
  after: Record<string, number>;
  beforeFrom: string;
  beforeTo: string;
  afterFrom: string;
  afterTo: string;
}

export interface OrderObservationRow {
  zoneCode: string;
  dataGb: string;
  priceEur: number | null;
  priceUsd: number | null;
  orders: number;
  catalogRev: number;
  discount: number;
  grossRev: number;
  netRev: number;
  totalCost: number;
}

export interface OrderObservationData {
  rows: OrderObservationRow[];
  from: string;
  to: string;
}

export interface DestinationVisitsSingleData {
  visits: Record<string, number>;
  from: string;
  to: string;
}

export default function App() {
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
            <button className={styles.navActive}>Before / After</button>
          </nav>
        </div>
      </header>
      <main className={styles.main}>
        <ComparisonTable />
      </main>
    </div>
  );
}
