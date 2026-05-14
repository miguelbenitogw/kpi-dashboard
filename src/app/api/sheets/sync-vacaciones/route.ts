import { NextRequest, NextResponse } from 'next/server'
import { importVacaciones } from '@/lib/google-sheets/import-vacaciones'

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret')
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await importVacaciones()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[sync-vacaciones] Error:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
