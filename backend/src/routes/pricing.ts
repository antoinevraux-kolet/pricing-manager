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

const DATASET = process.env.BIGQUERY_DATASET;
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

interface BQRow {
  zone_code: string;
  data_allowance_gb: number;
  n_paid_plans: number;
  list_price_eur: number;
  gross_revenue_ttc_eur: number;
  net_revenue_ht_eur: number;
  net_revenue_after_fees_eur: number;
  network_cost_eur_paid_plans: number;
  gross_margin_eur: number;
  gross_margin_pct: number;
  consumption_rate: number;
  competitor_min_price_eur: number | null;
}

export interface CellMetrics {
  orders: number;
  avgPrice: number;
  revenue: number;
  grossRevenueTtc: number;
  netRevenueHt: number;
  netRevenueAfterFees: number;
  networkCost: number;
  grossMargin: number;
  grossMarginPct: number;
  consumptionRate: number;
  projectedConsumptionRate: number | null;
  competitorMinPrice: number | null;
}

export interface PricingData {
  zones: string[];
  allowances: string[];
  values: Record<string, Record<string, CellMetrics | null>>;
  zoneCosts: Record<string, number | null>;
  costDateRange: { from: string; to: string };
}

export const pricingRouter = Router();

pricingRouter.get('/', async (req, res) => {
  try {
    const dateTo   = typeof req.query.to   === 'string' ? req.query.to   : getToday();
    const dateFrom = typeof req.query.from === 'string' ? req.query.from : subtractDays(dateTo, 7);

    const query = `
      SELECT
        zone_code,
        data_allowance_gb,
        SUM(n_paid_plans)                                                        AS n_paid_plans,
        SAFE_DIVIDE(SUM(list_price_eur * n_paid_plans), SUM(n_paid_plans))        AS list_price_eur,
        SUM(gross_revenue_ttc_eur)                                               AS gross_revenue_ttc_eur,
        SUM(net_revenue_ht_eur)                                                  AS net_revenue_ht_eur,
        SUM(net_revenue_after_fees_eur)                                          AS net_revenue_after_fees_eur,
        SUM(network_cost_eur_paid_plans)                                                    AS network_cost_eur_paid_plans,
        SUM(gross_margin_eur)                                                    AS gross_margin_eur,
        SAFE_DIVIDE(SUM(gross_margin_eur), SUM(net_revenue_ht_eur))              AS gross_margin_pct,
        SAFE_DIVIDE(SUM(consumed_data_gb_paid_plans), SUM(provisioned_data_gb_paid_plans)) AS consumption_rate,
        SAFE_DIVIDE(SUM(competitor_min_price_eur * n_paid_plans), SUM(n_paid_plans)) AS competitor_min_price_eur
      FROM \`${process.env.BIGQUERY_PROJECT_ID}.${DATASET}.mart_pricing_margin\`
      WHERE plan_purchase_date BETWEEN '${dateFrom}' AND '${dateTo}'
        AND customer_segment = 'B2C'
        AND data_allowance_gb IS NOT NULL
      GROUP BY zone_code, data_allowance_gb
      ORDER BY zone_code, data_allowance_gb
    `;

    const costFrom = subtractDays(dateFrom, 90);
    const costTo   = subtractDays(dateFrom, 35);

    const costQuery = `
      SELECT zone_code,
             SAFE_DIVIDE(SUM(network_cost_eur_paid_plans), SUM(consumed_data_gb)) AS avg_cost_per_gb
      FROM \`${process.env.BIGQUERY_PROJECT_ID}.${DATASET}.mart_pricing_margin\`
      WHERE plan_purchase_date BETWEEN '${costFrom}' AND '${costTo}'
        AND customer_segment = 'B2C'
      GROUP BY zone_code
    `;

    const projectedConsumptionQuery = `
      SELECT zone_code, data_allowance_gb,
             SAFE_DIVIDE(SUM(consumed_data_gb_paid_plans), SUM(provisioned_data_gb_paid_plans)) AS avg_consumption_rate
      FROM \`${process.env.BIGQUERY_PROJECT_ID}.${DATASET}.mart_pricing_margin\`
      WHERE plan_purchase_date BETWEEN '${costFrom}' AND '${costTo}'
        AND customer_segment = 'B2C'
        AND data_allowance_gb IS NOT NULL
      GROUP BY zone_code, data_allowance_gb
    `;

    const [[rows], [costRows], [projConsRows]] = await Promise.all([
      bigquery.query(query),
      bigquery.query(costQuery),
      bigquery.query(projectedConsumptionQuery),
    ]);
    const entries = rows as BQRow[];
    const costEntries = costRows as { zone_code: string; avg_cost_per_gb: number | null }[];
    const projConsEntries = projConsRows as { zone_code: string; data_allowance_gb: number; avg_consumption_rate: number | null }[];

    const zones = [...new Set(entries.map((e) => e.zone_code))].sort();
    const allowances = [
      ...new Set(entries.map((e) => String(e.data_allowance_gb))),
    ].sort((a, b) => Number(a) - Number(b));

    const values: Record<string, Record<string, CellMetrics | null>> = {};
    for (const zone of zones) {
      values[zone] = {};
      for (const allowance of allowances) {
        const match = entries.find(
          (e) => e.zone_code === zone && String(e.data_allowance_gb) === allowance
        );
        if (match) {
          values[zone][allowance] = {
            orders: match.n_paid_plans,
            avgPrice: r2(match.list_price_eur) ?? 0,
            revenue: r2((match.list_price_eur ?? 0) * match.n_paid_plans) ?? 0,
            grossRevenueTtc: r2(match.gross_revenue_ttc_eur) ?? 0,
            netRevenueHt: r2(match.net_revenue_ht_eur) ?? 0,
            netRevenueAfterFees: r2(match.net_revenue_after_fees_eur) ?? 0,
            networkCost: r2(match.network_cost_eur_paid_plans) ?? 0,
            grossMargin: r2(match.gross_margin_eur) ?? 0,
            grossMarginPct: match.gross_margin_pct,
            consumptionRate: match.consumption_rate,
            projectedConsumptionRate: projConsEntries.find(
              (r) => r.zone_code === zone && String(r.data_allowance_gb) === allowance
            )?.avg_consumption_rate ?? null,
            competitorMinPrice: r2(match.competitor_min_price_eur ?? null),
          };
        } else {
          values[zone][allowance] = null;
        }
      }
    }

    const zoneCosts: Record<string, number | null> = {};
    for (const zone of zones) {
      const match = costEntries.find((r) => r.zone_code === zone);
      zoneCosts[zone] = match ? r2(match.avg_cost_per_gb) : null;
    }

    const data: PricingData = { zones, allowances, values, zoneCosts, costDateRange: { from: costFrom, to: costTo } };
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch pricing data' });
  }
});

