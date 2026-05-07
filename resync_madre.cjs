/**
 * resync_madre.cjs — Re-runs Global Placement import for all active madre sheets.
 * Picks up the new tipo_perfil field added to PLACEMENT_COLUMN_MAP.
 * node resync_madre.cjs
 */

const path = require('path')
const dotenv = require('./node_modules/dotenv')
dotenv.config({ path: path.join(__dirname, '.env.local') })

// We call the compiled TS functions via ts-node or we call Supabase + Sheets directly.
// Simpler: call the deployed API endpoint if available. Otherwise run inline.

const MADRE_SHEETS = [
  { sheet_id: '1XLawLxIbwfBOHwEejR1ksOl0v2gyolHtuqLs0aF1Ujo', label: '2025' },
  { sheet_id: '1jNmyHejPA4iGoSm-AiIzqL6d3m4E0cJa3gGmKfQDAs0', label: '2026' },
]

const GLOBAL_PLACEMENT_GID = 1470777220

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
  const isoMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}/)
  if (isoMatch) return isoMatch[0]
  const euroMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
  if (euroMatch) {
    const [, d, m, y] = euroMatch
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  return null
}

const COLUMN_MAP = {
  id: ['id', 'zoho id', 'zoho_id', 'candidate id', 'candidateid'],
  full_name: ['nombre y apellidos', 'nombre completo', 'nombre', 'name'],
  promocion: ['promocion', 'promoción', 'promo'],
  placement_client: ['cliente', 'client', 'empresa', 'company'],
  placement_date: ['fecha de colocación', 'fecha colocacion', 'fecha colocación', 'placement date', 'fecha inicio trabajo'],
  flight_date: ['fecha de vuelo', 'fecha vuelo', 'flight date', 'vuelo'],
  hpr_number: ['hpr', 'hpr number', 'hpr-nummer', 'número hpr', 'numero hpr', 'n° hpr', 'nº hpr'],
  assigned_agency: ['assigned agency', 'agency', 'agencia asignada', 'agencia'],
  gp_assignment: ['assignment'],
  gp_kontaktperson: ['kontaktperson', 'kontakt', 'contact person', 'contacto'],
  gp_training_status: ['status (training)', 'training status', 'estado formación', 'estado formacion'],
  placement_status: ['status (placement)', 'placement status', 'estado colocacion', 'estado colocación'],
  gp_availability: ['availability', 'disponibilidad', 'available'],
  gp_open_to: ['open to', 'abierto a', 'abierta a'],
  gp_priority: ['priority', 'prioridad'],
  gp_shots: ['shots', 'shots program', 'vacunas'],
  gp_has_profile: ['has global placement profile?', 'has gp profile', 'gp profile', 'tiene perfil gp', 'perfil gp'],
  gp_comments: ['comments (coordinators)', 'comments (coordinato', 'comments'],
  gp_cv_norsk: ['cv norsk'],
  gp_blind_cv_norsk: ['blind cv norsk'],
  gp_pk: ['pk (presenting card)', 'presenting card', 'pk'],
  gp_criminal_record: ['criminal record'],
  gp_sarm: ['sarm'],
  gp_mantux: ['mantux'],
  gp_last_update_placement: ['last update (placement)', 'last update placement', 'last update'],
  gp_arrival_date: ['arrival date', 'arrival'],
  tipo_perfil: ['tipo de perfil', 'tipo perfil', 'profile type', 'tipo_perfil'],
}

function mapHeader(header) {
  const lower = header.toLowerCase().trim()
  for (const [canonical, variants] of Object.entries(COLUMN_MAP)) {
    if (variants.some(v => lower === v)) return canonical
  }
  for (const [canonical, variants] of Object.entries(COLUMN_MAP)) {
    if (variants.some(v => v.length >= 4 && lower.includes(v))) return canonical
  }
  return null
}

const BOOL_TRUE = ['true', 'yes', 'si', 'sí', '1']

