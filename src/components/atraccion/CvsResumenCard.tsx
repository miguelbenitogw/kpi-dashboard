'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getReceivedCvsByVacancyStats } from '@/lib/queries/atraccion'

type CvsStats = {
  totalEssaSemana: number
  vacantesConCvs: number
  vacantesActivas: number
}

export default function CvsResumenCard() {
  const [stats, setStats] = useState<CvsStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const data = await getReceivedCvsByVacancyStats(4)
      if (cancelled) return

      const totalEssaSemana = data.ranking.reduce((sum, r) => sum + r.newThisWeek, 0)
      const vacantesConCvs = data.ranking.filter((r) => r.newThisWeek > 0).length
      const vacantesActivas = data.ranking.length

      setStats({ totalEssaSemana, vacantesConCvs, vacantesActivas })
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e7e2d8',
        borderRadius: 14,
        padding: 18,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#78716c',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          CVs recibidos esta semana
        </span>
        <Link
          href="/dashboard/atraccion/cvs-recibidos"
          style={{
            fontSize: 12,
            color: '#1e4b9e',
            textDecoration: 'none',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          Ver detalle →
        </Link>
      </div>

      {/* Stats */}
      {loading ? (
        <div style={{ display: 'flex', gap: 32 }}>
          {[90, 80, 100].map((w, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  width: w,
                  height: 40,
                  borderRadius: 6,
                  background: '#f5f1ea',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
              <div style={{ width: 70, height: 14, borderRadius: 4, background: '#f5f1ea' }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
          <StatBig
            value={stats?.totalEssaSemana ?? 0}
            label="Total CVs"
          />
          <StatBig
            value={stats?.vacantesConCvs ?? 0}
            label="Vacantes con CVs"
          />
          <StatBig
            value={stats?.vacantesActivas ?? 0}
            label="Vacantes activas"
          />
        </div>
      )}
    </div>
  )
}

function StatBig({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span
        style={{
          fontSize: 36,
          fontWeight: 700,
          color: '#1c1917',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value.toLocaleString('es-AR')}
      </span>
      <span style={{ fontSize: 12, color: '#78716c', marginTop: 4 }}>{label}</span>
    </div>
  )
}
