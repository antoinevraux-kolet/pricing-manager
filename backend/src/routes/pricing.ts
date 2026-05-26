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

function getThisMonday(): string {
  const today = new Date();
  const day = today.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() + diff);
  return monday.toISOString().split('T')[0];
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split('T')[0];
}

function toDateString(value: unknown): string {
  if (value && typeof value === 'object' && 'value' in value) {
    return String((value as { value: string }).value);
  }
  return String(value);
}

interface BQRow {
  zone_code: string;
  data_allowance_gb: number;
  count_orders: number;
  catalog_price_revenue_eur: number;
  gross_revenue_ttc_eur: number;
  net_revenue_ht_eur: number;
  net_revenue_after_fees_eur: number;
  network_cost_eur: number;
  gross_margin_eur: number;
  gross_margin_pct: number;
  consumption_rate: number;
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
}

export interface PricingData {
  zones: string[];
  allowances: string[];
  values: Record<string, Record<string, CellMetrics | null>>;
  zoneCosts: Record<string, number | null>;
  costDateRange: { from: string; to: string };
  weekStart: string;
}

export const pricingRouter = Router();

pricingRouter.get('/weeks', async (_req, res) => {
  try {
    const query = `
      SELECT DISTINCT week_start
      FROM \`${process.env.BIGQUERY_PROJECT_ID}.${DATASET}.mart_pricing_margin\`
      WHERE customer_segment = 'B2C'
      ORDER BY week_start DESC
    `;
    const [rows] = await bigquery.query(query);
    const weeks = (rows as { week_start: unknown }[]).map((r) =>
      toDateString(r.week_start)
    );
    res.json(weeks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch weeks' });
  }
});

pricingRouter.get('/', async (req, res) => {
  try {
    const weekStart = typeof req.query.week === 'string' ? req.query.week : getThisMonday();

    const query = `
      SELECT zone_code, data_allowance_gb, count_orders, catalog_price_revenue_eur,
             gross_revenue_ttc_eur, net_revenue_ht_eur, net_revenue_after_fees_eur,
             network_cost_eur, gross_margin_eur, gross_margin_pct, consumption_rate
      FROM \`${process.env.BIGQUERY_PROJECT_ID}.${DATASET}.mart_pricing_margin\`
      WHERE week_start = '${weekStart}'
        AND customer_segment = 'B2C'
        AND data_allowance_gb IS NOT NULL
      ORDER BY zone_code, data_allowance_gb
    `;

    const costFrom = subtractDays(weekStart, 90);
    const costTo   = subtractDays(weekStart, 35);

    const costQuery = `
      SELECT zone_code,
             SAFE_DIVIDE(SUM(network_cost_eur), SUM(consumed_data_gb)) AS avg_cost_per_gb
      FROM \`${process.env.BIGQUERY_PROJECT_ID}.${DATASET}.mart_pricing_margin\`
      WHERE week_start BETWEEN '${costFrom}' AND '${costTo}'
        AND customer_segment = 'B2C'
      GROUP BY zone_code
    `;

    const projectedConsumptionQuery = `
      SELECT zone_code, data_allowance_gb,
             AVG(consumption_rate) AS avg_consumption_rate
      FROM \`${process.env.BIGQUERY_PROJECT_ID}.${DATASET}.mart_pricing_margin\`
      WHERE week_start BETWEEN '${costFrom}' AND '${costTo}'
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
            orders: match.count_orders,
            avgPrice: match.count_orders > 0 ? match.catalog_price_revenue_eur / match.count_orders : 0,
            revenue: match.catalog_price_revenue_eur,
            grossRevenueTtc: match.gross_revenue_ttc_eur,
            netRevenueHt: match.net_revenue_ht_eur,
            netRevenueAfterFees: match.net_revenue_after_fees_eur,
            networkCost: match.network_cost_eur,
            grossMargin: match.gross_margin_eur,
            grossMarginPct: match.gross_margin_pct,
            consumptionRate: match.consumption_rate,
            projectedConsumptionRate: projConsEntries.find(
              (r) => r.zone_code === zone && String(r.data_allowance_gb) === allowance
            )?.avg_consumption_rate ?? null,
          };
        } else {
          values[zone][allowance] = null;
        }
      }
    }

    const zoneCosts: Record<string, number | null> = {};
    for (const zone of zones) {
      const match = costEntries.find((r) => r.zone_code === zone);
      zoneCosts[zone] = match ? match.avg_cost_per_gb : null;
    }

    const data: PricingData = { zones, allowances, values, zoneCosts, costDateRange: { from: costFrom, to: costTo }, weekStart };
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch pricing data' });
  }
});
