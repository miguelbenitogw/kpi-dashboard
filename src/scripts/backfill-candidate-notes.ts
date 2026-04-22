/**
 * Backfill Zoho notes (cronología) for all candidates in candidates_kpi.
 *
 * Fetches /Candidates/{zoho18DigitId}/Notes for each candidate.
 * Stores in candidate_notes_kpi.
 *
 * Run: npx tsx src/scripts/backfill-candidate-notes.ts
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

const DELAY_MS = 250
const BATCH_SIZE = 100

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  console.log('=== Backfill candidate notes (cronología) from Zoho ===\n')

  // 1. Get all candidates from candidates_kpi
  const { data: candidates, error } = await supabaseAdmin
    .from('candidates_kpi')
    .select('id, full_name')
    .order('id')

  if (error) { console.error('Failed to fetch candidates:', error.message); process.exit(1) }
  console.log(`Total candidates: ${candidates?.length ?? 0}`)

  // 2. Download all Zoho candidates to build Candidate_ID → 18-digit id map
  console.log('Building Zoho ID map (downloading 90K+ candidates)...')
  const allZoho = await fetchCandidates()
  console.log(`Downloaded ${allZoho.length} Zoho candidates`)

  const targetIds = new Set((candidates ?? []).map(c => String(c.id)))
  const idMap = new Map<string, string>() // shortId → zoho18DigitId
  for (const rec of allZoho) {
    const shortId = String(rec.Candidate_ID ?? '')
    if (shortId && targetIds.has(shortId)) {
      idMap.set(shortId, String(rec.id))
    }
  }
  console.log(`Mapped ${idMap.size} of ${candidates?.length} candidates to Zoho IDs\n`)

  // 3. For each candidate, fetch their notes
  let totalNotes = 0
  let totalErrors = 0
  const now = new Date().toISOString()

  for (let i = 0; i < (candidates ?? []).length; i++) {
    const cand = candidates![i]
    const zohoId = idMap.get(cand.id)

    if (!zohoId) {
      continue // not found in Zoho
    }

    try {
      // Fetch all notes pages
      const allNotes: any[] = []
      let page = 1
      let hasMore = true

      while (hasMore) {
        const resp = await zohoFetch<any>(`/Candidates/${zohoId}/Notes`, {
          per_page: '200',
          page: String(page),
        })
        const data = resp.data ?? []
        allNotes.push(...data)
        hasMore = resp.info?.more_records ?? false
        page++
        if (hasMore) await sleep(DELAY_MS)
      }

      if (allNotes.length === 0) {
        process.stdout.write('.')
        await sleep(DELAY_MS)
        continue
      }

      // Build rows for upsert
      const rows = allNotes.map((note: any) => ({
        id: String(note.id),
        candidate_id: cand.id,
        note_title: note.Note_Title ?? null,
        note_content: note.Note_Content ?? null,
        author: note.Note_Owner?.name ?? null,
        is_system: note.$note_action?.$is_system_action ?? false,
        created_at: note.Created_Time ? new Date(note.Created_Time).toISOString() : null,
        modified_at: note.Modified_Time ? new Date(note.Modified_Time).toISOString() : null,
        fetched_at: now,
      }))

      // Upsert in batches
      for (let b = 0; b < rows.length; b += BATCH_SIZE) {
        const batch = rows.slice(b, b + BATCH_SIZE)
        const { error: upsertErr } = await supabaseAdmin
          .from('candidate_notes_kpi')
          .upsert(batch, { onConflict: 'id' })

        if (upsertErr) {
          console.error(`\n  ERROR ${cand.full_name}: ${upsertErr.message}`)
          totalErrors++
        } else {
          totalNotes += batch.length
        }
      }

      process.stdout.write(`[${i+1}/${candidates!.length}] ${cand.full_name?.slice(0,25)} — ${allNotes.length} notas\n`)

    } catch (err: any) {
      process.stdout.write(`\n  ERROR ${cand.full_name}: ${err.message?.slice(0,80)}\n`)
      totalErrors++
    }

    await sleep(DELAY_MS)
  }

  console.log(`\n=== DONE ===`)
  console.log(`Notes upserted: ${totalNotes}`)
  console.log(`Errors: ${totalErrors}`)
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
