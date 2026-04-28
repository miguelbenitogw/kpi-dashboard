'use client'

import { useEffect, useState } from 'react'
import { Users, Briefcase, UserCheck, AlertTriangle } from 'lucide-react'
import KpiCard from './KpiCard'
import { getDashboardStats, type DashboardStats } from '@/lib/queries/dashboard'

export default function KpiCards() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const data = await getDashboardStats()
      setStats(data)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[120px] animate-pulse rounded-xl border border-gray-700/50 bg-gray-800/50"
          />
        ))}
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4 text-center">
        <p className="text-sm text-gray-400">Sin datos disponibles</p>
        <p className="text-xs text-gray-500">Esperando sincronizacion</p>
      </div>
    )
  }

  const alertStatus: 'good' | 'warning' | 'danger' =
    stats.activeSlaAlerts === 0
      ? 'good'
      : stats.activeSlaAlerts <= 5
        ? 'warning'
        : 'danger'

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        title="Candidatos Activos"
        value={stats.activeCandidates.toLocaleString('es-AR')}
        icon={Users}
        status="good"
      />
      <KpiCard
        title="Vacantes Activas"
        value={stats.activeJobOpenings.toLocaleString('es-AR')}
        icon={Briefcase}
        status="good"
      />
      <KpiCard
        title="Contratados (mes)"
        value={stats.hiredThisMonth.toLocaleString('es-AR')}
        trend={stats.conversionRate}
        trendLabel="tasa de conversion"
        icon={UserCheck}
        status="good"
      />
      <KpiCard
        title="Alertas SLA"
        value={stats.activeSlaAlerts.toLocaleString('es-AR')}
        icon={AlertTriangle}
        status={alertStatus}
      />
    </div>
  )
}
