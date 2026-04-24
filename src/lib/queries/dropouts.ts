import { supabase } from '@/lib/supabase/client'

export interface DropoutRow {
  id: string
  full_name: string | null
  email: string | null
  nationality: string | null
  promocion_nombre: string | null
  sheet_status: string | null
  dropout_reason: string | null
  dropout_date: string | null
  dropout_language_level: string | null
  dropout_interest_future: string | null
  dropout_days_of_training: number | null
  dropout_modality: string | null
  dropout_notes: string | null
  tags: string[]
}

export async function getDropoutsWithTags(): Promise<DropoutRow[]> {
  const [dropoutsRes, candidatesRes] = await Promise.all([
    (supabase as any)
      .from('promo_students_kpi')
      .select(
        'id, full_name, email, nationality, promocion_nombre, sheet_status, dropout_reason, dropout_date, dropout_language_level, dropout_interest_future, dropout_days_of_training, dropout_modality, dropout_notes',
      )
      .eq('tab_name', 'Dropouts'),

    supabase
      .from('candidates_kpi')
      .select('email, full_name, tags')
      .not('tags', 'is', null),
  ])

  if (dropoutsRes.error) {
    console.error('[dropouts] fetch error:', dropoutsRes.error)
    return []
  }

  const byEmail = new Map<string, string[]>()
  const byName = new Map<string, string[]>()

  for (const c of candidatesRes.data ?? []) {
    const tags: string[] = Array.isArray(c.tags) ? c.tags : []
    if (c.email) byEmail.set(c.email.toLowerCase().trim(), tags)
    if (c.full_name) byName.set(c.full_name.toLowerCase().trim(), tags)
  }

  return (dropoutsRes.data ?? []).map((d: any): DropoutRow => {
    const emailKey = d.email?.toLowerCase().trim() ?? ''
    const nameKey = d.full_name?.toLowerCase().trim() ?? ''
    const tags = byEmail.get(emailKey) ?? byName.get(nameKey) ?? []

    return {
      id: d.id,
      full_name: d.full_name ?? null,
      email: d.email ?? null,
      nationality: d.nationality ?? null,
      promocion_nombre: d.promocion_nombre ?? null,
      sheet_status: d.sheet_status ?? null,
      dropout_reason: d.dropout_reason ?? null,
      dropout_date: d.dropout_date ?? null,
      dropout_language_level: d.dropout_language_level ?? null,
      dropout_interest_future: d.dropout_interest_future ?? null,
      dropout_days_of_training: d.dropout_days_of_training ?? null,
      dropout_modality: d.dropout_modality ?? null,
      dropout_notes: d.dropout_notes ?? null,
      tags,
    }
  })
}
