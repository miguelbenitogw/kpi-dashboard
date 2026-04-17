/**
 * Admin endpoint to import the "Registrados Charlas y Webinars" CSV.
 * Accepts either:
 *   - multipart/form-data with a `file` field (CSV upload)
 *   - text/csv body (raw paste)
 *
 * Returns counts of rows upserted into `charlas_temporada` and
 * `charlas_programa_totales`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { parseCharlasCsv } from '@/lib/csv/charlas-parser'
import {
  upsertCharlasTemporada,
  upsertProgramaTotales,
} from '@/lib/queries/charlas'

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
  try {
    const csv = await readBody(req)
    if (!csv || csv.trim().length === 0) {
      return NextResponse.json({ error: 'Empty CSV body' }, { status: 400 })
    }

    const parsed = parseCharlasCsv(csv)

    const [temporadaRes, programaRes] = await Promise.all([
      upsertCharlasTemporada(parsed.perTemporada),
      upsertProgramaTotales(parsed.perProgramaTotales),
    ])

    return NextResponse.json({
      ok: true,
      imported: {
        temporada_rows: temporadaRes.count,
        programa_rows: programaRes.count,
      },
      preview: {
        temporadas: Array.from(
          new Set(parsed.perTemporada.map((r) => r.temporada)),
        ),
        programas: Array.from(
          new Set(parsed.perTemporada.map((r) => r.programa)),
        ),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
