'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Pencil, Loader2, AlertCircle } from 'lucide-react'
import {
  updatePromoMetadata,
  linkVacancyToPromo,
  unlinkVacancyFromPromo,
  searchAtraccionVacancies,
  getPromoLinkedVacancies,
  type PromoMetadataUpdate,
} from '@/app/dashboard/formacion/actions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface VacancyResult {
  id: string
  title: string
  status: string | null
  date_opened: string | null
  total_candidates: number | null
}

interface PromoEditModalProps {
  promo: {
    id: string
    nombre: string
    modalidad: string | null
    pais: string | null
    coordinador: string | null
    cliente: string | null
    fecha_inicio: string | null
    fecha_fin: string | null
    objetivo_atraccion: number | null
    objetivo_programa: number | null
    expectativa_finalizan: number | null
    pct_exito_estimado: number | null
    contratos_firmados: number | null
  }
  onClose: () => void
  onSaved: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function InputField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  suffix?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-400">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function PromoEditModal({
  promo,
  onClose,
  onSaved,
}: PromoEditModalProps) {
  // -- metadata form state --
  const [modalidad, setModalidad] = useState(promo.modalidad ?? '')
  const [pais, setPais] = useState(promo.pais ?? '')
  const [coordinador, setCoordinador] = useState(promo.coordinador ?? '')
  const [cliente, setCliente] = useState(promo.cliente ?? '')
  const [fechaInicio, setFechaInicio] = useState(promo.fecha_inicio ?? '')
  const [fechaFin, setFechaFin] = useState(promo.fecha_fin ?? '')

  const [objAtraccion, setObjAtraccion] = useState(
    promo.objetivo_atraccion != null ? String(promo.objetivo_atraccion) : ''
  )
  const [objPrograma, setObjPrograma] = useState(
    promo.objetivo_programa != null ? String(promo.objetivo_programa) : ''
  )
  const [expectativaFinalizan, setExpectativaFinalizan] = useState(
    promo.expectativa_finalizan != null ? String(promo.expectativa_finalizan) : ''
  )
  const [pctExito, setPctExito] = useState(
    promo.pct_exito_estimado != null ? String(promo.pct_exito_estimado) : ''
  )
  const [contratosFirmados, setContratosFirmados] = useState(
    promo.contratos_firmados != null ? String(promo.contratos_firmados) : ''
  )

  // -- linked vacancies state --
  const [linkedVacancies, setLinkedVacancies] = useState<VacancyResult[]>([])
  const [loadingLinked, setLoadingLinked] = useState(true)

  // -- search state --
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<VacancyResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // -- save state --
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // -- load linked vacancies on mount --
  useEffect(() => {
    getPromoLinkedVacancies(promo.nombre)
      .then((data) => setLinkedVacancies(data as VacancyResult[]))
      .catch(() => setLinkedVacancies([]))
      .finally(() => setLoadingLinked(false))
  }, [promo.nombre])

  // -- debounced search --
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await searchAtraccionVacancies(searchQuery.trim())
        // Filter out already-linked
        const linkedIds = new Set(linkedVacancies.map((v) => v.id))
        setSearchResults((results as VacancyResult[]).filter((r) => !linkedIds.has(r.id)))
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery, linkedVacancies])

  // -- close on Escape --
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  async function handleLink(vacancy: VacancyResult) {
    try {
      await linkVacancyToPromo(promo.nombre, vacancy.id)
      setLinkedVacancies((prev) => [...prev, vacancy])
      setSearchResults((prev) => prev.filter((r) => r.id !== vacancy.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al vincular vacante')
    }
  }

  async function handleUnlink(vacancyId: string) {
    try {
      await unlinkVacancyFromPromo(promo.nombre, vacancyId)
      setLinkedVacancies((prev) => prev.filter((v) => v.id !== vacancyId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al desvincular vacante')
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const data: PromoMetadataUpdate = {
        modalidad: modalidad || null,
        pais: pais || null,
        coordinador: coordinador || null,
        cliente: cliente || null,
        fecha_inicio: fechaInicio || null,
        fecha_fin: fechaFin || null,
        objetivo_atraccion: objAtraccion !== '' ? Number(objAtraccion) : null,
        objetivo_programa: objPrograma !== '' ? Number(objPrograma) : null,
        expectativa_finalizan: expectativaFinalizan !== '' ? Number(expectativaFinalizan) : null,
        pct_exito_estimado: pctExito !== '' ? Number(pctExito) : null,
        contratos_firmados: contratosFirmados !== '' ? Number(contratosFirmados) : null,
      }
      await updatePromoMetadata(promo.nombre, data)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex w-full max-w-2xl flex-col rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl max-h-[90vh]">
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-gray-700/50 px-6 py-4">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-blue-400" />
            <h2 className="text-base font-semibold text-gray-100">
              Editar Promoción{' '}
              <span className="text-blue-400">{promo.nombre}</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-700/50 bg-red-900/20 px-4 py-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-500 hover:text-red-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* ── Sección: Metadatos ── */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Metadatos
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Modalidad" value={modalidad} onChange={setModalidad} />
                <InputField label="País" value={pais} onChange={setPais} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Coordinador" value={coordinador} onChange={setCoordinador} />
                <InputField label="Cliente" value={cliente} onChange={setCliente} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Fecha inicio" value={fechaInicio} onChange={setFechaInicio} type="date" />
                <InputField label="Fecha fin" value={fechaFin} onChange={setFechaFin} type="date" />
              </div>
            </div>
          </section>

          {/* ── Sección: Objetivos de Atracción ── */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Objetivos de Atracción
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Obj. personas aceptadas"
                value={objAtraccion}
                onChange={setObjAtraccion}
              />
              <NumberField
                label="Obj. personas que comienzan programa"
                value={objPrograma}
                onChange={setObjPrograma}
              />
              <NumberField
                label="Expectativa personas finalizan"
                value={expectativaFinalizan}
                onChange={setExpectativaFinalizan}
              />
              <NumberField
                label="% estimado éxito"
                value={pctExito}
                onChange={setPctExito}
                suffix="%"
              />
              <NumberField
                label="Contratos firmados"
                value={contratosFirmados}
                onChange={setContratosFirmados}
              />
            </div>
          </section>

          {/* ── Sección: Vacantes vinculadas ── */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Vacantes de Atracción vinculadas
            </h3>

            {/* Linked list */}
            {loadingLinked ? (
              <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando vacantes vinculadas...
              </div>
            ) : linkedVacancies.length === 0 ? (
              <p className="py-2 text-sm text-gray-600">Sin vacantes vinculadas</p>
            ) : (
              <ul className="mb-4 space-y-1.5">
                {linkedVacancies.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between rounded-lg border border-gray-700/50 bg-gray-800/50 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-gray-200">{v.title}</p>
                      <p className="text-xs text-gray-500">
                        {v.status ?? 'Sin estado'} &middot;{' '}
                        {v.total_candidates ?? 0} candidatos
                      </p>
                    </div>
                    <button
                      onClick={() => handleUnlink(v.id)}
                      className="ml-3 flex-shrink-0 rounded p-1 text-gray-600 transition-colors hover:bg-gray-700 hover:text-red-400"
                      title="Desvincular"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar vacante..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-500" />
              )}
            </div>

            {/* Search results dropdown */}
            {searchResults.length > 0 && (
              <ul className="mt-1.5 space-y-1 rounded-lg border border-gray-700 bg-gray-800 p-1.5 shadow-xl">
                {searchResults.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => handleLink(r)}
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors hover:bg-gray-700"
                    >
                      <span className="truncate text-sm text-gray-200">{r.title}</span>
                      <span className="ml-3 flex-shrink-0 text-xs text-gray-500">
                        {r.total_candidates ?? 0} candidatos
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {searchQuery.trim() && !searching && searchResults.length === 0 && (
              <p className="mt-2 text-xs text-gray-600">Sin resultados para "{searchQuery}"</p>
            )}
          </section>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-700/50 px-6 py-4">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700 hover:text-gray-100 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
