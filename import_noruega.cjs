/**
 * import_noruega.cjs — One-time import from Norway "Reparto personas- cliente" tab.
 * node import_noruega.cjs           (dry run)
 * node import_noruega.cjs --write   (writes to DB)
 */

const path = require('path')
const dotenv = require('./node_modules/dotenv')
dotenv.config({ path: path.join(__dirname, '.env.local') })

const NORWAY_SHEET_ID = '1wtB1Mn64iQgJC9eauABSiLT8vu5Ye605swAKYVpXJdg'
const REPARTO_GID = 1818389707
const HEADER_ROW = 2 // row 0 empty, row 1 = actual headers (1-indexed)

const DRY_RUN = !process.argv.includes('--write')

function parseServiceAccountJson(raw) {
  if (raw.startsWith("'")) raw = raw.replace(/^'+|'+$/g, '').trim()
  let parsed = null
  try { const p = JSON.parse(raw); parsed = typeof p === 'string' ? JSON.parse(p) : p } catch {}
  if (!parsed) {
    const normalized = raw.replace(/\\\r\n/g, '\\n').replace(/\\\n/g, '\\n').replace(/\\"/g, '"')
    parsed = JSON.parse(normalized)
  }
  if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, '\n')
  return parsed
}

function parseDate(value) {
  if (!value || !value.trim()) return null
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
  const m = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  return null
}

function normalizePromoName(name) {
  const trimmed = name.trim()
  const shortMatch = trimmed.match(/^[Pp](\d+)$/)
  if (shortMatch) return `Promoción ${shortMatch[1]}`
  return trimmed
}

// Column map for "Reparto personas- cliente"
const COLUMN_MAP = {
  id:                 { variants: ['id'], exact: true },
  promocion_nombre:   { variants: ['promocion', 'promoción'] },
  coordinador:        { variants: ['coordinador', 'coordinadora'] },
  full_name:          { variants: ['nombre y apellidos', 'nombre completo', 'nombre'] },
  gp_training_status: { variants: ['estado'] },
  fecha_fin_formacion:{ variants: ['fecha fin de formacion', 'fecha fin de formación', 'fecha fin formacion'] },
  fecha_inicio_trabajo:{ variants: ['fecha inicio de trabajo en noruega', 'fecha inicio de trabajo', 'fecha inicio trabajo'] },
  tiempo_colocacion:  { variants: ['tiempo de colocacion', 'tiempo de colocación'] },
  tipo_perfil:        { variants: ['tipo de perfil', 'tipo perfil'] },
  quincena:           { variants: ['quincena'] },
  mes_llegada:        { variants: ['mes y año de llegada', 'mes y ano de llegada', 'mes año llegada'] },
  cliente:            { variants: ['cliente asignado'] }, // "cliente asignado a fecha..." via substring
  notas_excel:        { variants: ['notas'] },
}

const SKIP_HEADERS = ['concatenar', 'facturado a cliente', 'cliente estimado']

function mapHeader(header) {
  const lower = header.toLowerCase().trim()
  // Skip unwanted columns
  if (SKIP_HEADERS.some(s => lower.includes(s))) return null
  for (const [canonical, { variants, exact }] of Object.entries(COLUMN_MAP)) {
    if (exact) {
      if (variants.some(v => lower === v)) return canonical
    } else {
      if (variants.some(v => lower === v)) return canonical
    }
  }
  for (const [canonical, { variants, exact }] of Object.entries(COLUMN_MAP)) {
    if (!exact) {
      if (variants.some(v => v.length >= 5 && lower.includes(v))) return canonical
    }
  }
  return null
}

