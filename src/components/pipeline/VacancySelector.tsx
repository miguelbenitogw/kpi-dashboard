'use client'

import { useState, useRef, useEffect } from 'react'
import type { JobOpening } from '@/lib/supabase/types'

interface VacancySelectorProps {
  vacancies: JobOpening[]
  selected: string | null
  onSelect: (id: string) => void
}

export default function VacancySelector({
  vacancies,
  selected,
  onSelect,
}: VacancySelectorProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = vacancies.filter((v) =>
    v.title.toLowerCase().includes(search.toLowerCase()) ||
    (v.client_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const selectedVacancy = vacancies.find((v) => v.id === selected)

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-gray-700 bg-gray-800/80 px-4 py-2.5 text-left text-sm text-gray-100 transition hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      >
        <span className="truncate">
          {selectedVacancy
            ? `${selectedVacancy.title}${selectedVacancy.client_name ? ` — ${selectedVacancy.client_name}` : ''}`
            : 'Select a vacancy...'}
        </span>
        <svg
          className={`ml-2 h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 shadow-xl">
          <div className="p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vacancies..."
              className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              autoFocus
            />
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-2 text-sm text-gray-500">No vacancies found</li>
            ) : (
              filtered.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(v.id)
                      setOpen(false)
                      setSearch('')
                    }}
                    className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition hover:bg-gray-700/50 ${
                      v.id === selected ? 'bg-blue-600/20 text-blue-400' : 'text-gray-200'
                    }`}
                  >
                    <span className="truncate">{v.title}</span>
                    {v.client_name && (
                      <span className="ml-2 shrink-0 text-xs text-gray-500">
                        {v.client_name}
                      </span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
