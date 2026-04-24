import { supabaseAdmin } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MadreSheet {
  id: string
  sheet_id: string
  label: string
  year: number | null
  is_active: boolean
  created_at: string
}

// ---------------------------------------------------------------------------
// Server-side queries (use admin key — only call from API routes / server actions)
// ---------------------------------------------------------------------------

export async function getMadreSheets(): Promise<MadreSheet[]> {
  const { data, error } = await (supabaseAdmin
    .from('madre_sheets_kpi') as any)
    .select('*')
    .order('year', { ascending: false })

  if (error) throw new Error(`Failed to fetch madre sheets: ${error.message}`)
  return (data ?? []) as MadreSheet[]
}

export async function registerMadreSheet(
  sheetUrl: string,
  label: string,
  year: number | null,
): Promise<void> {
  const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  const sheetId = match?.[1] ?? null

  if (!sheetId) {
    throw new Error('No se pudo extraer el ID del sheet desde la URL proporcionada.')
  }

  const { error } = await (supabaseAdmin
    .from('madre_sheets_kpi') as any)
    .insert({
      sheet_id: sheetId,
      label,
      year,
      is_active: true,
    })

  if (error) throw new Error(`Failed to register madre sheet: ${error.message}`)
}

export async function unregisterMadreSheet(id: string): Promise<void> {
  const { error } = await (supabaseAdmin
    .from('madre_sheets_kpi') as any)
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Failed to unregister madre sheet: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Client-safe trigger (uses fetch — no server key exposed)
// ---------------------------------------------------------------------------

export async function triggerMadreSync(id: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/sheets/madre/${id}`, { method: 'POST' })
  const data = await res.json()

  if (!res.ok) {
    return { success: false, message: data.error ?? 'Sync failed' }
  }
  return { success: true, message: data.message ?? 'Sync completado' }
}
