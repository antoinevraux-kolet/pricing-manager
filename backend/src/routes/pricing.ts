import { Router } from 'express';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.BIGQUERY_PROJECT_ID,
  credentials: {
    client_email: process.env.BIGQUERY_CLIENT_EMAIL,
    private_key: process.env.BIGQUERY_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const DATASET = process.env.BIGQUERY_DATASET;

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
