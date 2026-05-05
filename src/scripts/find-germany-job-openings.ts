import { readFileSync } from 'fs'
import { resolve } from 'path'

// ---------------------------------------------------------------------------
// Env loading — mismo patrón que test-germany-candidate-zoho.ts
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
// Supabase admin client
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
// Zoho raw fetch helper
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
    body = text.slice(0, 500)
  }

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
  console.log('\n' + '─'.repeat(70))
  console.log(`  ${label}`)
  console.log('─'.repeat(70))
}

interface JobOpeningRecord {
  id: string
  Job_Opening_Name: string
  Job_Opening_Status: string | null
  No_of_Candidates: number | null
  No_of_Candidates_Hired: number | null
  Number_of_Positions: number | null
  Job_Opening_ID: string | null
  City: string | null
  Country: string | null
  Date_Opened: string | null
}

function logJobOpening(job: JobOpeningRecord, index: number) {
  console.log(`\n  [${index + 1}] ────────────────────────────────────────────`)
  console.log(`      ID (largo)              : ${job.id}`)
  console.log(`      Job_Opening_ID (corto)  : ${job.Job_Opening_ID ?? '(no disponible)'}`)
  console.log(`      Job_Opening_Name        : ${job.Job_Opening_Name}`)
  console.log(`      Job_Opening_Status      : ${job.Job_Opening_Status ?? '(null)'}`)
  console.log(`      No_of_Candidates        : ${job.No_of_Candidates ?? '(null)'}`)
  console.log(`      No_of_Candidates_Hired  : ${job.No_of_Candidates_Hired ?? '(null)'}`)
  console.log(`      Number_of_Positions     : ${job.Number_of_Positions ?? '(null)'}`)
  console.log(`      City                    : ${job.City ?? '(null)'}`)
  console.log(`      Country                 : ${job.Country ?? '(null)'}`)
  console.log(`      Date_Opened             : ${job.Date_Opened ?? '(null)'}`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗')
  console.log('║  Find Germany Job Openings — Zoho + Supabase                         ║')
  console.log(`║  ${new Date().toISOString()}                               ║`)
  console.log('╚══════════════════════════════════════════════════════════════════════╝')

  const FIELDS = [
    'Job_Opening_Name',
    'Job_Opening_Status',
    'Date_Opened',
    'No_of_Candidates_Associated',
    'No_of_Candidates_Hired',
    'Number_of_Positions',
    'City',
    'Country',
    'Job_Opening_ID',
  ].join(',')

  const KEYWORDS = ['Alemania', 'Kita', 'Infantil', 'Germany']

  const allJobOpenings: JobOpeningRecord[] = []
  const seenIds = new Set<string>()

  // ── 1. Buscar en Zoho por cada keyword ──────────────────────────────────
  for (const keyword of KEYWORDS) {
    sep(`Zoho /Job_Openings/search  criteria=(Job_Opening_Name:contains:${keyword})`)

    try {
      const result = await zohoRawFetch('/Job_Openings/search', {
        criteria: `(Job_Opening_Name:contains:${keyword})`,
        fields: FIELDS,
        per_page: '200',
      })

      const statusIcon = result.ok ? '✓' : '✗'
      console.log(`\n  HTTP ${statusIcon} ${result.status}  |  Items found: ${result.count}`)

      if (!result.ok) {
        console.log(`  Body preview: ${JSON.stringify(result.body).slice(0, 300)}`)
        continue
      }

      if (result.count === 0) {
        console.log('  (sin resultados para este keyword)')
        // Show body to understand why (Zoho returns {code, message} for no data)
        const b = result.body as Record<string, unknown>
        if (b?.code || b?.message) {
          console.log(`  Zoho message: code=${b.code}  message=${b.message}`)
        }
        continue
      }

      for (const raw of result.items) {
        const r = raw as Record<string, unknown>
        const id = String(r.id ?? '')
        if (!id || seenIds.has(id)) continue
        seenIds.add(id)

        const job: JobOpeningRecord = {
          id,
          Job_Opening_Name: String(r.Job_Opening_Name ?? ''),
          Job_Opening_Status: r.Job_Opening_Status != null ? String(r.Job_Opening_Status) : null,
          No_of_Candidates: r.No_of_Candidates_Associated != null ? Number(r.No_of_Candidates_Associated) : null,
          No_of_Candidates_Hired: r.No_of_Candidates_Hired != null ? Number(r.No_of_Candidates_Hired) : null,
          Number_of_Positions: r.Number_of_Positions != null ? Number(r.Number_of_Positions) : null,
          Job_Opening_ID: r.Job_Opening_ID != null ? String(r.Job_Opening_ID) : null,
          City: r.City != null ? String(r.City) : null,
          Country: r.Country != null ? String(r.Country) : null,
          Date_Opened: r.Date_Opened != null ? String(r.Date_Opened) : null,
        }
        allJobOpenings.push(job)
        logJobOpening(job, allJobOpenings.length - 1)
      }
    } catch (err) {
      console.error(`  [ERROR] keyword="${keyword}": ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── 2. Buscar en Supabase job_openings_kpi ──────────────────────────────
  sep('Supabase  job_openings_kpi  (filtro por keywords en title/job_opening_name)')

  try {
    const supabase = getSupabaseAdmin()

    // Buscar filas que contengan alguno de los keywords (case-insensitive)
    // Intentamos con ilike en múltiples columnas
    const keywordPattern = KEYWORDS.map(k => `title.ilike.%${k}%`).join(',')

    const { data: rows, error } = await supabase
      .from('job_openings_kpi')
      .select('id, title, zoho_id, status, candidates_count, country, created_at')
      .or(keywordPattern)
      .order('created_at', { ascending: false })

    if (error) {
      console.log(`\n  [ERROR Supabase] ${error.message}`)
      // Intentar sin filtro para ver qué columnas existen
      console.log('\n  Intentando query sin filtro para ver estructura de la tabla...')
      const { data: sample, error: sampleErr } = await supabase
        .from('job_openings_kpi')
        .select('*')
        .limit(3)

      if (sampleErr) {
        console.log(`  [ERROR] tabla job_openings_kpi no encontrada o sin acceso: ${sampleErr.message}`)
      } else if (sample && sample.length > 0) {
        console.log(`  Columnas disponibles: ${Object.keys(sample[0]).join(', ')}`)
        console.log(`  Sample row: ${JSON.stringify(sample[0]).slice(0, 400)}`)
      } else {
        console.log('  (tabla vacía o no existe)')
      }
    } else if (!rows || rows.length === 0) {
      console.log('\n  (0 resultados con keywords de Alemania en job_openings_kpi)')
      // Mostrar total de registros para confirmar que la tabla tiene datos
      const { count } = await supabase
        .from('job_openings_kpi')
        .select('*', { count: 'exact', head: true })
      console.log(`  Total registros en job_openings_kpi: ${count ?? '(desconocido)'}`)
    } else {
      console.log(`\n  Encontrados ${rows.length} registros en Supabase:\n`)
      for (const row of rows) {
        const r = row as Record<string, unknown>
        console.log(`  ┌─ id (Supabase)    : ${r.id}`)
        console.log(`  │  zoho_id          : ${r.zoho_id ?? '(null)'}`)
        console.log(`  │  title            : ${r.title ?? r.job_opening_name ?? '(null)'}`)
        console.log(`  │  status           : ${r.status ?? '(null)'}`)
        console.log(`  │  candidates_count : ${r.candidates_count ?? '(null)'}`)
        console.log(`  │  country          : ${r.country ?? '(null)'}`)
        console.log(`  └─ created_at       : ${r.created_at ?? '(null)'}`)
        console.log()
      }
    }
  } catch (err) {
    console.error(`  [ERROR Supabase] ${err instanceof Error ? err.message : String(err)}`)
  }

  // ── 3. Resumen final ────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70))
  console.log('  RESUMEN FINAL — Job Openings Alemanas encontradas en Zoho')
  console.log('═'.repeat(70))

  if (allJobOpenings.length === 0) {
    console.log('\n  (ninguna vacante encontrada con los keywords buscados)')
  } else {
    console.log(`\n  Total únicas: ${allJobOpenings.length}\n`)
    console.log('  #  | ID (largo, 19 dígitos)    | Nombre                                        | Status       | Candidatos')
    console.log('  ' + '-'.repeat(120))

    for (let i = 0; i < allJobOpenings.length; i++) {
      const j = allJobOpenings[i]
      const name = j.Job_Opening_Name.length > 45
        ? j.Job_Opening_Name.slice(0, 42) + '...'
        : j.Job_Opening_Name
      const status = (j.Job_Opening_Status ?? '').slice(0, 12)
      const cands = j.No_of_Candidates ?? '-'
      console.log(
        `  ${String(i + 1).padEnd(3)}| ${j.id.padEnd(26)}| ${name.padEnd(47)}| ${status.padEnd(13)}| ${cands}`
      )
    }
  }

  console.log('\n  IDs largos (para copiar/pegar):\n')
  for (const j of allJobOpenings) {
    console.log(`  ${j.id}  →  "${j.Job_Opening_Name}"`)
  }

  console.log()
}

main().catch((err) => {
  console.error('\n[FATAL]', err)
  process.exit(1)
})

// ---------------------------------------------------------------------------
// Ejecución:
//
//   npx tsx --tsconfig tsconfig.json src/scripts/find-germany-job-openings.ts
//
// Requiere en .env.production-local o .env.local:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   ZOHO_API_BASE_URL, ZOHO_TOKEN_URL, ZOHO_CLIENT_ID,
//   ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN
// ---------------------------------------------------------------------------
