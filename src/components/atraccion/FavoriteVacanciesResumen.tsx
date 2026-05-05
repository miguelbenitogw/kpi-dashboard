'use client'

import { useEffect, useState } from 'react'
import {
  getVacancyRecruitmentStats,
  getVacantesPrincipales,
  type VacancyStatusRow,
} from '@/lib/queries/atraccion'
import { getVacancyCountry, COUNTRY_COLORS } from '@/lib/utils/vacancy-country'

// ─── Design tokens ────────────────────────────────────────────────────────────
const P = {
  bg: '#f9f7f4',
  card: '#ffffff',
  border: '#e7e2d8',
  text: '#1c1917',
  muted: '#78716c',
  accent: '#1e4b9e',
  skeleton: '#e7e2d8',
}

// ─── Status chip styles ───────────────────────────────────────────────────────
function statusChipStyle(status: string): { color: string; background: string } {
  const s = status.toLowerCase()
  if (s.includes('hired')) return { color: '#16a34a', background: '#dcfce7' }
  if (s.includes('approved by client')) return { color: '#1d4ed8', background: '#dbeafe' }
  if (s.includes('interview in progress')) return { color: '#7c3aed', background: '#ede9fe' }
  if (s.includes('interview-scheduled') || s.includes('interview scheduled')) return { color: '#7c3aed', background: '#ede9fe' }
  if (s.includes('first call') || s.includes('second call')) return { color: '#d97706', background: '#fef3c7' }
  return { color: '#78716c', background: '#f3f4f6' }
}

// Statuses to show as chips, in priority order
const KEY_STATUSES = [
  'Hired',
  'Approved by client',
  'Interview in Progress',
  'Interview-Scheduled',
  'First Call',
]

// ─── Skeleton ────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div
      style={{
        background: P.card,
        border: `1px solid ${P.border}`,
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div
          style={{
            height: 14,
            width: '60%',
            borderRadius: 6,
            background: P.skeleton,
            animation: 'fvr-pulse 1.5s ease-in-out infinite',
          }}
        />
        <div
          style={{
            height: 20,
            width: 56,
            borderRadius: 99,
            background: P.skeleton,
            animation: 'fvr-pulse 1.5s ease-in-out infinite',
          }}
        />
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 99,
          background: P.skeleton,
          animation: 'fvr-pulse 1.5s ease-in-out infinite',
        }}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        {[80, 100, 90].map((w, i) => (
          <div
            key={i}
            style={{
              height: 22,
              width: w,
              borderRadius: 99,
              background: P.skeleton,
              animation: 'fvr-pulse 1.5s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Vacancy card ─────────────────────────────────────────────────────────────
function VacancyCard({ row }: { row: VacancyStatusRow }) {
  const country = getVacancyCountry(row.title)
  const countryColors = COUNTRY_COLORS[country]

  const hired = row.byStatus['Hired'] ?? 0
  const approved = row.byStatus['Approved by client'] ?? 0
  const total = row.total > 0 ? row.total : 1
  const progressPct = Math.min(100, Math.round(((hired + approved) / total) * 100))

  return (
    <div
      style={{
        background: P.card,
        border: `1px solid ${P.border}`,
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Header: title + country badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: P.text,
            lineHeight: 1.35,
            flex: 1,
            minWidth: 0,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
          title={row.title}
        >
          {row.title}
        </div>
        <span
          style={{
            flexShrink: 0,
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 99,
            background: countryColors.bg,
            color: countryColors.text,
            border: `1px solid ${countryColors.border}`,
            whiteSpace: 'nowrap',
          }}
        >
          {country}
        </span>
      </div>

      {/* Total de candidatos */}
      <div style={{ fontSize: 12, color: P.muted }}>
        <span style={{ fontWeight: 700, color: P.text, fontSize: 13 }}>{row.total}</span>
        {' '}candidatos totales
      </div>

      {/* Status chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {KEY_STATUSES.map((status) => {
          const count = row.byStatus[status] ?? 0
          if (count === 0) return null
          const chipStyle = statusChipStyle(status)
          return (
            <span
              key={status}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 99,
                background: chipStyle.background,
                color: chipStyle.color,
                whiteSpace: 'nowrap',
              }}
              title={status}
            >
              {status}: {count}
            </span>
          )
        })}
      </div>

      {/* Progress bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: P.muted, fontWeight: 500 }}>
            Hired + Approved
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: P.accent }}>
            {progressPct}%
          </span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 99,
            background: P.border,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              borderRadius: 99,
              background: progressPct >= 30 ? '#16a34a' : progressPct >= 15 ? '#1e4b9e' : '#e55a2b',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function FavoriteVacanciesResumen() {
  const [rows, setRows] = useState<VacancyStatusRow[]>([])
  const [loading, setLoading] = useState(true)
  const [noFavorites, setNoFavorites] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [stats, principales] = await Promise.all([
        getVacancyRecruitmentStats(),
        getVacantesPrincipales(),
      ])

      if (cancelled) return

      if (principales.length === 0) {
        setNoFavorites(true)
        setLoading(false)
        return
      }

      const principalesIds = new Set(principales.map((p) => p.id))
      const filtered = stats.rows.filter((r) => principalesIds.has(r.id))

      // Preserve order from getVacantesPrincipales (sorted by tipo_profesional)
      const orderedMap = new Map(filtered.map((r) => [r.id, r]))
      const ordered = principales
        .map((p) => orderedMap.get(p.id))
        .filter((r): r is VacancyStatusRow => r !== undefined)

      setRows(ordered)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [])

  return (
    <section>
      {/* Keyframe animation injected once */}
      <style>{`
        @keyframes fvr-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>

      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: 2,
            background: P.accent,
          }}
        />
        <span style={{ fontSize: 14, fontWeight: 700, color: P.accent }}>
          Vacantes favoritas
        </span>
        <span style={{ fontSize: 12, color: P.muted, marginLeft: 4 }}>
          Desglose por estado
        </span>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
          }}
        >
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Empty state */}
      {!loading && noFavorites && (
        <div
          style={{
            background: P.card,
            border: `1px solid ${P.border}`,
            borderRadius: 12,
            padding: '20px 24px',
            color: P.muted,
            fontSize: 13,
          }}
        >
          No hay vacantes favoritas configuradas. Podés marcarlas en Configuración.
        </div>
      )}

      {/* No active favorite vacancies found in recruitment stats */}
      {!loading && !noFavorites && rows.length === 0 && (
        <div
          style={{
            background: P.card,
            border: `1px solid ${P.border}`,
            borderRadius: 12,
            padding: '20px 24px',
            color: P.muted,
            fontSize: 13,
          }}
        >
          Las vacantes favoritas no están activas actualmente en el pipeline de atracción.
        </div>
      )}

      {/* Cards grid */}
      {!loading && rows.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
          }}
        >
          {rows.map((row) => (
            <VacancyCard key={row.id} row={row} />
          ))}
        </div>
      )}
    </section>
  )
}
