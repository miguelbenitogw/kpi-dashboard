'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { getReceivedCvsByVacancyStats, type VacancyWeeklySeries } from '@/lib/queries/atraccion'

const LINE_COLORS = [
  '#1e4b9e', '#0891b2', '#16a34a', '#d97706', '#7c3aed',
  '#dc2626', '#0d9488', '#be185d',
]

function truncate(text: string, max: number) {
  return text.length <= max ? text : text.slice(0, max - 1) + '…'
}

function formatSyncedAt(iso: string | null) {
  if (!iso) return 'Sin datos'
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

// Build unified table: rows = weeks, cols = vacancies
function buildChartData(series: VacancyWeeklySeries[], weekCount: number) {
  // Collect all week labels (last N, sorted asc)
  const weekSet = new Map<string, string>() // weekStart → weekLabel
  for (const s of series) {
    for (const p of s.points) {
      weekSet.set(p.weekStart, p.weekLabel)
    }
  }
  const allWeeks = Array.from(weekSet.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-weekCount)

  return allWeeks.map(([weekStart, weekLabel]) => {
    const row: Record<string, string | number> = { weekLabel }
    for (const s of series) {
      const point = s.points.find((p) => p.weekStart === weekStart)
      row[s.vacancyId] = point?.count ?? 0
    }
    return row
  })
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: '16px 20px', height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', height: 180, borderRadius: 8, background: '#f5f1ea', animation: 'pulse 1.4s ease-in-out infinite' }} />
      <style>{`@keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}`}</style>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ padding: '32px 20px', textAlign: 'center', color: '#a8a29e', fontSize: 14 }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
      <div style={{ fontWeight: 600, color: '#78716c', marginBottom: 4 }}>Sin datos</div>
      <div>Ejecutá sync para cargar los CVs por vacante</div>
    </div>
  )
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const sorted = [...payload].sort((a, b) => b.value - a.value)
  return (
    <div style={{
      background: '#fff', border: '1px solid #e7e2d8', borderRadius: 8,
      padding: '8px 12px', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      maxWidth: 240,
    }}>
      <div style={{ fontWeight: 700, color: '#1c1917', marginBottom: 6 }}>{label}</div>
      {sorted.filter(p => p.value > 0).map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flexShrink: 0 }} />
          <span style={{ color: '#57534e', flex: 1, lineHeight: 1.3 }}>{p.name}</span>
          <span style={{ fontWeight: 700, color: '#1c1917' }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

const WEEKS = 6
const TOP_N  = 6

export default function CvsPerVacancyChart() {
  const [chartData, setChartData]   = useState<Record<string, string | number>[]>([])
  const [topSeries, setTopSeries]   = useState<VacancyWeeklySeries[]>([])
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [totalCvs, setTotalCvs]     = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const stats = await getReceivedCvsByVacancyStats(WEEKS)
        if (cancelled) return

        setGeneratedAt(stats.generatedAt)

        if (stats.weeklySeries.length === 0) {
          setLoading(false)
          return
        }

        // Pick top N vacancies by total CVs across all weeks
        const withTotals = stats.weeklySeries.map((s) => ({
          ...s,
          total: s.points.reduce((sum, p) => sum + p.count, 0),
        }))
        const top = withTotals.sort((a, b) => b.total - a.total).slice(0, TOP_N)

        const data = buildChartData(top, WEEKS)
        const grand = top.reduce((sum, s) => sum + s.total, 0)

        setTopSeries(top)
        setChartData(data)
        setTotalCvs(grand)
      } catch (err) {
        console.error('[CvsPerVacancyChart] load error:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px 10px', borderBottom: '1px solid #f5f1ea',
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1917', marginBottom: 2 }}>
            CVs por vacante activa
          </div>
          <div style={{ fontSize: 12, color: '#78716c' }}>Últimas {WEEKS} semanas</div>
        </div>
        {!loading && totalCvs > 0 && (
          <div style={{
            background: '#eaf0fb', color: '#1e4b9e',
            borderRadius: 8, fontSize: 13, fontWeight: 700, padding: '4px 12px',
          }}>
            {totalCvs} CVs
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '16px 8px 6px' }}>
        {loading ? (
          <LoadingSkeleton />
        ) : chartData.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4" vertical={false} />
              <XAxis
                dataKey="weekLabel"
                tick={{ fontSize: 11, fill: '#78716c' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#78716c' }}
                axisLine={false}
                tickLine={false}
                width={28}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => {
                  const s = topSeries.find((s) => s.vacancyId === value)
                  return (
                    <span style={{ fontSize: 11, color: '#57534e' }}>
                      {truncate(s?.vacancyTitle ?? value, 28)}
                    </span>
                  )
                }}
                iconType="circle"
                iconSize={7}
                wrapperStyle={{ paddingTop: 10, fontSize: 11 }}
              />
              {topSeries.map((s, i) => (
                <Line
                  key={s.vacancyId}
                  type="monotone"
                  dataKey={s.vacancyId}
                  name={s.vacancyId}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer */}
      {!loading && (
        <div style={{
          padding: '4px 16px 10px', fontSize: 11, color: '#a8a29e',
          borderTop: chartData.length > 0 ? '1px solid #f5f1ea' : 'none',
        }}>
          Actualizado: {formatSyncedAt(generatedAt)}
        </div>
      )}
    </div>
  )
}
