'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Colors per placement_status
// ---------------------------------------------------------------------------
const STATUS_COLORS: Record<string, string> = {
  'Hired by agency':              '#16a34a',
  'Hired by Kommuner Fast':       '#15803d',
  'Hired by Kommuner temporary':  '#4ade80',
  'Out/on boarding job':          '#0891b2',
  'Interview in process':         '#2563eb',
  'Presented to an Agency':       '#7c3aed',
  'Registration ready':           '#0d9488',
  'Working on it':                '#d97706',
  'Creating profile':             '#f59e0b',
  'Not ready to present':         '#94a3b8',
  'Resign':                       '#dc2626',
}
const DEFAULT_COLOR = '#cbd5e1'

// Statuses excluded from GP active pool (same as GP_EXCLUDED in colocacion.ts)
const GP_EXCLUDED = new Set(['Offer Withdrawn', 'Offer Declined', 'Expelled', 'No Show'])

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SliceData {
  name:  string
  value: number
  color: string
}

interface PendingData {
  norwaySlices:  SliceData[]
  germanyToPlace: number
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------
async function fetchData(): Promise<PendingData> {
  const [norwayRes, germanyRes] = await Promise.all([
    (supabase as any)
      .from('candidates_kpi')
      .select('placement_status, gp_training_status')
      .not('gp_training_status', 'is', null),
    (supabase as any)
      .from('germany_candidates_kpi')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'To Place'),
  ])

  // Filter out excluded statuses, count by placement_status
  const rows: { placement_status: string | null; gp_training_status: string }[] =
    (norwayRes.data ?? []).filter(
      (r: { gp_training_status: string }) => !GP_EXCLUDED.has(r.gp_training_status),
    )

  const countMap = new Map<string, number>()
  for (const r of rows) {
    const key = r.placement_status ?? 'Sin estado'
    countMap.set(key, (countMap.get(key) ?? 0) + 1)
  }

  const norwaySlices: SliceData[] = Array.from(countMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name,
      value,
      color: STATUS_COLORS[name] ?? DEFAULT_COLOR,
    }))

  return {
    norwaySlices,
    germanyToPlace: germanyRes.count ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const { name, value, color } = payload[0].payload
  const total = payload[0]?.payload?.total ?? 1
  const pct   = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div style={{
      background: '#fff', border: '1px solid #e7e2d8',
      borderRadius: 8, padding: '7px 11px',
      fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, color: '#1c1917' }}>{name}</span>
      </div>
      <div style={{ color: '#78716c', marginTop: 2 }}>{value} personas · {pct}%</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Norway card with donut + legend
// ---------------------------------------------------------------------------
function NorwayCard({ slices }: { slices: SliceData[] }) {
  const total = slices.reduce((s, d) => s + d.value, 0)
  // Attach total to each slice for tooltip
  const enriched = slices.map((s) => ({ ...s, total }))

  return (
    <div style={{
      background: '#eff6ff', border: '1px solid #bfdbfe',
      borderRadius: 12, padding: '14px 16px',
      flex: 1, minWidth: 280,
    }}>
      {/* Header */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#1e4b9e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
        Noruega · Placement Status
        <span style={{ fontWeight: 400, color: '#64748b', marginLeft: 6 }}>({total} activos)</span>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {/* Donut */}
        <div style={{ width: 140, height: 140, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={enriched}
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={62}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {enriched.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', maxHeight: 148 }}>
          {enriched.map((entry) => {
            const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0
            return (
              <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: entry.color, flexShrink: 0 }} />
                <span style={{ flex: 1, color: '#374151', lineHeight: 1.3 }}>{entry.name}</span>
                <span style={{ fontWeight: 700, color: '#1c1917', flexShrink: 0 }}>{entry.value}</span>
                <span style={{ color: '#94a3b8', flexShrink: 0, minWidth: 28, textAlign: 'right' }}>{pct}%</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Germany card (número simple)
// ---------------------------------------------------------------------------
function GermanyCard({ toPlace }: { toPlace: number }) {
  return (
    <div style={{
      background: '#fffbeb', border: '1px solid #fde68a',
      borderRadius: 12, padding: '14px 16px',
      minWidth: 180, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Alemania · To Place
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 44, fontWeight: 800, color: '#b45309', lineHeight: 1 }}>{toPlace}</span>
        <span style={{ fontSize: 12, color: '#92400e' }}>personas</span>
      </div>
      <div style={{ fontSize: 11, color: '#a16207' }}>
        Con estado «To Place» en Germany Candidates
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PlacementPendingCards
// ---------------------------------------------------------------------------
export default function PlacementPendingCards() {
  const [data, setData]       = useState<PendingData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData().then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', gap: 12 }}>
        {[0, 1].map((i) => (
          <div key={i} style={{
            flex: i === 0 ? 3 : 1, height: 168, borderRadius: 12,
            border: '1px solid #e7e2d8', background: '#f8f7f4',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Loader2 size={16} color="#a8a29e" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ))}
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <NorwayCard slices={data?.norwaySlices ?? []} />
      <GermanyCard toPlace={data?.germanyToPlace ?? 0} />
    </div>
  )
}
