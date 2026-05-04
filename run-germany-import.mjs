/**
 * run-germany-import.mjs
 *
 * Importa los 3 tabs del Excel Madre de Alemania directamente a Supabase.
 * Tabs: Base Datos, Exámenes, Pagos - Proyectos Infantil
 *
 * Usage:
 *   node run-germany-import.mjs [--tab=base|examenes|pagos|all]
 *
 * Sin argumento: importa los 3 tabs.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

// ─── Env loader (multi-line single-quoted values) ────────────────────────────
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
        if (val.startsWith("'")) {
          let raw = val.slice(1)
          while (!raw.endsWith("'") && i + 1 < lines.length) {
            i++
            raw += '\n' + lines[i]
          }
          val = raw.endsWith("'") ? raw.slice(0, -1) : raw
        } else {
          val = val.trim()
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
        }
        val = val.replace(/\\n$/, '').trim()
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

// ─── Supabase ─────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseKey) { console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const supabase = createClient(supabaseUrl, supabaseKey)

// ─── Google Sheets client ────────────────────────────────────────────────────
function getSheetsClient() {
  let raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set')
  if (raw.startsWith("'")) raw = raw.replace(/^'+|'+$/g, '').trim()
  let credentials
  try {
    const p = JSON.parse(raw)
    credentials = typeof p === 'string' ? JSON.parse(p) : p
  } catch {
    const normalized = raw.replace(/\\\r\n/g, '\\n').replace(/\\\n/g, '\\n').replace(/\\"/g, '"')
    credentials = JSON.parse(normalized)
  }
  if (credentials.private_key) credentials.private_key = credentials.private_key.replace(/\\n/g, '\n')
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] })
  return google.sheets({ version: 'v4', auth })
}

async function readSheetByName(spreadsheetId, sheetName, headerRow = 1) {
  const sheets = getSheetsClient()
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: sheetName })
  const allRows = res.data.values ?? []
  if (allRows.length < headerRow) return []
  const headers = (allRows[headerRow - 1] ?? []).map(h => String(h ?? '').trim())
  return allRows.slice(headerRow).map(row => {
    const obj = {}
    headers.forEach((h, i) => { obj[h || `col_${i}`] = row[i] != null ? String(row[i]).trim() : null })
    return obj
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const SHEET_ID = '1QlhUN2QKuPyf9mcrXQsffArijDRDNvgD-Y2JxQfo2eM'

function normalizeHeader(h) {
  return h.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function buildHeaderMap(headers, columnMap) {
  const result = new Map()
  for (const rawH of headers) {
    const norm = normalizeHeader(rawH)
    for (const [canonical, variants] of Object.entries(columnMap)) {
      if (variants.some(v => norm === v)) { result.set(rawH, canonical); break }
    }
    if (result.has(rawH)) continue
    for (const [canonical, variants] of Object.entries(columnMap)) {
      if (variants.some(v => v.length >= 4 && norm.includes(v))) { result.set(rawH, canonical); break }
    }
  }
  return result
}

function extractMapped(row, headerMap) {
  const mapped = {}
  for (const [rawH, canonical] of headerMap) {
    const v = row[rawH]?.trim()
    if (v) mapped[canonical] = v
  }
  return mapped
}

function parseDate(v) {
  if (!v || !v.trim()) return null
  const t = v.trim()
  const iso = t.match(/^\d{4}-\d{2}-\d{2}/)
  if (iso) return iso[0]
  const eu = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
  if (eu) return `${eu[3]}-${eu[2].padStart(2,'0')}-${eu[1].padStart(2,'0')}`
  return null
}

function parseNumber(v) {
  if (!v || !v.trim()) return null
  const n = Number(v.trim().replace(/%/g,'').replace(/\s/g,'').replace(',','.'))
  return isNaN(n) ? null : n
}

function parseInteger(v) {
  const n = parseNumber(v)
  return n === null ? null : Math.round(n)
}

function extractPromoNumber(s) {
  if (!s) return null
  const m = s.match(/\d+/)
  return m ? parseInt(m[0], 10) : null
}

// ─── Base Datos ───────────────────────────────────────────────────────────────
const BASE_DATOS_MAP = {
  excel_id: ['id'],
  nombre: ['nombre y apellidos', 'nombre completo', 'nombre'],
  promocion: ['promocion', 'promoción'],
  coordinador: ['coordinador', 'coordinadora'],
  estado: ['estado'],
  tipo_perfil: ['tipo de perfil', 'tipo perfil', 'perfil'],
  quincena: ['quincena'],
  mes_llegada: ['mes y ano de llegada', 'mes y ano llegada', 'mes de llegada', 'mes llegada'],
  cliente: ['cliente'],
  ciudad_kita: ['ciudad kita', 'ciudad', 'kita'],
  fp: ['fp'],
  universidad_pedagogia: ['universidad pedagogia', 'u. pedagogia', 'pedagogia'],
  universidad_infantil: ['universidad infantil', 'u. infantil', 'infantil'],
  universidad_fisio: ['universidad fisio', 'u. fisioterapia', 'fisio', 'fisioterapia'],
  universidad_ingenieria: ['universidad ingenieria', 'u. ingenieria', 'ingenieria'],
  otros_estudios: ['otros estudios', 'otros'],
}

async function importBaseDatos() {
  console.log('\n[Base Datos] Leyendo tab...')
  const rows = await readSheetByName(SHEET_ID, 'Base Datos')
  if (!rows.length) { console.error('[Base Datos] Sin datos'); return { upserted: 0, skipped: 0, errors: ['Sin datos'] } }

  const headers = Object.keys(rows[0])
  const headerMap = buildHeaderMap(headers, BASE_DATOS_MAP)

  console.log(`[Base Datos] Headers detectados: ${headers.slice(0,8).join(' | ')}...`)
  console.log(`[Base Datos] Mappings: ${[...headerMap.entries()].map(([h,c])=>`${h}→${c}`).join(', ')}`)
  console.log(`[Base Datos] ${rows.length} filas a procesar`)

  let upserted = 0, skipped = 0
  const errors = []

  for (let i = 0; i < rows.length; i++) {
    const mapped = extractMapped(rows[i], headerMap)
    const rawId = mapped['excel_id']
    if (!rawId) { skipped++; continue }
    const excelId = parseInteger(rawId)
    if (excelId === null) { skipped++; continue }
    const nombre = mapped['nombre']
    if (!nombre) { skipped++; continue }

    const rawPromo = mapped['promocion'] ?? null
    const payload = {
      excel_id: excelId,
      zoho_candidate_id: rawId,
      nombre,
      promocion: rawPromo,
      promo_numero: extractPromoNumber(rawPromo),
      coordinador: mapped['coordinador'] ?? null,
      estado: mapped['estado'] ?? null,
      tipo_perfil: mapped['tipo_perfil'] ?? null,
      quincena: mapped['quincena'] ?? null,
      mes_llegada: mapped['mes_llegada'] ?? null,
      cliente: mapped['cliente'] ?? null,
      ciudad_kita: mapped['ciudad_kita'] ?? null,
      fp: mapped['fp'] ?? null,
      universidad_pedagogia: mapped['universidad_pedagogia'] ?? null,
      universidad_infantil: mapped['universidad_infantil'] ?? null,
      universidad_fisio: mapped['universidad_fisio'] ?? null,
      universidad_ingenieria: mapped['universidad_ingenieria'] ?? null,
      otros_estudios: mapped['otros_estudios'] ?? null,
      sheet_id: SHEET_ID,
      synced_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('germany_candidates_kpi').upsert(payload, { onConflict: 'excel_id,sheet_id' })
    if (error) {
      errors.push(`Row ${i+2} (ID ${excelId}): ${error.message}`)
      if (errors.length <= 3) console.error(`  [error] ${errors[errors.length-1]}`)
    } else {
      upserted++
      if (upserted <= 3 || upserted % 100 === 0) console.log(`  [ok] ${excelId} → ${nombre} (tipo_perfil: ${payload.tipo_perfil ?? '—'})`)
    }
  }

  console.log(`[Base Datos] Done: upserted=${upserted}, skipped=${skipped}, errors=${errors.length}`)
  return { upserted, skipped, errors }
}

// ─── Exámenes ─────────────────────────────────────────────────────────────────
// NOTE: promo_texto is handled via col_0 (empty header = first column = promo name)
// Do NOT add 'promo' as a variant — it substring-matches 'personas totales de la promo'
const EXAMENES_MAP = {
  num_total: ['personas totales de la promo', 'personas totales', 'total', 'num total', 'n total', 'no total'],
  num_in_training: ['in training', 'candidatos in training'],
  num_to_place: ['candidatos por colocar', 'por colocar', 'no hired'],
  pct_colocacion: ['% colocacion', '% colocación', 'colocacion', 'colocación'],
  profesor: ['profesor', 'profesora'],
  fecha_fin_formacion: ['fecha fin formacion', 'fecha fin de formacion', 'fin de formacion', 'fin formacion'],
  b1_fecha: ['b1 fecha', 'fecha b1', 'fecha b1'],
  b1_aprobados_1a: ['b1 aprobados 1a', 'aprobados b1 1a', 'b1 1a'],
  b1_pct_aprobados: ['% b1', '% aprobados b1', 'pct b1'],
  b1_aprobados_2a: ['b1 aprobados 2a', 'aprobados b1 2a', 'b1 2a'],
  b2_fecha: ['b2 fecha', 'fecha b2'],
  b2_aprobados_1a: ['b2 aprobados 1a', 'aprobados b2 1a', 'b2 1a'],
  b2_pct_aprobados: ['% b2', '% aprobados b2', 'pct b2'],
  estado_iqz: ['iqz', 'iq zukunft'],
  estado_berlin: ['berlin', 'berlín'],
  estado_standby: ['stand by', 'standby'],
  estado_assigned: ['assigned'],
  estado_hired: ['hired'],
  estado_fuera_red: ['fuera red', 'fuera de la red', 'out of network'],
  estado_offer_withdrawn: ['offer withdrawn'],
}

async function importExamenes() {
  console.log('\n[Exámenes] Leyendo tab...')
  let rows
  try { rows = await readSheetByName(SHEET_ID, 'Exámenes') }
  catch {
    try { rows = await readSheetByName(SHEET_ID, 'Examenes') }
    catch (e) { console.error('[Exámenes] No se puede leer el tab:', e.message); return { upserted: 0, skipped: 0, errors: [e.message] } }
  }

  if (!rows.length) { console.error('[Exámenes] Sin datos'); return { upserted: 0, skipped: 0, errors: ['Sin datos'] } }

  const headers = Object.keys(rows[0])
  const headerMap = buildHeaderMap(headers, EXAMENES_MAP)
  // The first column has no header (merged cell = promo name) → col_0
  if (headers.includes('col_0')) headerMap.set('col_0', 'promo_texto')
  console.log(`[Exámenes] Headers: ${headers.slice(0,10).join(' | ')}`)
  console.log(`[Exámenes] Mappings: ${[...headerMap.entries()].map(([h,c])=>`${h}→${c}`).join(', ')}`)
  console.log(`[Exámenes] ${rows.length} filas`)

  let upserted = 0, skipped = 0
  const errors = []

  for (let i = 0; i < rows.length; i++) {
    const mapped = extractMapped(rows[i], headerMap)
    const rawPromo = mapped['promo_texto']
    if (!rawPromo) { skipped++; continue }
    const lower = rawPromo.toLowerCase()
    if (lower === 'promo' || lower === 'promocion' || lower === 'promoción') { skipped++; continue }
    const promoNumero = extractPromoNumber(rawPromo)
    if (promoNumero === null) { skipped++; continue }

    const payload = {
      promo_texto: rawPromo,
      promo_numero: promoNumero,
      num_total: parseInteger(mapped['num_total']),
      num_in_training: parseInteger(mapped['num_in_training']),
      num_to_place: parseInteger(mapped['num_to_place']),
      pct_colocacion: parseNumber(mapped['pct_colocacion']),
      profesor: mapped['profesor'] ?? null,
      fecha_fin_formacion: parseDate(mapped['fecha_fin_formacion']),
      b1_fecha: parseDate(mapped['b1_fecha']),
      b1_aprobados_1a: parseInteger(mapped['b1_aprobados_1a']),
      b1_pct_aprobados: parseNumber(mapped['b1_pct_aprobados']),
      b1_aprobados_2a: parseInteger(mapped['b1_aprobados_2a']),
      b2_fecha: parseDate(mapped['b2_fecha']),
      b2_aprobados_1a: parseInteger(mapped['b2_aprobados_1a']),
      b2_pct_aprobados: parseNumber(mapped['b2_pct_aprobados']),
      estado_iqz: parseInteger(mapped['estado_iqz']),
      estado_berlin: parseInteger(mapped['estado_berlin']),
      estado_standby: parseInteger(mapped['estado_standby']),
      estado_to_place: parseInteger(mapped['num_to_place']),
      estado_assigned: parseInteger(mapped['estado_assigned']),
      estado_hired: parseInteger(mapped['estado_hired']),
      estado_fuera_red: parseInteger(mapped['estado_fuera_red']),
      estado_offer_withdrawn: parseInteger(mapped['estado_offer_withdrawn']),
      sheet_id: SHEET_ID,
      synced_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('germany_exams_kpi').upsert(payload, { onConflict: 'promo_numero,sheet_id' })
    if (error) { errors.push(`Row ${i+2} (${rawPromo}): ${error.message}`); console.error(`  [error] ${errors[errors.length-1]}`) }
    else { upserted++; console.log(`  [ok] Promo ${promoNumero} → total=${payload.num_total}, hired=${payload.estado_hired}`) }
  }

  console.log(`[Exámenes] Done: upserted=${upserted}, skipped=${skipped}, errors=${errors.length}`)
  return { upserted, skipped, errors }
}

// ─── Pagos ────────────────────────────────────────────────────────────────────
// IMPORTANT: más específico va ANTES — buildHeaderMap ittera en orden de inserción
// y para pass-2 (substring) gana el primero que matchea
const PAGOS_MAP = {
  nombre: ['nombre y apellidos', 'nombre completo', 'nombre'],
  zoho_candidate_id: ['id', 'zoho id', 'zoho candidate id'],
  promo_numero_raw: ['no promocion', 'no promo', 'num promo', 'nº promocion', 'promocion', 'promoción'],
  profesion: ['profesion', 'profesión'],
  empresa: ['empresa'],
  estado: ['estado'],
  modalidad: ['modalidad'],
  // comentarios antes que coordinador para evitar substring collision
  comentarios_coordinadores: ['comentarios coordinadores', 'comentarios de coordinadores', 'comentarios coord', 'comentarios de coord'],
  comentarios_contabilidad: ['comentarios contabilidad', 'comentarios de contabilidad'],
  coordinador: ['coordinador/a', 'coordinadora', 'coordinador'],
  // fecha inicio formacion: usar 'del inicio de la formacion' para evitar match con 'fecha inicio de pago'
  fecha_inicio_formacion: ['fecha del inicio de la formacion', 'inicio de la formacion', 'fecha inicio formacion', 'fecha inicio de formacion'],
  fecha_abandono_formacion: ['fecha abandono', 'abandono formacion', 'fecha de abandono'],
  fecha_inicio_contrato: ['fecha de inicio contrato', 'fecha inicio contrato', 'inicio contrato laborar', 'contrato laborar'],
  opcion_financiacion: ['opcion de financiacion', 'opcion financiacion', 'opción de financiación', 'financiacion'],
  // fecha_inicio_pago: usar 'de pago del alumno' para diferenciar de fecha_inicio_formacion
  fecha_inicio_pago: ['de pago del alumno', 'fecha inicio de pago', 'inicio pago del alumno', 'fecha inicio pago', 'inicio pago'],
  importe_formacion: ['importe de formacion', 'importe formacion'],
  importe_piso_gw: ['importe piso gw', 'piso gw'],
  importe_total: ['importe total'],
  importe_pendiente: ['importe pendiente de pago', 'importe pendiente', 'pendiente de pago', 'pendiente'],
  enviar_abogado: ['enviar abogado'],
  correo: ['email', 'correo', 'e-mail'],
}

async function importPagos() {
  console.log('\n[Pagos] Leyendo tab...')
  let rows
  try { rows = await readSheetByName(SHEET_ID, 'Pagos - Proyectos Infantil') }
  catch (e) { console.error('[Pagos] Error leyendo tab:', e.message); return { upserted: 0, skipped: 0, errors: [e.message] } }

  if (!rows.length) { console.error('[Pagos] Sin datos'); return { upserted: 0, skipped: 0, errors: ['Sin datos'] } }

  const headers = Object.keys(rows[0])
  const headerMap = buildHeaderMap(headers, PAGOS_MAP)
  console.log(`[Pagos] Headers: ${headers.slice(0,10).join(' | ')}`)
  console.log(`[Pagos] Mappings: ${[...headerMap.entries()].map(([h,c])=>`${h}→${c}`).join(', ')}`)
  console.log(`[Pagos] ${rows.length} filas`)

  // Detect cuota columns
  const cuotaSimple = new Map()
  const cuotaDetail = new Map()
  for (const h of headers) {
    const n = normalizeHeader(h)
    const sm = n.match(/^cuota\s+(\d+)$/)
    if (sm) { cuotaSimple.set(parseInt(sm[1], 10), h); continue }
    const dm = n.match(/^cuota\s+(\d+)\s+(importe|fecha|pagado)/)
    if (dm) {
      const num = parseInt(dm[1], 10)
      if (!cuotaDetail.has(num)) cuotaDetail.set(num, {})
      cuotaDetail.get(num)[dm[2]] = h
    }
  }
  if (cuotaSimple.size || cuotaDetail.size) {
    console.log(`[Pagos] Cuotas detectadas: ${cuotaSimple.size} simples, ${cuotaDetail.size} detalladas`)
  }

  let upserted = 0, skipped = 0
  const errors = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const mapped = extractMapped(row, headerMap)
    const nombre = mapped['nombre']
    if (!nombre) { skipped++; continue }
    const rawPromo = mapped['promo_numero_raw']
    const promoNumero = extractPromoNumber(rawPromo)
    if (promoNumero === null) { skipped++; continue }

    // Build cuotas JSONB
    const cuotas = []
    for (const [num, detFields] of cuotaDetail) {
      const importe = parseNumber(detFields['importe'] ? row[detFields['importe']] : null)
      const fecha = parseDate(detFields['fecha'] ? row[detFields['fecha']] : null)
      const pagado = detFields['pagado'] ? (row[detFields['pagado']] ?? null) : null
      if (importe !== null || fecha !== null || pagado !== null) cuotas.push({ numero: num, importe, fecha, pagado })
    }
    for (const [num, h] of cuotaSimple) {
      if (!cuotaDetail.has(num)) {
        const v = row[h]
        const importe = parseNumber(v)
        if (importe !== null) cuotas.push({ numero: num, importe, fecha: null, pagado: null })
      }
    }
    cuotas.sort((a, b) => a.numero - b.numero)

    const payload = {
      nombre,
      zoho_candidate_id: mapped['zoho_candidate_id'] ?? null,
      promo_numero: promoNumero,
      profesion: mapped['profesion'] ?? null,
      empresa: mapped['empresa'] ?? null,
      estado: mapped['estado'] ?? null,
      modalidad: mapped['modalidad'] ?? null,
      coordinador: mapped['coordinador'] ?? null,
      fecha_inicio_formacion: parseDate(mapped['fecha_inicio_formacion']),
      fecha_abandono_formacion: parseDate(mapped['fecha_abandono_formacion']),
      fecha_inicio_contrato: parseDate(mapped['fecha_inicio_contrato']),
      opcion_financiacion: mapped['opcion_financiacion'] ?? null,
      fecha_inicio_pago: parseDate(mapped['fecha_inicio_pago']),
      importe_formacion: parseNumber(mapped['importe_formacion']),
      importe_piso_gw: parseNumber(mapped['importe_piso_gw']),
      importe_total: parseNumber(mapped['importe_total']),
      cuotas: cuotas.length ? cuotas : null,
      importe_pendiente: parseNumber(mapped['importe_pendiente']),
      enviar_abogado: mapped['enviar_abogado'] ?? null,
      comentarios_coordinadores: mapped['comentarios_coordinadores'] ?? null,
      comentarios_contabilidad: mapped['comentarios_contabilidad'] ?? null,
      correo: mapped['correo'] ?? null,
      sheet_id: SHEET_ID,
      synced_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('germany_payments_kpi').upsert(payload, { onConflict: 'nombre,promo_numero,sheet_id' })
    if (error) { errors.push(`Row ${i+2} (${nombre}): ${error.message}`); if (errors.length <= 3) console.error(`  [error] ${errors[errors.length-1]}`) }
    else { upserted++; if (upserted <= 3 || upserted % 100 === 0) console.log(`  [ok] ${nombre} (promo ${promoNumero}, total ${payload.importe_total ?? '—'})`) }
  }

  console.log(`[Pagos] Done: upserted=${upserted}, skipped=${skipped}, errors=${errors.length}`)
  return { upserted, skipped, errors }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const arg = process.argv[2] ?? '--tab=all'
  const tab = arg.replace('--tab=', '')

  console.log(`\n╔══════════════════════════════════════════════╗`)
  console.log(`║  Germany Excel Import — ${new Date().toISOString().slice(0,16)}  ║`)
  console.log(`╚══════════════════════════════════════════════╝`)
  console.log(`Sheet ID: ${SHEET_ID}`)
  console.log(`Tabs a importar: ${tab}`)

  const results = {}

  if (tab === 'all' || tab === 'base') results.baseDatos = await importBaseDatos()
  if (tab === 'all' || tab === 'examenes') results.examenes = await importExamenes()
  if (tab === 'all' || tab === 'pagos') results.pagos = await importPagos()

  console.log('\n╔══════ RESUMEN FINAL ══════╗')
  for (const [name, r] of Object.entries(results)) {
    console.log(`  ${name}: upserted=${r.upserted}, skipped=${r.skipped}, errors=${r.errors.length}`)
    if (r.errors.length) r.errors.slice(0,5).forEach(e => console.error(`    ⚠ ${e}`))
  }
  console.log('╚═══════════════════════════╝\n')
}

main().catch(e => { console.error('Fatal:', e instanceof Error ? e.stack : e); process.exit(1) })
