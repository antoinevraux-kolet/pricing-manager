import { Router } from 'express';
import { BigQuery } from '@google-cloud/bigquery';
import { getDestinationVisitsSummary } from './posthog-destination-visits';

const bigquery = new BigQuery({
  projectId: process.env.BIGQUERY_PROJECT_ID,
  credentials: {
    client_email: process.env.BIGQUERY_CLIENT_EMAIL,
    private_key: process.env.BIGQUERY_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const BI_DATASET = process.env.BIGQUERY_BI_DATASET ?? 'bi';

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

const r2 = (v: number | null) => v == null ? null : Math.round(v * 100) / 100;

function toFloat(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'object' && 'value' in (v as object)) return Number((v as { value: string }).value) || null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split('T')[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

interface OrderBQRow {
  order_zone: string;
  data_gb: number;
  price_before_eur: number | null;
  price_before_usd: number | null;
  price_after_eur: number | null;
  price_after_usd: number | null;
  orders_before: number;
  orders_after: number;
  catalog_rev_before: number;
  catalog_rev_after: number;
  discount_before: number;
  discount_after: number;
  gross_rev_before: number;
  gross_rev_after: number;
  net_rev_before: number;
  net_rev_after: number;
  total_cost_before: number;
  total_cost_after: number;
}

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

export const pricingRouter = Router();

pricingRouter.get('/comparison2', async (req, res) => {
  try {
    const refDate = typeof req.query.refDate === 'string' ? req.query.refDate : subtractDays(getToday(), 14);
    const weeksRaw = typeof req.query.weeks === 'string' ? parseInt(req.query.weeks, 10) : NaN;
    const weeks = isNaN(weeksRaw) ? 2 : Math.max(1, Math.min(12, weeksRaw));

    const nDays = 7 * weeks - 1;
    const beforeTo = subtractDays(refDate, 1);
    const beforeFrom = subtractDays(refDate, nDays);
    const afterFrom = addDays(refDate, 1);
    const afterTo = addDays(refDate, nDays);

    const query = `
      SELECT
        order_zone,
        CAST(ROUND(order_added_bytes / 1000000000.0) AS INT64) AS data_gb,
        AVG(CASE WHEN ROUND(order_currency_exchange_rate, 2) = 1.0
                  AND DATE(created_at) BETWEEN '${beforeFrom}' AND '${beforeTo}'
          THEN catalog_price_eur_or_usd END)                                   AS price_before_eur,
        AVG(CASE WHEN ROUND(order_currency_exchange_rate, 2) != 1.0 AND (plan_primary_currency = 'USD')
                  AND DATE(created_at) BETWEEN '${beforeFrom}' AND '${beforeTo}'
          THEN catalog_price_eur_or_usd END)    AS price_before_usd,
        AVG(CASE WHEN ROUND(order_currency_exchange_rate, 2) = 1.0
                  AND DATE(created_at) BETWEEN '${afterFrom}' AND '${afterTo}'
          THEN catalog_price_eur_or_usd END)                                   AS price_after_eur,
        AVG(CASE WHEN ROUND(order_currency_exchange_rate, 2) != 1.0 AND (plan_primary_currency = 'USD')
                  AND DATE(created_at) BETWEEN '${afterFrom}' AND '${afterTo}'
          THEN catalog_price_eur_or_usd END)    AS price_after_usd,
        COUNTIF(DATE(created_at) BETWEEN '${beforeFrom}' AND '${beforeTo}') AS orders_before,
        COUNTIF(DATE(created_at) BETWEEN '${afterFrom}' AND '${afterTo}')   AS orders_after,
        SUM(CASE WHEN DATE(created_at) BETWEEN '${beforeFrom}' AND '${beforeTo}'
          THEN catalog_price_eur ELSE 0 END)                              AS catalog_rev_before,
        SUM(CASE WHEN DATE(created_at) BETWEEN '${afterFrom}' AND '${afterTo}'
          THEN catalog_price_eur ELSE 0 END)                              AS catalog_rev_after,
        SUM(CASE WHEN DATE(created_at) BETWEEN '${beforeFrom}' AND '${beforeTo}'
          THEN discount_eur ELSE 0 END)                                   AS discount_before,
        SUM(CASE WHEN DATE(created_at) BETWEEN '${afterFrom}' AND '${afterTo}'
          THEN discount_eur ELSE 0 END)                                   AS discount_after,
        SUM(CASE WHEN DATE(created_at) BETWEEN '${beforeFrom}' AND '${beforeTo}'
          THEN effective_price_eur ELSE 0 END)                            AS gross_rev_before,
        SUM(CASE WHEN DATE(created_at) BETWEEN '${afterFrom}' AND '${afterTo}'
          THEN effective_price_eur ELSE 0 END)                            AS gross_rev_after,
        SUM(CASE WHEN DATE(created_at) BETWEEN '${beforeFrom}' AND '${beforeTo}'
          THEN net_effective_price_eur ELSE 0 END)                        AS net_rev_before,
        SUM(CASE WHEN DATE(created_at) BETWEEN '${afterFrom}' AND '${afterTo}'
          THEN net_effective_price_eur ELSE 0 END)                        AS net_rev_after,
        SUM(CASE WHEN DATE(created_at) BETWEEN '${beforeFrom}' AND '${beforeTo}'
          THEN payment_fees_allocated_eur + network_cost_allocated_eur ELSE 0 END) AS total_cost_before,
        SUM(CASE WHEN DATE(created_at) BETWEEN '${afterFrom}' AND '${afterTo}'
          THEN payment_fees_allocated_eur + network_cost_allocated_eur ELSE 0 END) AS total_cost_after
      FROM \`${process.env.BIGQUERY_PROJECT_ID}.${BI_DATASET}.bi_orders_with_costs_fifo\`
      WHERE DATE(created_at) BETWEEN '${beforeFrom}' AND '${afterTo}'
        AND is_gift = FALSE
        AND order_added_bytes IS NOT NULL
        AND catalog_price_eur_or_usd > 0
        AND order_status != "Data Donation"
        AND order_currency_exchange_rate IS NOT NULL
      GROUP BY order_zone, data_gb
      HAVING data_gb > 0
      ORDER BY order_zone, data_gb
    `;

    const [rows] = await bigquery.query(query);
    const entries = rows as OrderBQRow[];

    const result: OrderComparisonRow[] = entries.map(e => ({
      zoneCode: e.order_zone,
      dataGb: String(e.data_gb),
      priceBeforeEur: r2(e.price_before_eur),
      priceBeforeUsd: r2(e.price_before_usd),
      priceAfterEur: r2(e.price_after_eur),
      priceAfterUsd: r2(e.price_after_usd),
      ordersBefore: e.orders_before,
      ordersAfter: e.orders_after,
      catalogRevBefore: r2(toFloat(e.catalog_rev_before)) ?? 0,
      catalogRevAfter: r2(toFloat(e.catalog_rev_after)) ?? 0,
      discountBefore: r2(toFloat(e.discount_before)) ?? 0,
      discountAfter: r2(toFloat(e.discount_after)) ?? 0,
      grossRevBefore: r2(e.gross_rev_before) ?? 0,
      grossRevAfter: r2(e.gross_rev_after) ?? 0,
      netRevBefore: r2(toFloat(e.net_rev_before)) ?? 0,
      netRevAfter: r2(toFloat(e.net_rev_after)) ?? 0,
      totalCostBefore: r2(toFloat(e.total_cost_before)) ?? 0,
      totalCostAfter: r2(toFloat(e.total_cost_after)) ?? 0,
    }));

    const data: OrderComparisonData = { rows: result, nDays, beforeFrom, beforeTo, afterFrom, afterTo };
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch comparison data' });
  }
});

// Maps ISO alpha-3 zone code (from PostHog plan_zone property) → order_zone in bi_users_orders
const ISO_TO_ZONE_NAME: Record<string, string> = {
  ALB: 'Albania', AND: 'Andorra', AUT: 'Austria', BEL: 'Belgium',
  BGR: 'Bulgaria', BIH: 'Bosnia and Herzegovina', BLR: 'Belarus',
  CHE: 'Switzerland', CYP: 'Cyprus', CZE: 'Czech Republic',
  DEU: 'Germany', DNK: 'Denmark', ESP: 'Spain', EST: 'Estonia',
  FIN: 'Finland', FRA: 'France', FRO: 'Faroe', GBR: 'United Kingdom',
  GIB: 'Gibraltar', GRC: 'Greece', GRL: 'Greenland', HRV: 'Croatia',
  HUN: 'Hungary', IRL: 'Ireland', ISL: 'Iceland', ITA: 'Italy',
  LTU: 'Lithuania', LUX: 'Luxembourg', LVA: 'Latvia', MCO: 'Monaco',
  MDA: 'Moldova', MKD: 'Macedonia', MLT: 'Malta', MNE: 'Montenegro',
  NLD: 'Netherlands', NOR: 'Norway', POL: 'Poland', PRT: 'Portugal',
  ROU: 'Romania', SRB: 'Serbia', SVK: 'Slovakia', SVN: 'Slovenia',
  SWE: 'Sweden', UKR: 'Ukraine',
  ARE: 'United Arab Emirates', ARM: 'Armenia', AZE: 'Azerbaijan',
  BHR: 'Bahrain', GEO: 'Georgia', IRQ: 'Iraq', ISR: 'Israel',
  JOR: 'Jordan', KWT: 'Kuwait', OMN: 'Oman', QAT: 'Qatar',
  SAU: 'Saudi Arabia', TUR: 'Turkey',
  BEN: 'Benin', BFA: 'Burkina Faso', BWA: 'Botswana',
  CAF: 'Central African Republic', CIV: 'Ivory Coast', CMR: 'Cameroon',
  COD: 'Democratic Republic of Congo', COG: 'Republic of Congo',
  CPV: 'Cape Verde', DZA: 'Algeria', EGY: 'Egypt', GAB: 'Gabon',
  GHA: 'Ghana', GIN: 'Guinea', GMB: 'Gambia', GNB: 'Guinea-Bissau',
  KEN: 'Kenya', MAR: 'Morocco', MDG: 'Madagascar', MLI: 'Mali',
  MOZ: 'Mozambique', MRT: 'Mauritania', MUS: 'Mauritius', MWI: 'Malawi',
  NER: 'Niger', NGA: 'Nigeria', SEN: 'Senegal', SLE: 'Sierra Leone',
  SYC: 'Seychelles', TCD: 'Chad', TGO: 'Togo', TUN: 'Tunisia',
  TZA: 'Tanzania', UGA: 'Uganda', ZAF: 'South Africa',
  AUS: 'Australia', BGD: 'Bangladesh', CHN: 'China', FJI: 'Fiji',
  GUM: 'Guam', HKG: 'Hong Kong', IDN: 'Indonesia', IND: 'India',
  JPN: 'Japan', KAZ: 'Kazakhstan', KGZ: 'Kyrgyzstan', KHM: 'Cambodia',
  KOR: 'South Korea', LAO: 'Laos', LKA: 'Sri Lanka', MAC: 'Macau',
  MDV: 'Maldives', MNG: 'Mongolia', MYS: 'Malaysia', NPL: 'Nepal',
  NZL: 'New Zealand', PAK: 'Pakistan', PHL: 'Philippines',
  PNG: 'Papua New Guinea', PYF: 'French Polynesia', SGP: 'Singapore',
  THA: 'Thailand', TWN: 'Taiwan', UZB: 'Uzbekistan', VNM: 'Vietnam',
  AIA: 'Anguilla', ARG: 'Argentina', ATG: 'Antigua and Barbuda',
  BES: 'Bonaire, Sint Eustatius and Saba', BHS: 'Bahamas', BLZ: 'Belize',
  BMU: 'Bermuda', BOL: 'Bolivia', BRA: 'Brazil', BRB: 'Barbados',
  CAN: 'Canada', CHL: 'Chile', COL: 'Colombia', CRI: 'Costa Rica',
  CUW: 'Curaçao', CYM: 'Cayman Islands', DMA: 'Dominica',
  DOM: 'Dominican Republic', ECU: 'Ecuador', GLP: 'Guadeloupe',
  GRD: 'Grenada', GTM: 'Guatemala', GUF: 'French Guiana',
  HND: 'Honduras', JAM: 'Jamaica', KNA: 'Saint Kitts and Nevis',
  LCA: 'Saint Lucia', MAF: 'Saint Martin', MEX: 'Mexico',
  MSR: 'Montserrat', MTQ: 'Martinique', NIC: 'Nicaragua',
  PAN: 'Panama', PER: 'Peru', PRI: 'Puerto Rico', PRY: 'Paraguay',
  PSE: 'Palestine', REU: 'Reunion', SLV: 'El Salvador',
  SUR: 'Suriname', SXM: 'Sint Maarten', TCA: 'Turks and Caicos Islands',
  TTO: 'Trinidad and Tobago', URY: 'Uruguay', USA: 'United States of America',
  VCT: 'Saint Vincent and the Grenadines', VEN: 'Venezuela',
  VGB: 'British Virgin Islands', VIR: 'U.S. Virgin Islands',
  AF1: 'Africa 1', AF2: 'Africa 2', ASI: 'Asia', CAR: 'Caribbean',
  EUR: 'Europe', EUK: 'European Union and UK', GLO: 'Global',
  LAA: 'Latin America', MEN: 'Middle East and North Africa',
  NLA: 'Netherlands Antilles', NOA: 'North America', OC1: 'Oceania 1',
};

pricingRouter.get('/observation', async (req, res) => {
  try {
    const from = typeof req.query.from === 'string' ? req.query.from : subtractDays(getToday(), 29);
    const to   = typeof req.query.to   === 'string' ? req.query.to   : getToday();

    const query = `
      SELECT
        order_zone,
        CAST(ROUND(order_added_bytes / 1000000000.0) AS INT64) AS data_gb,
        AVG(CASE WHEN ROUND(order_currency_exchange_rate, 2) = 1.0
          THEN catalog_price_eur_or_usd END)                                 AS price_eur,
        AVG(CASE WHEN ROUND(order_currency_exchange_rate, 2) != 1.0 AND (plan_primary_currency = 'USD')
          THEN catalog_price_eur_or_usd END)                                 AS price_usd,
        COUNT(*)                                                              AS orders,
        SUM(catalog_price_eur)                                                AS catalog_rev,
        SUM(discount_eur)                                                     AS discount,
        SUM(effective_price_eur)                                              AS gross_rev,
        SUM(net_effective_price_eur)                                          AS net_rev,
        SUM(payment_fees_allocated_eur + network_cost_allocated_eur)          AS total_cost
      FROM \`${process.env.BIGQUERY_PROJECT_ID}.${BI_DATASET}.bi_orders_with_costs_fifo\`
      WHERE DATE(created_at) BETWEEN '${from}' AND '${to}'
        AND is_gift = FALSE
        AND order_added_bytes IS NOT NULL
        AND catalog_price_eur_or_usd > 0
        AND order_status != "Data Donation"
        AND order_currency_exchange_rate IS NOT NULL
      GROUP BY order_zone, data_gb
      HAVING data_gb > 0
      ORDER BY order_zone, data_gb
    `;

    const [rows] = await bigquery.query(query);
    type ObsBQRow = {
      order_zone: string; data_gb: number;
      price_eur: number | null; price_usd: number | null;
      orders: number; catalog_rev: unknown; discount: unknown;
      gross_rev: unknown; net_rev: unknown; total_cost: unknown;
    };
    const entries = rows as ObsBQRow[];

    const result = entries.map(e => ({
      zoneCode: e.order_zone,
      dataGb: String(e.data_gb),
      priceEur: r2(toFloat(e.price_eur)),
      priceUsd: r2(toFloat(e.price_usd)),
      orders: e.orders,
      catalogRev: r2(toFloat(e.catalog_rev)) ?? 0,
      discount:   r2(toFloat(e.discount))    ?? 0,
      grossRev:   r2(toFloat(e.gross_rev))   ?? 0,
      netRev:     r2(toFloat(e.net_rev))     ?? 0,
      totalCost:  r2(toFloat(e.total_cost))  ?? 0,
    }));

    res.json({ rows: result, from, to });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch observation data' });
  }
});

pricingRouter.get('/destination-visits-single', async (req, res) => {
  try {
    const from = typeof req.query.from === 'string' ? req.query.from : subtractDays(getToday(), 29);
    const to   = typeof req.query.to   === 'string' ? req.query.to   : getToday();

    const raw = await getDestinationVisitsSummary({ startDate: from, endDate: to });

    const visits: Record<string, number> = {};
    for (const v of raw) {
      const name = ISO_TO_ZONE_NAME[v.zone];
      if (name) visits[name] = v.uniqueVisitors;
    }

    res.json({ visits, from, to });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[destination-visits-single]', msg);
    res.status(500).json({ error: msg });
  }
});

pricingRouter.get('/destination-visits', async (req, res) => {
  try {
    const refDate = typeof req.query.refDate === 'string' ? req.query.refDate : subtractDays(getToday(), 14);
    const weeksRaw = typeof req.query.weeks === 'string' ? parseInt(req.query.weeks, 10) : NaN;
    const weeks = isNaN(weeksRaw) ? 2 : Math.max(1, Math.min(12, weeksRaw));

    const nDays = 7 * weeks - 1;
    const beforeTo = subtractDays(refDate, 1);
    const beforeFrom = subtractDays(refDate, nDays);
    const afterFrom = addDays(refDate, 1);
    const afterTo = addDays(refDate, nDays);

    const [rawBefore, rawAfter] = await Promise.all([
      getDestinationVisitsSummary({ startDate: beforeFrom, endDate: beforeTo }),
      getDestinationVisitsSummary({ startDate: afterFrom, endDate: afterTo }),
    ]);

    const toMap = (arr: { zone: string; uniqueVisitors: number }[]) => {
      const map: Record<string, number> = {};
      for (const v of arr) {
        const name = ISO_TO_ZONE_NAME[v.zone];
        if (name) map[name] = v.uniqueVisitors;
      }
      return map;
    };

    res.json({ before: toMap(rawBefore), after: toMap(rawAfter), beforeFrom, beforeTo, afterFrom, afterTo });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[destination-visits]', msg);
    res.status(500).json({ error: msg });
  }
});
