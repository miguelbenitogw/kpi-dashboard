'use client'

import { useState, useMemo } from 'react'
import type { GermanyDropoutStats, GermanyDropoutRow } from '@/lib/queries/germany'

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const T = {
  bg: '#f9f7f4',
  card: '#ffffff',
  border: '#e7e2d8',
  radius: '14px',
  text: '#1c1917',
  muted: '#78716c',
  accent: '#1e4b9e',
  orange: '#e55a2b',
  declined: { bg: '#fee2e2', color: '#dc2626' },
  withdrawn: { bg: '#fef3c7', color: '#d97706' },
  transferred: { bg: '#dbeafe', color: '#1d4ed8' },
  yes: { bg: '#dcfce7', color: '#16a34a' },
  no: { bg: '#fee2e2', color: '#dc2626' },
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  stats: GermanyDropoutStats
  initialRows: GermanyDropoutRow[]
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  bgColor?: string
  textColor?: string
}

function KpiCard({ label, value, sub, bgColor, textColor }: KpiCardProps) {
  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
    >
      <p style={{ margin: 0, fontSize: '11px', color: T.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: '2rem',
          fontWeight: 700,
          color: textColor ?? T.text,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ margin: 0, fontSize: '11px', color: T.muted }}>{sub}</p>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span style={{ color: T.muted, fontSize: '12px' }}>—</span>
  const s = status
  let style = { bg: '#f3f4f6', color: '#6b7280' }
  if (s === 'Offer Declined') style = T.declined
  else if (s === 'Offer Withdrawn') style = T.withdrawn
  else if (s === 'Transferred') style = T.transferred

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        background: style.bg,
        color: style.color,
        whiteSpace: 'nowrap',
      }}
    >
      {s}
    </span>
  )
}

function InterestBadge({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: T.muted, fontSize: '12px' }}>—</span>
  const style = value === 'Yes' ? T.yes : value === 'No' ? T.no : { bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        background: style.bg,
        color: style.color,
      }}
    >
      {value}
    </span>
  )
}

