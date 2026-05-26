import { useState, Fragment } from 'react';
import styles from './PricingTable.module.css';
import type { PricingData, CellMetrics } from '../App';

const ZONE_LABELS: Record<string, { name: string; flag: string }> = {
  // Europe
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
  // Middle East
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
  // Africa
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
  // Asia & Pacific
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
  MAC: { name: 'Macau',                             flag: '🇲🇴' },
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
  // Americas
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
  // Regional bundles
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

interface Props {
  data: PricingData;
}

function fmt(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function fmtPct(value: number): string {
  return (value * 100).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

type FunnelStep =
  | { type: 'total';     label: string; key: keyof CellMetrics }
  | { type: 'deduction'; label: string; fromKey: keyof CellMetrics; toKey: keyof CellMetrics };

const FUNNEL: FunnelStep[] = [
  { type: 'total',     label: 'CATALOG REVENUE',        key: 'revenue'                                         },
  { type: 'deduction', label: '− Discounts',            fromKey: 'revenue',             toKey: 'grossRevenueTtc'     },
  { type: 'deduction', label: '− VAT',                  fromKey: 'grossRevenueTtc',     toKey: 'netRevenueHt'        },
  { type: 'deduction', label: '− Fees',                 fromKey: 'netRevenueHt',        toKey: 'netRevenueAfterFees' },
  { type: 'total',     label: 'NET REVENUE HT',          key: 'netRevenueAfterFees'                             },
];

function CogsCell({ cell, isMargin, projectedValue, projectedPct }: {
  cell: CellMetrics | null | undefined;
  isMargin?: boolean;
  projectedValue?: number | null;
  projectedPct?: number | null;
}) {
  const actualValue = cell ? (isMargin ? cell.grossMargin : cell.networkCost) : null;
  const actualPct   = cell ? cell.grossMarginPct : null;
  const prefix      = !isMargin ? '− ' : '';

  return (
    <div className={styles.cogsSplit}>
      <div className={`${styles.cogsHalf} ${styles.cogsActual} ${isMargin ? styles.cogsMarginActual : ''}`}>
        {actualValue !== null
          ? <>{prefix}{fmt(actualValue)} <span className={styles.currency}>€</span>{isMargin && actualPct !== null && <span className={styles.pct}> ({fmtPct(actualPct)}%)</span>}</>
          : <span className={styles.empty}>—</span>}
      </div>
      <div className={`${styles.cogsHalf} ${styles.cogsProjected} ${isMargin ? styles.cogsMarginProjected : ''}`}>
        {projectedValue != null
          ? <>{prefix}{fmt(projectedValue)} <span className={styles.currency}>€</span>{isMargin && projectedPct != null && <span className={styles.pct}> ({fmtPct(projectedPct)}%)</span>}</>
          : <span className={styles.cogsZero}>—</span>}
      </div>
    </div>
  );
}

function ConsumptionCell({ cell }: { cell: CellMetrics | null | undefined }) {
  const actual    = cell != null ? cell.consumptionRate : null;
  const projected = cell != null ? cell.projectedConsumptionRate : null;

  return (
    <div className={styles.cogsSplit}>
      <div className={`${styles.cogsHalf} ${styles.cogsActual}`}>
        {actual !== null
          ? <>{fmtPct(actual)}<span className={styles.pct}>%</span></>
          : <span className={styles.empty}>—</span>}
      </div>
      <div className={`${styles.cogsHalf} ${styles.cogsProjected}`}>
        {projected !== null
          ? <>{fmtPct(projected)}<span className={styles.pct}>%</span></>
          : <span className={styles.cogsZero}>—</span>}
      </div>
    </div>
  );
}

export default function PricingTable({ data }: Props) {
  const { zones, allowances, values, zoneCosts, costDateRange } = data;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const toggle = (zone: string) =>
    setExpanded((prev) => (prev === zone ? null : zone));

  const filteredZones = search.trim()
    ? zones.filter((z) => {
        const q = search.toLowerCase();
        const entry = ZONE_LABELS[z.toUpperCase()];
        return (
          z.toLowerCase().includes(q) ||
          (entry?.name.toLowerCase().includes(q) ?? false)
        );
      })
    : zones;

  return (
    <div className={styles.wrapper}>
      <div className={styles.searchBar}>
        <span className={styles.searchIcon}>🔍</span>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search country…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className={styles.searchClear} onClick={() => setSearch('')} aria-label="Clear">✕</button>
        )}
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.cornerCell} rowSpan={2} />
              <th className={styles.costHeader} rowSpan={2}>
                <div className={styles.costHeaderInner}>
                  <span>Avg GB Cost</span>
                  <div className={styles.infoWrapper}>
                    <span className={styles.infoIcon}>ⓘ</span>
                    <div className={styles.tooltip}>
                      <strong>Average network cost per GB</strong>
                      <br />
                      SUM(network_cost_eur) / SUM(consumed_data_gb)
                      <br />
                      <span className={styles.tooltipRange}>
                        From {fmtDate(costDateRange.from)} to {fmtDate(costDateRange.to)}
                        <br />(week −13 to week −5)
                      </span>
                    </div>
                  </div>
                </div>
              </th>
              {allowances.map((gb, i) => (
                <th
                  key={gb}
                  className={styles.gbHeader}
                  colSpan={3}
                  style={{ borderLeft: i > 0 ? '2px solid var(--color-border)' : undefined }}
                >
                  {gb} GB
                </th>
              ))}
            </tr>
            <tr>
              {allowances.map((gb, i) => (
                <>
                  <th key={`${gb}-orders`} className={`${styles.metricHeader} ${i > 0 ? styles.metricHeaderFirst : ''}`}>Orders</th>
                  <th key={`${gb}-avg`}    className={styles.metricHeader}>Catalog Price</th>
                  <th key={`${gb}-rev`}    className={styles.metricHeader}>Revenue</th>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredZones.map((zone) => {
              const isOpen = expanded === zone;
              const cost = zoneCosts[zone];
              return (
                <Fragment key={zone}>
                  {/* ── Main row ── */}
                  <tr key={zone} className={styles.row}>
                    <td className={styles.zoneCell}>
                      <button className={styles.toggle} onClick={() => toggle(zone)} aria-label={isOpen ? 'Collapse' : 'Expand'}>
                        {isOpen ? '▼' : '▶'}
                      </button>
                      {zoneLabel(zone)}
                    </td>
                    <td className={styles.costCell}>
                      {cost !== null && cost !== undefined
                        ? <>{fmt(cost)} <span className={styles.currency}>€/GB</span></>
                        : <span className={styles.empty}>—</span>}
                    </td>
                    {allowances.map((gb, i) => {
                      const cell = values[zone]?.[gb];
                      return cell ? (
                        <>
                          <td key={`${gb}-orders`} className={`${styles.metricCell} ${i > 0 ? styles.metricCellFirst : ''}`}>
                            {cell.orders.toLocaleString('en-US')}
                          </td>
                          <td key={`${gb}-avg`} className={styles.metricCell}>
                            {fmt(cell.avgPrice)} <span className={styles.currency}>€</span>
                          </td>
                          <td key={`${gb}-rev`} className={styles.metricCell}>
                            {fmt(cell.revenue)} <span className={styles.currency}>€</span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td key={`${gb}-orders`} className={`${styles.metricCell} ${i > 0 ? styles.metricCellFirst : ''}`}><span className={styles.empty}>—</span></td>
                          <td key={`${gb}-avg`}    className={styles.metricCell}><span className={styles.empty}>—</span></td>
                          <td key={`${gb}-rev`}    className={styles.metricCell}><span className={styles.empty}>—</span></td>
                        </>
                      );
                    })}
                  </tr>

                  {/* ── Funnel rows ── */}
                  {isOpen && FUNNEL.map((step) => {
                    const isTotal = step.type === 'total';
                    const isFinal = isTotal && step.key === 'netRevenueAfterFees';
                    const rowKey = isTotal ? step.key : `${step.fromKey}-${step.toKey}`;
                    return (
                      <tr
                        key={`${zone}-funnel-${rowKey}`}
                        className={isTotal ? styles.funnelRowTotal : styles.funnelRow}
                      >
                        <td className={isTotal ? styles.funnelLabelTotal : styles.funnelLabel}>
                          <span className={isFinal ? styles.funnelNameFinal : isTotal ? styles.funnelNameBold : styles.funnelName}>
                            {step.label}
                          </span>
                        </td>
                        <td className={styles.funnelCostEmpty} />
                        {allowances.map((gb, i) => {
                          const cell = values[zone]?.[gb];
                          const raw = cell
                            ? isTotal
                              ? (cell[step.key] as number)
                              : Math.abs((cell[step.fromKey] as number) - (cell[step.toKey] as number))
                            : null;
                          return (
                            <td key={`${gb}-${rowKey}`} className={`${styles.funnelCell} ${i > 0 ? styles.metricCellFirst : ''}`} colSpan={3}>
                              {raw !== null ? (
                                <span className={isFinal ? styles.funnelValueFinal : isTotal ? styles.funnelValueBold : styles.funnelValue}>
                                  {!isTotal && '− '}{fmt(raw)} <span className={styles.currency}>€</span>
                                </span>
                              ) : <span className={styles.empty}>—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {/* ── COGS section ── */}
                  {isOpen && (
                    <>
                      {/* Sub-header */}
                      <tr key={`${zone}-cogs-header`} className={styles.cogsHeaderRow}>
                        <td className={styles.cogsSectionLabel}>Cost breakdown</td>
                        <td className={styles.funnelCostEmpty} />
                        {allowances.map((gb, i) => (
                          <td key={`${gb}-cogs-hdr`} className={`${styles.cogsHeaderCell} ${i > 0 ? styles.metricCellFirst : ''}`} colSpan={3}>
                            <div className={styles.cogsSplit}>
                              <div className={`${styles.cogsHalf} ${styles.cogsHeaderLabel}`} style={{ gap: 5 }}>
                                <span>Actual COGS</span>
                                <div className={styles.infoWrapper}>
                                  <span className={styles.infoIcon}>ⓘ</span>
                                  <div className={styles.tooltip}>
                                    <strong>Actual costs — selected week</strong><br />
                                    Network Cost = <em>network_cost_eur</em><br />
                                    Gross Margin = <em>gross_margin_eur</em>
                                  </div>
                                </div>
                              </div>
                              <div className={`${styles.cogsHalf} ${styles.cogsHeaderLabel}`} style={{ gap: 5 }}>
                                <span>Projected COGS</span>
                                <div className={styles.infoWrapper}>
                                  <span className={styles.infoIcon}>ⓘ</span>
                                  <div className={styles.tooltip}>
                                    <strong>Projected costs — historical avg (weeks −5 to −13)</strong><br />
                                    Network Cost = % Consumption × GB plan × Avg GB Cost × Orders<br />
                                    Gross Margin = Net Revenue HT − Projected Network Cost
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        ))}
                      </tr>

                      {/* Percentage Consumption */}
                      <tr key={`${zone}-cogs-consumption`} className={styles.cogsRow}>
                        <td className={styles.funnelLabel}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span className={styles.funnelName}>% Consumption</span>
                            <div className={styles.infoWrapper}>
                              <span className={styles.infoIcon}>ⓘ</span>
                              <div className={styles.tooltip}>
                                <strong>% Consumption</strong><br />
                                Actual: <em>consumption_rate</em> from the selected week<br />
                                <span className={styles.tooltipRange}>
                                  Projected: AVG(consumption_rate) for this zone × plan<br />
                                  over weeks −5 to −13
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className={styles.funnelCostEmpty} />
                        {allowances.map((gb, i) => (
                          <td key={`${gb}-consumption`} className={`${styles.cogsDataCell} ${i > 0 ? styles.metricCellFirst : ''}`} colSpan={3}>
                            <ConsumptionCell cell={values[zone]?.[gb]} />
                          </td>
                        ))}
                      </tr>

                      {/* Network Cost */}
                      <tr key={`${zone}-cogs-network`} className={styles.cogsRow}>
                        <td className={styles.funnelLabel}>
                          <span className={styles.funnelName}>− Network Cost</span>
                        </td>
                        <td className={styles.funnelCostEmpty} />
                        {allowances.map((gb, i) => {
                          const cell = values[zone]?.[gb];
                          const zoneCost = zoneCosts[zone];
                          const projectedNetworkCost =
                            cell?.projectedConsumptionRate != null && zoneCost != null
                              ? cell.projectedConsumptionRate * Number(gb) * zoneCost * cell.orders
                              : null;
                          return (
                            <td key={`${gb}-network`} className={`${styles.cogsDataCell} ${i > 0 ? styles.metricCellFirst : ''}`} colSpan={3}>
                              <CogsCell cell={cell} projectedValue={projectedNetworkCost} />
                            </td>
                          );
                        })}
                      </tr>

                      {/* Gross Margin */}
                      <tr key={`${zone}-cogs-margin`} className={`${styles.cogsRow} ${styles.cogsMarginRow}`}>
                        <td className={styles.funnelLabel}>
                          <span className={styles.funnelName} style={{ fontWeight: 700, color: 'var(--color-primary)' }}>Gross Margin</span>
                        </td>
                        <td className={styles.funnelCostEmpty} />
                        {allowances.map((gb, i) => {
                          const cell = values[zone]?.[gb];
                          const zoneCost = zoneCosts[zone];
                          const projectedNetworkCost =
                            cell?.projectedConsumptionRate != null && zoneCost != null
                              ? cell.projectedConsumptionRate * Number(gb) * zoneCost * cell.orders
                              : null;
                          const projectedGrossMargin =
                            cell != null && projectedNetworkCost != null
                              ? cell.netRevenueAfterFees - projectedNetworkCost
                              : null;
                          const projectedGrossMarginPct =
                            projectedGrossMargin != null && cell != null && cell.netRevenueAfterFees !== 0
                              ? projectedGrossMargin / cell.netRevenueAfterFees
                              : null;
                          return (
                            <td key={`${gb}-margin`} className={`${styles.cogsDataCell} ${i > 0 ? styles.metricCellFirst : ''}`} colSpan={3}>
                              <CogsCell cell={cell} isMargin projectedValue={projectedGrossMargin} projectedPct={projectedGrossMarginPct} />
                            </td>
                          );
                        })}
                      </tr>
                    </>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
