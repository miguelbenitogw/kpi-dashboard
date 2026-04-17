/**
 * Queries para Charlas y Webinars (Atracción → Instituciones).
 * Maps: I3, J3, K3, S3, U3 del Cuadro de Mando GW.
 */

import { supabase } from '@/lib/supabase/client'
import { supabaseAdmin } from '@/lib/supabase/server'

export interface CharlaTemporadaRow {
  id: string
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
}

export interface CharlasProgramaTotal {
  id: string
  programa: string
  total_personas_formaciones: number | null
  total_registros: number | null
}

export interface CharlasSummary {
  porTemporada: CharlaTemporadaRow[]
  totalesPorPrograma: CharlasProgramaTotal[]
  totales: {
    temporadas: number
    totalInscritos: number
    totalEnFormacion: number
    totalCharlasPresenciales: number
    totalInscritosWebinars: number
    conversionRate: number // % formación / inscritos
  }
}

export async function getCharlasSummary(): Promise<CharlasSummary> {
  const [temporadaRes, totalesRes] = await Promise.all([
    supabase
      .from('charlas_temporada')
      .select('*')
      .order('temporada', { ascending: true })
      .order('programa', { ascending: true }),
    supabase.from('charlas_programa_totales').select('*'),
  ])

  const porTemporada = (temporadaRes.data ?? []) as CharlaTemporadaRow[]
  const totalesPorPrograma = (totalesRes.data ?? []) as CharlasProgramaTotal[]

  const sum = (rows: CharlaTemporadaRow[], key: keyof CharlaTemporadaRow) =>
    rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0)

  const totalInscritos = sum(porTemporada, 'total_inscritos')
  const totalEnFormacion = sum(porTemporada, 'total_formacion')
  const totalCharlasPresenciales = sum(porTemporada, 'total_inscritos_charlas')
  const totalInscritosWebinars = sum(porTemporada, 'total_inscritos_webinars')
  const seasons = new Set(porTemporada.map((r) => r.temporada))

  return {
    porTemporada,
    totalesPorPrograma,
    totales: {
      temporadas: seasons.size,
      totalInscritos,
      totalEnFormacion,
      totalCharlasPresenciales,
      totalInscritosWebinars,
      conversionRate:
        totalInscritos > 0 ? (totalEnFormacion / totalInscritos) * 100 : 0,
    },
  }
}

// ---------- Upsert (for admin import) ----------

export interface CharlaTemporadaUpsert {
  temporada: string
  programa: string
  total_inscritos_charlas?: number | null
  total_inscritos_webinars?: number | null
  total_inscritos?: number | null
  charlas_realizadas?: number | null
  formacion_from_uni?: number | null
  formacion_from_webinar?: number | null
  total_formacion?: number | null
  promociones_revisadas?: string | null
  observaciones?: string | null
}

export async function upsertCharlasTemporada(rows: CharlaTemporadaUpsert[]) {
  if (rows.length === 0) return { count: 0 }
  const { data, error } = await supabaseAdmin
    .from('charlas_temporada')
    .upsert(rows, { onConflict: 'temporada,programa' })
    .select()
  if (error) throw error
  return { count: data?.length ?? 0 }
}

export async function upsertProgramaTotales(rows: {
  programa: string
  total_personas_formaciones?: number | null
  total_registros?: number | null
}[]) {
  if (rows.length === 0) return { count: 0 }
  const { data, error } = await supabaseAdmin
    .from('charlas_programa_totales')
    .upsert(rows, { onConflict: 'programa' })
    .select()
  if (error) throw error
  return { count: data?.length ?? 0 }
}
