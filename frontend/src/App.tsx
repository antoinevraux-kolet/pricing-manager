import { useEffect, useState } from 'react';
import PricingTable from './components/PricingTable';
import styles from './App.module.css';

interface PricingData {
  countries: string[];
  plans: string[];
  prices: Record<string, Record<string, number | null>>;
}

export default function App() {
  const [data, setData] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/pricing')
      .then((res) => {
        if (!res.ok) throw new Error('Erreur réseau');
        return res.json();
      })
      .then((json: PricingData) => setData(json))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
        {loading && <div className={styles.state}>Chargement…</div>}
        {error && <div className={styles.stateError}>Erreur : {error}</div>}
        {data && <PricingTable data={data} />}
      </main>
    </div>
  );
}
