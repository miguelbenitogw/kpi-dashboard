'use client'

import { useEffect, useState } from 'react'
import { getAtraccionVacancies, type AtraccionVacancy } from '@/lib/queries/atraccion'

function statusBadge(status: string | null) {
  if (!status) return null

  let classes = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium'
  if (status === 'In-progress') {
    classes += ' bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30'
  } else if (status === 'Open') {
    classes += ' bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30'
  } else {
    classes += ' bg-gray-700/60 text-gray-400 ring-1 ring-gray-600/40'
  }

  return <span className={classes}>{status}</span>
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AtraccionVacanciesList() {
  const [vacancies, setVacancies] = useState<AtraccionVacancy[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const data = await getAtraccionVacancies()
      setVacancies(data)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[180px] animate-pulse rounded-xl border border-gray-700/50 bg-gray-800/50"
          />
        ))}
      </div>
    )
  }

  if (vacancies.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-gray-700/50 bg-gray-800/50 p-8 text-center">
        <p className="text-sm text-gray-400">No hay vacantes activas de atracción</p>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <p className="mb-4 text-sm text-gray-400">
        {vacancies.length} vacante{vacancies.length !== 1 ? 's' : ''} activa{vacancies.length !== 1 ? 's' : ''}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {vacancies.map((v) => {
          const openedDate = formatDate(v.date_opened)
          return (
            <div
              key={v.id}
              className="flex flex-col gap-3 rounded-xl border border-gray-700/50 bg-gray-800/50 p-5 transition-colors hover:bg-gray-800/70"
            >
              {/* Header: title + estado */}
              <div className="flex flex-col gap-1.5">
                <p className="break-words text-sm font-semibold leading-snug text-gray-100">
                  {v.title}
                </p>
                {v.client_name && (
                  <p className="text-xs text-gray-500">{v.client_name}</p>
                )}
              </div>

              {/* Badges row */}
              <div className="flex flex-wrap items-center gap-1.5">
                {statusBadge(v.status)}

                {v.es_proceso_atraccion_actual && (
                  <span className="inline-flex items-center rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-medium text-purple-400 ring-1 ring-purple-500/30">
                    Proceso Actual
                  </span>
                )}

                {v.tipo_profesional && (
                  <span className="inline-flex items-center rounded-full bg-gray-700/60 px-2 py-0.5 text-xs font-medium text-gray-300 ring-1 ring-gray-600/40">
                    {v.tipo_profesional}
                  </span>
                )}
              </div>

              {/* Metrics */}
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>
                  <span className="text-base font-bold tabular-nums text-gray-100">
                    {(v.total_candidates ?? 0).toLocaleString('es-AR')}
                  </span>{' '}
                  candidatos
                </span>
                <span>
                  <span className="text-base font-bold tabular-nums text-emerald-400">
                    {(v.hired_count ?? 0).toLocaleString('es-AR')}
                  </span>{' '}
                  contratados
                </span>
              </div>

              {/* Footer: owner + date */}
              <div className="flex flex-wrap items-center justify-between gap-1 border-t border-gray-700/40 pt-2.5 text-xs text-gray-500">
                {v.owner && <span>{v.owner}</span>}
                {openedDate && <span>Apertura: {openedDate}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
