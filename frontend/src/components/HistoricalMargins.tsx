import { useState } from 'react';
import { zoneLabel, zoneName } from './ComparisonTableV0';
import type { HistoricalMarginData, HistoricalMarginRow } from '../App';
import styles from './HistoricalMargins.module.css';

function fmt(v: number, digits = 2): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function marginClass(pct: number | null): string {
  if (pct == null) return '';
  if (pct >= 0.20) return styles.marginPositive;
  if (pct >= 0)    return styles.marginWarn;
  return styles.marginNegative;
}

function marginBarColor(pct: number | null): string {
  if (pct == null) return '#D1D5DB';
  if (pct >= 0.20) return '#16A34A';
  if (pct >= 0)    return '#D97706';
  return '#DC2626';
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className={styles.infoWrap}>
      <span className={styles.infoIcon}>i</span>
      <span className={styles.infoTip}>{text}</span>
    </span>
  );
}

interface Props { data: HistoricalMarginData }

export default function HistoricalMargins({ data }: Props) {
  const { rows, startDate, endDate } = data;

  const [search, setSearch] = useState('');
  const searchLower = search.toLowerCase();

  const filtered = rows.filter(r =>
    !searchLower ||
    r.zoneCode.toLowerCase().includes(searchLower) ||
    zoneName(r.zoneCode).toLowerCase().includes(searchLower)
  );

  function tooltipFor(row: HistoricalMarginRow): string {
    const margin = row.grossMargin != null ? `${(row.grossMargin * 100).toFixed(2)}%` : '—';
    return [
      `Formula: (net_revenue_ht_eur − total_cost_eur − payment_fees_eur) / net_revenue_ht_eur`,
      `= (€${fmt(row.netRevenueHt)} − €${fmt(row.totalCost)} − €${fmt(row.paymentFees)}) / €${fmt(row.netRevenueHt)} = ${margin}`,
      ``,
      `${row.nDataPlans.toLocaleString('en-US')} data plans · ${row.nOrders.toLocaleString('en-US')} orders (incl. gifts)`,
      `${fmt(row.gbAllowed, 1)} GB provisioned · ${fmt(row.gbConsumed, 1)} GB consumed`,
    ].join('\n');
  }

  return (
    <div>
      {/* Explanation box */}
      <div className={styles.explanation}>
        <p className={styles.explanationTitle}>Gross Margin — How it's computed</p>
        <p className={styles.explanationFormula}>
          Gross Margin = (SUM(net_revenue_ht_eur) − SUM(total_cost_eur) − SUM(payment_fees_eur)) / SUM(net_revenue_ht_eur)
        </p>
        <p className={styles.explanationNote}>
          Includes all data plans from <strong>bi.fct_data_plan</strong> created after{' '}
          <strong>{fmtDate(startDate)}</strong> that have already expired before{' '}
          <strong>{fmtDate(endDate)}</strong> (today).{' '}
          <strong>payment_fees_eur</strong> is subtracted separately as it is not included in total_cost_eur.
          GB values use 1 GB = 1,000,000,000 bytes. Order count (n_orders) includes gift orders.
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="text"
          placeholder="Search countries…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 8, padding: '7px 12px', fontSize: 13, fontFamily: 'inherit',
            color: 'var(--color-text)', width: 280,
          }}
        />
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          {filtered.length} zones
        </span>
      </div>

      {/* Table */}
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={`${styles.th} ${styles.thLeft}`}>ZONE</th>
              <th className={`${styles.th} ${styles.thMargin}`}>GROSS MARGIN</th>
              <th className={styles.th}>DATA PLANS</th>
              <th className={styles.th}>ORDERS (incl. gifts)</th>
              <th className={styles.th}>GB PROVISIONED</th>
              <th className={styles.th}>GB CONSUMED</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => {
              const pct = row.grossMargin;
              const pctDisplay = pct != null ? `${(pct * 100).toFixed(2)}%` : '—';
              const barWidth = pct != null ? Math.max(0, Math.min(100, pct * 100)) : 0;

              return (
                <tr key={row.zoneCode} className={styles.tr}>
                  <td className={`${styles.td} ${styles.tdZone}`}>{zoneLabel(row.zoneCode)}</td>
                  <td className={`${styles.td} ${styles.tdMargin}`}>
                    <div className={styles.marginCell}>
                      <div
                        className={styles.marginBar}
                        style={{ width: `${barWidth}px`, background: marginBarColor(pct) }}
                      />
                      <span className={marginClass(pct)}>{pctDisplay}</span>
                      <InfoTooltip text={tooltipFor(row)} />
                    </div>
                  </td>
                  <td className={styles.td}>{row.nDataPlans.toLocaleString('en-US')}</td>
                  <td className={styles.td}>{row.nOrders.toLocaleString('en-US')}</td>
                  <td className={styles.td}>{fmt(row.gbAllowed, 1)} GB</td>
                  <td className={styles.td}>{fmt(row.gbConsumed, 1)} GB</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
