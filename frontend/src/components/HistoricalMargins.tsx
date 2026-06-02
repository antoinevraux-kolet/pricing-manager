import { useState } from 'react';
import { zoneLabel, zoneName } from './ComparisonTableV0';
import type { HistoricalMarginData, HistoricalMarginRow } from '../App';
import styles from './HistoricalMargins.module.css';

interface MarginBucket { margin: number; count: number; }
interface MarginDistribution {
  buckets: MarginBucket[];
  mean: number | null;
  stdDev: number | null;
  totalCount: number;
}
type DistState = MarginDistribution | 'loading' | 'error';

function fmt(v: number, digits = 2): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
function pct(v: number, digits = 2) { return `${(v * 100).toFixed(digits)}%`; }

function marginClass(v: number | null): string {
  if (v == null) return '';
  if (v >= 0.20) return styles.marginPositive;
  if (v >= 0)    return styles.marginWarn;
  return styles.marginNegative;
}
function barColor(m: number): string {
  if (m < 0)    return '#EF4444';
  if (m < 0.10) return '#F59E0B';
  if (m < 0.20) return '#84CC16';
  return '#22C55E';
}
function marginBarBg(v: number | null): string {
  if (v == null) return '#D1D5DB';
  if (v >= 0.20) return '#16A34A';
  if (v >= 0)    return '#D97706';
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

function MarginHistogram({ buckets, mean, stdDev }: { buckets: MarginBucket[]; mean: number | null; stdDev: number | null }) {
  if (!buckets.length) return <span style={{ color: '#9CA3AF', fontSize: 12 }}>No data</span>;

  const W = 540, H = 150;
  const pad = { l: 10, r: 10, t: 16, b: 30 };
  const cW = W - pad.l - pad.r;
  const cH = H - pad.t - pad.b;

  const minM = buckets[0].margin;
  const maxM = buckets[buckets.length - 1].margin;
  const range = Math.max(maxM - minM, 0.025);
  const maxCnt = Math.max(...buckets.map(b => b.count));
  const barW = Math.max(2, (cW / buckets.length) * 0.82);

  const xS = (m: number) => ((m - minM) / range) * cW;
  const yS = (c: number) => (c / maxCnt) * cH;

  const tickCount = 6;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => minM + (range / tickCount) * i);

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', maxWidth: '100%' }}>
      <g transform={`translate(${pad.l},${pad.t})`}>
        {/* ±1σ shaded band */}
        {mean != null && stdDev != null && (
          <rect
            x={Math.max(0, xS(mean - stdDev))}
            y={0}
            width={Math.min(cW, xS(mean + stdDev)) - Math.max(0, xS(mean - stdDev))}
            height={cH}
            fill="#EDE9FE"
            opacity={0.6}
          />
        )}
        {/* Zero line */}
        {minM < 0 && maxM >= 0 && (
          <line x1={xS(0)} y1={0} x2={xS(0)} y2={cH} stroke="#9CA3AF" strokeWidth={1} strokeDasharray="3,2" />
        )}
        {/* Bars */}
        {buckets.map((b, i) => {
          const bH = Math.max(yS(b.count), 0);
          return (
            <rect key={i} x={xS(b.margin) - barW / 2} y={cH - bH} width={barW} height={bH}
              fill={barColor(b.margin)} opacity={0.85} />
          );
        })}
        {/* Mean line (μ) */}
        {mean != null && (
          <>
            <line x1={xS(mean)} y1={0} x2={xS(mean)} y2={cH} stroke="#7C3AED" strokeWidth={2} />
            <text x={xS(mean)} y={-4} textAnchor="middle" fontSize={10} fill="#7C3AED" fontWeight="700">μ</text>
          </>
        )}
        {/* ±1σ dashed lines */}
        {mean != null && stdDev != null && (
          <>
            {mean - stdDev >= minM && <line x1={xS(mean - stdDev)} y1={0} x2={xS(mean - stdDev)} y2={cH} stroke="#7C3AED" strokeWidth={1} strokeDasharray="4,2" opacity={0.6} />}
            {mean + stdDev <= maxM && <line x1={xS(mean + stdDev)} y1={0} x2={xS(mean + stdDev)} y2={cH} stroke="#7C3AED" strokeWidth={1} strokeDasharray="4,2" opacity={0.6} />}
          </>
        )}
        {/* X axis */}
        <line x1={0} y1={cH} x2={cW} y2={cH} stroke="#D1D5DB" strokeWidth={1} />
        {ticks.map((t, i) => (
          <g key={i} transform={`translate(${xS(t)},${cH})`}>
            <line y2={4} stroke="#D1D5DB" strokeWidth={1} />
            <text y={16} textAnchor="middle" fontSize={9} fill="#6B7280">{pct(t, 0)}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

interface Props { data: HistoricalMarginData }

export default function HistoricalMargins({ data }: Props) {
  const { rows, startDate, endDate } = data;

  const [search, setSearch]           = useState('');
  const [expandedZones, setExpanded]  = useState<Set<string>>(new Set());
  const [distributions, setDists]     = useState<Record<string, DistState>>({});

  const searchLower = search.toLowerCase();
  const filtered = rows.filter(r =>
    !searchLower ||
    r.zoneCode.toLowerCase().includes(searchLower) ||
    zoneName(r.zoneCode).toLowerCase().includes(searchLower)
  );

  function fetchDist(zone: string) {
    setDists(prev => ({ ...prev, [zone]: 'loading' }));
    fetch(`/api/pricing/historical-margins/distribution?zone=${encodeURIComponent(zone)}&startDate=${data.startDate}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then((json: MarginDistribution) => setDists(prev => ({ ...prev, [zone]: json })))
      .catch(() => setDists(prev => ({ ...prev, [zone]: 'error' })));
  }

  function toggleZone(zone: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(zone)) {
        next.delete(zone);
      } else {
        next.add(zone);
        if (!distributions[zone]) fetchDist(zone);
      }
      return next;
    });
  }

  function tooltipFor(row: HistoricalMarginRow): string {
    const margin = row.grossMargin != null ? pct(row.grossMargin) : '—';
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
          Click a row to see the margin probability distribution for that zone.
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
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{filtered.length} zones</span>
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
              const expanded = expandedZones.has(row.zoneCode);
              const dist = distributions[row.zoneCode];
              const marginPct = row.grossMargin != null ? pct(row.grossMargin) : '—';
              const barWidth = row.grossMargin != null ? Math.max(0, Math.min(80, row.grossMargin * 100)) : 0;

              return [
                <tr key={row.zoneCode} className={`${styles.tr} ${styles.trClickable}`} onClick={() => toggleZone(row.zoneCode)}>
                  <td className={`${styles.td} ${styles.tdZone}`}>
                    <span className={`${styles.expandArrow} ${expanded ? styles.expandArrowOpen : ''}`}>▶</span>
                    {zoneLabel(row.zoneCode)}
                  </td>
                  <td className={`${styles.td} ${styles.tdMargin}`}>
                    <div className={styles.marginCell}>
                      <div className={styles.marginBar} style={{ width: `${barWidth}px`, background: marginBarBg(row.grossMargin) }} />
                      <span className={marginClass(row.grossMargin)}>{marginPct}</span>
                      <InfoTooltip text={tooltipFor(row)} />
                    </div>
                  </td>
                  <td className={styles.td}>{row.nDataPlans.toLocaleString('en-US')}</td>
                  <td className={styles.td}>{row.nOrders.toLocaleString('en-US')}</td>
                  <td className={styles.td}>{fmt(row.gbAllowed, 1)} GB</td>
                  <td className={styles.td}>{fmt(row.gbConsumed, 1)} GB</td>
                </tr>,
                expanded && (
                  <tr key={`${row.zoneCode}-dist`}>
                    <td colSpan={6} className={styles.expandedCell}>
                      {dist === 'loading' && <div className={styles.distLoading}>Loading distribution…</div>}
                      {dist === 'error'   && <div className={styles.distError}>Failed to load distribution.</div>}
                      {dist && dist !== 'loading' && dist !== 'error' && (
                        <div className={styles.distributionContent}>
                          {/* Stats */}
                          <div className={styles.distStats}>
                            <span className={`${styles.statPill} ${styles.statPillMu}`}>
                              Espérance (μ) <strong>{dist.mean != null ? pct(dist.mean) : '—'}</strong>
                            </span>
                            <span className={`${styles.statPill} ${styles.statPillSigma}`}>
                              Écart type (σ) <strong>{dist.stdDev != null ? pct(dist.stdDev) : '—'}</strong>
                            </span>
                            <span className={styles.statPill}>
                              Base <strong>{dist.totalCount.toLocaleString('en-US')} data plans</strong>
                            </span>
                          </div>
                          {/* Chart */}
                          <div className={styles.chartWrap}>
                            <span className={styles.chartTitle}>Distribution des marges — {zoneLabel(row.zoneCode)}</span>
                            <MarginHistogram buckets={dist.buckets} mean={dist.mean} stdDev={dist.stdDev} />
                            <div className={styles.chartLegend}>
                              <span className={styles.legendItem}><span className={styles.legendSwatch} style={{ background: '#EF4444' }} /> {'< 0%'}</span>
                              <span className={styles.legendItem}><span className={styles.legendSwatch} style={{ background: '#F59E0B' }} /> 0–10%</span>
                              <span className={styles.legendItem}><span className={styles.legendSwatch} style={{ background: '#84CC16' }} /> 10–20%</span>
                              <span className={styles.legendItem}><span className={styles.legendSwatch} style={{ background: '#22C55E' }} /> {'> 20%'}</span>
                              <span className={styles.legendItem}><span className={styles.legendSwatch} style={{ background: '#7C3AED', height: 2 }} /> μ (moyenne)</span>
                              <span className={styles.legendItem}><span className={styles.legendSwatch} style={{ background: '#EDE9FE', border: '1px dashed #7C3AED' }} /> ±1σ</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
