'use client'

import { useState, useMemo } from 'react'
import type { Candidate } from '@/lib/supabase/types'

type CandidateRow = Candidate & {
  alert_level: string | null
  days_stuck: number | null
}

interface CandidateTableProps {
  candidates: CandidateRow[]
}

type SortField = 'full_name' | 'current_status' | 'days_in_process' | 'alert_level' | 'owner'
type SortDir = 'asc' | 'desc'

const ALERT_COLORS: Record<string, string> = {
  green: 'bg-emerald-500/20 text-emerald-400',
  yellow: 'bg-yellow-500/20 text-yellow-400',
  red: 'bg-red-500/20 text-red-400',
  critical: 'bg-red-600/30 text-red-300',
}

const ALERT_ORDER: Record<string, number> = {
  critical: 0,
  red: 1,
  yellow: 2,
  green: 3,
}

function alertSortValue(level: string | null): number {
  if (!level) return 99
  return ALERT_ORDER[level.toLowerCase()] ?? 50
}

export default function CandidateTable({ candidates }: CandidateTableProps) {
  const [sortField, setSortField] = useState<SortField>('alert_level')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    return [...candidates].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1

      if (sortField === 'alert_level') {
        return (alertSortValue(a.alert_level) - alertSortValue(b.alert_level)) * dir
      }
      if (sortField === 'days_in_process') {
        return ((a.days_in_process ?? 0) - (b.days_in_process ?? 0)) * dir
      }

      const aVal = (a[sortField] ?? '').toLowerCase()
      const bVal = (b[sortField] ?? '').toLowerCase()
      return aVal.localeCompare(bVal) * dir
    })
  }, [candidates, sortField, sortDir])

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="ml-1 inline h-3 w-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }
    return (
      <svg className="ml-1 inline h-3 w-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={sortDir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
        />
      </svg>
    )
  }

  if (candidates.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-gray-500">
        No candidates found for this vacancy
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-700/50 text-xs uppercase tracking-wider text-gray-400">
            {([
              ['full_name', 'Name'],
              ['current_status', 'Status'],
              ['days_in_process', 'Days in Stage'],
              ['alert_level', 'SLA Alert'],
              ['owner', 'Owner'],
            ] as [SortField, string][]).map(([field, label]) => (
              <th key={field} className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort(field)}
                  className="inline-flex items-center transition hover:text-gray-200"
                >
                  {label}
                  <SortIcon field={field} />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {sorted.map((c) => {
            const alertClass =
              ALERT_COLORS[c.alert_level?.toLowerCase() ?? ''] ??
              'bg-gray-700/30 text-gray-500'

            return (
              <tr
                key={c.id}
                className="transition hover:bg-gray-700/20"
              >
                <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-100">
                  {c.full_name ?? '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-300">
                  {c.current_status ?? '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-300">
                  {c.days_in_process != null ? `${c.days_in_process}d` : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${alertClass}`}
                  >
                    {c.alert_level ?? 'OK'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-400">
                  {c.owner ?? '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
