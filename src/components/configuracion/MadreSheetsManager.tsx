'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  PlusCircle,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  Trash2,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react'
import { triggerMadreSync } from '@/lib/queries/madre-sheets'
import type { MadreSheet } from '@/lib/queries/madre-sheets'
import {
  getMadreSheetsAction,
  registerMadreSheetAction,
  unregisterMadreSheetAction,
} from '@/app/dashboard/configuracion/actions'

// ---------------------------------------------------------------------------
// Initial form state
// ---------------------------------------------------------------------------
const EMPTY_FORM = {
  sheetUrl: '',
  label: '',
  year: '',
}

// ---------------------------------------------------------------------------
// MadreSheetCard
// ---------------------------------------------------------------------------
interface MadreSheetCardProps {
  sheet: MadreSheet
  onSync: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function MadreSheetCard({ sheet, onSync, onDelete }: MadreSheetCardProps) {
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      await onSync(sheet.id)
      setSyncResult({ success: true, message: 'Sync completado' })
    } catch {
      setSyncResult({ success: false, message: 'Error durante el sync' })
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-gray-100">{sheet.label}</h3>
          {sheet.year && (
            <span className="mt-1 inline-block rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
              {sheet.year}
            </span>
          )}
        </div>
        {sheet.is_active ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-400">
            <CheckCircle2 className="h-3 w-3" />
            Activo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/10 px-2.5 py-0.5 text-xs font-medium text-gray-400">
            Inactivo
          </span>
        )}
      </div>

      <a
        href={`https://docs.google.com/spreadsheets/d/${sheet.sheet_id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline"
      >
        <ExternalLink className="h-3 w-3" />
        Abrir en Google Sheets
      </a>

      {syncResult && (
        <div
          className={`mt-2 rounded px-2 py-1 text-xs ${
            syncResult.success
              ? 'bg-green-500/10 text-green-400'
              : 'bg-red-500/10 text-red-400'
          }`}
        >
          {syncResult.message}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-gray-700 pt-3">
        <button
          onClick={handleSync}
          disabled={syncing}
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
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirmar'}
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function MadreSheetsManager() {
  const [sheets, setSheets] = useState<MadreSheet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getMadreSheetsAction()
      setSheets(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // -------------------------------------------------------------------------
  // Single sheet actions
  // -------------------------------------------------------------------------
  const handleSync = async (id: string) => {
    await triggerMadreSync(id)
    await fetchData()
  }

  const handleDelete = async (id: string) => {
    await unregisterMadreSheetAction(id)
    setSheets((prev) => prev.filter((s) => s.id !== id))
  }

  // -------------------------------------------------------------------------
  // Register new sheet
  // -------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!form.sheetUrl.trim()) {
      setFormError('La URL del Excel Madre es obligatoria.')
      return
    }
    if (!form.label.trim()) {
      setFormError('La etiqueta es obligatoria.')
      return
    }

    setSubmitting(true)
    try {
      await registerMadreSheetAction(
        form.sheetUrl.trim(),
        form.label.trim(),
        form.year ? parseInt(form.year, 10) : null,
      )
      setForm(EMPTY_FORM)
      await fetchData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al registrar el sheet')
    } finally {
      setSubmitting(false)
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-400">Cargando sheets...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------------ */}
      {/* Existing sheets                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Excels Madre registrados ({sheets.length})
          </h2>
        </div>

        {sheets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-700/50 bg-gray-800/30 py-12 text-center">
            <FileSpreadsheet className="mb-3 h-10 w-10 text-gray-600" />
            <p className="text-sm font-medium text-gray-400">No hay Excels Madre registrados todavía</p>
            <p className="mt-1 text-xs text-gray-500">
              Usá el formulario de abajo para vincular el primero.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sheets.map((sheet) => (
              <MadreSheetCard
                key={sheet.id}
                sheet={sheet}
                onSync={handleSync}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Register new sheet form                                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
        <h2 className="mb-5 flex items-center gap-2 text-base font-semibold text-gray-100">
          <PlusCircle className="h-4 w-4 text-blue-400" />
          Registrar nuevo Excel Madre
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-400">
              URL del Excel Madre <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={form.sheetUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, sheetUrl: e.target.value }))}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none transition-colors focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-400">
                Etiqueta <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder='Ej: "2026"'
                value={form.label}
                onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none transition-colors focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-400">
                Año
                <span className="ml-1 text-gray-600">(opcional)</span>
              </label>
              <input
                type="number"
                placeholder="2026"
                value={form.year}
                onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none transition-colors focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30"
              />
            </div>
          </div>

          {formError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {formError}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlusCircle className="h-4 w-4" />
              )}
              Registrar Excel Madre
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
