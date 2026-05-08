'use client'

import { useState, useEffect } from 'react'
import {
  getGPKommunerTabData,
  type GPKommunerTabData,
  type GPKommunerCandidateRow,
  type GPWantedKommunerRow,
} from '@/lib/queries/colocacion'

// ── helpers ───────────────────────────────────────────────────────────────────

function statusBadge(s: string | null) {
  if (!s) return null
  const map: Record<string, { bg: string; color: string }> = {
    'GP - Kommuner':    { bg: '#ecfeff', color: '#0e7490' },
    'Hired':            { bg: '#f0fdf4', color: '#15803d' },
    'Assigned':         { bg: '#f0fdf4', color: '#15803d' },
    'Approved by client': { bg: '#f0fdf4', color: '#15803d' },
    'Transferred':      { bg: '#f0fdf4', color: '#15803d' },
    'To Place':         { bg: '#fefce8', color: '#854d0e' },
    'In Training':      { bg: '#f0f9ff', color: '#0369a1' },
    'Interview in process': { bg: '#fdf4ff', color: '#7e22ce' },
    'Presented to an Agency': { bg: '#fdf4ff', color: '#7e22ce' },
    'Hired by agency':  { bg: '#f0fdf4', color: '#15803d' },
  }
  const style = map[s] ?? { bg: '#f5f5f4', color: '#57534e' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 500,
      background: style.bg,
      color: style.color,
      whiteSpace: 'nowrap',
    }}>
      {s}
    </span>
  )
}

// ── sub-components ────────────────────────────────────────────────────────────

function AppStatsBox({ stats, year }: {
  stats: GPKommunerTabData['appStats']
  year: number
}) {
  if (!stats) return null
  const coveragePct = stats.total > 0
    ? Math.round((stats.coverage / stats.total) * 100)
    : 0

  return (
    <div style={{
      display: 'flex',
      gap: 12,
      flexWrap: 'wrap',
      background: '#f8f7f4',
      border: '1px solid #e7e2d8',
      borderRadius: 12,
      padding: '12px 16px',
      marginBottom: 16,
      alignItems: 'center',
    }}>
      <span style={{ fontSize: 12, color: '#78716c', fontWeight: 500, marginRight: 4 }}>
        Solicitudes por candidato{year === 2025 ? '' : ''} ·
      </span>
      {[
        { label: 'Media',   value: stats.mean },
        { label: 'Mediana', value: stats.median },
        { label: 'Desv.',   value: stats.stddev },
      ].map(({ label, value }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#0e7490' }}>{value}</span>
          <span style={{ fontSize: 11, color: '#78716c' }}>{label}</span>
        </div>
      ))}
      <span style={{ fontSize: 11, color: '#a8a29e', marginLeft: 'auto' }}>
        Cobertura: {stats.coverage}/{stats.total} candidatos ({coveragePct}%)
      </span>
    </div>
  )
}

function KommunerTable({ rows }: { rows: GPKommunerCandidateRow[] }) {
  if (rows.length === 0) {
    return <p style={{ fontSize: 13, color: '#78716c', textAlign: 'center', padding: 24 }}>Sin candidatos en Kommuner para este año.</p>
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #e7e2d8' }}>
            {['Nombre', 'Promo', 'Estado GP', 'Placement', 'Solicitudes'].map((h) => (
              <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: '#78716c', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #f5f5f4' }}>
              <td style={{ padding: '7px 10px', fontWeight: 500, color: '#1c1917', whiteSpace: 'nowrap' }}>{r.full_name ?? '—'}</td>
              <td style={{ padding: '7px 10px', color: '#78716c', whiteSpace: 'nowrap' }}>{r.promocion_nombre ?? '—'}</td>
              <td style={{ padding: '7px 10px' }}>{statusBadge(r.gp_training_status)}</td>
              <td style={{ padding: '7px 10px' }}>{statusBadge(r.placement_status)}</td>
              <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 600, color: r.gp_total_applications != null ? '#0e7490' : '#d1d5db' }}>
                {r.gp_total_applications ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WantedKommunerSection({ rows, year }: { rows: GPWantedKommunerRow[]; year: number }) {
  const [open, setOpen] = useState(false)
  if (rows.length === 0) return null

  return (
    <div style={{ marginTop: 16, border: '1px solid #fed7aa', borderRadius: 12, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', background: '#fff7ed', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, color: '#9a3412',
        }}
      >
        <span>
          ⚠️ Querían Kommuner pero están con una agencia
          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, opacity: 0.7 }}>
            {rows.length} candidatos
            {year === 2025 ? '' : ' · aún en proceso (año 2026)'}
          </span>
        </span>
        <span style={{ fontSize: 16, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>▾</span>
      </button>

      {open && (
        <div style={{ overflowX: 'auto', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #fed7aa', background: '#fff7ed' }}>
                {['Nombre', 'Promo', 'Agencia asignada', 'Preferencia', 'Placement'].map((h) => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: '#9a3412', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #fef3c7' }}>
                  <td style={{ padding: '7px 10px', fontWeight: 500, color: '#1c1917', whiteSpace: 'nowrap' }}>{r.full_name ?? '—'}</td>
                  <td style={{ padding: '7px 10px', color: '#78716c', whiteSpace: 'nowrap' }}>{r.promocion_nombre ?? '—'}</td>
                  <td style={{ padding: '7px 10px' }}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500, background: '#f5f3ff', color: '#6d28d9', whiteSpace: 'nowrap' }}>
                      {r.assigned_agency}
                    </span>
                  </td>
                  <td style={{ padding: '7px 10px', color: '#57534e', fontSize: 11, maxWidth: 200 }}>{r.gp_open_to ?? '—'}</td>
                  <td style={{ padding: '7px 10px' }}>{statusBadge(r.placement_status)}</td>
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

export default function GPKommunerTab({ year }: { year: number }) {
  const [data, setData] = useState<GPKommunerTabData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getGPKommunerTabData(year).then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [year])

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#78716c', fontSize: 13 }}>
        Cargando datos de Kommuner…
      </div>
    )
  }

  if (!data) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Stats box */}
      <AppStatsBox stats={data.appStats} year={year} />

      {/* Kommuner candidates table */}
      <div>
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1c1917', margin: 0 }}>
            Candidatos en Kommuner
          </h3>
          <span style={{ fontSize: 12, color: '#78716c' }}>{data.kommunerCandidates.length} candidatos</span>
        </div>
        <div style={{ border: '1px solid #e7e2d8', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
          <KommunerTable rows={data.kommunerCandidates} />
        </div>
      </div>

      {/* "Wanted Kommuner but in agency" section */}
      <WantedKommunerSection rows={data.wantedKommunerInAgency} year={year} />

    </div>
  )
}
