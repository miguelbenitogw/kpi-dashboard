'use client'

import { useState, useEffect, useTransition } from 'react'
import { Search, X, Check, Link2Off } from 'lucide-react'
import { searchJobOpenings, type JobOpeningOption } from '@/lib/queries/colocacion'
import { linkPromoToJobOpening } from '@/app/dashboard/colocacion/actions'

interface Props {
  promocionNombre: string
  linkedJobOpeningId: string | null
  linkedJobOpeningTitle: string | null
  onLinked: (jobOpeningId: string | null, title: string | null) => void
  onClose: () => void
}

export default function PromoLinker({
  promocionNombre,
  linkedJobOpeningId,
  linkedJobOpeningTitle,
  onLinked,
  onClose,
}: Props) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<JobOpeningOption[]>([])
  const [isPending, startTransition] = useTransition()

  // Debounced search
  useEffect(() => {
    if (search.trim().length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      const r = await searchJobOpenings(search)
      setResults(r)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  function handleSelect(job: JobOpeningOption) {
    startTransition(async () => {
      const res = await linkPromoToJobOpening(promocionNombre, job.id)
      if (res.success) {
        onLinked(job.id, job.title)
        onClose()
      }
    })
  }

  function handleClear() {
    startTransition(async () => {
      const res = await linkPromoToJobOpening(promocionNombre, null)
      if (res.success) {
        onLinked(null, null)
        onClose()
      }
    })
  }

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-surface-700/60 bg-surface-850 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Vincular vacante Zoho</p>
            <p className="mt-0.5 text-sm font-semibold text-gray-200">{promocionNombre}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-500 hover:bg-surface-700/60 hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Current link */}
        {linkedJobOpeningTitle && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-ok-500/20 bg-ok-500/10 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <Check className="h-3.5 w-3.5 shrink-0 text-ok-400" />
              <span className="truncate text-xs text-ok-400">{linkedJobOpeningTitle}</span>
            </div>
            <button
              onClick={handleClear}
              disabled={isPending}
              className="ml-3 flex shrink-0 items-center gap-1 text-xs text-gray-500 hover:text-danger-400 disabled:opacity-50"
            >
              <Link2Off className="h-3 w-3" />
              Desvincular
            </button>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar vacante por nombre..."
            autoFocus
            className="w-full rounded-lg border border-surface-600/60 bg-surface-800 py-2 pl-9 pr-3 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500/50 focus:outline-none"
          />
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-surface-700/40">
            {results.map((job) => (
              <button
                key={job.id}
                onClick={() => handleSelect(job)}
                disabled={isPending}
                className={`w-full border-b border-surface-700/30 px-3 py-2.5 text-left text-xs text-gray-300 last:border-0 hover:bg-surface-700/60 disabled:opacity-50 ${
                  job.id === linkedJobOpeningId ? 'bg-surface-700/40 text-blue-400' : ''
                }`}
              >
                {job.title}
              </button>
            ))}
          </div>
        )}

        {search.trim().length >= 2 && results.length === 0 && (
          <p className="mt-2 text-center text-xs text-gray-500">Sin resultados para "{search}"</p>
        )}

        {isPending && (
          <p className="mt-2 text-center text-xs text-gray-500">Guardando...</p>
        )}
      </div>
    </div>
  )
}