interface BQComparisonRow {
  zone_code: string;
  data_allowance_gb: number;
  price_before: number | null;
  price_after: number | null;
  orders_before: number;
  orders_after: number;
  rev_before: number;
  rev_after: number;
  cost_before: number;
  cost_after: number;
  margin_before: number;
  margin_after: number;
  n_plans_before: number;
  n_plans_after: number;
  n_expired_before: number;
  n_expired_after: number;
}

export interface ComparisonRow {
  zoneCode: string;
  dataAllowanceGb: string;
  priceBefore: number | null;
  priceAfter: number | null;
  ordersBefore: number;
  ordersAfter: number;
  revDayBefore: number;
  revDayAfter: number;
  costDayBefore: number;
  costDayAfter: number;
  marginDayBefore: number;
  marginDayAfter: number;
  nPlansBefore: number;
  nPlansAfter: number;
  nExpiredBefore: number;
  nExpiredAfter: number;
  projCostDayBefore: number;
  projCostDayAfter: number;
  projMarginDayBefore: number;
  projMarginDayAfter: number;
}

export interface ProjectionAssumption {
  zoneCode: string;
  dataAllowanceGb: string;
  avgCostPerGb: number | null;
  avgConsumptionRate: number | null;
}

export interface ComparisonData {
  rows: ComparisonRow[];
  nDays: number;
  beforeFrom: string;
  beforeTo: string;
  afterFrom: string;
  afterTo: string;
  projCostFrom: string;
  projCostTo: string;
  projAssumptions: ProjectionAssumption[];
}

