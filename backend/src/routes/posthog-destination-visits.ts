const POSTHOG_API_URL = process.env.POSTHOG_API_URL;
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY;

export interface DestinationVisitsParams {
  startDate: string;  // "YYYY-MM-DD"
  endDate?: string;   // "YYYY-MM-DD"
}

export interface DestinationVisitSummary {
  destination: string; // "esim-france", "esim-morocco", etc.
  uniqueVisitors: number;
}

async function runHogQL(query: string): Promise<unknown[][]> {
  const response = await fetch(
    `${POSTHOG_API_URL}/api/projects/${POSTHOG_PROJECT_ID}/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${POSTHOG_API_KEY}`,
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    }
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PostHog query failed (${response.status}): ${error}`);
  }
  const data = await response.json() as { results: unknown[][] };
  return data.results;
}

export async function getDestinationVisitsSummary(
  params: DestinationVisitsParams
): Promise<DestinationVisitSummary[]> {
  const { startDate, endDate } = params;

  const query = `
    SELECT
      extract(properties.$pathname, 'destinations/(esim-[^/?#]+)') AS destination,
      count(DISTINCT person_id)                                      AS unique_visitors
    FROM events
    WHERE
      event = '$pageview'
      AND properties.$pathname ILIKE '%/destinations/esim-%'
      AND toDate(timestamp) >= toDate('${startDate}')
      ${endDate ? `AND toDate(timestamp) <= toDate('${endDate}')` : ""}
      AND extract(properties.$pathname, 'destinations/(esim-[^/?#]+)') != ''
    GROUP BY destination
    ORDER BY unique_visitors DESC
  `;

  const rows = await runHogQL(query);
  return (rows as [string, number][]).map(([destination, uniqueVisitors]) => ({
    destination,
    uniqueVisitors,
  }));
}
