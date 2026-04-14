'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart3,
  Globe,
  TrendingUp,
  FileText,
  Radio,
} from 'lucide-react';
import DateRangeSelector from '@/components/analytics/DateRangeSelector';
import AnalyticsKpiCards from '@/components/analytics/AnalyticsKpiCards';
import SessionsTimeChart from '@/components/analytics/SessionsTimeChart';
import TrafficSourcesChart from '@/components/analytics/TrafficSourcesChart';
import TopLandingPages from '@/components/analytics/TopLandingPages';
import GeoBreakdownTable from '@/components/analytics/GeoBreakdownTable';
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

  const res = await fetch(`/api/analytics/ga4?${params}`, {
    headers: { 'x-api-key': process.env.NEXT_PUBLIC_SYNC_API_KEY ?? '' },
  });

  if (!res.ok) {
    throw new Error(`GA4 API error: ${res.status}`);
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

  // Data states
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [sessions, setSessions] = useState<DailyMetrics[]>([]);
  const [traffic, setTraffic] = useState<TrafficSource[]>([]);
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [geo, setGeo] = useState<GeoBreakdown[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

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
      setError(err instanceof Error ? err.message : 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Check if GA4 is not configured (all zeros = no data)
  const noData =
    !loading &&
    !error &&
    overview !== null &&
    overview.sessions === 0 &&
    overview.users === 0 &&
    overview.pageviews === 0 &&
    sessions.length === 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">
            Alcance & Analytics
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Trafico web y metricas de Google Analytics 4
          </p>
        </div>
        <DateRangeSelector selected={range} onChange={setRange} />
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
          <p className="text-red-400">Error: {error}</p>
          <button
            onClick={loadData}
            className="mt-3 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/30"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* "No configurado" state */}
      {noData && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
          <Radio className="mx-auto h-10 w-10 text-amber-400" />
          <h3 className="mt-4 text-lg font-semibold text-amber-300">
            GA4 no configurado
          </h3>
          <p className="mt-2 text-sm text-amber-400/80">
            No se encontraron datos de Google Analytics. Verifica que las
            variables de entorno GA4_PROPERTY_ID y GA4_SERVICE_ACCOUNT_KEY
            esten configuradas correctamente.
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <AnalyticsKpiCards data={overview} loading={loading} />

      {/* Sessions Over Time */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-gray-100">
            Sesiones en el Tiempo
          </h2>
        </div>
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
          <SessionsTimeChart data={sessions} loading={loading} />
        </div>
      </section>

      {/* Traffic Sources + Geographic in a 2-col grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Traffic Sources */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-green-400" />
            <h2 className="text-lg font-semibold text-gray-100">
              Fuentes de Trafico
            </h2>
          </div>
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
            <TrafficSourcesChart data={traffic} loading={loading} />
          </div>
        </section>

        {/* Geographic */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Globe className="h-5 w-5 text-teal-400" />
            <h2 className="text-lg font-semibold text-gray-100">
              Distribucion Geografica
            </h2>
          </div>
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
            <GeoBreakdownTable data={geo} loading={loading} />
          </div>
        </section>
      </div>

      {/* Top Landing Pages */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-gray-100">
            Top Landing Pages
          </h2>
        </div>
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
          <TopLandingPages data={pages} loading={loading} />
        </div>
      </section>
    </div>
  );
}
