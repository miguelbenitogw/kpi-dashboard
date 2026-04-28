import { supabase } from '@/lib/supabase/client'

const FORMATION_STATES = [
  'Hired',
  'In Training',
  'Offer Withdrawn',
  'Offer Declined',
  'Expelled',
  'Transferred',
  'To Place',
  'Assigned',
  'Stand-by',
  'Training Finished',
  'No Show',
  'Next Project',
  'Approved by client',
  'Rejected by client',
] as const

// Statuses that mean the candidate is still active in the program
// Note: DB uses spaces, not hyphens (e.g. 'Offer Withdrawn', not 'Offer-Withdrawn')
const RETAINED_STATES = ['Hired', 'Training Finished', 'In Training', 'Assigned', 'To Place', 'Next Project']

// Statuses that mean the candidate dropped out
const DROPOUT_STATES = [
  'Offer Withdrawn',
  'Offer Declined',
  'Expelled',
  'Transferred',
  'Rejected by client',
  'No Show',
]

export interface FormacionStateRow {
  status: string
  count: number
  percentage: number
}

export interface RetentionMetrics {
  objetivo: number
  actual: number
  percentage: number
  trafficLight: 'good' | 'warning' | 'danger'
}

export interface DropoutByWeek {
  week: number
  count: number
}

export interface DropoutByMonth {
  month: string
  count: number
}

export interface DropoutByLevel {
  level: string
  count: number
}

export interface DropoutByReason {
  reason: string
  count: number
}

export interface DropoutByInterest {
  interest: string
  count: number
}

export interface DropoutAnalysisData {
  byWeek: DropoutByWeek[]
  byMonth: DropoutByMonth[]
  byLanguageLevel: DropoutByLevel[]
  byReason: DropoutByReason[]
  byInterest: DropoutByInterest[]
  totalDropouts: number
  dropoutRate: number
  avgWeeksOfTraining: number | null
  avgAttendancePct: number | null
}

export interface PromotionFormacionOverview {
  id: string
  nombre: string
  season: string | null
  objetivo: number
  actual: number
  dropouts: number
  trafficLight: 'good' | 'warning' | 'danger'
  objetivo_atraccion: number
  objetivo_programa: number
  total_aceptados: number
  // Raw promo metadata for editing
  modalidad: string | null
  pais: string | null
  coordinador: string | null
  cliente: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  pct_exito_estimado: number | null
  contratos_firmados: number | null
}

function computeTrafficLight(ratio: number): 'good' | 'warning' | 'danger' {
  if (ratio >= 1.0) return 'good'
  if (ratio >= 0.9) return 'warning'
  return 'danger'
}

export async function getFormacionStates(
  promoNombres?: string[],
): Promise<FormacionStateRow[]> {
  let query = supabase
    .from('candidates_kpi')
    .select('current_status')
    .in('current_status', [...FORMATION_STATES])

  if (promoNombres && promoNombres.length > 0) {
    query = query.in('promocion_nombre', promoNombres)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching formacion states:', error)
    return []
  }

  if (!data || data.length === 0) return []

  const total = data.length
  const counts = new Map<string, number>()

  for (const row of data) {
    const status = row.current_status ?? 'Unknown'
    counts.set(status, (counts.get(status) ?? 0) + 1)
  }

  return FORMATION_STATES.filter((s) => counts.has(s)).map((status) => {
    const count = counts.get(status) ?? 0
    return {
      status,
      count,
      percentage: Math.round((count / total) * 10000) / 100,
    }
  })
}

export async function getRetentionMetrics(
  promotionId: string,
): Promise<RetentionMetrics> {
  const [promoRes, retainedRes] = await Promise.all([
    supabase
      .from('promotions_kpi')
      .select('expectativa_finalizan')
      .eq('id', promotionId)
      .single(),

    supabase
      .from('candidates_kpi')
      .select('id', { count: 'exact', head: true })
      .eq('promocion_nombre', promotionId)
      .in('current_status', RETAINED_STATES),
  ])

  const objetivo = promoRes.data?.expectativa_finalizan ?? 0
  const actual = retainedRes.count ?? 0
  const ratio = objetivo > 0 ? actual / objetivo : 0

  return {
    objetivo,
    actual,
    percentage: Math.round(ratio * 10000) / 100,
    trafficLight: computeTrafficLight(ratio),
  }
}

