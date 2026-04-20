import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { differenceInDays } from 'date-fns';

export async function POST(request: Request) {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.SYNC_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const terminalStatuses = [
      'Hired',
      'Rejected',
      'Offer Declined',
      'Offer Withdrawn',
      'Expelled',
      'Transferred',
      'In Training out of GW',
    ];

    const { data: candidates, error: fetchError } = await supabaseAdmin
      .from('candidates_kpi')
      .select('id, created_time, last_activity_time, modified_time, current_status')
      .not('current_status', 'in', `(${terminalStatuses.join(',')})`);

    if (fetchError) throw fetchError;
    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ candidates_updated: 0 });
    }

    let candidatesUpdated = 0;

    // Batch in groups of 50 to avoid overwhelming the DB
    const batchSize = 50;
    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      const updates = batch.map((c) => {
        const createdDate = c.created_time ? new Date(c.created_time) : now;
        const activityDate = c.last_activity_time
          ? new Date(c.last_activity_time)
          : c.modified_time
            ? new Date(c.modified_time)
            : now;

        return supabaseAdmin
          .from('candidates_kpi')
          .update({
            days_in_process: differenceInDays(now, createdDate),
            days_since_activity: differenceInDays(now, activityDate),
          })
          .eq('id', c.id);
      });

      const results = await Promise.all(updates);
      for (const result of results) {
        if (result.error) throw result.error;
      }
      candidatesUpdated += batch.length;
    }

    return NextResponse.json({ candidates_updated: candidatesUpdated });
  } catch (error) {
    console.error('[process/candidates-days] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
