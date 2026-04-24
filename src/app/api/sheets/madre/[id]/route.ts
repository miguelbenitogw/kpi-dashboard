import { type NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { importExcelMadre } from '@/lib/google-sheets/import-madre'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const { data: madreSheet, error: fetchError } = await (supabaseAdmin
      .from('madre_sheets_kpi') as any)
      .select('id, sheet_id, label')
      .eq('id', id)
      .single()

    if (fetchError || !madreSheet) {
      return NextResponse.json({ error: 'Madre sheet not found' }, { status: 404 })
    }

    const result = await importExcelMadre(madreSheet.sheet_id)

    return NextResponse.json({ success: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const { error } = await (supabaseAdmin
      .from('madre_sheets_kpi') as any)
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: `Failed to delete madre sheet: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
