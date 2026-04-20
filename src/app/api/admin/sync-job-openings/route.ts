/**
 * POST /api/admin/sync-job-openings
 *
 * Triggers a full sync of Zoho job openings into Supabase.
 * Requires x-api-key header.
 */
import { validateApiKey, unauthorizedResponse } from '../../sync/middleware'
import { syncJobOpenings } from '@/lib/zoho/sync-job-openings'

export async function POST(request: Request) {
  if (!validateApiKey(request)) {
    return unauthorizedResponse()
  }

  const result = await syncJobOpenings()

  return Response.json({
    success: result.errors.length === 0,
    synced: result.synced,
    api_calls: result.api_calls,
    errors: result.errors,
  })
}
