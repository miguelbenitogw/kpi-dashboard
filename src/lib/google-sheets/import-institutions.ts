/**
 * Institutions import pipeline.
 *
 * Fetches data from the "BBDD Instituciones" Google Sheet and syncs it into Supabase.
 * The spreadsheet has 7 tabs — one per profession — each with a 3-row header:
 *   Row 1: project title (ignored)
 *   Row 2: merged group headers (ignored)
 *   Row 3: individual column names (also ignored — we map by column index)
 *   Row 4+: data rows (one row = one university/faculty)
 *
 * Three column families exist depending on the profession tab:
 *   ENF  — ENFERMERÍA (no col J, 5 contacts, up to col AN)
 *   B    — FISIOTERAPIA, DENTISTAS, ÓPTICA-OPTOMETRÍA, TERAPIA OCUPACIONAL (col J = ¿MENSAJE PROGRAMADO?, 4 contacts, up to col AM)
 *   A    — EDUCACIÓN INFANTIL, VETERINARIA (extra cols F+G for last event, col J = COMENTARIOS, 5 contacts, up to col AQ)
 */

import { google } from 'googleapis'
import { supabaseAdmin } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Service account client (copied from client.ts)
// ---------------------------------------------------------------------------

function parseServiceAccountJson(raw: string): Record<string, string> {
  if (raw.startsWith("'")) raw = raw.replace(/^'+|'+$/g, '').trim()

  let parsed: Record<string, string> | null = null

  try {
    const p = JSON.parse(raw)
    if (p && typeof p === 'object') {
      parsed = p as Record<string, string>
    } else if (typeof p === 'string') {
      parsed = JSON.parse(p) as Record<string, string>
    }
  } catch {
    // Fall through — try backslash-escaped form below.
  }

  if (!parsed) {
    const normalized = raw
      .replace(/\\\r\n/g, '\\n')
      .replace(/\\\n/g, '\\n')
      .replace(/\\"/g, '"')
    parsed = JSON.parse(normalized) as Record<string, string>
  }

  if (parsed.private_key && typeof parsed.private_key === 'string') {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n')
  }

  return parsed
}

function getSheetsClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var is not set')

  const credentials = parseServiceAccountJson(raw)

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  return google.sheets({ version: 'v4', auth })
}

// ---------------------------------------------------------------------------
// Tab configurations
// ---------------------------------------------------------------------------

type Family = 'ENF' | 'A' | 'B' | 'VET'

interface TabConfig {
  gid: number
  profesion: string
  family: Family
}

const TABS: TabConfig[] = [
  { gid: 0,          profesion: 'ENFERMERÍA',          family: 'ENF' },
  { gid: 1305711796, profesion: 'FISIOTERAPIA',         family: 'B'   },
  { gid: 799493312,  profesion: 'EDUCACIÓN INFANTIL',   family: 'A'   },
  { gid: 1245976136, profesion: 'VETERINARIA',          family: 'VET' },
  { gid: 170511999,  profesion: 'DENTISTAS',            family: 'B'   },
  { gid: 731218405,  profesion: 'ÓPTICA-OPTOMETRÍA',    family: 'B'   },
  { gid: 1547393928, profesion: 'TERAPIA OCUPACIONAL',  family: 'B'   },
]

// ---------------------------------------------------------------------------
// Column index maps (0-based)
// ---------------------------------------------------------------------------

