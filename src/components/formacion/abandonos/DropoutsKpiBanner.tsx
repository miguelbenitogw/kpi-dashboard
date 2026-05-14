'use client'

import type { DropoutRow } from '@/lib/queries/dropouts'

interface Props { rows: DropoutRow[] }

function formatEuros(n: number): string {
  if (n === 0) return '€0'
  return `€${n.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`
}

export default function DropoutsKpiBanner({ rows }: Props) {
  const total = rows.length

  const daysValues = rows
    .map((r) => r.dropout_days_of_training)
    .filter((v): v is number => v !== null && v > 0 && v < 1000)
  const avgDays = daysValues.length > 0
    ? Math.round(daysValues.reduce((a, b) => a + b, 0) / daysValues.length)
    : null

  const interestYes = rows.filter((r) => r.dropout_interest_future === 'Yes').length
  const interestPct = total > 0 ? Math.round((interestYes / total) * 100) : 0

  const tagCounts = new Map<string, number>()
  for (const r of rows) {
    for (const t of r.tags) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
    }
  }
  const topTag = Array.from(tagCounts.entries()).sort(([, a], [, b]) => b - a)[0]?.[0] ?? '—'

  const modOnline = rows.filter((r) => r.dropout_modality?.toLowerCase().includes('online')).length
  const modPresencial = rows.filter((r) => r.dropout_modality?.toLowerCase().includes('presencial') && !r.dropout_modality?.toLowerCase().includes('semi')).length
  const modSemipresencial = rows.filter((r) => r.dropout_modality?.toLowerCase().includes('semi')).length

  // Payment stats
  const cobrados = rows.filter((r) => r.pago_estado === 'cobrado')
  const parciales = rows.filter((r) => r.pago_estado === 'parcial')
  const pendientes = rows.filter((r) => r.pago_estado === 'pendiente')

  const totalCobrado = cobrados.reduce((acc, r) => acc + (r.pago_importe_total ?? 0), 0)
  const totalPendienteTotal = pendientes.reduce((acc, r) => acc + (r.pago_importe_pendiente ?? 0), 0)
  const totalPendienteParcial = parciales.reduce((acc, r) => acc + (r.pago_importe_pendiente ?? 0), 0)
  const totalDeudaActiva = totalPendienteTotal + totalPendienteParcial

  const cards: Array<{
    label: string
    value: string
    sub?: string
    color: string
    bg: string
    border: string
  }> = [
    {
      label: 'Total bajas',
      value: total.toLocaleString('es-AR'),
      color: '#dc2626',
      bg: '#fff1f2',
      border: '#fecdd3',
    },
    {
      label: 'Media días entrenados',
      value: avgDays !== null ? avgDays.toLocaleString('es-AR') : '—',
      color: '#1e4b9e',
      bg: '#eff6ff',
      border: '#bfdbfe',
    },
    {
      label: 'Con interés futuro',
      value: `${interestPct}%`,
      sub: `${interestYes} de ${total}`,
      color: '#15803d',
      bg: '#f0fdf4',
      border: '#bbf7d0',
    },
    {
      label: 'Canal dominante',
      value: topTag,
      color: '#7c3aed',
      bg: '#faf5ff',
      border: '#e9d5ff',
    },
    {
      label: 'Online',
      value: modOnline.toLocaleString('es-AR'),
      sub: total > 0 ? `${Math.round((modOnline / total) * 100)}%` : undefined,
      color: '#1e4b9e',
      bg: '#eff6ff',
      border: '#bfdbfe',
    },
    {
      label: 'Presencial',
      value: modPresencial.toLocaleString('es-AR'),
      sub: total > 0 ? `${Math.round((modPresencial / total) * 100)}%` : undefined,
      color: '#e55a2b',
      bg: '#fff7ed',
      border: '#fed7aa',
    },
    {
      label: 'Semipresencial',
      value: modSemipresencial.toLocaleString('es-AR'),
      sub: total > 0 ? `${Math.round((modSemipresencial / total) * 100)}%` : undefined,
      color: '#7c3aed',
      bg: '#faf5ff',
      border: '#e9d5ff',
    },
    {
      label: 'Cobrado íntegro',
      value: cobrados.length.toLocaleString('es-AR'),
      sub: cobrados.length > 0 ? formatEuros(totalCobrado) : undefined,
      color: '#15803d',
      bg: '#f0fdf4',
      border: '#bbf7d0',
    },
    {
      label: 'Pago parcial',
      value: parciales.length.toLocaleString('es-AR'),
      sub: parciales.length > 0 ? `${formatEuros(totalPendienteParcial)} pend.` : undefined,
      color: '#b45309',
      bg: '#fffbeb',
      border: '#fde68a',
    },
    {
      label: 'Sin ningún pago',
      value: pendientes.length.toLocaleString('es-AR'),
      sub: pendientes.length > 0 ? formatEuros(totalPendienteTotal) : undefined,
      color: '#be123c',
      bg: '#fff1f2',
      border: '#fecdd3',
    },
    {
      label: 'Deuda activa total',
      value: totalDeudaActiva > 0 ? formatEuros(totalDeudaActiva) : '—',
      sub: totalDeudaActiva > 0 ? `${parciales.length + pendientes.length} candidatos` : undefined,
      color: '#c2410c',
      bg: '#fff7ed',
      border: '#fed7aa',
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
      {cards.map((c) => (
        <div
          key={c.label}
          style={{
            background: c.bg,
            border: `1px solid ${c.border}`,
            borderRadius: 10,
            padding: '12px 14px',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#78716c' }}>
            {c.label}
          </p>
          <p style={{ margin: '6px 0 2px', fontSize: '1.4rem', fontWeight: 700, color: c.color, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.value}
          </p>
          {c.sub && (
            <p style={{ margin: 0, fontSize: 11, color: '#a8a29e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
