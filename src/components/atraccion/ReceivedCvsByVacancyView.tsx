'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Minus, RefreshCw } from 'lucide-react'
import { getReceivedCvsByVacancyStats } from '@/lib/queries/atraccion'

type WeeklyPoint = {
  weekLabel: string
  count: number
}

type VacancyRanking = {
  vacancyId: string
  vacancyTitle: string
  weeklyTarget: number | null
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

type TrafficLight = 'green' | 'yellow' | 'red' | 'none'

function formatDateTime(iso?: string | null) {
  if (!iso) return 'Sin timestamp de sync'
  return `Actualizado: ${new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

function getTrafficLight(target: number | null, value: number): TrafficLight {
  if (target === null || target <= 0) return 'none'
  if (value >= target) return 'green'
  if (value >= Math.ceil(target * 0.7)) return 'yellow'
  return 'red'
}

function TrafficPill({ status }: { status: TrafficLight }) {
  if (status === 'green') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" /> Verde
      </span>
    )
  }

  if (status === 'yellow') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
        <AlertTriangle className="h-3.5 w-3.5" /> Amarillo
      </span>
    )
  }

  if (status === 'red') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300">
        <AlertTriangle className="h-3.5 w-3.5" /> Rojo
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gray-600/50 bg-gray-700/40 px-3 py-1 text-xs font-semibold text-gray-300">
      <Minus className="h-3.5 w-3.5" /> Sin objetivo
    </span>
  )
}

export default function ReceivedCvsByVacancyView() {
  const [data, setData] = useState<ReceivedCvsByVacancyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [targetDrafts, setTargetDrafts] = useState<Record<string, string>>({})
  const [savingTargetId, setSavingTargetId] = useState<string | null>(null)

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

  useEffect(() => {
    if (!data) return
    const nextDrafts: Record<string, string> = {}
    for (const row of data.ranking) {
      nextDrafts[row.vacancyId] = row.weeklyTarget == null ? '' : String(row.weeklyTarget)
    }
    setTargetDrafts(nextDrafts)
  }, [data])

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
      const synced = Number(payload?.vacancies_synced ?? 0)
      const skipped = Number(payload?.vacancies_skipped_unchanged ?? 0)
      setSyncMessage(
        `Actualización completada. Vacantes sincronizadas: ${synced}. Sin cambios: ${skipped}. Filas actualizadas: ${rowsUpserted}.`,
      )
      await refreshStats()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al sincronizar.'
      setSyncMessage(message)
    } finally {
      setSyncing(false)
    }
  }

  async function saveWeeklyTarget(vacancyId: string) {
    if (savingTargetId) return

    const raw = (targetDrafts[vacancyId] ?? '').trim()
    const weeklyTarget = raw === '' ? null : Number(raw)
    if (weeklyTarget !== null && (!Number.isFinite(weeklyTarget) || weeklyTarget < 0)) {
      setSyncMessage('El objetivo debe ser un número mayor o igual a 0.')
      return
    }

    setSavingTargetId(vacancyId)
    setSyncMessage(null)

    try {
      const response = await fetch('/api/admin/vacancy-cv-target', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vacancyId, weeklyTarget }),
      })

      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null

      if (!response.ok) {
        const message = (payload?.error as string | undefined) ?? `No se pudo guardar (HTTP ${response.status})`
        setSyncMessage(message)
        return
      }

      setSyncMessage('Objetivo semanal guardado.')
      await refreshStats()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al guardar objetivo.'
      setSyncMessage(message)
    } finally {
      setSavingTargetId(null)
    }
  }

  const unifiedRows = useMemo(() => {
    if (!data) return []
    const seriesByVacancy = new Map(data.weeklySeries.map((serie) => [serie.vacancyId, serie]))
    return data.ranking.map((rankingRow) => ({
      ...rankingRow,
      points: seriesByVacancy.get(rankingRow.vacancyId)?.points ?? [],
    }))
  }, [data])

  const weekColumns = useMemo(() => {
    if (!data || data.weeklySeries.length === 0) return []
    const base = data.weeklySeries[0]?.points ?? []
    return [...base].reverse()
  }, [data])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-16 animate-pulse rounded-xl border border-surface-700/60 bg-surface-850/60" />
        <div className="h-96 animate-pulse rounded-xl border border-surface-700/60 bg-surface-850/60" />
      </div>
    )
  }

  if (!data || data.ranking.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-700/40 bg-gray-800/30 px-4 py-3">
          <div>
            <p className="text-base font-semibold text-gray-200">Sincronización manual de CVs</p>
            <p className="text-sm text-gray-500">Actualizá Zoho ahora y refrescá esta vista al instante.</p>
          </div>
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-500/40 bg-brand-500/15 px-4 py-2.5 text-sm font-semibold text-brand-200 transition hover:bg-brand-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? 'Actualizando...' : 'Actualizar info'}
          </button>
        </div>

        {syncMessage ? (
          <div className="rounded-lg border border-gray-700/40 bg-gray-800/40 px-4 py-2.5 text-sm text-gray-300">{syncMessage}</div>
        ) : null}

        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-8 text-center">
          <p className="text-base text-gray-300">Todavía no hay CVs recibidos para mostrar.</p>
          <p className="mt-1 text-sm text-gray-500">Cuando haya actividad semanal, vas a ver el ranking por vacante acá.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-700/40 bg-gray-800/30 px-4 py-3">
        <div>
          <p className="text-base font-semibold text-gray-200">Sincronización manual de CVs</p>
          <p className="text-sm text-gray-500">Semana KPI: lunes a domingo. Se muestra la última semana cerrada.</p>
        </div>
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-lg border border-brand-500/40 bg-brand-500/15 px-4 py-2.5 text-sm font-semibold text-brand-200 transition hover:bg-brand-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {syncing ? 'Actualizando...' : 'Actualizar info'}
        </button>
      </div>

      {syncMessage ? (
        <div className="rounded-lg border border-gray-700/40 bg-gray-800/40 px-4 py-2.5 text-sm text-gray-300">{syncMessage}</div>
      ) : null}

      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50">
        <div className="flex items-center justify-between border-b border-gray-700/50 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-gray-200">Vista unificada por vacante</h3>
            <p className="mt-0.5 text-sm text-gray-500">Tabla semanal (columnas de más reciente a más antiguo) + objetivo + semáforo</p>
          </div>
          <span className="text-xs text-gray-500">{formatDateTime(data.generatedAt)}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700/30">
                <th className="px-4 py-3 text-left font-medium text-gray-500">#</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 min-w-[320px]">Vacante</th>
                <th className="px-3 py-3 text-center font-medium text-gray-500">Objetivo/sem</th>
                <th className="px-3 py-3 text-center font-medium text-gray-500">Semáforo</th>
                <th className="px-3 py-3 text-right font-medium text-gray-500">Semana cerrada</th>
                {weekColumns.map((week) => (
                  <th key={week.weekLabel} className="px-3 py-3 text-right font-medium text-gray-500 whitespace-nowrap">
                    {week.weekLabel}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/20">
              {unifiedRows.map((row, index) => {
                const pointsDesc = [...row.points].reverse()
                const traffic = getTrafficLight(row.weeklyTarget, row.newThisWeek)

                return (
                  <tr key={row.vacancyId} className="hover:bg-gray-700/20 transition-colors">
                    <td className="px-4 py-3 text-gray-500 tabular-nums">{index + 1}</td>
                    <td className="px-4 py-3 text-gray-100 font-medium">{row.vacancyTitle}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={targetDrafts[row.vacancyId] ?? ''}
                          onChange={(e) =>
                            setTargetDrafts((prev) => ({
                              ...prev,
                              [row.vacancyId]: e.target.value,
                            }))
                          }
                          className="w-24 rounded-md border border-gray-600/60 bg-gray-900/70 px-2.5 py-1.5 text-right text-sm text-gray-100 outline-none focus:border-blue-500/60"
                          placeholder="-"
                        />
                        <button
                          type="button"
                          onClick={() => saveWeeklyTarget(row.vacancyId)}
                          disabled={savingTargetId !== null}
                          className="rounded-md border border-blue-500/40 bg-blue-500/15 px-2.5 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/25 disabled:opacity-60"
                        >
                          {savingTargetId === row.vacancyId ? '...' : 'Guardar'}
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <TrafficPill status={traffic} />
                    </td>
                    <td className="px-3 py-3 text-right text-base text-gray-100 tabular-nums font-semibold">{row.newThisWeek}</td>
                    {pointsDesc.map((point) => (
                      <td key={`${row.vacancyId}-${point.weekLabel}`} className="px-3 py-3 text-right tabular-nums text-gray-300">
                        {point.count}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