pricingRouter.get('/comparison', async (req, res) => {
  try {
    const refDate = typeof req.query.refDate === 'string' ? req.query.refDate : subtractDays(getToday(), 14);
    const weeksRaw = typeof req.query.weeks === 'string' ? parseInt(req.query.weeks, 10) : NaN;
    const weeks = isNaN(weeksRaw) ? 2 : Math.max(1, Math.min(12, weeksRaw));

    const nDays = 7 * weeks - 1;
    const beforeTo   = subtractDays(refDate, 1);
    const beforeFrom = subtractDays(refDate, nDays);
    const afterFrom  = addDays(refDate, 1);
    const afterTo    = addDays(refDate, nDays);

    // Lookback window for projected COGS (anchored to start of before period)
    const projCostFrom = subtractDays(beforeFrom, 90);
    const projCostTo   = subtractDays(beforeFrom, 35);

    const query = `
      SELECT
        zone_code,
        data_allowance_gb,
        SAFE_DIVIDE(
          SUM(CASE WHEN plan_purchase_date BETWEEN '${beforeFrom}' AND '${beforeTo}'
            THEN list_price_eur * n_paid_plans END),
          SUM(CASE WHEN plan_purchase_date BETWEEN '${beforeFrom}' AND '${beforeTo}'
            THEN n_paid_plans END)
        ) AS price_before,
        SAFE_DIVIDE(
          SUM(CASE WHEN plan_purchase_date BETWEEN '${afterFrom}' AND '${afterTo}'
            THEN list_price_eur * n_paid_plans END),
          SUM(CASE WHEN plan_purchase_date BETWEEN '${afterFrom}' AND '${afterTo}'
            THEN n_paid_plans END)
        ) AS price_after,
        SUM(CASE WHEN plan_purchase_date BETWEEN '${beforeFrom}' AND '${beforeTo}'
          THEN n_paid_plans ELSE 0 END)                                AS orders_before,
        SUM(CASE WHEN plan_purchase_date BETWEEN '${afterFrom}' AND '${afterTo}'
          THEN n_paid_plans ELSE 0 END)                                AS orders_after,
        SUM(CASE WHEN plan_purchase_date BETWEEN '${beforeFrom}' AND '${beforeTo}'
          THEN net_revenue_after_fees_eur ELSE 0 END)                  AS rev_before,
        SUM(CASE WHEN plan_purchase_date BETWEEN '${afterFrom}' AND '${afterTo}'
          THEN net_revenue_after_fees_eur ELSE 0 END)                  AS rev_after,
        SUM(CASE WHEN plan_purchase_date BETWEEN '${beforeFrom}' AND '${beforeTo}'
          THEN network_cost_eur_paid_plans ELSE 0 END)                 AS cost_before,
        SUM(CASE WHEN plan_purchase_date BETWEEN '${afterFrom}' AND '${afterTo}'
          THEN network_cost_eur_paid_plans ELSE 0 END)                 AS cost_after,
        SUM(CASE WHEN plan_purchase_date BETWEEN '${beforeFrom}' AND '${beforeTo}'
          THEN gross_margin_eur ELSE 0 END)                            AS margin_before,
        SUM(CASE WHEN plan_purchase_date BETWEEN '${afterFrom}' AND '${afterTo}'
          THEN gross_margin_eur ELSE 0 END)                            AS margin_after,
        SUM(CASE WHEN plan_purchase_date BETWEEN '${beforeFrom}' AND '${beforeTo}'
          THEN n_plans ELSE 0 END)                                     AS n_plans_before,
        SUM(CASE WHEN plan_purchase_date BETWEEN '${afterFrom}' AND '${afterTo}'
          THEN n_plans ELSE 0 END)                                     AS n_plans_after,
        SUM(CASE WHEN plan_purchase_date BETWEEN '${beforeFrom}' AND '${beforeTo}'
          THEN n_expired_plans ELSE 0 END)                             AS n_expired_before,
        SUM(CASE WHEN plan_purchase_date BETWEEN '${afterFrom}' AND '${afterTo}'
          THEN n_expired_plans ELSE 0 END)                             AS n_expired_after
      FROM \`${process.env.BIGQUERY_PROJECT_ID}.${DATASET}.mart_pricing_margin\`
      WHERE plan_purchase_date BETWEEN '${beforeFrom}' AND '${afterTo}'
        AND customer_segment = 'B2C'
        AND data_allowance_gb IS NOT NULL
      GROUP BY zone_code, data_allowance_gb
      ORDER BY zone_code, data_allowance_gb
    `;

    const projCostQuery = `
      SELECT zone_code,
             SAFE_DIVIDE(SUM(network_cost_eur_paid_plans), SUM(consumed_data_gb)) AS avg_cost_per_gb
      FROM \`${process.env.BIGQUERY_PROJECT_ID}.${DATASET}.mart_pricing_margin\`
      WHERE plan_purchase_date BETWEEN '${projCostFrom}' AND '${projCostTo}'
        AND customer_segment = 'B2C'
      GROUP BY zone_code
    `;

    const projConsQuery = `
      SELECT zone_code, data_allowance_gb,
             SAFE_DIVIDE(SUM(consumed_data_gb_paid_plans), SUM(provisioned_data_gb_paid_plans)) AS avg_consumption_rate
      FROM \`${process.env.BIGQUERY_PROJECT_ID}.${DATASET}.mart_pricing_margin\`
      WHERE plan_purchase_date BETWEEN '${projCostFrom}' AND '${projCostTo}'
        AND customer_segment = 'B2C'
        AND data_allowance_gb IS NOT NULL
      GROUP BY zone_code, data_allowance_gb
    `;

    const [[rows], [projCostRows], [projConsRows]] = await Promise.all([
      bigquery.query(query),
      bigquery.query(projCostQuery),
      bigquery.query(projConsQuery),
    ]);

    const entries      = rows as BQComparisonRow[];
    const costEntries  = projCostRows as { zone_code: string; avg_cost_per_gb: number | null }[];
    const consEntries  = projConsRows as { zone_code: string; data_allowance_gb: number; avg_consumption_rate: number | null }[];

    const result: ComparisonRow[] = entries.map(e => {
      const avgCostPerGb   = costEntries.find(r => r.zone_code === e.zone_code)?.avg_cost_per_gb ?? null;
      const projConsRate   = consEntries.find(r => r.zone_code === e.zone_code && String(r.data_allowance_gb) === String(e.data_allowance_gb))?.avg_consumption_rate ?? null;

      const projCostPerPlan = (projConsRate != null && avgCostPerGb != null)
        ? projConsRate * e.data_allowance_gb * avgCostPerGb
        : null;

      const projCostBefore   = projCostPerPlan != null ? projCostPerPlan * e.orders_before : e.cost_before;
      const projCostAfter    = projCostPerPlan != null ? projCostPerPlan * e.orders_after  : e.cost_after;
      const projMarginBefore = e.rev_before - projCostBefore;
      const projMarginAfter  = e.rev_after  - projCostAfter;

      return {
        zoneCode: e.zone_code,
        dataAllowanceGb: String(e.data_allowance_gb),
        priceBefore: r2(e.price_before),
        priceAfter:  r2(e.price_after),
        ordersBefore: e.orders_before,
        ordersAfter:  e.orders_after,
        revDayBefore:        r2(e.rev_before    / nDays) ?? 0,
        revDayAfter:         r2(e.rev_after     / nDays) ?? 0,
        costDayBefore:       r2(e.cost_before   / nDays) ?? 0,
        costDayAfter:        r2(e.cost_after    / nDays) ?? 0,
        marginDayBefore:     r2(e.margin_before / nDays) ?? 0,
        marginDayAfter:      r2(e.margin_after  / nDays) ?? 0,
        nPlansBefore:   e.n_plans_before,
        nPlansAfter:    e.n_plans_after,
        nExpiredBefore: e.n_expired_before,
        nExpiredAfter:  e.n_expired_after,
        projCostDayBefore:   r2(projCostBefore   / nDays) ?? 0,
        projCostDayAfter:    r2(projCostAfter    / nDays) ?? 0,
        projMarginDayBefore: r2(projMarginBefore / nDays) ?? 0,
        projMarginDayAfter:  r2(projMarginAfter  / nDays) ?? 0,
      };
    });

    const projAssumptions: ProjectionAssumption[] = entries.map(e => ({
      zoneCode: e.zone_code,
      dataAllowanceGb: String(e.data_allowance_gb),
      avgCostPerGb: toFloat(costEntries.find(r => r.zone_code === e.zone_code)?.avg_cost_per_gb ?? null),
      avgConsumptionRate: toFloat(consEntries.find(r => r.zone_code === e.zone_code && String(r.data_allowance_gb) === String(e.data_allowance_gb))?.avg_consumption_rate ?? null),
    }));

    const data: ComparisonData = { rows: result, nDays, beforeFrom, beforeTo, afterFrom, afterTo, projCostFrom, projCostTo, projAssumptions };
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch comparison data' });
  }
});

