import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { format, startOfDay } from 'date-fns';

export async function POST(request: Request) {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.SYNC_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const today = format(startOfDay(new Date()), 'yyyy-MM-dd');

    // Check if snapshot already exists for today
    const { count: existingCount, error: checkError } = await supabaseAdmin
      .from('daily_snapshot')
      .select('*', { count: 'exact', head: true })
      .eq('snapshot_date', today);

    if (checkError) throw checkError;

    if (existingCount && existingCount > 0) {
      return NextResponse.json({
        snapshot_date: today,
        records_created: 0,
        message: 'Snapshot already exists for today',
      });
    }

    // Get all candidates grouped by job_opening_id and current_status
    const { data: candidates, error: fetchError } = await supabaseAdmin
      .from('candidates')
      .select('job_opening_id, job_opening_title, current_status');

    if (fetchError) throw fetchError;
    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ snapshot_date: today, records_created: 0 });
    }

    // Group by (job_opening_id, current_status)
    const groups = new Map<string, { job_opening_id: string | null; job_opening_title: string | null; status: string | null; count: number }>();

    for (const c of candidates) {
      const key = `${c.job_opening_id ?? 'null'}::${c.current_status ?? 'null'}`;
      const existing = groups.get(key);
      if (existing) {
        existing.count++;
      } else {
        groups.set(key, {
          job_opening_id: c.job_opening_id,
          job_opening_title: c.job_opening_title,
          status: c.current_status,
          count: 1,
        });
      }
    }

    const rows = Array.from(groups.values()).map((g) => ({
      snapshot_date: today,
      job_opening_id: g.job_opening_id,
      job_opening_title: g.job_opening_title,
      status: g.status,
      count: g.count,
    }));

    const { error: insertError } = await supabaseAdmin
      .from('daily_snapshot')
      .insert(rows);

    if (insertError) throw insertError;

    return NextResponse.json({ snapshot_date: today, records_created: rows.length });
  } catch (error) {
    console.error('[process/snapshot] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
