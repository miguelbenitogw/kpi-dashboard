'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
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

export default function ReceivedCvsByVacancyView() {
  const [data, setData] = useState<ReceivedCvsByVacancyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [targetDrafts, setTargetDrafts] = useState<Record<string, string>>({})
  const [savingTargetIds, setSavingTargetIds] = useState<Record<string, boolean>>({})
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

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

  useEffect(() => {
    return () => {
      Object.values(saveTimersRef.current).forEach((timer) => clearTimeout(timer))
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

  async function saveWeeklyTarget(vacancyId: string, rawValue: string) {
    const raw = rawValue.trim()
    const weeklyTarget = raw === '' ? null : Number(raw)
    if (weeklyTarget !== null && (!Number.isFinite(weeklyTarget) || weeklyTarget < 0)) {
      setSyncMessage('El objetivo debe ser un número mayor o igual a 0.')
      return
    }

    setSavingTargetIds((prev) => ({ ...prev, [vacancyId]: true }))
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

      setSyncMessage('Objetivo semanal guardado automáticamente.')
      await refreshStats()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al guardar objetivo.'
      setSyncMessage(message)
    } finally {
      setSavingTargetIds((prev) => ({ ...prev, [vacancyId]: false }))
    }
  }

  function scheduleAutoSave(vacancyId: string, value: string) {
    const existing = saveTimersRef.current[vacancyId]
    if (existing) clearTimeout(existing)

    saveTimersRef.current[vacancyId] = setTimeout(() => {
      void saveWeeklyTarget(vacancyId, value)
    }, 700)
  }

  const unifiedRows = useMemo(() => {
    if (!data) return []
    const seriesByVacancy = new Map(data.weeklySeries.map((serie) => [serie.vacancyId, serie]))
    return data.ranking.map((rankingRow) => ({
      ...rankingRow,
      points: seriesByVacancy.get(rankingRow.vacancyId)?.points ?? [],
    }))
  }, [data])

  // weekColumns[0] = current (in-progress) week, weekColumns[1..] = historical (most-recent-first)
  const weekColumns = useMemo(() => {
    if (!data || data.weeklySeries.length === 0) return []
    const base = data.weeklySeries[0]?.points ?? []
    return [...base].reverse()
  }, [data])

  // The current-week column is weekColumns[0]; historical starts at index 1
  const historicalColumns = weekColumns.slice(1)

  if (loading) {
    return (
      <div className="space-y-4">
        <div
          style={{ background: '#f7f4ef', border: '1px solid #e7e2d8', borderRadius: 12 }}
          className="h-16 animate-pulse"
        />
        <div
          style={{ background: '#faf8f5', border: '1px solid #e7e2d8', borderRadius: 14 }}
          className="h-96 animate-pulse"
        />
      </div>
    )
  }

  if (!data || data.ranking.length === 0) {
    return (
      <div className="space-y-4">
        <div
          style={{
            background: '#f7f4ef',
            border: '1px solid #e7e2d8',
            borderRadius: 12,
            padding: '12px 16px',
          }}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <div>
            <p style={{ color: '#1c1917', fontWeight: 600 }}>Sincronización manual de CVs</p>
            <p style={{ color: '#78716c', fontSize: 13 }}>Actualizá Zoho ahora y refrescá esta vista al instante.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleSyncNow}
              disabled={syncing}
              style={{
                background: '#1e4b9e',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                opacity: syncing ? 0.6 : 1,
                cursor: syncing ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncing ? 'Actualizando...' : 'Actualizar info'}
            </button>
          </div>
        </div>

        {syncMessage ? (
          <div
            style={{
              background: '#faf8f5',
              border: '1px solid #e7e2d8',
              borderRadius: 8,
              padding: '10px 16px',
              fontSize: 13,
              color: '#78716c',
            }}
          >
            {syncMessage}
          </div>
        ) : null}

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e7e2d8',
            borderRadius: 14,
            padding: 32,
            textAlign: 'center',
          }}
        >
          <p style={{ color: '#1c1917', fontSize: 15 }}>Todavía no hay CVs recibidos para mostrar.</p>
          <p style={{ color: '#78716c', fontSize: 13, marginTop: 4 }}>
            Cuando haya actividad semanal, vas a ver el ranking por vacante acá.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header / sync area */}
      <div
        style={{
          background: '#f7f4ef',
          border: '1px solid #e7e2d8',
          borderRadius: 12,
          padding: '12px 16px',
        }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div>
          <p style={{ color: '#1c1917', fontWeight: 600 }}>Sincronización manual de CVs</p>
          <p style={{ color: '#78716c', fontSize: 13 }}>Semana KPI: lunes a domingo. "Esta sem." muestra la semana en curso.</p>
          <p style={{ color: '#a8a29e', fontSize: 12, marginTop: 2 }}>{formatDateTime(data.generatedAt)}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={syncing}
            style={{
              background: '#1e4b9e',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              opacity: syncing ? 0.6 : 1,
              cursor: syncing ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? 'Actualizando...' : 'Actualizar info'}
          </button>
        </div>
      </div>

      {syncMessage ? (
        <div
          style={{
            background: '#faf8f5',
            border: '1px solid #e7e2d8',
            borderRadius: 8,
            padding: '10px 16px',
            fontSize: 13,
            color: '#78716c',
          }}
        >
          {syncMessage}
        </div>
      ) : null}

      {/* Table */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e7e2d8',
          borderRadius: 14,
        }}
      >
        <div className="overflow-x-auto min-h-[62vh]">
          <table className="w-full" style={{ fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f7f4ef', borderBottom: '1px solid #e7e2d8' }}>
                <th
                  style={{
                    padding: '7px 14px',
                    textAlign: 'left',
                    color: '#78716c',
                    fontWeight: 500,
                    fontSize: 12,
                    minWidth: 320,
                  }}
                >
                  Vacante
                </th>
                <th
                  style={{
                    padding: '7px 10px',
                    textAlign: 'center',
                    color: '#78716c',
                    fontWeight: 500,
                    fontSize: 12,
                  }}
                >
                  Objetivo/sem
                </th>
                {/* Current week — highlighted */}
                <th
                  style={{
                    padding: '7px 10px',
                    textAlign: 'right',
                    color: '#1e4b9e',
                    fontWeight: 600,
                    fontSize: 12,
                    background: '#eaf0fb',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Esta sem.
                </th>
                {/* Historical weeks */}
                {historicalColumns.map((week) => (
                  <th
                    key={week.weekLabel}
                    style={{
                      padding: '7px 10px',
                      textAlign: 'right',
                      color: '#78716c',
                      fontWeight: 500,
                      fontSize: 12,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {week.weekLabel}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {unifiedRows.map((row, index) => {
                // pointsDesc[0] = current week, pointsDesc[1..] = historical (newest first)
                const pointsDesc = [...row.points].reverse()
                const traffic = getTrafficLight(row.weeklyTarget, row.newThisWeek)

                const rowBg =
                  traffic === 'green'
                    ? 'rgba(22,163,74,0.05)'
                    : traffic === 'yellow'
                      ? 'rgba(202,138,4,0.05)'
                      : traffic === 'red'
                        ? 'rgba(220,38,38,0.05)'
                        : index % 2 === 0
                          ? '#ffffff'
                          : '#faf8f5'

                return (
                  <tr
                    key={row.vacancyId}
                    style={{
                      background: rowBg,
                      borderBottom: '1px solid #f0ece4',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      const hoverColor =
                        traffic === 'green'
                          ? 'rgba(22,163,74,0.10)'
                          : traffic === 'yellow'
                            ? 'rgba(202,138,4,0.10)'
                            : traffic === 'red'
                              ? 'rgba(220,38,38,0.10)'
                              : 'rgba(30,75,158,0.03)'
                      ;(e.currentTarget as HTMLTableRowElement).style.background = hoverColor
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLTableRowElement).style.background = rowBg
                    }}
                  >
                    {/* Vacancy title */}
                    <td style={{ padding: '7px 14px', color: '#1c1917', fontWeight: 500, fontSize: 13 }}>
                      {row.vacancyTitle}
                    </td>

                    {/* Objetivo/sem — compact input with inline spinner */}
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={targetDrafts[row.vacancyId] ?? ''}
                          onChange={(e) => {
                            const nextValue = e.target.value
                            setTargetDrafts((prev) => ({
                              ...prev,
                              [row.vacancyId]: nextValue,
                            }))
                            scheduleAutoSave(row.vacancyId, nextValue)
                          }}
                          placeholder="-"
                          style={{
                            width: 64,
                            border: '1px solid #e7e2d8',
                            borderRadius: 6,
                            padding: '4px 8px',
                            fontSize: 13,
                            textAlign: 'center',
                            color: '#1c1917',
                            background: '#faf8f5',
                            outline: 'none',
                            opacity: savingTargetIds[row.vacancyId] ? 0.6 : 1,
                            transition: 'opacity 0.15s',
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = '#1e4b9e'
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = '#e7e2d8'
                          }}
                        />
                        {savingTargetIds[row.vacancyId] ? (
                          <Loader2
                            style={{ width: 12, height: 12, color: '#a8a29e', flexShrink: 0 }}
                            className="animate-spin"
                          />
                        ) : null}
                      </div>
                    </td>

                    {/* Esta sem. — current in-progress week */}
                    <td
                      style={{
                        padding: '7px 10px',
                        textAlign: 'right',
                        color: '#1e4b9e',
                        fontWeight: 700,
                        background: '#eaf0fb',
                        tabularNums: true,
                        fontSize: 13,
                      } as React.CSSProperties}
                      className="tabular-nums"
                    >
                      {row.newThisWeek}
                    </td>

                    {/* Historical weeks — skip index 0 (current week, already shown) */}
                    {pointsDesc.slice(1).map((point) => (
                      <td
                        key={`${row.vacancyId}-${point.weekLabel}`}
                        style={{ padding: '7px 10px', textAlign: 'right', color: '#78716c', fontSize: 13 }}
                        className="tabular-nums"
                      >
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
