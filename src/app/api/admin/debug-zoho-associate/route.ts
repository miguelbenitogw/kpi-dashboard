import { NextRequest, NextResponse } from 'next/server'
import { zohoFetch } from '@/lib/zoho/client'

export const maxDuration = 30

/**
 * GET /api/admin/debug-zoho-associate?vacancyId=179458000030901049
 *
 * Debug endpoint — returns raw Zoho /associate response for a vacancy.
 * Shows exactly which fields and ID formats Zoho returns so we can
 * verify which field to use for matching against candidates_kpi.id.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const vacancyId = searchParams.get('vacancyId')

  if (!vacancyId) {
    return NextResponse.json({ error: 'vacancyId param required' }, { status: 400 })
  }

  const response = await zohoFetch<{ data: Record<string, unknown>[]; info: unknown }>(
    `/Job_Openings/${vacancyId}/associate`,
    { per_page: '5', page: '1' }
  )

  const records = response.data ?? []

  // Return first 5 records with ALL fields so we can inspect IDs
  return NextResponse.json({
    vacancy_id: vacancyId,
    count: records.length,
    info: response.info,
    // Show all fields from first record to understand structure
    first_record_fields: records[0] ? Object.keys(records[0]) : [],
    // Show key ID-related fields for all records
    records: records.map((r) => ({
      id: r.id,
      Candidate_ID: r.Candidate_ID,
      Full_Name: r.Full_Name,
      Candidate_Status: r.Candidate_Status,
      // all fields raw
      _raw: r,
    })),
  })
}
