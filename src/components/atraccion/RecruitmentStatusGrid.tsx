'use client'

import { useEffect, useState } from 'react'
import {
  getRecruitmentStatusCounts,
  type StatusCount,
} from '@/lib/queries/atraccion'

const STATUS_DISPLAY_ORDER = [
  'Associated',
  'First Call',
  'Second Call',
  'No Answer',
  'Check Interest',
  'Interview in Progress',
  'Approved by client',
  'Hired',
  'On Hold',
  'Rejected',
  'Not Valid',
  'Withdrawn',
]

type Status = 'good' | 'warning' | 'danger' | 'neutral'

const statusColorMap: Record<string, Status> = {
  Associated: 'neutral',
  'First Call': 'neutral',
  'Second Call': 'neutral',
  'No Answer': 'neutral',
  'Check Interest': 'good',
  'Interview in Progress': 'good',
  'Approved by client': 'good',
  Hired: 'good',
  'On Hold': 'warning',
  Rejected: 'danger',
  'Not Valid': 'danger',
  Withdrawn: 'danger',
}

const statusBorder: Record<Status, string> = {
  good: 'border-l-emerald-500',
  warning: 'border-l-amber-500',
  danger: 'border-l-red-500',
  neutral: 'border-l-gray-500',
}

const statusText: Record<Status, string> = {
  good: 'text-emerald-400',
  warning: 'text-amber-400',
  danger: 'text-red-400',
  neutral: 'text-gray-400',
}

export default function RecruitmentStatusGrid() {
  const [data, setData] = useState<StatusCount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const counts = await getRecruitmentStatusCounts()
      setData(counts)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-[80px] animate-pulse rounded-xl border border-gray-700/50 bg-gray-800/50"
          />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6 text-center">
        <p className="text-sm text-gray-400">Sin datos de reclutamiento disponibles</p>
      </div>
    )
  }

  const total = data.reduce((sum, d) => sum + d.count, 0)

  // Sort by display order, then append any statuses not in the order list
  const sorted = [...data].sort((a, b) => {
    const ai = STATUS_DISPLAY_ORDER.indexOf(a.status)
    const bi = STATUS_DISPLAY_ORDER.indexOf(b.status)
    const aIdx = ai === -1 ? STATUS_DISPLAY_ORDER.length : ai
    const bIdx = bi === -1 ? STATUS_DISPLAY_ORDER.length : bi
    return aIdx - bIdx
  })

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-gray-100">
        Candidatos por Estado
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {sorted.map((item) => {
          const colorKey = statusColorMap[item.status] ?? 'neutral'
          const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0.0'

          return (
            <div
              key={item.status}
              className={`
                rounded-xl border border-gray-700/50 bg-gray-800/50 p-4
                border-l-4 ${statusBorder[colorKey]}
                transition-colors hover:bg-gray-800/70
              `}
            >
              <p className="truncate text-xs font-medium text-gray-400">
                {item.status}
              </p>
              <p className="mt-1 text-2xl font-bold text-gray-50 tabular-nums">
                {item.count.toLocaleString('es-AR')}
              </p>
              <p className={`mt-0.5 text-xs ${statusText[colorKey]}`}>
                {pct}% del total
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
