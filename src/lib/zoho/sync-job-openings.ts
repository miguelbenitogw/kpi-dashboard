import { supabaseAdmin } from '../supabase/server'
import { fetchJobOpenings } from './client'
import { transformJobOpening } from './transform'

const UPSERT_BATCH_SIZE = 100

export async function syncJobOpenings(): Promise<{
  synced: number
  errors: string[]
  api_calls: number
}> {
  const errors: string[] = []
  let synced = 0

  try {
    const zohoJobOpenings = await fetchJobOpenings()
    const apiCalls = Math.max(1, Math.ceil(zohoJobOpenings.length / 200))

    const jobOpeningRows = zohoJobOpenings.map((jo) => ({
      ...transformJobOpening(jo),
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    for (let i = 0; i < jobOpeningRows.length; i += UPSERT_BATCH_SIZE) {
      const batch = jobOpeningRows.slice(i, i + UPSERT_BATCH_SIZE)

      // Preserve manually-edited fields: tipo_profesional (if set) and category='interna'
      const ids = batch.map((r) => r.id)
      const { data: existing } = await supabaseAdmin
        .from('job_openings')
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
        .from('job_openings')
        .upsert(safeBatch, { onConflict: 'id' })

      if (error) {
        errors.push(`Job openings upsert batch ${i / UPSERT_BATCH_SIZE}: ${error.message}`)
      } else {
        synced += batch.length
      }
    }

    return { synced, errors, api_calls: apiCalls }
  } catch (err) {
    errors.push(
      `Job openings sync failed: ${err instanceof Error ? err.message : String(err)}`
    )
    return { synced, errors, api_calls: 0 }
  }
}
