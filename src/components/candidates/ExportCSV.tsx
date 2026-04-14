'use client'

import { Download } from 'lucide-react'
import type { Candidate } from '@/lib/supabase/types'

interface ExportCSVProps {
  candidates: Candidate[]
  filename?: string
}

function escapeCSV(value: string | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function formatDate(date: string | null): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('es-AR')
}

function generateCSV(candidates: Candidate[]): string {
  const headers = [
    'Nombre',
    'Email',
    'Telefono',
    'Status',
    'Nacionalidad',
    'Idioma Nativo',
    'Ingles',
    'Aleman',
    'Fuente',
    'Owner',
    'Promo/Job Opening',
    'Fecha Creacion',
    'Ultima Actividad',
    'Dias en Proceso',
    'SLA',
  ]

  const rows = candidates.map((c) => [
    escapeCSV(c.full_name),
    escapeCSV(c.email),
    escapeCSV(c.phone),
    escapeCSV(c.current_status),
    escapeCSV(c.nationality),
    escapeCSV(c.native_language),
    escapeCSV(c.english_level),
    escapeCSV(c.german_level),
    escapeCSV(c.source),
    escapeCSV(c.owner),
    escapeCSV(c.job_opening_title),
    escapeCSV(formatDate(c.created_time)),
    escapeCSV(formatDate(c.last_activity_time)),
    c.days_in_process != null ? String(c.days_in_process) : '',
    escapeCSV(c.sla_status),
  ])

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

export default function ExportCSV({ candidates, filename }: ExportCSVProps) {
  const handleExport = () => {
    const csv = generateCSV(candidates)
    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = filename
      ? `${filename}-${date}.csv`
      : `candidatos-${date}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={candidates.length === 0}
      className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2 text-xs text-gray-400 transition hover:border-gray-600 hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Download className="h-3.5 w-3.5" />
      Export CSV
    </button>
  )
}
