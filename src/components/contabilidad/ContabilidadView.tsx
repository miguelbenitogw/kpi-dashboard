'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { getPagos, type PagoRow } from '@/lib/queries/pagos'

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const T = {
  bg: '#faf8f5',
  card: '#ffffff',
  border: '#e7e2d8',
  radius: 14,
  text: '#1c1917',
  muted: '#78716c',
  light: '#a8a29e',
  accent: '#1e4b9e',
  orange: '#e55a2b',
  green: '#16a34a',
  red: '#dc2626',
  strip: '#f5f1ea',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function fmtEur(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return `€${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return d
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function cobrado(row: PagoRow): number {
  return (row.importe_pagado_2024 ?? 0) + (row.importe_pagado_2025 ?? 0) + (row.importe_pagado_2026 ?? 0)
}

type PagoEstado = 'cobrado' | 'pendiente' | 'sin_datos'

function pagoEstado(row: PagoRow): PagoEstado {
  if (row.importe_total === null || row.importe_total === 0) return 'sin_datos'
  if ((row.importe_pendiente ?? 0) > 0) return 'pendiente'
  return 'cobrado'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <p style={{ margin: 0, fontSize: 11, color: T.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: '1.875rem', fontWeight: 700, color: color ?? T.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      {sub && <p style={{ margin: 0, fontSize: 11, color: T.muted }}>{sub}</p>}
    </div>
  )
}

function PagoEstadoBadge({ estado }: { estado: PagoEstado }) {
  if (estado === 'cobrado') {
    return (
      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#dcfce7', color: '#16a34a', whiteSpace: 'nowrap' }}>
        Cobrado
      </span>
    )
  }
  if (estado === 'pendiente') {
    return (
      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#fee2e2', color: '#dc2626', whiteSpace: 'nowrap' }}>
        Pendiente
      </span>
    )
  }
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#f3f4f6', color: '#6b7280', whiteSpace: 'nowrap' }}>
      Sin datos
    </span>
  )
}

// ---------------------------------------------------------------------------
// Sort types
// ---------------------------------------------------------------------------

type SortKey =
  | 'full_name'
  | 'promocion_nombre'
  | 'modalidad'
  | 'estado'
  | 'importe_total'
  | 'cobrado'
  | 'importe_pendiente'
  | 'fecha_cobro'
  | 'condiciones_pago'
  | 'comentarios_contabilidad'

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ContabilidadView() {
  const [rows, setRows] = useState<PagoRow[]>([])
  const [loading, setLoading] = useState(true)

  // Sync state
  const [syncState, setSyncState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [syncResult, setSyncResult] = useState<{ totalInserted: number; totalUpdated: number; totalErrors: number; results: Array<{ label: string; inserted: number; updated: number; errors: string[] }> } | null>(null)

  async function runImportPagos() {
    setSyncState('running')
    setSyncResult(null)
    try {
      const res = await fetch('/api/sheets/import-pagos', { method: 'POST' })
      const data = await res.json()
      setSyncResult(data)
      setSyncState(data.totalErrors > 0 && data.totalInserted + data.totalUpdated === 0 ? 'error' : 'done')
      // Reload rows after sync
      const fresh = await import('@/lib/queries/pagos').then(m => m.getPagos())
      setRows(fresh)
    } catch (e) {
      console.error('import-pagos error:', e)
      setSyncState('error')
    }
  }

  // Filters
  const [search, setSearch] = useState('')
  const [filterPromo, setFilterPromo] = useState<string>('__all__')
  const [soloPendiente, setSoloPendiente] = useState(false)

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('importe_pendiente')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    getPagos().then((data) => {
      setRows(data)
      setLoading(false)
    })
  }, [])

  // ---------------------------------------------------------------------------
  // Derived options for filters
  // ---------------------------------------------------------------------------

  const promos = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      if (r.promocion_nombre) set.add(r.promocion_nombre)
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [rows])

  // ---------------------------------------------------------------------------
  // KPI calculations (over ALL rows, no filters)
  // ---------------------------------------------------------------------------

  const kpis = useMemo(() => {
    let deuda = 0
    let totalCobrado = 0
    let pendiente = 0

    for (const r of rows) {
      if ((r.importe_total ?? 0) > 0) deuda += r.importe_total!
      totalCobrado += cobrado(r)
      if ((r.importe_pendiente ?? 0) > 0) pendiente += r.importe_pendiente!
    }

    const pctCobrado = deuda > 0 ? Math.round((totalCobrado / deuda) * 100) : 0
    return { deuda, cobrado: totalCobrado, pendiente, pctCobrado }
  }, [rows])

  // ---------------------------------------------------------------------------
  // Filtered + sorted rows
  // ---------------------------------------------------------------------------

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (search) {
        const s = search.toLowerCase()
        if (!(r.full_name ?? '').toLowerCase().includes(s)) return false
      }
      if (filterPromo !== '__all__' && r.promocion_nombre !== filterPromo) return false
      if (soloPendiente && (r.importe_pendiente ?? 0) <= 0) return false
      return true
    })
  }, [rows, search, filterPromo, soloPendiente])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string | number | null
      let bv: string | number | null

      if (sortKey === 'cobrado') {
        av = cobrado(a)
        bv = cobrado(b)
      } else {
        av = a[sortKey as keyof PagoRow] as string | number | null
        bv = b[sortKey as keyof PagoRow] as string | number | null
      }

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
  }, [filtered, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  // ---------------------------------------------------------------------------
  // Por promoción (agrupado)
  // ---------------------------------------------------------------------------

  const porPromo = useMemo(() => {
    const map = new Map<
      string,
      { candidatos: number; deuda: number; cobradoSum: number; pendienteSum: number }
    >()

    for (const r of rows) {
      const promo = r.promocion_nombre ?? '(Sin promo)'
      if (!map.has(promo)) map.set(promo, { candidatos: 0, deuda: 0, cobradoSum: 0, pendienteSum: 0 })
      const entry = map.get(promo)!
      entry.candidatos++
      if ((r.importe_total ?? 0) > 0) entry.deuda += r.importe_total!
      entry.cobradoSum += cobrado(r)
      if ((r.importe_pendiente ?? 0) > 0) entry.pendienteSum += r.importe_pendiente!
    }

    return Array.from(map.entries())
      .map(([promo, v]) => ({
        promo,
        ...v,
        pct: v.deuda > 0 ? Math.round((v.cobradoSum / v.deuda) * 100) : 0,
      }))
      .sort((a, b) => b.pendienteSum - a.pendienteSum)
  }, [rows])

  // ---------------------------------------------------------------------------
  // Column header helper
  // ---------------------------------------------------------------------------

  function Th({
    label,
    sk,
    align = 'left',
  }: {
    label: string
    sk: SortKey
    align?: 'left' | 'right'
  }) {
    const active = sortKey === sk
    return (
      <th
        onClick={() => handleSort(sk)}
        style={{
          padding: '8px 12px',
          textAlign: align,
          fontSize: 11,
          fontWeight: 600,
          color: active ? T.accent : T.muted,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {label}
          {active ? (
            sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
          ) : null}
        </span>
      </th>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: T.muted, fontSize: 14 }}>
        Cargando datos de pagos…
      </div>
    )
  }

  const cardStyle: React.CSSProperties = {
    background: T.card,
    border: `1px solid ${T.border}`,
    borderRadius: T.radius,
    padding: '20px 24px',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '24px', background: T.bg, minHeight: '100vh' }}>

      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: T.text }}>Pagos candidatos</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: T.muted }}>{rows.length} registros · sync diario 06:00 UTC</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <button
            onClick={runImportPagos}
            disabled={syncState === 'running'}
            style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: syncState === 'running' ? 'not-allowed' : 'pointer',
              background: syncState === 'done' ? T.green : syncState === 'error' ? T.red : T.accent,
              color: '#fff', border: 'none', flexShrink: 0,
            }}
          >
            {syncState === 'idle' && '↻ Importar pagos ahora'}
            {syncState === 'running' && '⏳ Importando…'}
            {syncState === 'done' && `✓ +${syncResult?.totalInserted ?? 0} nuevos · ${syncResult?.totalUpdated ?? 0} actualizados`}
            {syncState === 'error' && '✗ Error — ver consola'}
          </button>
          {syncResult && syncResult.results.map((r, i) => (
            <div key={i} style={{ fontSize: 10, color: T.muted }}>
              {r.label}: +{r.inserted} · ↻{r.updated}{r.errors.length > 0 ? ` · ⚠${r.errors.length} errores` : ''}
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* KPI Banner                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <KpiCard label="Total deuda" value={fmtEur(kpis.deuda)} color={T.accent} />
        <KpiCard label="Total cobrado" value={fmtEur(kpis.cobrado)} color={T.green} />
        <KpiCard label="Total pendiente" value={fmtEur(kpis.pendiente)} color={kpis.pendiente > 0 ? T.red : T.green} />
        <div
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: T.radius,
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <p style={{ margin: 0, fontSize: 11, color: T.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            % cobrado
          </p>
          <p style={{ margin: 0, fontSize: '1.875rem', fontWeight: 700, color: kpis.pctCobrado >= 80 ? T.green : kpis.pctCobrado >= 50 ? T.orange : T.red, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {kpis.pctCobrado}%
          </p>
          <div style={{ height: 6, background: T.border, borderRadius: 3 }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(kpis.pctCobrado, 100)}%`,
                background: kpis.pctCobrado >= 80 ? T.green : kpis.pctCobrado >= 50 ? T.orange : T.red,
                borderRadius: 3,
                transition: 'width 0.4s',
              }}
            />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Filtros                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        {/* Búsqueda */}
        <input
          type="text"
          placeholder="Buscar por nombre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '7px 12px',
            borderRadius: 8,
            border: `1px solid ${T.border}`,
            fontSize: 13,
            color: T.text,
            background: T.bg,
            outline: 'none',
            minWidth: 200,
          }}
        />

        {/* Pills de promo */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button
            onClick={() => setFilterPromo('__all__')}
            style={{
              padding: '5px 12px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              border: `1px solid ${filterPromo === '__all__' ? T.accent : T.border}`,
              background: filterPromo === '__all__' ? T.accent : T.card,
              color: filterPromo === '__all__' ? '#ffffff' : T.muted,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Todas
          </button>
          {promos.map((p) => (
            <button
              key={p}
              onClick={() => setFilterPromo(filterPromo === p ? '__all__' : p)}
              style={{
                padding: '5px 12px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                border: `1px solid ${filterPromo === p ? T.accent : T.border}`,
                background: filterPromo === p ? T.accent : T.card,
                color: filterPromo === p ? '#ffffff' : T.muted,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Toggle solo pendiente */}
        <button
          onClick={() => setSoloPendiente((v) => !v)}
          style={{
            padding: '5px 14px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            border: `1px solid ${soloPendiente ? T.red : T.border}`,
            background: soloPendiente ? '#fee2e2' : T.card,
            color: soloPendiente ? T.red : T.muted,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          Solo con pendiente
        </button>

        <span style={{ marginLeft: 'auto', fontSize: 12, color: T.muted }}>
          {sorted.length} resultado{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tabla principal                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${T.border}`, background: T.strip }}>
                <Th label="Nombre" sk="full_name" />
                <Th label="Promo" sk="promocion_nombre" />
                <Th label="Modalidad" sk="modalidad" />
                <Th label="Estado" sk="estado" />
                <Th label="Importe total" sk="importe_total" align="right" />
                <Th label="Cobrado" sk="cobrado" align="right" />
                <Th label="Pendiente" sk="importe_pendiente" align="right" />
                <Th label="F. cobro" sk="fecha_cobro" />
                <Th label="Condiciones" sk="condiciones_pago" />
                <Th label="Comentarios contab." sk="comentarios_contabilidad" />
                <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: T.muted, whiteSpace: 'nowrap' }}>
                  Estado pago
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ padding: '32px', textAlign: 'center', color: T.muted }}>
                    Sin resultados
                  </td>
                </tr>
              )}
              {sorted.map((row) => {
                const cob = cobrado(row)
                const pend = row.importe_pendiente ?? 0
                const estado = pagoEstado(row)
                return (
                  <tr
                    key={row.id}
                    style={{ borderBottom: `1px solid ${T.border}`, transition: 'background 0.1s' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = T.strip }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                  >
                    <td style={{ padding: '9px 12px', fontWeight: 500, color: T.text, whiteSpace: 'nowrap' }}>
                      {row.full_name}
                    </td>
                    <td style={{ padding: '9px 12px', color: T.muted, whiteSpace: 'nowrap' }}>
                      {row.promocion_nombre ?? '—'}
                    </td>
                    <td style={{ padding: '9px 12px', color: T.muted, whiteSpace: 'nowrap' }}>
                      {row.modalidad ?? '—'}
                    </td>
                    <td style={{ padding: '9px 12px', color: T.muted, whiteSpace: 'nowrap' }}>
                      {row.estado ?? '—'}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: T.text, whiteSpace: 'nowrap' }}>
                      {fmtEur(row.importe_total)}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: T.green, whiteSpace: 'nowrap' }}>
                      {cob > 0 ? fmtEur(cob) : '—'}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: pend > 0 ? T.red : T.green, fontWeight: pend > 0 ? 700 : 400, whiteSpace: 'nowrap' }}>
                      {pend > 0 ? fmtEur(pend) : (row.importe_total !== null ? '€0' : '—')}
                    </td>
                    <td style={{ padding: '9px 12px', color: T.muted, whiteSpace: 'nowrap' }}>
                      {fmtDate(row.fecha_cobro)}
                    </td>
                    <td style={{ padding: '9px 12px', color: T.muted, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span title={row.condiciones_pago ?? undefined}>
                        {row.condiciones_pago ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', color: T.muted, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span title={row.comentarios_contabilidad ?? undefined}>
                        {row.comentarios_contabilidad ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                      <PagoEstadoBadge estado={estado} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Por promoción                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 4px', fontSize: '0.9rem', fontWeight: 600, color: T.text }}>
          Por promoción
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: 11, color: T.muted }}>
          Ordenado por pendiente descendente
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                {['Promoción', 'Candidatos', 'Deuda', 'Cobrado', 'Pendiente', '% cobrado'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '8px 12px',
                      textAlign: h === 'Promoción' ? 'left' : 'right',
                      fontSize: 11,
                      fontWeight: 600,
                      color: T.muted,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {porPromo.map((r) => (
                <tr
                  key={r.promo}
                  style={{ borderBottom: `1px solid ${T.border}`, transition: 'background 0.1s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = T.strip }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                >
                  <td style={{ padding: '9px 12px', fontWeight: 600, color: T.text }}>{r.promo}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: T.muted, fontVariantNumeric: 'tabular-nums' }}>{r.candidatos}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: T.text, fontVariantNumeric: 'tabular-nums' }}>{fmtEur(r.deuda)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: T.green, fontVariantNumeric: 'tabular-nums' }}>{fmtEur(r.cobradoSum)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: r.pendienteSum > 0 ? T.red : T.green, fontWeight: r.pendienteSum > 0 ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}>
                    {r.pendienteSum > 0 ? fmtEur(r.pendienteSum) : '€0'}
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        color: r.pct >= 80 ? T.green : r.pct >= 50 ? T.orange : T.red,
                        fontWeight: 700,
                      }}
                    >
                      {r.pct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
