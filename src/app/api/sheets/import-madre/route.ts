import { type NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
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
 * Imports data from the Excel madre Google Sheet(s).
 * Enriches the candidates table (Base Datos) and upserts promo_targets (Resumen).
 *
 * Optional query param: ?sheetId=<id> — import only that sheet.
 * If omitted, imports all active madre sheets from madre_sheets_kpi.
 * Protected by x-api-key.
 */
export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) {
    return unauthorizedResponse()
  }

  try {
    const sheetIdParam = request.nextUrl.searchParams.get('sheetId')

    if (sheetIdParam) {
      const result = await importExcelMadre(sheetIdParam)

      return NextResponse.json(
        {
          success: true,
          results: [
            {
              sheet_id: sheetIdParam,
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
          ],
          errors: result.errors,
        },
        { status: result.errors.length > 0 ? 207 : 200, headers: CORS_HEADERS }
      )
    }

    const { data: madreSheets } = await supabaseAdmin
      .from('madre_sheets_kpi' as any)
      .select('sheet_id, label')
      .eq('is_active', true)
      .order('year', { ascending: true })

    const allResults = []
    const allErrors: string[] = []

    for (const madre of (madreSheets as Array<{ sheet_id: string; label: string }> | null) ?? []) {
      const result = await importExcelMadre(madre.sheet_id)
      allResults.push({
        label: madre.label,
        sheet_id: madre.sheet_id,
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
      })
      allErrors.push(...result.errors)
    }

    return NextResponse.json(
      {
        success: true,
        results: allResults,
        errors: allErrors,
      },
      { status: allErrors.length > 0 ? 207 : 200, headers: CORS_HEADERS }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: message },
      { status: 502, headers: CORS_HEADERS }
    )
  }
}
