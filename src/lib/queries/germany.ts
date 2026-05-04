import { supabaseAdmin as supabase } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GermanyKpis {
  total_candidatos: number
  hired: number
  tasa_exito: number
  promos_activas: number
}

export interface GermanyExamRow {
  promo_numero: number
  num_total: number | null
  num_in_training: number | null
  num_to_place: number | null
  pct_colocacion: number | null
  b1_aprobados_1a: number | null
  b1_aprobados_2a: number | null
  b2_aprobados_1a: number | null
  estado_iqz: number | null
  estado_berlin: number | null
  estado_standby: number | null
  estado_hired: number | null
  estado_fuera_red: number | null
  estado_offer_withdrawn: number | null
}

export interface GermanyCandidateRow {
  id?: number
  nombre: string | null
  estado: string | null
  tipo_perfil: string | null
  promocion: string | null
  promo_numero: number | null
  coordinador: string | null
  cliente: string | null
  ciudad_kita: string | null
  fp: string | null
  tags: string[] | null
}

export interface GermanyPaymentRow {
  nombre: string | null
  promo_numero: number | null
  profesion: string | null
  empresa: string | null
  estado: string | null
  modalidad: string | null
  importe_total: number | null
  importe_pendiente: number | null
}

export interface GermanyPaymentsSummary {
  total_facturado: number
  total_pendiente: number
  rows: GermanyPaymentRow[]
}

export interface GermanyCandidatesResult {
  rows: GermanyCandidateRow[]
  total: number
}

// ---------------------------------------------------------------------------
// KPIs generales
// ---------------------------------------------------------------------------

export async function getGermanyKpis(): Promise<GermanyKpis> {
  const { data, error } = await (supabase as any)
    .from('germany_candidates_kpi')
    .select('estado, promo_numero') as {
      data: Array<{ estado: string | null; promo_numero: number | null }> | null
      error: unknown
    }

  if (error || !data) {
    console.error('Error fetching Germany KPIs:', error)
    return { total_candidatos: 0, hired: 0, tasa_exito: 0, promos_activas: 0 }
  }

  const total_candidatos = data.length

  // States that mean the candidate is no longer active in the program
  const INACTIVE_STATES = new Set([
    'Offer Withdrawn',
    'Offer Declined',
    'Expelled',
    'Out of Network',
    'Not in Germany',
  ])

  let hired = 0
  const promosActivas = new Set<number>()

  for (const row of data) {
    const estado = row.estado ?? ''
    if (estado === 'Hired') hired++
    if (row.promo_numero !== null && !INACTIVE_STATES.has(estado)) {
      promosActivas.add(row.promo_numero)
    }
  }

  const tasa_exito =
    total_candidatos > 0
      ? Math.round((hired / total_candidatos) * 10000) / 100
      : 0

  return {
    total_candidatos,
    hired,
    tasa_exito,
    promos_activas: promosActivas.size,
  }
}

// ---------------------------------------------------------------------------
// Tabla de exámenes / promos
// ---------------------------------------------------------------------------

export async function getGermanyExamsOverview(): Promise<GermanyExamRow[]> {
  const { data, error } = await (supabase as any)
    .from('germany_exams_kpi')
    .select(
      'promo_numero, num_total, num_in_training, num_to_place, pct_colocacion, b1_aprobados_1a, b1_aprobados_2a, b2_aprobados_1a, estado_iqz, estado_berlin, estado_standby, estado_hired, estado_fuera_red, estado_offer_withdrawn'
    )
    .order('promo_numero', { ascending: false }) as {
      data: GermanyExamRow[] | null
      error: unknown
    }

  if (error) {
    console.error('Error fetching Germany exams overview:', error)
    return []
  }

  return data ?? []
}

// ---------------------------------------------------------------------------
// Lista de candidatos (filtrable + paginada)
// ---------------------------------------------------------------------------

export async function getGermanyCandidates(filters: {
  promoNumero?: number
  tipoPerfil?: string
  estado?: string
  page?: number
  pageSize?: number
}): Promise<GermanyCandidatesResult> {
  const { promoNumero, tipoPerfil, estado, page = 1, pageSize = 50 } = filters

  let q = (supabase as any)
    .from('germany_candidates_kpi')
    .select(
      'nombre, estado, tipo_perfil, promocion, promo_numero, coordinador, cliente, ciudad_kita, fp, tags',
      { count: 'exact' }
    )
    .order('nombre', { ascending: true })

  if (promoNumero !== undefined) q = q.eq('promo_numero', promoNumero)
  if (tipoPerfil) q = q.eq('tipo_perfil', tipoPerfil)
  if (estado) q = q.ilike('estado', `%${estado}%`)

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  q = q.range(from, to)

  const { data, error, count } = await q as {
    data: GermanyCandidateRow[] | null
    error: unknown
    count: number | null
  }

  if (error) {
    console.error('Error fetching Germany candidates:', error)
    return { rows: [], total: 0 }
  }

  return { rows: data ?? [], total: count ?? 0 }
}

// ---------------------------------------------------------------------------
// Filtros disponibles (para selects)
// ---------------------------------------------------------------------------

export async function getGermanyFilterOptions(): Promise<{
  promos: number[]
  tiposPerfil: string[]
  estados: string[]
}> {
  const { data, error } = await (supabase as any)
    .from('germany_candidates_kpi')
    .select('promo_numero, tipo_perfil, estado') as {
      data: Array<{
        promo_numero: number | null
        tipo_perfil: string | null
        estado: string | null
      }> | null
      error: unknown
    }

  if (error || !data) {
    return { promos: [], tiposPerfil: [], estados: [] }
  }

  const promos = Array.from(
    new Set(data.map((r) => r.promo_numero).filter((v): v is number => v !== null))
  ).sort((a, b) => a - b)

  const tiposPerfil = Array.from(
    new Set(data.map((r) => r.tipo_perfil).filter((v): v is string => Boolean(v)))
  ).sort()

  const estados = Array.from(
    new Set(data.map((r) => r.estado).filter((v): v is string => Boolean(v)))
  ).sort()

  return { promos, tiposPerfil, estados }
}

// ---------------------------------------------------------------------------
// Resumen de pagos
// ---------------------------------------------------------------------------

export async function getGermanyPaymentsSummary(): Promise<GermanyPaymentsSummary> {
  const { data, error } = await (supabase as any)
    .from('germany_payments_kpi')
    .select(
      'nombre, promo_numero, profesion, empresa, estado, modalidad, importe_total, importe_pendiente'
    )
    .order('nombre', { ascending: true }) as {
      data: GermanyPaymentRow[] | null
      error: unknown
    }

  if (error) {
    console.error('Error fetching Germany payments:', error)
    return { total_facturado: 0, total_pendiente: 0, rows: [] }
  }

  const rows = data ?? []

  let total_facturado = 0
  let total_pendiente = 0

  for (const row of rows) {
    total_facturado += row.importe_total ?? 0
    total_pendiente += row.importe_pendiente ?? 0
  }

  return { total_facturado, total_pendiente, rows }
}
