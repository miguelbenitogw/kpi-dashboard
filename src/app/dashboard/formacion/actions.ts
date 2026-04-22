'use server'

import { supabaseAdmin } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface PromoMetadataUpdate {
  modalidad?: string | null
  pais?: string | null
  coordinador?: string | null
  cliente?: string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  objetivo_atraccion?: number | null
  objetivo_programa?: number | null
  expectativa_finalizan?: number | null
  pct_exito_estimado?: number | null
  contratos_firmados?: number | null
}

export async function updatePromoMetadata(
  nombre: string,
  data: PromoMetadataUpdate
) {
  const { error } = await supabaseAdmin
    .from('promotions_kpi')
    .update({ ...data, updated_at: new Date().toISOString() } as any)
    .eq('nombre', nombre)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/formacion')
  return { success: true }
}

export async function linkVacancyToPromo(
  promocionNombre: string,
  jobOpeningId: string
) {
  const { error } = await supabaseAdmin
    .from('promo_job_link_kpi')
    .upsert(
      { promocion_nombre: promocionNombre, job_opening_id: jobOpeningId },
      { onConflict: 'promocion_nombre,job_opening_id' }
    )

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/formacion')
  return { success: true }
}

export async function unlinkVacancyFromPromo(
  promocionNombre: string,
  jobOpeningId: string
) {
  const { error } = await supabaseAdmin
    .from('promo_job_link_kpi')
    .delete()
    .eq('promocion_nombre', promocionNombre)
    .eq('job_opening_id', jobOpeningId)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/formacion')
  return { success: true }
}

export async function searchAtraccionVacancies(query: string) {
  const { data, error } = await supabaseAdmin
    .from('job_openings_kpi')
    .select('id, title, status, date_opened, total_candidates')
    .ilike('title', `%${query}%`)
    .order('date_opened', { ascending: false, nullsFirst: false })
    .limit(20)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getPromoLinkedVacancies(promocionNombre: string) {
  const { data, error } = await supabaseAdmin
    .from('promo_job_link_kpi')
    .select('job_opening_id, job_openings_kpi(id, title, status, total_candidates, date_opened)')
    .eq('promocion_nombre', promocionNombre)

  if (error) throw new Error(error.message)
  return (data ?? []).map((r: any) => r.job_openings_kpi).filter(Boolean)
}
