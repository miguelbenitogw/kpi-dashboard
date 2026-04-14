import { NextResponse } from 'next/server'
import { zohoFetch } from '@/lib/zoho/client'

export async function GET(request: Request) {
  const apiKey = request.headers.get('x-api-key')
  if (apiKey !== process.env.SYNC_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const candidateZohoId = '179458000026630015' // Alex Costell, Candidate_ID 87389

  const endpoints = [
    `/Candidates/${candidateZohoId}/associate`,
    `/candidates/${candidateZohoId}/associate`,
    `/Candidate/${candidateZohoId}/associate`,
    `/candidate/${candidateZohoId}/associate`,
  ]

  const results = []

  for (const endpoint of endpoints) {
    try {
      const data = await zohoFetch<Record<string, unknown>>(endpoint, { per_page: '5' })
      results.push({
        endpoint,
        success: true,
        dataCount: Array.isArray(data?.data) ? (data.data as unknown[]).length : 0,
        sample: data,
      })
    } catch (err) {
      results.push({
        endpoint,
        success: false,
        error: err instanceof Error ? err.message.slice(0, 200) : String(err),
      })
    }
    await new Promise((r) => setTimeout(r, 300))
  }

  return NextResponse.json({ results })
}
