/**
 * analyze_noruega.mjs
 *
 * Analiza el Google Sheet histórico de Noruega (Excel Madre histórico).
 * Ejecutar: node analyze_noruega.mjs
 *
 * Requiere: GOOGLE_SERVICE_ACCOUNT_JSON en .env.local
 */

import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const require = createRequire(import.meta.url)

// Load dotenv
const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const SHEET_ID = '1wtB1Mn64iQgJC9eauABSiLT8vu5Ye605swAKYVpXJdg'

// ─── Service account auth ────────────────────────────────────────────────────

function parseServiceAccountJson(raw) {
  if (raw.startsWith("'")) raw = raw.replace(/^'+|'+$/g, '').trim()

  let parsed = null
  try {
    const p = JSON.parse(raw)
    if (p && typeof p === 'object') parsed = p
    else if (typeof p === 'string') parsed = JSON.parse(p)
  } catch { /* try backslash-escaped form */ }

  if (!parsed) {
    const normalized = raw
      .replace(/\\\r\n/g, '\\n')
      .replace(/\\\n/g, '\\n')
      .replace(/\\"/g, '"')
    parsed = JSON.parse(normalized)
  }

  if (parsed.private_key && typeof parsed.private_key === 'string') {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n')
  }

  return parsed
}

function getSheetsClient() {
  const { google } = require('googleapis')
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var is not set')

  const credentials = parseServiceAccountJson(raw)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  return google.sheets({ version: 'v4', auth })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function separator(char = '─', length = 80) {
  return char.repeat(length)
}

function printSection(title) {
  console.log('\n' + separator('═'))
  console.log(`  ${title}`)
  console.log(separator('═'))
}

function printSubSection(title) {
  console.log('\n' + separator('─'))
  console.log(`  ${title}`)
  console.log(separator('─'))
}

async function readTab(sheets, spreadsheetId, tabName) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: tabName,
    })
    return res.data.values ?? []
  } catch (err) {
    return null
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Conectando con Google Sheets API...')
  const sheets = getSheetsClient()

  // 1. List all tabs
  printSection('PASO 1: LISTADO DE TODOS LOS TABS')
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID })
  const allSheets = (meta.data.sheets ?? []).map(s => ({
    name: s.properties?.title ?? '',
    gid: s.properties?.sheetId ?? 0,
    rowCount: s.properties?.gridProperties?.rowCount ?? 0,
    colCount: s.properties?.gridProperties?.columnCount ?? 0,
  }))

  console.log(`\nTotal de tabs: ${allSheets.length}\n`)
  console.log('GID\t\t| Nombre del tab\t\t\t| Filas aprox | Cols')
  console.log(separator())
  for (const s of allSheets) {
    console.log(`${String(s.gid).padEnd(15)}| ${s.name.padEnd(35)}| ${String(s.rowCount).padEnd(12)}| ${s.colCount}`)
  }

  // 2. Analyze each tab
  printSection('PASO 2: ANÁLISIS DETALLADO DE CADA TAB')

  const tabAnalysis = []

  for (const sheetInfo of allSheets) {
    printSubSection(`TAB: "${sheetInfo.name}" (GID=${sheetInfo.gid})`)

    const rawData = await readTab(sheets, SHEET_ID, sheetInfo.name)

    if (!rawData || rawData.length === 0) {
      console.log('  ⚠ Tab vacío o sin acceso')
      tabAnalysis.push({ name: sheetInfo.name, gid: sheetInfo.gid, headers: [], rows: 0 })
      continue
    }

    console.log(`  Filas totales (incluyendo header): ${rawData.length}`)

    // Try to find the header row (first row with content > 2 cols)
    let headerRowIdx = 0
    for (let i = 0; i < Math.min(5, rawData.length); i++) {
      if ((rawData[i] ?? []).filter(c => c && c.toString().trim()).length > 2) {
        headerRowIdx = i
        break
      }
    }

    const headers = (rawData[headerRowIdx] ?? []).map(h => String(h ?? '').trim()).filter(h => h)
    const dataRows = rawData.slice(headerRowIdx + 1)
    const nonEmptyRows = dataRows.filter(r => r && r.some(c => c && c.toString().trim()))

    console.log(`  Header en fila: ${headerRowIdx + 1}`)
    console.log(`  Columnas encontradas: ${headers.length}`)
    console.log(`  Filas de datos (no vacías): ${nonEmptyRows.length}`)

    console.log('\n  HEADERS:')
    headers.forEach((h, i) => {
      console.log(`    [${i}] ${h}`)
    })

    // Show 5-8 sample rows
    const sampleRows = nonEmptyRows.slice(0, 8)
    if (sampleRows.length > 0) {
      console.log('\n  DATOS DE MUESTRA (hasta 8 filas):')
      sampleRows.forEach((row, rowIdx) => {
        console.log(`\n  Fila ${rowIdx + 1}:`)
        headers.forEach((h, colIdx) => {
          const val = row[colIdx] ?? ''
          if (val.toString().trim()) {
            console.log(`    ${h}: ${val}`)
          }
        })
      })
    }

    tabAnalysis.push({
      name: sheetInfo.name,
      gid: sheetInfo.gid,
      headers,
      rows: nonEmptyRows.length,
      headerRowIdx,
    })
  }

  // 3. Find "Reparto personas-cliente" or similar tab
  printSection('PASO 3: ANÁLISIS ESPECÍFICO - "Reparto personas-cliente"')

  const repartoTab = allSheets.find(s =>
    s.name.toLowerCase().includes('reparto') ||
    s.name.toLowerCase().includes('personas') ||
    s.name.toLowerCase().includes('cliente')
  )

  if (repartoTab) {
    console.log(`\nTab encontrado: "${repartoTab.name}" (GID=${repartoTab.gid})`)

    const rawData = await readTab(sheets, SHEET_ID, repartoTab.name)
    if (rawData && rawData.length > 0) {
      // Find header row more carefully
      let headerRowIdx = 0
      for (let i = 0; i < Math.min(5, rawData.length); i++) {
        const rowContent = (rawData[i] ?? []).filter(c => c && c.toString().trim())
        if (rowContent.length > 2) {
          headerRowIdx = i
          break
        }
      }

      const headers = (rawData[headerRowIdx] ?? []).map(h => String(h ?? '').trim())
      const dataRows = rawData.slice(headerRowIdx + 1).filter(r => r && r.some(c => c && c.toString().trim()))

      console.log(`\nTotal columnas: ${headers.filter(h=>h).length}`)
      console.log(`Total filas de datos: ${dataRows.length}`)

      console.log('\nALL HEADERS:')
      headers.forEach((h, i) => {
        if (h) console.log(`  [${i}] "${h}"`)
      })

      console.log('\nPRIMERAS 10 FILAS COMPLETAS:')
      dataRows.slice(0, 10).forEach((row, rowIdx) => {
        console.log(`\n--- Registro ${rowIdx + 1} ---`)
        headers.forEach((h, colIdx) => {
          const val = (row[colIdx] ?? '').toString().trim()
          if (h && val) {
            console.log(`  ${h}: "${val}"`)
          }
        })
      })
    }
  } else {
    console.log('\nNo se encontró tab con "reparto" o "personas" en el nombre.')
    console.log('Tabs disponibles:')
    allSheets.forEach(s => console.log(`  - "${s.name}" (GID=${s.gid})`))
  }

  // 4. Compare with current Excel Madre columns
  printSection('PASO 4: COMPARACIÓN CON EXCEL MADRE ACTUAL')

  const currentMadreTabs = [
    'Base Datos', 'Resumen', 'Global Placement', 'Pagos - Proyectos', 'Curso Desarrollo'
  ]
  const historicTabNames = allSheets.map(s => s.name)

  console.log('\nTabs en Excel Madre actual:')
  currentMadreTabs.forEach(t => {
    const found = historicTabNames.some(hn =>
      hn.toLowerCase().includes(t.toLowerCase().split(' ')[0].toLowerCase())
    )
    console.log(`  ${found ? '✓' : '✗'} ${t}`)
  })

  console.log('\nTabs NUEVOS en el histórico (no en Excel Madre actual):')
  const newTabs = historicTabNames.filter(hn =>
    !currentMadreTabs.some(ct => hn.toLowerCase().includes(ct.toLowerCase().split(' ')[0].toLowerCase()))
  )
  newTabs.forEach(t => console.log(`  + "${t}"`))

  // 5. Base Datos comparison
  printSection('PASO 5: ANÁLISIS BASE DATOS - COMPARACIÓN DE COLUMNAS')

  const baseDatosTab = tabAnalysis.find(t =>
    t.name.toLowerCase().includes('base datos') ||
    t.name.toLowerCase() === 'base datos'
  )

  const currentBaseDatosColumns = [
    'id', 'promocion/promoción', 'coordinador', 'nombre y apellidos',
    'estado', 'fecha fin de formación', 'fecha inicio de trabajo en noruega',
    'tiempo de colocación', 'tipo de perfil', 'quincena', 'mes y año de llegada',
    'cliente', 'notas'
  ]

  if (baseDatosTab) {
    console.log('\nColumnas en HISTÓRICO Base Datos:')
    baseDatosTab.headers.forEach(h => {
      if (!h) return
      const inCurrent = currentBaseDatosColumns.some(c =>
        h.toLowerCase().includes(c.toLowerCase().split('/')[0].trim()) ||
        c.toLowerCase().includes(h.toLowerCase())
      )
      console.log(`  ${inCurrent ? '=' : 'NEW'} "${h}"`)
    })
  }

  // 6. Summary
  printSection('PASO 6: RESUMEN EJECUTIVO')

  console.log('\n[TABS DEL HISTÓRICO DE NORUEGA]')
  tabAnalysis.forEach(t => {
    console.log(`  "${t.name}" (GID=${t.gid}) — ${t.rows} filas, ${t.headers.filter(h=>h).length} columnas`)
  })

  console.log('\n[RECOMENDACIÓN DE PIPELINE]')
  console.log('Ver output completo arriba para determinar compatibilidad.')
  console.log('\nAnálisis completado.')
}

main().catch(err => {
  console.error('\nERROR:', err.message)
  if (err.stack) console.error(err.stack)
  process.exit(1)
})
