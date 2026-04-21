import { NextRequest, NextResponse } from 'next/server'
import { syncCandidateTags } from '@/lib/zoho/sync-candidate-tags'

export const maxDuration = 60

/**
 * GET /api/admin/sync-candidate-tags
 *
 * Returns usage instructions. Use POST to trigger the actual sync.
 */
export async function GET(_request: NextRequest) {
  return NextResponse.json({ message: 'Use POST to trigger sync' })
}

/**
 * POST /api/admin/sync-candidate-tags
 *
 * Syncs Associated_Tags from Zoho Recruit into candidates_kpi.tags.
 * Only updates rows that already exist in candidates_kpi — never inserts.
 */
export async function POST(_request: NextRequest) {
  try {
    const result = await syncCandidateTags()

    return NextResponse.json(
      { success: true, ...result },
      { status: result.errors.length > 0 ? 207 : 200 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
