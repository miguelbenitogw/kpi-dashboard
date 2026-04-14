import { NextRequest, NextResponse } from 'next/server'
import {
  getFavoritePromos,
  addFavoritePromo,
  removeFavoritePromo,
} from '@/lib/queries/preferences'

export async function GET() {
  try {
    const ids = await getFavoritePromos()
    return NextResponse.json({ ids })
  } catch (error) {
    console.error('[preferences/favorites] GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { job_opening_id?: string; action?: string }
    const { job_opening_id, action } = body

    if (!job_opening_id || typeof job_opening_id !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: job_opening_id' },
        { status: 400 }
      )
    }

    if (action !== 'add' && action !== 'remove') {
      return NextResponse.json(
        { error: 'Invalid action. Must be "add" or "remove"' },
        { status: 400 }
      )
    }

    const ids =
      action === 'add'
        ? await addFavoritePromo(job_opening_id)
        : await removeFavoritePromo(job_opening_id)

    return NextResponse.json({ ids })
  } catch (error) {
    console.error('[preferences/favorites] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
