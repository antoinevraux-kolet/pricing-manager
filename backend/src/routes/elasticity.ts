import { Router } from 'express';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.BIGQUERY_PROJECT_ID,
  credentials: {
    client_email: process.env.BIGQUERY_CLIENT_EMAIL,
    private_key: process.env.BIGQUERY_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const BI_DATASET = process.env.BIGQUERY_BI_DATASET ?? 'bi';

function toFloat(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'object' && 'value' in (v as object)) return Number((v as { value: string }).value) || null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export const elasticityRouter = Router();

// Distinct zones, plan sizes, partners for filter dropdowns
elasticityRouter.get('/meta', async (_req, res) => {
  try {
    const base = `FROM \`${process.env.BIGQUERY_PROJECT_ID}.${BI_DATASET}.bi_users_orders\`
      WHERE is_gift = FALSE AND order_original_price_amount > 0
        AND order_status NOT IN ('Data Plan Gift', 'Data Donation') AND data_bytes IS NOT NULL`;

    const [[zoneRows], [planRows], [partnerRows]] = await Promise.all([
      bigquery.query(`SELECT DISTINCT order_zone AS v ${base} AND order_zone IS NOT NULL ORDER BY v`),
      bigquery.query(`SELECT DISTINCT CAST(ROUND(data_bytes / 1000000000.0) AS INT64) AS v ${base} ORDER BY v`),
      bigquery.query(`SELECT DISTINCT travel_partner_name AS v ${base} AND travel_partner_name IS NOT NULL ORDER BY v`),
    ]);

    res.json({
      zones:    (zoneRows    as Record<string,unknown>[]).map(r => String(r.v)),
      planGbs:  (planRows    as Record<string,unknown>[]).map(r => Number(r.v)).filter(g => g > 0),
      partners: (partnerRows as Record<string,unknown>[]).map(r => String(r.v)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch meta' });
  }
});

// Daily aggregated data with all filters applied
elasticityRouter.get('/data', async (req, res) => {
  try {
    const q = req.query as Record<string, string>;
    const dateFrom = /^\d{4}-\d{2}-\d{2}$/.test(q.dateFrom ?? '') ? q.dateFrom : '2025-01-01';
    const dateTo   = /^\d{4}-\d{2}-\d{2}$/.test(q.dateTo   ?? '') ? q.dateTo   : new Date().toISOString().split('T')[0];

    const clauses: string[] = [
      `is_gift = FALSE`,
      `order_original_price_amount > 0`,
      `order_status NOT IN ('Data Plan Gift', 'Data Donation')`,
      `data_bytes IS NOT NULL`,
      `order_currency_exchange_rate IS NOT NULL`,
      `DATE(created_at) BETWEEN '${dateFrom}' AND '${dateTo}'`,
    ];

    if (q.zone && q.zone !== 'All')
      clauses.push(`order_zone = '${q.zone.replace(/'/g, "''")}'`);
    if (q.currency === 'EUR')  clauses.push(`ROUND(order_currency_exchange_rate, 2) = 1.0`);
    if (q.currency === 'USD')  clauses.push(`ROUND(order_currency_exchange_rate, 2) != 1.0`);
    if (q.planGb && q.planGb !== 'All')
      clauses.push(`CAST(ROUND(data_bytes / 1000000000.0) AS INT64) = ${parseInt(q.planGb, 10)}`);
    if (q.channel === 'Organic')     clauses.push(`travel_partner_name IS NULL`);
    if (q.channel === 'Partnership') clauses.push(`travel_partner_name IS NOT NULL`);
    if (q.partner && q.partner !== 'All')
      clauses.push(`travel_partner_name = '${q.partner.replace(/'/g, "''")}'`);
    if (q.customerType === 'New')       clauses.push(`order_status = 'New plan purchase'`);
    if (q.customerType === 'Returning') clauses.push(`order_status = 'Data Plan Top-up'`);
    if (q.hasDiscount === 'With')    clauses.push(`order_original_price_amount != order_total_amount`);
    if (q.hasDiscount === 'Without') clauses.push(`order_original_price_amount = order_total_amount`);

    const sqlQuery = `
      SELECT
        CAST(DATE(created_at) AS STRING)                                           AS sale_date,
        ROUND(order_currency_exchange_rate, 2)                                     AS exchange_rate,
        COUNT(*)                                                                   AS n_orders,
        AVG(order_total_amount)                                                    AS mean_price,
        AVG(order_original_price_amount)                                           AS mean_catalog_price,
        SUM(CASE WHEN order_original_price_amount != order_total_amount THEN 1 ELSE 0 END) AS n_discounted
      FROM \`${process.env.BIGQUERY_PROJECT_ID}.${BI_DATASET}.bi_users_orders\`
      WHERE ${clauses.join('\n        AND ')}
      GROUP BY sale_date, exchange_rate
      ORDER BY sale_date, exchange_rate`;

    const [rows] = await bigquery.query(sqlQuery);

    res.json({
      points: (rows as Record<string, unknown>[]).map(r => ({
        date:             String(r.sale_date),
        exchangeRate:     toFloat(r.exchange_rate)      ?? 1,
        nOrders:          Number(r.n_orders)            || 0,
        meanPrice:        toFloat(r.mean_price)         ?? 0,
        meanCatalogPrice: toFloat(r.mean_catalog_price) ?? 0,
        nDiscounted:      Number(r.n_discounted)        || 0,
      })),
      dateRange: { from: dateFrom, to: dateTo },
      queryUsed: sqlQuery,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch elasticity data' });
  }
});
