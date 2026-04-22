'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  PlusCircle,
  Trash2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react'
import PromoEditModal from '@/components/formacion/PromoEditModal'
import {
  getPromotionsFormacionOverview,
  type PromotionFormacionOverview,
} from '@/lib/queries/formacion'
import {
  getRegisteredSheets,
  registerSheet,
  triggerSheetSync,
  unregisterSheet,
  type RegisteredSheet,
} from '@/lib/queries/sheets'
import { getPromoLinkedVacancies } from '@/app/dashboard/formacion/actions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function syncStatusColor(status: string | null): string {
  if (!status) return 'text-gray-500 bg-gray-700/30'
  if (status === 'done') return 'text-green-400 bg-green-500/20'
  if (status === 'error') return 'text-red-400 bg-red-500/20'
  return 'text-amber-400 bg-amber-500/20' // pending | syncing
}

function syncStatusLabel(status: string | null): string {
  if (!status) return 'Sin estado'
  if (status === 'done') return 'Sincronizado'
  if (status === 'error') return 'Error'
  if (status === 'syncing') return 'Sincronizando…'
  return 'Pendiente'
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-700/50 bg-gray-800/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-4 w-48 rounded bg-gray-700/60" />
        <div className="h-7 w-16 rounded-lg bg-gray-700/60" />
      </div>
      <div className="flex gap-2">
        <div className="h-4 w-20 rounded-full bg-gray-700/60" />
        <div className="h-4 w-16 rounded-full bg-gray-700/60" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sheet section (collapsible)
// ---------------------------------------------------------------------------

interface SheetSectionProps {
  promoNombre: string
  sheet: RegisteredSheet | undefined
  onSheetChange: () => void
}

function SheetSection({ promoNombre, sheet, onSheetChange }: SheetSectionProps) {
  const [syncing, setSyncing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSync() {
    if (!sheet) return
    setSyncing(true)
    try {
      await triggerSheetSync(sheet.id)
      onSheetChange()
    } finally {
      setSyncing(false)
    }
  }

  async function handleDelete() {
    if (!sheet) return
    setDeleting(true)
    try {
      await unregisterSheet(sheet.id)
      onSheetChange()
    } finally {
      setDeleting(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!url.trim()) {
      setFormError('La URL es obligatoria.')
      return
    }
    setSubmitting(true)
    try {
      await registerSheet(url.trim(), promoNombre, promoNombre, '')
      setUrl('')
      onSheetChange()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al registrar')
    } finally {
      setSubmitting(false)
    }
  }

  if (sheet) {
    return (
      <div className="border-t border-gray-700/30 pt-2 mt-2 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-gray-500" />
          <span className="text-xs text-gray-300 truncate max-w-[200px]">
            {sheet.sheet_name ?? sheet.sheet_url}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${syncStatusColor(sheet.sync_status)}`}
          >
            {syncStatusLabel(sheet.sync_status)}
          </span>
          {sheet.last_synced_at && (
            <span className="text-[10px] text-gray-500">
              Última sync: {formatDate(sheet.last_synced_at)}
            </span>
          )}
          {sheet.sync_error && (
            <span className="truncate max-w-xs text-[10px] text-red-400" title={sheet.sync_error}>
              {sheet.sync_error}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-lg border border-gray-600 px-2.5 py-1 text-[11px] text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {syncing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Sincronizar
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1 rounded-lg border border-red-800/40 px-2 py-1 text-[11px] text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50"
              title="Eliminar sheet"
            >
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // No sheet linked — show inline register form
  return (
    <div className="border-t border-gray-700/30 pt-2 mt-2">
      <form onSubmit={handleRegister} className="flex items-center gap-2">
        <input
          type="url"
          placeholder="https://docs.google.com/spreadsheets/d/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30"
        />
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50 shrink-0"
        >
          {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlusCircle className="h-3 w-3" />}
          Agregar sheet
        </button>
      </form>
      {formError && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-red-400">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {formError}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Promo row
// ---------------------------------------------------------------------------

interface PromoRowProps {
  promo: PromotionFormacionOverview
  sheet: RegisteredSheet | undefined
  onEditSaved: () => void
  onSheetChange: () => void
}

function PromoRow({ promo, sheet, onEditSaved, onSheetChange }: PromoRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [vacancyCount, setVacancyCount] = useState<number | null>(null)

  useEffect(() => {
    getPromoLinkedVacancies(promo.nombre)
      .then((v) => setVacancyCount((v as unknown[]).length))
      .catch(() => setVacancyCount(0))
  }, [promo.nombre])

  const hasSheet = !!sheet

  return (
    <>
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4 space-y-2">
        {/* Main row */}
        <div className="flex items-center justify-between gap-3">
          {/* Left: name + badges */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-sm font-semibold text-gray-100 leading-tight truncate">
              {promo.nombre}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {promo.modalidad && (
                <span className="rounded-full bg-gray-700/50 px-2 py-0.5 text-[10px] text-gray-400">
                  {promo.modalidad}
                </span>
              )}
              {promo.pais && (
                <span className="rounded-full bg-gray-700/50 px-2 py-0.5 text-[10px] text-gray-400">
                  {promo.pais}
                </span>
              )}
              {promo.coordinador && (
                <span className="rounded-full bg-gray-700/50 px-2 py-0.5 text-[10px] text-gray-400">
                  {promo.coordinador}
                </span>
              )}
            </div>
          </div>

          {/* Middle: vacancy + sheet badges */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="rounded-full bg-indigo-500/20 text-indigo-300 px-2 py-0.5 text-xs">
              {vacancyCount !== null ? `${vacancyCount} vacante${vacancyCount !== 1 ? 's' : ''}` : '…'}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] ${
                hasSheet
                  ? syncStatusColor(sheet!.sync_status)
                  : 'text-gray-500 bg-gray-700/30'
              }`}
            >
              {hasSheet ? syncStatusLabel(sheet!.sync_status) : 'Sin sheet'}
            </span>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setEditOpen(true)}
              className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Editar
            </button>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="rounded-lg border border-gray-700/50 p-1.5 text-gray-500 hover:bg-gray-700 hover:text-gray-300 transition-colors"
              aria-label={expanded ? 'Colapsar sheet' : 'Expandir sheet'}
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsible sheet section */}
        {expanded && (
          <SheetSection
            promoNombre={promo.nombre}
            sheet={sheet}
            onSheetChange={onSheetChange}
          />
        )}
      </div>

      {/* Edit modal */}
      {editOpen && (
        <PromoEditModal
          promo={{
            id: promo.id,
            nombre: promo.nombre,
            modalidad: promo.modalidad,
            pais: promo.pais,
            coordinador: promo.coordinador,
            cliente: promo.cliente,
            fecha_inicio: promo.fecha_inicio,
            fecha_fin: promo.fecha_fin,
            objetivo_atraccion: promo.objetivo_atraccion ?? null,
            objetivo_programa: promo.objetivo_programa ?? null,
            expectativa_finalizan: promo.objetivo ?? null,
            pct_exito_estimado: promo.pct_exito_estimado,
            contratos_firmados: promo.contratos_firmados,
          }}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false)
            onEditSaved()
          }}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PromoEdicionHub() {
  const [promos, setPromos] = useState<PromotionFormacionOverview[]>([])
  const [sheets, setSheets] = useState<RegisteredSheet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [promosData, sheetsData] = await Promise.all([
        getPromotionsFormacionOverview('all'),
        getRegisteredSheets(),
      ])
      setPromos(promosData)
      setSheets(sheetsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Map sheets by promocion_nombre for quick lookup
  const sheetByPromo = new Map<string, RegisteredSheet>()
  for (const s of sheets) {
    const name = (s as any).promocion_nombre as string | null
    if (name) sheetByPromo.set(name, s)
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {error}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------
  if (promos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-700/50 bg-gray-800/30 py-16 text-center">
        <FileSpreadsheet className="mb-3 h-10 w-10 text-gray-600" />
        <p className="text-sm font-medium text-gray-400">Sin promociones</p>
        <p className="mt-1 text-xs text-gray-500">No se encontraron promociones registradas.</p>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render list
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-3">
      {promos.map((promo) => (
        <PromoRow
          key={promo.id}
          promo={promo}
          sheet={sheetByPromo.get(promo.nombre)}
          onEditSaved={fetchData}
          onSheetChange={fetchData}
        />
      ))}
    </div>
  )
}
