import { fetchCandidates } from './client'
import { supabaseAdmin } from '@/lib/supabase/server'

export interface SyncTagsResult {
  total_fetched: number
  updated: number
  skipped_no_match: number
  api_calls: number
  errors: string[]
}

function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

export async function syncCandidateTags(): Promise<SyncTagsResult> {
  const errors: string[] = []

  // 1. Fetch all candidates from Zoho (includes Associated_Tags)
  const records = await fetchCandidates()
  const total_fetched = records.length

  // 2. Extract tags — same pattern as transformCandidate()
  const candidatesWithTags = records
    .map((record) => {
      const rawTags = record.Associated_Tags as
        | Array<string | { name: string }>
        | null
        | undefined
      const tags = (rawTags ?? [])
        .map((t) => (typeof t === 'string' ? t : ((t as { name: string }).name ?? '')))
        .filter(Boolean)
      return { id: String(record.id), tags }
    })
    .filter((c) => c.tags.length > 0) // skip candidates with no tags

  // 3. Fetch all existing IDs from candidates_kpi
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('candidates_kpi')
    .select('id')

  if (fetchError) {
    throw new Error(`Failed to fetch existing candidate IDs: ${fetchError.message}`)
  }

  const existingIds = new Set((existing ?? []).map((r) => r.id))

  // 4. Keep only candidates that already exist in candidates_kpi
  const toUpdate = candidatesWithTags.filter((c) => existingIds.has(c.id))
  const skipped_no_match = candidatesWithTags.length - toUpdate.length

  // 5. UPDATE in batches of 200 — only id + tags, never other fields
  const batches = chunks(toUpdate, 200)
  let updated = 0

  for (const batch of batches) {
    const { error: upsertError } = await supabaseAdmin
      .from('candidates_kpi')
      .upsert(
        batch.map((r) => ({ id: r.id, tags: r.tags })),
        { onConflict: 'id', ignoreDuplicates: false }
      )

    if (upsertError) {
      errors.push(`Batch upsert error: ${upsertError.message}`)
    } else {
      updated += batch.length
    }
  }

  return {
    total_fetched,
    updated,
    skipped_no_match,
    // fetchCandidates uses fetchAllPages — 1 API call per 200 records page
    api_calls: Math.ceil(total_fetched / 200) || 1,
    errors,
  }
}
