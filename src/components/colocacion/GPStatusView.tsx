'use client'

import { useState, useEffect } from 'react'
import {
  getGPStatusBreakdown,
  getGPKommunerCandidates,
  type GPStatusBreakdownItem,
  type GPKommunerCandidate,
} from '@/lib/queries/colocacion'

// ── Color helpers ─────────────────────────────────────────────────────────────

interface StatusStyle { text: string; bg: string }

function getStatusStyle(status: string): StatusStyle {
  const s = status.toLowerCase()
  if (s.startsWith('hired')) return { text: '#15803d', bg: '#f0fdf4' }
  if (
    s.includes('interview') ||
    s.includes('presented') ||
    s.includes('out/on boarding') ||
    s.includes('onboarding')
  )
    return { text: '#1d4ed8', bg: '#eff6ff' }
  if (s.includes('working on it') || s.includes('registration ready'))
    return { text: '#b45309', bg: '#fffbeb' }
  if (s.includes('not ready') || s.includes('creating profile'))
    return { text: '#6b7280', bg: '#f3f4f6' }
  if (s.includes('resign')) return { text: '#dc2626', bg: '#fef2f2' }
  return { text: '#64748b', bg: '#f8fafc' }
}

// Priority order for Kommuner candidate table sort
const KOMMUNER_SORT_ORDER: Record<string, number> = {
  'Interview in process': 0,
  'Working on it': 1,
  'Presented to an Agency': 2,
}

function kommunerSortKey(candidate: GPKommunerCandidate): number {
  return KOMMUNER_SORT_ORDER[candidate.placement_status ?? ''] ?? 99
}

// Row highlight for Kommuner table
function getRowBg(status: string | null): string {
  if (!status) return 'transparent'
  if (status === 'Interview in process') return '#eff6ff'
  if (status.startsWith('Hired by Kommuner')) return '#f0fdf4'
  return 'transparent'
}

// ── Status definitions ────────────────────────────────────────────────────────

const STATUS_DEFINITIONS: { label: string; description: string }[] = [
  { label: 'Not ready to present', description: 'Perfil aún no preparado para presentar a empleadores' },
  { label: 'Working on it', description: 'Coordinador trabajando activamente en encontrar plaza' },
  { label: 'Interview in process', description: 'Entrevista activa con un empleador' },
  { label: 'Out/on boarding job', description: 'En proceso de incorporación laboral' },
  { label: 'Hired by Kommuner Fast', description: 'Contratado directamente por municipio (contrato permanente)' },
  { label: 'Hired by Kommuner temporary', description: 'Contratado por municipio (contrato temporal)' },
  { label: 'Hired by agency', description: 'Contratado a través de agencia de trabajo temporal' },
  { label: 'Resign', description: 'Renunció tras ser colocado' },
  { label: 'Registration ready', description: 'Registro completado, listo para presentar' },
  { label: 'Presented to an Agency', description: 'Presentado a una agencia, esperando respuesta' },
  { label: 'Creating profile', description: 'Creando/completando perfil profesional' },
]

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  promoFilter: string
}

