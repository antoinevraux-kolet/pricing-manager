import { Fragment, useState, useEffect } from 'react';
import type { OrderComparisonData, OrderComparisonRow, DestinationVisitsData, OrderObservationData, OrderObservationRow, DestinationVisitsSingleData } from '../App';
import styles from './ComparisonTable.module.css';

const ZONE_LABELS: Record<string, { name: string; flag: string }> = {
  ALB: { name: 'Albania',                          flag: '🇦🇱' },
  AND: { name: 'Andorra',                          flag: '🇦🇩' },
  AUT: { name: 'Austria',                          flag: '🇦🇹' },
  BEL: { name: 'Belgium',                          flag: '🇧🇪' },
  BGR: { name: 'Bulgaria',                         flag: '🇧🇬' },
  BIH: { name: 'Bosnia and Herzegovina',           flag: '🇧🇦' },
  BLR: { name: 'Belarus',                          flag: '🇧🇾' },
  CHE: { name: 'Switzerland',                      flag: '🇨🇭' },
  CYP: { name: 'Cyprus',                           flag: '🇨🇾' },
  CZE: { name: 'Czech Republic',                   flag: '🇨🇿' },
  DEU: { name: 'Germany',                          flag: '🇩🇪' },
  DNK: { name: 'Denmark',                          flag: '🇩🇰' },
  ESP: { name: 'Spain',                            flag: '🇪🇸' },
  EST: { name: 'Estonia',                          flag: '🇪🇪' },
  FIN: { name: 'Finland',                          flag: '🇫🇮' },
  FRA: { name: 'France',                           flag: '🇫🇷' },
  FRO: { name: 'Faroe Islands',                    flag: '🇫🇴' },
  GBR: { name: 'United Kingdom',                   flag: '🇬🇧' },
  GIB: { name: 'Gibraltar',                        flag: '🇬🇮' },
  GRC: { name: 'Greece',                           flag: '🇬🇷' },
  GRL: { name: 'Greenland',                        flag: '🇬🇱' },
  HRV: { name: 'Croatia',                          flag: '🇭🇷' },
  HUN: { name: 'Hungary',                          flag: '🇭🇺' },
  IRL: { name: 'Ireland',                          flag: '🇮🇪' },
  ISL: { name: 'Iceland',                          flag: '🇮🇸' },
  ITA: { name: 'Italy',                            flag: '🇮🇹' },
  LIE: { name: 'Liechtenstein',                    flag: '🇱🇮' },
  LTU: { name: 'Lithuania',                        flag: '🇱🇹' },
  LUX: { name: 'Luxembourg',                       flag: '🇱🇺' },
  LVA: { name: 'Latvia',                           flag: '🇱🇻' },
  MCO: { name: 'Monaco',                           flag: '🇲🇨' },
  MDA: { name: 'Moldova',                          flag: '🇲🇩' },
  MKD: { name: 'Macedonia',                        flag: '🇲🇰' },
  MLT: { name: 'Malta',                            flag: '🇲🇹' },
  MNE: { name: 'Montenegro',                       flag: '🇲🇪' },
  NLD: { name: 'Netherlands',                      flag: '🇳🇱' },
  NOR: { name: 'Norway',                           flag: '🇳🇴' },
  POL: { name: 'Poland',                           flag: '🇵🇱' },
  PRT: { name: 'Portugal',                         flag: '🇵🇹' },
  ROU: { name: 'Romania',                          flag: '🇷🇴' },
  SRB: { name: 'Serbia',                           flag: '🇷🇸' },
  SVK: { name: 'Slovakia',                         flag: '🇸🇰' },
  SVN: { name: 'Slovenia',                         flag: '🇸🇮' },
  SWE: { name: 'Sweden',                           flag: '🇸🇪' },
  UKR: { name: 'Ukraine',                          flag: '🇺🇦' },
  ARE: { name: 'United Arab Emirates',             flag: '🇦🇪' },
  ARM: { name: 'Armenia',                          flag: '🇦🇲' },
  AZE: { name: 'Azerbaijan',                       flag: '🇦🇿' },
  BHR: { name: 'Bahrain',                          flag: '🇧🇭' },
  GEO: { name: 'Georgia',                          flag: '🇬🇪' },
  IRQ: { name: 'Iraq',                             flag: '🇮🇶' },
  ISR: { name: 'Israel',                           flag: '🇮🇱' },
  JOR: { name: 'Jordan',                           flag: '🇯🇴' },
  KWT: { name: 'Kuwait',                           flag: '🇰🇼' },
  OMN: { name: 'Oman',                             flag: '🇴🇲' },
  PSE: { name: 'Palestine',                        flag: '🇵🇸' },
  QAT: { name: 'Qatar',                            flag: '🇶🇦' },
  SAU: { name: 'Saudi Arabia',                     flag: '🇸🇦' },
  TUR: { name: 'Turkey',                           flag: '🇹🇷' },
  BEN: { name: 'Benin',                            flag: '🇧🇯' },
  BFA: { name: 'Burkina Faso',                     flag: '🇧🇫' },
  BWA: { name: 'Botswana',                         flag: '🇧🇼' },
  CAF: { name: 'Central African Republic',         flag: '🇨🇫' },
  CIV: { name: 'Ivory Coast',                      flag: '🇨🇮' },
  CMR: { name: 'Cameroon',                         flag: '🇨🇲' },
  COD: { name: 'Democratic Republic of Congo',     flag: '🇨🇩' },
  COG: { name: 'Republic of Congo',                flag: '🇨🇬' },
  CPV: { name: 'Cape Verde',                       flag: '🇨🇻' },
  DZA: { name: 'Algeria',                          flag: '🇩🇿' },
  EGY: { name: 'Egypt',                            flag: '🇪🇬' },
  GAB: { name: 'Gabon',                            flag: '🇬🇦' },
  GHA: { name: 'Ghana',                            flag: '🇬🇭' },
  GIN: { name: 'Guinea',                           flag: '🇬🇳' },
  GMB: { name: 'Gambia',                           flag: '🇬🇲' },
  GNB: { name: 'Guinea-Bissau',                    flag: '🇬🇼' },
  KEN: { name: 'Kenya',                            flag: '🇰🇪' },
  LBR: { name: 'Liberia',                          flag: '🇱🇷' },
  MAR: { name: 'Morocco',                          flag: '🇲🇦' },
  MDG: { name: 'Madagascar',                       flag: '🇲🇬' },
  MLI: { name: 'Mali',                             flag: '🇲🇱' },
  MOZ: { name: 'Mozambique',                       flag: '🇲🇿' },
  MRT: { name: 'Mauritania',                       flag: '🇲🇷' },
  MUS: { name: 'Mauritius',                        flag: '🇲🇺' },
  MWI: { name: 'Malawi',                           flag: '🇲🇼' },
  NER: { name: 'Niger',                            flag: '🇳🇪' },
  NGA: { name: 'Nigeria',                          flag: '🇳🇬' },
  REU: { name: 'Reunion',                          flag: '🇷🇪' },
  SEN: { name: 'Senegal',                          flag: '🇸🇳' },
  SLE: { name: 'Sierra Leone',                     flag: '🇸🇱' },
  SYC: { name: 'Seychelles',                       flag: '🇸🇨' },
  TCD: { name: 'Chad',                             flag: '🇹🇩' },
  TGO: { name: 'Togo',                             flag: '🇹🇬' },
  TUN: { name: 'Tunisia',                          flag: '🇹🇳' },
  TZA: { name: 'Tanzania',                         flag: '🇹🇿' },
  UGA: { name: 'Uganda',                           flag: '🇺🇬' },
  ZAF: { name: 'South Africa',                     flag: '🇿🇦' },
  AUS: { name: 'Australia',                        flag: '🇦🇺' },
  BGD: { name: 'Bangladesh',                       flag: '🇧🇩' },
  BRN: { name: 'Brunei',                           flag: '🇧🇳' },
  CHN: { name: 'China',                            flag: '🇨🇳' },
  FJI: { name: 'Fiji',                             flag: '🇫🇯' },
  GUM: { name: 'Guam',                             flag: '🇬🇺' },
  HKG: { name: 'Hong Kong',                        flag: '🇭🇰' },
  IDN: { name: 'Indonesia',                        flag: '🇮🇩' },
  IND: { name: 'India',                            flag: '🇮🇳' },
  JPN: { name: 'Japan',                            flag: '🇯🇵' },
  KAZ: { name: 'Kazakhstan',                       flag: '🇰🇿' },
  KGZ: { name: 'Kyrgyzstan',                       flag: '🇰🇬' },
  KHM: { name: 'Cambodia',                         flag: '🇰🇭' },
  KOR: { name: 'South Korea',                      flag: '🇰🇷' },
  LAO: { name: 'Laos',                             flag: '🇱🇦' },
  LKA: { name: 'Sri Lanka',                        flag: '🇱🇰' },
  MAC: { name: 'Macau',                            flag: '🇲🇴' },
  MDV: { name: 'Maldives',                         flag: '🇲🇻' },
  MNG: { name: 'Mongolia',                         flag: '🇲🇳' },
  MYS: { name: 'Malaysia',                         flag: '🇲🇾' },
  NPL: { name: 'Nepal',                            flag: '🇳🇵' },
  NZL: { name: 'New Zealand',                      flag: '🇳🇿' },
  PAK: { name: 'Pakistan',                         flag: '🇵🇰' },
  PHL: { name: 'Philippines',                      flag: '🇵🇭' },
  PNG: { name: 'Papua New Guinea',                 flag: '🇵🇬' },
  PYF: { name: 'French Polynesia',                 flag: '🇵🇫' },
  SGP: { name: 'Singapore',                        flag: '🇸🇬' },
  THA: { name: 'Thailand',                         flag: '🇹🇭' },
  TWN: { name: 'Taiwan',                           flag: '🇹🇼' },
  UZB: { name: 'Uzbekistan',                       flag: '🇺🇿' },
  VNM: { name: 'Vietnam',                          flag: '🇻🇳' },
  WSM: { name: 'Samoa',                            flag: '🇼🇸' },
  AIA: { name: 'Anguilla',                         flag: '🇦🇮' },
  ARG: { name: 'Argentina',                        flag: '🇦🇷' },
  ATG: { name: 'Antigua and Barbuda',              flag: '🇦🇬' },
  BES: { name: 'Bonaire, St Eustatius & Saba',     flag: '🇧🇶' },
  BHS: { name: 'Bahamas',                          flag: '🇧🇸' },
  BLZ: { name: 'Belize',                           flag: '🇧🇿' },
  BMU: { name: 'Bermuda',                          flag: '🇧🇲' },
  BOL: { name: 'Bolivia',                          flag: '🇧🇴' },
  BRA: { name: 'Brazil',                           flag: '🇧🇷' },
  BRB: { name: 'Barbados',                         flag: '🇧🇧' },
  CAN: { name: 'Canada',                           flag: '🇨🇦' },
  CHL: { name: 'Chile',                            flag: '🇨🇱' },
  COL: { name: 'Colombia',                         flag: '🇨🇴' },
  CRI: { name: 'Costa Rica',                       flag: '🇨🇷' },
  CUW: { name: 'Curaçao',                          flag: '🇨🇼' },
  CYM: { name: 'Cayman Islands',                   flag: '🇰🇾' },
  DMA: { name: 'Dominica',                         flag: '🇩🇲' },
  DOM: { name: 'Dominican Republic',               flag: '🇩🇴' },
  ECU: { name: 'Ecuador',                          flag: '🇪🇨' },
  GLP: { name: 'Guadeloupe',                       flag: '🇬🇵' },
  GRD: { name: 'Grenada',                          flag: '🇬🇩' },
  GTM: { name: 'Guatemala',                        flag: '🇬🇹' },
  GUF: { name: 'French Guiana',                    flag: '🇬🇫' },
  HND: { name: 'Honduras',                         flag: '🇭🇳' },
  JAM: { name: 'Jamaica',                          flag: '🇯🇲' },
  KNA: { name: 'Saint Kitts and Nevis',            flag: '🇰🇳' },
  LCA: { name: 'Saint Lucia',                      flag: '🇱🇨' },
  MAF: { name: 'Saint Martin',                     flag: '🇲🇫' },
  MEX: { name: 'Mexico',                           flag: '🇲🇽' },
  MSR: { name: 'Montserrat',                       flag: '🇲🇸' },
  MTQ: { name: 'Martinique',                       flag: '🇲🇶' },
  NIC: { name: 'Nicaragua',                        flag: '🇳🇮' },
  PAN: { name: 'Panama',                           flag: '🇵🇦' },
  PER: { name: 'Peru',                             flag: '🇵🇪' },
  PRI: { name: 'Puerto Rico',                      flag: '🇵🇷' },
  PRY: { name: 'Paraguay',                         flag: '🇵🇾' },
  SLV: { name: 'El Salvador',                      flag: '🇸🇻' },
  SUR: { name: 'Suriname',                         flag: '🇸🇷' },
  SXM: { name: 'Sint Maarten',                     flag: '🇸🇽' },
  TCA: { name: 'Turks and Caicos Islands',         flag: '🇹🇨' },
  TTO: { name: 'Trinidad and Tobago',              flag: '🇹🇹' },
  URY: { name: 'Uruguay',                          flag: '🇺🇾' },
  USA: { name: 'United States of America',         flag: '🇺🇸' },
  VCT: { name: 'Saint Vincent and the Grenadines', flag: '🇻🇨' },
  VEN: { name: 'Venezuela',                        flag: '🇻🇪' },
  VGB: { name: 'British Virgin Islands',           flag: '🇻🇬' },
  VIR: { name: 'US Virgin Islands',                flag: '🇻🇮' },
  AF1: { name: 'Africa 1',                         flag: '🌍' },
  AF2: { name: 'Africa 2',                         flag: '🌍' },
  ASI: { name: 'Asia',                             flag: '🌏' },
  CAR: { name: 'Caribbean',                        flag: '🌎' },
  EUR: { name: 'Europe',                           flag: '🇪🇺' },
  EUK: { name: 'EU + UK',                          flag: '🇪🇺' },
  GLO: { name: 'Global',                           flag: '🌍' },
  LAA: { name: 'Latin America',                    flag: '🌎' },
  MEN: { name: 'Middle East & North Africa',       flag: '🌍' },
  NLA: { name: 'Netherlands Antilles',             flag: '🌎' },
  NOA: { name: 'North America',                    flag: '🌎' },
  OC1: { name: 'Oceania 1',                        flag: '🌏' },
};

