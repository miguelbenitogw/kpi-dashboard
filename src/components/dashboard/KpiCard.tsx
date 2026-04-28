'use client'

import { type LucideIcon } from 'lucide-react'
import Sparkline from '@/components/shared/Sparkline'

// ─── Tipos ──────────────────────────────────────────────────────────────────

/** Status nuevo (diseño Clínico Cálido) */
type StatusNew = 'green' | 'warn' | 'danger'

/** Status legacy (sistema anterior) */
type StatusLegacy = 'good' | 'warning' | 'danger'

interface KpiCardProps {
  // Props nuevas (diseño Clínico Cálido)
  label?: string
  value?: string | number
  suffix?: string
  delta?: number
  deltaLabel?: string
  status?: StatusNew | StatusLegacy
  color?: string
  sparkSeries?: number[]
  onClick?: () => void

  // Props legacy (KpiCards.tsx actual)
  title?: string
  trend?: number
  trendLabel?: string
  icon?: LucideIcon

  // Extensibilidad
  [key: string]: unknown
}

// ─── Semáforo config ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<StatusNew, { dot: string; label: string; bg: string; color: string }> = {
  green: { dot: '#16a34a', label: 'VERDE',    bg: '#dcfce7', color: '#166534' },
  warn:  { dot: '#ca8a04', label: 'ATENCIÓN', bg: '#fef3c7', color: '#854d0e' },
  danger:{ dot: '#dc2626', label: 'RIESGO',   bg: '#fee2e2', color: '#991b1b' },
}

/** Mapea los valores legacy al nuevo sistema */
function normalizeStatus(status?: string): StatusNew | undefined {
  if (!status) return undefined
  if (status === 'good')    return 'green'
  if (status === 'warning') return 'warn'
  if (status === 'danger')  return 'danger'
  // Valores nuevos directos
  if (status === 'green' || status === 'warn') return status as StatusNew
  return undefined
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function KpiCard({
  // Nuevas
  label,
  value,
  suffix,
  delta,
  deltaLabel,
  status,
  color = '#1e4b9e',
  sparkSeries,
  onClick,
  // Legacy
  title,
  trend,
  trendLabel,
  icon: Icon,
}: KpiCardProps) {
  // Resolución de props: nuevo tiene prioridad, legacy como fallback
  const resolvedLabel  = label ?? title ?? ''
  const resolvedValue  = value ?? ''
  const resolvedDelta  = delta ?? trend
  const resolvedDeltaLabel = deltaLabel ?? trendLabel
  const resolvedStatus = normalizeStatus(status as string)

  const isPositive = resolvedDelta !== undefined && resolvedDelta >= 0
  const deltaColor = isPositive ? '#16a34a' : '#dc2626'
  const deltaArrow = isPositive ? '↑' : '↓'

  const statusCfg = resolvedStatus ? STATUS_CONFIG[resolvedStatus] : undefined

  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 12,
        padding: '14px 16px',
        border: '1px solid #e7e2d8',
        background: '#ffffff',
        borderLeft: `4px solid ${color}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={e => {
        if (!onClick) return
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'translateY(-2px)'
        el.style.boxShadow = '0 6px 16px rgba(30,75,158,0.08)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = ''
        el.style.boxShadow = ''
      }}
    >
      {/* Fila 1: label + badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: '#78716c',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {resolvedLabel}
        </span>

        {statusCfg && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              borderRadius: 99,
              fontSize: 9.5,
              fontWeight: 700,
              padding: '2px 7px',
              background: statusCfg.bg,
              color: statusCfg.color,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: statusCfg.dot,
              }}
            />
            {statusCfg.label}
          </span>
        )}

        {/* Icono legacy: si no hay badge status pero sí hay icono */}
        {!statusCfg && Icon && (
          <Icon
            style={{ width: 16, height: 16, color: color, flexShrink: 0 }}
          />
        )}
      </div>

      {/* Fila 2: valor + delta */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 30,
            fontWeight: 600,
            color: '#1c1917',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}
        >
          {resolvedValue}
        </span>

        {suffix && (
          <span style={{ fontSize: 16, color: '#78716c', fontWeight: 400 }}>
            {suffix}
          </span>
        )}

        {resolvedDelta !== undefined && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: deltaColor,
              marginLeft: 'auto',
            }}
          >
            {deltaArrow} {Math.abs(resolvedDelta)}{resolvedDeltaLabel ? resolvedDeltaLabel : '%'}
          </span>
        )}
      </div>

      {/* Fila 3: Sparkline */}
      <Sparkline
        series={sparkSeries ?? []}
        color={color}
        h={28}
      />
    </div>
  )
}
