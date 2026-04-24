'use server'

import { supabaseAdmin } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { MadreSheet } from '@/lib/queries/madre-sheets'

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
