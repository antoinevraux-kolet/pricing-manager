import { Fragment, useState } from 'react';
import { zoneLabel, zoneName, fmt, pctDelta, fmtDate, DeltaBadge } from './ComparisonTableV0';
import type { OrderComparisonData, OrderComparisonRow } from '../App';
import styles from './ComparisonTable.module.css';

function ColInfo({ text }: { text: string }) {
  return (
    <span className={styles.colInfoWrap}>
      <span className={styles.colInfoIcon}>i</span>
      <span className={styles.colInfoTip}>{text}</span>
    </span>
  );
}

interface Props { data: OrderComparisonData }

export default function ComparisonTable({ data }: Props) {
  const { rows, nDays, beforeFrom, beforeTo, afterFrom, afterTo } = data;

  const allZones = [...new Set(rows.map(r => r.zoneCode))];
  const allGbs   = [...new Set(rows.map(r => r.dataGb))].sort((a, b) => Number(a) - Number(b));

  const [search,     setSearch]     = useState('');
  const [filterGb,   setFilterGb]   = useState('all');
  const [rateFilter, setRateFilter] = useState<number>(1);

  const sortedRates = [...data.currencies].sort((a, b) => a.rate - b.rate);

  const searchLower = search.toLowerCase();
  const matchesSearch = (zone: string) =>
    !searchLower ||
    zone.toLowerCase().includes(searchLower) ||
    zoneName(zone).toLowerCase().includes(searchLower);

  const filtered = rows.filter(r =>
    matchesSearch(r.zoneCode) &&
    (filterGb === 'all' || r.dataGb === filterGb) &&
    r.rate === rateFilter
  );

  const grouped: Record<string, OrderComparisonRow[]> = {};
  for (const row of filtered) {
    if (!grouped[row.zoneCode]) grouped[row.zoneCode] = [];
    grouped[row.zoneCode].push(row);
  }

  const sortedZones = allZones
    .filter(z => grouped[z]?.length && matchesSearch(z))
    .sort((a, b) => {
      const sumA = (grouped[a] ?? []).reduce((s, r) => s + r.ordersAfter, 0);
      const sumB = (grouped[b] ?? []).reduce((s, r) => s + r.ordersAfter, 0);
      return sumB - sumA;
    });

  const NCOLS = 13;

  return (
    <div>
      <div className={styles.periodBar}>
        <span className={styles.periodLabel}>
          Before <strong>{fmtDate(beforeFrom)}</strong> → <strong>{fmtDate(beforeTo)}</strong>
        </span>
        <span className={styles.periodSep}>vs</span>
        <span className={styles.periodLabel}>
          After <strong>{fmtDate(afterFrom)}</strong> → <strong>{fmtDate(afterTo)}</strong>
        </span>
        <span className={styles.periodNote}>({nDays} days each)</span>
      </div>

      <div className={styles.controls}>
        <div className={styles.controlsRow}>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              className={styles.searchInput}
              placeholder="Search countries…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className={styles.searchClear} onClick={() => setSearch('')}>✕</button>
            )}
          </div>

          <select value={filterGb} onChange={e => setFilterGb(e.target.value)} className={styles.filterSelect}>
            <option value="all">All plans</option>
            {allGbs.map(gb => (
              <option key={gb} value={gb}>{gb} GB</option>
            ))}
          </select>

          <select
            value={rateFilter}
            onChange={e => setRateFilter(Number(e.target.value))}
            className={styles.filterSelect}
          >
            {sortedRates.map(c => (
              <option key={c.rate} value={c.rate}>
                {c.rate === 1 ? 'EUR (×1)' : `×${c.rate}`}
              </option>
            ))}
          </select>

          <span className={styles.planCount}>{filtered.length} plans · {sortedZones.length} countries</span>
        </div>
      </div>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.planHeader} rowSpan={2}>PLAN</th>
              <th className={`${styles.groupHeader} ${styles.priceHdr}`} colSpan={3}>
                PRICE
                <ColInfo text="AVG(order_original_price_amount) — catalog price in order currency" />
              </th>
              <th className={`${styles.groupHeader} ${styles.ordersHdr}`} colSpan={3}>
                ORDERS
                <ColInfo text="COUNT of paid non-gift orders (is_gift = false)" />
              </th>
              <th className={`${styles.groupHeader} ${styles.grossRevHdr}`} colSpan={3}>
                GROSS REV (EUR)
                <ColInfo text="SUM(price_euro_cents) / 100 — incl. tax, after discounts & Koins" />
              </th>
              <th className={`${styles.groupHeader} ${styles.netRevHdr}`} colSpan={3}>
                NET REV (EUR)
                <ColInfo text="SUM(price_euro_cents) / 120 — gross revenue ex. 20% VAT" />
              </th>
            </tr>
            <tr>
              <th className={`${styles.subBefore} ${styles.priceHdr}`}>Before</th>
              <th className={`${styles.subAfter}  ${styles.priceHdr}`}>After</th>
              <th className={`${styles.subDelta}  ${styles.priceHdr}`}>Δ</th>
              <th className={`${styles.subBefore} ${styles.ordersHdr}`}>Before</th>
              <th className={`${styles.subAfter}  ${styles.ordersHdr}`}>After</th>
              <th className={`${styles.subDelta}  ${styles.ordersHdr}`}>Δ</th>
              <th className={`${styles.subBefore} ${styles.grossRevHdr}`}>Before</th>
              <th className={`${styles.subAfter}  ${styles.grossRevHdr}`}>After</th>
              <th className={`${styles.subDelta}  ${styles.grossRevHdr}`}>Δ</th>
              <th className={`${styles.subBefore} ${styles.netRevHdr}`}>Before</th>
              <th className={`${styles.subAfter}  ${styles.netRevHdr}`}>After</th>
              <th className={`${styles.subDelta}  ${styles.netRevHdr}`}>Δ</th>
            </tr>
          </thead>
          <tbody>
            {sortedZones.map((zone, rank) => {
              const zoneRows = grouped[zone];
              const sumOrdersBefore  = zoneRows.reduce((s, r) => s + r.ordersBefore,  0);
              const sumOrdersAfter   = zoneRows.reduce((s, r) => s + r.ordersAfter,   0);
              const sumGrossRevBefore = zoneRows.reduce((s, r) => s + r.grossRevBefore, 0);
              const sumGrossRevAfter  = zoneRows.reduce((s, r) => s + r.grossRevAfter,  0);
              const sumNetRevBefore  = zoneRows.reduce((s, r) => s + r.netRevBefore,  0);
              const sumNetRevAfter   = zoneRows.reduce((s, r) => s + r.netRevAfter,   0);

              return (
                <Fragment key={zone}>
                  <tr className={styles.countryRow}>
                    <td colSpan={NCOLS} className={styles.countryCell}>
                      <span className={styles.countryRank}>#{rank + 1}</span>
                      {zoneLabel(zone)}
                      <span className={styles.countryOrders}>
                        {' '}— {sumOrdersAfter.toLocaleString('en-US')} orders (after period)
                      </span>
                    </td>
                  </tr>
                  {zoneRows.map(row => (
                    <tr key={`${zone}-${row.dataGb}-${row.rate}`} className={styles.planRow}>
                      <td className={styles.planCell}>{row.dataGb} GB</td>

                      <td className={`${styles.cell} ${styles.priceHdr}`}>
                        {row.priceBefore != null ? fmt(row.priceBefore) : '—'}
                      </td>
                      <td className={`${styles.cell} ${styles.priceHdr}`}>
                        {row.priceAfter != null ? fmt(row.priceAfter) : '—'}
                      </td>
                      <td className={`${styles.deltaCell} ${styles.priceHdr}`}>
                        <DeltaBadge delta={pctDelta(row.priceBefore, row.priceAfter)} />
                      </td>

                      <td className={`${styles.cell} ${styles.ordersHdr}`}>{row.ordersBefore.toLocaleString('en-US')}</td>
                      <td className={`${styles.cell} ${styles.ordersHdr}`}>{row.ordersAfter.toLocaleString('en-US')}</td>
                      <td className={`${styles.deltaCell} ${styles.ordersHdr}`}>
                        <DeltaBadge delta={pctDelta(row.ordersBefore, row.ordersAfter)} />
                      </td>

                      <td className={`${styles.cell} ${styles.grossRevHdr}`}>€{fmt(row.grossRevBefore)}</td>
                      <td className={`${styles.cell} ${styles.grossRevHdr}`}>€{fmt(row.grossRevAfter)}</td>
                      <td className={`${styles.deltaCell} ${styles.grossRevHdr}`}>
                        <DeltaBadge delta={pctDelta(row.grossRevBefore, row.grossRevAfter)} />
                      </td>

                      <td className={`${styles.cell} ${styles.netRevHdr}`}>€{fmt(row.netRevBefore)}</td>
                      <td className={`${styles.cell} ${styles.netRevHdr}`}>€{fmt(row.netRevAfter)}</td>
                      <td className={`${styles.deltaCell} ${styles.netRevHdr}`}>
                        <DeltaBadge delta={pctDelta(row.netRevBefore, row.netRevAfter)} />
                      </td>
                    </tr>
                  ))}
                  <tr className={styles.totalRow}>
                    <td className={styles.planCell}>Total</td>

                    <td className={`${styles.cell} ${styles.priceHdr}`} />
                    <td className={`${styles.cell} ${styles.priceHdr}`} />
                    <td className={`${styles.deltaCell} ${styles.priceHdr}`} />

                    <td className={`${styles.cell} ${styles.ordersHdr}`}>{sumOrdersBefore.toLocaleString('en-US')}</td>
                    <td className={`${styles.cell} ${styles.ordersHdr}`}>{sumOrdersAfter.toLocaleString('en-US')}</td>
                    <td className={`${styles.deltaCell} ${styles.ordersHdr}`}>
                      <DeltaBadge delta={pctDelta(sumOrdersBefore, sumOrdersAfter)} />
                    </td>

                    <td className={`${styles.cell} ${styles.grossRevHdr}`}>€{fmt(sumGrossRevBefore)}</td>
                    <td className={`${styles.cell} ${styles.grossRevHdr}`}>€{fmt(sumGrossRevAfter)}</td>
                    <td className={`${styles.deltaCell} ${styles.grossRevHdr}`}>
                      <DeltaBadge delta={pctDelta(sumGrossRevBefore, sumGrossRevAfter)} />
                    </td>

                    <td className={`${styles.cell} ${styles.netRevHdr}`}>€{fmt(sumNetRevBefore)}</td>
                    <td className={`${styles.cell} ${styles.netRevHdr}`}>€{fmt(sumNetRevAfter)}</td>
                    <td className={`${styles.deltaCell} ${styles.netRevHdr}`}>
                      <DeltaBadge delta={pctDelta(sumNetRevBefore, sumNetRevAfter)} />
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
