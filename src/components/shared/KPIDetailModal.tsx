'use client'

import { useEffect } from 'react'
import Sparkline from './Sparkline'

type StatusType = 'green' | 'warn' | 'danger'

interface PromoBreakdown {
  name: string
  value: number
  label?: string
}

interface KPIDetailModalProps {
  open: boolean
  onClose: () => void
  label: string
  formula?: string
  value: string | number
  suffix?: string
  delta?: number
  deltaLabel?: string
  status?: StatusType
  color?: string
  sparkSeries?: number[]
  sparkLabels?: string[]
  breakdown?: PromoBreakdown[]
}

const SEMA = {
  green:  { dot: '#16a34a', label: 'VERDE',    bg: '#dcfce7', color: '#166534', desc: 'Indicador dentro de parámetros' },
  warn:   { dot: '#ca8a04', label: 'ATENCIÓN', bg: '#fef3c7', color: '#854d0e', desc: 'Requiere seguimiento' },
  danger: { dot: '#dc2626', label: 'RIESGO',   bg: '#fee2e2', color: '#991b1b', desc: 'Acción recomendada' },
}

export default function KPIDetailModal({
  open,
  onClose,
  label,
  formula,
  value,
  suffix,
  delta,
  deltaLabel,
  status = 'green',
  color = '#1e4b9e',
  sparkSeries,
  sparkLabels,
  breakdown,
}: KPIDetailModalProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const sema = SEMA[status]

  const hasSpark = sparkSeries && sparkSeries.length >= 2
  const hasBreakdown = breakdown && breakdown.length > 0

  const deltaSign = delta !== undefined && delta > 0 ? '+' : ''
  const deltaColor =
    delta === undefined ? '#78716c'
    : delta > 0 ? '#16a34a'
    : delta < 0 ? '#dc2626'
    : '#78716c'

  const breakdownMax = hasBreakdown
    ? Math.max(...breakdown!.map((b) => b.value))
    : 1

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(28,25,23,0.5)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'kpiOverlayIn 150ms ease',
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 720,
          maxWidth: 'calc(100vw - 32px)',
          borderRadius: 14,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#fff',
          boxShadow: '0 30px 80px rgba(0,0,0,0.25)',
          position: 'relative',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 32,
            height: 32,
            borderRadius: 8,
            border: '1px solid #e7e2d8',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            color: '#78716c',
            lineHeight: 1,
            zIndex: 1,
          }}
        >
          ×
        </button>

        {/* Header with left color border */}
        <div
          style={{
            borderLeft: `4px solid ${color}`,
            padding: '24px 56px 24px 24px',
            borderBottom: '1px solid #f0ebe2',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: '#1c1917',
                  lineHeight: 1.25,
                  marginBottom: formula ? 6 : 0,
                }}
              >
                {label}
              </div>
              {formula && (
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 12.5,
                    color: '#78716c',
                    lineHeight: 1.4,
                  }}
                >
                  {formula}
                </div>
              )}
            </div>

            {/* Semáforo badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 99,
                background: sema.bg,
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: sema.dot,
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: 11, fontWeight: 700, color: sema.color, letterSpacing: '0.05em' }}>
                {sema.label}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Valor actual + delta */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <span
              style={{
                fontSize: 54,
                fontWeight: 600,
                color: '#1c1917',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {value}
            </span>
            {suffix && (
              <span style={{ fontSize: 24, color: '#78716c', lineHeight: 1, paddingBottom: 6 }}>
                {suffix}
              </span>
            )}
            {delta !== undefined && (
              <span
                style={{
                  fontSize: 14,
                  color: deltaColor,
                  lineHeight: 1,
                  paddingBottom: 10,
                  fontWeight: 500,
                }}
              >
                {deltaSign}{delta}{deltaLabel ? ` ${deltaLabel}` : ''}
              </span>
            )}
          </div>

          {/* Status box */}
          <div
            style={{
              background: sema.bg,
              borderRadius: 10,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: sema.dot,
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 13, color: sema.color, fontWeight: 500 }}>
              {sema.desc}
            </span>
          </div>

          {/* Sparkline grande */}
          {hasSpark && (
            <div
              style={{
                background: '#f5f1ea',
                borderRadius: 10,
                padding: '16px 16px 12px',
              }}
            >
              <Sparkline series={sparkSeries!} color={color} h={80} />
              {sparkLabels && sparkLabels.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: 8,
                  }}
                >
                  {sparkLabels.map((lbl, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 11,
                        color: '#a8a29e',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {lbl}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Breakdown por promoción */}
          {hasBreakdown && (
            <div style={{ borderTop: '1px solid #e7e2d8', paddingTop: 16 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#78716c',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  marginBottom: 14,
                }}
              >
                Desglose por promoción
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {breakdown!.map((item) => {
                  const pct = breakdownMax > 0 ? (item.value / breakdownMax) * 100 : 0
                  return (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Nombre promo */}
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: 12,
                          color: '#7c3aed',
                          fontWeight: 600,
                          width: 44,
                          flexShrink: 0,
                        }}
                      >
                        {item.name}
                      </span>

                      {/* Barra proporcional */}
                      <div
                        style={{
                          flex: 1,
                          height: 8,
                          borderRadius: 99,
                          background: '#e7e2d8',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            borderRadius: 99,
                            background: color,
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>

                      {/* Valor numérico */}
                      <span
                        style={{
                          fontSize: 12,
                          color: '#1c1917',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 500,
                          width: 56,
                          textAlign: 'right',
                          flexShrink: 0,
                        }}
                      >
                        {item.label ?? item.value}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes kpiOverlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