function zoneLabel(code: string): string {
  const entry = ZONE_LABELS[code.toUpperCase()];
  return entry ? `${entry.flag} ${entry.name}` : code;
}

function zoneName(code: string): string {
  return ZONE_LABELS[code.toUpperCase()]?.name ?? code;
}

function fmt(v: number | null | undefined, digits = 2): string {
  if (v == null) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function pctDelta(before: number | null, after: number | null): number | null {
  if (before == null || after == null || before === 0) return null;
  return Math.round((after - before) / Math.abs(before) * 1000) / 10;
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function DeltaBadge({ delta, positiveIsGood = true, unit = '%' }: { delta: number | null; positiveIsGood?: boolean; unit?: string }) {
  if (delta == null) return <span className={styles.neutral}>—</span>;
  if (delta === 0)   return <span className={styles.neutral}>{`0.0${unit}`}</span>;
  const sign = delta > 0 ? '+' : '';
  const good = delta > 0 === positiveIsGood;
  return <span className={good ? styles.positive : styles.negative}>{sign}{delta.toFixed(1)}{unit}</span>;
}

type GroupKey = 'priceEur' | 'priceUsd' | 'visitors' | 'orders' | 'catalogRev' | 'discount' | 'grossRev' | 'netRev' | 'netAov' | 'totalCost' | 'netMarginPct';

function ColInfo({ text }: { text: string }) {
  return (
    <span className={styles.colInfoWrap}>
      <span className={styles.colInfoIcon}>i</span>
      <span className={styles.colInfoTip}>{text}</span>
    </span>
  );
}

function getToday(): string { return new Date().toISOString().split('T')[0]; }
function subtractDays(d: string, n: number): string {
  const dt = new Date(d + 'T00:00:00Z'); dt.setUTCDate(dt.getUTCDate() - n); return dt.toISOString().split('T')[0];
}
function addDays(d: string, n: number): string {
  const dt = new Date(d + 'T00:00:00Z'); dt.setUTCDate(dt.getUTCDate() + n); return dt.toISOString().split('T')[0];
}

type Mode = 'comparison' | 'observation';

export default function ComparisonTable() {
  const today = getToday();

  // ── Mode ──────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>('comparison');

  // ── Comparison state ──────────────────────────────────────────────────────
  const defaultRefDate = '2026-05-14';
  const [pendingRefDate, setPendingRefDate] = useState(defaultRefDate);
  const [pendingWeeks, setPendingWeeks] = useState(2);
  const [appliedComparison, setAppliedComparison] = useState({ refDate: defaultRefDate, weeks: 2 });
  const [comp2Data, setComp2Data] = useState<OrderComparisonData | null>(null);
  const [comp2Loading, setComp2Loading] = useState(false);
  const [comp2Error, setComp2Error] = useState<string | null>(null);
  const [visitsData, setVisitsData] = useState<DestinationVisitsData | null>(null);

  // ── Observation state ─────────────────────────────────────────────────────
  const defaultObsFrom = subtractDays(today, 29);
  const [pendingObsFrom, setPendingObsFrom] = useState(defaultObsFrom);
  const [pendingObsTo, setPendingObsTo] = useState(today);
  const [appliedObs, setAppliedObs] = useState({ from: defaultObsFrom, to: today });
  const [obsData, setObsData] = useState<OrderObservationData | null>(null);
  const [obsLoading, setObsLoading] = useState(false);
  const [obsError, setObsError] = useState<string | null>(null);
  const [visitsObsData, setVisitsObsData] = useState<DestinationVisitsSingleData | null>(null);

  // ── Table controls ────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState('');
  const [filterGb,     setFilterGb]     = useState('all');
  const [collapsed,    setCollapsed]    = useState<Set<GroupKey>>(new Set(['visitors', 'catalogRev', 'discount', 'grossRev', 'netAov']));
  const [showGlossary, setShowGlossary] = useState(false);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'comparison') return;
    setComp2Loading(true); setComp2Error(null);
    fetch(`/api/pricing/comparison2?refDate=${appliedComparison.refDate}&weeks=${appliedComparison.weeks}`)
      .then(r => { if (!r.ok) throw new Error('Network error'); return r.json(); })
      .then((d: OrderComparisonData) => setComp2Data(d))
      .catch((e: Error) => setComp2Error(e.message))
      .finally(() => setComp2Loading(false));
    fetch(`/api/pricing/destination-visits?refDate=${appliedComparison.refDate}&weeks=${appliedComparison.weeks}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: DestinationVisitsData | null) => { if (d) setVisitsData(d); })
      .catch(() => {});
  }, [mode, appliedComparison.refDate, appliedComparison.weeks]);

  useEffect(() => {
    if (mode !== 'observation') return;
    setObsLoading(true); setObsError(null);
    fetch(`/api/pricing/observation?from=${appliedObs.from}&to=${appliedObs.to}`)
      .then(r => { if (!r.ok) throw new Error('Network error'); return r.json(); })
      .then((d: OrderObservationData) => setObsData(d))
      .catch((e: Error) => setObsError(e.message))
      .finally(() => setObsLoading(false));
    fetch(`/api/pricing/destination-visits-single?from=${appliedObs.from}&to=${appliedObs.to}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: DestinationVisitsSingleData | null) => { if (d) setVisitsObsData(d); })
      .catch(() => {});
  }, [mode, appliedObs.from, appliedObs.to]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const compRows = comp2Data?.rows ?? [];
  const obsRows  = obsData?.rows  ?? [];
  const activeRows = (mode === 'comparison' ? compRows : obsRows);
  const allZones = [...new Set(activeRows.map(r => r.zoneCode))];
  const allGbs   = [...new Set(activeRows.map(r => r.dataGb))].sort((a, b) => Number(a) - Number(b));

  const toggle = (key: GroupKey) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const isOpen = (key: GroupKey) => !collapsed.has(key);

  const KEYS: GroupKey[] = ['priceEur', 'priceUsd', 'visitors', 'orders', 'catalogRev', 'discount', 'grossRev', 'netRev', 'netAov', 'totalCost', 'netMarginPct'];
  const NCOLS = mode === 'comparison'
    ? 1 + KEYS.reduce((s, k) => s + (isOpen(k) ? 3 : 1), 0)
    : 1 + KEYS.length;

  const searchLower = search.toLowerCase();
  const matchesSearch = (zone: string) =>
    !searchLower || zone.toLowerCase().includes(searchLower) || zoneName(zone).toLowerCase().includes(searchLower);

  const compFiltered = compRows.filter(r => matchesSearch(r.zoneCode) && (filterGb === 'all' || r.dataGb === filterGb));
  const obsFiltered  = obsRows.filter( r => matchesSearch(r.zoneCode) && (filterGb === 'all' || r.dataGb === filterGb));

  const compGrouped: Record<string, OrderComparisonRow[]> = {};
  for (const r of compFiltered) { (compGrouped[r.zoneCode] ??= []).push(r); }
  const obsGrouped: Record<string, OrderObservationRow[]> = {};
  for (const r of obsFiltered)  { (obsGrouped[r.zoneCode]  ??= []).push(r); }

  const sortedZones = allZones
    .filter(z => (mode === 'comparison' ? compGrouped[z] : obsGrouped[z])?.length && matchesSearch(z))
    .sort((a, b) => mode === 'comparison'
      ? (compGrouped[b] ?? []).reduce((s, r) => s + r.ordersAfter, 0) - (compGrouped[a] ?? []).reduce((s, r) => s + r.ordersAfter, 0)
      : (obsGrouped[b]  ?? []).reduce((s, r) => s + r.orders,     0) - (obsGrouped[a]  ?? []).reduce((s, r) => s + r.orders,     0)
    );

  // ── GroupCells (comparison — 3 cols) ─────────────────────────────────────
  function GroupCells({ groupKey, hdrClass, beforeVal, afterVal, fmt: fmtFn, prefix = '', positiveIsGood = true, deltaMode = 'pctChange' }: {
    groupKey: GroupKey; hdrClass: string;
    beforeVal: number | null; afterVal: number | null;
    fmt?: (v: number) => string; prefix?: string; positiveIsGood?: boolean;
    deltaMode?: 'pctChange' | 'absPts';
  }) {
    const f = fmtFn ?? ((v: number) => fmt(v));
    const delta = deltaMode === 'absPts'
      ? (beforeVal != null && afterVal != null ? Math.round((afterVal - beforeVal) * 1000) / 10 : null)
      : pctDelta(beforeVal, afterVal);
    const unit = deltaMode === 'absPts' ? ' pts' : '%';
    if (!isOpen(groupKey)) return <td className={`${styles.collapsedCell} ${hdrClass} ${styles.groupStartCell}`} />;
    return (
      <>
        <td className={`${styles.cell} ${hdrClass} ${styles.groupStartCell}`}>{beforeVal != null ? `${prefix}${f(beforeVal)}` : '—'}</td>
        <td className={`${styles.cell} ${hdrClass}`}>{afterVal != null ? `${prefix}${f(afterVal)}` : '—'}</td>
        <td className={`${styles.deltaCell} ${hdrClass}`}><DeltaBadge delta={delta} positiveIsGood={positiveIsGood} unit={unit} /></td>
      </>
    );
  }

  // ── GroupCellObs (observation — 1 col) ───────────────────────────────────
  function GroupCellObs({ groupKey, hdrClass, val, fmtFn, prefix = '' }: {
    groupKey: GroupKey; hdrClass: string; val: number | null;
    fmtFn?: (v: number) => string; prefix?: string;
  }) {
    const f = fmtFn ?? ((v: number) => fmt(v));
    if (!isOpen(groupKey)) return <td className={`${styles.collapsedCell} ${hdrClass} ${styles.groupStartCell}`} />;
    return <td className={`${styles.cell} ${hdrClass} ${styles.groupStartCell}`}>{val != null ? `${prefix}${f(val)}` : '—'}</td>;
  }

  // ── GroupHeader ───────────────────────────────────────────────────────────
  function GroupHeader({ groupKey, hdrClass, label, info, obsMode = false }: {
    groupKey: GroupKey; hdrClass: string; label: string; info: string; obsMode?: boolean;
  }) {
    const open = isOpen(groupKey);
    return (
      <th
        className={`${styles.groupHeader} ${hdrClass} ${styles.collapsible} ${!open ? styles.groupHeaderCollapsed : ''}`}
        colSpan={obsMode ? 1 : (open ? 3 : 1)}
        rowSpan={obsMode ? 1 : (open ? 1 : 2)}
        onClick={() => toggle(groupKey)}
      >
        {open ? <>{label}<ColInfo text={info} /><span className={styles.collapseArrow}>▾</span></> : label}
      </th>
    );
  }

  const isLoading = mode === 'comparison' ? comp2Loading : obsLoading;
  const dataError = mode === 'comparison' ? comp2Error   : obsError;
  const hasData   = mode === 'comparison' ? !!comp2Data  : !!obsData;
  const planCount = (mode === 'comparison' ? compFiltered : obsFiltered).length;

  const METRICS: { key: GroupKey; emoji: string; name: string; def: string; calc: string }[] = [
    { key: 'priceEur',     emoji: '💶', name: 'Price EUR',              def: 'Average catalog price paid by EUR-currency buyers (exchange rate = 1).', calc: 'AVG(effective_price_eur) on orders where exchange rate ≈ 1' },
    { key: 'priceUsd',     emoji: '💵', name: 'Price USD',              def: 'Average catalog price in USD: EUR catalog price × exchange rate in effect at purchase time, rounded. Rates may vary across the period.', calc: 'AVG(catalog_price_eur_or_usd) on USD-currency orders' },
    { key: 'visitors',     emoji: '👁️',  name: 'Unique Visitors',       def: 'Unique visitors who landed on the destination pricing page. Zone-level — not split per plan.', calc: 'COUNT(DISTINCT person_id) via PostHog · event: plan_purchase:zone_validated' },
    { key: 'orders',       emoji: '📦', name: 'Orders',                  def: 'Total paid, non-gift orders across all currencies.', calc: 'COUNT(*) on paid non-gift orders' },
    { key: 'catalogRev',   emoji: '📋', name: 'Catalog Rev (EUR)',       def: 'Gross catalog revenue before any discounts or Koins. Includes VAT.', calc: 'SUM(catalog_price_eur)' },
    { key: 'discount',     emoji: '🏷️', name: 'Discount & Koins (EUR)', def: 'Total discounts and Koins deducted from orders.', calc: 'SUM(discount_eur)' },
    { key: 'grossRev',     emoji: '💰', name: 'Gross Rev (EUR)',         def: 'Revenue after discounts and Koins, including VAT.', calc: 'SUM(effective_price_eur)' },
    { key: 'netRev',       emoji: '💳', name: 'Net Rev (EUR)',           def: 'Revenue after discounts and Koins, excluding VAT. Primary revenue metric for margin analysis.', calc: 'SUM(net_effective_price_eur)' },
    { key: 'netAov',       emoji: '🧮', name: 'Net AOV (EUR)',           def: 'Average net order value excluding VAT.', calc: 'Net Revenue ÷ Orders' },
    { key: 'totalCost',    emoji: '⚙️', name: 'Total COGS (EUR)',        def: 'Cost of goods sold: payment fees + network costs allocated per sale. ⚠ For periods < 30 days ago, costs may still increase as consumption finalizes.', calc: 'SUM(payment_fees_allocated_eur + network_cost_allocated_eur)' },
    { key: 'netMarginPct', emoji: '📈', name: 'Margin',                  def: 'Net profit margin. In comparison mode, the delta is shown in percentage points (not % change).', calc: '(Net Revenue − COGS) ÷ Net Revenue × 100%' },
  ];

  return (
    <div>
      {/* Metrics glossary */}
      <div className={styles.glossary}>
        <button className={styles.glossaryToggle} onClick={() => setShowGlossary(s => !s)}>
          <span className={styles.glossaryToggleLabel}>Metrics glossary</span>
          <span className={styles.glossaryArrow}>{showGlossary ? '▾' : '▸'}</span>
        </button>
        {showGlossary && (
          <div className={styles.glossaryGrid}>
            {METRICS.map(m => (
              <div key={m.key} className={styles.glossaryCard}>
                <span className={styles.glossaryEmoji}>{m.emoji}</span>
                <span className={styles.glossaryName}>{m.name}</span>
                <p className={styles.glossaryDef}>{m.def}</p>
                <code className={styles.glossaryCalc}>{m.calc}</code>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.controls}>
        {/* Settings: mode toggle + date controls */}
        <div className={styles.settingsRow}>
          <div className={styles.toggleGroup}>
            <button className={mode === 'comparison' ? styles.toggleActive : styles.toggleBtn} onClick={() => setMode('comparison')}>Comparison</button>
            <button className={mode === 'observation' ? styles.toggleActive : styles.toggleBtn} onClick={() => setMode('observation')}>Observation</button>
          </div>
          <div className={styles.ctrlSep} />
          {mode === 'comparison' ? (
            <>
              <label className={styles.ctrlLabel} htmlFor="comp-ref">Ref date</label>
              <input id="comp-ref" type="date" className={styles.ctrlInput} value={pendingRefDate} max={today} onChange={e => setPendingRefDate(e.target.value)} />
              <label className={styles.ctrlLabel} htmlFor="comp-wks">Weeks</label>
              <select id="comp-wks" className={styles.ctrlInput} value={pendingWeeks} onChange={e => setPendingWeeks(Number(e.target.value))}>
                {[1, 2, 3, 4, 6, 8, 12].map(w => <option key={w} value={w}>{w} {w === 1 ? 'week' : 'weeks'}</option>)}
              </select>
              <button className={styles.ctrlApply} onClick={() => setAppliedComparison({ refDate: pendingRefDate, weeks: pendingWeeks })} disabled={!pendingRefDate}>Apply</button>
            </>
          ) : (
            <>
              <label className={styles.ctrlLabel} htmlFor="obs-from">From</label>
              <input id="obs-from" type="date" className={styles.ctrlInput} value={pendingObsFrom} max={today} onChange={e => setPendingObsFrom(e.target.value)} />
              <label className={styles.ctrlLabel} htmlFor="obs-to">To</label>
              <input id="obs-to" type="date" className={styles.ctrlInput} value={pendingObsTo} max={today} onChange={e => setPendingObsTo(e.target.value)} />
              <button className={styles.ctrlApply} onClick={() => setAppliedObs({ from: pendingObsFrom, to: pendingObsTo })} disabled={!pendingObsFrom || !pendingObsTo}>Apply</button>
            </>
          )}
        </div>

        {/* Period bar */}
        {mode === 'comparison' && comp2Data && (
          <div className={styles.periodBar}>
            <span className={styles.periodLabel}>Before <strong>{fmtDate(comp2Data.beforeFrom)}</strong> → <strong>{fmtDate(comp2Data.beforeTo)}</strong></span>
            <span className={styles.periodSep}>vs</span>
            <span className={styles.periodLabel}>After <strong>{fmtDate(comp2Data.afterFrom)}</strong> → <strong>{fmtDate(comp2Data.afterTo)}</strong></span>
            <span className={styles.periodNote}>({comp2Data.nDays} days each)</span>
          </div>
        )}
        {mode === 'observation' && obsData && (
          <div className={styles.periodBar}>
            <span className={styles.periodLabel}>Period <strong>{fmtDate(obsData.from)}</strong> → <strong>{fmtDate(obsData.to)}</strong></span>
          </div>
        )}

        {/* Search + filter */}
        <div className={styles.controlsRow}>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input className={styles.searchInput} placeholder="Search countries…" value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button className={styles.searchClear} onClick={() => setSearch('')}>✕</button>}
          </div>
          <select value={filterGb} onChange={e => setFilterGb(e.target.value)} className={styles.filterSelect}>
            <option value="all">All plans</option>
            {allGbs.map(gb => <option key={gb} value={gb}>{gb} GB</option>)}
          </select>
          <span className={styles.planCount}>{planCount} plans · {sortedZones.length} countries</span>
        </div>
      </div>

      {isLoading && <div className={styles.loadingState}>Loading…</div>}
      {dataError && <div className={styles.errorState}>Error: {dataError}</div>}

      {!isLoading && !dataError && hasData && (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.planHeader} rowSpan={mode === 'comparison' ? 2 : 1}>PLAN</th>
                <GroupHeader groupKey="priceEur"     hdrClass={styles.priceHdr}        label="💶 PRICE EUR"              info="AVG(effective_price_eur) — EUR-currency buyers"                                    obsMode={mode === 'observation'} />
                <GroupHeader groupKey="priceUsd"     hdrClass={styles.priceUsdHdr}     label="💵 PRICE USD"              info="AVG(catalog price in USD) — catalog EUR price × exchange rate in effect at purchase time, rounded. Exchange rates may have varied during the period, so the catalog price can slightly differ across orders."  obsMode={mode === 'observation'} />
                <GroupHeader groupKey="visitors"     hdrClass={styles.visitorsHdr}     label="👁️ UNIQUE VISITORS"        info="Unique visitors on the destination pricing page — PostHog (zone level, not per plan)" obsMode={mode === 'observation'} />
                <GroupHeader groupKey="orders"       hdrClass={styles.ordersHdr}       label="📦 ORDERS"                 info="COUNT of paid non-gift orders (all currencies)"                                      obsMode={mode === 'observation'} />
                <GroupHeader groupKey="catalogRev"   hdrClass={styles.catalogRevHdr}   label="📋 CATALOG REV (EUR)"      info="SUM(catalog_price_eur) — incl. VAT, before discounts and Koins"                     obsMode={mode === 'observation'} />
                <GroupHeader groupKey="discount"     hdrClass={styles.discountHdr}     label="🏷️ DISCOUNT & KOINS (EUR)" info="SUM(discount_eur) — total discounts and Koins applied"                              obsMode={mode === 'observation'} />
                <GroupHeader groupKey="grossRev"     hdrClass={styles.grossRevHdr}     label="💰 GROSS REV (EUR)"        info="SUM(effective_price_eur) — incl. VAT, after discounts and Koins"                    obsMode={mode === 'observation'} />
                <GroupHeader groupKey="netRev"       hdrClass={styles.netRevHdr}       label="💳 NET REV (EUR)"          info="SUM(net_effective_price_eur) — excl. VAT, after discounts and Koins"                obsMode={mode === 'observation'} />
                <GroupHeader groupKey="netAov"       hdrClass={styles.netAovHdr}       label="🧮 NET AOV (EUR)"          info="Net Revenue / Orders — avg net order value excl. VAT"                               obsMode={mode === 'observation'} />
                <GroupHeader groupKey="totalCost"    hdrClass={styles.totalCostHdr}    label="⚙️ TOTAL COGS (EUR)"       info="SUM(payment fees + network cost allocated to each sale). ⚠ For periods less than 30 days ago, data may still be in consumption — costs can increase. Use a period older than 30 days for reliable margin analysis."  obsMode={mode === 'observation'} />
                <GroupHeader groupKey="netMarginPct" hdrClass={styles.netMarginPctHdr} label="📈 MARGIN"                 info="(Net Revenue − COGS) / Net Revenue — delta shown in percentage points"              obsMode={mode === 'observation'} />
              </tr>
              {mode === 'comparison' && (
                <tr>
                  {isOpen('priceEur')     && <><th className={`${styles.subBefore} ${styles.priceHdr}`}>Before</th><th className={`${styles.subAfter} ${styles.priceHdr}`}>After</th><th className={`${styles.subDelta} ${styles.priceHdr}`}>Δ</th></>}
                  {isOpen('priceUsd')     && <><th className={`${styles.subBefore} ${styles.priceUsdHdr}`}>Before</th><th className={`${styles.subAfter} ${styles.priceUsdHdr}`}>After</th><th className={`${styles.subDelta} ${styles.priceUsdHdr}`}>Δ</th></>}
                  {isOpen('visitors')     && <><th className={`${styles.subBefore} ${styles.visitorsHdr}`}>Before</th><th className={`${styles.subAfter} ${styles.visitorsHdr}`}>After</th><th className={`${styles.subDelta} ${styles.visitorsHdr}`}>Δ</th></>}
                  {isOpen('orders')       && <><th className={`${styles.subBefore} ${styles.ordersHdr}`}>Before</th><th className={`${styles.subAfter} ${styles.ordersHdr}`}>After</th><th className={`${styles.subDelta} ${styles.ordersHdr}`}>Δ</th></>}
                  {isOpen('catalogRev')   && <><th className={`${styles.subBefore} ${styles.catalogRevHdr}`}>Before</th><th className={`${styles.subAfter} ${styles.catalogRevHdr}`}>After</th><th className={`${styles.subDelta} ${styles.catalogRevHdr}`}>Δ</th></>}
                  {isOpen('discount')     && <><th className={`${styles.subBefore} ${styles.discountHdr}`}>Before</th><th className={`${styles.subAfter} ${styles.discountHdr}`}>After</th><th className={`${styles.subDelta} ${styles.discountHdr}`}>Δ</th></>}
                  {isOpen('grossRev')     && <><th className={`${styles.subBefore} ${styles.grossRevHdr}`}>Before</th><th className={`${styles.subAfter} ${styles.grossRevHdr}`}>After</th><th className={`${styles.subDelta} ${styles.grossRevHdr}`}>Δ</th></>}
                  {isOpen('netRev')       && <><th className={`${styles.subBefore} ${styles.netRevHdr}`}>Before</th><th className={`${styles.subAfter} ${styles.netRevHdr}`}>After</th><th className={`${styles.subDelta} ${styles.netRevHdr}`}>Δ</th></>}
                  {isOpen('netAov')       && <><th className={`${styles.subBefore} ${styles.netAovHdr}`}>Before</th><th className={`${styles.subAfter} ${styles.netAovHdr}`}>After</th><th className={`${styles.subDelta} ${styles.netAovHdr}`}>Δ</th></>}
                  {isOpen('totalCost')    && <><th className={`${styles.subBefore} ${styles.totalCostHdr}`}>Before</th><th className={`${styles.subAfter} ${styles.totalCostHdr}`}>After</th><th className={`${styles.subDelta} ${styles.totalCostHdr}`}>Δ</th></>}
                  {isOpen('netMarginPct') && <><th className={`${styles.subBefore} ${styles.netMarginPctHdr}`}>Before</th><th className={`${styles.subAfter} ${styles.netMarginPctHdr}`}>After</th><th className={`${styles.subDelta} ${styles.netMarginPctHdr}`}>Δ pts</th></>}
                </tr>
              )}
            </thead>
            <tbody>
              {mode === 'comparison' ? sortedZones.map((zone, rank) => {
                const zoneRows         = compGrouped[zone];
                const sumOrdersBefore  = zoneRows.reduce((s, r) => s + r.ordersBefore,     0);
                const sumOrdersAfter   = zoneRows.reduce((s, r) => s + r.ordersAfter,      0);
                const sumCatRevBefore  = zoneRows.reduce((s, r) => s + r.catalogRevBefore, 0);
                const sumCatRevAfter   = zoneRows.reduce((s, r) => s + r.catalogRevAfter,  0);
                const sumDiscBefore    = zoneRows.reduce((s, r) => s + r.discountBefore,   0);
                const sumDiscAfter     = zoneRows.reduce((s, r) => s + r.discountAfter,    0);
                const sumGrossRevBefore= zoneRows.reduce((s, r) => s + r.grossRevBefore,   0);
                const sumGrossRevAfter = zoneRows.reduce((s, r) => s + r.grossRevAfter,    0);
                const sumNetRevBefore  = zoneRows.reduce((s, r) => s + r.netRevBefore,     0);
                const sumNetRevAfter   = zoneRows.reduce((s, r) => s + r.netRevAfter,      0);
                const sumCostBefore    = zoneRows.reduce((s, r) => s + r.totalCostBefore,  0);
                const sumCostAfter     = zoneRows.reduce((s, r) => s + r.totalCostAfter,   0);
                return (
                  <Fragment key={zone}>
                    <tr className={styles.countryRow}>
                      <td colSpan={NCOLS} className={styles.countryCell}>
                        <span className={styles.countryRank}>#{rank + 1}</span>
                        {zoneLabel(zone)}
                        <span className={styles.countryOrders}>{' '}— {sumOrdersAfter.toLocaleString('en-US')} orders (after period)</span>
                      </td>
                    </tr>
                    {zoneRows.map(row => {
                      const netAovBefore = row.ordersBefore > 0 ? row.netRevBefore / row.ordersBefore : null;
                      const netAovAfter  = row.ordersAfter  > 0 ? row.netRevAfter  / row.ordersAfter  : null;
                      const mgnBefore    = row.netRevBefore > 0 ? (row.netRevBefore - row.totalCostBefore) / row.netRevBefore : null;
                      const mgnAfter     = row.netRevAfter  > 0 ? (row.netRevAfter  - row.totalCostAfter)  / row.netRevAfter  : null;
                      return (
                        <tr key={`${zone}-${row.dataGb}`} className={styles.planRow}>
                          <td className={styles.planCell}>{row.dataGb} GB</td>
                          <GroupCells groupKey="priceEur"     hdrClass={styles.priceHdr}        beforeVal={row.priceBeforeEur}   afterVal={row.priceAfterEur}   positiveIsGood={false} />
                          <GroupCells groupKey="priceUsd"     hdrClass={styles.priceUsdHdr}     beforeVal={row.priceBeforeUsd}   afterVal={row.priceAfterUsd}   positiveIsGood={false} />
                          <GroupCells groupKey="visitors"     hdrClass={styles.visitorsHdr}     beforeVal={null}                 afterVal={null}                fmt={v => v.toLocaleString('en-US')} />
                          <GroupCells groupKey="orders"       hdrClass={styles.ordersHdr}       beforeVal={row.ordersBefore}     afterVal={row.ordersAfter}     fmt={v => v.toLocaleString('en-US')} />
                          <GroupCells groupKey="catalogRev"   hdrClass={styles.catalogRevHdr}   beforeVal={row.catalogRevBefore} afterVal={row.catalogRevAfter} prefix="€" />
                          <GroupCells groupKey="discount"     hdrClass={styles.discountHdr}     beforeVal={row.discountBefore}   afterVal={row.discountAfter}   prefix="€" positiveIsGood={false} />
                          <GroupCells groupKey="grossRev"     hdrClass={styles.grossRevHdr}     beforeVal={row.grossRevBefore}   afterVal={row.grossRevAfter}   prefix="€" />
                          <GroupCells groupKey="netRev"       hdrClass={styles.netRevHdr}       beforeVal={row.netRevBefore}     afterVal={row.netRevAfter}     prefix="€" />
                          <GroupCells groupKey="netAov"       hdrClass={styles.netAovHdr}       beforeVal={netAovBefore}         afterVal={netAovAfter}         prefix="€" />
                          <GroupCells groupKey="totalCost"    hdrClass={styles.totalCostHdr}    beforeVal={row.totalCostBefore}  afterVal={row.totalCostAfter}  prefix="€" positiveIsGood={false} />
                          <GroupCells groupKey="netMarginPct" hdrClass={styles.netMarginPctHdr} beforeVal={mgnBefore}           afterVal={mgnAfter}            fmt={v => (v * 100).toFixed(1) + '%'} deltaMode="absPts" />
                        </tr>
                      );
                    })}
                    <tr className={styles.totalRow}>
                      <td className={styles.planCell}>Total</td>
                      {isOpen('priceEur')  ? <><td className={`${styles.cell} ${styles.priceHdr} ${styles.groupStartCell}`}/><td className={`${styles.cell} ${styles.priceHdr}`}/><td className={`${styles.deltaCell} ${styles.priceHdr}`}/></> : <td className={`${styles.collapsedCell} ${styles.priceHdr} ${styles.groupStartCell}`}/>}
                      {isOpen('priceUsd')  ? <><td className={`${styles.cell} ${styles.priceUsdHdr} ${styles.groupStartCell}`}/><td className={`${styles.cell} ${styles.priceUsdHdr}`}/><td className={`${styles.deltaCell} ${styles.priceUsdHdr}`}/></> : <td className={`${styles.collapsedCell} ${styles.priceUsdHdr} ${styles.groupStartCell}`}/>}
                      <GroupCells groupKey="visitors"     hdrClass={styles.visitorsHdr}    beforeVal={visitsData?.before[zone] ?? null} afterVal={visitsData?.after[zone] ?? null} fmt={v => v.toLocaleString('en-US')} />
                      <GroupCells groupKey="orders"       hdrClass={styles.ordersHdr}      beforeVal={sumOrdersBefore}  afterVal={sumOrdersAfter}  fmt={v => v.toLocaleString('en-US')} />
                      <GroupCells groupKey="catalogRev"   hdrClass={styles.catalogRevHdr}  beforeVal={sumCatRevBefore}  afterVal={sumCatRevAfter}  prefix="€" />
                      <GroupCells groupKey="discount"     hdrClass={styles.discountHdr}    beforeVal={sumDiscBefore}    afterVal={sumDiscAfter}    prefix="€" positiveIsGood={false} />
                      <GroupCells groupKey="grossRev"     hdrClass={styles.grossRevHdr}    beforeVal={sumGrossRevBefore} afterVal={sumGrossRevAfter} prefix="€" />
                      <GroupCells groupKey="netRev"       hdrClass={styles.netRevHdr}      beforeVal={sumNetRevBefore}  afterVal={sumNetRevAfter}  prefix="€" />
                      <GroupCells groupKey="netAov"       hdrClass={styles.netAovHdr}      beforeVal={sumOrdersBefore > 0 ? sumNetRevBefore / sumOrdersBefore : null} afterVal={sumOrdersAfter > 0 ? sumNetRevAfter / sumOrdersAfter : null} prefix="€" />
                      <GroupCells groupKey="totalCost"    hdrClass={styles.totalCostHdr}   beforeVal={sumCostBefore}    afterVal={sumCostAfter}    prefix="€" positiveIsGood={false} />
                      <GroupCells groupKey="netMarginPct" hdrClass={styles.netMarginPctHdr} beforeVal={sumNetRevBefore > 0 ? (sumNetRevBefore - sumCostBefore) / sumNetRevBefore : null} afterVal={sumNetRevAfter > 0 ? (sumNetRevAfter - sumCostAfter) / sumNetRevAfter : null} fmt={v => (v * 100).toFixed(1) + '%'} deltaMode="absPts" />
                    </tr>
                  </Fragment>
                );
              }) : sortedZones.map((zone, rank) => {
                const zoneRows    = obsGrouped[zone];
                const sumOrders   = zoneRows.reduce((s, r) => s + r.orders,     0);
                const sumCatRev   = zoneRows.reduce((s, r) => s + r.catalogRev, 0);
                const sumDisc     = zoneRows.reduce((s, r) => s + r.discount,   0);
                const sumGrossRev = zoneRows.reduce((s, r) => s + r.grossRev,   0);
                const sumNetRev   = zoneRows.reduce((s, r) => s + r.netRev,     0);
                const sumCost     = zoneRows.reduce((s, r) => s + r.totalCost,  0);
                return (
                  <Fragment key={zone}>
                    <tr className={styles.countryRow}>
                      <td colSpan={NCOLS} className={styles.countryCell}>
                        <span className={styles.countryRank}>#{rank + 1}</span>
                        {zoneLabel(zone)}
                        <span className={styles.countryOrders}>{' '}— {sumOrders.toLocaleString('en-US')} orders</span>
                      </td>
                    </tr>
                    {zoneRows.map(row => {
                      const netAov = row.orders > 0 ? row.netRev / row.orders : null;
                      const margin = row.netRev > 0 ? (row.netRev - row.totalCost) / row.netRev : null;
                      return (
                        <tr key={`${zone}-${row.dataGb}`} className={styles.planRow}>
                          <td className={styles.planCell}>{row.dataGb} GB</td>
                          <GroupCellObs groupKey="priceEur"     hdrClass={styles.priceHdr}        val={row.priceEur}   prefix="€" />
                          <GroupCellObs groupKey="priceUsd"     hdrClass={styles.priceUsdHdr}     val={row.priceUsd}   prefix="$" />
                          <GroupCellObs groupKey="visitors"     hdrClass={styles.visitorsHdr}     val={null}           fmtFn={v => v.toLocaleString('en-US')} />
                          <GroupCellObs groupKey="orders"       hdrClass={styles.ordersHdr}       val={row.orders}     fmtFn={v => v.toLocaleString('en-US')} />
                          <GroupCellObs groupKey="catalogRev"   hdrClass={styles.catalogRevHdr}   val={row.catalogRev} prefix="€" />
                          <GroupCellObs groupKey="discount"     hdrClass={styles.discountHdr}     val={row.discount}   prefix="€" />
                          <GroupCellObs groupKey="grossRev"     hdrClass={styles.grossRevHdr}     val={row.grossRev}   prefix="€" />
                          <GroupCellObs groupKey="netRev"       hdrClass={styles.netRevHdr}       val={row.netRev}     prefix="€" />
                          <GroupCellObs groupKey="netAov"       hdrClass={styles.netAovHdr}       val={netAov}         prefix="€" />
                          <GroupCellObs groupKey="totalCost"    hdrClass={styles.totalCostHdr}    val={row.totalCost}  prefix="€" />
                          <GroupCellObs groupKey="netMarginPct" hdrClass={styles.netMarginPctHdr} val={margin}         fmtFn={v => (v * 100).toFixed(1) + '%'} />
                        </tr>
                      );
                    })}
                    <tr className={styles.totalRow}>
                      <td className={styles.planCell}>Total</td>
                      {isOpen('priceEur')  ? <td className={`${styles.cell} ${styles.priceHdr} ${styles.groupStartCell}`}/>    : <td className={`${styles.collapsedCell} ${styles.priceHdr} ${styles.groupStartCell}`}/>}
                      {isOpen('priceUsd')  ? <td className={`${styles.cell} ${styles.priceUsdHdr} ${styles.groupStartCell}`}/> : <td className={`${styles.collapsedCell} ${styles.priceUsdHdr} ${styles.groupStartCell}`}/>}
                      <GroupCellObs groupKey="visitors"     hdrClass={styles.visitorsHdr}    val={visitsObsData?.visits[zone] ?? null} fmtFn={v => v.toLocaleString('en-US')} />
                      <GroupCellObs groupKey="orders"       hdrClass={styles.ordersHdr}      val={sumOrders}   fmtFn={v => v.toLocaleString('en-US')} />
                      <GroupCellObs groupKey="catalogRev"   hdrClass={styles.catalogRevHdr}  val={sumCatRev}   prefix="€" />
                      <GroupCellObs groupKey="discount"     hdrClass={styles.discountHdr}    val={sumDisc}     prefix="€" />
                      <GroupCellObs groupKey="grossRev"     hdrClass={styles.grossRevHdr}    val={sumGrossRev} prefix="€" />
                      <GroupCellObs groupKey="netRev"       hdrClass={styles.netRevHdr}      val={sumNetRev}   prefix="€" />
                      <GroupCellObs groupKey="netAov"       hdrClass={styles.netAovHdr}      val={sumOrders > 0 ? sumNetRev / sumOrders : null} prefix="€" />
                      <GroupCellObs groupKey="totalCost"    hdrClass={styles.totalCostHdr}   val={sumCost}     prefix="€" />
                      <GroupCellObs groupKey="netMarginPct" hdrClass={styles.netMarginPctHdr} val={sumNetRev > 0 ? (sumNetRev - sumCost) / sumNetRev : null} fmtFn={v => (v * 100).toFixed(1) + '%'} />
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
