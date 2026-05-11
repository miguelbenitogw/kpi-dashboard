import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { importPromoSheet } from '@/lib/google-sheets/import'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const results: { sheet_name: string | null; status: string; imported?: number; error?: string }[] = []

  const { data: sheets, error } = await (supabaseAdmin as any)
    .from('promo_sheets_kpi')
    .select('id, sheet_url, sheet_name, promocion_nombre, sync_status, group_filter')
    .neq('sync_status', 'disabled')

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  for (const sheet of (sheets ?? [])) {
    if (!sheet.promocion_nombre) {
      results.push({ sheet_name: sheet.sheet_name, status: 'skipped', error: 'No promocion_nombre' })
      continue
    }
    try {
      await (supabaseAdmin as any).from('promo_sheets_kpi').update({ sync_status: 'syncing' }).eq('id', sheet.id)
      const r = await importPromoSheet(sheet.sheet_url, sheet.promocion_nombre, sheet.sheet_name ?? undefined, sheet.group_filter ?? '')
      results.push({ sheet_name: sheet.sheet_name, status: 'success', imported: r.imported ?? 0 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await (supabaseAdmin as any).from('promo_sheets_kpi').update({ sync_status: 'error', sync_error: msg }).eq('id', sheet.id)
      results.push({ sheet_name: sheet.sheet_name, status: 'error', error: msg })
    }
  }

  const hasErrors = results.some(r => r.status === 'error')
  return NextResponse.json({ success: true, duration_ms: Date.now() - startTime, results }, { status: hasErrors ? 207 : 200 })
}
