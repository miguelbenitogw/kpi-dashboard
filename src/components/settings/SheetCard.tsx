'use client'

import { useState } from 'react'
import {
  RefreshCw,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Users,
} from 'lucide-react'
import type { RegisteredSheet } from '@/lib/queries/sheets'

interface SheetCardProps {
  sheet: RegisteredSheet
  onSync: (sheetId: string) => Promise<void>
  onDelete: (sheetId: string) => Promise<void>
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Nunca'
  const date = new Date(dateStr)
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: string | null }) {
  switch (status) {
    case 'done':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-400">
          <CheckCircle2 className="h-3 w-3" />
          Sincronizado
        </span>
      )
    case 'syncing':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          Sincronizando
        </span>
      )
    case 'error':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
          <AlertCircle className="h-3 w-3" />
          Error
        </span>
      )
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
          <Clock className="h-3 w-3" />
          Pendiente
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/10 px-2.5 py-0.5 text-xs font-medium text-gray-400">
          {status ?? 'Desconocido'}
        </span>
      )
  }
}

export default function SheetCard({ sheet, onSync, onDelete }: SheetCardProps) {
  const [syncing, setSyncing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleSync = async () => {
    setSyncing(true)
    try {
      await onSync(sheet.id)
    } finally {
      setSyncing(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    try {
      await onDelete(sheet.id)
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-gray-100">
            {sheet.sheet_name ?? 'Sin nombre'}
          </h3>
          {sheet.job_opening_title && (
            <p className="mt-0.5 truncate text-xs text-gray-400">
              Promo: {sheet.job_opening_title}
            </p>
          )}
        </div>
        <StatusBadge status={sheet.sync_status} />
      </div>

      {/* URL */}
      <a
        href={sheet.sheet_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline"
      >
        <ExternalLink className="h-3 w-3" />
        Abrir en Google Sheets
      </a>

      {/* Stats row */}
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3 w-3" />
          {sheet.student_count} estudiantes
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDate(sheet.last_synced_at)}
        </span>
      </div>

      {/* Error message */}
      {sheet.sync_status === 'error' && sheet.sync_error && (
        <div className="mt-2 rounded bg-red-500/10 px-2 py-1 text-xs text-red-400">
          {sheet.sync_error}
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2 border-t border-gray-700 pt-3">
        <button
          onClick={handleSync}
          disabled={syncing || sheet.sync_status === 'syncing'}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {syncing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Sync ahora
        </button>

        {confirmDelete ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                'Confirmar'
              )}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded-md px-2 py-1.5 text-xs text-gray-400 hover:text-gray-200"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-red-500 hover:text-red-400"
          >
            <Trash2 className="h-3 w-3" />
            Eliminar
          </button>
        )}
      </div>
    </div>
  )
}
