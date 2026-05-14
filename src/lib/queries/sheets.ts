import { supabase } from '@/lib/supabase/client'
import type { PromoSheet } from '@/lib/supabase/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegisteredSheet extends PromoSheet {
  student_count: number
  promo_display: string | null
}

export interface PromoOption {
  nombre: string
  numero: number | null
}

// ---------------------------------------------------------------------------
// Queries (client-side, use anon key)
// ---------------------------------------------------------------------------

/**
 * Lists all registered promo sheets with their student counts and promo metadata.
 */
export async function getRegisteredSheets(): Promise<RegisteredSheet[]> {
  const { data: sheets, error: sheetsError } = await (supabase
    .from('promo_sheets_kpi') as any)
    .select('*, promotions_kpi:promocion_nombre(numero)')
    .order('created_at', { ascending: false })

  if (sheetsError) throw new Error(`Failed to fetch sheets: ${sheetsError.message}`)
  if (!sheets || sheets.length === 0) return []

  // Fetch student counts per sheet — only from 'Contact Information' tab (canonical enrollment list).
  // Fallback: if a sheet has no 'Contact Information' rows, count 'Assignments' tab instead.
  const sheetIds = sheets.map((s: { id: string }) => s.id)
  const { data: countRows, error: countError } = await supabase
    .from('promo_students_kpi')
    .select('promo_sheet_id, tab_name')
    .in('promo_sheet_id', sheetIds)
    .in('tab_name', ['Contact Information', 'Assignments'])

  if (countError) throw new Error(`Failed to fetch student counts: ${countError.message}`)

  // Build per-sheet counts: prefer 'Contact Information', fall back to 'Assignments'
  const contactMap = new Map<string, number>()
  const assignMap  = new Map<string, number>()
  for (const row of countRows ?? []) {
    const id = row.promo_sheet_id
    if (row.tab_name === 'Contact Information') {
      contactMap.set(id, (contactMap.get(id) ?? 0) + 1)
    } else {
      assignMap.set(id, (assignMap.get(id) ?? 0) + 1)
    }
  }
  const countMap = new Map<string, number>()
  for (const id of sheetIds) {
    const n = contactMap.get(id) ?? assignMap.get(id) ?? 0
    if (n > 0) countMap.set(id, n)
  }

  return sheets.map((sheet: any) => ({
    ...sheet,
    student_count: countMap.get(sheet.id) ?? 0,
    promo_display: sheet.promocion_nombre ?? null,
  })) as RegisteredSheet[]
}

/**
 * Registers a new Google Sheet linked to a promo.
 */
export async function registerSheet(
  sheetUrl: string,
  promocionNombre: string,
  sheetName: string,
  groupFilter = '',
): Promise<{ id: string }> {
  // Extract sheet ID from URL
  const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  const sheetId = match ? match[1] : null

  const { data, error } = await (supabase
    .from('promo_sheets_kpi') as any)
    .insert({
      sheet_url: sheetUrl,
      sheet_id: sheetId,
      promocion_nombre: promocionNombre,
      sheet_name: sheetName,
      group_filter: groupFilter,
      sync_status: 'pending',
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to register sheet: ${error.message}`)
  return { id: data.id }
}

/**
 * Unregisters (deletes) a sheet. Cascade should handle promo_students cleanup.
 */
export async function unregisterSheet(sheetId: string): Promise<void> {
  // Delete students first (in case no cascade)
  await supabase
    .from('promo_students_kpi')
    .delete()
    .eq('promo_sheet_id', sheetId)

  const { error } = await supabase
    .from('promo_sheets_kpi')
    .delete()
    .eq('id', sheetId)

  if (error) throw new Error(`Failed to unregister sheet: ${error.message}`)
}

/**
 * Triggers a sync for a single sheet via the API route.
 */
export async function triggerSheetSync(
  sheetId: string
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`/api/sheets/${sheetId}`, {
    method: 'POST',
  })

  const data = await res.json()
  if (!res.ok) {
    return { success: false, error: data.error ?? 'Sync failed' }
  }
  return { success: true }
}

/**
 * Triggers a sync for all active sheets via the API route.
 */
export async function triggerAllSheetsSync(): Promise<{
  success: boolean
  error?: string
}> {
  const res = await fetch('/api/sheets/sync-all', {
    method: 'POST',
  })

  const data = await res.json()
  if (!res.ok) {
    return { success: false, error: data.error ?? 'Sync failed' }
  }
  return { success: true }
}

/**
 * Lists promos available for linking to a sheet.
 * Returns rows from promotions_kpi (our source of truth, independent of Zoho).
 */
export async function getActivePromoOptions(): Promise<PromoOption[]> {
  const { data, error } = await (supabase
    .from('promotions_kpi') as any)
    .select('nombre, numero')
    .eq('is_active', true)
    .order('numero', { ascending: false })

  if (error) throw new Error(`Failed to fetch promos: ${error.message}`)
  return (data ?? []).map((p: { nombre: string; numero: number | null }) => ({
    nombre: p.nombre,
    numero: p.numero,
  }))
}
