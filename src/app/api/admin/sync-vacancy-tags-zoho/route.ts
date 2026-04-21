import { NextRequest, NextResponse } from 'next/server'
import { syncVacancyTagCountsFromZoho } from '@/lib/zoho/sync-vacancy-tags-zoho'

export const maxDuration = 300 // 5 minutes — needs Pro plan or use in chunks

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to sync vacancy tags from Zoho API',
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const onlyActive = body.onlyActive === true
    const vacancyIds = Array.isArray(body.vacancyIds) ? (body.vacancyIds as string[]) : undefined

    const result = await syncVacancyTagCountsFromZoho({ onlyActive, vacancyIds })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