export async function getDropoutAnalysis(
  promoNombres?: string[],
): Promise<DropoutAnalysisData> {
  // Source of truth for dropout detail: promo_students_kpi (tab='Dropouts')
  // candidates_kpi.dropout_* fields are NOT reliably populated — don't use them here.
  let dropoutQuery = supabase
    .from('promo_students_kpi')
    .select(
      'sheet_status, dropout_reason, dropout_date, dropout_language_level, dropout_days_of_training, dropout_interest_future, promocion_nombre',
    )
    .eq('tab_name', 'Dropouts')

  if (promoNombres && promoNombres.length > 0) {
    dropoutQuery = dropoutQuery.in('promocion_nombre', promoNombres)
  }

  // Total program count from candidates_kpi (for dropout rate denominator)
  let totalProgramQuery = supabase
    .from('candidates_kpi')
    .select('id', { count: 'exact', head: true })
    .in('current_status', [...FORMATION_STATES])

  if (promoNombres && promoNombres.length > 0) {
    totalProgramQuery = totalProgramQuery.in('promocion_nombre', promoNombres)
  }

  const [{ data, error }, { count: totalPrograma }] = await Promise.all([
    dropoutQuery,
    totalProgramQuery,
  ])

  if (error) {
    console.error('Error fetching dropout analysis:', error)
    return {
      byWeek: [],
      byMonth: [],
      byLanguageLevel: [],
      byReason: [],
      byInterest: [],
      totalDropouts: 0,
      dropoutRate: 0,
      avgWeeksOfTraining: null,
      avgAttendancePct: null,
    }
  }

  const dropouts = data ?? []
  const total = totalPrograma ?? 0

  const weekCounts = new Map<number, number>()
  const monthCounts = new Map<string, number>()
  const levelCounts = new Map<string, number>()
  const reasonCounts = new Map<string, number>()
  const interestCounts = new Map<string, number>()
  let daysSum = 0
  let daysCount = 0

  for (const d of dropouts) {
    if (d.dropout_date) {
      const date = new Date(d.dropout_date)
      const startOfYear = new Date(date.getFullYear(), 0, 1)
      const diff = date.getTime() - startOfYear.getTime()
      const weekNum = Math.ceil(diff / (7 * 24 * 60 * 60 * 1000))
      weekCounts.set(weekNum, (weekCounts.get(weekNum) ?? 0) + 1)

      const monthKey = date.toLocaleDateString('es-AR', {
        month: 'short',
        year: '2-digit',
      })
      monthCounts.set(monthKey, (monthCounts.get(monthKey) ?? 0) + 1)
    }

    // Language level when they dropped out ("Level of language they was in")
    const level = d.dropout_language_level ?? 'Sin dato'
    levelCounts.set(level, (levelCounts.get(level) ?? 0) + 1)

    // Reason for dropout — fall back to sheet_status if no specific reason
    const reason = d.dropout_reason ?? d.sheet_status ?? 'Sin motivo'
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)

    // Interest in future projects
    if (d.dropout_interest_future) {
      interestCounts.set(d.dropout_interest_future, (interestCounts.get(d.dropout_interest_future) ?? 0) + 1)
    }

    // Weeks of training: convert days → weeks
    const days = Number(d.dropout_days_of_training)
    if (!isNaN(days) && days > 0 && days < 1000) {
      daysSum += days
      daysCount++
    }
  }

  return {
    byWeek: Array.from(weekCounts.entries())
      .sort(([a], [b]) => a - b)
      .map(([week, count]) => ({ week, count })),
    byMonth: Array.from(monthCounts.entries())
      .map(([month, count]) => ({ month, count })),
    byLanguageLevel: Array.from(levelCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([level, count]) => ({ level, count })),
    byReason: Array.from(reasonCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([reason, count]) => ({ reason, count })),
    byInterest: Array.from(interestCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([interest, count]) => ({ interest, count })),
    totalDropouts: dropouts.length,
    dropoutRate:
      total > 0
        ? Math.round((dropouts.length / total) * 10000) / 100
        : 0,
    avgWeeksOfTraining: daysCount > 0
      ? Math.round((daysSum / daysCount / 7) * 10) / 10
      : null,
    avgAttendancePct: null, // not tracked in promo sheets
  }
}

