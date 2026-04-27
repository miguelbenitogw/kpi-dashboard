'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Minus, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import { getReceivedCvsByVacancyStats } from '@/lib/queries/atraccion'

type WeeklyPoint = {
  weekLabel: string
  count: number
}

type VacancyRanking = {
  vacancyId: string
  vacancyTitle: string
  newThisWeek: number
  previousWeek: number
}

type VacancyWeeklySeries = {
  vacancyId: string
  vacancyTitle: string
  points: WeeklyPoint[]
}

type ReceivedCvsByVacancyStats = {
  ranking: VacancyRanking[]
  weeklySeries: VacancyWeeklySeries[]
  generatedAt?: string | null
}

function deltaPill(current: number, previous: number) {
  const delta = current - previous

  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
        <TrendingUp className="h-3 w-3" /> +{delta}
      </span>
    )
  }

  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-300">
        <TrendingDown className="h-3 w-3" /> {delta}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gray-600/50 bg-gray-700/40 px-2 py-0.5 text-[10px] font-semibold text-gray-300">
      <Minus className="h-3 w-3" /> 0
    </span>
  )
}

function MiniSeries({ points }: { points: WeeklyPoint[] }) {
  const safePoints = points.slice(-8)
  const max = Math.max(...safePoints.map((p) => p.count), 1)

  return (
    <div className="flex items-end gap-1.5">
      {safePoints.map((point) => {
        const height = Math.max(6, Math.round((point.count / max) * 32))
        return (
          <div key={point.weekLabel} className="group flex flex-col items-center gap-1">
            <span className="opacity-0 transition-opacity group-hover:opacity-100 text-[9px] text-gray-500">
              {point.weekLabel}
            </span>
            <div
              className="w-2.5 rounded-sm bg-brand-500/70 transition-colors group-hover:bg-accent-500"
              style={{ height }}
              title={`${point.weekLabel}: ${point.count}`}
            />
          </div>
        )
      })}
    </div>
  )
}