/**
 * Field offsets for each family.
 *
 * FAMILY ENF (ENFERMERÍA):
 *   A=0  B=1  C=2  D=3  E=4  F=5(TICKER estado)  G=6(ESTADO CHARLA)
 *   H=7(DIARIO)  I=8(MES CONTACTAR)
 *   J=9(1.NOMBRE Y CARGO)  K=10(CONTACTO)  L=11(FEEDBACK)
 *   M=12(2.NOMBRE Y CARGO)  N=13  O=14  P=15  Q=16  R=17  S=18  T=19
 *   U=20(EMAIL)  V=21(TEL)
 *   W=22(TICKER agenda)  X=23(PERSONA AGENDA)  Y=24(FECHA CHARLA)  Z=25(HORA)
 *   AA=26(LUGAR)  AB=27(TIPO EVENTO)  AC=28(COMPAÑERO)  AD=29(DURACIÓN)
 *   AE=30(Nº ASISTENTES)  AF=31(Nº INTERESADOS)  AG=32(GLOBAL WORKER)  AH=33(RECURSOS)
 *   AI=34(CIUDAD)  AJ=35(UBICACIÓN)  AK=36(TIPO)  AL=37(WEB)  AM=38(CORREOS PROF)  AN=39(PLAZAS)
 *
 * FAMILY B (adds J=¿MENSAJE PROGRAMADO?, shifts contacts +1):
 *   A=0  B=1  C=2  D=3  E=4  F=5(TICKER)  G=6(ESTADO)  H=7(DIARIO)  I=8(MES)  J=9(MENSAJE)
 *   K=10(1.NOMBRE)  L=11(CONTACTO)  M=12(FEEDBACK)
 *   N=13(2.NOMBRE)  O=14  P=15(3.NOMBRE)  Q=16  R=17(4.NOMBRE)  S=18
 *   T=19(EMAIL)  U=20(TEL)
 *   V=21(TICKER agenda)  W=22(PERSONA)  X=23(FECHA)  Y=24(HORA)  Z=25(LUGAR)
 *   AA=26(TIPO EVENTO)  AB=27(COMPAÑERO)  AC=28(DURACIÓN)
 *   AD=29(ASISTENTES)  AE=30(INTERESADOS)  AF=31(GLOBAL WORKER)  AG=32(RECURSOS)
 *   AH=33(CIUDAD)  AI=34(UBICACIÓN)  AJ=35(TIPO)  AK=36(WEB)  AL=37(CORREOS)  AM=38(PLAZAS)
 *
 * FAMILY A (EDUCACIÓN INFANTIL — adds F=TIPO EVENTO ÚLTIMA, G=FECHA ÚLTIMA, 5 contacts, shifts all +2):
 *   A=0  B=1  C=2  D=3  E=4  F=5(TIPO EVENTO ÚLTIMA)  G=6(FECHA ÚLTIMA)
 *   H=7(TICKER)  I=8(ESTADO)  J=9(COMENTARIOS)  K=10(MES)  L=11(MENSAJE)
 *   M=12(1.NOMBRE)  N=13(CONTACTO)  O=14(FEEDBACK)
 *   P=15(2.NOMBRE)  Q=16  R=17(3.NOMBRE)  S=18  T=19(4.NOMBRE)  U=20  V=21(5.NOMBRE)  W=22
 *   X=23(EMAIL)  Y=24(TEL)
 *   Z=25(TICKER agenda)  AA=26(PERSONA)  AB=27(FECHA)  AC=28(HORA)  AD=29(LUGAR)
 *   AE=30(TIPO EVENTO)  AF=31(COMPAÑERO)  AG=32(DURACIÓN)
 *   AH=33(ASISTENTES)  AI=34(INTERESADOS)  AJ=35(GLOBAL WORKER)  AK=36(RECURSOS)
 *   AL=37(CIUDAD)  AM=38(UBICACIÓN)  AN=39(TIPO)  AO=40(WEB)  AP=41(CORREOS)  AQ=42(PLAZAS)
 *
 * FAMILY VET (VETERINARIA — same header prefix as A but only 4 contacts, so agenda block starts 2 cols earlier):
 *   A=0  B=1  C=2  D=3  E=4  F=5(TIPO EVENTO ÚLTIMA)  G=6(FECHA ÚLTIMA)
 *   H=7(TICKER)  I=8(ESTADO)  J=9(COMENTARIOS)  K=10(MES)  L=11(MENSAJE)
 *   M=12(1.NOMBRE)  N=13(CONTACTO)  O=14(FEEDBACK)
 *   P=15(2.NOMBRE)  Q=16  R=17(3.NOMBRE)  S=18  T=19(4.NOMBRE)  U=20
 *   V=21(EMAIL)  W=22(TEL)
 *   X=23(TICKER agenda)  Y=24(PERSONA)  Z=25(FECHA)  AA=26(HORA)  AB=27(LUGAR)
 *   AC=28(TIPO EVENTO)  AD=29(COMPAÑERO)  AE=30(DURACIÓN)
 *   AF=31(ASISTENTES)  AG=32(INTERESADOS)  AH=33(GLOBAL WORKER)  AI=34(RECURSOS)
 *   AJ=35(CIUDAD)  AK=36(UBICACIÓN)  AL=37(TIPO)  AM=38(WEB)  AN=39(CORREOS)  AO=40(PLAZAS)
 */