export async function getPromotionsFormacionOverview(
  filter: 'active' | 'finished' | 'all' = 'active'
): Promise<PromotionFormacionOverview[]> {
  let query = supabase
    .from('promotions_kpi')
    .select('id, nombre, expectativa_finalizan, is_active, fecha_fin, objetivo_atraccion, objetivo_programa, modalidad, pais, coordinador, cliente, fecha_inicio, pct_exito_estimado, contratos_firmados')
    .order('fecha_fin', { ascending: true, nullsFirst: false })

  if (filter === 'active') query = query.eq('is_active', true)
  else if (filter === 'finished') query = query.eq('is_active', false)

  const { data: promotions, error } = await query

  if (error) {
    console.error('Error fetching promotions overview:', error)
    return []
  }

  if (!promotions || promotions.length === 0) return []

  // Batch fetch all candidate status data for these promos in one query
  const promoNames = promotions.map((p) => p.nombre)

  const { data: candidates } = await supabase
    .from('candidates_kpi')
    .select('promocion_nombre, current_status')
    .in('promocion_nombre', promoNames)
    .not('current_status', 'is', null)

  // Build counts map per promo
  const retainedMap = new Map<string, number>()
  const dropoutMap = new Map<string, number>()
  const totalMap = new Map<string, number>()

  for (const c of candidates ?? []) {
    const promo = c.promocion_nombre!
    const status = c.current_status ?? ''

    // Total candidates regardless of status
    totalMap.set(promo, (totalMap.get(promo) ?? 0) + 1)

    if (RETAINED_STATES.includes(status)) {
      retainedMap.set(promo, (retainedMap.get(promo) ?? 0) + 1)
    } else if (DROPOUT_STATES.includes(status)) {
      dropoutMap.set(promo, (dropoutMap.get(promo) ?? 0) + 1)
    }
  }

  return promotions.map((promo) => {
    const objetivo = promo.expectativa_finalizan ?? 0
    const actual = retainedMap.get(promo.nombre) ?? 0
    const dropouts = dropoutMap.get(promo.nombre) ?? 0
    const ratio = objetivo > 0 ? actual / objetivo : 0

    return {
      id: promo.id,
      nombre: promo.nombre,
      season: null,
      objetivo,
      actual,
      dropouts,
      trafficLight: computeTrafficLight(ratio),
      objetivo_atraccion: (promo as any).objetivo_atraccion ?? 0,
      objetivo_programa: (promo as any).objetivo_programa ?? 0,
      total_aceptados: totalMap.get(promo.nombre) ?? 0,
      modalidad: (promo as any).modalidad ?? null,
      pais: (promo as any).pais ?? null,
      coordinador: (promo as any).coordinador ?? null,
      cliente: (promo as any).cliente ?? null,
      fecha_inicio: (promo as any).fecha_inicio ?? null,
      fecha_fin: promo.fecha_fin ?? null,
      pct_exito_estimado: (promo as any).pct_exito_estimado ?? null,
      contratos_firmados: (promo as any).contratos_firmados ?? null,
    }
  })
}

// ---------------------------------------------------------------------------
// Formacion preferences (gp_open_to — comma-separated placement types)
// ---------------------------------------------------------------------------

export interface PreferenceRow {
  preference: string
  count: number
  percentage: number
}

export async function getFormacionPreferences(
  promoNombres?: string[],
): Promise<PreferenceRow[]> {
  // Cast to `any` because `gp_open_to` is not yet in the generated Supabase types (stale)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .from('candidates_kpi')
    .select('gp_open_to')
    .not('gp_open_to', 'is', null)
    .neq('gp_open_to', '')

  if (promoNombres && promoNombres.length > 0) {
    q = q.in('promocion_nombre', promoNombres)
  }

  const { data, error } = await q as { data: Array<{ gp_open_to: string }> | null; error: unknown }

  if (error) {
    console.error('Error fetching formacion preferences:', error)
    return []
  }

  const prefMap = new Map<string, number>()

  for (const row of data ?? []) {
    const raw = row.gp_open_to
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
    for (const p of parts) {
      prefMap.set(p, (prefMap.get(p) ?? 0) + 1)
    }
  }

  const total = Array.from(prefMap.values()).reduce((s, v) => s + v, 0)

  return Array.from(prefMap.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([preference, count]) => ({
      preference,
      count,
      percentage: Math.round((count / total) * 10000) / 100,
    }))
}

// ---------------------------------------------------------------------------
// Candidatos table (promo chip filters + expandable row history)
// ---------------------------------------------------------------------------

export interface FormacionCandidateRow {
  id: string
  full_name: string | null
  current_status: string | null
  promocion_nombre: string | null
  assigned_agency: string | null
  gp_open_to: string | null
  gp_availability: string | null
}

export interface FormacionCandidateHistory {
  job_opening_id: string | null
  job_opening_title: string | null
  candidate_status_in_jo: string | null
  association_type: string | null
  fetched_at: string | null
}

