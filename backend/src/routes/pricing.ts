import { Router } from 'express';
// import { BigQuery } from '@google-cloud/bigquery';

// const bigquery = new BigQuery({
//   projectId: 'YOUR_PROJECT_ID',
//   keyFilename: 'path/to/service-account.json',
// });

// const DATASET = 'YOUR_DATASET';
// const TABLE = 'YOUR_TABLE';

export interface PricingEntry {
  country: string;
  plan: string;
  price: number;
}

export interface PricingData {
  countries: string[];
  plans: string[];
  prices: Record<string, Record<string, number | null>>;
}

export const pricingRouter = Router();

pricingRouter.get('/', async (_req, res) => {
  try {
    // const query = `
    //   SELECT country, plan, price
    //   FROM \`${DATASET}.${TABLE}\`
    //   ORDER BY country, plan
    // `;
    // const [rows] = await bigquery.query(query);
    // const entries: PricingEntry[] = rows;

    const entries: PricingEntry[] = [
      { country: 'France', plan: '1GB', price: 3.99 },
      { country: 'France', plan: '3GB', price: 7.99 },
      { country: 'France', plan: '5GB', price: 11.99 },
      { country: 'UK', plan: '1GB', price: 4.49 },
      { country: 'UK', plan: '3GB', price: 8.49 },
      { country: 'UK', plan: '5GB', price: 12.99 },
      { country: 'Espagne', plan: '1GB', price: 3.99 },
      { country: 'Espagne', plan: '3GB', price: 7.49 },
      { country: 'Espagne', plan: '5GB', price: 10.99 },
    ];

    const countries = [...new Set(entries.map((e) => e.country))];
    const plans = [...new Set(entries.map((e) => e.plan))];

    const prices: Record<string, Record<string, number | null>> = {};
    for (const country of countries) {
      prices[country] = {};
      for (const plan of plans) {
        const match = entries.find((e) => e.country === country && e.plan === plan);
        prices[country][plan] = match ? match.price : null;
      }
    }

    const data: PricingData = { countries, plans, prices };
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch pricing data' });
  }
});
