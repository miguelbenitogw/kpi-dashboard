import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.SYNC_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: openings, error: openingsError } = await supabaseAdmin
      .from('job_openings_kpi')
      .select('id')
      .eq('is_active', true);

    if (openingsError) throw openingsError;
    if (!openings || openings.length === 0) {
      return NextResponse.json({ openings_updated: 0 });
    }

    let openingsUpdated = 0;

    for (const opening of openings) {
      const { count: totalCandidates, error: totalError } = await supabaseAdmin
        .from('candidates_kpi')
        .select('*', { count: 'exact', head: true })
        .eq('job_opening_id', opening.id);

      if (totalError) throw totalError;

      const { count: hiredCount, error: hiredError } = await supabaseAdmin
        .from('candidates_kpi')
        .select('*', { count: 'exact', head: true })
        .eq('job_opening_id', opening.id)
        .eq('current_status', 'Hired');

      if (hiredError) throw hiredError;

      const { error: updateError } = await supabaseAdmin
        .from('job_openings_kpi')
        .update({
          total_candidates: totalCandidates ?? 0,
          hired_count: hiredCount ?? 0,
        })
        .eq('id', opening.id);

      if (updateError) throw updateError;
      openingsUpdated++;
    }

    return NextResponse.json({ openings_updated: openingsUpdated });
  } catch (error) {
    console.error('[process/stats] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
