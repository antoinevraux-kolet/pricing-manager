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

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
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