export interface FormacionCandidateStageHistory {
  id: number
  job_opening_id: string | null
  from_status: string | null
  to_status: string | null
  changed_at: string | null
}

export interface FormacionCandidateNote {
  id: string
  note_title: string | null
  note_content: string | null
  author: string | null
  is_system: boolean
  created_at: string | null
}

export interface FormacionPromoCount {
  name: string
  count: number
}

/** Returns all promos with candidate counts, sorted by name. */
export async function getFormacionPromos(): Promise<FormacionPromoCount[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('candidates_kpi')
    .select('promocion_nombre')
    .not('promocion_nombre', 'is', null) as {
      data: Array<{ promocion_nombre: string }> | null
      error: unknown
    }

  if (error) {
    console.error('Error fetching formacion promos:', error)
    return []
  }

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const name = row.promocion_nombre
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => ({ name, count }))
}

/** Returns candidates for a given promo (null = all), ordered by full_name. */
export async function getFormacionCandidates(
  promoNombre: string | null,
): Promise<FormacionCandidateRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .from('candidates_kpi')
    .select('id, full_name, current_status, promocion_nombre, assigned_agency, gp_open_to, gp_availability')
    .order('full_name', { ascending: true })

  if (promoNombre !== null) {
    q = q.eq('promocion_nombre', promoNombre)
  }

  const { data, error } = await q as {
    data: FormacionCandidateRow[] | null
    error: unknown
  }

  if (error) {
    console.error('Error fetching formacion candidates:', error)
    return []
  }

  return data ?? []
}

// ---------------------------------------------------------------------------
// Vista General por Promo
// ---------------------------------------------------------------------------

export interface PromoVistaGeneralRow {
  id: string
  nombre: string
  numero: number | null
  modalidad: string | null
  pais: string | null
  coordinador: string | null
  cliente: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  // Atracción
  objetivo_atraccion: number
  total_aceptados: number
  pct_consecucion_atraccion: number
  // Programa
  objetivo_programa: number
  total_programa: number
  pct_consecucion_programa: number
  // Retención
  expectativa_finalizan: number
  pct_exito_estimado: number
  // Contratos
  contratos_firmados: number | null
  // Estado actual (live counts)
  hired: number
  training_finished: number
  to_place: number
  assigned: number
  in_training: number
  next_project: number
  offer_withdrawn: number
  offer_declined: number
  expelled: number
  transferred: number
  rejected_by_client: number
  // Éxito proyecto
  exito_total: number
  pct_exito_real: number
}

// Statuses that count toward total_programa
const PROGRAM_STATUSES = ['Hired', 'In Training', 'Training Finished', 'To Place', 'Assigned', 'Next Project']

