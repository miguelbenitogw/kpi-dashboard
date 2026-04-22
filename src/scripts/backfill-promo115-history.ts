/**
 * Backfill job history for Promo 115/116 candidates.
 * 
 * Strategy:
 * 1. Download ALL Zoho candidates (fetchCandidates) — gives us Candidate_ID → 18-digit id map
 * 2. Find the 41 Promo 115/116 candidates by Candidate_ID match
 * 3. For each found candidate, call /Candidates/{18-digit-id}/associate to get their job openings
 * 4. Upsert into candidate_job_history_kpi using Candidate_ID (short) as candidate_id
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnvFile(filePath: string) {
  try {
    const content = readFileSync(filePath, 'utf-8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      let value = trimmed.slice(eqIdx + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
        value = value.slice(1, -1)
      value = value.replace(/\\n$/g, '').trim()
      if (!process.env[key]) process.env[key] = value
    }
  } catch {}
}

const cwd = process.cwd()
loadEnvFile(resolve(cwd, '.env.production-local'))
loadEnvFile(resolve(cwd, '.env.local'))

import { supabaseAdmin } from '@/lib/supabase/server'
import { fetchCandidates, zohoFetch } from '@/lib/zoho/client'

const DELAY_MS = 300

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  console.log('=== Backfill job history for Promo 115/116 ===\n')

  // 1. Get ALL Promo 115/116 candidates
  const { data: allP115, error: p115Err } = await supabaseAdmin
    .from('candidates_kpi')
    .select('id, full_name, promocion_nombre')
    .in('promocion_nombre', ['Promoci\u00f3n 115', 'Promoci\u00f3n 116'])

  if (p115Err) { console.error('Query error:', p115Err.message); process.exit(1) }
  console.log(`Total Promo 115/116 candidates: ${allP115?.length ?? 0}`)

  // 2. Get those that already have history
  const allIds = (allP115 ?? []).map(c => c.id)
  const { data: withHistoryRows } = allIds.length > 0
    ? await supabaseAdmin.from('candidate_job_history_kpi').select('candidate_id').in('candidate_id', allIds)
    : { data: [] }

  const withHistory = new Set((withHistoryRows ?? []).map(h => h.candidate_id))
  const targets = (allP115 ?? []).filter(c => !withHistory.has(c.id))
  console.log(`Candidates to backfill: ${targets.length}`)
  const targetIdSet = new Set(targets.map(c => String(c.id)))

  // 2. Download ALL Zoho candidates to build Candidate_ID → full_id map
  console.log('Downloading all Zoho candidates to build ID map...')
  const allZoho = await fetchCandidates()
  console.log(`Downloaded ${allZoho.length} Zoho candidates\n`)

  // Build map: short Candidate_ID → { zoho18DigitId, full_name }
  const candMap = new Map<string, { zohoId: string; name: string }>()
  for (const rec of allZoho) {
    const shortId = String(rec.Candidate_ID ?? '')
    if (!shortId || !targetIdSet.has(shortId)) continue
    candMap.set(shortId, {
      zohoId: String(rec.id),
      name: String(rec.Full_Name ?? ''),
    })
  }

  console.log(`Found ${candMap.size} of ${targets.length} candidates in Zoho by Candidate_ID\n`)

  // 3. For each found candidate, get their associated job openings
  let totalUpserted = 0
  let totalErrors = 0

  for (const target of targets) {
    const entry = candMap.get(target.id)
    if (!entry) {
      console.log(`  SKIP ${target.full_name} (id=${target.id}) — not found in Zoho`)
      continue
    }

    console.log(`  Fetching job openings for ${target.full_name} (${entry.zohoId})...`)

    try {
      // Try /Candidates/{id}/associate endpoint
      const resp = await zohoFetch<any>(`/Candidates/${entry.zohoId}/associate`, { per_page: '200' })
      const records = resp.data ?? []
      console.log(`    → ${records.length} job openings found`)

      if (records.length > 0) {
        const rows = records.map((jo: any) => ({
          candidate_id: target.id, // use short Candidate_ID to match candidates_kpi.id
          job_opening_id: String(jo.id),
          job_opening_title: String(jo.Job_Opening_Name ?? jo.Posting_Title ?? ''),
          candidate_status_in_jo: String(jo.Candidate_Status ?? ''),
          association_type: 'formacion',
          fetched_at: new Date().toISOString(),
        }))

        const { error } = await supabaseAdmin
          .from('candidate_job_history_kpi')
          .upsert(rows, { onConflict: 'candidate_id,job_opening_id', ignoreDuplicates: false })

        if (error) {
          console.log(`    ERROR: ${error.message}`)
          totalErrors++
        } else {
          totalUpserted += rows.length
          console.log(`    ✓ Upserted ${rows.length} rows`)
        }
      }
    } catch (err: any) {
      console.log(`    ERROR fetching: ${err.message?.slice(0, 100)}`)
      totalErrors++
    }

    await sleep(DELAY_MS)
  }

  console.log(`\n=== DONE ===`)
  console.log(`Upserted: ${totalUpserted} history rows`)
  console.log(`Errors: ${totalErrors}`)
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
