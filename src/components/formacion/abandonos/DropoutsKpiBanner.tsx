'use client'

import type { DropoutRow } from '@/lib/queries/dropouts'

interface Props { rows: DropoutRow[] }

export default function DropoutsKpiBanner({ rows }: Props) {
  const total = rows.length

  const daysValues = rows
    .map((r) => r.dropout_days_of_training)
    .filter((v): v is number => v !== null && v > 0 && v < 1000)
  const avgDays = daysValues.length > 0
    ? Math.round(daysValues.reduce((a, b) => a + b, 0) / daysValues.length)
    : null

  const interestYes = rows.filter((r) => r.dropout_interest_future === 'Yes').length
  const interestPct = total > 0 ? Math.round((interestYes / total) * 100) : 0

  const tagCounts = new Map<string, number>()
  for (const r of rows) {
    for (const t of r.tags) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
    }
  }
  const topTag = Array.from(tagCounts.entries()).sort(([, a], [, b]) => b - a)[0]?.[0] ?? '—'

  const cards = [
    { label: 'Total bajas', value: total.toLocaleString('es-AR'), color: 'text-red-400' },
    { label: 'Media días entrenados', value: avgDays !== null ? avgDays.toLocaleString('es-AR') : '—', color: 'text-blue-400' },
    { label: 'Con interés futuro', value: `${interestPct}%`, color: 'text-emerald-400' },
    { label: 'Canal dominante', value: topTag, color: 'text-purple-400' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border border-gray-700/50 bg-gray-700/20 p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">{c.label}</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums truncate ${c.color}`}>{c.value}</p>
        </div>
      ))}
    </div>
  )
}
