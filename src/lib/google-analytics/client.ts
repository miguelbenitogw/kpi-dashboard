/**
 * Google Analytics 4 Data API client.
 *
 * Uses a service account key (base64-encoded JSON) from the GA4_SERVICE_ACCOUNT_KEY env var
 * and the GA4_PROPERTY_ID env var for the numeric property ID.
 *
 * All functions fail gracefully — they return empty/default data when credentials are missing
 * or when the API call fails, so the dashboard never crashes.
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DailyMetrics {
  date: string;        // YYYY-MM-DD
  sessions: number;
  users: number;
  pageviews: number;
}

export interface TrafficSource {
  source: string;
  medium: string;
  sessions: number;
  users: number;
}

export interface LandingPage {
  page: string;
  pageviews: number;
  sessions: number;
  bounceRate: number;
  avgDuration: number;
}

export interface GeoBreakdown {
  country: string;
  sessions: number;
  users: number;
}

export interface OverviewMetrics {
  sessions: number;
  users: number;
  pageviews: number;
  bounceRate: number;
  avgSessionDuration: number;
}

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

let _client: BetaAnalyticsDataClient | null = null;

function getClient(): BetaAnalyticsDataClient | null {
  if (_client) return _client;

  const base64Key = process.env.GA4_SERVICE_ACCOUNT_KEY;
  if (!base64Key) {
    console.warn('[GA4] GA4_SERVICE_ACCOUNT_KEY not configured — returning empty data');
    return null;
  }

  try {
    const jsonStr = Buffer.from(base64Key, 'base64').toString('utf-8');
    const credentials = JSON.parse(jsonStr) as {
      client_email: string;
      private_key: string;
    };

    _client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
    });

    return _client;
  } catch (err) {
    console.error('[GA4] Failed to parse service account key:', err);
    return null;
  }
}

function getPropertyId(): string | null {
  const id = process.env.GA4_PROPERTY_ID;
  if (!id) {
    console.warn('[GA4] GA4_PROPERTY_ID not configured');
    return null;
  }
  // Accept both "properties/123" and bare "123"
  return id.startsWith('properties/') ? id : `properties/${id}`;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Daily sessions, users, and pageviews over a date range.
 */
export async function getSessionsOverTime(
  startDate: string,
  endDate: string
): Promise<DailyMetrics[]> {
  const client = getClient();
  const property = getPropertyId();
  if (!client || !property) return [];

  try {
    const [response] = await client.runReport({
      property,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    });

    return (response.rows ?? []).map((row) => ({
      date: formatGaDate(row.dimensionValues?.[0]?.value ?? ''),
      sessions: parseInt(row.metricValues?.[0]?.value ?? '0', 10),
      users: parseInt(row.metricValues?.[1]?.value ?? '0', 10),
      pageviews: parseInt(row.metricValues?.[2]?.value ?? '0', 10),
    }));
  } catch (err) {
    console.error('[GA4] getSessionsOverTime error:', err);
    return [];
  }
}

/**
 * Sessions grouped by source/medium.
 */
export async function getTrafficSources(
  startDate: string,
  endDate: string
): Promise<TrafficSource[]> {
  const client = getClient();
  const property = getPropertyId();
  if (!client || !property) return [];

  try {
    const [response] = await client.runReport({
      property,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'sessionSource' },
        { name: 'sessionMedium' },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
      ],
      orderBys: [
        { metric: { metricName: 'sessions' }, desc: true },
      ],
      limit: 20,
    });

    return (response.rows ?? []).map((row) => ({
      source: row.dimensionValues?.[0]?.value ?? '(unknown)',
      medium: row.dimensionValues?.[1]?.value ?? '(unknown)',
      sessions: parseInt(row.metricValues?.[0]?.value ?? '0', 10),
      users: parseInt(row.metricValues?.[1]?.value ?? '0', 10),
    }));
  } catch (err) {
    console.error('[GA4] getTrafficSources error:', err);
    return [];
  }
}

/**
 * Top landing pages by views.
 */
export async function getTopLandingPages(
  startDate: string,
  endDate: string,
  limit = 10
): Promise<LandingPage[]> {
  const client = getClient();
  const property = getPropertyId();
  if (!client || !property) return [];

  try {
    const [response] = await client.runReport({
      property,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'landingPagePlusQueryString' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'sessions' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
      ],
      orderBys: [
        { metric: { metricName: 'screenPageViews' }, desc: true },
      ],
      limit,
    });

    return (response.rows ?? []).map((row) => ({
      page: row.dimensionValues?.[0]?.value ?? '/',
      pageviews: parseInt(row.metricValues?.[0]?.value ?? '0', 10),
      sessions: parseInt(row.metricValues?.[1]?.value ?? '0', 10),
      bounceRate: parseFloat(row.metricValues?.[2]?.value ?? '0'),
      avgDuration: parseFloat(row.metricValues?.[3]?.value ?? '0'),
    }));
  } catch (err) {
    console.error('[GA4] getTopLandingPages error:', err);
    return [];
  }
}

/**
 * Sessions grouped by country.
 */
export async function getGeographicBreakdown(
  startDate: string,
  endDate: string
): Promise<GeoBreakdown[]> {
  const client = getClient();
  const property = getPropertyId();
  if (!client || !property) return [];

  try {
    const [response] = await client.runReport({
      property,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'country' }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
      ],
      orderBys: [
        { metric: { metricName: 'sessions' }, desc: true },
      ],
      limit: 20,
    });

    return (response.rows ?? []).map((row) => ({
      country: row.dimensionValues?.[0]?.value ?? '(unknown)',
      sessions: parseInt(row.metricValues?.[0]?.value ?? '0', 10),
      users: parseInt(row.metricValues?.[1]?.value ?? '0', 10),
    }));
  } catch (err) {
    console.error('[GA4] getGeographicBreakdown error:', err);
    return [];
  }
}

/**
 * Aggregate overview metrics for the date range.
 */
export async function getOverviewMetrics(
  startDate: string,
  endDate: string
): Promise<OverviewMetrics> {
  const empty: OverviewMetrics = {
    sessions: 0,
    users: 0,
    pageviews: 0,
    bounceRate: 0,
    avgSessionDuration: 0,
  };

  const client = getClient();
  const property = getPropertyId();
  if (!client || !property) return empty;

  try {
    const [response] = await client.runReport({
      property,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
      ],
    });

    const row = response.rows?.[0];
    if (!row) return empty;

    return {
      sessions: parseInt(row.metricValues?.[0]?.value ?? '0', 10),
      users: parseInt(row.metricValues?.[1]?.value ?? '0', 10),
      pageviews: parseInt(row.metricValues?.[2]?.value ?? '0', 10),
      bounceRate: parseFloat(row.metricValues?.[3]?.value ?? '0'),
      avgSessionDuration: parseFloat(row.metricValues?.[4]?.value ?? '0'),
    };
  } catch (err) {
    console.error('[GA4] getOverviewMetrics error:', err);
    return empty;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert GA4 date format "20240115" to "2024-01-15" */
function formatGaDate(raw: string): string {
  if (raw.length !== 8) return raw;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}
