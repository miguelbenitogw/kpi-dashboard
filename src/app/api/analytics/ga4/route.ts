import { NextResponse } from 'next/server';
import {
  getSessionsOverTime,
  getTrafficSources,
  getTopLandingPages,
  getGeographicBreakdown,
  getOverviewMetrics,
  getPageViewsByTitle,
  GA4Error,
} from '@/lib/google-analytics/client';

type MetricType = 'sessions' | 'traffic' | 'pages' | 'geo' | 'overview' | 'page_titles';

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

  // Quick diagnostic: check if env vars are configured
  const hasServiceKey = !!process.env.GA4_SERVICE_ACCOUNT_KEY;
  const hasPropertyId = !!process.env.GA4_PROPERTY_ID;

  if (!hasServiceKey || !hasPropertyId) {
    return NextResponse.json(
      {
        error: 'GA4 not configured',
        details: {
          GA4_SERVICE_ACCOUNT_KEY: hasServiceKey ? 'set' : 'MISSING',
          GA4_PROPERTY_ID: hasPropertyId ? 'set' : 'MISSING',
        },
      },
      { status: 503 }
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

    // Surface GA4-specific errors with actionable info
    if (error instanceof GA4Error) {
      const status = error.code === 'PERMISSION_DENIED' ? 403 : 500;
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status }
      );
    }

    const message =
      error instanceof Error ? error.message : 'Internal server error';
    const stack =
      process.env.NODE_ENV !== 'production' && error instanceof Error
        ? error.stack
        : undefined;
    return NextResponse.json(
      { error: message, stack },
      { status: 500 }
    );
  }
}
