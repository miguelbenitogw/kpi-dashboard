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
  profesion?: string
  page?: number
  pageSize?: number
}): Promise<GermanyCandidatesResult> {
  const { promoNumero, tipoPerfil, estado, profesion, page = 1, pageSize = 50 } = filters

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
  if (profesion) q = q.contains('tags', [profesion])

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
  profesiones: string[]
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
    return { promos: [], tiposPerfil: [], estados: [], profesiones: [] }
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

  // Detección dinámica de profesiones desde tags
  const { data: tagData } = await (supabase as any)
    .from('germany_candidates_kpi')
    .select('tags') as { data: { tags: string[] | null }[] | null }

  const tagCounts: Record<string, number> = {}
  for (const row of tagData ?? []) {
    for (const tag of row.tags ?? []) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
    }
  }

  const NON_PROFESSION_PREFIXES = ['FR ', 'CP ', 'GW', 'Promo', 'promo', 'Prom.', 'prom.', 'EF', 'Uni "']
  const NON_PROFESSION_PATTERNS = [
    /^\d{4}$/,
    /^prioridad/i,
    /^Calendly/i,
    /^Pedimos/i,
    /^ONLINE$/i,
    /^SEMIPRESENCIAL$/i,
    /^Whatsapp/i,
    /^webinar/i,
    /^De promo/i,
    /^\+ /,
    /^Tatjana/i,
  ]

  const profesiones = Object.entries(tagCounts)
    .filter(([tag, count]) => {
      if (count < 5) return false
      if (NON_PROFESSION_PREFIXES.some((p) => tag.startsWith(p))) return false
      if (NON_PROFESSION_PATTERNS.some((p) => p.test(tag))) return false
      return true
    })
    .map(([tag]) => tag)
    .sort()

  return { promos, tiposPerfil, estados, profesiones }
}

// ---------------------------------------------------------------------------
// Abandonos (germany_dropouts_kpi)
// ---------------------------------------------------------------------------

export interface GermanyDropoutRow {
  promo_numero: number | null
  status: string | null
  nombre: string | null
  profile: string | null
  modality: string | null
  start_date: string | null
  dropout_date: string | null
  days_of_training: number | null
  hours_of_training: number | null
  amount_to_pay: number | null
  language_level_performance: string | null
  level_at_dropout: string | null
  absence_percentage: number | null
  reason_for_dropout: string | null
  interest_in_future: string | null
}

export interface GermanyDropoutStats {
  total_offer_declined: number
  total_offer_withdrawn: number
  total_transferred: number
  total_all: number
  avg_days_training: number | null
  interest_in_future_yes: number
  interest_in_future_no: number
  by_reason: { reason: string; count: number }[]
  by_profile: { profile: string; count: number }[]
  by_promo: {
    promo_numero: number
    offer_declined: number
    offer_withdrawn: number
    transferred: number
    total: number
  }[]
}

// Tags que NO son profesión (misma lógica que getGermanyFilterOptions)
const NON_PROF_PREFIXES = ['FR ', 'CP ', 'GW', 'Promo', 'promo', 'Prom.', 'prom.', 'EF', 'Uni "']
const NON_PROF_PATTERNS = [
  /^\d{4}$/,
  /^prioridad/i,
  /^Calendly/i,
  /^Pedimos/i,
  /^ONLINE$/i,
  /^SEMIPRESENCIAL$/i,
  /^Whatsapp/i,
  /^webinar/i,
  /^De promo/i,
  /^\+ /,
  /^Tatjana/i,
]

function extractProfesionTag(tags: string[] | null): string | null {
  for (const tag of tags ?? []) {
    if (NON_PROF_PREFIXES.some((p) => tag.startsWith(p))) continue
    if (NON_PROF_PATTERNS.some((p) => p.test(tag))) continue
    return tag
  }
  return null
}

