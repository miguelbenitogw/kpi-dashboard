import { readFileSync } from 'fs'
import { resolve } from 'path'

// ---------------------------------------------------------------------------
// Env loading — mismo patrón que sync-germany-dropouts.ts
// ---------------------------------------------------------------------------

function loadEnvFile(p: string) {
  try {
    const content = readFileSync(p, 'utf-8')
    const lines = content.split(/\r?\n/)
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      const t = line.trim()
      if (!t || t.startsWith('#')) { i++; continue }
      const eqIdx = t.indexOf('=')
      if (eqIdx < 0) { i++; continue }
      const k = t.slice(0, eqIdx).trim()
      let v = t.slice(eqIdx + 1).trim()

      // Multiline single-quoted value: KEY='{\n...\n}'
      if (v.startsWith("'") && !v.endsWith("'")) {
        const parts = [v]
        i++
        while (i < lines.length) {
          parts.push(lines[i])
          if (lines[i].endsWith("'")) { i++; break }
          i++
        }
        v = parts.join('\n')
      } else {
        i++
      }

      // Strip surrounding quotes (single or double)
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      v = v.replace(/\\n$/g, '').trim()
      if (!process.env[k]) process.env[k] = v
    }
  } catch {}
}

loadEnvFile(resolve(process.cwd(), '.env.production-local'))
loadEnvFile(resolve(process.cwd(), '.env.local'))

// ---------------------------------------------------------------------------
// Library imports (must come AFTER env loading)
// ---------------------------------------------------------------------------

import { createClient } from '@supabase/supabase-js'
import { getAccessToken } from '@/lib/zoho/auth'

// ---------------------------------------------------------------------------
// Supabase admin client (service role, same pattern as other scripts)
// ---------------------------------------------------------------------------

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  }
  return createClient(url, key)
}

// ---------------------------------------------------------------------------
// Zoho raw fetch helper — usa el mismo mecanismo que zohoFetch en client.ts
// pero retorna el status HTTP y el body raw para diagnóstico
// ---------------------------------------------------------------------------

interface RawZohoResult {
  status: number
  ok: boolean
  body: unknown
  count: number
  items: unknown[]
}