interface OrderBQRow {
  order_zone: string;
  data_gb: number;
  price_before_eur: number | null;
  price_before_usd: number | null;
  price_after_eur: number | null;
  price_after_usd: number | null;
  orders_before: number;
  orders_after: number;
  gross_rev_before: number;
  gross_rev_after: number;
  net_rev_before: number;
  net_rev_after: number;
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
  grossRevBefore: number;
  grossRevAfter: number;
  netRevBefore: number;
  netRevAfter: number;
}

export interface OrderComparisonData {
  rows: OrderComparisonRow[];
  nDays: number;
  beforeFrom: string;
  beforeTo: string;
  afterFrom: string;
  afterTo: string;
}

pricingRouter.get('/comparison2', async (req, res) => {
  try {
    const refDate = typeof req.query.refDate === 'string' ? req.query.refDate : subtractDays(getToday(), 14);
    const weeksRaw = typeof req.query.weeks === 'string' ? parseInt(req.query.weeks, 10) : NaN;
    const weeks = isNaN(weeksRaw) ? 2 : Math.max(1, Math.min(12, weeksRaw));

    const nDays    = 7 * weeks - 1;
    const beforeTo   = subtractDays(refDate, 1);
    const beforeFrom = subtractDays(refDate, nDays);
    const afterFrom  = addDays(refDate, 1);
    const afterTo    = addDays(refDate, nDays);

    const query = `
      SELECT
        order_zone,
        CAST(ROUND(data_bytes / 1000000000.0) AS INT64) AS data_gb,
        AVG(CASE WHEN ROUND(order_currency_exchange_rate, 2) = 1.0
                  AND DATE(created_at) BETWEEN '${beforeFrom}' AND '${beforeTo}'
          THEN order_original_price_amount END)          AS price_before_eur,
        AVG(CASE WHEN ROUND(order_currency_exchange_rate, 2) != 1.0
                  AND DATE(created_at) BETWEEN '${beforeFrom}' AND '${beforeTo}'
          THEN order_original_price_amount END)          AS price_before_usd,
        AVG(CASE WHEN ROUND(order_currency_exchange_rate, 2) = 1.0
                  AND DATE(created_at) BETWEEN '${afterFrom}' AND '${afterTo}'
          THEN order_original_price_amount END)          AS price_after_eur,
        AVG(CASE WHEN ROUND(order_currency_exchange_rate, 2) != 1.0
                  AND DATE(created_at) BETWEEN '${afterFrom}' AND '${afterTo}'
          THEN order_original_price_amount END)          AS price_after_usd,
        COUNTIF(DATE(created_at) BETWEEN '${beforeFrom}' AND '${beforeTo}') AS orders_before,
        COUNTIF(DATE(created_at) BETWEEN '${afterFrom}' AND '${afterTo}')   AS orders_after,
        SUM(CASE WHEN DATE(created_at) BETWEEN '${beforeFrom}' AND '${beforeTo}'
          THEN CAST(price_euro_cents AS FLOAT64) ELSE 0 END) / 100.0  AS gross_rev_before,
        SUM(CASE WHEN DATE(created_at) BETWEEN '${afterFrom}' AND '${afterTo}'
          THEN CAST(price_euro_cents AS FLOAT64) ELSE 0 END) / 100.0  AS gross_rev_after,
        SUM(CASE WHEN DATE(created_at) BETWEEN '${beforeFrom}' AND '${beforeTo}'
          THEN CAST(price_euro_cents AS FLOAT64) ELSE 0 END) / 120.0  AS net_rev_before,
        SUM(CASE WHEN DATE(created_at) BETWEEN '${afterFrom}' AND '${afterTo}'
          THEN CAST(price_euro_cents AS FLOAT64) ELSE 0 END) / 120.0  AS net_rev_after
      FROM \`${process.env.BIGQUERY_PROJECT_ID}.${BI_DATASET}.bi_users_orders\`
      WHERE DATE(created_at) BETWEEN '${beforeFrom}' AND '${afterTo}'
        AND is_gift = FALSE
        AND data_bytes IS NOT NULL
        AND original_price_euro_cents > 0
        AND order_currency_exchange_rate IS NOT NULL
      GROUP BY order_zone, data_gb
      HAVING data_gb > 0
      ORDER BY order_zone, data_gb
    `;

    const [rows] = await bigquery.query(query);
    const entries = rows as OrderBQRow[];

    const result: OrderComparisonRow[] = entries.map(e => ({
      zoneCode:       e.order_zone,
      dataGb:         String(e.data_gb),
      priceBeforeEur: r2(e.price_before_eur),
      priceBeforeUsd: r2(e.price_before_usd),
      priceAfterEur:  r2(e.price_after_eur),
      priceAfterUsd:  r2(e.price_after_usd),
      ordersBefore:   e.orders_before,
      ordersAfter:    e.orders_after,
      grossRevBefore: r2(e.gross_rev_before) ?? 0,
      grossRevAfter:  r2(e.gross_rev_after)  ?? 0,
      netRevBefore:   r2(e.net_rev_before)   ?? 0,
      netRevAfter:    r2(e.net_rev_after)    ?? 0,
    }));

    const data: OrderComparisonData = { rows: result, nDays, beforeFrom, beforeTo, afterFrom, afterTo };
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch comparison data' });
  }
});