export async function getPromoVistaGeneral(
  filter: 'active' | 'finished' | 'all' = 'active'
): Promise<PromoVistaGeneralRow[]> {
  let query = (supabase as any)
    .from('promotions_kpi')
    .select(
      'id, nombre, numero, modalidad, pais, coordinador, cliente, fecha_inicio, fecha_fin, objetivo_atraccion, objetivo_programa, expectativa_finalizan, pct_exito_estimado, contratos_firmados, is_active'
    )
    .order('numero', { ascending: true, nullsFirst: false })

  if (filter === 'active') query = query.eq('is_active', true)
  else if (filter === 'finished') query = query.eq('is_active', false)

  const { data: promotions, error } = await query as {
    data: Array<{
      id: string
      nombre: string
      numero: number | null
      modalidad: string | null
      pais: string | null
      coordinador: string | null
      cliente: string | null
      fecha_inicio: string | null
      fecha_fin: string | null
      objetivo_atraccion: number | null
      objetivo_programa: number | null
      expectativa_finalizan: number | null
      pct_exito_estimado: number | null
      contratos_firmados: number | null
      is_active: boolean
    }> | null
    error: unknown
  }

  if (error) {
    console.error('Error fetching promo vista general:', error)
    return []
  }

  if (!promotions || promotions.length === 0) return []

  const promoNames = promotions.map((p) => p.nombre)

  const { data: candidates } = await supabase
    .from('candidates_kpi')
    .select('promocion_nombre, current_status')
    .in('promocion_nombre', promoNames)
    .not('current_status', 'is', null)

  // Build status count maps per promo
  type StatusMap = Map<string, number>
  const statusMaps = new Map<string, StatusMap>()

  for (const c of candidates ?? []) {
    const promo = c.promocion_nombre!
    if (!statusMaps.has(promo)) statusMaps.set(promo, new Map())
    const map = statusMaps.get(promo)!
    const status = c.current_status ?? ''
    map.set(status, (map.get(status) ?? 0) + 1)
  }

  function countStatus(map: StatusMap | undefined, status: string): number {
    return map?.get(status) ?? 0
  }

  function countTotal(map: StatusMap | undefined): number {
    if (!map) return 0
    let total = 0
    for (const [, v] of map) total += v
    return total
  }

  function countProgram(map: StatusMap | undefined): number {
    if (!map) return 0
    let total = 0
    for (const s of PROGRAM_STATUSES) total += map.get(s) ?? 0
    return total
  }

  return promotions.map((promo) => {
    const map = statusMaps.get(promo.nombre)

    const objetivo_atraccion = promo.objetivo_atraccion ?? 0
    const total_aceptados = countTotal(map)
    const pct_consecucion_atraccion =
      objetivo_atraccion > 0
        ? Math.round((total_aceptados / objetivo_atraccion) * 10000) / 100
        : 0

    const objetivo_programa = promo.objetivo_programa ?? 0
    const total_programa = countProgram(map)
    const pct_consecucion_programa =
      objetivo_programa > 0
        ? Math.round((total_programa / objetivo_programa) * 10000) / 100
        : 0

    const hired = countStatus(map, 'Hired')
    const training_finished = countStatus(map, 'Training Finished')
    const to_place = countStatus(map, 'To Place')
    const assigned = countStatus(map, 'Assigned')
    const in_training = countStatus(map, 'In Training')
    const next_project = countStatus(map, 'Next Project')

    const exito_total = hired + training_finished + to_place + assigned + in_training + next_project
    const pct_exito_real =
      total_programa > 0
        ? Math.round((exito_total / total_programa) * 10000) / 100
        : 0

    return {
      id: promo.id,
      nombre: promo.nombre,
      numero: promo.numero,
      modalidad: promo.modalidad,
      pais: promo.pais,
      coordinador: promo.coordinador,
      cliente: promo.cliente,
      fecha_inicio: promo.fecha_inicio,
      fecha_fin: promo.fecha_fin,
      objetivo_atraccion,
      total_aceptados,
      pct_consecucion_atraccion,
      objetivo_programa,
      total_programa,
      pct_consecucion_programa,
      expectativa_finalizan: promo.expectativa_finalizan ?? 0,
      pct_exito_estimado: promo.pct_exito_estimado ?? 0,
      contratos_firmados: promo.contratos_firmados,
      hired,
      training_finished,
      to_place,
      assigned,
      in_training,
      next_project,
      offer_withdrawn: countStatus(map, 'Offer Withdrawn'),
      offer_declined: countStatus(map, 'Offer Declined'),
      expelled: countStatus(map, 'Expelled'),
      transferred: countStatus(map, 'Transferred'),
      rejected_by_client: countStatus(map, 'Rejected by client'),
      exito_total,
      pct_exito_real,
    }
  })
}

/** Returns all job vacancies a candidate has been linked to, ordered by fetched_at DESC. */
export async function getFormacionCandidateHistory(
  candidateId: string,
): Promise<FormacionCandidateHistory[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('candidate_job_history_kpi')
    .select('job_opening_id, job_opening_title, candidate_status_in_jo, association_type, fetched_at')
    .eq('candidate_id', candidateId)
    .order('fetched_at', { ascending: false }) as {
      data: FormacionCandidateHistory[] | null
      error: unknown
    }

  if (error) {
    console.error('Error fetching candidate history:', error)
    return []
  }

  return data ?? []
}

/** Returns all stage transitions for a candidate across all vacancies, ordered by changed_at DESC. */
export async function getFormacionCandidateStageHistory(
  candidateId: string,
): Promise<FormacionCandidateStageHistory[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('stage_history_kpi')
    .select('id, job_opening_id, from_status, to_status, changed_at')
    .eq('candidate_id', candidateId)
    .order('changed_at', { ascending: false }) as {
      data: FormacionCandidateStageHistory[] | null
      error: unknown
    }

  if (error) {
    console.error('Error fetching candidate stage history:', error)
    return []
  }

  return data ?? []
}

/** Returns notes timeline for a candidate, ordered by created_at DESC. */
export async function getFormacionCandidateNotes(
  candidateId: string,
): Promise<FormacionCandidateNote[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('candidate_notes_kpi')
    .select('id, note_title, note_content, author, is_system, created_at')
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false, nullsFirst: false }) as {
      data: FormacionCandidateNote[] | null
      error: unknown
    }

  if (error) {
    console.error('Error fetching candidate notes:', error)
    return []
  }

  return data ?? []
}
