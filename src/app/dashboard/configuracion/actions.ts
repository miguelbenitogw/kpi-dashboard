'use server'

import { supabaseAdmin } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { MadreSheet } from '@/lib/queries/madre-sheets'

// ---------------------------------------------------------------------------
// Dropout sheets
// ---------------------------------------------------------------------------

export interface DropoutSheet {
  id: string
  sheet_id: string
  label: string
  programa: string | null
  promo_numero: number | null
  tab_name: string
  is_active: boolean
  created_at: string
}

export async function getDropoutSheetsAction(): Promise<DropoutSheet[]> {
  const { data, error } = await (supabaseAdmin
    .from('dropout_sheets_kpi') as any)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch dropout sheets: ${error.message}`)
  return (data ?? []) as DropoutSheet[]
}

export async function registerDropoutSheetAction(input: {
  sheetUrl: string
  label: string
  programa: string | null
  promo_numero: number | null
  tab_name: string
}): Promise<void> {
  const match = input.sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  const sheetId = match?.[1] ?? null

  if (!sheetId) {
    throw new Error('No se pudo extraer el ID del sheet desde la URL proporcionada.')
  }

  const { error } = await (supabaseAdmin
    .from('dropout_sheets_kpi') as any)
    .insert({
      sheet_id: sheetId,
      label: input.label.trim(),
      programa: input.programa || null,
      promo_numero: input.promo_numero ?? null,
      tab_name: input.tab_name.trim() || 'Dropouts',
      is_active: true,
    })

  if (error) throw new Error(`Failed to register dropout sheet: ${error.message}`)
  revalidatePath('/dashboard/configuracion')
}

export async function unregisterDropoutSheetAction(id: string): Promise<void> {
  const { error } = await (supabaseAdmin
    .from('dropout_sheets_kpi') as any)
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Failed to unregister dropout sheet: ${error.message}`)
  revalidatePath('/dashboard/configuracion')
}

/**
 * Toggle is_vacante_principal for a single vacancy.
 *
 * Scoping rule: "una favorita por (tipo_profesional, pais_destino)".
 * - If currentValue === true  → simply unmark this vacancy (toggle off).
 * - If currentValue === false → unmark all others with the same
 *   (tipo_profesional + pais_destino), then mark this one (toggle on).
 */
export async function toggleVacantePrincipalAction(
  vacancyId: string,
  currentValue: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (currentValue) {
    // ── Toggle OFF: just unmark this vacancy ───────────────────────────────
    const { error } = await (supabaseAdmin as any)
      .from('job_openings_kpi')
      .update({ is_vacante_principal: false })
      .eq('id', vacancyId)

    if (error) {
      console.error('[actions] toggleVacantePrincipalAction unmark error:', error)
      return { ok: false, error: error.message }
    }
  } else {
    // ── Toggle ON: unmark same (tipo_profesional + pais_destino), mark this ─
    const { data: vacancy, error: fetchError } = await (supabaseAdmin as any)
      .from('job_openings_kpi')
      .select('id, tipo_profesional, pais_destino')
      .eq('id', vacancyId)
      .single()

    if (fetchError || !vacancy) {
      const msg = (fetchError as { message?: string } | null)?.message ?? 'Vacante no encontrada'
      console.error('[actions] toggleVacantePrincipalAction fetch error:', msg)
      return { ok: false, error: msg }
    }

    const { tipo_profesional, pais_destino } = vacancy as {
      tipo_profesional: string
      pais_destino: string | null
    }

    // Unmark vacancies with same tipo_profesional + pais_destino
    const unsetQuery = (supabaseAdmin as any)
      .from('job_openings_kpi')
      .update({ is_vacante_principal: false })
      .eq('tipo_profesional', tipo_profesional)

    const { error: unsetError } = pais_destino
      ? await unsetQuery.eq('pais_destino', pais_destino)
      : await unsetQuery.is('pais_destino', null)

    if (unsetError) {
      console.error('[actions] toggleVacantePrincipalAction unset error:', unsetError)
      return { ok: false, error: unsetError.message }
    }

    // Mark the target vacancy
    const { error: setError } = await (supabaseAdmin as any)
      .from('job_openings_kpi')
      .update({ is_vacante_principal: true })
      .eq('id', vacancyId)

    if (setError) {
      console.error('[actions] toggleVacantePrincipalAction set error:', setError)
      return { ok: false, error: setError.message }
    }
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