function formatDateTime(iso?: string | null) {
  if (!iso) return 'Sin timestamp de sync'
  return `Actualizado: ${new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

export default function ReceivedCvsByVacancyView() {
  const [data, setData] = useState<ReceivedCvsByVacancyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const result = (await getReceivedCvsByVacancyStats()) as ReceivedCvsByVacancyStats
      if (!cancelled) {
        setData(result)
        setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  async function refreshStats() {
    const result = (await getReceivedCvsByVacancyStats()) as ReceivedCvsByVacancyStats
    setData(result)
    setLoading(false)
  }

  async function handleSyncNow() {
    if (syncing) return

    setSyncing(true)
    setSyncMessage(null)

    try {
      const response = await fetch('/api/admin/sync-vacancy-cvs', {
        method: 'POST',
      })

      let payload: Record<string, unknown> | null = null
      try {
        payload = (await response.json()) as Record<string, unknown>
      } catch {
        payload = null
      }

      if (!response.ok) {
        const errorMessage =
          (payload?.error as string | undefined) ??
          `No se pudo actualizar (HTTP ${response.status})`
        setSyncMessage(errorMessage)
        return
      }

      const rowsUpserted = Number(payload?.rows_upserted ?? 0)
      setSyncMessage(`Actualización completada. Filas sincronizadas: ${rowsUpserted}.`)
      await refreshStats()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al sincronizar.'
      setSyncMessage(message)
    } finally {
      setSyncing(false)
    }
  }

  const summary = useMemo(() => {
    if (!data) return { current: 0, previous: 0 }
    return data.ranking.reduce(
      (acc, row) => ({
        current: acc.current + row.newThisWeek,
        previous: acc.previous + row.previousWeek,
      }),
      { current: 0, previous: 0 },
    )
  }, [data])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 h-56 animate-pulse rounded-xl border border-surface-700/60 bg-surface-850/60" />
          <div className="h-56 animate-pulse rounded-xl border border-surface-700/60 bg-surface-850/60" />
        </div>
        <div className="h-72 animate-pulse rounded-xl border border-surface-700/60 bg-surface-850/60" />
      </div>
    )
  }

  if (!data || data.ranking.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-700/40 bg-gray-800/30 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-200">Sincronización manual de CVs</p>
            <p className="text-xs text-gray-500">Actualizá Zoho ahora y refrescá esta vista al instante.</p>
          </div>
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-500/40 bg-brand-500/15 px-3 py-2 text-xs font-semibold text-brand-200 transition hover:bg-brand-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {syncing ? 'Actualizando...' : 'Actualizar info'}
          </button>
        </div>

        {syncMessage ? (
          <div className="rounded-lg border border-gray-700/40 bg-gray-800/40 px-4 py-2.5 text-xs text-gray-300">{syncMessage}</div>
        ) : null}

        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-8 text-center">
          <p className="text-sm text-gray-300">Todavía no hay CVs recibidos para mostrar.</p>
          <p className="mt-1 text-xs text-gray-500">Cuando haya actividad semanal, vas a ver el ranking por vacante acá.</p>
        </div>
      </div>
    )
  }

  const ranking = data.ranking.slice(0, 12)
  const seriesByVacancy = new Map(data.weeklySeries.map((serie) => [serie.vacancyId, serie]))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-700/40 bg-gray-800/30 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-200">Sincronización manual de CVs</p>
          <p className="text-xs text-gray-500">Actualizá Zoho ahora y refrescá esta vista al instante.</p>
        </div>
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-lg border border-brand-500/40 bg-brand-500/15 px-3 py-2 text-xs font-semibold text-brand-200 transition hover:bg-brand-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {syncing ? 'Actualizando...' : 'Actualizar info'}
        </button>
      </div>

      {syncMessage ? (
        <div className="rounded-lg border border-gray-700/40 bg-gray-800/40 px-4 py-2.5 text-xs text-gray-300">{syncMessage}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-gray-700/50 bg-gray-800/50">
          <div className="flex items-center justify-between border-b border-gray-700/50 px-5 py-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-200">Ranking de nuevos esta semana</h3>
              <p className="mt-0.5 text-xs text-gray-500">Top vacantes activas por ingreso semanal de CVs</p>
            </div>
            <span className="text-[10px] text-gray-500">{formatDateTime(data.generatedAt)}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700/30">
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">#</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">Vacante</th>
                  <th className="px-3 py-2.5 text-right font-medium text-gray-500">Nuevos</th>
                  <th className="px-3 py-2.5 text-right font-medium text-gray-500">Semana anterior</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-500">Variación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/20">
                {ranking.map((row, index) => (
                  <tr key={row.vacancyId} className="hover:bg-gray-700/20 transition-colors">
                    <td className="px-4 py-2.5 text-gray-500 tabular-nums">{index + 1}</td>
                    <td className="px-4 py-2.5 text-gray-200 font-medium">{row.vacancyTitle}</td>
                    <td className="px-3 py-2.5 text-right text-gray-100 tabular-nums">{row.newThisWeek}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400 tabular-nums">{row.previousWeek}</td>
                    <td className="px-4 py-2.5 text-right">{deltaPill(row.newThisWeek, row.previousWeek)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
          <h3 className="text-sm font-semibold text-gray-200">Resumen semanal</h3>
          <p className="mt-1 text-xs text-gray-500">Comparativa total vs semana anterior</p>

          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-gray-700/50 bg-gray-700/20 p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Esta semana</p>
              <p className="mt-1 text-2xl font-bold text-gray-100 tabular-nums">{summary.current}</p>
            </div>
            <div className="rounded-lg border border-gray-700/50 bg-gray-700/20 p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Semana anterior</p>
              <p className="mt-1 text-2xl font-bold text-gray-300 tabular-nums">{summary.previous}</p>
            </div>
            <div>{deltaPill(summary.current, summary.previous)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50">
        <div className="border-b border-gray-700/50 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-200">Histórico semanal por vacante</h3>
          <p className="mt-0.5 text-xs text-gray-500">Mini-series (últimas 8 semanas)</p>
        </div>

        {data.weeklySeries.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-xs text-gray-500">Sin histórico semanal para las vacantes actuales.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700/20">
            {ranking.map((row) => {
              const serie = seriesByVacancy.get(row.vacancyId)
              return (
                <div key={`${row.vacancyId}-history`} className="flex flex-col gap-3 px-5 py-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-200">{row.vacancyTitle}</p>
                    <p className="text-[11px] text-gray-500">Nuevos esta semana: {row.newThisWeek}</p>
                  </div>

                  <div className="min-h-10">
                    {serie && serie.points.length > 0 ? (
                      <MiniSeries points={serie.points} />
                    ) : (
                      <p className="text-[11px] text-gray-500">Sin muestras históricas</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}