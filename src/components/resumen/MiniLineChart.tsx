'use client'

import {
  AreaChart, Area, Tooltip, ResponsiveContainer,
} from 'recharts'

interface Point { week: string; count: number }

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#fff', border: '1px solid #e7e2d8', borderRadius: 6,
      padding: '5px 9px', fontSize: 11, boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
    }}>
      <div style={{ color: '#78716c', marginBottom: 1 }}>{label}</div>
      <div style={{ fontWeight: 700, color: '#1e4b9e' }}>{payload[0].value} CVs</div>
    </div>
  )
}

export default function MiniLineChart({ points }: { points: Point[] }) {
  const hasData = points.some((p) => p.count > 0)
  if (!hasData) return (
    <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 10, color: '#cbd5e1' }}>Sin datos</span>
    </div>
  )

  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={points} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
        <defs>
          <linearGradient id="miniGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#1e4b9e" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#1e4b9e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#1e4b9e', strokeWidth: 1, strokeDasharray: '3 3' }} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#1e4b9e"
          strokeWidth={1.5}
          fill="url(#miniGrad)"
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0, fill: '#1e4b9e' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
