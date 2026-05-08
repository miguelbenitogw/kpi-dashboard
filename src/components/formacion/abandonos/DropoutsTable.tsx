'use client'

import React, { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import type { DropoutRow } from '@/lib/queries/dropouts'

interface Props {
  rows: DropoutRow[]
}

const PAGE_SIZE = 25

const INTEREST_COLORS: Record<string, string> = {
  Yes: '#16a34a',
  No: '#dc2626',
  'Does not know': '#d97706',
}

function tagChipStyle(tag: string): React.CSSProperties {
  if (tag.startsWith('FR')) return { background: '#eef2ff', color: '#4338ca' }
  if (tag.startsWith('CP')) return { background: '#f0fdf4', color: '#15803d' }
  if (tag.startsWith('GW')) return { background: '#faf5ff', color: '#7c3aed' }
  return { background: '#f5f1ea', color: '#78716c' }
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return d
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

function formatEuros(n: number | null): string {
  if (n === null || n === 0) return ''
  return `€${n.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`
}

function PagoBadge({ row }: { row: DropoutRow }) {
  if (row.pago_estado === 'cobrado') {
    return (
      <span style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 600,
        background: '#f0fdf4',
        color: '#15803d',
        border: '1px solid #bbf7d0',
        whiteSpace: 'nowrap',
      }}>
        ✓ Cobrado
      </span>
    )
  }

  if (row.pago_estado === 'parcial') {
    const pendStr = formatEuros(row.pago_importe_pendiente)
    const totalStr = formatEuros(row.pago_importe_total)
    const label = pendStr ? `Parcial · ${pendStr} pend.` : 'Parcial'
    const title = row.pago_condiciones
      ? `Total: ${totalStr} · Pendiente: ${pendStr}\n\n${row.pago_condiciones}`
      : `Total: ${totalStr} · Pendiente: ${pendStr}`
    return (
      <span
        title={title}
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 999,
          fontSize: 10,
          fontWeight: 600,
          background: '#fffbeb',
          color: '#b45309',
          border: '1px solid #fde68a',
          whiteSpace: 'nowrap',
          cursor: 'default',
        }}
      >
        ◑ {label}
      </span>
    )
  }

  if (row.pago_estado === 'pendiente') {
    const pendStr = formatEuros(row.pago_importe_pendiente)
    const label = pendStr ? `Pendiente ${pendStr}` : 'Pendiente'
    const title = row.pago_condiciones
      ? `Sin pago · Total: ${pendStr}\n\n${row.pago_condiciones}`
      : `Sin pago · Total: ${pendStr}`
    return (
      <span
        title={title}
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 999,
          fontSize: 10,
          fontWeight: 600,
          background: '#fff1f2',
          color: '#be123c',
          border: '1px solid #fecdd3',
          whiteSpace: 'nowrap',
          cursor: 'default',
        }}
      >
        ✗ {label}
      </span>
    )
  }

  return <span style={{ color: '#a8a29e', fontSize: 12 }}>—</span>
}

type SortKey = keyof DropoutRow

type ColDef = {
  key: SortKey
  label: string
}

const COLUMNS: ColDef[] = [
  { key: 'full_name', label: 'Nombre' },
  { key: 'promocion_nombre', label: 'Promo' },
  { key: 'dropout_date', label: 'Fecha baja' },
  { key: 'dropout_reason', label: 'Motivo' },
  { key: 'dropout_language_level', label: 'Nivel' },
  { key: 'dropout_days_of_training', label: 'Días' },
  { key: 'dropout_interest_future', label: 'Interés' },
]

const TH_STYLE: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: '#78716c',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  userSelect: 'none',
}

const TH_STATIC: React.CSSProperties = {
  ...TH_STYLE,
  cursor: 'default',
}

const TD_STYLE: React.CSSProperties = {
  padding: '7px 12px',
  fontSize: 12,
  color: '#44403c',
  verticalAlign: 'middle',
}