async function zohoRawFetch(endpoint: string, params?: Record<string, string>): Promise<RawZohoResult> {
  const token = await getAccessToken()
  const baseUrl = (process.env.ZOHO_API_BASE_URL ?? '').replace(/\/$/, '')
  if (!baseUrl) throw new Error('Missing env var: ZOHO_API_BASE_URL')

  const url = new URL(`${baseUrl}${endpoint}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  })

  const text = await response.text()
  let body: unknown = null
  try {
    body = JSON.parse(text)
  } catch {
    body = text.slice(0, 500) // truncate for logging
  }

  // Extraer items y count del body si existe
  let items: unknown[] = []
  let count = 0
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>
    if (Array.isArray(b.data)) {
      items = b.data as unknown[]
      count = items.length
    }
  }

  return { status: response.status, ok: response.ok, body, count, items }
}

// ---------------------------------------------------------------------------
// Helpers de logging
// ---------------------------------------------------------------------------

function sep(label: string) {
  console.log('\n' + '─'.repeat(60))
  console.log(`  ${label}`)
  console.log('─'.repeat(60))
}

function logResult(label: string, result: RawZohoResult) {
  const status = result.ok ? `✓ ${result.status}` : `✗ ${result.status}`
  console.log(`  [${label}]`)
  console.log(`    HTTP status : ${status}`)
  console.log(`    Items count : ${result.count}`)
  if (result.count > 0) {
    const preview = result.items.slice(0, 2)
    console.log(`    First 2 items:`)
    preview.forEach((item, i) => {
      console.log(`      [${i}] ${JSON.stringify(item).slice(0, 300)}`)
    })
  } else {
    // Muestra el body si no hay items, útil para ver mensajes de error de Zoho
    console.log(`    Body preview: ${JSON.stringify(result.body).slice(0, 300)}`)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log(`║  Test Germany Candidate → Zoho (candidate-first)          ║`)
  console.log(`║  ${new Date().toISOString()}                  ║`)
  console.log('╚══════════════════════════════════════════════════════════╝')

  const supabase = getSupabaseAdmin()

  // ── 1. Obtener los primeros 3 candidatos alemanes con zoho_candidate_id ────
  console.log('\n[setup] Obteniendo candidatos alemanes de Supabase...')
  const { data: rows, error } = await supabase
    .from('germany_candidates_kpi')
    .select('id, nombre, zoho_candidate_id')
    .not('zoho_candidate_id', 'is', null)
    .limit(3)

  if (error) {
    throw new Error(`Supabase error: ${error.message}`)
  }

  if (!rows || rows.length === 0) {
    console.log('[setup] No se encontraron candidatos alemanes con zoho_candidate_id. Abortando.')
    return
  }

  console.log(`[setup] ${rows.length} candidatos cargados:`)
  rows.forEach((r) => {
    const nombre = (r as Record<string, unknown>).nombre ?? '(sin nombre)'
    console.log(`  id=${r.id}  zoho_id=${r.zoho_candidate_id}  nombre=${nombre}`)
  })

  // ── Resultados por candidato ────────────────────────────────────────────
  const summary: Array<{
    zoho_id: string
    record_id: string | null
    associate_long_count: number
    associate_short_count: number
    notes_count: number
  }> = []

  for (const row of rows) {
    const shortId = String(row.zoho_candidate_id)
    sep(`Candidato zoho_id="${shortId}"`)

    // ── 2a. Buscar el record_id largo via /Candidates/search ───────────────
    console.log('\n  [STEP A] Buscar record largo via /Candidates/search')
    let recordId: string | null = null

    try {
      const searchResult = await zohoRawFetch('/Candidates/search', {
        criteria: `(Candidate_ID:equals:${shortId})`,
        fields: 'id,Full_Name,Candidate_ID',
      })
      logResult('GET /Candidates/search?criteria=(Candidate_ID:equals:{id})', searchResult)

      if (searchResult.count > 0) {
        const first = searchResult.items[0] as Record<string, unknown>
        recordId = String(first.id ?? '')
        console.log(`  → Record ID largo encontrado: ${recordId}`)
        console.log(`  → Full_Name: ${first.Full_Name}`)
        console.log(`  → Candidate_ID (corto): ${first.Candidate_ID}`)
      } else {
        console.log(`  → No se encontró el candidato en Zoho con Candidate_ID=${shortId}`)
      }
    } catch (err) {
      console.error(`  [ERROR] Search falló: ${err instanceof Error ? err.message : String(err)}`)
    }

    // ── 2b. Associate_Job_Openings con ID LARGO ────────────────────────────
    console.log('\n  [STEP B] GET /Candidates/{record_id}/Associate_Job_Openings  (ID LARGO)')
    let associateLongCount = 0

    if (recordId) {
      try {
        const assocLong = await zohoRawFetch(`/Candidates/${recordId}/Associate_Job_Openings`)
        logResult(`GET /Candidates/${recordId}/Associate_Job_Openings (ID largo)`, assocLong)
        associateLongCount = assocLong.count
      } catch (err) {
        console.error(`  [ERROR] Associate con ID largo falló: ${err instanceof Error ? err.message : String(err)}`)
      }
    } else {
      console.log('  → Saltado (no se obtuvo record_id largo)')
    }

    // ── 2c. Associate_Job_Openings con ID CORTO (para comparar) ───────────
    console.log('\n  [STEP C] GET /Candidates/{short_id}/Associate_Job_Openings  (ID CORTO — comparación)')
    let associateShortCount = 0

    try {
      const assocShort = await zohoRawFetch(`/Candidates/${shortId}/Associate_Job_Openings`)
      logResult(`GET /Candidates/${shortId}/Associate_Job_Openings (ID corto)`, assocShort)
      associateShortCount = assocShort.count
    } catch (err) {
      console.error(`  [ERROR] Associate con ID corto falló: ${err instanceof Error ? err.message : String(err)}`)
    }

    // ── 2d. Notes con ID LARGO ─────────────────────────────────────────────
    console.log('\n  [STEP D] GET /Candidates/{record_id}/Notes  (ID LARGO)')
    let notesCount = 0

    if (recordId) {
      try {
        const notes = await zohoRawFetch(`/Candidates/${recordId}/Notes`)
        logResult(`GET /Candidates/${recordId}/Notes (ID largo)`, notes)
        notesCount = notes.count
      } catch (err) {
        console.error(`  [ERROR] Notes con ID largo falló: ${err instanceof Error ? err.message : String(err)}`)
      }
    } else {
      console.log('  → Saltado (no se obtuvo record_id largo)')
    }

    summary.push({
      zoho_id: shortId,
      record_id: recordId,
      associate_long_count: associateLongCount,
      associate_short_count: associateShortCount,
      notes_count: notesCount,
    })
  }

  // ── 3. Resumen final ────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  console.log('  RESUMEN FINAL')
  console.log('═'.repeat(60))

  console.log('\n  Candidato | Record ID largo    | Assoc (largo) | Assoc (corto) | Notes')
  console.log('  ' + '-'.repeat(80))

  let workingWithLong = 0
  let brokenWithShort = 0

  for (const s of summary) {
    const rid = s.record_id ? s.record_id.slice(-8) + '...' : '  (no encontrado)  '
    console.log(
      `  ${s.zoho_id.padEnd(10)} | ${rid.padEnd(20)} | ${String(s.associate_long_count).padEnd(13)} | ${String(s.associate_short_count).padEnd(13)} | ${s.notes_count}`
    )
    if (s.associate_long_count > 0) workingWithLong++
    if (s.associate_short_count === 0) brokenWithShort++
  }

  console.log()
  const totalTested = summary.filter((s) => s.record_id !== null).length
  const answer = workingWithLong > 0 ? 'SÍ' : 'NO'
  const shortAnswer = brokenWithShort === summary.length ? 'confirmado ROTO' : 'retorna algo'

  console.log(`  ¿Funciona candidate-first con ID largo?  → ${answer}`)
  console.log(`  ¿ID corto devuelve array vacío?          → ${shortAnswer}`)
  console.log(`  Candidatos con record_id largo: ${totalTested}/${summary.length}`)
  console.log()
}

main().catch((err) => {
  console.error('\n[FATAL]', err)
  process.exit(1)
})

// ---------------------------------------------------------------------------
// Instrucciones de ejecución:
//
//   npx tsx --tsconfig tsconfig.json src/scripts/test-germany-candidate-zoho.ts
//
// Requiere las siguientes env vars (leídas automáticamente de .env.production-local
// o .env.local en la raíz del proyecto):
//
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   ZOHO_API_BASE_URL         (ej: https://recruit.zoho.eu/recruit/v2)
//   ZOHO_TOKEN_URL            (ej: https://accounts.zoho.eu/oauth/v2/token)
//   ZOHO_CLIENT_ID
//   ZOHO_CLIENT_SECRET
//   ZOHO_REFRESH_TOKEN
//
// El script es READ-ONLY: no modifica ningún dato en Supabase ni en Zoho.
// ---------------------------------------------------------------------------
