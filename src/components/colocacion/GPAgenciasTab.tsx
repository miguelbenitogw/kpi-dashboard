'use client'

import { useState, useEffect } from 'react'
import {
  getGPAgenciaTabData,
  type GPAgenciaRow,
  type GPAgenciaCandidateRow,
} from '@/lib/queries/colocacion'

// ── shared status color map ───────────────────────────────────────────────────

const STATUS_STYLE_MAP: Record<string, { bg: string; color: string }> = {
  'Hired':                  { bg: '#f0fdf4', color: '#15803d' },
  'Assigned':               { bg: '#f0fdf4', color: '#15803d' },
  'Approved by client':     { bg: '#f0fdf4', color: '#15803d' },
  'Transferred':            { bg: '#f0fdf4', color: '#15803d' },
  'Hired by agency':        { bg: '#f0fdf4', color: '#15803d' },
  'To Place':               { bg: '#fefce8', color: '#854d0e' },
  'In Training':            { bg: '#f0f9ff', color: '#0369a1' },
  'Interview in process':   { bg: '#fdf4ff', color: '#7e22ce' },
  'Presented to an Agency': { bg: '#fdf4ff', color: '#7e22ce' },
}

function getStatusStyle(s: string) {
  return STATUS_STYLE_MAP[s] ?? { bg: '#f5f5f4', color: '#57534e' }
}

function statusBadge(s: string | null) {
  if (!s) return null
  const { bg, color } = getStatusStyle(s)
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
    }}>
      {s}
    </span>
  )
}

// ── status breakdown — always visible in each agency card header ──────────────

function StatusBreakdown({ candidates }: { candidates: GPAgenciaCandidateRow[] }) {
  const total = candidates.length
  if (total === 0) return null

  const counts = new Map<string, number>()
  for (const c of candidates) {
    const s = c.gp_training_status ?? 'Sin estado'
    counts.set(s, (counts.get(s) ?? 0) + 1)
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
      {sorted.map(([status, count]) => {
        const pct = Math.round((count / total) * 100)
        const { bg, color } = getStatusStyle(status)
        return (
          <span
            key={status}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 500,
              background: bg, color,
              border: `1px solid ${color}28`,
            }}
          >
            {status}
            <strong style={{ fontWeight: 700 }}>{count}</strong>
            <span style={{ opacity: 0.6, fontSize: 10 }}>{pct}%</span>
          </span>
        )
      })}
    </div>
  )
}

// ── agency color map ──────────────────────────────────────────────────────────

const AGENCY_COLORS: Record<string, { bg: string; color: string }> = {
  'Randstad':     { bg: '#fef2f2', color: '#991b1b' },
  'Eccera':       { bg: '#f0f9ff', color: '#0369a1' },
  'Summer FC':    { bg: '#f0fdf4', color: '#15803d' },
  'Summer Viva':  { bg: '#f0fdf4', color: '#166534' },
  'Helsenor':     { bg: '#fdf4ff', color: '#7e22ce' },
  'Vacant Helse': { bg: '#fff7ed', color: '#9a3412' },
  'Focus Care':   { bg: '#fefce8', color: '#854d0e' },
}

function agencyColor(name: string) {
  return AGENCY_COLORS[name] ?? { bg: '#f5f5f4', color: '#57534e' }
}

// ── agency card ───────────────────────────────────────────────────────────────

function AgencyCard({ row }: { row: GPAgenciaRow }) {
  const [open, setOpen] = useState(false)
  const { bg, color } = agencyColor(row.agency)

  return (
    <div style={{ border: '1px solid #e7e2d8', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      {/* Header — always shows status breakdown */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', padding: '12px 16px',
          background: bg, border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              padding: '3px 12px', borderRadius: 99, fontSize: 13, fontWeight: 700,
              background: bg, color, border: `1px solid ${color}22`,
            }}>
              {row.agency}
            </span>
            <span style={{ fontSize: 13, color: '#78716c' }}>
              {row.count} candidato{row.count !== 1 ? 's' : ''}
            </span>
          </div>
          <StatusBreakdown candidates={row.candidates} />
        </div>
        <span style={{
          fontSize: 16, color: '#78716c', flexShrink: 0, marginLeft: 12, marginTop: 2,
          transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms',
        }}>▾</span>
      </button>

      {/* Candidate table */}
      {open && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e7e2d8', background: '#fafaf9' }}>
                {['Nombre', 'Promo', 'Estado GP', 'Placement', 'Preferencia'].map((h) => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: '#78716c', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {row.candidates.map((c: GPAgenciaCandidateRow) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f5f5f4' }}>
                  <td style={{ padding: '7px 10px', fontWeight: 500, color: '#1c1917', whiteSpace: 'nowrap' }}>{c.full_name ?? '—'}</td>
                  <td style={{ padding: '7px 10px', color: '#78716c', whiteSpace: 'nowrap' }}>{c.promocion_nombre ?? '—'}</td>
                  <td style={{ padding: '7px 10px' }}>{statusBadge(c.gp_training_status)}</td>
                  <td style={{ padding: '7px 10px' }}>{statusBadge(c.placement_status)}</td>
                  <td style={{ padding: '7px 10px', color: '#78716c', fontSize: 11, maxWidth: 200 }}>{c.gp_open_to ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function GPAgenciasTab({ year }: { year: number }) {
  const [rows, setRows] = useState<GPAgenciaRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getGPAgenciaTabData(year).then((d) => {
      setRows(d)
      setLoading(false)
    })
  }, [year])

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#78716c', fontSize: 13 }}>
        Cargando datos de agencias…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <p style={{ fontSize: 13, color: '#78716c', textAlign: 'center', padding: 24 }}>
        Sin candidatos en agencias para este año.
      </p>
    )
  }

  const total = rows.reduce((acc, r) => acc + r.count, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Summary bar */}
      <div style={{
        display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
        padding: '8px 12px', background: '#f8f7f4', borderRadius: 10,
        border: '1px solid #e7e2d8', fontSize: 12,
      }}>
        <span style={{ fontWeight: 600, color: '#1c1917' }}>{total} candidatos</span>
        <span style={{ color: '#d4c8b8' }}>·</span>
        <span style={{ color: '#78716c' }}>{rows.length} agencias</span>
        <span style={{ color: '#d4c8b8' }}>·</span>
        {rows.slice(0, 3).map((r) => (
          <span key={r.agency} style={{ color: '#78716c' }}>
            <strong style={{ color: agencyColor(r.agency).color }}>{r.agency}</strong> {r.count}
          </span>
        ))}
      </div>

      {/* Agency cards */}
      {rows.map((row) => (
        <AgencyCard key={row.agency} row={row} />
      ))}
    </div>
  )
}
