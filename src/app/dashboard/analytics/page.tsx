'use client';

import { useEffect, useState, useCallback } from 'react';
import DateRangeSelector from '@/components/analytics/DateRangeSelector';
import AnalyticsCarousel from '@/components/analytics/AnalyticsCarousel';
import type {
  DailyMetrics,
  TrafficSource,
  LandingPage,
  GeoBreakdown,
  OverviewMetrics,
} from '@/lib/google-analytics/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rangeToGaDates(range: string): { start: string; end: string } {
  switch (range) {
    case '7d':
      return { start: '7daysAgo', end: 'today' };
    case '90d':
      return { start: '90daysAgo', end: 'today' };
    case '30d':
    default:
      return { start: '30daysAgo', end: 'today' };
  }
}

interface GA4ApiError {
  error: string;
  code?: 'PERMISSION_DENIED' | 'NOT_CONFIGURED' | 'API_ERROR';
  details?: string;
}

class GA4FetchError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'GA4FetchError';
  }
}

async function fetchGA4<T>(
  metric: string,
  startDate: string,
  endDate: string
): Promise<T> {
  const params = new URLSearchParams({
    metric,
    start_date: startDate,
    end_date: endDate,
  });

  const apiKey = process.env.NEXT_PUBLIC_SYNC_API_KEY;
  if (!apiKey) {
    throw new GA4FetchError(
      'NEXT_PUBLIC_SYNC_API_KEY no esta configurada. Agregala en las variables de entorno de Vercel.',
      'NOT_CONFIGURED',
      0
    );
  }

  const res = await fetch(`/api/analytics/ga4?${params}`, {
    headers: { 'x-api-key': apiKey },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as GA4ApiError;
    throw new GA4FetchError(
      body.error ?? `GA4 API error: ${res.status}`,
      body.code,
      res.status
    );
  }

  const json = await res.json();
  return json.data as T;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [range, setRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // Data states
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [sessions, setSessions] = useState<DailyMetrics[]>([]);
  const [traffic, setTraffic] = useState<TrafficSource[]>([]);
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [geo, setGeo] = useState<GeoBreakdown[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorCode(null);

    const { start, end } = rangeToGaDates(range);

    try {
      const [overviewData, sessionsData, trafficData, pagesData, geoData] =
        await Promise.all([
          fetchGA4<OverviewMetrics>('overview', start, end),
          fetchGA4<DailyMetrics[]>('sessions', start, end),
          fetchGA4<TrafficSource[]>('traffic', start, end),
          fetchGA4<LandingPage[]>('pages', start, end),
          fetchGA4<GeoBreakdown[]>('geo', start, end),
        ]);

      setOverview(overviewData);
      setSessions(sessionsData);
      setTraffic(trafficData);
      setPages(pagesData);
      setGeo(geoData);
    } catch (err) {
      console.error('[Analytics] Failed to load data:', err);
      if (err instanceof GA4FetchError) {
        setError(err.message);
        setErrorCode(err.code ?? null);
      } else {
        setError(err instanceof Error ? err.message : 'Error cargando datos');
      }
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">
            Alcance & Analytics
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Tráfico web, redes sociales y métricas de Google Analytics 4
          </p>
        </div>
        <DateRangeSelector selected={range} onChange={setRange} />
      </div>

      {/* Carousel — handles both Web (GA4) and all social platforms */}
      <AnalyticsCarousel
        overview={overview}
        sessions={sessions}
        traffic={traffic}
        pages={pages}
        geo={geo}
        loading={loading}
        error={error}
        errorCode={errorCode}
        onRetry={loadData}
      />
    </div>
  );
}
