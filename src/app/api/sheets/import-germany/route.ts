import { type NextRequest, NextResponse } from 'next/server'
import { validateApiKey, unauthorizedResponse } from '../../sync/middleware'
import { importGermanyExcelMadre, GERMANY_SHEET_ID } from '@/lib/google-sheets/import-germany'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * POST /api/sheets/import-germany
 *
 * Manual trigger route to import data from the Germany Excel madre Google Sheet.
 * Imports all three tabs in parallel:
 *   - Base Datos
 *   - Exámenes
 *   - Pagos - Proyectos Infantil
 *
 * Optional query param: ?sheetId=<id> — overrides the default GERMANY_SHEET_ID.
 * Protected by x-api-key.
 */
export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) {
    return unauthorizedResponse()
  }

  const startTime = Date.now()

  try {
    const sheetIdParam = request.nextUrl.searchParams.get('sheetId')
    const sheetId = sheetIdParam ?? GERMANY_SHEET_ID

    const result = await importGermanyExcelMadre(sheetId)

    return NextResponse.json(
      {
        success: true,
        duration_ms: Date.now() - startTime,
        sheet_id: sheetId,
        base_datos: {
          upserted: result.baseDatos.upserted,
          skipped: result.baseDatos.skipped,
          errors: result.baseDatos.errors,
        },
        examenes: {
          upserted: result.examenes.upserted,
          skipped: result.examenes.skipped,
          errors: result.examenes.errors,
        },
        pagos: {
          upserted: result.pagos.upserted,
          skipped: result.pagos.skipped,
          errors: result.pagos.errors,
        },
        errors: result.errors,
      },
      { status: result.errors.length > 0 ? 207 : 200, headers: CORS_HEADERS },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: message, duration_ms: Date.now() - startTime },
      { status: 502, headers: CORS_HEADERS },
    )
  }
}
