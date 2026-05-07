/**
 * analyze_noruega_v2.cjs — CJS version, no dotenv dependency
 * node analyze_noruega_v2.cjs
 */

const fs = require('fs')
const path = require('path')

// ─── Load .env.local manually ────────────────────────────────────────────────
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

// Use dotenv from node_modules with full path
const dotenv = require('./node_modules/dotenv')
dotenv.config({ path: path.join(__dirname, '.env.local') })

const SHEET_ID = '1wtB1Mn64iQgJC9eauABSiLT8vu5Ye605swAKYVpXJdg'

// ─── Service account auth ────────────────────────────────────────────────────
function parseServiceAccountJson(raw) {
  if (raw.startsWith("'")) raw = raw.replace(/^'+|'+$/g, '').trim()
  let parsed = null
  try {
    const p = JSON.parse(raw)
    parsed = (typeof p === 'string') ? JSON.parse(p) : p
  } catch {}
  if (!parsed) {
    const normalized = raw.replace(/\\\r\n/g, '\\n').replace(/\\\n/g, '\\n').replace(/\\"/g, '"')
    parsed = JSON.parse(normalized)
  }
  if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, '\n')
  return parsed
}

async function main() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) { console.error('❌ GOOGLE_SERVICE_ACCOUNT_JSON not found'); process.exit(1) }

  const { google } = require('./node_modules/googleapis')
  const credentials = parseServiceAccountJson(raw)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })

  // 1. List all tabs
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID })
  const allSheets = (meta.data.sheets || []).map(s => ({
    name: s.properties.title,
    gid: s.properties.sheetId,
    rowCount: s.properties.gridProperties?.rowCount,
    colCount: s.properties.gridProperties?.columnCount,
  }))

  console.log('\n═══════════════════════════════════════════════════')
  console.log('TABS EN EL SHEET')
  console.log('═══════════════════════════════════════════════════')
  allSheets.forEach((s, i) => {
    console.log(`${i+1}. [gid=${s.gid}] "${s.name}" — ${s.rowCount} filas × ${s.colCount} cols`)
  })

  // 2. Analyze each tab
  for (const s of allSheets) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `'${s.name}'`,
      })
      const rows = res.data.values || []
      if (rows.length === 0) { console.log(`\n[${s.name}] — VACÍA`); continue }

      const headers = rows[0].map(h => String(h || '').trim())
      const dataRows = rows.slice(1).filter(r => r && r.some(c => c))
      const sampleRows = dataRows.slice(0, 5)

      console.log(`\n═══════════════════════════════════════════════════`)
      console.log(`TAB: "${s.name}" (gid=${s.gid})`)
      console.log(`═══════════════════════════════════════════════════`)
      console.log(`Headers (${headers.length}): ${JSON.stringify(headers)}`)
      console.log(`Filas de datos: ${dataRows.length}`)
      console.log(`Muestra (primeras 5 filas):`)
      sampleRows.forEach((row, i) => {
        const obj = {}
        headers.forEach((h, j) => { if (h) obj[h] = row[j] || '' })
        console.log(`  [${i+1}] ${JSON.stringify(obj)}`)
      })
    } catch (err) {
      console.log(`\n[${s.name}] — ERROR: ${err.message}`)
    }
  }

  // 3. Specific focus: tab starting with "Reparto personas"
  const repartoTab = allSheets.find(s => s.name.toLowerCase().startsWith('reparto personas'))
  if (repartoTab) {
    console.log(`\n\n════════════════════════════════════════════════════`)
    console.log(`ANÁLISIS DETALLADO: "${repartoTab.name}"`)
    console.log(`════════════════════════════════════════════════════`)
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${repartoTab.name}'`,
    })
    const rows = res.data.values || []
    const headers = rows[0].map(h => String(h || '').trim())
    const dataRows = rows.slice(1).filter(r => r && r.some(c => c))
    console.log(`Total registros: ${dataRows.length}`)
    console.log(`Columnas detalladas:`)
    headers.forEach((h, i) => {
      const vals = dataRows.slice(0, 20).map(r => r[i]).filter(Boolean)
      const unique = [...new Set(vals)].slice(0, 5)
      console.log(`  [${i}] "${h}" — ejemplo valores: ${JSON.stringify(unique)}`)
    })
  }

  // 4. Compare with Excel Madre known tabs
  const knownTabs = ['Base Datos', 'Resumen', 'Global Placement', 'Pagos - Proyectos', 'Curso Desarrollo']
  const tabNames = allSheets.map(s => s.name)
  console.log(`\n\n════════════════════════════════════════════════════`)
  console.log(`COMPARACIÓN CON EXCEL MADRE ACTUAL`)
  console.log(`════════════════════════════════════════════════════`)
  knownTabs.forEach(t => {
    const found = tabNames.find(n => n.toLowerCase().includes(t.toLowerCase()))
    console.log(`  ${found ? '✅' : '❌'} "${t}" → ${found ? `encontrado como "${found}"` : 'NO encontrado'}`)
  })
  const newTabs = tabNames.filter(n => !knownTabs.some(k => n.toLowerCase().includes(k.toLowerCase())))
  console.log(`\nTabs NUEVOS (no están en el Excel Madre actual):`)
  newTabs.forEach(t => console.log(`  🆕 "${t}"`))
}

main().catch(err => { console.error('ERROR:', err); process.exit(1) })
