import { NextRequest, NextResponse } from 'next/server'
import { getGermanyCandidateCronologia } from '@/lib/queries/germany'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const data = await getGermanyCandidateCronologia(id)

  if (!data) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
