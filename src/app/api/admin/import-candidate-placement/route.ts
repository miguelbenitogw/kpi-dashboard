import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, unauthorizedResponse } from '../../sync/middleware'
import { importCandidatePlacementCsv } from '@/lib/csv/candidate-placement-import'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function readBody(req: NextRequest): Promise<string> {
  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('file')
    if (!file || !(file instanceof File)) {
      throw new Error('Missing "file" field in multipart form-data')
    }
    return await file.text()
  }

  return await req.text()
}

export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) {
    return unauthorizedResponse()
  }

  try {
    const raw = await readBody(req)
    if (!raw || raw.trim().length === 0) {
      return NextResponse.json({ error: 'Empty CSV/TSV body' }, { status: 400 })
    }

    const apply = req.nextUrl.searchParams.get('apply') === '1'
    const syncCurrentStatus = req.nextUrl.searchParams.get('syncCurrentStatus') !== '0'

    const result = await importCandidatePlacementCsv(raw, {
      apply,
      syncCurrentStatus,
    })

    return NextResponse.json({
      ok: true,
      ...result,
      unmatchedRows: result.unmatchedRows.slice(0, 25),
      hiredCandidates: result.hiredCandidates.slice(0, 50),
      changePreview: result.changePreview.slice(0, 50),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