// Simple bar list (for reasons and profiles)
function BarList({ items, colorHex }: { items: { label: string; count: number }[]; colorHex: string }) {
  const max = Math.max(...items.map((i) => i.count), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ flex: 1, fontSize: '12px', color: T.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.label}>
            {item.label}
          </span>
          <div style={{ width: '100px', height: '6px', background: T.border, borderRadius: '3px', flexShrink: 0 }}>
            <div
              style={{
                width: `${Math.round((item.count / max) * 100)}%`,
                height: '100%',
                background: colorHex,
                borderRadius: '3px',
                transition: 'width 0.3s',
              }}
            />
          </div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: T.text, width: '20px', textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
            {item.count}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const ALL_PROMOS = 'Todas'
const ALL_STATUS = 'Todos'

export default function GermanyAbandonosView({ stats, initialRows }: Props) {
  const [filterPromo, setFilterPromo] = useState<string>(ALL_PROMOS)
  const [filterStatus, setFilterStatus] = useState<string>(ALL_STATUS)

  // Derive unique promos and statuses for selects
  const promoOptions = useMemo(() => {
    const nums = Array.from(new Set(initialRows.map((r) => r.promo_numero).filter((n): n is number => n !== null)))
    return nums.sort((a, b) => b - a).map(String)
  }, [initialRows])

  const statusOptions = ['Offer Declined', 'Offer Withdrawn', 'Transferred']

  // Filter rows client-side
  const filteredRows = useMemo(() => {
    return initialRows.filter((r) => {
      if (filterPromo !== ALL_PROMOS && String(r.promo_numero) !== filterPromo) return false
      if (filterStatus !== ALL_STATUS && r.status !== filterStatus) return false
      return true
    })
  }, [initialRows, filterPromo, filterStatus])

  const cardStyle: React.CSSProperties = {
    background: T.card,
    border: `1px solid ${T.border}`,
    borderRadius: T.radius,
    padding: '20px 24px',
  }

  const sectionTitleStyle: React.CSSProperties = {
    margin: '0 0 4px',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: T.text,
  }

  const sectionSubStyle: React.CSSProperties = {
    margin: '0 0 16px',
    fontSize: '11px',
    color: T.muted,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ------------------------------------------------------------------ */}
      {/* KPI Cards                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
        }}
      >
        <KpiCard
          label="Offer Declined"
          value={stats.total_offer_declined}
          sub="Nunca empezaron"
          textColor={T.declined.color}
        />
        <KpiCard
          label="Offer Withdrawn"
          value={stats.total_offer_withdrawn}
          sub="Abandonaron en formación"
          textColor={T.withdrawn.color}
        />
        <KpiCard
          label="Transferred"
          value={stats.total_transferred}
          sub="Pasaron a otra promo"
          textColor={T.transferred.color}
        />
        <KpiCard
          label="Días medios al abandonar"
          value={stats.avg_days_training !== null ? stats.avg_days_training : '—'}
          sub="Solo Offer Withdrawn"
          textColor={T.accent}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Charts row: Por Motivo | Por Perfil | Por Promo                     */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Por Motivo */}
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Por motivo de abandono</h2>
          <p style={sectionSubStyle}>Motivos declarados</p>
          {stats.by_reason.length === 0 ? (
            <p style={{ color: T.muted, fontSize: '12px' }}>Sin datos</p>
          ) : (
            <BarList
              items={stats.by_reason.map((r) => ({ label: r.reason, count: r.count }))}
              colorHex={T.orange}
            />
          )}
        </div>

        {/* Por Perfil */}
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Por perfil</h2>
          <p style={sectionSubStyle}>Tipo de candidato</p>
          {stats.by_profile.length === 0 ? (
            <p style={{ color: T.muted, fontSize: '12px' }}>Sin datos</p>
          ) : (
            <BarList
              items={stats.by_profile.map((r) => ({ label: r.profile, count: r.count }))}
              colorHex={T.accent}
            />
          )}
        </div>

        {/* Por Promo */}
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Por promoción</h2>
          <p style={sectionSubStyle}>Distribución por promo</p>
          {stats.by_promo.length === 0 ? (
            <p style={{ color: T.muted, fontSize: '12px' }}>Sin datos</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr>
                    {['Promo', 'Declined', 'Withdrawn', 'Transf.', 'Total'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '4px 8px 8px',
                          textAlign: h === 'Promo' ? 'left' : 'right',
                          fontWeight: 600,
                          color: T.muted,
                          fontSize: '11px',
                          borderBottom: `1px solid ${T.border}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.by_promo.map((row) => (
                    <tr key={row.promo_numero} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: '8px 8px', fontWeight: 600, color: T.text }}>
                        Promo {row.promo_numero}
                      </td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', color: T.declined.color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {row.offer_declined}
                      </td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', color: T.withdrawn.color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {row.offer_withdrawn}
                      </td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', color: T.transferred.color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {row.transferred}
                      </td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', color: T.text, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {row.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Interés futuro — mini strip                                          */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          ...cardStyle,
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: '11px', color: T.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Interés en volver
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: T.muted }}>¿Le interesa en el futuro?</p>
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: '1.75rem', fontWeight: 700, color: T.yes.color, fontVariantNumeric: 'tabular-nums' }}>
              {stats.interest_in_future_yes}
            </span>
            <span
              style={{
                display: 'inline-block',
                marginTop: '4px',
                padding: '2px 10px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 600,
                background: T.yes.bg,
                color: T.yes.color,
              }}
            >
              Yes
            </span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: '1.75rem', fontWeight: 700, color: T.no.color, fontVariantNumeric: 'tabular-nums' }}>
              {stats.interest_in_future_no}
            </span>
            <span
              style={{
                display: 'inline-block',
                marginTop: '4px',
                padding: '2px 10px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 600,
                background: T.no.bg,
                color: T.no.color,
              }}
            >
              No
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tabla detalle                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ ...sectionTitleStyle, marginBottom: '4px' }}>Detalle individual</h2>
            <p style={{ ...sectionSubStyle, margin: 0 }}>
              {filteredRows.length} registro{filteredRows.length !== 1 ? 's' : ''}
              {(filterPromo !== ALL_PROMOS || filterStatus !== ALL_STATUS) && ' (filtrado)'}
            </p>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <select
              value={filterPromo}
              onChange={(e) => setFilterPromo(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: `1px solid ${T.border}`,
                background: T.card,
                color: T.text,
                fontSize: '12px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value={ALL_PROMOS}>Todas las promos</option>
              {promoOptions.map((p) => (
                <option key={p} value={p}>Promo {p}</option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: `1px solid ${T.border}`,
                background: T.card,
                color: T.text,
                fontSize: '12px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value={ALL_STATUS}>Todos los status</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {(filterPromo !== ALL_PROMOS || filterStatus !== ALL_STATUS) && (
              <button
                onClick={() => { setFilterPromo(ALL_PROMOS); setFilterStatus(ALL_STATUS) }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${T.border}`,
                  background: 'transparent',
                  color: T.muted,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                {[
                  'Nombre', 'Promo', 'Status', 'Perfil', 'Modalidad',
                  'Días formación', 'Motivo', 'Interés futuro'
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: T.muted,
                      fontSize: '11px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{ padding: '32px', textAlign: 'center', color: T.muted, fontSize: '13px' }}
                  >
                    No hay registros con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: `1px solid ${T.border}`,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = '#f9f7f4'
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                    }}
                  >
                    <td style={{ padding: '10px 12px', color: T.text, fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {row.nombre ?? '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: T.muted, whiteSpace: 'nowrap' }}>
                      {row.promo_numero !== null ? `Promo ${row.promo_numero}` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <StatusBadge status={row.status} />
                    </td>
                    <td style={{ padding: '10px 12px', color: T.text, whiteSpace: 'nowrap' }}>
                      {row.profile ?? '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: T.muted, whiteSpace: 'nowrap' }}>
                      {row.modality ?? '—'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: T.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {row.days_of_training !== null ? row.days_of_training : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: T.text, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span title={row.reason_for_dropout ?? undefined}>
                        {row.reason_for_dropout ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <InterestBadge value={row.interest_in_future} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
