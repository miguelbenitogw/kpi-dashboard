/**
 * Analiza el Excel Madre de Alemania en Google Sheets.
 * Copia el patrón exacto de carga de env de inspect-zoho-vacancy.mjs.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// ─── Env loader (handles multi-line single-quoted values) ────────────────────
function loadEnv() {
  const env = {}
  for (const file of ['.env.production-local', '.env.local']) {
    try {
      const content = readFileSync(resolve(process.cwd(), file), 'utf-8')
      const lines = content.split(/\r?\n/)
      let i = 0
      while (i < lines.length) {
        const line = lines[i]
        const eqIdx = line.indexOf('=')
        if (eqIdx < 0 || line.trim().startsWith('#')) { i++; continue }
        const key = line.slice(0, eqIdx).trim()
        let val = line.slice(eqIdx + 1)

        // Multi-line single-quoted value: KEY='...'
        if (val.startsWith("'")) {
          let raw = val.slice(1)
          while (!raw.endsWith("'") && i + 1 < lines.length) {
            i++
            raw += '\n' + lines[i]
          }
          val = raw.endsWith("'") ? raw.slice(0, -1) : raw
        } else {
          // Strip surrounding double-quotes
          val = val.trim()
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
        }

        if (!env[key]) env[key] = val
        i++
      }
    } catch {}
  }
  return env
}

const env = loadEnv()
for (const [k, v] of Object.entries(env)) {
  if (!process.env[k]) process.env[k] = v
}

// ─── Google Sheets setup ──────────────────────────────────────────────────────
import { google } from 'googleapis'

function getCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON')
  // Handle literal \n in JSON private key
  const parsed = JSON.parse(raw)
  if (parsed.private_key) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n')
  }
  return parsed
}

async function getSheetsClient() {
  const creds = getCredentials()
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  return google.sheets({ version: 'v4', auth })
}

// ─── Analysis helpers ─────────────────────────────────────────────────────────

function inferType(values) {
  if (!values || values.length === 0) return 'vacío'

  let numCount = 0, dateCount = 0, textCount = 0, emptyCount = 0

  for (const v of values) {
    if (v === null || v === undefined || v === '') { emptyCount++; continue }
    const str = String(v).trim()
    if (str === '') { emptyCount++; continue }

    // Date patterns
    if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(str) ||
        /^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(str) ||
        /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(str)) {
      dateCount++
    } else if (/^-?\d+([.,]\d+)?$/.test(str)) {
      numCount++
    } else {
      textCount++
    }
  }

  const total = values.length - emptyCount
  if (total === 0) return 'vacío'
  if (dateCount / total > 0.7) return 'fecha'
  if (numCount / total > 0.7) return 'número'
  return 'texto'
}

function getUniqueValues(values, limit = 15) {
  const unique = [...new Set(
    values
      .filter(v => v !== null && v !== undefined && v !== '')
      .map(v => String(v).trim())
      .filter(v => v !== '')
  )]
  if (unique.length <= limit) return unique
  return [...unique.slice(0, limit), `... (+${unique.length - limit} más)`]
}

function divider(char = '─', len = 80) {
  return char.repeat(len)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const SHEET_ID = '1QlhUN2QKuPyf9mcrXQsffArijDRDNvgD-Y2JxQfo2eM'

async function main() {
  console.log('\n' + divider('═'))
  console.log('  ANÁLISIS COMPLETO — EXCEL MADRE DE ALEMANIA')
  console.log(divider('═'))
  console.log('Sheet ID:', SHEET_ID)
  console.log()

  const sheets = await getSheetsClient()

  // ── 1. Obtener metadata del spreadsheet (lista de tabs) ───────────────────
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: 'sheets.properties',
  })

  const tabs = meta.data.sheets.map(s => ({
    title: s.properties.title,
    sheetId: s.properties.sheetId,
    index: s.properties.index,
    rowCount: s.properties.gridProperties?.rowCount,
    colCount: s.properties.gridProperties?.columnCount,
  }))

  console.log(`TABS ENCONTRADOS: ${tabs.length}`)
  tabs.forEach((t, i) => {
    console.log(`  ${i + 1}. "${t.title}" (index ${t.index}, ~${t.rowCount} filas × ${t.colCount} cols)`)
  })
  console.log()

  // ── 2. Analizar cada tab ──────────────────────────────────────────────────
  for (const tab of tabs) {
    console.log()
    console.log(divider('═'))
    console.log(`  TAB: "${tab.title}"`)
    console.log(divider('═'))

    let data
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `'${tab.title}'`,
        valueRenderOption: 'FORMATTED_VALUE',
      })
      data = response.data.values || []
    } catch (e) {
      console.log(`  ERROR al leer tab: ${e.message}`)
      continue
    }

    if (data.length === 0) {
      console.log('  Tab VACÍO — sin datos')
      continue
    }

    // Headers (primera fila)
    const headers = data[0] || []
    const dataRows = data.slice(1)

    console.log(`\nFILAS DE DATOS: ${dataRows.length} (+ 1 header)`)
    console.log(`COLUMNAS: ${headers.length}`)

    console.log('\nHEADERS EXACTOS:')
    headers.forEach((h, i) => {
      const letter = columnLetter(i)
      console.log(`  ${letter} (col ${i + 1}): "${h}"`)
    })

    // Primeras 6 filas de datos
    const sampleRows = dataRows.slice(0, 6)
    console.log(`\nPRIMERAS ${sampleRows.length} FILAS DE DATOS:`)
    sampleRows.forEach((row, ri) => {
      console.log(`\n  Fila ${ri + 2}:`)
      headers.forEach((h, ci) => {
        const val = row[ci]
        if (val !== undefined && val !== null && val !== '') {
          console.log(`    [${h}]: ${JSON.stringify(val)}`)
        }
      })
    })

    // Análisis por columna
    console.log('\nANÁLISIS POR COLUMNA:')
    headers.forEach((h, ci) => {
      const colValues = dataRows.map(r => r[ci])
      const nonEmpty = colValues.filter(v => v !== undefined && v !== null && v !== '')
      const type = inferType(colValues)
      const fillRate = dataRows.length > 0 ? Math.round(nonEmpty.length / dataRows.length * 100) : 0

      // Decide si mostrar valores únicos
      const shouldShowUniques = (
        type === 'texto' ||
        h.toLowerCase().includes('status') ||
        h.toLowerCase().includes('estado') ||
        h.toLowerCase().includes('país') ||
        h.toLowerCase().includes('pais') ||
        h.toLowerCase().includes('country') ||
        h.toLowerCase().includes('type') ||
        h.toLowerCase().includes('tipo') ||
        nonEmpty.length > 0 && new Set(nonEmpty.map(String)).size <= 30
      )

      console.log(`\n  "${h}":`)
      console.log(`    Tipo: ${type} | Relleno: ${fillRate}% (${nonEmpty.length}/${dataRows.length})`)

      if (shouldShowUniques && nonEmpty.length > 0) {
        const uniques = getUniqueValues(colValues)
        if (uniques.length <= 20) {
          console.log(`    Valores únicos (${uniques.length}): ${uniques.map(v => JSON.stringify(v)).join(', ')}`)
        }
      }

      if (nonEmpty.length > 0 && type === 'número') {
        const nums = nonEmpty.map(Number).filter(n => !isNaN(n))
        if (nums.length > 0) {
          const min = Math.min(...nums)
          const max = Math.max(...nums)
          console.log(`    Rango numérico: ${min} – ${max}`)
        }
      }
    })

    // Columnas que parecen ser ID / join key
    console.log('\nPOSIBLES COLUMNAS DE JOIN KEY:')
    const idCandidates = headers.filter(h => {
      const hl = h.toLowerCase()
      return hl.includes('id') || hl.includes('zoho') || hl.includes('número') ||
             hl.includes('numero') || hl.includes('num') || hl.includes('ref') ||
             hl.includes('candidat') || hl.includes('code') || hl.includes('código')
    })
    if (idCandidates.length > 0) {
      idCandidates.forEach(h => {
        const ci = headers.indexOf(h)
        const sample = dataRows.slice(0, 5).map(r => r[ci]).filter(Boolean)
        console.log(`  "${h}": muestra = ${sample.map(v => JSON.stringify(v)).join(', ')}`)
      })
    } else {
      console.log('  (ninguna detectada automáticamente)')
    }
  }

  console.log()
  console.log(divider('═'))
  console.log('  ANÁLISIS COMPLETO')
  console.log(divider('═'))
}

function columnLetter(i) {
  let letter = ''
  i++
  while (i > 0) {
    const rem = (i - 1) % 26
    letter = String.fromCharCode(65 + rem) + letter
    i = Math.floor((i - 1) / 26)
  }
  return letter
}

main().catch(e => {
  console.error('Fatal:', e instanceof Error ? e.stack : e)
  process.exit(1)
})