async function importGlobalPlacement(sheets, supabase, sheetId, label) {
  console.log(`\n📊 Processing madre sheet: ${label} (${sheetId})`)

  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
  const sheetMeta = meta.data.sheets?.find(s => s.properties?.sheetId === GLOBAL_PLACEMENT_GID)
  if (!sheetMeta) {
    console.log(`  ⚠️  No Global Placement tab (gid=${GLOBAL_PLACEMENT_GID}) in ${label}`)
    return { updated: 0, skipped: 0, errors: [] }
  }
  const tabName = sheetMeta.properties.title

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: tabName })
  const allRows = res.data.values || []
  if (allRows.length < 2) { console.log(`  ⚠️  Tab "${tabName}" has no data`); return { updated: 0, skipped: 0, errors: [] } }

  const rawHeaders = allRows[0].map(h => String(h || '').trim())
  const dataRows = allRows.slice(1)

  const headerMap = new Map()
  for (const h of rawHeaders) {
    const canonical = mapHeader(h)
    if (canonical) headerMap.set(h, canonical)
  }

  console.log(`  Headers mapped: ${headerMap.size}/${rawHeaders.length}`)
  if (headerMap.has('tipo_perfil') || [...headerMap.values()].includes('tipo_perfil')) {
    console.log(`  ✅ tipo_perfil column found!`)
  } else {
    console.log(`  ℹ️  No tipo_perfil column in this sheet`)
  }

  let updated = 0, skipped = 0
  const errors = []
  const batchSize = 50

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const mapped = {}
    for (const [rawHeader, canonical] of headerMap) {
      const colIdx = rawHeaders.indexOf(rawHeader)
      const value = row[colIdx]?.trim()
      if (value) mapped[canonical] = value
    }

    const candidateId = mapped['id']
    if (!candidateId) { skipped++; continue }

    const updateData = {}
    if (mapped['tipo_perfil']) updateData.tipo_perfil = mapped['tipo_perfil']
    if (mapped['gp_training_status']) updateData.gp_training_status = mapped['gp_training_status']
    if (mapped['placement_status']) updateData.placement_status = mapped['placement_status']
    if (mapped['assigned_agency']) updateData.assigned_agency = mapped['assigned_agency']
    if (mapped['gp_open_to']) updateData.gp_open_to = mapped['gp_open_to']
    if (mapped['gp_priority']) updateData.gp_priority = mapped['gp_priority']
    if (mapped['hpr_number']) updateData.hpr_number = mapped['hpr_number']
    if (mapped['gp_arrival_date']) updateData.gp_arrival_date = parseDate(mapped['gp_arrival_date'])
    if (mapped['placement_client']) updateData.placement_client = mapped['placement_client']
    if (mapped['gp_assignment']) updateData.gp_assignment = mapped['gp_assignment']
    if (mapped['gp_comments']) updateData.gp_comments = mapped['gp_comments']
    if (mapped['gp_last_update_placement']) updateData.gp_last_update_placement = mapped['gp_last_update_placement']

    if (Object.keys(updateData).length === 0) { skipped++; continue }

    const { error } = await supabase.from('candidates_kpi').update(updateData).eq('id', candidateId)
    if (error) {
      errors.push(`${candidateId}: ${error.message}`)
    } else {
      updated++
    }

    if (updated % 50 === 0 && updated > 0) process.stdout.write(`  ... ${updated} updated\r`)
  }

  console.log(`  ✅ Updated: ${updated} | Skipped: ${skipped} | Errors: ${errors.length}`)
  if (errors.length > 0) errors.slice(0, 5).forEach(e => console.log(`  ❌ ${e}`))
  return { updated, skipped, errors }
}

async function main() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) { console.error('❌ GOOGLE_SERVICE_ACCOUNT_JSON not set'); process.exit(1) }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) { console.error('❌ Supabase env vars not set'); process.exit(1) }

  const { google } = require('./node_modules/googleapis')
  const { createClient } = require('./node_modules/@supabase/supabase-js')

  const credentials = parseServiceAccountJson(raw)
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] })
  const sheets = google.sheets({ version: 'v4', auth })
  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('🔄 Resyncing Global Placement for all active madre sheets...')
  console.log('   (picking up new tipo_perfil field)\n')

  let totalUpdated = 0
  for (const madre of MADRE_SHEETS) {
    const result = await importGlobalPlacement(sheets, supabase, madre.sheet_id, madre.label)
    totalUpdated += result.updated
  }

  console.log(`\n✅ DONE — Total updated: ${totalUpdated}`)
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1) })
