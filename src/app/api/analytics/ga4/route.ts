import { NextResponse } from 'next/server';
import {
  getSessionsOverTime,
  getTrafficSources,
  getTopLandingPages,
  getGeographicBreakdown,
  getOverviewMetrics,
} from '@/lib/google-analytics/client';

type MetricType = 'sessions' | 'traffic' | 'pages' | 'geo' | 'overview';

export async function GET(request: Request) {
  // Auth: same x-api-key pattern used across the project
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.SYNC_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const metric = searchParams.get('metric') as MetricType | null;
  const startDate = searchParams.get('start_date') ?? '30daysAgo';
  const endDate = searchParams.get('end_date') ?? 'today';

  if (!metric) {
    return NextResponse.json(
      { error: 'Missing required query param: metric (sessions|traffic|pages|geo|overview)' },
      { status: 400 }
    );
  }

  try {
    let data: unknown;

    switch (metric) {
      case 'sessions':
        data = await getSessionsOverTime(startDate, endDate);
        break;
      case 'traffic':
        data = await getTrafficSources(startDate, endDate);
        break;
      case 'pages':
        data = await getTopLandingPages(startDate, endDate);
        break;
      case 'geo':
        data = await getGeographicBreakdown(startDate, endDate);
        break;
      case 'overview':
        data = await getOverviewMetrics(startDate, endDate);
        break;
      default:
        return NextResponse.json(
          { error: `Invalid metric: ${metric as string}. Use sessions|traffic|pages|geo|overview` },
          { status: 400 }
        );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[api/analytics/ga4] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
