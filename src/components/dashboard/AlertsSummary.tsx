'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Clock } from 'lucide-react'
import { getActiveSlaAlerts, getAlertCountsByLevel } from '@/lib/queries/dashboard'
import type { SlaAlert } from '@/lib/supabase/types'

export default function AlertsSummary() {
  const [alerts, setAlerts] = useState<SlaAlert[]>([])
  const [counts, setCounts] = useState({ red: 0, yellow: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [alertsData, countsData] = await Promise.all([
        getActiveSlaAlerts(5),
        getAlertCountsByLevel(),
      ])
      setAlerts(alertsData)
      setCounts(countsData)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6 animate-pulse">
        <div className="h-5 w-40 rounded bg-gray-700/50" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-gray-700/30" />
          ))}
        </div>
      </div>
    )
  }

  const total = counts.red + counts.yellow
  const hasAlerts = total > 0

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">Alertas SLA Activas</h3>
        <div className="flex items-center gap-3">
          {counts.red > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              {counts.red} criticas
            </span>
          )}
          {counts.yellow > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {counts.yellow} atencion
            </span>
          )}
        </div>
      </div>

      {!hasAlerts ? (
        <div className="mt-6 flex flex-col items-center justify-center py-6 text-center">
          <div className="rounded-full bg-emerald-500/10 p-3">
            <AlertTriangle className="h-6 w-6 text-emerald-400" />
          </div>
          <p className="mt-3 text-sm text-gray-400">Sin alertas activas</p>
          <p className="text-xs text-gray-500">Todos los SLA dentro de rango</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center gap-3 rounded-lg bg-gray-900/50 px-3 py-2.5"
            >
              <div
                className={`h-2 w-2 shrink-0 rounded-full ${
                  alert.alert_level === 'red' ? 'bg-red-400' : 'bg-amber-400'
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 truncate">
                  {alert.candidate_name ?? 'Sin nombre'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {alert.job_opening_title ?? 'Sin vacante'} &middot;{' '}
                  {alert.current_status ?? '—'}
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                <Clock className="h-3 w-3" />
                <span className="font-medium tabular-nums">
                  {alert.days_stuck ?? 0}d
                </span>
              </div>
            </div>
          ))}

          {total > 5 && (
            <p className="pt-1 text-center text-xs text-gray-500">
              +{total - 5} alertas mas
            </p>
          )}
        </div>
      )}
    </div>
  )
}
