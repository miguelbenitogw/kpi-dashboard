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
  // Payment enrichment
  pago_importe_total: number | null
  pago_importe_pendiente: number | null
  pago_importe_cobrado: number | null
  pago_fecha_cobro: string | null
  pago_estado: 'cobrado' | 'pendiente' | 'sin_datos'
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

  const dropouts = (dropoutsRes.data ?? []).map((d: any) => ({
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
    tags: byEmail.get(d.email?.toLowerCase().trim() ?? '') ?? byName.get(d.full_name?.toLowerCase().trim() ?? '') ?? [],
  }))

  // Enrich with payment data
  const emails = dropouts.map((d) => d.email).filter(Boolean) as string[]
  let pagosMap = new Map<string, { importe_total: number | null; importe_pendiente: number | null; importe_pagado_2024: number | null; importe_pagado_2025: number | null; importe_pagado_2026: number | null; fecha_cobro: string | null }>()

  if (emails.length > 0) {
    const { data: pagos } = await supabase
      .from('pagos_candidato_kpi')
      .select('email, importe_total, importe_pendiente, importe_pagado_2024, importe_pagado_2025, importe_pagado_2026, fecha_cobro')
      .in('email', emails)

    pagosMap = new Map((pagos ?? []).map((p: any) => [p.email, p]))
  }

  return dropouts.map((d): DropoutRow => {
    const pago = d.email ? pagosMap.get(d.email) ?? null : null
    const cobrado = pago
      ? (pago.importe_pagado_2024 ?? 0) + (pago.importe_pagado_2025 ?? 0) + (pago.importe_pagado_2026 ?? 0)
      : null

    let pago_estado: 'cobrado' | 'pendiente' | 'sin_datos' = 'sin_datos'
    if (pago) {
      if (pago.importe_total === null || pago.importe_total === 0) {
        pago_estado = 'sin_datos'
      } else if ((pago.importe_pendiente ?? 0) > 0) {
        pago_estado = 'pendiente'
      } else {
        pago_estado = 'cobrado'
      }
    }

    return {
      ...d,
      pago_importe_total: pago?.importe_total ?? null,
      pago_importe_pendiente: pago?.importe_pendiente ?? null,
      pago_importe_cobrado: cobrado,
      pago_fecha_cobro: pago?.fecha_cobro ?? null,
      pago_estado,
    }
  })
}
