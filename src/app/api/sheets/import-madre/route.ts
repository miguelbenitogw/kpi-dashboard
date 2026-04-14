import { type NextRequest, NextResponse } from 'next/server'
import { validateApiKey, unauthorizedResponse } from '../../sync/middleware'
import { importExcelMadre } from '@/lib/google-sheets/import-madre'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * POST /api/sheets/import-madre
 *
 * Imports data from the Excel madre Google Sheet.
 * Enriches the candidates table (Base Datos) and upserts promo_targets (Resumen).
 *
 * No body required — the sheet ID is hardcoded.
 * Protected by x-api-key.
 */
export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) {
    return unauthorizedResponse()
  }

  try {
    const result = await importExcelMadre()

    return NextResponse.json(
      {
        success: true,
        base_datos: {
          updated: result.baseDatos.updated,
          inserted: result.baseDatos.inserted,
          skipped: result.baseDatos.skipped,
        },
        resumen: {
          upserted: result.resumen.upserted,
          skipped: result.resumen.skipped,
        },
        errors: result.errors,
      },
      { status: result.errors.length > 0 ? 207 : 200, headers: CORS_HEADERS }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: message },
      { status: 502, headers: CORS_HEADERS }
    )
  }
}
