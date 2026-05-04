'use server'

import { supabaseAdmin } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { MadreSheet } from '@/lib/queries/madre-sheets'

export async function setVacantePrincipalAction(
  vacancyId: string,
): Promise<{ ok: boolean; error?: string }> {
  // 1. Obtener tipo_profesional de la vacante
  const { data: vacancy, error: fetchError } = await (supabaseAdmin as any)
    .from('job_openings_kpi')
    .select('id, tipo_profesional')
    .eq('id', vacancyId)
    .single()

  if (fetchError || !vacancy) {
    const msg = fetchError?.message ?? 'Vacante no encontrada'
    console.error('[actions] setVacantePrincipalAction fetch error:', msg)
    return { ok: false, error: msg }
  }

  const tipoProfesional = (vacancy as { tipo_profesional: string }).tipo_profesional

  // 2. Desmarcar todas las del mismo tipo
  const { error: unsetError } = await (supabaseAdmin as any)
    .from('job_openings_kpi')
    .update({ is_vacante_principal: false })
    .eq('tipo_profesional', tipoProfesional)

  if (unsetError) {
    console.error('[actions] setVacantePrincipalAction unset error:', unsetError)
    return { ok: false, error: unsetError.message }
  }

  // 3. Marcar la vacante indicada
  const { error: setError } = await (supabaseAdmin as any)
    .from('job_openings_kpi')
    .update({ is_vacante_principal: true })
    .eq('id', vacancyId)

  if (setError) {
    console.error('[actions] setVacantePrincipalAction set error:', setError)
    return { ok: false, error: setError.message }
  }

  revalidatePath('/dashboard/configuracion')
  revalidatePath('/dashboard')

  return { ok: true }
}

export async function crearTipoProfesionalAction(input: {
  slug: string
  label: string
}): Promise<{ ok: boolean; error?: string }> {
  const slug = input.slug.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  const label = input.label.trim()

  if (!slug || !label) return { ok: false, error: 'Slug y label son obligatorios' }

  const { error } = await (supabaseAdmin as any)
    .from('tipos_profesional_kpi')
    .insert({ slug, label })

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/dashboard/configuracion')
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function getMadreSheetsAction(): Promise<MadreSheet[]> {
  const { data, error } = await (supabaseAdmin
    .from('madre_sheets_kpi') as any)
    .select('*')
    .order('year', { ascending: false })

  if (error) throw new Error(`Failed to fetch madre sheets: ${error.message}`)
  return (data ?? []) as MadreSheet[]
}

export async function registerMadreSheetAction(
  sheetUrl: string,
  label: string,
  year: number | null,
): Promise<void> {
  const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  const sheetId = match?.[1] ?? null

  if (!sheetId) {
    throw new Error('No se pudo extraer el ID del sheet desde la URL proporcionada.')
  }

  const { error } = await (supabaseAdmin
    .from('madre_sheets_kpi') as any)
    .insert({
      sheet_id: sheetId,
      label,
      year,
      is_active: true,
    })

  if (error) throw new Error(`Failed to register madre sheet: ${error.message}`)
  revalidatePath('/dashboard/configuracion')
}

export async function unregisterMadreSheetAction(id: string): Promise<void> {
  const { error } = await (supabaseAdmin
    .from('madre_sheets_kpi') as any)
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Failed to unregister madre sheet: ${error.message}`)
  revalidatePath('/dashboard/configuracion')
}