export interface HistoricalMarginRow {
  zoneCode: string;
  nDataPlans: number;
  nOrders: number;
  netRevenueHt: number;
  totalCost: number;
  paymentFees: number;
  grossMargin: number | null;
  gbAllowed: number;
  gbConsumed: number;
}

export interface HistoricalMarginData {
  rows: HistoricalMarginRow[];
  startDate: string;
  endDate: string;
}

pricingRouter.get('/historical-margins', async (req, res) => {
  try {
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : subtractDays(getToday(), 365);
    const today = getToday();

    const query = `
      SELECT
        plan_zone_name,
        COUNT(*)                                                              AS n_data_plans,
        SUM(n_orders)                                                         AS n_orders,
        SUM(net_revenue_ht_eur)                                               AS net_revenue_ht_eur,
        SUM(total_cost_eur)                                                   AS total_cost_eur,
        SUM(payment_fees_eur)                                                 AS payment_fees_eur,
        SAFE_DIVIDE(
          SUM(net_revenue_ht_eur) - SUM(total_cost_eur) - SUM(payment_fees_eur),
          SUM(net_revenue_ht_eur)
        )                                                                     AS gross_margin,
        SUM(data_limit_bytes)    / 1000000000.0                               AS gb_allowed,
        SUM(consumed_data_bytes) / 1000000000.0                               AS gb_consumed
      FROM \`${process.env.BIGQUERY_PROJECT_ID}.${BI_DATASET}.fct_data_plan\`
      WHERE created_at > '${startDate}'
        AND expiration_date < '${today}'
      GROUP BY plan_zone_name
      ORDER BY net_revenue_ht_eur DESC
    `;

    const [rows] = await bigquery.query(query);

    const result: HistoricalMarginRow[] = (rows as Record<string, unknown>[]).map(e => ({
      zoneCode:     String(e.plan_zone_name),
      nDataPlans:   Number(e.n_data_plans)  || 0,
      nOrders:      Number(e.n_orders)      || 0,
      netRevenueHt: r2(toFloat(e.net_revenue_ht_eur)) ?? 0,
      totalCost:    r2(toFloat(e.total_cost_eur))     ?? 0,
      paymentFees:  r2(toFloat(e.payment_fees_eur))   ?? 0,
      grossMargin:  toFloat(e.gross_margin),
      gbAllowed:    r2(toFloat(e.gb_allowed))         ?? 0,
      gbConsumed:   r2(toFloat(e.gb_consumed))        ?? 0,
    }));

    const data: HistoricalMarginData = { rows: result, startDate, endDate: today };
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch historical margins' });
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

pricingRouter.get('/destination-visits', async (req, res) => {
  try {
    const refDate = typeof req.query.refDate === 'string' ? req.query.refDate : subtractDays(getToday(), 14);
    const weeksRaw = typeof req.query.weeks === 'string' ? parseInt(req.query.weeks, 10) : NaN;
    const weeks = isNaN(weeksRaw) ? 2 : Math.max(1, Math.min(12, weeksRaw));

    const nDays      = 7 * weeks - 1;
    const beforeTo   = subtractDays(refDate, 1);
    const beforeFrom = subtractDays(refDate, nDays);
    const afterFrom  = addDays(refDate, 1);
    const afterTo    = addDays(refDate, nDays);

    const [rawBefore, rawAfter] = await Promise.all([
      getDestinationVisitsSummary({ startDate: beforeFrom, endDate: beforeTo }),
      getDestinationVisitsSummary({ startDate: afterFrom,  endDate: afterTo  }),
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

pricingRouter.get('/historical-margins/distribution', async (req, res) => {
  try {
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : subtractDays(getToday(), 365);
    const zone      = typeof req.query.zone      === 'string' ? req.query.zone      : null;
    if (!zone) return res.status(400).json({ error: 'zone is required' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return res.status(400).json({ error: 'Invalid date' });
    const today = getToday();

    const [rows] = await bigquery.query({
      query: `
        WITH margins AS (
          SELECT SAFE_DIVIDE(
            net_revenue_ht_eur - total_cost_eur - payment_fees_eur,
            net_revenue_ht_eur
          ) AS margin
          FROM \`${process.env.BIGQUERY_PROJECT_ID}.${BI_DATASET}.fct_data_plan\`
          WHERE created_at > @startDate
            AND expiration_date < @today
            AND plan_zone_name = @zone
            AND net_revenue_ht_eur > 0
        ),
        stats AS (
          SELECT AVG(margin) AS mean, STDDEV(margin) AS std_dev, COUNT(*) AS total_count
          FROM margins
        ),
        histogram AS (
          SELECT ROUND(margin * 40) / 40.0 AS bucket, COUNT(*) AS cnt
          FROM margins
          GROUP BY bucket
          HAVING bucket BETWEEN -2.0 AND 3.0
        )
        SELECT h.bucket, h.cnt, s.mean, s.std_dev, s.total_count
        FROM histogram h CROSS JOIN stats s
        ORDER BY h.bucket
      `,
      params: { startDate, today, zone },
    });

    if (!rows.length) return res.json({ buckets: [], mean: null, stdDev: null, totalCount: 0 });

    const first = rows[0] as Record<string, unknown>;
    res.json({
      buckets:    (rows as Record<string, unknown>[]).map(r => ({ margin: toFloat(r.bucket) ?? 0, count: Number(r.cnt) || 0 })),
      mean:       toFloat(first.mean),
      stdDev:     toFloat(first.std_dev),
      totalCount: Number(first.total_count) || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch distribution' });
  }
});
