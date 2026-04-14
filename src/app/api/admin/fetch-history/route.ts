import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { fetchAllCandidateHistories } from '@/lib/zoho/history'
import type { Json } from '@/lib/supabase/types'

const CURSOR_KEY = 'history_cursor'

export async function POST(request: Request) {
  const apiKey = request.headers.get('x-api-key')
  if (apiKey !== process.env.SYNC_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const type = url.searchParams.get('type')
  const batchSize = parseInt(url.searchParams.get('batch_size') ?? '50', 10)

  // Reset cursor if requested
  if (type === 'reset') {
    await supabaseAdmin
      .from('dashboard_config')
      .upsert(
        { config_key: CURSOR_KEY, config_value: { offset: 0 } as Json },
        { onConflict: 'config_key' }
      )
    return NextResponse.json({ message: 'Cursor reset to 0' })
  }

  // Get current cursor (offset)
  const { data: cursorRow } = await supabaseAdmin
    .from('dashboard_config')
    .select('config_value')
    .eq('config_key', CURSOR_KEY)
    .single()

  const offset = (cursorRow?.config_value as { offset?: number } | null)?.offset ?? 0

  // Fetch promo candidates from Supabase
  const { data: candidates, error: queryError, count } = await supabaseAdmin
    .from('candidates')
    .select('id', { count: 'exact' })
    .not('promocion_nombre', 'is', null)
    .order('id')
    .range(offset, offset + batchSize - 1)

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 })
  }

  const totalCandidates = count ?? 0

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({
      completed: true,
      processed: 0,
      remaining: 0,
      totalJobOpenings: 0,
      errors: [],
      message: 'All candidates processed',
    })
  }

  const candidateIds = candidates.map((c) => c.id)

  // Fetch and store histories
  const result = await fetchAllCandidateHistories(candidateIds)

  // Update cursor
  const newOffset = offset + result.processed
  await supabaseAdmin
    .from('dashboard_config')
    .upsert(
      {
        config_key: CURSOR_KEY,
        config_value: { offset: newOffset } as Json,
      },
      { onConflict: 'config_key' }
    )

  const remaining = Math.max(0, totalCandidates - newOffset)

  return NextResponse.json({
    completed: remaining === 0,
    processed: result.processed,
    remaining,
    totalJobOpenings: result.totalJobOpenings,
    errors: result.errors,
    cursor: { previous: offset, current: newOffset, total: totalCandidates },
  })
}
