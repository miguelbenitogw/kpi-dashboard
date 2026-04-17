/**
 * Parser for "Registrados Charlas y Webinars - Total.csv".
 *
 * The CSV is NOT flat — it's a report-style document with multiple sections:
 *   1. Header rows (metadata, disclaimers)
 *   2. A per-year summary block: { programa, total_personas_formaciones, total_registros, year_columns... }
 *   3. Season blocks, each starting with "TEMPORADA YYYY - YYYY", followed by a programa table
 *
 * We parse those structures into two normalized outputs:
 *   - perProgramaTotales → charlas_programa_totales
 *   - perTemporada → charlas_temporada
 */

export interface ParsedCharlas {
  perProgramaTotales: {
    programa: string
    total_personas_formaciones: number | null
    total_registros: number | null
  }[]
  perTemporada: {
    temporada: string
    programa: string
    total_inscritos_charlas: number | null
    total_inscritos_webinars: number | null
    total_inscritos: number | null
    charlas_realizadas: number | null
    formacion_from_uni: number | null
    formacion_from_webinar: number | null
    total_formacion: number | null
    promociones_revisadas: string | null
    observaciones: string | null
  }[]
}

/** Very small CSV line splitter that respects double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

/** Coerce "1.381" / "1,381" / "1381" → 1381. Returns null for blanks. */
function parseIntLoose(v: string | undefined | null): number | null {
  if (!v) return null
  const clean = v
    .replace(/\s/g, '')
    .replace(/[.,](?=\d{3}\b)/g, '') // strip thousand separators
    .replace(',', '.')
  const n = parseInt(clean, 10)
  return Number.isFinite(n) ? n : null
}

const TEMPORADA_RE = /TEMPORADA\s+(\d{4})\s*[-–]\s*(\d{4})/i

export function parseCharlasCsv(csv: string): ParsedCharlas {
  const lines = csv.split(/\r?\n/).map(splitCsvLine)

  const perProgramaTotales: ParsedCharlas['perProgramaTotales'] = []
  const perTemporada: ParsedCharlas['perTemporada'] = []

  let currentTemporada: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const row = lines[i]
    const first = (row[0] ?? '').trim()
    const second = (row[1] ?? '').trim()

    // --- Detect "TEMPORADA YYYY - YYYY" headers ---
    const matchT = first.match(TEMPORADA_RE) || second.match(TEMPORADA_RE)
    if (matchT) {
      currentTemporada = `${matchT[1]}-${matchT[2]}`
      continue
    }

    // --- Per-programa totales (summary section before seasons) ---
    // Shape: "ENFERMERÍA,169,4798,..." or "EDUCACIÓN INFANTIL,23,939,..."
    if (!currentTemporada) {
      if (
        /^ENFERMER[ÍI]A$/i.test(first) ||
        /^EDUCACI[ÓO]N\s+INFANTIL$/i.test(first)
      ) {
        perProgramaTotales.push({
          programa: normalizePrograma(first),
          total_personas_formaciones: parseIntLoose(row[1]),
          total_registros: parseIntLoose(row[2]),
        })
        continue
      }
    }

    // --- Season programa rows (Enfermería / Educación Infantil etc.) ---
    if (currentTemporada && isProgramaRow(first)) {
      perTemporada.push({
        temporada: currentTemporada,
        programa: normalizePrograma(first),
        total_inscritos_charlas: parseIntLoose(row[1]),
        total_inscritos_webinars: parseIntLoose(row[2]),
        total_inscritos: parseIntLoose(row[3]),
        charlas_realizadas: parseIntLoose(row[4]),
        formacion_from_uni: parseIntLoose(row[5]),
        formacion_from_webinar: parseIntLoose(row[6]),
        total_formacion: parseIntLoose(row[7]),
        promociones_revisadas: row[8]?.trim() || null,
        observaciones: row[11]?.trim() || row[10]?.trim() || null,
      })
    }
  }

  return { perProgramaTotales, perTemporada }
}

function isProgramaRow(first: string): boolean {
  const normalized = first
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return (
    normalized === 'enfermeria' ||
    normalized === 'educacion infantil' ||
    normalized === 'fisioterapia' ||
    normalized === 'medicina' ||
    normalized === 'odontologia'
  )
}

function normalizePrograma(raw: string): string {
  const n = raw.trim()
  if (/^ENFERMER/i.test(n)) return 'Enfermería'
  if (/^EDUCACI/i.test(n)) return 'Educación Infantil'
  if (/^FISIO/i.test(n)) return 'Fisioterapia'
  return n
}
