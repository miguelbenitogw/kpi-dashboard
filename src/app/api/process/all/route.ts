import { NextResponse } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function callProcess(path: string, apiKey: string) {
  const res = await fetch(`${BASE_URL}/api/process/${path}`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`${path} failed (${res.status}): ${JSON.stringify(body)}`);
  }

  return res.json();
}

export async function POST(request: Request) {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.SYNC_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Run in sequence: candidates-days -> stats -> snapshot -> sla
    const candidatesDays = await callProcess('candidates-days', apiKey);
    const stats = await callProcess('stats', apiKey);
    const snapshot = await callProcess('snapshot', apiKey);
    const sla = await callProcess('sla', apiKey);

    return NextResponse.json({
      candidates_days: candidatesDays,
      stats,
      snapshot,
      sla,
    });
  } catch (error) {
    console.error('[process/all] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
