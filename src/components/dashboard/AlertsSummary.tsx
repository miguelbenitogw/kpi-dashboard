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
      <div
        className="rounded-xl p-4 animate-pulse"
        style={{
          border: '1px solid #e7e2d8',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(28,25,23,0.06), 0 1px 2px rgba(28,25,23,0.04)',
        }}
      >
        <div className="h-5 w-40 rounded" style={{ background: '#e7e2d8' }} />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 rounded" style={{ background: '#f0ece4' }} />
          ))}
        </div>
      </div>
    )
  }

  const total = counts.red + counts.yellow
  const hasAlerts = total > 0

  return (
    <div
      className="rounded-xl p-4"
      style={{
        border: '1px solid #e7e2d8',
        background: '#ffffff',
        boxShadow: '0 1px 3px rgba(28,25,23,0.06), 0 1px 2px rgba(28,25,23,0.04)',
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: '#1c1917' }}>Alertas SLA Activas</h3>
        <div className="flex items-center gap-3">
          {counts.red > 0 && (
            <span
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ background: '#fee2e2', color: '#991b1b' }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#dc2626' }} />
              {counts.red} criticas
            </span>
          )}
          {counts.yellow > 0 && (
            <span
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ background: '#fef3c7', color: '#854d0e' }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#ca8a04' }} />
              {counts.yellow} atencion
            </span>
          )}
        </div>
      </div>

      {!hasAlerts ? (
        <div className="mt-4 flex flex-col items-center justify-center py-4 text-center">
          <div className="rounded-full p-3" style={{ background: '#dcfce7' }}>
            <AlertTriangle className="h-6 w-6" style={{ color: '#16a34a' }} />
          </div>
          <p className="mt-3 text-sm" style={{ color: '#57534e' }}>Sin alertas activas</p>
          <p className="text-xs" style={{ color: '#78716c' }}>Todos los SLA dentro de rango</p>
        </div>
      ) : (
        <div className="mt-3 space-y-1.5">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5"
              style={{ background: '#f7f4ef' }}
            >
              <div
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  background: alert.alert_level === 'red' ? '#dc2626' : '#ca8a04',
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: '#1c1917' }}>
                  {alert.candidate_name ?? 'Sin nombre'}
                </p>
                <p className="text-xs truncate" style={{ color: '#78716c' }}>
                  {alert.job_opening_title ?? 'Sin vacante'} &middot;{' '}
                  {alert.current_status ?? '—'}
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs shrink-0" style={{ color: '#57534e' }}>
                <Clock className="h-3 w-3" />
                <span className="font-medium tabular-nums">
                  {alert.days_stuck ?? 0}d
                </span>
              </div>
            </div>
          ))}

          {total > 5 && (
            <p className="pt-1 text-center text-xs" style={{ color: '#78716c' }}>
              +{total - 5} alertas mas
            </p>
          )}
        </div>
      )}
    </div>
  )
}
