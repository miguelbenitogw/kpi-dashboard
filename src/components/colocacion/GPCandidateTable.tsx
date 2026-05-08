'use client'

import { useEffect, useState, useMemo } from 'react'
import { CheckCircle2, XCircle, Search, ChevronUp, ChevronDown } from 'lucide-react'
import {
  getGPCandidatesFull,
  getGPKPIStats,
  type GPCandidateFull,
  type GPKPIStats,
} from '@/lib/queries/colocacion'

// ── KPI summary cards ─────────────────────────────────────────────────────────

function KPICard({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e7e2d8',
        borderRadius: 12,
        padding: '14px 18px',
        flex: 1,
        minWidth: 120,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#78716c', marginTop: 4, fontWeight: 500 }}>{label}</div>
      {total > 0 && (
        <div style={{ fontSize: 10, color: '#a8a29e', marginTop: 2 }}>
          {pct}% del total
        </div>
      )}
    </div>
  )
}

// ── Boolean pill ──────────────────────────────────────────────────────────────

function BoolPill({ value }: { value: boolean | null }) {
  if (value === null || value === undefined) {
    return <span style={{ color: '#d4d0c8', fontSize: 13 }}>—</span>
  }
  return value
    ? <CheckCircle2 size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
    : <XCircle size={14} style={{ color: '#d1d5db', flexShrink: 0 }} />
}

// ── HPR badge ─────────────────────────────────────────────────────────────────

