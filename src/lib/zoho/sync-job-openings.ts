import { supabaseAdmin } from '../supabase/server'
import { fetchJobOpenings } from './client'
import { transformJobOpening } from './transform'

const UPSERT_BATCH_SIZE = 100

export interface SyncJobOpeningsResult {
  synced: number
  errors: string[]
  api_calls: number
  /** When mode='active_only', the count of records that were filtered out */
  skipped_inactive?: number
}

/**
 * Sync job openings from Zoho Recruit into job_openings_kpi.
 *
 * mode:
 *   - 'all'         → sync every job opening (used for weekly full sync)
 *   - 'active_only' → only upsert records with es_proceso_atraccion_actual=true
 *                     (used for daily cron — only touches the ~20 active vacancies)
 */
export async function syncJobOpenings(
  mode: 'all' | 'active_only' = 'all'
): Promise<SyncJobOpeningsResult> {
  const errors: string[] = []
  let synced = 0
  let skippedInactive = 0

  try {
    const zohoJobOpenings = await fetchJobOpenings()
    const apiCalls = Math.max(1, Math.ceil(zohoJobOpenings.length / 200))

    const transformed = zohoJobOpenings.map((jo) => ({
      ...transformJobOpening(jo),
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    // Filter to active process only when requested
    const toSync =
      mode === 'active_only'
        ? transformed.filter((r) => {
            if (!r.es_proceso_atraccion_actual) {
              skippedInactive++
              return false
            }
            return true
          })
        : transformed

    for (let i = 0; i < toSync.length; i += UPSERT_BATCH_SIZE) {
      const batch = toSync.slice(i, i + UPSERT_BATCH_SIZE)

      // Preserve manually-edited fields: tipo_profesional and category='interna'
      const ids = batch.map((r) => r.id)
      const { data: existing } = await supabaseAdmin
        .from('job_openings_kpi')
        .select('id, tipo_profesional, category')
        .in('id', ids)

      const existingMap = new Map(
        (existing ?? []).map((r) => [
          r.id,
          r as { id: string; tipo_profesional: string; category: string },
        ])
      )

      const safeBatch = batch.map((row) => {
        const prev = existingMap.get(row.id)
        return {
          ...row,
          // Preserve tipo_profesional if already set to something meaningful
          tipo_profesional:
            prev && prev.tipo_profesional && prev.tipo_profesional !== 'otro'
              ? prev.tipo_profesional
              : row.tipo_profesional,
          // Preserve category only if manually set to 'interna'
          category: prev && prev.category === 'interna' ? 'interna' : row.category,
        }
      })

      const { error } = await supabaseAdmin
        .from('job_openings_kpi')
        .upsert(safeBatch, { onConflict: 'id' })

      if (error) {
        errors.push(`Upsert batch ${Math.floor(i / UPSERT_BATCH_SIZE)}: ${error.message}`)
      } else {
        synced += batch.length
      }
    }

    return { synced, errors, api_calls: apiCalls, skipped_inactive: skippedInactive }
  } catch (err) {
    errors.push(
      `Job openings sync failed: ${err instanceof Error ? err.message : String(err)}`
    )
    return { synced, errors, api_calls: 0 }
  }
}
