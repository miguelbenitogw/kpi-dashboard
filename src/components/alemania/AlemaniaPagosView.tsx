'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { getGermanyPagosFull, type GermanyPagoFullRow, type GermanyCuotaEntry } from '@/lib/queries/germany'

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

function fmtEur(n: number | null | undefined): string {
  if (n == null) return '—'
  return `€${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return d
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

type PagoEstado = 'cobrado' | 'pendiente' | 'sin_datos'
function pagoEstado(row: GermanyPagoFullRow): PagoEstado {
  if (row.importe_total == null || row.importe_total === 0) return 'sin_datos'
  if ((row.importe_pendiente ?? 0) > 0) return 'pendiente'
  return 'cobrado'
}

function cobrado(row: GermanyPagoFullRow): number {
  return (row.importe_total ?? 0) - (row.importe_pendiente ?? 0)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '16px 20px', minWidth: 0 }}>
      <p style={{ fontSize: 11, color: T.muted, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color: color ?? T.text, margin: '4px 0 0', lineHeight: 1.1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: T.light, margin: '4px 0 0' }}>{sub}</p>}
    </div>
  )
}

function PagosBadge({ estado, pendiente }: { estado: PagoEstado; pendiente: number | null }) {
  if (estado === 'cobrado') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: T.green, background: '#dcfce7', borderRadius: 99, padding: '2px 8px' }}>
        ✓ Cobrado
      </span>
    )
  }
  if (estado === 'pendiente') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: T.red, background: '#fee2e2', borderRadius: 99, padding: '2px 8px' }}>
        Pendiente {pendiente ? fmtEur(pendiente) : ''}
      </span>
    )
  }
  return (
    <span style={{ fontSize: 11, color: T.light }}>—</span>
  )
}

function isCuotaPagada(c: GermanyCuotaEntry): boolean {
  if (c.pagado == null) return false
  if (typeof c.pagado === 'boolean') return c.pagado
  return ['true', 'yes', 'si', 'sí', '1'].includes(String(c.pagado).toLowerCase().trim())
}

function CuotasBadge({ cuotas }: { cuotas: GermanyPagoFullRow['cuotas'] }) {
  if (!cuotas || cuotas.length === 0) return <span style={{ fontSize: 11, color: T.light }}>—</span>
  const total = cuotas.length
  // Si ninguna cuota tiene campo pagado (datos del sheet simple), mostramos solo el total
  const hasPagadoData = cuotas.some(c => c.pagado != null)
  if (!hasPagadoData) {
    return (
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: T.accent,
        background: '#eff6ff',
        borderRadius: 99,
        padding: '2px 8px',
      }}>
        {total} cuotas
      </span>
    )
  }
  const pagadas = cuotas.filter(isCuotaPagada).length
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 600,
      color: pagadas === total ? T.green : T.accent,
      background: pagadas === total ? '#dcfce7' : '#eff6ff',
      borderRadius: 99,
      padding: '2px 8px',
    }}>
      {pagadas}/{total} cuotas
    </span>
  )
}

type SortKey = 'nombre' | 'promo_numero' | 'empresa' | 'importe_total' | 'importe_pendiente' | 'opcion_financiacion'
type SortDir = 'asc' | 'desc'

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export default function AlemaniaPagosView({ initialData }: { initialData?: GermanyPagoFullRow[] }) {
  const [loading, setLoading] = useState(!initialData)
  const [rows, setRows] = useState<GermanyPagoFullRow[]>(initialData ?? [])
  const [search, setSearch] = useState('')
  const [promoFilter, setPromoFilter] = useState<number | 'todas'>('todas')
  const [filterEstado, setFilterEstado] = useState<string>('__all__')
  const [onlyPendiente, setOnlyPendiente] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('promo_numero')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expandedCuotas, setExpandedCuotas] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (initialData) return   // datos ya disponibles desde el server
    getGermanyPagosFull().then(data => { setRows(data); setLoading(false) })
  }, [initialData])

  // Available promos
  const availablePromos = useMemo(() => {
    const nums = [...new Set(rows.map(r => r.promo_numero).filter((n): n is number => n != null))]
    return nums.sort((a, b) => b - a)
  }, [rows])

  // Available estados de formación
  const availableEstados = useMemo(() => {
    const s = new Set(rows.map(r => r.estado).filter((e): e is string => !!e))
    return [...s].sort()
  }, [rows])

  // Filter + sort
  const filtered = useMemo(() => {
    let result = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(r =>
        r.nombre?.toLowerCase().includes(q) ||
        r.empresa?.toLowerCase().includes(q) ||
        r.correo?.toLowerCase().includes(q)
      )
    }
    if (promoFilter !== 'todas') {
      result = result.filter(r => r.promo_numero === promoFilter)
    }
    if (filterEstado !== '__all__') {
      result = result.filter(r => r.estado === filterEstado)
    }
    if (onlyPendiente) {
      result = result.filter(r => (r.importe_pendiente ?? 0) > 0)
    }
    return [...result].sort((a, b) => {
      let av: string | number | null, bv: string | number | null
      switch (sortKey) {
        case 'nombre': av = a.nombre; bv = b.nombre; break
        case 'promo_numero': av = a.promo_numero; bv = b.promo_numero; break
        case 'empresa': av = a.empresa; bv = b.empresa; break
        case 'importe_total': av = a.importe_total; bv = b.importe_total; break
        case 'importe_pendiente': av = a.importe_pendiente; bv = b.importe_pendiente; break
        case 'opcion_financiacion': av = a.opcion_financiacion; bv = b.opcion_financiacion; break
        default: av = null; bv = null
      }
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, search, promoFilter, filterEstado, onlyPendiente, sortKey, sortDir])

  // KPIs — reactivos a todos los filtros activos
  const kpis = useMemo(() => {
    const withImporte = filtered.filter(r => (r.importe_total ?? 0) > 0)
    const totalDeuda = withImporte.reduce((s, r) => s + (r.importe_total ?? 0), 0)
    const totalPendiente = withImporte.reduce((s, r) => s + (r.importe_pendiente ?? 0), 0)
    const totalCobrado = totalDeuda - totalPendiente
    const pctCobrado = totalDeuda > 0 ? (totalCobrado / totalDeuda) * 100 : 0
    const conPendiente = filtered.filter(r => (r.importe_pendiente ?? 0) > 0).length
    return { totalDeuda, totalPendiente, totalCobrado, pctCobrado, conPendiente, total: filtered.length }
  }, [filtered])

  // Grouped by promo
  const byPromo = useMemo(() => {
    const map = new Map<string, { n: number; deuda: number; cobrado: number; pendiente: number }>()
    for (const r of rows) {
      const key = r.promo_numero != null ? `Promo ${r.promo_numero}` : 'Sin promo'
      const prev = map.get(key) ?? { n: 0, deuda: 0, cobrado: 0, pendiente: 0 }
      const rowDeuda = r.importe_total ?? 0
      const rowPendiente = r.importe_pendiente ?? 0
      map.set(key, {
        n: prev.n + 1,
        deuda: prev.deuda + rowDeuda,
        cobrado: prev.cobrado + (rowDeuda - rowPendiente),
        pendiente: prev.pendiente + rowPendiente,
      })
    }
    return [...map.entries()]
      .sort((a, b) => b[1].pendiente - a[1].pendiente)
  }, [rows])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronDown style={{ opacity: 0.3 }} className="h-3 w-3 inline ml-0.5" />
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 inline ml-0.5" style={{ color: T.accent }} />
      : <ChevronDown className="h-3 w-3 inline ml-0.5" style={{ color: T.accent }} />
  }

  function toggleCuotas(id: number) {
    setExpandedCuotas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const thStyle: React.CSSProperties = {
    padding: '8px 12px',
    fontSize: 11,
    fontWeight: 600,
    color: T.muted,
    textAlign: 'left',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    userSelect: 'none',
    background: T.strip,
    borderBottom: `1px solid ${T.border}`,
  }

  const tdStyle: React.CSSProperties = {
    padding: '9px 12px',
    fontSize: 12,
    color: T.text,
    borderBottom: `1px solid ${T.border}`,
    verticalAlign: 'top',
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: T.light, fontSize: 14 }}>
        Cargando pagos…
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 28px', background: T.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0 }}>Pagos · Alemania</h1>
        <p style={{ fontSize: 13, color: T.muted, margin: '4px 0 0' }}>
          Seguimiento de deuda y cuotas del programa de Alemania
        </p>
      </div>

      {/* KPI Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <KpiCard label="Total deuda" value={fmtEur(kpis.totalDeuda)} sub={`${kpis.total} candidatos`} />
        <KpiCard label="Cobrado" value={fmtEur(kpis.totalCobrado)} color={T.green} />
        <KpiCard
          label="Pendiente"
          value={fmtEur(kpis.totalPendiente)}
          sub={`${kpis.conPendiente} con deuda`}
          color={kpis.totalPendiente > 0 ? T.red : T.green}
        />
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '16px 20px', minWidth: 0 }}>
          <p style={{ fontSize: 11, color: T.muted, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>% cobrado</p>
          <p style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: '4px 0 0', lineHeight: 1.1 }}>
            {kpis.pctCobrado.toFixed(1)}%
          </p>
          <div style={{ height: 4, background: T.border, borderRadius: 99, marginTop: 8 }}>
            <div style={{ height: '100%', width: `${Math.min(100, kpis.pctCobrado)}%`, background: T.green, borderRadius: 99, transition: 'width 0.4s' }} />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, empresa, correo…"
          style={{
            padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.border}`,
            fontSize: 13, color: T.text, background: T.card, outline: 'none', minWidth: 220,
          }}
        />
        <button
          onClick={() => setPromoFilter('todas')}
          style={{
            padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${T.border}`,
            background: promoFilter === 'todas' ? T.accent : T.card,
            color: promoFilter === 'todas' ? '#fff' : T.muted,
          }}
        >
          Todas las promos
        </button>
        {availablePromos.map(promo => (
          <button
            key={promo}
            onClick={() => setPromoFilter(promo === promoFilter ? 'todas' : promo)}
            style={{
              padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${T.border}`,
              background: promoFilter === promo ? T.accent : T.card,
              color: promoFilter === promo ? '#fff' : T.muted,
            }}
          >
            Promo {promo}
          </button>
        ))}
        <button
          onClick={() => setOnlyPendiente(v => !v)}
          style={{
            padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${onlyPendiente ? T.red : T.border}`,
            background: onlyPendiente ? '#fee2e2' : T.card,
            color: onlyPendiente ? T.red : T.muted,
          }}
        >
          Solo con pendiente
        </button>
        <span style={{ fontSize: 12, color: T.light, marginLeft: 4 }}>
          {filtered.length} candidato{filtered.length !== 1 ? 's' : ''}
        </span>

        {/* Estado de formación */}
        {availableEstados.length > 0 && (
          <>
            <div style={{ width: '100%', height: 1, background: T.border, margin: '2px 0' }} />
            <span style={{ fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Estado:
            </span>
            <button
              onClick={() => setFilterEstado('__all__')}
              style={{
                padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${T.border}`,
                background: filterEstado === '__all__' ? T.accent : T.card,
                color: filterEstado === '__all__' ? '#fff' : T.muted,
              }}
            >
              Todos
            </button>
            {availableEstados.map(e => (
              <button
                key={e}
                onClick={() => setFilterEstado(filterEstado === e ? '__all__' : e)}
                style={{
                  padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${T.border}`,
                  background: filterEstado === e ? T.accent : T.card,
                  color: filterEstado === e ? '#fff' : T.muted,
                }}
              >
                {e}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Tabla principal */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {([
                  ['nombre', 'Nombre'],
                  ['promo_numero', 'Promo'],
                  ['opcion_financiacion', 'Opción pago'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th key={key} style={thStyle} onClick={() => toggleSort(key)}>
                    {label}<SortIcon k={key} />
                  </th>
                ))}
                <th style={thStyle}>Modalidad</th>
                <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => toggleSort('importe_total')}>
                  Total<SortIcon k="importe_total" />
                </th>
                <th style={thStyle}>Cobrado</th>
                <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => toggleSort('importe_pendiente')}>
                  Pendiente<SortIcon k="importe_pendiente" />
                </th>
                <th style={thStyle}>Cuotas</th>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}>Contrato</th>
                <th style={thStyle}>Comentarios</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ ...tdStyle, textAlign: 'center', color: T.light, padding: '32px 0' }}>
                    Sin resultados
                  </td>
                </tr>
              ) : (
                filtered.map((row, i) => {
                  const estado = pagoEstado(row)
                  const cobradoAmt = cobrado(row)
                  const isExpanded = expandedCuotas.has(row.id)
                  return (
                    <>
                      <tr key={row.id} style={{ background: i % 2 === 0 ? T.card : T.strip }}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600, color: T.text }}>{row.nombre ?? '—'}</div>
                          {row.correo && <div style={{ fontSize: 10, color: T.light }}>{row.correo}</div>}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {row.promo_numero != null ? (
                            <span style={{ fontSize: 11, fontWeight: 600, color: T.accent, background: '#eff6ff', borderRadius: 99, padding: '2px 8px' }}>
                              {row.promo_numero}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={tdStyle}>
                          {row.opcion_financiacion ? (
                            <span style={{ fontSize: 11, background: '#f5f1ea', borderRadius: 6, padding: '2px 6px', color: T.muted }}>
                              {row.opcion_financiacion}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={tdStyle}>{row.modalidad ?? '—'}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{fmtEur(row.importe_total)}</td>
                        <td style={{ ...tdStyle, color: T.green, fontWeight: 500 }}>{cobradoAmt > 0 ? fmtEur(cobradoAmt) : '—'}</td>
                        <td style={{ ...tdStyle, color: (row.importe_pendiente ?? 0) > 0 ? T.red : T.text, fontWeight: (row.importe_pendiente ?? 0) > 0 ? 600 : 400 }}>
                          {fmtEur(row.importe_pendiente)}
                        </td>
                        <td style={tdStyle}>
                          {row.cuotas && row.cuotas.length > 0 ? (
                            <button
                              onClick={() => toggleCuotas(row.id)}
                              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                            >
                              <CuotasBadge cuotas={row.cuotas} />
                            </button>
                          ) : <span style={{ fontSize: 11, color: T.light }}>—</span>}
                        </td>
                        <td style={tdStyle}>
                          <PagosBadge estado={estado} pendiente={row.importe_pendiente} />
                        </td>
                        <td style={tdStyle}>
                          {row.fecha_inicio_contrato ? (
                            <div>
                              <div style={{ fontSize: 10, color: T.light }}>Inicio</div>
                              <div>{fmtDate(row.fecha_inicio_contrato)}</div>
                            </div>
                          ) : '—'}
                        </td>
                        <td style={{ ...tdStyle, maxWidth: 160 }}>
                          {row.comentarios_contabilidad ? (
                            <span style={{ fontSize: 11, color: T.muted }}>{row.comentarios_contabilidad}</span>
                          ) : row.comentarios_coordinadores ? (
                            <span style={{ fontSize: 11, color: T.light }}>{row.comentarios_coordinadores}</span>
                          ) : '—'}
                        </td>
                      </tr>
                      {/* Cuotas expandidas */}
                      {isExpanded && row.cuotas && row.cuotas.length > 0 && (
                        <tr key={`${row.id}-cuotas`} style={{ background: '#f0f4ff' }}>
                          <td colSpan={11} style={{ padding: '8px 16px 12px 48px' }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: T.accent, margin: '0 0 6px' }}>
                              Cuotas — {row.nombre}
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {row.cuotas.map((c, ci) => {
                                const pagada = isCuotaPagada(c)
                                const hasPagado = c.pagado != null
                                return (
                                  <div key={ci} style={{
                                    background: hasPagado ? (pagada ? '#dcfce7' : '#fee2e2') : '#f0f4ff',
                                    border: `1px solid ${hasPagado ? (pagada ? '#86efac' : '#fca5a5') : '#bfdbfe'}`,
                                    borderRadius: 8,
                                    padding: '5px 10px',
                                    fontSize: 11,
                                    minWidth: 100,
                                  }}>
                                    <div style={{ fontWeight: 600, color: hasPagado ? (pagada ? T.green : T.red) : T.accent }}>
                                      Cuota {c.numero ?? ci + 1} · {fmtEur(c.importe)}
                                    </div>
                                    {c.fecha && <div style={{ color: T.muted }}>{fmtDate(c.fecha)}</div>}
                                    {hasPagado && (
                                      <div style={{ fontSize: 10, color: pagada ? T.green : T.red }}>
                                        {pagada ? '✓ Pagada' : 'Pendiente'}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Por promoción */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, background: T.strip }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: 0 }}>Resumen por promoción</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Promo', 'Candidatos', 'Deuda total', 'Cobrado', 'Pendiente', '% cobrado'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byPromo.map(([promo, d], i) => {
                const pct = d.deuda > 0 ? (d.cobrado / d.deuda) * 100 : 0
                return (
                  <tr key={promo} style={{ background: i % 2 === 0 ? T.card : T.strip }}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: T.accent }}>{promo}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>{d.n}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{fmtEur(d.deuda)}</td>
                    <td style={{ ...tdStyle, color: T.green }}>{fmtEur(d.cobrado)}</td>
                    <td style={{ ...tdStyle, color: d.pendiente > 0 ? T.red : T.text, fontWeight: d.pendiente > 0 ? 600 : 400 }}>
                      {fmtEur(d.pendiente)}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 4, background: T.border, borderRadius: 99 }}>
                          <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: T.green, borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 11, color: T.muted, minWidth: 36 }}>{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