function HPRBadge({ value }: { value: string | null }) {
  if (!value || !String(value).trim()) {
    return <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>
  }
  return (
    <span
      style={{
        background: '#dcfce7',
        color: '#166534',
        borderRadius: 6,
        padding: '1px 7px',
        fontSize: 11,
        fontWeight: 600,
        fontFamily: 'monospace',
      }}
    >
      {value}
    </span>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'training':     { bg: '#eff6ff', color: '#1d4ed8' },
  'completed':    { bg: '#f0fdf4', color: '#15803d' },
  'placed':       { bg: '#dcfce7', color: '#166534' },
  'active':       { bg: '#eff6ff', color: '#1d4ed8' },
  'inactive':     { bg: '#f3f4f6', color: '#6b7280' },
}

function StatusBadge({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>
  const key = value.toLowerCase()
  const c = STATUS_COLORS[key] ?? { bg: '#f5f1ea', color: '#78716c' }
  return (
    <span
      style={{
        background: c.bg,
        color: c.color,
        borderRadius: 6,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {value}
    </span>
  )
}

// ── Sort helpers ──────────────────────────────────────────────────────────────

type SortKey = keyof GPCandidateFull
type SortDir = 'asc' | 'desc'

function sortRows(rows: GPCandidateFull[], key: SortKey, dir: SortDir): GPCandidateFull[] {
  return [...rows].sort((a, b) => {
    const av = a[key] ?? ''
    const bv = b[key] ?? ''
    const cmp = String(av).localeCompare(String(bv), 'es', { numeric: true })
    return dir === 'asc' ? cmp : -cmp
  })
}

// ── Column header ─────────────────────────────────────────────────────────────

function TH({
  label, sortKey, currentKey, currentDir, onSort,
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  currentDir: SortDir
  onSort: (k: SortKey) => void
}) {
  const active = currentKey === sortKey
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{
        padding: '8px 12px',
        textAlign: 'left',
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: active ? '#1e4b9e' : '#78716c',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        borderBottom: '1px solid #e7e2d8',
        background: '#f5f1ea',
        userSelect: 'none',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        {label}
        {active
          ? currentDir === 'asc'
            ? <ChevronUp size={10} />
            : <ChevronDown size={10} />
          : null}
      </span>
    </th>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GPCandidateTable({ promoFilter }: { promoFilter: string }) {
  const [rows, setRows]     = useState<GPCandidateFull[]>([])
  const [stats, setStats]   = useState<GPKPIStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey]   = useState<SortKey>('full_name')
  const [sortDir, setSortDir]   = useState<SortDir>('asc')

  useEffect(() => {
    setLoading(true)
    const promo = promoFilter || null
    Promise.all([
      getGPCandidatesFull(promo),
      getGPKPIStats(promo),
    ]).then(([r, s]) => {
      setRows(r)
      setStats(s)
      setLoading(false)
    })
  }, [promoFilter])

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const base = q
      ? rows.filter((r) =>
          (r.full_name ?? '').toLowerCase().includes(q) ||
          (r.gp_training_status ?? '').toLowerCase().includes(q) ||
          (r.promocion_nombre ?? '').toLowerCase().includes(q),
        )
      : rows
    return sortRows(base, sortKey, sortDir)
  }, [rows, search, sortKey, sortDir])

  // ── Shared TH props shortcut ──────────────────────────────────────────────
  const thProps = { currentKey: sortKey, currentDir: sortDir, onSort: handleSort }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPI cards */}
      {stats && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <KPICard label="Total en GP" value={stats.total}         total={stats.total} color="#1e4b9e" />
          <KPICard label="HPR Nummer"  value={stats.with_hpr}      total={stats.total} color="#15803d" />
          <KPICard label="Solicitudes enviadas" value={stats.app_sent} total={stats.total} color="#b45309" />
          <KPICard label="Talent Portal" value={stats.talent_portal} total={stats.total} color="#7c3aed" />
          <KPICard label="CV Norsk"    value={stats.with_cv_norsk} total={stats.total} color="#0e7490" />
        </div>
      )}

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
          <Search
            size={13}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#a8a29e' }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, estado o promo…"
            style={{
              width: '100%',
              paddingLeft: 30,
              paddingRight: 10,
              paddingTop: 7,
              paddingBottom: 7,
              fontSize: 13,
              border: '1px solid #e7e2d8',
              borderRadius: 8,
              outline: 'none',
              color: '#1c1917',
              background: '#faf9f7',
            }}
          />
        </div>
        <span style={{ fontSize: 12, color: '#a8a29e' }}>
          {loading ? 'Cargando…' : `${filtered.length} candidatos`}
        </span>
      </div>

      {/* Table */}
      <div
        style={{
          overflowX: 'auto',
          borderRadius: 10,
          border: '1px solid #e7e2d8',
          background: '#fff',
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 160 }}>
            <div
              style={{
                width: 24, height: 24, borderRadius: '50%',
                border: '2px solid #e7e2d8',
                borderTopColor: '#1e4b9e',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#a8a29e', fontSize: 13 }}>
            {rows.length === 0
              ? 'Sin candidatos con datos de Global Placement.'
              : 'Sin resultados para la búsqueda.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <TH label="Nombre"        sortKey="full_name"              {...thProps} />
                <TH label="Promo"         sortKey="promocion_nombre"       {...thProps} />
                <TH label="Tipo perfil"   sortKey="gp_tipo_perfil"         {...thProps} />
                <TH label="Estado GP"     sortKey="gp_training_status"     {...thProps} />
                <TH label="Open To"       sortKey="gp_open_to"             {...thProps} />
                <TH label="Fin formación" sortKey="gp_finish_date"         {...thProps} />
                <TH label="HPR #"         sortKey="gp_hpr_nummer"          {...thProps} />
                <TH label="Webcruiter"    sortKey="gp_webcruiter"          {...thProps} />
                <TH label="Solicitud"     sortKey="gp_application_sent"    {...thProps} />
                <TH label="Talent Portal" sortKey="gp_profile_talent_portal" {...thProps} />
                <TH label="CV Norsk"      sortKey="gp_cv_norsk"            {...thProps} />
                <TH label="Total apps"    sortKey="gp_total_applications"  {...thProps} />
                <TH label="Ratio"         sortKey="gp_interviews_ratio"    {...thProps} />
                <TH label="Quincena"      sortKey="gp_quincena"            {...thProps} />
                <TH label="Assignment"    sortKey="gp_assignment"          {...thProps} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr
                  key={r.id}
                  style={{
                    background: i % 2 === 0 ? '#ffffff' : '#faf9f7',
                    borderBottom: '1px solid #f0ece4',
                  }}
                >
                  <td style={{ padding: '7px 12px', fontWeight: 500, color: '#1c1917', whiteSpace: 'nowrap' }}>
                    {r.full_name ?? '—'}
                  </td>
                  <td style={{ padding: '7px 12px', color: '#78716c', whiteSpace: 'nowrap' }}>
                    {r.promocion_nombre ?? '—'}
                  </td>
                  <td style={{ padding: '7px 12px', color: '#78716c', whiteSpace: 'nowrap' }}>
                    {r.gp_tipo_perfil ?? '—'}
                  </td>
                  <td style={{ padding: '7px 12px' }}>
                    <StatusBadge value={r.gp_training_status} />
                  </td>
                  <td
                    style={{
                      padding: '7px 12px', color: '#78716c',
                      maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                    title={r.gp_open_to ?? ''}
                  >
                    {r.gp_open_to ?? '—'}
                  </td>
                  <td style={{ padding: '7px 12px', color: '#78716c', whiteSpace: 'nowrap' }}>
                    {r.gp_finish_date ?? '—'}
                  </td>
                  <td style={{ padding: '7px 12px' }}>
                    <HPRBadge value={r.gp_hpr_nummer} />
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                    <BoolPill value={r.gp_webcruiter} />
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                    <BoolPill value={r.gp_application_sent} />
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                    <BoolPill value={r.gp_profile_talent_portal} />
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                    <BoolPill value={r.gp_cv_norsk} />
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 500, color: '#1e4b9e' }}>
                    {r.gp_total_applications != null ? r.gp_total_applications : '—'}
                  </td>
                  <td style={{ padding: '7px 12px', color: '#78716c', whiteSpace: 'nowrap' }}>
                    {r.gp_interviews_ratio ?? '—'}
                  </td>
                  <td style={{ padding: '7px 12px', color: '#78716c', whiteSpace: 'nowrap' }}>
                    {r.gp_quincena ?? '—'}
                  </td>
                  <td
                    style={{
                      padding: '7px 12px', color: '#78716c',
                      maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                    title={r.gp_assignment ?? ''}
                  >
                    {r.gp_assignment ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