export default function GPStatusView({ promoFilter }: Props) {
  const [breakdown, setBreakdown] = useState<{ items: GPStatusBreakdownItem[]; total: number }>({
    items: [],
    total: 0,
  })
  const [kommunerCandidates, setKommunerCandidates] = useState<GPKommunerCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [showDefs, setShowDefs] = useState(false)
  const [kommunerExpanded, setKommunerExpanded] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getGPStatusBreakdown(promoFilter || null),
      getGPKommunerCandidates(promoFilter || null),
    ]).then(([bd, kc]) => {
      setBreakdown(bd)
      const sorted = [...kc].sort((a, b) => kommunerSortKey(a) - kommunerSortKey(b))
      setKommunerCandidates(sorted)
      setLoading(false)
    })
  }, [promoFilter])

  const maxCount = breakdown.items.length > 0 ? breakdown.items[0].count : 1

  return (
    <div>
      {/* ── Part A: Placement status breakdown ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1c1917', margin: 0 }}>
            Estado de colocación
          </h3>
          <p style={{ fontSize: 12, color: '#78716c', marginTop: 2 }}>
            Breakdown por placement_status — candidatos activos.
          </p>
        </div>
        <button
          onClick={() => setShowDefs((v) => !v)}
          style={{
            fontSize: 13,
            color: '#78716c',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: 4,
            lineHeight: 1,
          }}
          title="Ver definiciones"
        >
          ⓘ
        </button>
      </div>

      {/* Definitions panel */}
      {showDefs && (
        <div
          style={{
            background: '#faf9f7',
            border: '1px solid #e7e2d8',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 14,
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 600, color: '#1c1917', marginBottom: 8 }}>
            Definiciones
          </p>
          <dl style={{ margin: 0 }}>
            {STATUS_DEFINITIONS.map((d) => {
              const style = getStatusStyle(d.label)
              return (
                <div key={d.label} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  <dt
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: style.text,
                      minWidth: 180,
                    }}
                  >
                    {d.label}
                  </dt>
                  <dd style={{ fontSize: 11, color: '#78716c', margin: 0 }}>
                    {d.description}
                  </dd>
                </div>
              )
            })}
          </dl>
        </div>
      )}

      {/* Bars */}
      {loading ? (
        <div style={{ fontSize: 13, color: '#a8a29e', textAlign: 'center', padding: '20px 0' }}>
          Cargando…
        </div>
      ) : breakdown.items.length === 0 ? (
        <div style={{ fontSize: 13, color: '#a8a29e', textAlign: 'center', padding: '20px 0' }}>
          Sin datos de placement para este filtro.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {breakdown.items.map((item) => {
            const style = getStatusStyle(item.status)
            const barWidth = Math.round((item.count / maxCount) * 100)
            return (
              <div key={item.status}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 3,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#1c1917', fontWeight: 500 }}>
                      {item.status}
                    </span>
                    {item.topClients.map((client) => (
                      <span
                        key={client}
                        style={{
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 10,
                          background: style.bg,
                          color: style.text,
                          border: `1px solid ${style.text}22`,
                          fontWeight: 500,
                        }}
                      >
                        {client}
                      </span>
                    ))}
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      color: '#78716c',
                      whiteSpace: 'nowrap',
                      marginLeft: 8,
                    }}
                  >
                    {item.count} &nbsp;
                    <span style={{ color: '#a8a29e' }}>{item.percentage}%</span>
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: '#f5f1ea',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${barWidth}%`,
                      borderRadius: 4,
                      background: style.text,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Part B: Kommuner candidates detail ── */}
      <div
        style={{
          borderTop: '1px solid #e7e2d8',
          paddingTop: 16,
          marginTop: 4,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
            cursor: 'pointer',
          }}
          onClick={() => setKommunerExpanded((v) => !v)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1c1917', margin: 0 }}>
              Candidatos con preferencia Kommuner
            </h3>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 10,
                background: '#eff6ff',
                color: '#1d4ed8',
              }}
            >
              {kommunerCandidates.length}
            </span>
          </div>
          <span style={{ fontSize: 12, color: '#a8a29e' }}>
            {kommunerExpanded ? '▲' : '▼'}
          </span>
        </div>

        {kommunerExpanded && (
          <>
            <p style={{ fontSize: 11, color: '#a8a29e', marginBottom: 10 }}>
              El tracking de presentaciones individuales no está disponible aún — se muestra el estado actual de placement.
            </p>

            {loading ? (
              <div style={{ fontSize: 13, color: '#a8a29e', textAlign: 'center', padding: '16px 0' }}>
                Cargando…
              </div>
            ) : kommunerCandidates.length === 0 ? (
              <div style={{ fontSize: 13, color: '#a8a29e', textAlign: 'center', padding: '16px 0' }}>
                Sin candidatos Kommuner para este filtro.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 11,
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e7e2d8' }}>
                      {['Nombre', 'Promo', 'Training Status', 'Placement Status', 'Cliente', 'Apps', 'Entrevistas'].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: '4px 8px',
                            textAlign: 'left',
                            color: '#78716c',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {kommunerCandidates.map((c) => {
                      const rowBg = getRowBg(c.placement_status)
                      const placementStyle = c.placement_status
                        ? getStatusStyle(c.placement_status)
                        : null
                      return (
                        <tr
                          key={c.id}
                          style={{
                            background: rowBg,
                            borderBottom: '1px solid #f5f1ea',
                          }}
                        >
                          <td style={{ padding: '5px 8px', color: '#1c1917', fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {c.full_name ?? '—'}
                          </td>
                          <td style={{ padding: '5px 8px', color: '#78716c', whiteSpace: 'nowrap' }}>
                            {c.promocion_nombre ?? '—'}
                          </td>
                          <td style={{ padding: '5px 8px', color: '#78716c', whiteSpace: 'nowrap' }}>
                            {c.gp_training_status ?? '—'}
                          </td>
                          <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>
                            {c.placement_status ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: 8,
                                  background: placementStyle?.bg,
                                  color: placementStyle?.text,
                                  fontWeight: 600,
                                  fontSize: 10,
                                }}
                              >
                                {c.placement_status}
                              </span>
                            ) : (
                              <span style={{ color: '#a8a29e' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '5px 8px', color: '#78716c', whiteSpace: 'nowrap' }}>
                            {c.placement_client ?? '—'}
                          </td>
                          <td style={{ padding: '5px 8px', color: '#78716c', textAlign: 'right' }}>
                            {c.gp_total_applications ?? '—'}
                          </td>
                          <td style={{ padding: '5px 8px', color: '#78716c', whiteSpace: 'nowrap' }}>
                            {c.gp_interviews_ratio ?? '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
