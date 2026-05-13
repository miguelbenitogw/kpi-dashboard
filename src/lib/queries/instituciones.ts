import { supabase } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InstitutionContact {
  id: string
  institution_id: string
  contact_number: number
  nombre_cargo: string | null
  contacto: string | null
  feedback: string | null
}

export interface Institution {
  id: string
  profesion: string
  comunidad_autonoma: string | null
  universidad: string

  // Estado
  ticker_estado: string | null
  estado_charla: string | null
  comentarios: string | null
  mes_contactar_de_nuevo: string | null
  mensaje_programado: string | null

  // Información del contexto
  num_visitas: number | null
  años_visitas_ponentes: string | null
  alumnos_registrados_zoho: number | null
  tipo_evento_ultima_charla: string | null
  fecha_ultima_charla: string | null

  // Contacto facultad
  email_facultad: string | null
  telefono_facultad: string | null

  // Agenda
  ticker_agenda: string | null
  persona_contacto_agenda: string | null
  fecha_charla_visita: string | null
  tipo_evento: string | null

  // Actualización del evento
  num_asistentes_charla: number | null
  num_interesados_firmas: number | null
  global_worker_asiste: string | null
  recursos_entregados: string | null
  compañero_asiste: string | null

  // Centro
  ciudad: string | null
  tipo_centro: string | null
  web: string | null
  correos_profesores_web: string | null
  plazas_anio: number | null

  synced_at: string | null

  contacts: InstitutionContact[]
}

export interface InstitutionSummary {
  institutions: Institution[]
  byProfesion: Record<string, number>
  comunidades: string[]
  estadosCharla: string[]
  tiposEvento: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const INSTITUCION_PROFESIONES = [
  'ENFERMERÍA',
  'FISIOTERAPIA',
  'EDUCACIÓN INFANTIL',
  'VETERINARIA',
  'DENTISTAS',
  'ÓPTICA-OPTOMETRÍA',
  'TERAPIA OCUPACIONAL',
] as const

export type InstitucionProfesion = (typeof INSTITUCION_PROFESIONES)[number]

// ─── Query ────────────────────────────────────────────────────────────────────

export async function getInstitutions(): Promise<InstitutionSummary> {
  const { data, error } = await supabase
    .from('institutions_kpi')
    .select(
      `id, profesion, comunidad_autonoma, universidad,
       ticker_estado, estado_charla, comentarios, mes_contactar_de_nuevo, mensaje_programado,
       num_visitas, años_visitas_ponentes, alumnos_registrados_zoho,
       tipo_evento_ultima_charla, fecha_ultima_charla,
       email_facultad, telefono_facultad,
       ticker_agenda, persona_contacto_agenda, fecha_charla_visita, tipo_evento,
       num_asistentes_charla, num_interesados_firmas, global_worker_asiste,
       recursos_entregados, compañero_asiste,
       ciudad, tipo_centro, web, correos_profesores_web, plazas_anio,
       synced_at,
       institution_contacts_kpi (
         id, institution_id, contact_number, nombre_cargo, contacto, feedback
       )`,
    )
    .order('comunidad_autonoma', { ascending: true, nullsFirst: false })
    .order('universidad', { ascending: true })

  if (error) throw error

  const institutions: Institution[] = (data ?? []).map(row => ({
    ...row,
    contacts: ((row.institution_contacts_kpi ?? []) as InstitutionContact[]).sort(
      (a, b) => a.contact_number - b.contact_number,
    ),
  }))

  // Derived metadata
  const byProfesion: Record<string, number> = {}
  const comunidadesSet = new Set<string>()
  const estadosSet = new Set<string>()
  const tiposEventoSet = new Set<string>()

  for (const inst of institutions) {
    byProfesion[inst.profesion] = (byProfesion[inst.profesion] ?? 0) + 1
    if (inst.comunidad_autonoma) comunidadesSet.add(inst.comunidad_autonoma)
    if (inst.estado_charla) estadosSet.add(inst.estado_charla)
    if (inst.tipo_evento) tiposEventoSet.add(inst.tipo_evento)
  }

  return {
    institutions,
    byProfesion,
    comunidades: Array.from(comunidadesSet).sort(),
    estadosCharla: Array.from(estadosSet).sort(),
    tiposEvento: Array.from(tiposEventoSet).sort(),
  }
}
