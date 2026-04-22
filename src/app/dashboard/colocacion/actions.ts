'use server'

import { importExcelMadre } from '@/lib/google-sheets/import-madre'

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
  try {
    const result = await importExcelMadre()
    return {
      success: result.errors.length === 0,
      madreUpdated: result.baseDatos.updated,
      madreInserted: result.baseDatos.inserted,
      gpUpdated: result.globalPlacement.updated,
      gpSkipped: result.globalPlacement.skipped,
      gpNotMatched: result.globalPlacement.notMatched,
      errors: result.errors.slice(0, 3),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, madreUpdated: 0, madreInserted: 0, gpUpdated: 0, gpSkipped: 0, gpNotMatched: 0, errors: [msg] }
  }
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
      // Remove all links for this promo
      const { error } = await supabaseAdmin
        .from('promo_job_link_kpi' as any)
        .delete()
        .eq('promocion_nombre', promocionNombre)
      if (error) throw error
    } else {
      // Ensure the promo exists in promotions_kpi (FK requirement).
      // If the promo comes from an Excel Madre free-text field that isn't
      // yet registered, auto-create a minimal row so the link can be set.
      const { error: promoErr } = await (supabaseAdmin as any)
        .from('promotions_kpi')
        .upsert({ nombre: promocionNombre }, { onConflict: 'nombre' })
      if (promoErr) throw promoErr

      // Preserve the legacy "single primary link" UX: clear prior links
      // for this promo, then insert the new one. Multi-link support can
      // be added in a dedicated action later.
      const { error: delErr } = await supabaseAdmin
        .from('promo_job_link_kpi' as any)
        .delete()
        .eq('promocion_nombre', promocionNombre)
      if (delErr) throw delErr

      const { error: insErr } = await (supabaseAdmin as any)
        .from('promo_job_link_kpi')
        .insert({
          promocion_nombre: promocionNombre,
          job_opening_id: jobOpeningId,
          updated_at: new Date().toISOString(),
        })
      if (insErr) throw insErr
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
