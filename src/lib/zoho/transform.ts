// Real field mappings from Zoho Recruit API

export function transformCandidate(zoho: Record<string, unknown>) {
  return {
    id: String(zoho.id),
    full_name: (zoho.Full_Name as string) || null,
    email: (zoho.Email as string) || null,
    phone: (zoho.Phone as string) || (zoho.Mobile as string) || null,
    current_status: (zoho.Candidate_Status as string) || null,
    candidate_stage: (zoho.Candidate_Stage as string) || null,
    // Candidate_Owner is an object: { name, id }
    owner:
      ((zoho.Candidate_Owner as Record<string, unknown>)?.name as string | null) ?? null,
    source: (zoho.Source as string) || (zoho.Origin as string) || null,
    nationality: (zoho.Nacionalidad_Nationality as string) || null,
    native_language: (zoho.Idioma_nativo_Native_Language as string) || null,
    english_level: (zoho.Nivel_de_Ingl_s_English_Language as string) || null,
    german_level: (zoho.Nivel_de_Alem_n_German_Language as string) || null,
    work_permit: (zoho.Permiso_de_trabajo_Work_permit as string) || null,
    created_time: (zoho.Created_Time as string) || null,
    modified_time:
      (zoho.Updated_On as string) || (zoho.Modified_Time as string) || null,
    last_activity_time: (zoho.Last_Activity_Time as string) || null,
    global_status: null as string | null,
  }
}

// Strip diacritics for accent-insensitive tag matching
function normalizeStr(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

export function transformJobOpening(zoho: Record<string, unknown>) {
  const clientName = zoho.Client_Name as Record<string, unknown> | string | null

  const title =
    (zoho.Job_Opening_Name as string) || (zoho.Posting_Title as string) || ''

  // Tags: Zoho returns Associated_Tags as { name, id, color_code }[]
  const rawTags = zoho.Associated_Tags as Array<string | { name: string }> | null | undefined
  const tags: string[] = (rawTags ?? [])
    .map(t => (typeof t === 'string' ? t : ((t as { name: string }).name ?? '')))
    .filter(Boolean)

  // es_proceso_atraccion_actual: tag contains "proceso" AND "atrac" (accent-insensitive)
  const esProcesoAtraccionActual = tags.some(t => {
    const n = normalizeStr(t)
    return n.includes('proceso') && n.includes('atrac')
  })

  // category derived from title — promo → rendimiento, default atraccion
  const category: string = normalizeStr(title).includes('promo') ? 'rendimiento' : 'atraccion'

  return {
    id: String(zoho.id),
    title,
    status: (zoho.Job_Opening_Status as string) || null,
    date_opened: (zoho.Date_Opened as string) || null,
    // Client_Name is an object: { name, id }
    client_name:
      typeof clientName === 'object' && clientName !== null
        ? (clientName.name as string) || null
        : (clientName as string) || null,
    // Account_Manager is an object: { name, id }
    owner:
      ((zoho.Account_Manager as Record<string, unknown>)?.name as string | null) ?? null,
    total_candidates: (zoho.No_of_Candidates_Associated as number) || 0,
    hired_count: (zoho.No_of_Candidates_Hired as number) || 0,
    is_active:
      zoho.Job_Opening_Status === 'In-progress' ||
      zoho.Job_Opening_Status === 'Open',
    is_visible:
      zoho.Publish === true || zoho.Keep_on_Career_Site === true,
    // New fields (migration 015)
    tags,
    job_description: (zoho.Job_Description as string) || null,
    es_proceso_atraccion_actual: esProcesoAtraccionActual,
    category,
    tipo_profesional: 'otro' as const,
  }
}

// Terminal statuses — re-exported here for backwards compat; canonical source is @/lib/constants
export { TERMINAL_STATUSES } from '@/lib/constants'

// All valid candidate statuses from Zoho
export const ALL_STATUSES = [
  'Associated',
  'Check Interest',
  'Rejected',
  'First Call',
  'Second Call',
  'On Hold',
  'No Answer',
  'Next Project',
  'New',
  'Waiting for Evaluation',
  'Not Valid',
  'Interview in Progress',
  'Interview to be Scheduled',
  'Interview-Scheduled',
  'Rejected for Interview',
  'Approved for interview',
  'Approved by client',
  'Rejected by client',
  'Offer-Declined',
  'Waiting for Consensus',
  'No Show',
  'To Place',
  'No supera B1',
  'Submitted-to-client',
  'Non si presenta',
  'Offer-Withdrawn',
  'Un-Qualified',
  'Expelled',
  'Out of Network',
  'In Training',
  'Transferred',
  'In Training out of GW',
  'Hired',
  'Permanent Kommune',
  'Temporary Kommune',
  'Permanent Agency',
  'Temporary Agency',
  'Not in Norway/Germany',
  'Open to Opportunities',
  'Recolocation Process',
  'Assigned',
  'Stand-by',
  'Training Finished',
  'To-be-Offered',
  'Offer-Accepted',
  'Forward-to-Onboarding',
  'Oferta realizada',
  'Converted - Temp',
  'Converted - Employee',
]

// Status change detection
export function extractStatusChange(
  candidateId: string,
  previousStatus: string | null,
  currentStatus: string,
  modifiedTime: string
) {
  if (!previousStatus || previousStatus === currentStatus) return null
  return {
    candidate_id: candidateId,
    from_status: previousStatus,
    to_status: currentStatus,
    changed_at: modifiedTime,
  }
}
