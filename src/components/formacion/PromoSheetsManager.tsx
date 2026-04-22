'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, PlusCircle, Loader2, AlertCircle, FileSpreadsheet } from 'lucide-react'
import SheetCard from '@/components/settings/SheetCard'
import {
  getRegisteredSheets,
  getActivePromoOptions,
  registerSheet,
  triggerSheetSync,
  unregisterSheet,
} from '@/lib/queries/sheets'
import type { RegisteredSheet, PromoOption } from '@/lib/queries/sheets'

// ---------------------------------------------------------------------------
// Initial form state
// ---------------------------------------------------------------------------
const EMPTY_FORM = {
  sheetUrl: '',
  promocionNombre: '',
  sheetName: '',
  groupFilter: '',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function PromoSheetsManager() {
  const [sheets, setSheets] = useState<RegisteredSheet[]>([])
  const [promos, setPromos] = useState<PromoOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [syncingAll, setSyncingAll] = useState(false)

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sheetsData, promosData] = await Promise.all([
        getRegisteredSheets(),
        getActivePromoOptions(),
      ])
      setSheets(sheetsData)
      setPromos(promosData)
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
  // Auto-fill sheet name from selected promo
  // -------------------------------------------------------------------------
  const handlePromoChange = (nombre: string) => {
    setForm((prev) => ({
      ...prev,
      promocionNombre: nombre,
      sheetName: prev.sheetName === '' || prev.sheetName === getPrevPromoName(prev.promocionNombre)
        ? nombre
        : prev.sheetName,
    }))
  }

  function getPrevPromoName(nombre: string) {
    return nombre
  }

  // -------------------------------------------------------------------------
  // Sync all sheets sequentially
  // -------------------------------------------------------------------------
  const handleSyncAll = async () => {
    if (sheets.length === 0) return
    setSyncingAll(true)
    try {
      for (const sheet of sheets) {
        await triggerSheetSync(sheet.id)
      }
      await fetchData()
    } finally {
      setSyncingAll(false)
    }
  }

  // -------------------------------------------------------------------------
  // Single sheet actions
  // -------------------------------------------------------------------------
  const handleSync = async (sheetId: string) => {
    await triggerSheetSync(sheetId)
    await fetchData()
  }

  const handleDelete = async (sheetId: string) => {
    await unregisterSheet(sheetId)
    setSheets((prev) => prev.filter((s) => s.id !== sheetId))
  }

  // -------------------------------------------------------------------------
  // Register new sheet
  // -------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!form.sheetUrl.trim()) {
      setFormError('La URL del sheet es obligatoria.')
      return
    }
    if (!form.promocionNombre) {
      setFormError('Seleccioná una promoción.')
      return
    }

    setSubmitting(true)
    try {
      await registerSheet(
        form.sheetUrl.trim(),
        form.promocionNombre,
        form.sheetName.trim() || form.promocionNombre,
        form.groupFilter.trim(),
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
  // Promos already linked — show unlinked first
  // -------------------------------------------------------------------------
  const linkedPromoNames = new Set(sheets.map((s) => (s as any).promocion_nombre).filter(Boolean))
  const sortedPromos = [
    ...promos.filter((p) => !linkedPromoNames.has(p.nombre)),
    ...promos.filter((p) => linkedPromoNames.has(p.nombre)),
  ]

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
            Sheets registradas ({sheets.length})
          </h2>
          <button
            onClick={handleSyncAll}
            disabled={syncingAll || sheets.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-700/50 bg-gray-800/50 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-blue-500/50 hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sincronizar todo
          </button>
        </div>

        {sheets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-700/50 bg-gray-800/30 py-12 text-center">
            <FileSpreadsheet className="mb-3 h-10 w-10 text-gray-600" />
            <p className="text-sm font-medium text-gray-400">No hay sheets registradas todavía</p>
            <p className="mt-1 text-xs text-gray-500">
              Usá el formulario de abajo para vincular la primera.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sheets.map((sheet) => (
              <SheetCard
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
          Registrar nuevo sheet
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* URL */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-400">
              URL del Google Sheet <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={form.sheetUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, sheetUrl: e.target.value }))}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none transition-colors focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30"
            />
          </div>

          {/* Promo selector + Sheet name — side by side on wider screens */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Promo */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-400">
                Promoción <span className="text-red-400">*</span>
              </label>
              <select
                value={form.promocionNombre}
                onChange={(e) => handlePromoChange(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30"
              >
                <option value="">— Seleccioná una promo —</option>
                {sortedPromos.map((p) => {
                  const isLinked = linkedPromoNames.has(p.nombre)
                  const label = p.numero ? `#${p.numero} — ${p.nombre}` : p.nombre
                  return (
                    <option key={p.nombre} value={p.nombre}>
                      {label}
                      {isLinked ? ' (ya vinculada)' : ''}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Sheet name */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-400">
                Nombre del sheet
                <span className="ml-1 text-gray-600">(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Se usa el nombre de la promo si está vacío"
                value={form.sheetName}
                onChange={(e) => setForm((prev) => ({ ...prev, sheetName: e.target.value }))}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none transition-colors focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30"
              />
            </div>
          </div>

          {/* Group filter */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-400">
              Filtro de grupo
              <span className="ml-1 text-gray-600">(opcional — para sheets compartidas)</span>
            </label>
            <input
              type="text"
              placeholder="Ej: Grupo A"
              value={form.groupFilter}
              onChange={(e) => setForm((prev) => ({ ...prev, groupFilter: e.target.value }))}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none transition-colors focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30"
            />
          </div>

          {/* Error */}
          {formError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {formError}
            </div>
          )}

          {/* Submit */}
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
              Registrar sheet
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
