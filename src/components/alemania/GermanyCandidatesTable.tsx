'use client'

import { useState, useTransition, useCallback, useEffect } from 'react'
import type { GermanyCandidateRow } from '@/lib/queries/germany'

interface Props {
  initialRows: GermanyCandidateRow[]
  initialTotal: number
  promos: number[]
  tiposPerfil: string[]
  estados: string[]
  profesiones: string[]
  externalPromo?: number | null
  onClearExternalPromo?: () => void
  onCandidateClick?: (zohoId: string, nombre: string | null) => void
}

// Status badge colors
function estadoBadge(estado: string | null) {
  if (!estado) return { bg: '#f5f1ea', color: '#78716c' }
  const e = estado.toLowerCase()
  if (e.includes('hired')) return { bg: '#dcfce7', color: '#16a34a' }
  if (e.includes('in training') || e.includes('standby') || e.includes('stand by'))
    return { bg: '#dbeafe', color: '#1d4ed8' }
  if (e.includes('to place') || e.includes('iqz') || e.includes('berlín') || e.includes('berlin'))
    return { bg: '#fef3c7', color: '#d97706' }
  if (
    e.includes('fuera') ||
    e.includes('withdrawn') ||
    e.includes('expelled')
  )
    return { bg: '#fee2e2', color: '#dc2626' }
  return { bg: '#f5f1ea', color: '#57534e' }
}

const SELECT_STYLE: React.CSSProperties = {
  padding: '7px 10px',
  borderRadius: '8px',
  border: '1px solid #e7e2d8',
  background: '#ffffff',
  color: '#1c1917',
  fontSize: '13px',
  cursor: 'pointer',
  outline: 'none',
}

const TH_STYLE: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: '#78716c',
  borderBottom: '1px solid #e7e2d8',
  whiteSpace: 'nowrap' as const,
  background: '#f9f7f4',
}

const TD_STYLE: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '13px',
  color: '#1c1917',
  borderBottom: '1px solid #e7e2d8',
  verticalAlign: 'middle',
}

