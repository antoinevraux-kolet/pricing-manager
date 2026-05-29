import { Fragment, useEffect, useRef, useState } from 'react';
import type { ComparisonData, ComparisonRow, ProjectionAssumption } from '../App';
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

function fmtPct(v: number): string {
  return `${Math.round(v * 10) / 10}%`;
}

function DeltaBadge({ delta, positiveIsGood = true }: { delta: number | null; positiveIsGood?: boolean }) {
  if (delta == null) return <span className={styles.neutral}>—</span>;
  if (delta === 0)   return <span className={styles.neutral}>0.0%</span>;
  const sign = delta > 0 ? '+' : '';
  const good = delta > 0 === positiveIsGood;
  return <span className={good ? styles.positive : styles.negative}>{sign}{delta.toFixed(1)}%</span>;
}

type CogsMode = 'actual' | 'projected';

interface Props { data: ComparisonData }

export default function ComparisonTable({ data }: Props) {
  const { rows, nDays, beforeFrom, beforeTo, afterFrom, afterTo } = data;

  const allZones = [...new Set(rows.map(r => r.zoneCode))];
  const allGbs   = [...new Set(rows.map(r => r.dataAllowanceGb))].sort((a, b) => Number(a) - Number(b));

  const [search,    setSearch]    = useState('');
  const [filterGb,  setFilterGb]  = useState('all');
  const [cogsMode,  setCogsMode]  = useState<CogsMode>('actual');
  const [showInfo,  setShowInfo]  = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showInfo) return;
    const handler = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) setShowInfo(false);
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowInfo(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', keyHandler); };
  }, [showInfo]);

  const searchLower = search.toLowerCase();
  const matchesSearch = (zone: string) =>
    !searchLower ||
    zone.toLowerCase().includes(searchLower) ||
    zoneName(zone).toLowerCase().includes(searchLower);

  const filtered = rows.filter(r =>
    matchesSearch(r.zoneCode) &&
    (filterGb === 'all' || r.dataAllowanceGb === filterGb)
  );

  const grouped: Record<string, ComparisonRow[]> = {};
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

  const NCOLS = 16;

  return (
    <div>
      {/* Period bar */}
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

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.controlsRow}>
          {/* Search */}
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

          {/* Plan filter */}
          <select value={filterGb} onChange={e => setFilterGb(e.target.value)} className={styles.filterSelect}>
            <option value="all">All plans</option>
            {allGbs.map(gb => (
              <option key={gb} value={gb}>{gb} GB</option>
            ))}
          </select>

          <span className={styles.planCount}>{filtered.length} plans · {sortedZones.length} countries</span>
        </div>

        {/* Settings row */}
        <div className={styles.settingsRow}>
          <span className={styles.settingsLabel}>Settings</span>

          <div className={styles.settingGroup}>
            <span className={styles.settingName}>COGS</span>
            <div className={styles.toggleGroup}>
              <button
                className={cogsMode === 'actual' ? styles.toggleActive : styles.toggleBtn}
                onClick={() => setCogsMode('actual')}
              >
                Actual
              </button>
              <button
                className={cogsMode === 'projected' ? styles.toggleActive : styles.toggleBtn}
                onClick={() => setCogsMode('projected')}
              >
                Projected
              </button>
            </div>
            {cogsMode === 'projected' && (
              <button className={styles.infoBtn} onClick={() => setShowInfo(v => !v)} title="Voir les hypothèses">
                ⓘ
              </button>
            )}
          </div>

          <div className={`${styles.settingGroup} ${styles.settingDisabled}`} title="Coming soon — requires expired plan data">
            <span className={styles.settingName}>Plans</span>
            <button className={styles.toggleBtn} disabled>
              Expired only
            </button>
            <span className={styles.comingSoon}>coming soon</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.planHeader} rowSpan={2}>PLAN</th>
              <th className={`${styles.groupHeader} ${styles.priceHdr}`} colSpan={3}>PRICE</th>
              <th className={`${styles.groupHeader} ${styles.ordersHdr}`} colSpan={3}>ORDERS</th>
              <th className={`${styles.groupHeader} ${styles.revHdr}`} colSpan={3}>REV / DAY</th>
              <th className={`${styles.groupHeader} ${styles.costHdr}`} colSpan={3}>
                {cogsMode === 'projected' ? 'PROJ. COST / DAY' : 'COST / DAY'}
              </th>
              <th className={`${styles.groupHeader} ${styles.marginHdr}`} colSpan={3}>
                {cogsMode === 'projected' ? 'PROJ. MARGIN / DAY' : 'MARGIN / DAY'}
              </th>
            </tr>
            <tr>
              <th className={`${styles.subBefore} ${styles.priceHdr}`}>Before</th>
              <th className={`${styles.subAfter}  ${styles.priceHdr}`}>After</th>
              <th className={`${styles.subDelta}  ${styles.priceHdr}`}>Δ</th>
              <th className={`${styles.subBefore} ${styles.ordersHdr}`}>Before</th>
              <th className={`${styles.subAfter}  ${styles.ordersHdr}`}>After</th>
              <th className={`${styles.subDelta}  ${styles.ordersHdr}`}>Δ</th>
              <th className={`${styles.subBefore} ${styles.revHdr}`}>Before</th>
              <th className={`${styles.subAfter}  ${styles.revHdr}`}>After</th>
              <th className={`${styles.subDelta}  ${styles.revHdr}`}>Δ</th>
              <th className={`${styles.subBefore} ${styles.costHdr}`}>Before</th>
              <th className={`${styles.subAfter}  ${styles.costHdr}`}>After</th>
              <th className={`${styles.subDelta}  ${styles.costHdr}`}>Δ</th>
              <th className={`${styles.subBefore} ${styles.marginHdr}`}>Before</th>
              <th className={`${styles.subAfter}  ${styles.marginHdr}`}>After</th>
              <th className={`${styles.subDelta}  ${styles.marginHdr}`}>Δ</th>
            </tr>
          </thead>
          <tbody>
            {sortedZones.map((zone, rank) => {
              const zoneRows = grouped[zone];
              const totalAfter   = zoneRows.reduce((s, r) => s + r.ordersAfter, 0);
              const totalNPlansBefore  = zoneRows.reduce((s, r) => s + r.nPlansBefore, 0);
              const totalNPlansAfter   = zoneRows.reduce((s, r) => s + r.nPlansAfter, 0);
              const totalExpiredBefore = zoneRows.reduce((s, r) => s + r.nExpiredBefore, 0);
              const totalExpiredAfter  = zoneRows.reduce((s, r) => s + r.nExpiredAfter, 0);
              const expiredPctBefore = totalNPlansBefore > 0 ? totalExpiredBefore / totalNPlansBefore * 100 : null;
              const expiredPctAfter  = totalNPlansAfter  > 0 ? totalExpiredAfter  / totalNPlansAfter  * 100 : null;

              return (
                <Fragment key={zone}>
                  <tr className={styles.countryRow}>
                    <td colSpan={NCOLS} className={styles.countryCell}>
                      <span className={styles.countryRank}>#{rank + 1}</span>
                      {zoneLabel(zone)}
                      <span className={styles.countryOrders}>
                        {' '}— {totalAfter.toLocaleString('en-US')} orders (after period)
                      </span>
                      {(expiredPctBefore != null || expiredPctAfter != null) && (
                        <span className={styles.expiredPill}>
                          {expiredPctBefore != null ? `${fmtPct(expiredPctBefore)} expired before` : '—'}
                          {' / '}
                          {expiredPctAfter  != null ? `${fmtPct(expiredPctAfter)} expired after`  : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                  {zoneRows.map(row => {
                    const costB   = cogsMode === 'projected' ? row.projCostDayBefore   : row.costDayBefore;
                    const costA   = cogsMode === 'projected' ? row.projCostDayAfter    : row.costDayAfter;
                    const marginB = cogsMode === 'projected' ? row.projMarginDayBefore : row.marginDayBefore;
                    const marginA = cogsMode === 'projected' ? row.projMarginDayAfter  : row.marginDayAfter;

                    return (
                      <tr key={`${zone}-${row.dataAllowanceGb}`} className={styles.planRow}>
                        <td className={styles.planCell}>{row.dataAllowanceGb} GB</td>

                        {/* Price */}
                        <td className={`${styles.cell} ${styles.priceHdr}`}>
                          {row.priceBefore != null ? `€${fmt(row.priceBefore)}` : '—'}
                        </td>
                        <td className={`${styles.cell} ${styles.priceHdr}`}>
                          {row.priceAfter != null ? `€${fmt(row.priceAfter)}` : '—'}
                        </td>
                        <td className={`${styles.deltaCell} ${styles.priceHdr}`}>
                          <DeltaBadge delta={pctDelta(row.priceBefore, row.priceAfter)} />
                        </td>

                        {/* Orders */}
                        <td className={`${styles.cell} ${styles.ordersHdr}`}>{row.ordersBefore.toLocaleString('en-US')}</td>
                        <td className={`${styles.cell} ${styles.ordersHdr}`}>{row.ordersAfter.toLocaleString('en-US')}</td>
                        <td className={`${styles.deltaCell} ${styles.ordersHdr}`}>
                          <DeltaBadge delta={pctDelta(row.ordersBefore, row.ordersAfter)} />
                        </td>

                        {/* Rev/day */}
                        <td className={`${styles.cell} ${styles.revHdr}`}>€{fmt(row.revDayBefore)}</td>
                        <td className={`${styles.cell} ${styles.revHdr}`}>€{fmt(row.revDayAfter)}</td>
                        <td className={`${styles.deltaCell} ${styles.revHdr}`}>
                          <DeltaBadge delta={pctDelta(row.revDayBefore, row.revDayAfter)} />
                        </td>

                        {/* Cost/day */}
                        <td className={`${styles.cell} ${styles.costHdr}`}>€{fmt(costB)}</td>
                        <td className={`${styles.cell} ${styles.costHdr}`}>€{fmt(costA)}</td>
                        <td className={`${styles.deltaCell} ${styles.costHdr}`}>
                          <DeltaBadge delta={pctDelta(costB, costA)} positiveIsGood={false} />
                        </td>

                        {/* Margin/day */}
                        <td className={`${styles.cell} ${styles.marginHdr}`}>€{fmt(marginB)}</td>
                        <td className={`${styles.cell} ${styles.marginHdr}`}>€{fmt(marginA)}</td>
                        <td className={`${styles.deltaCell} ${styles.marginHdr}`}>
                          <DeltaBadge delta={pctDelta(marginB, marginA)} />
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Projection info panel */}
      {showInfo && (() => {
        const gbValues = [...new Set(data.projAssumptions.map((a: ProjectionAssumption) => a.dataAllowanceGb))]
          .sort((a, b) => Number(a) - Number(b));
        const orderedZones = [...new Set(data.rows.map(r => r.zoneCode))].sort((a, b) => {
          const sumA = data.rows.filter(r => r.zoneCode === a).reduce((s, r) => s + r.ordersAfter, 0);
          const sumB = data.rows.filter(r => r.zoneCode === b).reduce((s, r) => s + r.ordersAfter, 0);
          return sumB - sumA;
        });
        const aMap: Record<string, Record<string, ProjectionAssumption>> = {};
        for (const a of data.projAssumptions) {
          if (!aMap[a.zoneCode]) aMap[a.zoneCode] = {};
          aMap[a.zoneCode][a.dataAllowanceGb] = a;
        }
        return (
          <div className={styles.infoOverlay}>
            <div className={styles.infoPanel} ref={infoRef}>
              <div className={styles.infoPanelHeader}>
                <span className={styles.infoPanelTitle}>Projected COGS — Hypothèses</span>
                <button className={styles.infoPanelClose} onClick={() => setShowInfo(false)}>✕</button>
              </div>
              <div className={styles.infoPanelBody}>
                <div className={styles.infoPanelWindow}>
                  Fenêtre de référence&nbsp;:&nbsp;
                  <strong>{fmtDate(data.projCostFrom)}</strong> → <strong>{fmtDate(data.projCostTo)}</strong>
                  <span className={styles.infoPanelWindowNote}>(35 à 90 jours avant le début de la période "avant")</span>
                </div>
                <div className={styles.infoPanelFormula}>
                  <p className={styles.formulaTitle}>Formule</p>
                  <code className={styles.formulaCode}>
                    Projected cost/plan = <em>taux de conso</em> × <em>data allowance (GB)</em> × <em>coût moyen/GB</em>
                  </code>
                  <code className={styles.formulaCode}>
                    Projected COGS/day = projected cost/plan × n_paid_plans / nDays
                  </code>
                </div>
                <div className={styles.infoPanelTableWrap}>
                  <table className={styles.infoTable}>
                    <thead>
                      <tr>
                        <th className={styles.infoTh}>Pays</th>
                        <th className={styles.infoTh}>Coût / GB</th>
                        {gbValues.map(gb => (
                          <th key={gb} className={styles.infoTh}>{gb} GB conso.</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {orderedZones.map(zone => {
                        const za = aMap[zone] ?? {};
                        const firstA = Object.values(za)[0] as ProjectionAssumption | undefined;
                        const costPerGb = firstA?.avgCostPerGb ?? null;
                        return (
                          <tr key={zone} className={styles.infoTr}>
                            <td className={styles.infoTdZone}>{zoneLabel(zone)}</td>
                            <td className={styles.infoTdNum}>
                              {costPerGb != null ? `€${Number(costPerGb).toFixed(4)}/GB` : '—'}
                            </td>
                            {gbValues.map(gb => {
                              const rate = za[gb]?.avgConsumptionRate ?? null;
                              return (
                                <td key={gb} className={styles.infoTdNum}>
                                  {rate != null ? `${(Number(rate) * 100).toFixed(1)}%` : '—'}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