interface FieldOffsets {
  comunidad: number
  universidad: number
  num_visitas: number
  años_visitas_ponentes: number
  alumnos_registrados_zoho: number
  tipo_evento_ultima_charla: number | null  // only family A
  fecha_ultima_charla: number | null         // only family A
  ticker_estado: number
  estado_charla: number
  comentarios: number | null                 // only family A
  mes_contactar_de_nuevo: number
  mensaje_programado: number | null          // families A and B
  email_facultad: number
  telefono_facultad: number
  ticker_agenda: number
  persona_contacto_agenda: number
  fecha_charla_visita: number
  hora_charla: number
  lugar_concreto: number
  tipo_evento: number
  compañero_asiste: number
  duracion_charla: number
  num_asistentes_charla: number
  num_interesados_firmas: number
  global_worker_asiste: number
  recursos_entregados: number
  ciudad: number
  ubicacion: number
  tipo_centro: number
  web: number
  correos_profesores: number
  plazas_anio: number
}

const COL: Record<Family, FieldOffsets> = {
  ENF: {
    comunidad: 0,
    universidad: 1,
    num_visitas: 2,
    años_visitas_ponentes: 3,
    alumnos_registrados_zoho: 4,
    tipo_evento_ultima_charla: null,
    fecha_ultima_charla: null,
    ticker_estado: 5,
    estado_charla: 6,
    comentarios: null,
    mes_contactar_de_nuevo: 8,
    mensaje_programado: null,
    email_facultad: 20,
    telefono_facultad: 21,
    ticker_agenda: 22,
    persona_contacto_agenda: 23,
    fecha_charla_visita: 24,
    hora_charla: 25,
    lugar_concreto: 26,
    tipo_evento: 27,
    compañero_asiste: 28,
    duracion_charla: 29,
    num_asistentes_charla: 30,
    num_interesados_firmas: 31,
    global_worker_asiste: 32,
    recursos_entregados: 33,
    ciudad: 34,
    ubicacion: 35,
    tipo_centro: 36,
    web: 37,
    correos_profesores: 38,
    plazas_anio: 39,
  },
  B: {
    comunidad: 0,
    universidad: 1,
    num_visitas: 2,
    años_visitas_ponentes: 3,
    alumnos_registrados_zoho: 4,
    tipo_evento_ultima_charla: null,
    fecha_ultima_charla: null,
    ticker_estado: 5,
    estado_charla: 6,
    comentarios: null,
    mes_contactar_de_nuevo: 8,
    mensaje_programado: 9,
    email_facultad: 19,
    telefono_facultad: 20,
    ticker_agenda: 21,
    persona_contacto_agenda: 22,
    fecha_charla_visita: 23,
    hora_charla: 24,
    lugar_concreto: 25,
    tipo_evento: 26,
    compañero_asiste: 27,
    duracion_charla: 28,
    num_asistentes_charla: 29,
    num_interesados_firmas: 30,
    global_worker_asiste: 31,
    recursos_entregados: 32,
    ciudad: 33,
    ubicacion: 34,
    tipo_centro: 35,
    web: 36,
    correos_profesores: 37,
    plazas_anio: 38,
  },
  A: {
    comunidad: 0,
    universidad: 1,
    num_visitas: 2,
    años_visitas_ponentes: 3,
    alumnos_registrados_zoho: 4,
    tipo_evento_ultima_charla: 5,
    fecha_ultima_charla: 6,
    ticker_estado: 7,
    estado_charla: 8,
    comentarios: 9,
    mes_contactar_de_nuevo: 10,
    mensaje_programado: 11,
    email_facultad: 23,
    telefono_facultad: 24,
    ticker_agenda: 25,
    persona_contacto_agenda: 26,
    fecha_charla_visita: 27,
    hora_charla: 28,
    lugar_concreto: 29,
    tipo_evento: 30,
    compañero_asiste: 31,
    duracion_charla: 32,
    num_asistentes_charla: 33,
    num_interesados_firmas: 34,
    global_worker_asiste: 35,
    recursos_entregados: 36,
    ciudad: 37,
    ubicacion: 38,
    tipo_centro: 39,
    web: 40,
    correos_profesores: 41,
    plazas_anio: 42,
  },
  // VETERINARIA: same header prefix as A (F+G = last-event cols, COMENTARIOS at J)
  // but only 4 contacts (M-U, indices 12-20), so email/tel and all agenda columns
  // start 2 positions earlier than family A.
  VET: {
    comunidad: 0,
    universidad: 1,
    num_visitas: 2,
    años_visitas_ponentes: 3,
    alumnos_registrados_zoho: 4,
    tipo_evento_ultima_charla: 5,
    fecha_ultima_charla: 6,
    ticker_estado: 7,
    estado_charla: 8,
    comentarios: 9,
    mes_contactar_de_nuevo: 10,
    mensaje_programado: 11,
    email_facultad: 21,
    telefono_facultad: 22,
    ticker_agenda: 23,
    persona_contacto_agenda: 24,
    fecha_charla_visita: 25,
    hora_charla: 26,
    lugar_concreto: 27,
    tipo_evento: 28,
    compañero_asiste: 29,
    duracion_charla: 30,
    num_asistentes_charla: 31,
    num_interesados_firmas: 32,
    global_worker_asiste: 33,
    recursos_entregados: 34,
    ciudad: 35,
    ubicacion: 36,
    tipo_centro: 37,
    web: 38,
    correos_profesores: 39,
    plazas_anio: 40,
  },
}

