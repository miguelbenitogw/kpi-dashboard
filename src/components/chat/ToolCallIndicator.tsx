'use client'

import { Database, Loader2 } from 'lucide-react'

const TOOL_LABELS: Record<string, string> = {
  get_promo_status_breakdown: 'Consultando estados de candidatos...',
  search_candidates: 'Buscando candidatos...',
  get_job_openings: 'Consultando vacantes...',
  get_hiring_stats: 'Obteniendo estadísticas...',
  get_candidate_detail: 'Cargando ficha del candidato...',
}

interface ToolCallIndicatorProps {
  toolName: string
  done?: boolean
}

export default function ToolCallIndicator({
  toolName,
  done = false,
}: ToolCallIndicatorProps) {
  const label = TOOL_LABELS[toolName] ?? `Consultando ${toolName}...`

  return (
    <div className="flex items-center gap-2 rounded-lg bg-gray-800/60 px-3 py-2 text-xs text-gray-400 border border-gray-700/50 w-fit">
      <Database className="h-3.5 w-3.5 text-blue-400 shrink-0" />
      <span>{done ? label.replace('...', ' ✓') : label}</span>
      {!done && (
        <Loader2 className="h-3 w-3 animate-spin text-blue-400 shrink-0" />
      )}
    </div>
  )
}
