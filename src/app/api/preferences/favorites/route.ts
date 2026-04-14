import { NextRequest, NextResponse } from 'next/server'
import {
  getFavoritePromos,
  addFavoritePromo,
  removeFavoritePromo,
  getFavoriteVacancies,
  addFavoriteVacancy,
  removeFavoriteVacancy,
} from '@/lib/queries/preferences'

type FavType = 'promos' | 'vacancies'

function parseFavType(request: NextRequest): FavType {
  const typeParam = request.nextUrl.searchParams.get('type')
  return typeParam === 'vacancies' ? 'vacancies' : 'promos'
}

const handlers: Record<
  FavType,
  {
    get: () => Promise<string[]>
    add: (id: string) => Promise<string[]>
    remove: (id: string) => Promise<string[]>
  }
> = {
  promos: {
    get: getFavoritePromos,
    add: addFavoritePromo,
    remove: removeFavoritePromo,
  },
  vacancies: {
    get: getFavoriteVacancies,
    add: addFavoriteVacancy,
    remove: removeFavoriteVacancy,
  },
}

export async function GET(request: NextRequest) {
  try {
    const favType = parseFavType(request)
    const ids = await handlers[favType].get()
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
    const favType = parseFavType(request)
    const body = (await request.json()) as {
      job_opening_id?: string
      action?: string
    }
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

    const h = handlers[favType]
    const ids = action === 'add' ? await h.add(job_opening_id) : await h.remove(job_opening_id)

    return NextResponse.json({ ids })
  } catch (error) {
    console.error('[preferences/favorites] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
