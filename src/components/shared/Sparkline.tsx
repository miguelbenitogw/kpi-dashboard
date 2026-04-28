'use client'

interface SparklineProps {
  series: number[]
  color: string
  h?: number
}

export default function Sparkline({ series, color, h = 28 }: SparklineProps) {
  const w = 200
  if (!series || series.length < 2) return <div style={{ height: h }} />

  const max = Math.max(...series)
  const min = Math.min(...series)
  const r = max - min || 1

  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * w
    const y = h - ((v - min) / r) * h * 0.7 - h * 0.15
    return [x, y]
  })

  const path = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(' ')

  const last = pts[pts.length - 1]

  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />
    </svg>
  )
}