export async function getGermanyDropoutStats(): Promise<GermanyDropoutStats> {
  // Fetch dropout records + candidate tags en paralelo
  const [dropoutRes, candidateRes] = await Promise.all([
    (supabase as any)
      .from('germany_dropouts_kpi')
      .select('promo_numero, status, nombre, days_of_training, interest_in_future, reason_for_dropout')
      .order('promo_numero', { ascending: false }),
    (supabase as any)
      .from('germany_candidates_kpi')
      .select('nombre, promo_numero, tags'),
  ])

  const data = dropoutRes.data as Array<{
    promo_numero: number | null
    status: string | null
    nombre: string | null
    days_of_training: number | null
    interest_in_future: string | null
    reason_for_dropout: string | null
  }> | null

  const empty: GermanyDropoutStats = {
    total_offer_declined: 0,
    total_offer_withdrawn: 0,
    total_transferred: 0,
    total_all: 0,
    avg_days_training: null,
    interest_in_future_yes: 0,
    interest_in_future_no: 0,
    by_reason: [],
    by_profile: [],
    by_promo: [],
  }

  if (dropoutRes.error || !data) {
    console.error('Error fetching Germany dropout stats:', dropoutRes.error)
    return empty
  }

  if (candidateRes.error) {
    console.error('[getGermanyDropoutStats] Error fetching candidate tags (by_profile usará "Sin etiqueta"):', candidateRes.error)
  }

  // Mapa nombre|promo → etiqueta de profesión
  // Key: nombre normalizado + "|" + promo_numero (null → "null" vía template literal — igual en ambos lados)
  const profMap = new Map<string, string>()
  for (const c of (candidateRes.data ?? []) as Array<{ nombre: string | null; promo_numero: number | null; tags: string[] | null }>) {
    const key = `${(c.nombre ?? '').toLowerCase().trim()}|${c.promo_numero}`
    const tag = extractProfesionTag(c.tags)
    if (tag) profMap.set(key, tag)
  }

  let total_offer_declined = 0
  let total_offer_withdrawn = 0
  let total_transferred = 0
  let interest_in_future_yes = 0
  let interest_in_future_no = 0
  let daysSum = 0
  let daysCount = 0

  const reasonCounts = new Map<string, number>()
  const profileCounts = new Map<string, number>()
  const promoMap = new Map<
    number,
    { offer_declined: number; offer_withdrawn: number; transferred: number }
  >()

  for (const row of data) {
    const status = row.status ?? ''
    const promoNum = row.promo_numero ?? 0

    // Status counts
    if (status === 'Offer Declined') total_offer_declined++
    else if (status === 'Offer Withdrawn') total_offer_withdrawn++
    else if (status === 'Transferred') total_transferred++

    // Interest in future
    if (row.interest_in_future === 'Yes') interest_in_future_yes++
    else if (row.interest_in_future === 'No') interest_in_future_no++

    // Avg days training — only Offer Withdrawn (withdrew during training)
    if (status === 'Offer Withdrawn') {
      const d = Number(row.days_of_training)
      if (!isNaN(d) && d > 0 && d < 10000) {
        daysSum += d
        daysCount++
      }
    }

    // Reason
    const reason = row.reason_for_dropout ?? 'Sin motivo'
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)

    // Profesión — etiqueta del candidato en germany_candidates_kpi
    // Usamos row.promo_numero directamente (no ?? 0) para que null → "null" igual que en profMap
    const lookupKey = `${(row.nombre ?? '').toLowerCase().trim()}|${row.promo_numero}`
    const profTag = profMap.get(lookupKey) ?? 'Sin etiqueta'
    profileCounts.set(profTag, (profileCounts.get(profTag) ?? 0) + 1)

    // Per promo
    if (!promoMap.has(promoNum)) {
      promoMap.set(promoNum, { offer_declined: 0, offer_withdrawn: 0, transferred: 0 })
    }
    const entry = promoMap.get(promoNum)!
    if (status === 'Offer Declined') entry.offer_declined++
    else if (status === 'Offer Withdrawn') entry.offer_withdrawn++
    else if (status === 'Transferred') entry.transferred++
  }

  const by_promo = Array.from(promoMap.entries())
    .sort(([a], [b]) => b - a)
    .map(([promo_numero, counts]) => ({
      promo_numero,
      ...counts,
      total: counts.offer_declined + counts.offer_withdrawn + counts.transferred,
    }))

  return {
    total_offer_declined,
    total_offer_withdrawn,
    total_transferred,
    total_all: data.length,
    avg_days_training: daysCount > 0 ? Math.round(daysSum / daysCount) : null,
    interest_in_future_yes,
    interest_in_future_no,
    by_reason: Array.from(reasonCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([reason, count]) => ({ reason, count })),
    by_profile: Array.from(profileCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([profile, count]) => ({ profile, count })),
    by_promo,
  }
}

export async function getGermanyDropoutRows(filters?: {
  promo_numero?: number
  status?: string
}): Promise<GermanyDropoutRow[]> {
  let q = (supabase as any)
    .from('germany_dropouts_kpi')
    .select(
      'promo_numero, status, nombre, profile, modality, start_date, dropout_date, days_of_training, hours_of_training, amount_to_pay, language_level_performance, level_at_dropout, absence_percentage, reason_for_dropout, interest_in_future'
    )
    .order('promo_numero', { ascending: false })
    .order('nombre', { ascending: true })

  if (filters?.promo_numero !== undefined) {
    q = q.eq('promo_numero', filters.promo_numero)
  }
  if (filters?.status) {
    q = q.eq('status', filters.status)
  }

  const { data, error } = await q as {
    data: GermanyDropoutRow[] | null
    error: unknown
  }

  if (error) {
    console.error('Error fetching Germany dropout rows:', error)
    return []
  }

  return data ?? []
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