// ---------------------------------------------------------------------------
// Contact column index maps (0-based, by family)
// ---------------------------------------------------------------------------

interface ContactCols {
  nombre_cargo: number
  contacto: number
  feedback: number | null
}

const CONTACTS: Record<Family, ContactCols[]> = {
  ENF: [
    { nombre_cargo: 9,  contacto: 10, feedback: 11 },  // contact 1 (J,K,L)
    { nombre_cargo: 12, contacto: 13, feedback: null }, // contact 2 (M,N)
    { nombre_cargo: 14, contacto: 15, feedback: null }, // contact 3 (O,P)
    { nombre_cargo: 16, contacto: 17, feedback: null }, // contact 4 (Q,R)
    { nombre_cargo: 18, contacto: 19, feedback: null }, // contact 5 (S,T)
  ],
  B: [
    { nombre_cargo: 10, contacto: 11, feedback: 12 },  // contact 1 (K,L,M)
    { nombre_cargo: 13, contacto: 14, feedback: null }, // contact 2 (N,O)
    { nombre_cargo: 15, contacto: 16, feedback: null }, // contact 3 (P,Q)
    { nombre_cargo: 17, contacto: 18, feedback: null }, // contact 4 (R,S)
  ],
  A: [
    { nombre_cargo: 12, contacto: 13, feedback: 14 },  // contact 1 (M,N,O)
    { nombre_cargo: 15, contacto: 16, feedback: null }, // contact 2 (P,Q)
    { nombre_cargo: 17, contacto: 18, feedback: null }, // contact 3 (R,S)
    { nombre_cargo: 19, contacto: 20, feedback: null }, // contact 4 (T,U)
    { nombre_cargo: 21, contacto: 22, feedback: null }, // contact 5 (V,W)
  ],
  // VETERINARIA: 4 contacts only (M-U, indices 12-20); no 5th contact pair
  VET: [
    { nombre_cargo: 12, contacto: 13, feedback: 14 },  // contact 1 (M,N,O)
    { nombre_cargo: 15, contacto: 16, feedback: null }, // contact 2 (P,Q)
    { nombre_cargo: 17, contacto: 18, feedback: null }, // contact 3 (R,S)
    { nombre_cargo: 19, contacto: 20, feedback: null }, // contact 4 (T,U)
  ],
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function parseDate(raw: string): string | null {
  if (!raw || !raw.trim()) return null
  const trimmed = raw.trim()

  // ISO format: YYYY-MM-DD
  const isoMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}/)
  if (isoMatch) return isoMatch[0]

  // European: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const euroMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
  if (euroMatch) {
    const [, d, m, y] = euroMatch
    return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`
  }

  return null
}

function parseInteger(raw: string): number | null {
  if (!raw || !raw.trim()) return null
  const cleaned = raw.trim().replace(/%/g, '').replace(/\s/g, '').replace(',', '.')
  const n = Number(cleaned)
  if (Number.isNaN(n)) return null
  return Math.round(n)
}

/** Safe cell accessor — returns '' if the row is shorter than expected */
function cell(row: string[], idx: number | null): string {
  if (idx === null || idx < 0) return ''
  return (row[idx] ?? '').trim()
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface InstitutionImportResult {
  inserted: number
  updated: number
  skipped: number   // rows without a university value
  errors: string[]
}

// ---------------------------------------------------------------------------
// Per-tab import
// ---------------------------------------------------------------------------

async function importTab(
  spreadsheetId: string,
  tab: TabConfig,
): Promise<InstitutionImportResult> {
  const result: InstitutionImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] }

  const sheets = getSheetsClient()

  // Resolve tab name from GID
  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const sheetMeta = meta.data.sheets?.find((s) => s.properties?.sheetId === tab.gid)
  if (!sheetMeta?.properties?.title) {
    result.errors.push(`Tab gid=${tab.gid} (${tab.profesion}) not found in spreadsheet`)
    return result
  }
  const tabName = sheetMeta.properties.title
  const safeRange = `'${tabName.replace(/'/g, "''")}'`

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: safeRange })
  const allRows = (res.data.values ?? []) as string[][]

  // Data starts at row index 3 (rows 0,1,2 = title, group headers, column names)
  const dataRows = allRows.slice(3)

  const cols = COL[tab.family]
  const contacts = CONTACTS[tab.family]

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]!
    const rowNum = i + 4 // 1-indexed sheet row number

    try {
      const universidad = cell(row, cols.universidad)
      if (!universidad) {
        result.skipped++
        continue
      }

      // Skip summary/aggregation rows embedded in the sheet
      // (e.g. totals row "126", header "Nº Unis/Estado", percentage rows)
      if (/^\d+$/.test(universidad.trim()) || universidad.trim() === 'Nº Unis/Estado') {
        result.skipped++
        continue
      }

      const comunidad_autonoma = cell(row, cols.comunidad) || null

      // Build institution payload
      const payload: Record<string, unknown> = {
        profesion: tab.profesion,
        comunidad_autonoma,
        universidad,
        num_visitas:              parseInteger(cell(row, cols.num_visitas)),
        años_visitas_ponentes:    cell(row, cols.años_visitas_ponentes) || null,
        alumnos_registrados_zoho: parseInteger(cell(row, cols.alumnos_registrados_zoho)),
        tipo_evento_ultima_charla: cell(row, cols.tipo_evento_ultima_charla) || null,
        fecha_ultima_charla:      parseDate(cell(row, cols.fecha_ultima_charla)),
        ticker_estado:            cell(row, cols.ticker_estado) || null,
        estado_charla:            cell(row, cols.estado_charla) || null,
        comentarios:              cell(row, cols.comentarios) || null,
        mes_contactar_de_nuevo:   cell(row, cols.mes_contactar_de_nuevo) || null,
        mensaje_programado:       cell(row, cols.mensaje_programado) || null,
        email_facultad:           cell(row, cols.email_facultad) || null,
        telefono_facultad:        cell(row, cols.telefono_facultad) || null,
        ticker_agenda:            cell(row, cols.ticker_agenda) || null,
        persona_contacto_agenda:  cell(row, cols.persona_contacto_agenda) || null,
        fecha_charla_visita:      parseDate(cell(row, cols.fecha_charla_visita)),
        hora_charla:              cell(row, cols.hora_charla) || null,
        lugar_concreto:           cell(row, cols.lugar_concreto) || null,
        tipo_evento:              cell(row, cols.tipo_evento) || null,
        compañero_asiste:         cell(row, cols.compañero_asiste) || null,
        duracion_charla:          cell(row, cols.duracion_charla) || null,
        num_asistentes_charla:    parseInteger(cell(row, cols.num_asistentes_charla)),
        num_interesados_firmas:   parseInteger(cell(row, cols.num_interesados_firmas)),
        global_worker_asiste:     cell(row, cols.global_worker_asiste) || null,
        recursos_entregados:      cell(row, cols.recursos_entregados) || null,
        ciudad:                   cell(row, cols.ciudad) || null,
        ubicacion:                cell(row, cols.ubicacion) || null,
        tipo_centro:              cell(row, cols.tipo_centro) || null,
        web:                      cell(row, cols.web) || null,
        correos_profesores_web:   cell(row, cols.correos_profesores) || null,
        plazas_anio:              parseInteger(cell(row, cols.plazas_anio)),
        synced_at:                new Date().toISOString(),
      }

      // Upsert institution
      const { data: upsertedRows, error: upsertError } = await supabaseAdmin
        .from('institutions_kpi')
        .upsert(payload as any, {
          onConflict: 'profesion,comunidad_autonoma,universidad',
        })
        .select('id')

      if (upsertError) {
        result.errors.push(
          `Row ${rowNum} (${tab.profesion} / ${universidad}): institution upsert error: ${upsertError.message}`,
        )
        continue
      }

      // Determine if this was an insert or update by checking if the row was new
      // Supabase upsert always returns rows — we can't distinguish insert vs update
      // without an extra select, so we count all as "updated" unless the id comes back
      // as newly created. Use a select-then-upsert pattern for accuracy.
      const institutionId = (upsertedRows as Array<{ id: string }> | null)?.[0]?.id

      if (!institutionId) {
        // Fallback: fetch the id after upsert
        const { data: existing, error: selectError } = await supabaseAdmin
          .from('institutions_kpi')
          .select('id')
          .eq('profesion', tab.profesion)
          .eq('universidad', universidad)
          .maybeSingle()

        if (selectError || !existing) {
          result.errors.push(
            `Row ${rowNum} (${tab.profesion} / ${universidad}): could not resolve institution id after upsert`,
          )
          continue
        }

        result.updated++
        await upsertContacts(existing.id, contacts, row, rowNum, tab.profesion, universidad, result)
        continue
      }

      result.updated++

      // Upsert contacts
      await upsertContacts(institutionId, contacts, row, rowNum, tab.profesion, universidad, result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`Row ${rowNum} (${tab.profesion}): unexpected error: ${msg}`)
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Contact upsert helper
// ---------------------------------------------------------------------------

async function upsertContacts(
  institutionId: string,
  contacts: ContactCols[],
  row: string[],
  rowNum: number,
  profesion: string,
  universidad: string,
  result: InstitutionImportResult,
): Promise<void> {
  for (let n = 0; n < contacts.length; n++) {
    const contact = contacts[n]!
    const nombre_cargo = cell(row, contact.nombre_cargo)
    if (!nombre_cargo) continue  // skip empty contacts

    const contactPayload = {
      institution_id: institutionId,
      contact_number: n + 1,
      nombre_cargo,
      contacto: cell(row, contact.contacto) || null,
      feedback: contact.feedback !== null ? cell(row, contact.feedback) || null : null,
    }

    const { error: contactError } = await supabaseAdmin
      .from('institution_contacts_kpi')
      .upsert(contactPayload as any, {
        onConflict: 'institution_id,contact_number',
      })

    if (contactError) {
      result.errors.push(
        `Row ${rowNum} (${profesion} / ${universidad}) contact ${n + 1}: ${contactError.message}`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function importInstitutions(
  spreadsheetId: string,
): Promise<{ total: InstitutionImportResult; byProfesion: Record<string, InstitutionImportResult> }> {
  const total: InstitutionImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] }
  const byProfesion: Record<string, InstitutionImportResult> = {}

  for (const tab of TABS) {
    let tabResult: InstitutionImportResult
    try {
      tabResult = await importTab(spreadsheetId, tab)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      tabResult = {
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [`Fatal error importing tab: ${msg}`],
      }
    }

    byProfesion[tab.profesion] = tabResult
    total.inserted += tabResult.inserted
    total.updated  += tabResult.updated
    total.skipped  += tabResult.skipped
    total.errors.push(...tabResult.errors.map((e) => `[${tab.profesion}] ${e}`))
  }

  return { total, byProfesion }
}
