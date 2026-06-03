import { useEffect, useMemo, useState } from 'react';
import {
  mean, stdDev, ols, bootstrapElasticityCI,
  buildLogLogMatrix, OLS_COL_NAMES, DailyPoint, OLSResult,
  diffDays, weekOfYear, monthOf,
} from '../lib/statistics';
import styles from './Elasticity.module.css';

// ── Price change events — named constants ─────────────────────────────────────
export const PRICE_EVENTS = [
  { id: 'USD_CHANGE_1', date: '2026-04-30', currency: 'USD', label: 'USD price change #1' },
  { id: 'USD_CHANGE_2', date: '2026-05-14', currency: 'USD', label: 'USD price change #2' },
  { id: 'EUR_CHANGE_1', date: '2026-05-14', currency: 'EUR', label: 'EUR price change #1' },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, d = 2): string {
  if (v == null || !isFinite(v)) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtPct(v: number | null, d = 1): string {
  if (v == null || !isFinite(v)) return '—';
  return `${(v * 100).toFixed(d)}%`;
}

function Info({ text }: { text: string }) {
  return (
    <span className={styles.infoWrap}>
      <span className={styles.infoIcon}>i</span>
      <span className={styles.infoTip}>{text}</span>
    </span>
  );
}

function reliability(nBefore: number, nAfter: number): { nMin: number; level: string; emoji: string; cls: string } {
  const nMin = Math.min(nBefore, nAfter);
  if (nMin >= 300) return { nMin, level: 'Reliable',    emoji: '🟢', cls: styles.relReliable   };
  if (nMin >= 100) return { nMin, level: 'Acceptable',  emoji: '🟠', cls: styles.relAcceptable };
  if (nMin >= 30)  return { nMin, level: 'Indicative',  emoji: '🟡', cls: styles.relIndicative };
  return             { nMin, level: 'Unreliable',  emoji: '🔴', cls: styles.relUnreliable };
}

function epsClass(e: number): string {
  if (e < -1) return styles.epsElastic;
  if (e < 0)  return styles.epsInelastic;
  return styles.epsAnomalous;
}
function epsLabel(e: number): string {
  if (e < -1) return 'Elastic';
  if (e < 0)  return 'Inelastic';
  return 'Anomalous';
}

// ── SVG time-series chart ─────────────────────────────────────────────────────

function TimeSeriesChart({
  points, eventDate, yKey, yLabel, color, windowDays,
}: {
  points: DailyPoint[];
  eventDate: string;
  yKey: 'meanPrice' | 'nOrders';
  yLabel: string;
  color: string;
  windowDays: number;
}) {
  if (!points.length) return <div className={styles.noData}>No data</div>;

  const W = 540, H = 160, PL = 50, PR = 12, PT = 10, PB = 28;
  const cW = W - PL - PR, cH = H - PT - PB;

  const dates  = points.map(p => p.date);
  const values = points.map(p => p[yKey] as number);
  const minV = Math.min(...values), maxV = Math.max(...values);
  const rangeV = Math.max(maxV - minV, 1);

  const minD = dates[0], maxD = dates[dates.length - 1];
  const totalDays = Math.max(diffDays(minD, maxD), 1);

  const xS = (d: string) => ((diffDays(minD, d)) / totalDays) * cW;
  const yS = (v: number) => cH - ((v - minV) / rangeV) * cH;

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xS(p.date).toFixed(1)},${yS(p[yKey] as number).toFixed(1)}`).join(' ');
  const eventX = xS(eventDate);
  const inRange = diffDays(minD, eventDate) >= 0 && diffDays(eventDate, maxD) >= 0;

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => minV + f * rangeV);

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', maxWidth: '100%' }}>
      <g transform={`translate(${PL},${PT})`}>
        {/* Window shading */}
        {inRange && (
          <>
            <rect x={Math.max(0, eventX - (windowDays / totalDays) * cW)} y={0}
              width={(windowDays / totalDays) * cW} height={cH} fill="#EFF6FF" opacity={0.6} />
            <rect x={eventX} y={0}
              width={Math.min((windowDays / totalDays) * cW, cW - eventX)} height={cH} fill="#F0FDF4" opacity={0.6} />
          </>
        )}
        {/* Y grid */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={0} y1={yS(v)} x2={cW} y2={yS(v)} stroke="#F3F4F6" strokeWidth={1} />
            <text x={-6} y={yS(v) + 4} textAnchor="end" fontSize={9} fill="#9CA3AF">{fmt(v, yKey === 'meanPrice' ? 2 : 0)}</text>
          </g>
        ))}
        {/* Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} />
        {/* Event marker */}
        {inRange && <line x1={eventX} y1={0} x2={eventX} y2={cH} stroke="#7C3AED" strokeWidth={1.5} strokeDasharray="4,2" />}
        {/* X axis */}
        <line x1={0} y1={cH} x2={cW} y2={cH} stroke="#E5E7EB" />
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const d = new Date(new Date(minD + 'T00:00:00Z').getTime() + f * totalDays * 86400000);
          const label = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
          return (
            <g key={i} transform={`translate(${f * cW},${cH})`}>
              <line y2={4} stroke="#D1D5DB" />
              <text y={16} textAnchor="middle" fontSize={8} fill="#9CA3AF">{label.slice(5)}</text>
            </g>
          );
        })}
        {/* Y label */}
        <text transform={`translate(-38,${cH / 2}) rotate(-90)`} textAnchor="middle" fontSize={9} fill="#6B7280">{yLabel}</text>
      </g>
    </svg>
  );
}

// ── SVG revenue curve ─────────────────────────────────────────────────────────

function RevenueCurve({ epsilon, p0, q0, label, color }: { epsilon: number; p0: number; q0: number; label: string; color: string }) {
  if (!isFinite(epsilon) || p0 <= 0 || q0 <= 0) return <div className={styles.noData}>No data for revenue curve</div>;

  const W = 380, H = 180, PL = 50, PR = 20, PT = 20, PB = 30;
  const cW = W - PL - PR, cH = H - PT - PB;

  const pMin = 0.4 * p0, pMax = 2.2 * p0;
  const rev = (p: number) => p * q0 * Math.pow(p / p0, epsilon);
  const prices = Array.from({ length: 80 }, (_, i) => pMin + (i / 79) * (pMax - pMin));
  const revs   = prices.map(rev);
  const minR = Math.min(...revs), maxR = Math.max(...revs);
  const rangeR = Math.max(maxR - minR, 1);
  const rangeP = pMax - pMin;

  const xS = (p: number) => ((p - pMin) / rangeP) * cW;
  const yS = (r: number) => cH - ((r - minR) / rangeR) * cH;

  const pStar = epsilon < -1 ? p0 / (1 + 1 / epsilon) : null;

  const pathD = prices.map((p, i) => `${i === 0 ? 'M' : 'L'}${xS(p).toFixed(1)},${yS(rev(p)).toFixed(1)}`).join(' ');

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', maxWidth: '100%' }}>
      <g transform={`translate(${PL},${PT})`}>
        <path d={pathD} fill="none" stroke={color} strokeWidth={2} />
        {/* P₀ marker */}
        <line x1={xS(p0)} y1={0} x2={xS(p0)} y2={cH} stroke="#6B7280" strokeWidth={1} strokeDasharray="3,2" />
        <text x={xS(p0)} y={-5} textAnchor="middle" fontSize={9} fill="#6B7280">P₀</text>
        {/* P* marker */}
        {pStar != null && pStar >= pMin && pStar <= pMax && (
          <>
            <line x1={xS(pStar)} y1={0} x2={xS(pStar)} y2={cH} stroke="#7C3AED" strokeWidth={1.5} />
            <text x={xS(pStar)} y={-5} textAnchor="middle" fontSize={9} fill="#7C3AED" fontWeight="700">P*</text>
          </>
        )}
        {/* Axes */}
        <line x1={0} y1={cH} x2={cW} y2={cH} stroke="#E5E7EB" />
        <line x1={0} y1={0} x2={0} y2={cH} stroke="#E5E7EB" />
        <text x={cW / 2} y={cH + 20} textAnchor="middle" fontSize={9} fill="#9CA3AF">Price</text>
        <text transform={`translate(-38,${cH / 2}) rotate(-90)`} textAnchor="middle" fontSize={9} fill="#9CA3AF">Revenue</text>
      </g>
    </svg>
  );
}

// ── Residual scatter ──────────────────────────────────────────────────────────

function ResidualPlot({ fitted, residuals }: { fitted: number[]; residuals: number[] }) {
  if (!fitted.length) return null;
  const W = 280, H = 160, PL = 40, PR = 10, PT = 10, PB = 28;
  const cW = W - PL - PR, cH = H - PT - PB;
  const minF = Math.min(...fitted), maxF = Math.max(...fitted);
  const minR = Math.min(...residuals), maxR = Math.max(...residuals);
  const rf = Math.max(maxF - minF, 0.001), rr = Math.max(maxR - minR, 0.001);
  const xS = (v: number) => ((v - minF) / rf) * cW;
  const yS = (v: number) => cH - ((v - minR) / rr) * cH;
  const zeroY = yS(0);

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', maxWidth: '100%' }}>
      <g transform={`translate(${PL},${PT})`}>
        <line x1={0} y1={zeroY} x2={cW} y2={zeroY} stroke="#9CA3AF" strokeWidth={1} strokeDasharray="3,2" />
        {fitted.map((f, i) => (
          <circle key={i} cx={xS(f)} cy={yS(residuals[i])} r={2} fill="#6366F1" opacity={0.5} />
        ))}
        <line x1={0} y1={cH} x2={cW} y2={cH} stroke="#E5E7EB" />
        <text x={cW / 2} y={cH + 18} textAnchor="middle" fontSize={9} fill="#9CA3AF">Fitted log(Q)</text>
        <text transform={`translate(-30,${cH / 2}) rotate(-90)`} textAnchor="middle" fontSize={9} fill="#9CA3AF">Residual</text>
      </g>
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Filters {
  zone: string;
  currency: 'EUR' | 'USD' | 'Both';
  planGb: string;
  channel: 'All' | 'Organic' | 'Partnership';
  partner: string;
  customerType: 'All' | 'New' | 'Returning';
  hasDiscount: 'All' | 'With' | 'Without';
  windowWeeks: number;
  dateFrom: string;
  dateTo: string;
}

interface RawData {
  points: DailyPoint[];
  dateRange: { from: string; to: string };
  queryUsed: string;
}

interface MetaData { zones: string[]; planGbs: number[]; partners: string[]; }

const DEFAULT_FILTERS: Filters = {
  zone: 'All', currency: 'Both', planGb: 'All',
  channel: 'All', partner: 'All',
  customerType: 'All', hasDiscount: 'All',
  windowWeeks: 4,
  dateFrom: '2026-01-01',
  dateTo: new Date().toISOString().split('T')[0],
};

// ── Main component ────────────────────────────────────────────────────────────

export default function Elasticity() {
  const [meta,    setMeta]    = useState<MetaData | null>(null);
  const [rawData, setRawData] = useState<RawData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [pending, setPending] = useState<Filters>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState<Filters>(DEFAULT_FILTERS);
  const [openSections, setOpen] = useState(new Set(['s0', 's1', 's2', 's3', 's4', 's5', 's6']));

  const toggleSection = (id: string) => setOpen(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Fetch meta on mount
  useEffect(() => {
    fetch('/api/elasticity/meta')
      .then(r => r.json()).then(setMeta).catch(() => {});
  }, []);

  // Fetch data when applied filters change
  useEffect(() => {
    setLoading(true); setError(null);
    const f = applied;
    const params = new URLSearchParams({
      dateFrom: f.dateFrom, dateTo: f.dateTo,
      ...(f.zone !== 'All' && { zone: f.zone }),
      ...(f.currency !== 'Both' && { currency: f.currency }),
      ...(f.planGb !== 'All' && { planGb: f.planGb }),
      ...(f.channel !== 'All' && { channel: f.channel }),
      ...(f.partner !== 'All' && { partner: f.partner }),
      ...(f.customerType !== 'All' && { customerType: f.customerType }),
      ...(f.hasDiscount !== 'All' && { hasDiscount: f.hasDiscount }),
    });
    fetch(`/api/elasticity/data?${params}`)
      .then(r => { if (!r.ok) throw new Error('Network error'); return r.json(); })
      .then(setRawData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [applied]);

  // ── Compute all statistics ────────────────────────────────────────────────

  const computation = useMemo(() => {
    if (!rawData || !rawData.points.length) return null;
    const pts = rawData.points;
    const wd  = 7 * applied.windowWeeks - 1; // equal weekday distribution per window

    // Filter points by currency for each event
    function eventPoints(eventCurrency: string): DailyPoint[] {
      if (applied.currency === 'Both') {
        return pts.filter(p => eventCurrency === 'EUR' ? p.exchangeRate === 1 : p.exchangeRate !== 1);
      }
      return pts;
    }

    // Aggregate by date (sum nOrders, weighted mean price)
    function aggByDate(points: DailyPoint[]): DailyPoint[] {
      const map = new Map<string, DailyPoint>();
      for (const p of points) {
        const e = map.get(p.date);
        if (!e) { map.set(p.date, { ...p }); continue; }
        const totalOrders = e.nOrders + p.nOrders;
        e.meanPrice        = (e.meanPrice * e.nOrders + p.meanPrice * p.nOrders) / totalOrders;
        e.meanCatalogPrice = (e.meanCatalogPrice * e.nOrders + p.meanCatalogPrice * p.nOrders) / totalOrders;
        e.nOrders          = totalOrders;
        e.nDiscounted      += p.nDiscounted;
      }
      return [...map.values()].sort((a, b) => a.date < b.date ? -1 : 1);
    }

    // Event analysis
    const events = PRICE_EVENTS.map(ev => {
      const filtered = aggByDate(eventPoints(ev.currency));
      const before = filtered.filter(p => diffDays(p.date, ev.date) > 0 && diffDays(p.date, ev.date) <= wd);
      const after  = filtered.filter(p => diffDays(ev.date, p.date) > 0 && diffDays(ev.date, p.date) <= wd);

      const pBefore  = mean(before.map(p => p.meanPrice));
      const pAfter   = mean(after.map(p => p.meanPrice));
      const qBefore  = before.reduce((s, p) => s + p.nOrders, 0);
      const qAfter   = after.reduce((s, p) => s + p.nOrders, 0);
      const nBefore  = before.reduce((s, p) => s + p.nOrders, 0);
      const nAfter   = after.reduce((s, p) => s + p.nOrders, 0);

      const deltaP = pBefore > 0 ? (pAfter - pBefore) / pBefore : null;
      const deltaQ = qBefore > 0 ? (qAfter - qBefore) / qBefore : null;
      const epsilon = deltaP != null && deltaQ != null && Math.abs(deltaP) > 0.0001 ? deltaQ / deltaP : null;

      const ci = epsilon != null ? bootstrapElasticityCI(before, after) : null;
      const rel = reliability(nBefore, nAfter);

      return { event: ev, before, after, pBefore, pAfter, qBefore, qAfter, nBefore, nAfter, deltaP, deltaQ, epsilon, ci, rel };
    });

    // Combined epsilon (volume-weighted average across events)
    const validEvts = events.filter(e => e.epsilon != null && isFinite(e.epsilon));
    const totalVol  = validEvts.reduce((s, e) => s + e.nBefore + e.nAfter, 0);
    const combinedEps = totalVol > 0
      ? validEvts.reduce((s, e) => s + (e.epsilon! * (e.nBefore + e.nAfter)), 0) / totalVol
      : null;

    // Method B — OLS log-log with all data aggregated by date
    const allAgg = aggByDate(pts);
    const olsInput = buildLogLogMatrix(allAgg);
    const olsRes: OLSResult | null = olsInput ? ols(olsInput.X, olsInput.y) : null;
    const olsEps   = olsRes ? olsRes.beta[1] : null;    // coefficient on log(P)
    const olsSE    = olsRes ? olsRes.stdErrors[1] : null;
    const olsCI: [number, number] | null = olsEps != null && olsSE != null
      ? [olsEps - 1.96 * olsSE, olsEps + 1.96 * olsSE]
      : null;
    const olsPVal  = olsRes ? olsRes.pValues[1] : null;

    // Revenue curve reference
    const refPts = aggByDate(pts);
    const p0 = mean(refPts.map(p => p.meanPrice));
    const q0 = mean(refPts.map(p => p.nOrders));

    return { events, combinedEps, olsRes, olsEps, olsSE, olsCI, olsPVal, allAgg, p0, q0 };
  }, [rawData, applied.windowWeeks, applied.currency]);

  // ── Render ────────────────────────────────────────────────────────────────

  function SectionHeader({ id, title, badge }: { id: string; title: string; badge?: React.ReactNode }) {
    const open = openSections.has(id);
    return (
      <div className={styles.sectionHeader} onClick={() => toggleSection(id)}>
        <span className={styles.sectionTitle}>{title}</span>
        {badge}
        <span className={`${styles.sectionArrow} ${open ? styles.sectionArrowOpen : ''}`}>▶</span>
      </div>
    );
  }

  function Toggle({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
    return (
      <div className={styles.toggleGroup}>
        {options.map(o => (
          <button key={o} className={`${styles.toggleBtn} ${value === o ? styles.toggleBtnActive : ''}`} onClick={() => onChange(o)}>{o}</button>
        ))}
      </div>
    );
  }

  const validPts = rawData?.points ?? [];
  const totalRows = validPts.reduce((s, p) => s + p.nOrders, 0);

  return (
    <div className={styles.page}>

      {/* ── Named constants display ─────────────────────────────────────── */}
      <div className={styles.eventsBar}>
        <span className={styles.eventsBarTitle}>Price change events (named constants):</span>
        {PRICE_EVENTS.map(e => (
          <span key={e.id} className={styles.eventPill}>{e.id} = {e.date} ({e.currency})</span>
        ))}
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Date from</span>
          <input type="date" className={styles.filterInput} value={pending.dateFrom}
            onChange={e => setPending(p => ({ ...p, dateFrom: e.target.value }))} />
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Date to</span>
          <input type="date" className={styles.filterInput} value={pending.dateTo}
            onChange={e => setPending(p => ({ ...p, dateTo: e.target.value }))} />
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Zone</span>
          <select className={styles.filterSelect} value={pending.zone} onChange={e => setPending(p => ({ ...p, zone: e.target.value }))}>
            <option value="All">All zones</option>
            {(meta?.zones ?? []).map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Currency</span>
          <Toggle value={pending.currency} options={['EUR', 'USD', 'Both']} onChange={v => setPending(p => ({ ...p, currency: v as Filters['currency'] }))} />
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Plan (GB)</span>
          <select className={styles.filterSelect} value={pending.planGb} onChange={e => setPending(p => ({ ...p, planGb: e.target.value }))}>
            <option value="All">All</option>
            {(meta?.planGbs ?? []).map(g => <option key={g} value={String(g)}>{g} GB</option>)}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Channel</span>
          <Toggle value={pending.channel} options={['All', 'Organic', 'Partnership']} onChange={v => setPending(p => ({ ...p, channel: v as Filters['channel'], partner: 'All' }))} />
          {pending.channel === 'Partnership' && (
            <select className={styles.filterSelect} style={{ marginTop: 4 }} value={pending.partner} onChange={e => setPending(p => ({ ...p, partner: e.target.value }))}>
              <option value="All">All partners</option>
              {(meta?.partners ?? []).map(pt => <option key={pt} value={pt}>{pt}</option>)}
            </select>
          )}
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Customer type</span>
          <Toggle value={pending.customerType} options={['All', 'New', 'Returning']} onChange={v => setPending(p => ({ ...p, customerType: v as Filters['customerType'] }))} />
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Discount</span>
          <Toggle value={pending.hasDiscount} options={['All', 'With', 'Without']} onChange={v => setPending(p => ({ ...p, hasDiscount: v as Filters['hasDiscount'] }))} />
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Window — {pending.windowWeeks}w ({7 * pending.windowWeeks - 1} days)</span>
          <input type="range" min={1} max={12} step={1} value={pending.windowWeeks} className={styles.windowSlider}
            onChange={e => setPending(p => ({ ...p, windowWeeks: Number(e.target.value) }))} />
        </div>
        <button className={styles.applyBtn} onClick={() => setApplied(pending)} disabled={loading}>Apply</button>
      </div>

      {loading && <div style={{ padding: 20, color: 'var(--color-text-secondary)' }}>Loading data…</div>}
      {error   && <div style={{ padding: 20, color: '#991B1B' }}>Error: {error}</div>}

      {rawData && !loading && (
        <>
          {/* ── Section 0 — Data Snapshot ─────────────────────────────── */}
          <div className={styles.section}>
            <SectionHeader id="s0" title="Section 0 — Active Filters & Data Snapshot" />
            {openSections.has('s0') && (
              <div className={styles.sectionBody}>
                <div className={styles.snapshotGrid}>
                  <div className={styles.snapshotCard}><span className={styles.snapshotLabel}>Total orders</span><span className={styles.snapshotValue}>{totalRows.toLocaleString('en-US')}</span></div>
                  <div className={styles.snapshotCard}><span className={styles.snapshotLabel}>Daily rows</span><span className={styles.snapshotValue}>{validPts.length.toLocaleString('en-US')}</span><span className={styles.snapshotSub}>aggregated</span></div>
                  <div className={styles.snapshotCard}><span className={styles.snapshotLabel}>Date range</span><span className={styles.snapshotValue} style={{ fontSize: 13 }}>{rawData.dateRange.from}</span><span className={styles.snapshotSub}>→ {rawData.dateRange.to}</span></div>
                  <div className={styles.snapshotCard}><span className={styles.snapshotLabel}>Window</span><span className={styles.snapshotValue}>{applied.windowWeeks}w</span><span className={styles.snapshotSub}>{7 * applied.windowWeeks - 1} days, event day excluded</span></div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
                  {Object.entries(applied).map(([k, v]) => v !== 'All' && v !== 'Both' && (
                    <span key={k} style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '2px 10px', color: '#1D4ED8' }}>
                      <strong>{k}:</strong> {String(v)}
                    </span>
                  ))}
                </div>
                <details className={styles.queryCollapse}>
                  <summary>Show SQL query</summary>
                  <pre className={styles.queryCode}>{rawData.queryUsed}</pre>
                </details>
              </div>
            )}
          </div>

          {/* ── Section 1 — Price Change Detection ──────────────────────── */}
          <div className={styles.section}>
            <SectionHeader id="s1" title="Section 1 — Price Change Detection" />
            {openSections.has('s1') && (
              <div className={styles.sectionBody}>
                <div className={styles.formulaBox}>
                  <p className={styles.formulaTitle}>Formula</p>
                  <pre className={styles.formulaCode}>{'ΔP/P = (P_after − P_before) / P_before'}</pre>
                  <p className={styles.assumptionsList as unknown as string} style={{ fontSize: 12, color: '#374151', margin: '4px 0 0 0' }}>
                    P_before and P_after are the mean of order_total_amount in the {applied.windowWeeks}-week window ({7 * applied.windowWeeks - 1} days) before and after each event date. The event day itself is excluded.
                  </p>
                </div>
                <div className={styles.eventGrid}>
                  {(computation?.events ?? []).filter(ev =>
                    applied.currency === 'Both' || applied.currency === ev.event.currency
                  ).map(ev => (
                    <div key={ev.event.id} className={styles.eventBlock}>
                      <div className={styles.eventBlockHeader}>
                        <span className={styles.eventBlockTitle}>{ev.event.label}</span>
                        <span style={{ fontSize: 11, color: '#1D4ED8' }}>{ev.event.date} · {ev.event.currency}</span>
                      </div>
                      <div className={styles.eventBlockBody}>
                        <TimeSeriesChart points={rawData.points.filter(p =>
                          ev.event.currency === 'EUR' ? p.exchangeRate === 1 : p.exchangeRate !== 1)}
                          eventDate={ev.event.date} yKey="meanPrice" yLabel="Mean price" color="#6366F1" windowDays={7 * applied.windowWeeks - 1} />
                        <div className={styles.metricRow}>
                          <div className={styles.metricCard}><span className={styles.metricCardLabel}>P_before</span><span className={styles.metricCardValue}>{fmt(ev.pBefore)}</span></div>
                          <div className={styles.metricCard}><span className={styles.metricCardLabel}>P_after</span><span className={styles.metricCardValue}>{fmt(ev.pAfter)}</span></div>
                          <div className={styles.metricCard}><span className={styles.metricCardLabel}>ΔP/P</span><span className={styles.metricCardValue}>{ev.deltaP != null ? fmtPct(ev.deltaP) : '—'}</span></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Section 2 — Volume Change ─────────────────────────────────── */}
          <div className={styles.section}>
            <SectionHeader id="s2" title="Section 2 — Volume Change Around Each Price Event" />
            {openSections.has('s2') && (
              <div className={styles.sectionBody}>
                <div className={styles.formulaBox}>
                  <p className={styles.formulaTitle}>Formula</p>
                  <pre className={styles.formulaCode}>{'ΔQ/Q = (Q_after − Q_before) / Q_before'}</pre>
                  <p style={{ fontSize: 12, color: '#374151', margin: '4px 0 0 0' }}>
                    Q = total orders in the {applied.windowWeeks}-week window ({7 * applied.windowWeeks - 1} days). Event day excluded. Equal number of weekdays in each window.
                  </p>
                </div>
                <div className={styles.eventGrid}>
                  {(computation?.events ?? []).filter(ev =>
                    applied.currency === 'Both' || applied.currency === ev.event.currency
                  ).map(ev => {
                    const rel = ev.rel;
                    return (
                      <div key={ev.event.id} className={styles.eventBlock}>
                        <div className={styles.eventBlockHeader}>
                          <span className={styles.eventBlockTitle}>{ev.event.label}</span>
                          <span className={`${styles.relBadge} ${rel.cls}`}>{rel.emoji} {rel.level} (N_min = {rel.nMin.toLocaleString('en-US')})</span>
                        </div>
                        <div className={styles.eventBlockBody}>
                          <TimeSeriesChart points={rawData.points.filter(p =>
                            ev.event.currency === 'EUR' ? p.exchangeRate === 1 : p.exchangeRate !== 1)}
                            eventDate={ev.event.date} yKey="nOrders" yLabel="Orders/day" color="#22C55E" windowDays={7 * applied.windowWeeks - 1} />
                          <div className={styles.metricRow}>
                            <div className={styles.metricCard}><span className={styles.metricCardLabel}>Q_before</span><span className={styles.metricCardValue}>{ev.qBefore.toLocaleString('en-US')}</span><span className={styles.metricCardSub}>orders total</span></div>
                            <div className={styles.metricCard}><span className={styles.metricCardLabel}>Q_after</span><span className={styles.metricCardValue}>{ev.qAfter.toLocaleString('en-US')}</span></div>
                            <div className={styles.metricCard}><span className={styles.metricCardLabel}>ΔQ/Q</span><span className={styles.metricCardValue}>{ev.deltaQ != null ? fmtPct(ev.deltaQ) : '—'}</span></div>
                          </div>
                          {rel.level === 'Unreliable' && (
                            <div style={{ fontSize: 12, color: '#991B1B', background: '#FEE2E2', borderRadius: 6, padding: '6px 12px' }}>
                              ⚠️ N_min {'<'} 30 — do not use for pricing decisions
                            </div>
                          )}

                          {/* DEBUG — rows summed into Q_before and Q_after */}
                          <details style={{ marginTop: 8 }}>
                            <summary style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', cursor: 'pointer' }}>
                              [DEBUG] Raw rows — before ({ev.before.length} days) / after ({ev.after.length} days)
                            </summary>
                            {(() => {
                              const wd = 7 * applied.windowWeeks - 1;
                              const shift = (d: string, n: number) => {
                                const dt = new Date(d + 'T00:00:00Z');
                                dt.setUTCDate(dt.getUTCDate() + n);
                                return dt.toISOString().split('T')[0];
                              };
                              const rateFilter = ev.event.currency === 'EUR'
                                ? `ROUND(order_currency_exchange_rate, 2) = 1.0`
                                : `ROUND(order_currency_exchange_rate, 2) != 1.0`;
                              const beforeFrom = shift(ev.event.date, -wd);
                              const beforeTo   = shift(ev.event.date, -1);
                              const afterFrom  = shift(ev.event.date, +1);
                              const afterTo    = shift(ev.event.date, +wd);
                              return (
                                <pre style={{ fontSize: 10, background: '#1E1E2E', color: '#CDD6F4', borderRadius: 6, padding: '8px 12px', margin: '8px 0 4px', overflowX: 'auto', lineHeight: 1.5 }}>
{`-- BEFORE (wd = ${wd} days)
DATE(created_at) BETWEEN '${beforeFrom}' AND '${beforeTo}'
AND ${rateFilter}

-- AFTER (wd = ${wd} days)
DATE(created_at) BETWEEN '${afterFrom}' AND '${afterTo}'
AND ${rateFilter}`}
                                </pre>
                              );
                            })()}
                            <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                              {(['before', 'after'] as const).map(period => {
                                const rows = period === 'before' ? ev.before : ev.after;
                                const total = rows.reduce((s, p) => s + p.nOrders, 0);
                                return (
                                  <table key={period} style={{ borderCollapse: 'collapse', fontSize: 11, flex: 1, minWidth: 240 }}>
                                    <thead>
                                      <tr style={{ background: '#F3F4F6' }}>
                                        <th colSpan={3} style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 700, color: period === 'before' ? '#1D4ED8' : '#15803D' }}>
                                          {period.toUpperCase()} — {rows.length} days — total: {total.toLocaleString('en-US')} orders
                                        </th>
                                      </tr>
                                      <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                                        <th style={{ padding: '3px 8px', textAlign: 'left', fontWeight: 600 }}>Date</th>
                                        <th style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 600 }}>n_orders</th>
                                        <th style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 600 }}>rate</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {rows.length === 0
                                        ? <tr><td colSpan={3} style={{ padding: '4px 8px', color: '#EF4444' }}>empty — no rows in window</td></tr>
                                        : rows.map(p => (
                                          <tr key={p.date} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                            <td style={{ padding: '2px 8px', fontFamily: 'monospace' }}>{p.date}</td>
                                            <td style={{ padding: '2px 8px', textAlign: 'right' }}>{p.nOrders.toLocaleString('en-US')}</td>
                                            <td style={{ padding: '2px 8px', textAlign: 'right', color: '#9CA3AF' }}>{p.exchangeRate}</td>
                                          </tr>
                                        ))
                                      }
                                    </tbody>
                                  </table>
                                );
                              })}
                            </div>
                          </details>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Section 3 — Elasticity Estimation ───────────────────────── */}
          <div className={styles.section}>
            <SectionHeader id="s3" title="Section 3 — Elasticity Estimation" />
            {openSections.has('s3') && (
              <div className={styles.sectionBody}>
                <div className={styles.methodGrid}>
                  {/* Method A */}
                  <div className={styles.methodPanel}>
                    <div className={`${styles.methodPanelHeader} ${styles.methodAHeader}`}>
                      Method A — Simple Point Elasticity
                      <Info text="Direct ratio of percentage change in quantity to percentage change in price. Fast but assumes no confounders." />
                    </div>
                    <div className={styles.methodPanelBody}>
                      <div className={styles.formulaBox}>
                        <p className={styles.formulaTitle}>Formula</p>
                        <pre className={styles.formulaCode}>{'ε = (ΔQ/Q) / (ΔP/P)\n  = [(Q_after − Q_before) / Q_before]\n  / [(P_after − P_before) / P_before]'}</pre>
                        <ul className={styles.assumptionsList}>
                          <li>Assumes all other factors constant in the window</li>
                          <li>Does not control for seasonality or trend</li>
                          <li>Uses raw daily volume averages</li>
                        </ul>
                      </div>
                      {(computation?.events ?? []).filter(ev =>
                        applied.currency === 'Both' || applied.currency === ev.event.currency
                      ).map(ev => (
                        <div key={ev.event.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{ev.event.label}</span>
                          {ev.epsilon != null ? (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                              <span className={`${styles.epsBadge} ${epsClass(ev.epsilon)}`}>ε = {fmt(ev.epsilon, 3)} · {epsLabel(ev.epsilon)}</span>
                              {ev.ci && <span style={{ fontSize: 11, color: '#6B7280' }}>95% CI [{fmt(ev.ci[0], 2)}, {fmt(ev.ci[1], 2)}] (bootstrap, B=1000)</span>}
                            </div>
                          ) : <span style={{ fontSize: 12, color: '#9CA3AF' }}>Insufficient data (ΔP ≈ 0 or no orders)</span>}
                        </div>
                      ))}
                      {computation?.combinedEps != null && (
                        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>Combined ε (volume-weighted): </span>
                          <span className={`${styles.epsBadge} ${epsClass(computation.combinedEps)}`}>
                            {fmt(computation.combinedEps, 3)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Method B */}
                  <div className={styles.methodPanel}>
                    <div className={`${styles.methodPanelHeader} ${styles.methodBHeader}`}>
                      Method B — OLS Log-Log Regression with Controls
                      <Info text="Estimates elasticity as the coefficient on log(P) in a log-log model with seasonality and trend controls." />
                    </div>
                    <div className={styles.methodPanelBody}>
                      <div className={styles.formulaBox}>
                        <p className={styles.formulaTitle}>Formula</p>
                        <pre className={styles.formulaCode}>{'log(Q_t) = α + ε·log(P_t) + β₁·week_t\n         + β₂·month_t + β₃·has_promo_t + e_t'}</pre>
                        <ul className={styles.assumptionsList}>
                          <li>Log-log: constant elasticity across price range</li>
                          <li>Week number captures linear time trend</li>
                          <li>Month dummies capture monthly seasonality</li>
                          <li>has_promo controls promotional activity</li>
                          <li>OLS: homoscedastic residuals assumed</li>
                        </ul>
                      </div>
                      {computation?.olsRes ? (
                        <>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            {computation.olsEps != null && <span className={`${styles.epsBadge} ${epsClass(computation.olsEps)}`}>ε = {fmt(computation.olsEps, 3)} · {epsLabel(computation.olsEps)}</span>}
                            {computation.olsCI && <span style={{ fontSize: 11, color: '#6B7280' }}>95% CI [{fmt(computation.olsCI[0], 2)}, {fmt(computation.olsCI[1], 2)}]</span>}
                          </div>
                          <table className={styles.coeffTable}>
                            <thead>
                              <tr><th>Variable</th><th>β</th><th>SE</th><th>t</th><th>p</th></tr>
                            </thead>
                            <tbody>
                              {computation.olsRes.beta.map((b, j) => {
                                const sig = (computation.olsRes!.pValues[j] ?? 1) < 0.05;
                                return (
                                  <tr key={j} className={j === 1 ? styles.coeffHighlight : ''}>
                                    <td>{OLS_COL_NAMES[j] ?? `β${j}`}</td>
                                    <td>{fmt(b, 4)}</td>
                                    <td>{fmt(computation.olsRes!.stdErrors[j], 4)}</td>
                                    <td>{fmt(computation.olsRes!.tStats[j], 2)}</td>
                                    <td className={sig ? styles.pSig : styles.pInsig}>{fmt(computation.olsRes!.pValues[j], 4)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          <div style={{ display: 'flex', gap: 14, fontSize: 12, flexWrap: 'wrap' }}>
                            <span>R² = <strong>{fmt(computation.olsRes.rSquared, 3)}</strong></span>
                            <span>Adj. R² = <strong>{fmt(computation.olsRes.adjRSquared, 3)}</strong></span>
                            <span>Durbin-Watson = <strong>{fmt(computation.olsRes.durbinWatson, 2)}</strong>
                              <Info text="Durbin-Watson ≈ 2 → no autocorrelation. < 1.5 → positive autocorrelation. > 2.5 → negative." /></span>
                            <span>n = <strong>{computation.olsRes.n}</strong></span>
                          </div>
                          <div>
                            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', margin: '0 0 6px' }}>RESIDUAL PLOT</p>
                            <ResidualPlot fitted={computation.olsRes.fitted} residuals={computation.olsRes.residuals} />
                          </div>
                        </>
                      ) : (
                        <div className={styles.noData}>Not enough data for OLS (need ≥ {OLS_COL_NAMES.length + 2} daily observations)</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Section 4 — Reliability ──────────────────────────────────── */}
          <div className={styles.section}>
            <SectionHeader id="s4" title="Section 4 — Reliability Score" />
            {openSections.has('s4') && (
              <div className={styles.sectionBody}>
                <div className={styles.formulaBox}>
                  <p className={styles.formulaTitle}>Thresholds</p>
                  <pre className={styles.formulaCode}>{'N_min = min(N_before, N_after)\n\nN_min < 30         → 🔴 Unreliable  — do not use\n30  ≤ N_min < 100  → 🟡 Indicative  — direction likely correct\n100 ≤ N_min < 300  → 🟠 Acceptable  — usable with caution\nN_min ≥ 300        → 🟢 Reliable    — tight confidence interval'}</pre>
                </div>
                <div className={styles.formulaBox}>
                  <p className={styles.formulaTitle}>Bootstrap CI (Method A) — Procedure</p>
                  <pre className={styles.formulaCode}>{'1. Resample pre-event and post-event windows with replacement (B = 1000)\n2. Compute ε_b for each bootstrap sample\n3. IC_95% = [percentile(ε_b, 2.5), percentile(ε_b, 97.5)]'}</pre>
                </div>
                <div className={styles.formulaBox}>
                  <p className={styles.formulaTitle}>OLS Regression CI (Method B)</p>
                  <pre className={styles.formulaCode}>{'IC_95%(ε) = ε̂ ± 1.96 × SE(ε̂)'}</pre>
                </div>
                {(computation?.events ?? []).filter(ev =>
                  applied.currency === 'Both' || applied.currency === ev.event.currency
                ).map(ev => {
                  const r = ev.rel;
                  return (
                    <div key={ev.event.id} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, minWidth: 180 }}>{ev.event.label}</span>
                      <span className={`${styles.relBadge} ${r.cls}`}>{r.emoji} {r.level}</span>
                      <span style={{ fontSize: 12, color: '#6B7280' }}>N_before = {ev.nBefore.toLocaleString()} · N_after = {ev.nAfter.toLocaleString()} · N_min = {r.nMin.toLocaleString()}</span>
                      {ev.ci && <span style={{ fontSize: 12, color: '#374151' }}>Bootstrap 95% CI: [{fmt(ev.ci[0], 3)}, {fmt(ev.ci[1], 3)}]</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Section 5 — Revenue Optimization Curve ───────────────────── */}
          <div className={styles.section}>
            <SectionHeader id="s5" title="Section 5 — Revenue Optimization Curve" />
            {openSections.has('s5') && computation && (
              <div className={styles.sectionBody}>
                <div className={styles.formulaBox}>
                  <p className={styles.formulaTitle}>Model</p>
                  <pre className={styles.formulaCode}>{'Revenue(P) = P × Q(P)\n           = P × Q₀ × (P / P₀)^ε\n\nP* = P₀ / (1 + 1/ε)    [valid only when ε < −1]'}</pre>
                  <p style={{ fontSize: 12, color: '#374151', margin: '4px 0 0' }}>Q₀ = mean daily volume · P₀ = mean price (current reference)</p>
                </div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  {computation.combinedEps != null && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Method A (ε = {fmt(computation.combinedEps, 3)})</p>
                      <RevenueCurve epsilon={computation.combinedEps} p0={computation.p0} q0={computation.q0} label="Method A" color="#22C55E" />
                      {computation.combinedEps >= -1 && <div style={{ fontSize: 12, color: '#92400E', marginTop: 6, background: '#FEF3C7', borderRadius: 6, padding: '6px 10px' }}>Demand is inelastic — raising prices increases revenue.</div>}
                      {computation.combinedEps < -1 && <div style={{ fontSize: 12, color: '#065F46', marginTop: 6, background: '#D1FAE5', borderRadius: 6, padding: '6px 10px' }}>P* = {fmt(computation.p0 / (1 + 1 / computation.combinedEps))} — revenue-maximising price (shown in purple).</div>}
                    </div>
                  )}
                  {computation.olsEps != null && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Method B (ε = {fmt(computation.olsEps, 3)})</p>
                      <RevenueCurve epsilon={computation.olsEps} p0={computation.p0} q0={computation.q0} label="Method B" color="#6366F1" />
                      {computation.olsEps >= -1 && <div style={{ fontSize: 12, color: '#92400E', marginTop: 6, background: '#FEF3C7', borderRadius: 6, padding: '6px 10px' }}>Demand is inelastic — raising prices increases revenue.</div>}
                      {computation.olsEps < -1 && <div style={{ fontSize: 12, color: '#065F46', marginTop: 6, background: '#D1FAE5', borderRadius: 6, padding: '6px 10px' }}>P* = {fmt(computation.p0 / (1 + 1 / computation.olsEps))} — revenue-maximising price.</div>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Section 6 — Summary ──────────────────────────────────────── */}
          <div className={styles.section}>
            <SectionHeader id="s6" title="Section 6 — Method Comparison Summary" />
            {openSections.has('s6') && computation && (
              <div className={styles.sectionBody}>
                <table className={styles.compTable}>
                  <thead><tr><th>Dimension</th><th>Method A (Point Elasticity)</th><th>Method B (OLS Log-Log)</th></tr></thead>
                  <tbody>
                    <tr>
                      <td>Elasticity ε</td>
                      <td>{computation.combinedEps != null ? <span className={`${styles.epsBadge} ${epsClass(computation.combinedEps)}`}>{fmt(computation.combinedEps, 3)}</span> : '—'}</td>
                      <td>{computation.olsEps != null ? <span className={`${styles.epsBadge} ${epsClass(computation.olsEps)}`}>{fmt(computation.olsEps, 3)}</span> : '—'}</td>
                    </tr>
                    <tr>
                      <td>95% CI</td>
                      <td style={{ fontSize: 11 }}>{(() => { const evs = (computation.events ?? []).filter(e => e.ci); return evs.length ? evs.map(e => `[${fmt(e.ci![0], 2)}, ${fmt(e.ci![1], 2)}]`).join(' · ') : '—'; })()}</td>
                      <td style={{ fontSize: 11 }}>{computation.olsCI ? `[${fmt(computation.olsCI[0], 2)}, ${fmt(computation.olsCI[1], 2)}]` : '—'}</td>
                    </tr>
                    <tr><td>R²</td><td>—</td><td>{computation.olsRes ? fmt(computation.olsRes.rSquared, 3) : '—'}</td></tr>
                    <tr><td>Controls seasonality</td><td>❌</td><td>✅ (month dummies)</td></tr>
                    <tr><td>Controls trend</td><td>❌</td><td>✅ (week number)</td></tr>
                    <tr><td>Controls promotions</td><td>❌</td><td>✅ (has_promo dummy)</td></tr>
                    <tr><td>Interpretability</td><td>High — direct ratio</td><td>Medium — regression coefficient</td></tr>
                    <tr><td>Recommended use</td><td>Quick check / directional signal</td><td>Pricing decisions</td></tr>
                  </tbody>
                </table>

                {/* Auto-generated interpretation */}
                {computation.combinedEps != null && (
                  <div className={styles.interpretation}>
                    {(() => {
                      const eA = computation.combinedEps!;
                      const eB = computation.olsEps;
                      const epsStr = eB != null ? `ε ≈ ${fmt(eA, 2)} (A) / ${fmt(eB, 2)} (B)` : `ε ≈ ${fmt(eA, 2)} (A)`;
                      const agree = eB != null && Math.sign(eA) === Math.sign(eB) ? 'Both methods agree on ' : 'Methods diverge: ';
                      const demandType = eA < -1 ? 'elastic' : eA < 0 ? 'inelastic' : 'anomalous';
                      const rSqStr = computation.olsRes ? `. The OLS model explains ${(computation.olsRes.rSquared * 100).toFixed(0)}% of variance` : '';
                      const rel = (computation.events ?? []).filter(e => e.epsilon != null)[0]?.rel;
                      const relStr = rel ? `. Reliability: ${rel.emoji} ${rel.level} (N_min = ${rel.nMin.toLocaleString()})` : '';
                      const priceChange = 10;
                      const volChgA = ((Math.pow(1.1, eA) - 1) * 100).toFixed(1);
                      const revChgA = ((Math.pow(1.1, 1 + eA) - 1) * 100).toFixed(1);
                      return `${agree}${demandType} demand (${epsStr})${rSqStr}${relStr}. Raising prices by ${priceChange}% is estimated to change volume by ${volChgA}%, resulting in a net revenue change of approximately ${revChgA}%.`;
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {!loading && !rawData && !error && (
        <div className={styles.noData} style={{ padding: 40 }}>Click Apply to load data and begin elasticity analysis.</div>
      )}
    </div>
  );
}