export default function DropoutsTable({ rows }: Props) {
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState<SortKey>('dropout_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(0)
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      const as = String(av).toLowerCase()
      const bs = String(bv).toLowerCase()
      if (as < bs) return sortDir === 'asc' ? -1 : 1
      if (as > bs) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [rows, sortKey, sortDir])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const from = page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, sorted.length)

  return (
    <div style={{ borderRadius: 12, border: '1px solid #e7e2d8', background: '#ffffff', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e7e2d8', background: '#faf9f7' }}>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={TH_STYLE}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {col.label}
                    {sortKey === col.key ? (
                      sortDir === 'asc' ? (
                        <ChevronUp style={{ width: 12, height: 12 }} />
                      ) : (
                        <ChevronDown style={{ width: 12, height: 12 }} />
                      )
                    ) : null}
                  </span>
                </th>
              ))}
              <th style={TH_STATIC}>Etiquetas</th>
              <th style={TH_STATIC}>Notas</th>
              <th style={{ ...TH_STATIC, cursor: 'pointer' }} onClick={() => handleSort('pago_estado')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Pago
                  {sortKey === 'pago_estado' ? (
                    sortDir === 'asc' ? <ChevronUp style={{ width: 12, height: 12 }} /> : <ChevronDown style={{ width: 12, height: 12 }} />
                  ) : null}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={10} style={{ padding: '32px 12px', textAlign: 'center', color: '#a8a29e', fontSize: 13 }}>
                  Sin resultados
                </td>
              </tr>
            )}
            {pageRows.map((row, i) => (
              <tr
                key={row.id}
                style={{
                  borderBottom: i < pageRows.length - 1 ? '1px solid #f0ede6' : undefined,
                  background: i % 2 === 0 ? '#ffffff' : '#faf9f7',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f1ea')}
                onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? '#ffffff' : '#faf9f7')}
              >
                <td style={{ ...TD_STYLE, fontWeight: 500, color: '#1c1917' }}>{row.full_name ?? '—'}</td>
                <td style={{ ...TD_STYLE, color: '#78716c' }}>
                  {row.promocion_nombre
                    ? row.promocion_nombre.replace(/^Promoci[oó]n\s+/i, 'Prom. ')
                    : '—'}
                </td>
                <td style={{ ...TD_STYLE, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: '#78716c' }}>
                  {formatDate(row.dropout_date)}
                </td>
                <td style={{ ...TD_STYLE, color: '#44403c' }}>{row.dropout_reason ?? '—'}</td>
                <td style={{ ...TD_STYLE, color: '#78716c' }}>{row.dropout_language_level ?? '—'}</td>
                <td style={{ ...TD_STYLE, fontVariantNumeric: 'tabular-nums', color: '#78716c' }}>
                  {row.dropout_days_of_training ?? '—'}
                </td>
                <td style={{ ...TD_STYLE, color: INTEREST_COLORS[row.dropout_interest_future ?? ''] ?? '#78716c', fontWeight: 500 }}>
                  {row.dropout_interest_future ?? '—'}
                </td>
                {/* Tags */}
                <td style={TD_STYLE}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {row.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        style={{
                          ...tagChipStyle(tag),
                          borderRadius: 999,
                          padding: '1px 7px',
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                    {row.tags.length > 3 && (
                      <span style={{ background: '#f5f1ea', color: '#78716c', borderRadius: 999, padding: '1px 7px', fontSize: 10 }}>
                        +{row.tags.length - 3}
                      </span>
                    )}
                  </div>
                </td>
                {/* Notas */}
                <td style={{ ...TD_STYLE, maxWidth: 200 }}>
                  {row.dropout_notes ? (
                    <span
                      style={{ color: '#a8a29e', cursor: 'default' }}
                      title={row.dropout_notes}
                    >
                      {row.dropout_notes.length > 40
                        ? row.dropout_notes.slice(0, 40) + '…'
                        : row.dropout_notes}
                    </span>
                  ) : (
                    <span style={{ color: '#d4cfc8' }}>—</span>
                  )}
                </td>
                {/* Pago */}
                <td style={TD_STYLE}>
                  <PagoBadge row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: '1px solid #e7e2d8',
        padding: '8px 16px',
        background: '#faf9f7',
      }}>
        <span style={{ fontSize: 12, color: '#a8a29e' }}>
          {sorted.length > 0 ? `Mostrando ${from}–${to} de ${sorted.length}` : 'Sin resultados'}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              border: '1px solid #e7e2d8',
              borderRadius: 6,
              padding: '4px 12px',
              fontSize: 12,
              color: page === 0 ? '#d4cfc8' : '#78716c',
              background: '#ffffff',
              cursor: page === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            Anterior
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={{
              border: '1px solid #e7e2d8',
              borderRadius: 6,
              padding: '4px 12px',
              fontSize: 12,
              color: page >= totalPages - 1 ? '#d4cfc8' : '#78716c',
              background: '#ffffff',
              cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
            }}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  )
}
