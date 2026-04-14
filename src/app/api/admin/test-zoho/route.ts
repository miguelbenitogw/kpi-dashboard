import { NextResponse } from 'next/server'
import { validateApiKey, unauthorizedResponse } from '@/app/api/sync/middleware'
import { zohoFetch } from '@/lib/zoho/client'

const JOB_OPENING_ID = '179458000027265945'

const ENDPOINTS = [
  `/Job_Openings/${JOB_OPENING_ID}/associate`,
  `/Job_Opening/${JOB_OPENING_ID}/associate`,
  `/jobopening/${JOB_OPENING_ID}/associate`,
  `/jobopenings/${JOB_OPENING_ID}/associate`,
  `/JobOpenings/${JOB_OPENING_ID}/associate`,
  `/Job_Openings/${JOB_OPENING_ID}/Candidates`,
  `/JobOpenings/${JOB_OPENING_ID}/Candidates`,
  `/jobopening/${JOB_OPENING_ID}/Candidates`,
]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function GET(request: Request) {
  if (!validateApiKey(request)) {
    return unauthorizedResponse()
  }

  const results: {
    endpoint: string
    success: boolean
    error?: string
    dataCount?: number
    rawKeys?: string[]
  }[] = []

  for (const endpoint of ENDPOINTS) {
    try {
      const response = await zohoFetch<Record<string, unknown>>(endpoint, {
        page: '1',
        per_page: '5',
      })

      const data = Array.isArray(response)
        ? response
        : Array.isArray((response as Record<string, unknown>).data)
          ? ((response as Record<string, unknown>).data as unknown[])
          : null

      results.push({
        endpoint,
        success: true,
        dataCount: data ? data.length : undefined,
        rawKeys: Object.keys(response),
      })
    } catch (error) {
      results.push({
        endpoint,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    await sleep(200)
  }

  const summary = {
    tested: results.length,
    succeeded: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
  }

  return NextResponse.json({ summary, results })
}
