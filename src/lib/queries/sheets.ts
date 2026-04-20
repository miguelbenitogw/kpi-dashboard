import { supabase } from '@/lib/supabase/client'
import type { PromoSheet, JobOpening } from '@/lib/supabase/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegisteredSheet extends PromoSheet {
  student_count: number
  job_opening_title: string | null
}

export interface PromoOption {
  id: string
  title: string
}

// ---------------------------------------------------------------------------
// Queries (client-side, use anon key)
// ---------------------------------------------------------------------------

/**
 * Lists all registered promo sheets with their student counts and linked promo title.
 */
export async function getRegisteredSheets(): Promise<RegisteredSheet[]> {
  // Fetch sheets with their linked job opening title
  const { data: sheets, error: sheetsError } = await supabase
    .from('promo_sheets_kpi')
    .select('*, job_openings(title)')
    .order('created_at', { ascending: false })

  if (sheetsError) throw new Error(`Failed to fetch sheets: ${sheetsError.message}`)
  if (!sheets || sheets.length === 0) return []

  // Fetch student counts per sheet
  const sheetIds = sheets.map((s) => s.id)
  const { data: countRows, error: countError } = await supabase
    .from('promo_students_kpi')
    .select('promo_sheet_id')
    .in('promo_sheet_id', sheetIds)

  if (countError) throw new Error(`Failed to fetch student counts: ${countError.message}`)

  // Count students per sheet
  const countMap = new Map<string, number>()
  for (const row of countRows ?? []) {
    const id = row.promo_sheet_id
    countMap.set(id, (countMap.get(id) ?? 0) + 1)
  }

  return sheets.map((sheet) => {
    const jo = sheet.job_openings as unknown as { title: string } | null
    return {
      ...sheet,
      student_count: countMap.get(sheet.id) ?? 0,
      job_opening_title: jo?.title ?? null,
    }
  })
}

/**
 * Registers a new Google Sheet linked to a promo.
 */
export async function registerSheet(
  sheetUrl: string,
  jobOpeningId: string,
  sheetName: string
): Promise<{ id: string }> {
  // Extract sheet ID from URL
  const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  const sheetId = match ? match[1] : null

  const { data, error } = await supabase
    .from('promo_sheets_kpi')
    .insert({
      sheet_url: sheetUrl,
      sheet_id: sheetId,
      job_opening_id: jobOpeningId,
      sheet_name: sheetName,
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
 * Returns job openings that look like promos (title contains "promo" or "formacion").
 */
export async function getActivePromoOptions(): Promise<PromoOption[]> {
  const { data, error } = await supabase
    .from('job_openings_kpi')
    .select('id, title')
    .or('title.ilike.%promo%,title.ilike.%formacion%,title.ilike.%formación%')
    .order('title', { ascending: true })

  if (error) throw new Error(`Failed to fetch promos: ${error.message}`)
  return (data ?? []).map((jo) => ({ id: jo.id, title: jo.title }))
}
