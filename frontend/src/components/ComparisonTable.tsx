import { Fragment, useState } from 'react';
import { zoneLabel, zoneName, fmt, pctDelta, fmtDate, DeltaBadge } from './ComparisonTableV0';
import type { OrderComparisonData, OrderComparisonRow, DestinationVisitsData } from '../App';
import styles from './ComparisonTable.module.css';

type GroupKey = 'priceEur' | 'priceUsd' | 'visitors' | 'orders' | 'grossRev' | 'netRev' | 'grossAov' | 'netAov';

function ColInfo({ text }: { text: string }) {
  return (
    <span className={styles.colInfoWrap}>
      <span className={styles.colInfoIcon}>i</span>
      <span className={styles.colInfoTip}>{text}</span>
    </span>
  );
}

interface Props { data: OrderComparisonData; visits?: DestinationVisitsData }

export default function ComparisonTable({ data, visits }: Props) {
  const { rows, nDays, beforeFrom, beforeTo, afterFrom, afterTo } = data;

  const allZones = [...new Set(rows.map(r => r.zoneCode))];
  const allGbs   = [...new Set(rows.map(r => r.dataGb))].sort((a, b) => Number(a) - Number(b));

  const [search,    setSearch]    = useState('');
  const [filterGb,  setFilterGb]  = useState('all');
  const [collapsed, setCollapsed] = useState<Set<GroupKey>>(new Set(['grossRev', 'grossAov']));

  const toggle = (key: GroupKey) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const isOpen = (key: GroupKey) => !collapsed.has(key);

  const KEYS: GroupKey[] = ['priceEur', 'priceUsd', 'visitors', 'orders', 'grossRev', 'grossAov', 'netRev', 'netAov'];
  const NCOLS = 1 + KEYS.reduce((s, k) => s + (isOpen(k) ? 3 : 1), 0);

  const searchLower = search.toLowerCase();
  const matchesSearch = (zone: string) =>
    !searchLower ||
    zone.toLowerCase().includes(searchLower) ||
    zoneName(zone).toLowerCase().includes(searchLower);

  const filtered = rows.filter(r =>
    matchesSearch(r.zoneCode) && (filterGb === 'all' || r.dataGb === filterGb)
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

  // Helper: render 3 cells when open, 1 collapsed placeholder when closed
  function GroupCells({
    groupKey, hdrClass, beforeVal, afterVal, fmt: fmtFn, prefix = '', positiveIsGood = true,
  }: {
    groupKey: GroupKey;
    hdrClass: string;
    beforeVal: number | null;
    afterVal: number | null;
    fmt?: (v: number) => string;
    prefix?: string;
    positiveIsGood?: boolean;
  }) {
    const f = fmtFn ?? ((v: number) => fmt(v));
    if (!isOpen(groupKey)) {
      return <td className={`${styles.collapsedCell} ${hdrClass} ${styles.groupStartCell}`} />;
    }
    return (
      <>
        <td className={`${styles.cell} ${hdrClass} ${styles.groupStartCell}`}>
          {beforeVal != null ? `${prefix}${f(beforeVal)}` : '—'}
        </td>
        <td className={`${styles.cell} ${hdrClass}`}>
          {afterVal != null ? `${prefix}${f(afterVal)}` : '—'}
        </td>
        <td className={`${styles.deltaCell} ${hdrClass}`}>
          <DeltaBadge delta={pctDelta(beforeVal, afterVal)} positiveIsGood={positiveIsGood} />
        </td>
      </>
    );
  }

  function GroupHeader({
    groupKey, hdrClass, label, info,
  }: { groupKey: GroupKey; hdrClass: string; label: string; info: string }) {
    const open = isOpen(groupKey);
    return (
      <th
        className={`${styles.groupHeader} ${hdrClass} ${styles.collapsible} ${!open ? styles.groupHeaderCollapsed : ''}`}
        colSpan={open ? 3 : 1}
        rowSpan={open ? 1 : 2}
        onClick={() => toggle(groupKey)}
      >
        {open ? (
          <>
            {label}
            <ColInfo text={info} />
            <span className={styles.collapseArrow}>▾</span>
          </>
        ) : (
          label
        )}
      </th>
    );
  }

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
            {allGbs.map(gb => <option key={gb} value={gb}>{gb} GB</option>)}
          </select>
          <span className={styles.planCount}>{filtered.length} plans · {sortedZones.length} countries</span>
        </div>
      </div>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.planHeader} rowSpan={2}>PLAN</th>
              <GroupHeader groupKey="priceEur"  hdrClass={styles.priceHdr}    label="PRICE EUR"       info="AVG(order_original_price_amount) — orders with exchange rate = 1" />
              <GroupHeader groupKey="priceUsd"  hdrClass={styles.priceUsdHdr}  label="PRICE USD"          info="AVG(order_original_price_amount) — orders with exchange rate ≠ 1" />
              <GroupHeader groupKey="visitors"  hdrClass={styles.visitorsHdr}  label="UNIQUE VISITORS"    info="Unique visitors on the destination page — PostHog (zone level, not per plan)" />
              <GroupHeader groupKey="orders"    hdrClass={styles.ordersHdr}    label="ORDERS"             info="COUNT of paid non-gift orders (all currencies)" />
              <GroupHeader groupKey="grossRev"  hdrClass={styles.grossRevHdr} label="GROSS REV (EUR)" info="SUM(price_euro_cents) / 100 — incl. tax, after discounts & Koins" />
              <GroupHeader groupKey="grossAov" hdrClass={styles.grossAovHdr} label="GROSS AOV (EUR)"  info="Gross Revenue / Orders — average gross order value" />
              <GroupHeader groupKey="netRev"    hdrClass={styles.netRevHdr}   label="NET REV (EUR)"   info="SUM(price_euro_cents) / 120 — gross revenue ex. 20% VAT" />
              <GroupHeader groupKey="netAov"   hdrClass={styles.netAovHdr}   label="NET AOV (EUR)"    info="Net Revenue / Orders — average net order value ex. 20% VAT" />
            </tr>
            <tr>
              {isOpen('priceEur') && <>
                <th className={`${styles.subBefore} ${styles.priceHdr}`}>Before</th>
                <th className={`${styles.subAfter}  ${styles.priceHdr}`}>After</th>
                <th className={`${styles.subDelta}  ${styles.priceHdr}`}>Δ</th>
              </>}
              {isOpen('priceUsd') && <>
                <th className={`${styles.subBefore} ${styles.priceUsdHdr}`}>Before</th>
                <th className={`${styles.subAfter}  ${styles.priceUsdHdr}`}>After</th>
                <th className={`${styles.subDelta}  ${styles.priceUsdHdr}`}>Δ</th>
              </>}
              {isOpen('visitors') && <>
                <th className={`${styles.subBefore} ${styles.visitorsHdr}`}>Before</th>
                <th className={`${styles.subAfter}  ${styles.visitorsHdr}`}>After</th>
                <th className={`${styles.subDelta}  ${styles.visitorsHdr}`}>Δ</th>
              </>}
              {isOpen('orders') && <>
                <th className={`${styles.subBefore} ${styles.ordersHdr}`}>Before</th>
                <th className={`${styles.subAfter}  ${styles.ordersHdr}`}>After</th>
                <th className={`${styles.subDelta}  ${styles.ordersHdr}`}>Δ</th>
              </>}
              {isOpen('grossRev') && <>
                <th className={`${styles.subBefore} ${styles.grossRevHdr}`}>Before</th>
                <th className={`${styles.subAfter}  ${styles.grossRevHdr}`}>After</th>
                <th className={`${styles.subDelta}  ${styles.grossRevHdr}`}>Δ</th>
              </>}
              {isOpen('grossAov') && <>
                <th className={`${styles.subBefore} ${styles.grossAovHdr}`}>Before</th>
                <th className={`${styles.subAfter}  ${styles.grossAovHdr}`}>After</th>
                <th className={`${styles.subDelta}  ${styles.grossAovHdr}`}>Δ</th>
              </>}
              {isOpen('netRev') && <>
                <th className={`${styles.subBefore} ${styles.netRevHdr}`}>Before</th>
                <th className={`${styles.subAfter}  ${styles.netRevHdr}`}>After</th>
                <th className={`${styles.subDelta}  ${styles.netRevHdr}`}>Δ</th>
              </>}
              {isOpen('netAov') && <>
                <th className={`${styles.subBefore} ${styles.netAovHdr}`}>Before</th>
                <th className={`${styles.subAfter}  ${styles.netAovHdr}`}>After</th>
                <th className={`${styles.subDelta}  ${styles.netAovHdr}`}>Δ</th>
              </>}
            </tr>
          </thead>
          <tbody>
            {sortedZones.map((zone, rank) => {
              const zoneRows = grouped[zone];
              const sumOrdersBefore   = zoneRows.reduce((s, r) => s + r.ordersBefore,   0);
              const sumOrdersAfter    = zoneRows.reduce((s, r) => s + r.ordersAfter,    0);
              const sumGrossRevBefore = zoneRows.reduce((s, r) => s + r.grossRevBefore, 0);
              const sumGrossRevAfter  = zoneRows.reduce((s, r) => s + r.grossRevAfter,  0);
              const sumNetRevBefore   = zoneRows.reduce((s, r) => s + r.netRevBefore,   0);
              const sumNetRevAfter    = zoneRows.reduce((s, r) => s + r.netRevAfter,    0);

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
                  {zoneRows.map(row => {
                    const grossAovBefore = row.ordersBefore > 0 ? row.grossRevBefore / row.ordersBefore : null;
                    const grossAovAfter  = row.ordersAfter  > 0 ? row.grossRevAfter  / row.ordersAfter  : null;
                    const netAovBefore   = row.ordersBefore > 0 ? row.netRevBefore   / row.ordersBefore : null;
                    const netAovAfter    = row.ordersAfter  > 0 ? row.netRevAfter    / row.ordersAfter  : null;
                    return (
                      <tr key={`${zone}-${row.dataGb}`} className={styles.planRow}>
                        <td className={styles.planCell}>{row.dataGb} GB</td>
                        <GroupCells groupKey="priceEur"  hdrClass={styles.priceHdr}    beforeVal={row.priceBeforeEur} afterVal={row.priceAfterEur} positiveIsGood={false} />
                        <GroupCells groupKey="priceUsd"  hdrClass={styles.priceUsdHdr}  beforeVal={row.priceBeforeUsd} afterVal={row.priceAfterUsd} positiveIsGood={false} />
                        <GroupCells groupKey="visitors"  hdrClass={styles.visitorsHdr}  beforeVal={null} afterVal={null} fmt={v => v.toLocaleString('en-US')} />
                        <GroupCells groupKey="orders"    hdrClass={styles.ordersHdr}    beforeVal={row.ordersBefore}  afterVal={row.ordersAfter}   fmt={v => v.toLocaleString('en-US')} />
                        <GroupCells groupKey="grossRev"  hdrClass={styles.grossRevHdr} beforeVal={row.grossRevBefore} afterVal={row.grossRevAfter} prefix="€" />
                        <GroupCells groupKey="grossAov"  hdrClass={styles.grossAovHdr} beforeVal={grossAovBefore}    afterVal={grossAovAfter}     prefix="€" />
                        <GroupCells groupKey="netRev"    hdrClass={styles.netRevHdr}   beforeVal={row.netRevBefore}  afterVal={row.netRevAfter}   prefix="€" />
                        <GroupCells groupKey="netAov"    hdrClass={styles.netAovHdr}   beforeVal={netAovBefore}      afterVal={netAovAfter}       prefix="€" />
                      </tr>
                    );
                  })}
                  <tr className={styles.totalRow}>
                    <td className={styles.planCell}>Total</td>
                    {isOpen('priceEur') ? (
                      <><td className={`${styles.cell} ${styles.priceHdr} ${styles.groupStartCell}`} /><td className={`${styles.cell} ${styles.priceHdr}`} /><td className={`${styles.deltaCell} ${styles.priceHdr}`} /></>
                    ) : (
                      <td className={`${styles.collapsedCell} ${styles.priceHdr} ${styles.groupStartCell}`} />
                    )}
                    {isOpen('priceUsd') ? (
                      <><td className={`${styles.cell} ${styles.priceUsdHdr} ${styles.groupStartCell}`} /><td className={`${styles.cell} ${styles.priceUsdHdr}`} /><td className={`${styles.deltaCell} ${styles.priceUsdHdr}`} /></>
                    ) : (
                      <td className={`${styles.collapsedCell} ${styles.priceUsdHdr} ${styles.groupStartCell}`} />
                    )}
                    <GroupCells groupKey="visitors" hdrClass={styles.visitorsHdr}
                      beforeVal={visits?.before[zone] ?? null}
                      afterVal={visits?.after[zone] ?? null}
                      fmt={v => v.toLocaleString('en-US')}
                    />
                    <GroupCells groupKey="orders"   hdrClass={styles.ordersHdr}   beforeVal={sumOrdersBefore}   afterVal={sumOrdersAfter}   fmt={v => v.toLocaleString('en-US')} />
                    <GroupCells groupKey="grossRev" hdrClass={styles.grossRevHdr} beforeVal={sumGrossRevBefore} afterVal={sumGrossRevAfter}  prefix="€" />
                    <GroupCells groupKey="grossAov" hdrClass={styles.grossAovHdr} beforeVal={sumOrdersBefore > 0 ? sumGrossRevBefore / sumOrdersBefore : null} afterVal={sumOrdersAfter > 0 ? sumGrossRevAfter / sumOrdersAfter : null} prefix="€" />
                    <GroupCells groupKey="netRev"   hdrClass={styles.netRevHdr}   beforeVal={sumNetRevBefore}   afterVal={sumNetRevAfter}    prefix="€" />
                    <GroupCells groupKey="netAov"   hdrClass={styles.netAovHdr}   beforeVal={sumOrdersBefore > 0 ? sumNetRevBefore   / sumOrdersBefore : null} afterVal={sumOrdersAfter > 0 ? sumNetRevAfter   / sumOrdersAfter  : null} prefix="€" />
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
