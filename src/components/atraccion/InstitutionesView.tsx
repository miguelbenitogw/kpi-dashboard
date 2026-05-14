'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Building2, CalendarDays, LayoutList, ChevronDown, ChevronRight, Mail, Phone, MapPin, Users, BookOpen, ExternalLink } from 'lucide-react'
import {
  Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
  ComposedChart, BarChart, Bar, XAxis, YAxis, Line, CartesianGrid, LabelList,
} from 'recharts'
import {
  getInstitutions,
  type Institution,
  type InstitutionSummary,
  INSTITUCION_PROFESIONES,
  type InstitucionProfesion,
} from '@/lib/queries/instituciones'
import InstitutionCalendarView from './InstitutionCalendarView'

// ─── Paleta ───────────────────────────────────────────────────────────────────

const BLUE_SHADES = ['#1e4b9e', '#2d62c8', '#4f83d8', '#7aa7e8', '#a8c5f3', '#d1e2fb']
const ACCENT = '#e55a2b'

const PROFESION_SHORT: Record<string, string> = {
  'ENFERMERÍA':          'ENF',
  'FISIOTERAPIA':        'FIS',
  'EDUCACIÓN INFANTIL':  'EDU',
  'VETERINARIA':         'VET',
  'DENTISTAS':           'DEN',
  'ÓPTICA-OPTOMETRÍA':   'ÓPT',
  'TERAPIA OCUPACIONAL': 'TO',
}

// ─── Shared helpers (module-level para usar en filtros del padre) ─────────────

const SKIP_WORDS = new Set(['y', 'e', 'o', 'con', 'y/o', 'grabación', 'grabacion'])

function tokenizePersonas(raw: string): string[] {
  return raw
    .split(/[,/]|\s+y\s+|\s+e\s+/i)
    .flatMap(part => part.trim().split(/\s+/))
    .map(s => s.trim())
    .filter(s => s.length > 1 && !SKIP_WORDS.has(s.toLowerCase()))
}

// ─── Charts ───────────────────────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-lift" style={{
      background: '#fff',
      border: '1px solid #e7e2d8',
      borderRadius: 10,
      padding: '14px 16px',
      flex: '1 1 340px',
      minWidth: 0,
    }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#57534e', marginBottom: 12 }}>{title}</p>
      {children}
    </div>
  )
}

const CARD_COLORS = {
  blue:   { border: '#1e4b9e', bg: '#eff6ff', value: '#1e4b9e' },
  green:  { border: '#16a34a', bg: '#f0fdf4', value: '#16a34a' },
  purple: { border: '#7c3aed', bg: '#f5f3ff', value: '#7c3aed' },
  amber:  { border: '#b45309', bg: '#fffbeb', value: '#b45309' },
} as const

function KpiCard({ label, value, sub, color = 'blue' }: {
  label: string
  value: string | number
  sub?: string
  color?: keyof typeof CARD_COLORS
}) {
  const c = CARD_COLORS[color]
  return (
    <div className="card-lift" style={{
      background: c.bg,
      border: `1px solid ${c.border}22`,
      borderLeft: `4px solid ${c.border}`,
      borderRadius: 10,
      padding: '14px 16px',
      flex: '1 1 140px',
      minWidth: 0,
    }}>
      <p style={{ fontSize: 11, color: c.border, fontWeight: 600, marginBottom: 4, opacity: 0.8 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 800, color: c.value, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: c.border, marginTop: 5, opacity: 0.6 }}>{sub}</p>}
    </div>
  )
}

const TOOLTIP_STYLE = {
  contentStyle: { background: '#fff', border: '1px solid #e7e2d8', borderRadius: 8, fontSize: 12 },
  itemStyle: { color: '#1c1917' },
  cursor: { fill: '#f5f1ea' },
}

const PIE_COLORS = [
  '#1e4b9e', '#16a34a', '#7c3aed', '#b45309',
  '#0d9488', '#db2777', '#ea580c', '#0284c7',
  '#65a30d', '#d97706', '#0891b2', '#9333ea',
]

function estadoFill(name: string) {
  const n = name.toLowerCase()
  if (n.includes('realizada'))           return '#16a34a' // verde
  if (n.includes('cerrada'))             return '#1d4ed8' // azul
  if (n.includes('cerrando'))            return '#3b82f6' // azul claro
  if (n.includes('iniciamos'))           return '#d97706' // ámbar
  if (n.includes('sin respuesta'))       return '#94a3b8' // gris
  if (n.includes('no hemos'))            return '#78716c' // stone
  if (n.includes('no quieren') || n.includes('no podemos')) return '#ef4444' // rojo
  return '#a8a29e'
}

function ValueLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }: any) {
  if (percent < 0.05) return null
  const r = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + r * Math.cos(-midAngle * (Math.PI / 180))
  const y = cy + r * Math.sin(-midAngle * (Math.PI / 180))
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700}>
      {value}
    </text>
  )
}

function ChartsSection({ institutions, onCompaneroClick, onTipoClick }: {
  institutions: Institution[]
  onCompaneroClick: (name: string) => void
  onTipoClick: (tipo: string) => void
}) {
  // ── Métricas existentes ──────────────────────────────────────────────────────
  const totalAsistentes = institutions.reduce((s, i) => s + (i.num_asistentes_charla ?? 0), 0)
  const totalInteresados = institutions.reduce((s, i) => s + (i.num_interesados_firmas ?? 0), 0)
  const pctConversion = totalAsistentes > 0 ? ((totalInteresados / totalAsistentes) * 100).toFixed(1) : '—'

  // ── Nuevas métricas del Cuadro de Mando (I, J, K, L, M, N, O, Q, R) ────────
  const isPresencial = (i: Institution) => (i.tipo_evento ?? '').toLowerCase().includes('presencial')
  const isOnline     = (i: Institution) => (i.tipo_evento ?? '').toLowerCase().includes('online')

  const realizados         = institutions.filter(i => i.estado_charla === 'Charla realizada')
  const agendados          = institutions.filter(i => i.estado_charla === 'Fecha cerrada' || i.estado_charla === 'Cerrando fecha')
  const conCharlaPuesta    = [...realizados, ...agendados] // O = K + N

  const realizadosPresencial = realizados.filter(isPresencial).length  // I
  const realizadosOnline     = realizados.filter(isOnline).length      // J
  const totalRealizados      = realizados.length                       // K
  const agendadosPresencial  = agendados.filter(isPresencial).length   // L
  const agendadosOnline      = agendados.filter(isOnline).length       // M
  const totalAgendados       = agendados.length                        // N
  const totalConCharla       = conCharlaPuesta.length                  // O = realizadas + agendadas
  const totalInstituciones   = institutions.length                     // Q
  const tasaExito            = totalInstituciones > 0
    ? Math.round((totalConCharla / totalInstituciones) * 100) : 0     // R

  // tipoIsOnline / tipoIsPresencial siguen usándose en los KPI cards
  function tipoIsOnline(tipo: string | null): boolean {
    if (!tipo) return false
    const t = tipo.toLowerCase()
    return t.includes('online') || t.includes('webinar')
  }
  function tipoIsPresencial(tipo: string | null): boolean {
    if (!tipo) return false
    return tipo.toLowerCase().includes('presencial')
  }

  // ── Tipos de evento distintos en el dataset ───────────────────────────────────
  const allTipos = useMemo(() => {
    const set = new Set<string>()
    for (const inst of institutions) {
      set.add(inst.tipo_evento?.trim() || 'Sin tipo')
    }
    return Array.from(set).sort()
  }, [institutions])

  // ── Charlas por compañero: una columna por tipo_evento real ──────────────────
  // Total siempre igual al número real de apariciones del compañero.
  const companeroUnifiedData = useMemo(() => {
    const map = new Map<string, Record<string, number>>()
    for (const inst of institutions) {
      if (!inst.compañero_asiste) continue
      const tipo = inst.tipo_evento?.trim() || 'Sin tipo'
      tokenizePersonas(inst.compañero_asiste).forEach(name => {
        const prev = map.get(name) ?? {}
        map.set(name, { ...prev, [tipo]: (prev[tipo] ?? 0) + 1 })
      })
    }
    return Array.from(map.entries())
      .map(([name, counts]) => ({
        name,
        ...counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
      }))
      .filter(d => d.total > 0)
      .sort((a, b) => b.total - a.total)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutions])

  const byProfesionData = useMemo(() => {
    const map = new Map<string, { asistentes: number; interesados: number }>()
    for (const inst of institutions) {
      const key = PROFESION_SHORT[inst.profesion] ?? inst.profesion
      const prev = map.get(key) ?? { asistentes: 0, interesados: 0 }
      map.set(key, {
        asistentes: prev.asistentes + (inst.num_asistentes_charla ?? 0),
        interesados: prev.interesados + (inst.num_interesados_firmas ?? 0),
      })
    }
    return Array.from(map.entries())
      .map(([profesion, vals]) => ({
        profesion,
        asistentes: vals.asistentes,
        interesados: vals.interesados,
        conversion: vals.asistentes > 0
          ? Math.round((vals.interesados / vals.asistentes) * 100)
          : 0,
      }))
      .filter(d => d.asistentes > 0 || d.interesados > 0)
      .sort((a, b) => b.asistentes - a.asistentes)
  }, [institutions])

  const estadoData = useMemo(() => {
    const map = new Map<string, number>()
    for (const inst of institutions) {
      const val = (inst.estado_charla ?? '').trim()
      // Filtrar valores basura (numéricos o textos que no son estados reales)
      if (!val || /^\d+$/.test(val) || val.length > 40) continue
      map.set(val, (map.get(val) ?? 0) + 1)
    }
    const total = Array.from(map.values()).reduce((s, n) => s + n, 0)
    return Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        value,
        pct: total > 0 ? Math.round((value / total) * 100) : 0,
        label: `${value} (${total > 0 ? Math.round((value / total) * 100) : 0}%)`,
      }))
      .sort((a, b) => b.value - a.value)
  }, [institutions])

  const tipoEventoData = useMemo(() => {
    const map = new Map<string, number>()
    for (const inst of institutions) {
      const val = (inst.tipo_evento ?? '').trim()
      if (!val) continue
      map.set(val, (map.get(val) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [institutions])

  const recursosData = useMemo(() => {
    const map = new Map<string, number>()
    for (const inst of institutions) {
      if (!inst.recursos_entregados) continue
      const val = inst.recursos_entregados.trim()
      if (!val) continue
      map.set(val, (map.get(val) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [institutions])

  if (institutions.length === 0) return null

  const CHART_H = 280

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── KPI cards — fila 1: instituciones y eventos ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <KpiCard color="blue"   label="Total instituciones"   value={totalInstituciones}
          sub="en BBDD" />
        <KpiCard color="green"  label="Charlas realizadas y agendadas" value={totalConCharla}
          sub={`tasa de éxito: ${tasaExito}%`} />
        <KpiCard color="blue"   label="Realizados"            value={totalRealizados}
          sub={`${realizadosPresencial} pres · ${realizadosOnline} online`} />
        <KpiCard color="amber"  label="Agendados"             value={totalAgendados}
          sub={`${agendadosPresencial} pres · ${agendadosOnline} online`} />
      </div>

      {/* ── KPI cards — fila 2: resultados de charlas ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <KpiCard color="blue"   label="Estimación total de asistentes"      value={totalAsistentes.toLocaleString('es-ES')}
          sub="acumulado en charlas realizadas" />
        <KpiCard color="green"  label="Total interesados"     value={totalInteresados.toLocaleString('es-ES')}
          sub="firmaron o mostraron interés" />
        <KpiCard color="purple" label="Conversión"            value={`${pctConversion}%`}
          sub="interesados / asistentes" />
      </div>

      {/* ── Fila 1: gráficos de barras (necesitan más ancho) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 12 }}>

        {estadoData.length > 0 && (
          <ChartCard title="Estado de contacto — instituciones">
            <ResponsiveContainer width="100%" height={Math.max(220, estadoData.length * 36)}>
              <BarChart data={estadoData} layout="vertical" margin={{ top: 4, right: 110, left: 4, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#57534e' }} tickLine={false} axisLine={false} width={148} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number, _n: string, item: any) => [`${v} instituciones (${item.payload.pct}%)`, item.payload.name]} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {estadoData.map((d) => <Cell key={d.name} fill={estadoFill(d.name)} />)}
                  <LabelList dataKey="label" position="right" style={{ fontSize: 10, fill: '#57534e', fontWeight: 500 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {companeroUnifiedData.length > 0 && (
          <ChartCard title="Charlas por compañero — haz clic para filtrar la tabla">
            {/* Leyenda dinámica de tipos */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginBottom: 10 }}>
              {allTipos.map((tipo, i) => (
                <span key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ color: '#57534e' }}>{tipo}</span>
                </span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={Math.max(220, companeroUnifiedData.length * 36)}>
              <BarChart
                data={companeroUnifiedData}
                layout="vertical"
                margin={{ top: 4, right: 56, left: 4, bottom: 4 }}
                barSize={20}
                style={{ cursor: 'pointer' }}
                onClick={(data) => {
                  const name = data?.activePayload?.[0]?.payload?.name
                  if (name) onCompaneroClick(name)
                }}
              >
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#57534e' }} tickLine={false} axisLine={false} width={64} />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(v: number, name: string) => [
                    `${v} charla${v !== 1 ? 's' : ''}`,
                    name === 'total' ? 'Total' : name,
                  ]}
                />
                {allTipos.map((tipo, i) => (
                  <Bar
                    key={tipo}
                    dataKey={tipo}
                    stackId="tipo"
                    fill={PIE_COLORS[i % PIE_COLORS.length]}
                    radius={i === allTipos.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]}
                  >
                    {i === allTipos.length - 1 && (
                      <LabelList dataKey="total" position="right" style={{ fontSize: 10, fill: '#57534e', fontWeight: 600 }} />
                    )}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {byProfesionData.length > 0 && (
          <ChartCard title="Asistentes e interesados por profesión">
            <ResponsiveContainer width="100%" height={Math.max(220, byProfesionData.length * 48)}>
              <ComposedChart data={byProfesionData} margin={{ top: 8, right: 32, left: 0, bottom: 8 }} barCategoryGap="28%" barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f0ec" vertical={false} />
                <XAxis dataKey="profesion" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" unit="%" domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(v: number, name: string) =>
                    name === 'conversion'
                      ? [`${v}%`, 'Conversión']
                      : [v.toLocaleString('es-ES'), name === 'asistentes' ? 'Asistentes' : 'Interesados']
                  }
                />
                <Legend
                  wrapperStyle={{ fontSize: 10 }}
                  formatter={(v) => v === 'asistentes' ? 'Asistentes' : v === 'interesados' ? 'Interesados' : 'Conversión %'}
                />
                <Bar yAxisId="left" dataKey="asistentes" fill="#1e4b9e" radius={[3, 3, 0, 0]} maxBarSize={32} />
                <Bar yAxisId="left" dataKey="interesados" fill="#e55a2b" radius={[3, 3, 0, 0]} maxBarSize={32} />
                <Line yAxisId="right" dataKey="conversion" type="monotone" stroke="#7c3aed" strokeWidth={2} dot={{ r: 4, fill: '#7c3aed' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

      </div>

      {/* ── Fila 2: gráficos circulares ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>

        {tipoEventoData.length > 0 && (
          <ChartCard title="Tipo de evento — haz clic para filtrar la tabla">
            <ResponsiveContainer width="100%" height={CHART_H}>
              <PieChart>
                <Pie
                  data={tipoEventoData}
                  dataKey="value"
                  nameKey="name"
                  cx="36%"
                  outerRadius={82}
                  labelLine={false}
                  label={ValueLabel}
                  style={{ cursor: 'pointer' }}
                  onClick={(data) => { if (data?.name) onTipoClick(data.name) }}
                >
                  {tipoEventoData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number, _: string, item: any) => [v, item.payload.name]} />
                <Legend layout="vertical" align="right" verticalAlign="middle" iconSize={8} wrapperStyle={{ fontSize: 10, lineHeight: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}


      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: string | null }) {
  if (!estado) return <span style={{ color: '#a8a29e', fontSize: 11 }}>—</span>

  const lower = estado.toLowerCase()
  let bg = '#f1f5f9'
  let color = '#64748b'

  if (lower.includes('sí') || lower === 'si' || lower.includes('realizada') || lower.includes('hecha')) {
    bg = '#dcfce7'; color = '#16a34a'
  } else if (lower.includes('no') || lower.includes('rechaz') || lower.includes('imposible')) {
    bg = '#fee2e2'; color = '#dc2626'
  } else if (lower.includes('pendiente') || lower.includes('contactar') || lower.includes('interesad')) {
    bg = '#fef9c3'; color = '#ca8a04'
  } else if (lower.includes('agenda') || lower.includes('programad')) {
    bg = '#dbeafe'; color = '#1d4ed8'
  }

  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 500,
      background: bg,
      color,
      whiteSpace: 'nowrap',
      maxWidth: 160,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }}>
      {estado}
    </span>
  )
}

function ContactsCell({ contacts, expanded, onToggle }: {
  contacts: Institution['contacts']
  expanded: boolean
  onToggle: () => void
}) {
  if (!contacts.length) return <span style={{ color: '#a8a29e', fontSize: 11 }}>—</span>

  return (
    <div>
      <button
        onClick={onToggle}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#1e4b9e', fontSize: 11, fontWeight: 500, padding: 0,
        }}
      >
        <Users size={11} />
        {contacts.length} contacto{contacts.length !== 1 ? 's' : ''}
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>
    </div>
  )
}

// ─── Charla detail helpers ────────────────────────────────────────────────────

function hasCharlaData(inst: Institution): boolean {
  return inst.fecha_charla_visita != null || inst.estado_charla === 'Charla realizada'
}

function fmt(label: string, value: string | number | null | undefined): { label: string; value: string } | null {
  if (value == null || value === '') return null
  return { label, value: String(value) }
}

function fmtDate(label: string, value: string | null | undefined): { label: string; value: string } | null {
  if (!value) return null
  const d = new Date(value)
  return {
    label,
    value: isNaN(d.getTime())
      ? value
      : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
  }
}

function CharlaDetail({ inst }: { inst: Institution }) {
  if (!hasCharlaData(inst)) {
    return (
      <div style={{ fontSize: 11, color: '#a8a29e', fontStyle: 'italic', padding: '6px 0' }}>
        Sin charla registrada
      </div>
    )
  }

  const fields = [
    fmtDate('Fecha charla/visita', inst.fecha_charla_visita),
    fmt('Tipo de evento', inst.tipo_evento),
    fmt('Estado charla', inst.estado_charla),
    fmt('Ticker estado', inst.ticker_estado),
    fmt('Persona agenda', inst.persona_contacto_agenda),
    fmt('Ticker agenda', inst.ticker_agenda),
    fmtDate('Última charla', inst.fecha_ultima_charla),
    fmt('Tipo evento última charla', inst.tipo_evento_ultima_charla),
    fmt('Nº asistentes', inst.num_asistentes_charla),
    fmt('Nº interesados / firmas', inst.num_interesados_firmas),
    fmt('Compañero que asiste', inst.compañero_asiste),
    fmt('Global Worker asiste', inst.global_worker_asiste),
    fmt('Recursos entregados', inst.recursos_entregados),
    fmt('Ciudad visita', inst.ciudad),
    fmt('Comentarios', inst.comentarios),
  ].filter((f): f is { label: string; value: string } => f !== null)

  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#1e4b9e', marginBottom: 8 }}>
        Detalle de la charla
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px 16px' }}>
        {fields.map(({ label, value }) => (
          <div key={label} style={{ fontSize: 11 }}>
            <span style={{ color: '#a8a29e', fontWeight: 500 }}>{label}: </span>
            <span style={{ color: '#1c1917' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function InstitutionRow({ inst }: { inst: Institution }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr className="table-row" style={{ borderBottom: '1px solid #f1f0ec' }}>
        {/* Universidad */}
        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
          <div style={{ fontWeight: 500, fontSize: 12, color: '#1c1917', lineHeight: 1.4 }}>
            {inst.universidad}
          </div>
          {inst.tipo_centro && (
            <div style={{ fontSize: 11, color: '#a8a29e', marginTop: 1 }}>{inst.tipo_centro}</div>
          )}
          {inst.web && (
            <a
              href={inst.web.startsWith('http') ? inst.web : `https://${inst.web}`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 10, color: '#1e4b9e', display: 'inline-flex', alignItems: 'center', gap: 2, marginTop: 1, textDecoration: 'none' }}
            >
              <ExternalLink size={9} /> web
            </a>
          )}
        </td>

        {/* Comunidad */}
        <td style={{ padding: '8px 12px', fontSize: 11, color: '#57534e', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={10} style={{ flexShrink: 0, color: '#a8a29e' }} />
            {inst.comunidad_autonoma ?? '—'}
          </div>
          {inst.ciudad && (
            <div style={{ fontSize: 10, color: '#a8a29e', marginTop: 1, marginLeft: 14 }}>{inst.ciudad}</div>
          )}
        </td>

        {/* Estado */}
        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
          <EstadoBadge estado={inst.estado_charla} />
          {inst.ticker_estado && (
            <div style={{ fontSize: 10, color: '#a8a29e', marginTop: 3 }}>{inst.ticker_estado}</div>
          )}
        </td>

        {/* Última charla */}
        <td style={{ padding: '8px 12px', fontSize: 11, color: '#57534e', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
          {inst.fecha_ultima_charla
            ? new Date(inst.fecha_ultima_charla).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—'}
          {inst.tipo_evento_ultima_charla && (
            <div style={{ fontSize: 10, color: '#a8a29e', marginTop: 1 }}>{inst.tipo_evento_ultima_charla}</div>
          )}
        </td>

        {/* Email / Teléfono */}
        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
          {inst.email_facultad ? (
            <a
              href={`mailto:${inst.email_facultad}`}
              style={{ fontSize: 11, color: '#1e4b9e', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
            >
              <Mail size={10} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                {inst.email_facultad}
              </span>
            </a>
          ) : (
            <span style={{ color: '#a8a29e', fontSize: 11 }}>—</span>
          )}
          {inst.telefono_facultad && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
              <Phone size={10} style={{ color: '#a8a29e', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#57534e' }}>{inst.telefono_facultad}</span>
            </div>
          )}
        </td>

        {/* Nº visitas */}
        <td style={{ padding: '8px 12px', fontSize: 12, color: '#57534e', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }}>
          {inst.num_visitas != null ? inst.num_visitas : <span style={{ color: '#a8a29e' }}>—</span>}
        </td>

        {/* Alumnos Zoho */}
        <td style={{ padding: '8px 12px', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }}>
          {inst.alumnos_registrados_zoho != null ? (
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1e4b9e' }}>
              {inst.alumnos_registrados_zoho.toLocaleString('es-ES')}
            </span>
          ) : <span style={{ color: '#a8a29e', fontSize: 12 }}>—</span>}
        </td>

        {/* Plazas/año */}
        <td style={{ padding: '8px 12px', fontSize: 12, color: '#57534e', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }}>
          {inst.plazas_anio != null ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
              <BookOpen size={10} style={{ color: '#a8a29e' }} />
              {inst.plazas_anio.toLocaleString('es-ES')}
            </div>
          ) : <span style={{ color: '#a8a29e' }}>—</span>}
        </td>

        {/* Contactos */}
        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
          <ContactsCell
            contacts={inst.contacts}
            expanded={expanded}
            onToggle={() => setExpanded(v => !v)}
          />
        </td>
      </tr>

      {/* Expanded: contacts + charla detail */}
      {expanded && (
        <tr style={{ background: '#fafaf9', borderBottom: '1px solid #f1f0ec' }}>
          <td colSpan={9} style={{ padding: '10px 24px 14px 40px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Contacts */}
              {inst.contacts.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#57534e', marginBottom: 8 }}>Contactos</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {inst.contacts.map(c => (
                      <div
                        key={c.contact_number}
                        style={{
                          background: '#fff',
                          border: '1px solid #e7e2d8',
                          borderRadius: 8,
                          padding: '6px 10px',
                          fontSize: 11,
                          minWidth: 160,
                          maxWidth: 240,
                        }}
                      >
                        <div style={{ fontWeight: 600, color: '#1c1917', marginBottom: 2 }}>
                          Contacto {c.contact_number}
                          {c.nombre_cargo && (
                            <span style={{ fontWeight: 400, color: '#78716c', marginLeft: 4 }}>— {c.nombre_cargo}</span>
                          )}
                        </div>
                        {c.contacto && (
                          <div style={{ color: '#57534e', wordBreak: 'break-word' }}>{c.contacto}</div>
                        )}
                        {c.feedback && (
                          <div style={{ color: '#78716c', fontStyle: 'italic', marginTop: 2, borderTop: '1px solid #f1f0ec', paddingTop: 2 }}>
                            {c.feedback}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Charla detail */}
              <div style={{ borderTop: inst.contacts.length > 0 ? '1px solid #f1f0ec' : undefined, paddingTop: inst.contacts.length > 0 ? 10 : 0 }}>
                <CharlaDetail inst={inst} />
              </div>

            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InstitutionesView() {
  const [data, setData] = useState<InstitutionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [profesionFilter, setProfesionFilter] = useState<InstitucionProfesion | 'todas'>('todas')
  const [comunidadFilter, setComunidadFilter] = useState<string>('todas')
  const [estadoFilter, setEstadoFilter] = useState<string>('todos')
  const [tipoEventoFilter, setTipoEventoFilter] = useState<string>('todos')
  const [companeroFilter, setCompaneroFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [viewMode, setViewMode] = useState<'tabla' | 'calendario'>('tabla')

  // Ref para hacer scroll a la tabla cuando se activa un filtro desde un gráfico
  const tableRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getInstitutions()
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.institutions.filter(inst => {
      if (profesionFilter !== 'todas' && inst.profesion !== profesionFilter) return false
      if (comunidadFilter !== 'todas' && inst.comunidad_autonoma !== comunidadFilter) return false
      if (estadoFilter !== 'todos' && inst.estado_charla !== estadoFilter) return false
      if (tipoEventoFilter !== 'todos' && inst.tipo_evento !== tipoEventoFilter) return false
      // Filtro por compañero: match exacto de token (primer nombre)
      if (companeroFilter) {
        const tokens = tokenizePersonas(inst.compañero_asiste ?? '')
        if (!tokens.some(t => t.toLowerCase() === companeroFilter.toLowerCase())) return false
      }
      if (search) {
        const q = search.toLowerCase()
        if (
          !inst.universidad.toLowerCase().includes(q) &&
          !(inst.ciudad ?? '').toLowerCase().includes(q) &&
          !(inst.comunidad_autonoma ?? '').toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [data, profesionFilter, comunidadFilter, estadoFilter, tipoEventoFilter, companeroFilter, search])

  // ── Handlers de click desde gráficos ─────────────────────────────────────────
  const handleCompaneroClick = (name: string) => {
    setCompaneroFilter(prev => prev === name ? '' : name)
    // Scroll suave a la tabla tras el re-render
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  const handleTipoClick = (tipo: string) => {
    setTipoEventoFilter(prev => prev === tipo ? 'todos' : tipo)
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  // ── Loading / Error ──
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0', color: '#78716c', fontSize: 13 }}>
        <Building2 size={16} style={{ marginRight: 8, color: '#a8a29e' }} />
        Cargando instituciones…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ padding: '24px 0', color: '#dc2626', fontSize: 13 }}>
        Error al cargar instituciones: {error}
      </div>
    )
  }

  const totalFiltered = filtered.length
  const totalAll = data.institutions.length

  return (
    <div className="space-y-4">

      {/* ─── Chips de profesión ─── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {INSTITUCION_PROFESIONES.map(prof => {
          const count = data.byProfesion[prof] ?? 0
          const active = profesionFilter === prof
          return (
            <button
              key={prof}
              onClick={() => setProfesionFilter(active ? 'todas' : prof)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 10px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: active ? 600 : 400,
                background: active ? '#1e4b9e' : '#ffffff',
                color: active ? '#ffffff' : '#57534e',
                border: `1px solid ${active ? '#1e4b9e' : '#e7e2d8'}`,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {prof}
              <span style={{
                background: active ? 'rgba(255,255,255,0.25)' : '#f1f0ec',
                color: active ? '#ffffff' : '#78716c',
                borderRadius: 99,
                padding: '1px 6px',
                fontSize: 10,
                fontWeight: 600,
              }}>
                {count}
              </span>
            </button>
          )
        })}
        {profesionFilter !== 'todas' && (
          <button
            onClick={() => setProfesionFilter('todas')}
            style={{
              padding: '5px 10px', borderRadius: 8, fontSize: 11,
              background: '#fef2f2', color: '#dc2626',
              border: '1px solid #fecaca', cursor: 'pointer',
            }}
          >
            ✕ quitar filtro
          </button>
        )}
      </div>

      {/* ─── Filtros ─── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Buscar por nombre, ciudad…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={{
            background: '#ffffff',
            border: `1px solid ${searchFocused ? '#1e4b9e' : '#e7e2d8'}`,
            borderRadius: 8,
            color: '#1c1917',
            fontSize: 12,
            padding: '6px 12px',
            width: 220,
            outline: 'none',
            boxShadow: searchFocused ? '0 0 0 3px rgba(30, 75, 158, 0.10)' : 'none',
          }}
        />
        <select
          value={comunidadFilter}
          onChange={e => setComunidadFilter(e.target.value)}
          style={{
            background: '#ffffff', border: '1px solid #e7e2d8', borderRadius: 8,
            color: '#1c1917', fontSize: 12, padding: '6px 12px', cursor: 'pointer',
            transition: 'border-color 150ms ease, box-shadow 150ms ease',
          }}
        >
          <option value="todas">Todas las comunidades</option>
          {data.comunidades.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={estadoFilter}
          onChange={e => setEstadoFilter(e.target.value)}
          style={{
            background: '#ffffff', border: '1px solid #e7e2d8', borderRadius: 8,
            color: '#1c1917', fontSize: 12, padding: '6px 12px', cursor: 'pointer',
            transition: 'border-color 150ms ease, box-shadow 150ms ease',
          }}
        >
          <option value="todos">Todos los estados</option>
          {data.estadosCharla.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select
          value={tipoEventoFilter}
          onChange={e => setTipoEventoFilter(e.target.value)}
          style={{
            background: '#ffffff', border: '1px solid #e7e2d8', borderRadius: 8,
            color: '#1c1917', fontSize: 12, padding: '6px 12px', cursor: 'pointer',
            transition: 'border-color 150ms ease, box-shadow 150ms ease',
          }}
        >
          <option value="todos">Todos los tipos de evento</option>
          {data.tiposEvento.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span style={{ fontSize: 11, color: '#a8a29e', marginLeft: 4 }}>
          {totalFiltered === totalAll
            ? `${totalAll} instituciones`
            : `${totalFiltered} de ${totalAll}`}
        </span>
        {/* Chip filtro compañero activo */}
        {companeroFilter && (
          <button
            onClick={() => setCompaneroFilter('')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
              background: '#eff6ff', color: '#1e4b9e',
              border: '1px solid #bfdbfe', cursor: 'pointer',
            }}
          >
            👤 {companeroFilter} ✕
          </button>
        )}
        {/* ─── Toggle tabla / calendario ─── */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, background: '#f1f0ec', borderRadius: 8, padding: 2 }}>
          {(['tabla', 'calendario'] as const).map(mode => {
            const active = viewMode === mode
            return (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: active ? 600 : 400,
                  background: active ? '#fff' : 'transparent',
                  color: active ? '#1e4b9e' : '#78716c',
                  border: active ? '1px solid #e7e2d8' : '1px solid transparent',
                  cursor: 'pointer',
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 150ms ease',
                }}
              >
                {mode === 'tabla'
                  ? <><LayoutList size={13} /> Tabla</>
                  : <><CalendarDays size={13} /> Calendario</>}
              </button>
            )
          })}
        </div>
      </div>

      {viewMode === 'tabla' && (
        <>
          {/* ─── Gráficos (reactivos a los filtros) ─── */}
          <ChartsSection
            institutions={filtered}
            onCompaneroClick={handleCompaneroClick}
            onTipoClick={handleTipoClick}
          />

          {/* ─── Tabla ─── */}
          <div ref={tableRef} style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e7e2d8' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{
                  background: 'rgba(250, 249, 247, 0.97)',
                  borderBottom: '1px solid #e7e2d8',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#78716c', fontSize: 11, whiteSpace: 'nowrap' }}>Universidad</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#78716c', fontSize: 11, whiteSpace: 'nowrap' }}>Comunidad / Ciudad</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#78716c', fontSize: 11, whiteSpace: 'nowrap' }}>Estado charla</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#78716c', fontSize: 11, whiteSpace: 'nowrap' }}>Última charla</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#78716c', fontSize: 11, whiteSpace: 'nowrap' }}>Contacto facultad</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#78716c', fontSize: 11, whiteSpace: 'nowrap' }}>Nº visitas</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#1e4b9e', fontSize: 11, whiteSpace: 'nowrap' }}>Alumnos Zoho</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#78716c', fontSize: 11, whiteSpace: 'nowrap' }}>Plazas/año</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#78716c', fontSize: 11, whiteSpace: 'nowrap' }}>Contactos</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '48px 32px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: 12,
                          background: '#f1f0ec',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <svg width="20" height="20" fill="none" stroke="#a8a29e" strokeWidth="1.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                          </svg>
                        </div>
                        <p style={{ fontSize: 13, color: '#a8a29e', margin: 0, fontWeight: 500 }}>Sin resultados</p>
                        <p style={{ fontSize: 12, color: '#c4b9a8', margin: 0 }}>No hay instituciones con los filtros aplicados</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map(inst => (
                    <InstitutionRow key={inst.id} inst={inst} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {viewMode === 'calendario' && (
        <InstitutionCalendarView filtered={filtered} />
      )}
    </div>
  )
}
