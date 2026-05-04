import { NextRequest, NextResponse } from 'next/server'
import { importGermanyExcelMadre, GERMANY_SHEET_ID } from '@/lib/google-sheets/import-germany'

export const maxDuration = 60

/**
 * POST /api/cron/sync-germany
 *
 * Cron route that imports all three Germany Excel madre tabs:
 *   - Base Datos
 *   - Exámenes
 *   - Pagos - Proyectos Infantil
 *
 * Protected by CRON_SECRET header (Bearer token).
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const result = await importGermanyExcelMadre(GERMANY_SHEET_ID)

    return NextResponse.json(
      {
        success: true,
        duration_ms: Date.now() - startTime,
        sheet_id: GERMANY_SHEET_ID,
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
      { status: result.errors.length > 0 ? 207 : 200 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: message, duration_ms: Date.now() - startTime },
      { status: 502 },
    )
  }
}
