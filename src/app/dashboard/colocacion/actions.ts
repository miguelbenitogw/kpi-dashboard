'use server'

import { importExcelMadre } from '@/lib/google-sheets/import-madre'
import { importGlobalPlacement } from '@/lib/google-sheets/import-global-placement'

// ── Refresh GP data ───────────────────────────────────────────────────────────

export interface RefreshGPResult {
  success: boolean
  madreUpdated: number
  madreInserted: number
  gpUpdated: number
  gpSkipped: number
  gpNotMatched: number
  errors: string[]
}

export async function refreshGlobalPlacement(): Promise<RefreshGPResult> {
  const errors: string[] = []
  let madreUpdated = 0
  let madreInserted = 0

  try {
    const madre = await importExcelMadre()
    madreUpdated = madre.baseDatos.updated
    madreInserted = madre.baseDatos.inserted
    if (madre.errors.length > 0) errors.push(...madre.errors.slice(0, 3))
  } catch (err) {
    errors.push(`Base Datos: ${err instanceof Error ? err.message : String(err)}`)
  }

  let gpUpdated = 0
  let gpSkipped = 0
  let gpNotMatched = 0
  try {
    const gp = await importGlobalPlacement()
    gpUpdated = gp.updated
    gpSkipped = gp.skipped
    gpNotMatched = gp.notMatched
    if (gp.errors.length > 0) errors.push(...gp.errors.slice(0, 3))
  } catch (err) {
    errors.push(`GP: ${err instanceof Error ? err.message : String(err)}`)
  }

  return { success: errors.length === 0, madreUpdated, madreInserted, gpUpdated, gpSkipped, gpNotMatched, errors }
}

// ── Promo ↔ Vacancy link ──────────────────────────────────────────────────────

export interface LinkPromoResult {
  success: boolean
  error?: string
}

export async function linkPromoToJobOpening(
  promocionNombre: string,
  jobOpeningId: string | null,
): Promise<LinkPromoResult> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase/server')

    if (!jobOpeningId) {
      // Remove link
      const { error } = await supabaseAdmin
        .from('promo_job_link' as any)
        .delete()
        .eq('promocion_nombre', promocionNombre)
      if (error) throw error
    } else {
      // Upsert link
      const { error } = await (supabaseAdmin as any)
        .from('promo_job_link')
        .upsert(
          { promocion_nombre: promocionNombre, job_opening_id: jobOpeningId, updated_at: new Date().toISOString() },
          { onConflict: 'promocion_nombre' },
        )
      if (error) throw error
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
