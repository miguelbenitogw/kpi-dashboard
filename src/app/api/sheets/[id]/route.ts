import { type NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { importPromoSheet } from '@/lib/google-sheets/import'

/**
 * POST /api/sheets/[id]
 *
 * Triggers an immediate sync for a specific sheet.
 * Called from the dashboard UI (no API key required since it's internal).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Fetch the sheet record
    const { data: sheet, error: fetchError } = await (supabaseAdmin
      .from('promo_sheets_kpi') as any)
      .select('id, sheet_url, sheet_name, promocion_nombre, group_filter')
      .eq('id', id)
      .single()

    if (fetchError || !sheet) {
      return NextResponse.json(
        { error: 'Sheet not found' },
        { status: 404 }
      )
    }

    if (!sheet.promocion_nombre) {
      return NextResponse.json(
        { error: 'Sheet has no linked promo (promocion_nombre)' },
        { status: 400 }
      )
    }

    // Mark as syncing
    await supabaseAdmin
      .from('promo_sheets_kpi')
      .update({ sync_status: 'syncing' })
      .eq('id', id)

    const result = await importPromoSheet(
      sheet.sheet_url,
      sheet.promocion_nombre,
      sheet.sheet_name ?? undefined,
      sheet.group_filter ?? '',
    )

    return NextResponse.json({
      success: true,
      imported: result.imported,
      matched_to_zoho: result.matched_to_zoho,
      tabs_found: result.tabs_found,
      errors: result.errors,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/sheets/[id]
 *
 * Unregisters a sheet and deletes its associated students.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Delete students first
    const { error: studentsError } = await supabaseAdmin
      .from('promo_students_kpi')
      .delete()
      .eq('promo_sheet_id', id)

    if (studentsError) {
      return NextResponse.json(
        { error: `Failed to delete students: ${studentsError.message}` },
        { status: 500 }
      )
    }

    // Delete the sheet record
    const { error: sheetError } = await supabaseAdmin
      .from('promo_sheets_kpi')
      .delete()
      .eq('id', id)

    if (sheetError) {
      return NextResponse.json(
        { error: `Failed to delete sheet: ${sheetError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