export default function GermanyCandidatesTable({
  initialRows,
  initialTotal,
  promos,
  tiposPerfil,
  estados,
  profesiones,
  externalPromo,
  onClearExternalPromo,
  onCandidateClick,
}: Props) {
  const [rows, setRows] = useState<GermanyCandidateRow[]>(initialRows)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [promoFilter, setPromoFilter] = useState<string>('')
  const [tipoPerfilFilter, setTipoPerfilFilter] = useState<string>('')
  const [estadoFilter, setEstadoFilter] = useState<string>('')
  const [profesionFilter, setProfesionFilter] = useState<string>('')
  const [isPending, startTransition] = useTransition()

  const PAGE_SIZE = 50

  const fetchData = useCallback(
    (newPage: number, promo: string, tipoPerfil: string, estado: string, profesion: string) => {
      startTransition(async () => {
        const params = new URLSearchParams()
        params.set('page', String(newPage))
        params.set('pageSize', String(PAGE_SIZE))
        if (promo) params.set('promoNumero', promo)
        if (tipoPerfil) params.set('tipoPerfil', tipoPerfil)
        if (estado) params.set('estado', estado)
        if (profesion) params.set('profesion', profesion)

        const res = await fetch(`/api/germany/candidates?${params.toString()}`)
        if (!res.ok) return
        const json = await res.json()
        setRows(json.rows)
        setTotal(json.total)
        setPage(newPage)
      })
    },
    []
  )

  // Reaccionar a cambios de filtro externo por promo
  useEffect(() => {
    const promoStr = externalPromo != null ? String(externalPromo) : ''
    setPromoFilter(promoStr)
    fetchData(1, promoStr, tipoPerfilFilter, estadoFilter, profesionFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPromo])

  function handleFilterChange(
    newPromo: string,
    newTipo: string,
    newEstado: string,
    newProfesion: string
  ) {
    setPromoFilter(newPromo)
    setTipoPerfilFilter(newTipo)
    setEstadoFilter(newEstado)
    setProfesionFilter(newProfesion)
    fetchData(1, newPromo, newTipo, newEstado, newProfesion)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      {/* Chip de filtro externo activo */}
      {externalPromo != null && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px',
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '12px',
            color: '#d97706',
            fontWeight: 500,
          }}
        >
          <span>Filtrando por Promo #{externalPromo}</span>
          <button
            onClick={() => onClearExternalPromo?.()}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#d97706',
              fontSize: '14px',
              fontWeight: 700,
              padding: '0 2px',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Quitar filtro"
          >
            ×
          </button>
          <span style={{ color: '#f5a855', fontSize: '11px' }}>Quitar filtro</span>
        </div>
      )}

      {/* Filtros */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          marginBottom: '16px',
          alignItems: 'center',
        }}
      >
        <select
          style={{
            ...SELECT_STYLE,
            ...(externalPromo != null ? { opacity: 0.6 } : {}),
          }}
          value={promoFilter}
          disabled={externalPromo != null}
          onChange={(e) =>
            handleFilterChange(e.target.value, tipoPerfilFilter, estadoFilter, profesionFilter)
          }
        >
          <option value="">Todas las promos</option>
          {promos.map((p) => (
            <option key={p} value={String(p)}>
              Promo #{p}
            </option>
          ))}
        </select>

        <select
          style={SELECT_STYLE}
          value={tipoPerfilFilter}
          onChange={(e) =>
            handleFilterChange(promoFilter, e.target.value, estadoFilter, profesionFilter)
          }
        >
          <option value="">Todos los perfiles</option>
          {tiposPerfil.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          style={SELECT_STYLE}
          value={estadoFilter}
          onChange={(e) =>
            handleFilterChange(promoFilter, tipoPerfilFilter, e.target.value, profesionFilter)
          }
        >
          <option value="">Todos los estados</option>
          {estados.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>

        <select
          style={SELECT_STYLE}
          value={profesionFilter}
          onChange={(e) =>
            handleFilterChange(promoFilter, tipoPerfilFilter, estadoFilter, e.target.value)
          }
        >
          <option value="">Todas las profesiones</option>
          {profesiones.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#78716c' }}>
          {total} candidato{total !== 1 ? 's' : ''}
          {(promoFilter || tipoPerfilFilter || estadoFilter || profesionFilter) ? ' (filtrado)' : ''}
        </span>
      </div>

      {/* Tabla */}
      <div
        style={{
          overflowX: 'auto',
          opacity: isPending ? 0.6 : 1,
          transition: 'opacity 200ms',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH_STYLE}>Nombre</th>
              <th style={TH_STYLE}>Promo</th>
              <th style={TH_STYLE}>Tipo Perfil</th>
              <th style={TH_STYLE}>Estado</th>
              <th style={TH_STYLE}>Cliente</th>
              <th style={TH_STYLE}>Ciudad / Kita</th>
              <th style={TH_STYLE}>Tags</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    ...TD_STYLE,
                    textAlign: 'center',
                    color: '#78716c',
                    padding: '24px',
                  }}
                >
                  No hay candidatos con esos filtros.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const badge = estadoBadge(row.estado)
                return (
                  <tr
                    key={`${row.nombre}-${i}`}
                    style={{ transition: 'background 150ms' }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLTableRowElement).style.background =
                        '#faf9f7'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLTableRowElement).style.background =
                        'transparent'
                    }}
                  >
                    <td style={{ ...TD_STYLE, fontWeight: 500 }}>
                      {onCandidateClick && row.zoho_candidate_id ? (
                        <button
                          onClick={() =>
                            onCandidateClick(row.zoho_candidate_id!, row.nombre)
                          }
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            color: '#1e4b9e',
                            fontWeight: 600,
                            fontSize: '13px',
                            textAlign: 'left',
                            textDecoration: 'underline',
                            textDecorationColor: 'transparent',
                            transition: 'text-decoration-color 150ms',
                          }}
                          onMouseEnter={(e) => {
                            ;(e.currentTarget as HTMLButtonElement).style.textDecorationColor = '#1e4b9e'
                          }}
                          onMouseLeave={(e) => {
                            ;(e.currentTarget as HTMLButtonElement).style.textDecorationColor = 'transparent'
                          }}
                        >
                          {row.nombre ?? '—'}
                        </button>
                      ) : (
                        row.nombre ?? '—'
                      )}
                    </td>
                    <td style={TD_STYLE}>
                      {row.promo_numero !== null ? (
                        <span
                          style={{
                            fontWeight: 600,
                            color: '#1e4b9e',
                            fontSize: '12px',
                          }}
                        >
                          #{row.promo_numero}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={TD_STYLE}>
                      <span style={{ color: '#57534e' }}>
                        {row.tipo_perfil ?? '—'}
                      </span>
                    </td>
                    <td style={TD_STYLE}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 9px',
                          borderRadius: '99px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: badge.bg,
                          color: badge.color,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.estado ?? '—'}
                      </span>
                    </td>
                    <td style={{ ...TD_STYLE, color: '#57534e' }}>
                      {row.cliente ?? '—'}
                    </td>
                    <td style={{ ...TD_STYLE, color: '#57534e' }}>
                      {row.ciudad_kita ?? '—'}
                    </td>
                    <td style={TD_STYLE}>
                      <div
                        style={{
                          display: 'flex',
                          gap: '4px',
                          flexWrap: 'wrap',
                        }}
                      >
                        {(row.tags ?? []).slice(0, 4).map((tag) => (
                          <span
                            key={tag}
                            style={{
                              display: 'inline-block',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 500,
                              background: '#f5f1ea',
                              color: '#57534e',
                              border: '1px solid #e7e2d8',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                        {(row.tags ?? []).length > 4 && (
                          <span
                            style={{
                              fontSize: '10px',
                              color: '#a8a29e',
                              alignSelf: 'center',
                            }}
                          >
                            +{row.tags!.length - 4}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '8px',
            marginTop: '16px',
          }}
        >
          <button
            disabled={page <= 1 || isPending}
            onClick={() =>
              fetchData(page - 1, promoFilter, tipoPerfilFilter, estadoFilter, profesionFilter)
            }
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid #e7e2d8',
              background: '#ffffff',
              color: page <= 1 ? '#a8a29e' : '#1c1917',
              fontSize: '13px',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
            }}
          >
            ← Anterior
          </button>
          <span style={{ fontSize: '13px', color: '#78716c' }}>
            Página {page} de {totalPages}
          </span>
          <button
            disabled={page >= totalPages || isPending}
            onClick={() =>
              fetchData(page + 1, promoFilter, tipoPerfilFilter, estadoFilter, profesionFilter)
            }
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid #e7e2d8',
              background: '#ffffff',
              color: page >= totalPages ? '#a8a29e' : '#1c1917',
              fontSize: '13px',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
            }}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}
