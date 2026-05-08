import { supabase } from '@/lib/supabase/client'

export interface PagoRow {
  id: string
  candidate_id: string | null
  promocion_nombre: string | null
  full_name: string
  email: string | null
  perfil: string | null
  coordinador: string | null
  modalidad: string | null
  estado: string | null
  fecha_viaje_noruega: string | null
  fecha_inicio_formacion: string | null
  fecha_abandono: string | null
  fase_abandono: string | null
  condiciones_fase: string | null
  precio_hora: number | null
  horas_cursadas: number | null
  precio_total: number | null
  autorizacion_tramitada: boolean | null
  precio_autorizacion: number | null
  importe_formacion_actual: number | null
  importe_formaciones_previas: number | null
  importe_piso_gw: number | null
  importe_devolucion_ayuda: number | null
  importe_autorizacion: number | null
  importe_total: number | null
  fecha_cobro: string | null
  importe_pagado_2024: number | null
  importe_pagado_2025: number | null
  importe_pagado_2026: number | null
  importe_pendiente: number | null
  condiciones_pago: string | null
  fecha_notificacion: string | null
  comentarios_coordinadores: string | null
  comentarios_contabilidad: string | null
  promociones_anteriores: Array<{ promo: string; anexo_firmado: boolean; precio: number }> | null
}

export async function getPagos(): Promise<PagoRow[]> {
  const { data, error } = await supabase
    .from('pagos_candidato_kpi')
    .select('*')
    .order('promocion_nombre', { ascending: false })
    .order('full_name', { ascending: true })
  if (error) { console.error('getPagos:', error); return [] }
  return (data ?? []) as PagoRow[]
}
