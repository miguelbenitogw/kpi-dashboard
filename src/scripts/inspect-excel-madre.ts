import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnvFile(p: string) {
  try {
    for (const line of readFileSync(p, 'utf-8').split(/\r?\n/)) {
      const t = line.trim(); if (!t || t.startsWith('#')) continue
      const i = t.indexOf('='); if (i < 0) continue
      const k = t.slice(0, i).trim(); let v = t.slice(i + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      v = v.replace(/\\n$/g, '').trim(); if (!process.env[k]) process.env[k] = v
    }
  } catch {}
}
loadEnvFile(resolve(process.cwd(), '.env.production-local'))
loadEnvFile(resolve(process.cwd(), '.env.local'))

// CRITICAL: Fix OpenSSL 3.x private_key newline issue BEFORE creating any Google client
// The env var arrives as backslash-escaped JSON: {\"type\":\"service_account\",...}
// Inside it, private_key newlines are stored as \\n (literal backslash+n).
// We need to:
//   1. Unescape the outer \" → " so it becomes valid JSON
//   2. Parse it
//   3. Replace literal \n sequences in private_key with real newlines
//   4. Re-serialize so the google-auth-library gets a clean JSON string
const rawGSA = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
if (rawGSA) {
  try {
    // Step 1: attempt direct parse (works if already valid JSON)
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(rawGSA)
      if (typeof parsed === 'string') parsed = JSON.parse(parsed)
    } catch {
      // Step 2: it's backslash-escaped form — unescape \" → " then parse
      const unescaped = rawGSA.replace(/\\"/g, '"')
      parsed = JSON.parse(unescaped)
    }
    if (parsed && typeof parsed.private_key === 'string') {
      // Step 3: convert any \n (literal backslash+n) to real newlines
      let pk = parsed.private_key as string
      if (!pk.includes('\n')) {
        pk = pk.replace(/\\n/g, '\n')
      }
      parsed.private_key = pk
      // Step 4: re-serialize to clean valid JSON
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(parsed)
    }
  } catch {}
}

import { listSheets, readSheetAsRows } from '../lib/google-sheets/client'

// ─────────────────────────────────────────────────────────────────────────────
// COLUMN_MAP from import.ts — reproduced here for comparison
// ─────────────────────────────────────────────────────────────────────────────
const COLUMN_MAP: Record<string, string[]> = {
  full_name: ['nombre completo', 'nombre', 'full name', 'name', 'nombre y apellidos'],
  email: ['email', 'correo', 'e-mail', 'correo electrónico'],
  phone: ['teléfono', 'telefono', 'phone', 'móvil', 'movil', 'tel'],
  nationality: ['nacionalidad', 'nationality', 'país de origen'],
  country_of_residence: ['país de residencia', 'country', 'residencia'],
  native_language: ['idioma nativo', 'native language', 'idioma materno'],
  english_level: ['nivel de inglés', 'inglés', 'english level', 'english'],
  german_level: ['nivel de alemán', 'alemán', 'german level', 'german'],
  work_permit: ['permiso de trabajo', 'work permit', 'permiso'],
  sheet_status: ['estado', 'status', 'estado actual', 'situación'],
  sheet_stage: ['etapa', 'stage', 'fase'],
  start_date: ['fecha inicio', 'inicio', 'start date', 'fecha de inicio'],
  end_date: ['fecha fin', 'fin', 'end date', 'fecha de fin'],
  enrollment_date: ['fecha de inscripción', 'inscripción', 'enrollment date', 'fecha inscripcion'],
  dropout_reason: ['motivo de baja', 'razón de baja', 'reason', 'motivo', 'dropout reason', 'causa'],
  dropout_date: ['fecha de baja', 'baja', 'dropout date', 'fecha baja'],
  dropout_notes: ['observaciones baja', 'comentarios baja', 'dropout notes', 'motivos que dan'],
  notes: ['notas', 'notes', 'comentarios', 'observaciones'],
}

const DROPOUT_COLUMN_MAP: Record<string, string[]> = {
  full_name: ['name', 'nombre'],
  sheet_status: ['status', 'estado'],
  dropout_modality: ['modality', 'modalidad'],
  start_date: ['start date', 'fecha inicio', 'fecha de inicio'],
  dropout_days_of_training: ['days of training', 'días de entrenamiento', 'dias de entrenamiento', 'days training'],
  dropout_date: ['dropout date', 'fecha de baja', 'fecha baja'],
  dropout_reason: ['reason for dropout', 'dropout reason', 'razón de baja', 'motivo de baja'],
  dropout_notes: ['motivos que dan', 'observaciones baja'],
  dropout_language_level: [
    'level of language they was in',
    'level of language they had',
    'level of language',
    'nivel de idioma',
  ],
}

function normaliseHeader(
  header: string,
  extraMap?: Record<string, string[]>
): string | null {
  const lower = header.toLowerCase().trim()
  if (extraMap) {
    for (const [canonical, variants] of Object.entries(extraMap)) {
      if (variants.some((v) => lower.includes(v) || v.includes(lower))) {
        return canonical
      }
    }
  }
  for (const [canonical, variants] of Object.entries(COLUMN_MAP)) {
    if (variants.some((v) => lower.includes(v) || v.includes(lower))) {
      return canonical
    }
  }
  return null
}

function analyseHeaders(headers: string[], tabName: string) {
  const isDropoutTab =
    tabName.toLowerCase().includes('baja') ||
    tabName.toLowerCase().includes('dropout')

  const extraMap = isDropoutTab ? DROPOUT_COLUMN_MAP : undefined

  const mapped: Array<{ header: string; canonical: string }> = []
  const unmapped: string[] = []

  for (const h of headers) {
    if (!h) continue
    const canonical = normaliseHeader(h, extraMap)
    if (canonical) {
      mapped.push({ header: h, canonical })
    } else {
      unmapped.push(h)
    }
  }

  return { mapped, unmapped, isDropoutTab }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
const SPREADSHEET_ID = '1jNmyHejPA4iGoSm-AiIzqL6d3m4E0cJa3gGmKfQDAs0'

async function main() {
  console.log('='.repeat(80))
  console.log('EXCEL MADRE — INSPECTION REPORT')
  console.log('Spreadsheet ID:', SPREADSHEET_ID)
  console.log('='.repeat(80))

  // 1. List all tabs
  const sheetList = await listSheets(SPREADSHEET_ID)
  console.log(`\nFound ${sheetList.length} tab(s):\n`)
  for (const s of sheetList) {
    console.log(`  • [GID ${s.gid}] ${s.name}`)
  }

  // 2. For each tab: read headers + first 3 data rows
  const allTabResults: Array<{
    name: string
    gid: number
    headers: string[]
    rowCount: number
    sampleRows: Record<string, string>[]
    mapped: Array<{ header: string; canonical: string }>
    unmapped: string[]
    isDropoutTab: boolean
  }> = []

  for (const sheet of sheetList) {
    try {
      const { headers, rows, tabName } = await readSheetAsRows(SPREADSHEET_ID, sheet.gid)
      const sampleRows = rows.slice(0, 3)
      const { mapped, unmapped, isDropoutTab } = analyseHeaders(headers, tabName)

      allTabResults.push({
        name: tabName,
        gid: sheet.gid,
        headers,
        rowCount: rows.length,
        sampleRows,
        mapped,
        unmapped,
        isDropoutTab,
      })
    } catch (err) {
      console.error(`  ERROR reading tab [${sheet.gid}] ${sheet.name}:`, err)
    }
  }

  // 3. Print detailed report for each tab
  for (const tab of allTabResults) {
    console.log('\n' + '─'.repeat(80))
    console.log(`TAB: "${tab.name}"  [GID: ${tab.gid}]  [${tab.rowCount} data rows]${tab.isDropoutTab ? '  *** DROPOUT TAB ***' : ''}`)
    console.log('─'.repeat(80))

    console.log(`\n  HEADERS (${tab.headers.filter(Boolean).length} non-empty):\n`)
    for (let i = 0; i < tab.headers.length; i++) {
      const h = tab.headers[i]
      if (!h) continue
      const canonical = normaliseHeader(h, tab.isDropoutTab ? DROPOUT_COLUMN_MAP : undefined)
      const flag = canonical ? `→ ${canonical}` : '⚠ UNMAPPED'
      console.log(`    [col ${i}] "${h}"  ${flag}`)
    }

    if (tab.sampleRows.length > 0) {
      console.log('\n  SAMPLE DATA (first row):')
      const firstRow = tab.sampleRows[0]
      for (const [key, val] of Object.entries(firstRow)) {
        if (!key) continue
        const display = val ? `"${val.slice(0, 80)}"` : '(empty)'
        console.log(`    ${key}: ${display}`)
      }
    } else {
      console.log('\n  No data rows found.')
    }

    console.log('\n  COLUMN MAPPING ANALYSIS:')
    console.log(`    Mapped:   ${tab.mapped.length} columns`)
    console.log(`    Unmapped: ${tab.unmapped.length} columns`)
    if (tab.unmapped.length > 0) {
      console.log(`    Unmapped column headers:`)
      for (const u of tab.unmapped) {
        console.log(`      - "${u}"`)
      }
    }
  }

  // 4. Cross-tab summary
  console.log('\n' + '='.repeat(80))
  console.log('CROSS-TAB SUMMARY')
  console.log('='.repeat(80))

  // Collect all unique unmapped columns across all tabs
  const allUnmapped = new Map<string, string[]>()
  for (const tab of allTabResults) {
    for (const u of tab.unmapped) {
      const norm = u.toLowerCase().trim()
      if (!allUnmapped.has(norm)) allUnmapped.set(norm, [])
      allUnmapped.get(norm)!.push(tab.name)
    }
  }

  // Collect all canonical fields seen across all tabs
  const canonicalCoverage = new Map<string, string[]>()
  for (const tab of allTabResults) {
    for (const { canonical } of tab.mapped) {
      if (!canonicalCoverage.has(canonical)) canonicalCoverage.set(canonical, [])
      canonicalCoverage.get(canonical)!.push(tab.name)
    }
  }

  console.log('\n  All canonical fields found across all tabs:')
  const allCanonicals = [
    ...Object.keys(COLUMN_MAP),
    ...Object.keys(DROPOUT_COLUMN_MAP),
  ].filter((v, i, a) => a.indexOf(v) === i)

  for (const canonical of allCanonicals) {
    const tabs = canonicalCoverage.get(canonical) ?? []
    const status = tabs.length > 0 ? `FOUND in: ${tabs.join(', ')}` : 'NOT FOUND in any tab'
    console.log(`    ${canonical.padEnd(30)} ${status}`)
  }

  console.log('\n  Unmapped columns (NOT in COLUMN_MAP or DROPOUT_COLUMN_MAP):')
  if (allUnmapped.size === 0) {
    console.log('    None — all columns are mapped!')
  } else {
    for (const [col, tabs] of allUnmapped) {
      console.log(`    "${col}"  (in tabs: ${tabs.join(', ')})`)
    }
  }

  // 5. Compatibility assessment
  console.log('\n' + '='.repeat(80))
  console.log('COMPATIBILITY ASSESSMENT')
  console.log('='.repeat(80))

  const totalTabs = allTabResults.length
  const tabsWithData = allTabResults.filter((t) => t.rowCount > 0).length
  const totalUnmapped = allUnmapped.size

  console.log(`\n  Tabs found:       ${totalTabs}`)
  console.log(`  Tabs with data:   ${tabsWithData}`)
  console.log(`  Unmapped columns: ${totalUnmapped}`)

  if (totalUnmapped === 0) {
    console.log('\n  VERDICT: FULLY COMPATIBLE — all columns map to known canonical fields.')
  } else if (totalUnmapped <= 5) {
    console.log('\n  VERDICT: MOSTLY COMPATIBLE — minor gaps, COLUMN_MAP needs small additions.')
  } else {
    console.log('\n  VERDICT: NEEDS WORK — significant unmapped columns, COLUMN_MAP requires updates.')
  }

  console.log('\n' + '='.repeat(80))
  console.log('END OF REPORT')
  console.log('='.repeat(80))
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
