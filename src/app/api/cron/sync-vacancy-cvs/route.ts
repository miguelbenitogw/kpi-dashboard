import { NextRequest, NextResponse } from 'next/server'
import { POST as syncVacancyCvsPost } from '@/app/api/admin/sync-vacancy-cvs/route'

export const maxDuration = 300

/**
 * GET /api/cron/sync-vacancy-cvs
 *
 * Weekly cron — refresh vacancy CV weekly KPI every Monday.
 * Protected by Bearer CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const syncApiKey = process.env.SYNC_API_KEY
  if (!syncApiKey) {
    return NextResponse.json({ error: 'Missing SYNC_API_KEY' }, { status: 500 })
  }

  const proxyRequest = new Request(request.url, {
    method: 'POST',
    headers: {
      'x-api-key': syncApiKey,
    },
  })

  return syncVacancyCvsPost(proxyRequest)
}