async function main() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!raw || !supabaseUrl || !supabaseKey) {
    console.error('❌ Missing env vars'); process.exit(1)
  }

  const { google } = require('./node_modules/googleapis')
  const { createClient } = require('./node_modules/@supabase/supabase-js')

  const credentials = parseServiceAccountJson(raw)
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] })
  const sheets = google.sheets({ version: 'v4', auth })
  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log(`\n🇳🇴 Norway historical import — "${DRY_RUN ? 'DRY RUN' : 'LIVE WRITE'}"\n`)

  // Read the tab (headerRow=2 because row 0 is empty)
  const meta = await sheets.spreadsheets.get({ spreadsheetId: NORWAY_SHEET_ID })
  const sheetMeta = meta.data.sheets?.find(s => s.properties?.sheetId === REPARTO_GID)
  if (!sheetMeta) { console.error('❌ Tab gid=1818389707 not found'); process.exit(1) }
  const tabName = sheetMeta.properties.title
  console.log(`Tab: "${tabName}"`)

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: NORWAY_SHEET_ID, range: `'${tabName}'` })
  const allRows = res.data.values || []
  // Row 0 = empty, Row 1 = headers (0-indexed)
  const rawHeaders = (allRows[1] || []).map(h => String(h || '').trim())
  const dataRows = allRows.slice(2) // data starts at row 2 (0-indexed)

  console.log(`Headers: ${rawHeaders.length} cols`)
  console.log(`Data rows: ${dataRows.length}`)

  // Build header → canonical map
  const headerMap = new Map()
  const debugMapped = []
  for (const h of rawHeaders) {
    const canonical = mapHeader(h)
    if (canonical) { headerMap.set(h, canonical); debugMapped.push(`"${h}" → ${canonical}`) }
  }
  console.log(`\nMapped ${headerMap.size} columns:`)
  debugMapped.forEach(d => console.log(`  ${d}`))

  let updated = 0, skipped = 0, notFound = 0
  const errors = []
  const preview = []

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const mapped = {}
    for (const [rawHeader, canonical] of headerMap) {
      const colIdx = rawHeaders.indexOf(rawHeader)
      const value = colIdx >= 0 ? (row[colIdx] || '').trim() : ''
      if (value) mapped[canonical] = value
    }

    const candidateId = mapped['id']
    if (!candidateId) { skipped++; continue }

    // Build update payload
    const updateData = {}
    if (mapped['promocion_nombre']) updateData.promocion_nombre = normalizePromoName(mapped['promocion_nombre'])
    if (mapped['coordinador']) updateData.coordinador = mapped['coordinador']
    if (mapped['full_name']) updateData.full_name = mapped['full_name']
    if (mapped['gp_training_status']) updateData.gp_training_status = mapped['gp_training_status']
    if (mapped['tipo_perfil']) updateData.tipo_perfil = mapped['tipo_perfil']
    if (mapped['quincena']) updateData.quincena = mapped['quincena']
    if (mapped['mes_llegada']) {
      updateData.mes_llegada = mapped['mes_llegada']
      // Extract year for anio_formacion
      const yearMatch = mapped['mes_llegada'].match(/(\d{4})/)
      if (yearMatch) updateData.anio_formacion = parseInt(yearMatch[1], 10)
    }
    if (mapped['cliente']) updateData.cliente = mapped['cliente']
    if (mapped['notas_excel']) updateData.notas_excel = mapped['notas_excel']
    if (mapped['fecha_fin_formacion']) updateData.fecha_fin_formacion = parseDate(mapped['fecha_fin_formacion'])
    if (mapped['fecha_inicio_trabajo']) updateData.fecha_inicio_trabajo = parseDate(mapped['fecha_inicio_trabajo'])
    if (mapped['tiempo_colocacion']) updateData.tiempo_colocacion = mapped['tiempo_colocacion']

    if (i < 20) {
      preview.push({ id: candidateId, ...updateData })
    }

    if (DRY_RUN) {
      updated++
      continue
    }

    const { error } = await supabase.from('candidates_kpi').update(updateData).eq('id', candidateId)
    if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('0 rows')) {
        notFound++
      } else {
        errors.push(`${candidateId}: ${error.message}`)
      }
    } else {
      updated++
    }

    if ((updated + notFound) % 50 === 0 && updated > 0) process.stdout.write(`  ... ${updated} updated\r`)
  }

  console.log(`\n📊 Results:`)
  console.log(`  Updated:   ${updated}`)
  console.log(`  Skipped:   ${skipped} (no ID)`)
  console.log(`  Not found: ${notFound}`)
  console.log(`  Errors:    ${errors.length}`)
  if (errors.length > 0) errors.slice(0, 5).forEach(e => console.log(`  ❌ ${e}`))

  console.log(`\n👁️  Preview (first ${Math.min(preview.length, 5)} rows):`)
  preview.slice(0, 5).forEach(p => console.log(' ', JSON.stringify(p)))

  if (DRY_RUN) {
    console.log(`\n💡 Run with --write to apply changes: node import_noruega.cjs --write`)
  }
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1) })
