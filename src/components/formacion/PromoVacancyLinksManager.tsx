'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trash2, Plus, Link2 } from 'lucide-react'
import {
  getPromoVacancyLinks,
  addPromoVacancyLink,
  removePromoVacancyLink,
  getUnlinkedAtraccionVacancies,
  PromoVacancyLink,
} from '@/lib/queries/atraccion'

interface Props {
  promoNombre: string
}

export default function PromoVacancyLinksManager({ promoNombre }: Props) {
  const [links, setLinks] = useState<PromoVacancyLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Link picker state
  const [showPicker, setShowPicker] = useState(false)
  const [unlinked, setUnlinked] = useState<{ id: string; title: string }[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedVacancyId, setSelectedVacancyId] = useState('')
  const [selectedTipo, setSelectedTipo] = useState<'atraccion' | 'formacion'>('atraccion')
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  const loadLinks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getPromoVacancyLinks(promoNombre)
      setLinks(data)
    } catch {
      setError('Error al cargar las vacantes vinculadas.')
    } finally {
      setLoading(false)
    }
  }, [promoNombre])

  useEffect(() => {
    loadLinks()
  }, [loadLinks])

  async function openPicker() {
    setShowPicker(true)
    setPickerLoading(true)
    setSearch('')
    setSelectedVacancyId('')
    setSelectedTipo('atraccion')
    setLinkError(null)
    try {
      const data = await getUnlinkedAtraccionVacancies(promoNombre)
      setUnlinked(data)
    } catch {
      setLinkError('Error al cargar las vacantes disponibles.')
    } finally {
      setPickerLoading(false)
    }
  }

  function closePicker() {
    setShowPicker(false)
    setLinkError(null)
  }

  async function handleLink() {
    if (!selectedVacancyId) return
    setLinking(true)
    setLinkError(null)

    const vacancy = unlinked.find((v) => v.id === selectedVacancyId)

    // Optimistic add
    const optimisticLink: PromoVacancyLink = {
      id: `optimistic-${Date.now()}`,
      promo_nombre: promoNombre,
      vacancy_id: selectedVacancyId,
      vacancy_title: vacancy?.title ?? null,
      tipo: selectedTipo,
      created_at: new Date().toISOString(),
    }
    setLinks((prev) => [optimisticLink, ...prev])
    setUnlinked((prev) => prev.filter((v) => v.id !== selectedVacancyId))
    closePicker()

    const result = await addPromoVacancyLink(promoNombre, selectedVacancyId, selectedTipo)

    if (!result.success) {
      // Roll back optimistic update
      setLinks((prev) => prev.filter((l) => l.id !== optimisticLink.id))
      setUnlinked((prev) => [...prev, { id: selectedVacancyId, title: vacancy?.title ?? selectedVacancyId }])
      setLinkError(result.error ?? 'Error al vincular la vacante.')
      setShowPicker(true)
    } else {
      // Reload to get the real id from the server
      loadLinks()
    }

    setLinking(false)
  }

  async function handleRemove(linkId: string) {
    // Optimistic remove
    const removed = links.find((l) => l.id === linkId)
    setLinks((prev) => prev.filter((l) => l.id !== linkId))

    const result = await removePromoVacancyLink(linkId)
    if (!result.success && removed) {
      // Roll back
      setLinks((prev) => [removed, ...prev])
    }
  }

  const filteredUnlinked = unlinked.filter((v) =>
    v.title.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e7e2d8',
        borderRadius: '14px',
        padding: '18px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link2 size={16} color="#1e4b9e" />
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#1c1917' }}>
            Vacantes asociadas
          </span>
        </div>
        <button
          onClick={openPicker}
          disabled={showPicker || linking}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '5px 12px',
            borderRadius: '8px',
            border: '1px solid #1e4b9e',
            background: '#1e4b9e',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            opacity: showPicker || linking ? 0.6 : 1,
            transition: 'opacity 150ms',
          }}
        >
          <Plus size={12} />
          Vincular vacante
        </button>
      </div>

      {/* Inline picker panel */}
      {showPicker && (
        <div
          style={{
            background: '#f5f1ea',
            border: '1px solid #e7e2d8',
            borderRadius: '10px',
            padding: '14px',
            marginBottom: '14px',
          }}
        >
          {pickerLoading ? (
            <p style={{ fontSize: '13px', color: '#78716c', margin: 0 }}>Cargando vacantes...</p>
          ) : (
            <>
              {/* Search filter */}
              <input
                type="text"
                placeholder="Buscar vacante..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '7px',
                  border: '1px solid #e7e2d8',
                  background: '#ffffff',
                  fontSize: '13px',
                  color: '#1c1917',
                  outline: 'none',
                  boxSizing: 'border-box',
                  marginBottom: '10px',
                }}
              />

              {/* Vacancy select */}
              <select
                value={selectedVacancyId}
                onChange={(e) => setSelectedVacancyId(e.target.value)}
                size={Math.min(6, Math.max(3, filteredUnlinked.length))}
                style={{
                  width: '100%',
                  borderRadius: '7px',
                  border: '1px solid #e7e2d8',
                  background: '#ffffff',
                  fontSize: '13px',
                  color: '#1c1917',
                  padding: '4px',
                  marginBottom: '10px',
                  boxSizing: 'border-box',
                }}
              >
                <option value="" disabled>
                  — Seleccionar vacante —
                </option>
                {filteredUnlinked.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title}
                  </option>
                ))}
              </select>

              {filteredUnlinked.length === 0 && !pickerLoading && (
                <p style={{ fontSize: '12px', color: '#78716c', marginBottom: '10px' }}>
                  No hay vacantes de atracción disponibles para vincular.
                </p>
              )}

              {/* Tipo toggle */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', color: '#78716c', alignSelf: 'center' }}>Tipo:</span>
                {(['atraccion', 'formacion'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTipo(t)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: selectedTipo === t ? '#1e4b9e' : '#e7e2d8',
                      background: selectedTipo === t ? '#1e4b9e' : '#ffffff',
                      color: selectedTipo === t ? '#ffffff' : '#1c1917',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 150ms',
                      textTransform: 'capitalize',
                    }}
                  >
                    {t === 'atraccion' ? 'Atracción' : 'Formación'}
                  </button>
                ))}
              </div>

              {linkError && (
                <p style={{ fontSize: '12px', color: '#dc2626', marginBottom: '8px' }}>
                  {linkError}
                </p>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleLink}
                  disabled={!selectedVacancyId || linking}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '7px',
                    border: 'none',
                    background: '#1e4b9e',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: selectedVacancyId && !linking ? 'pointer' : 'not-allowed',
                    opacity: selectedVacancyId && !linking ? 1 : 0.5,
                  }}
                >
                  {linking ? 'Vinculando...' : 'Vincular'}
                </button>
                <button
                  onClick={closePicker}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '7px',
                    border: '1px solid #e7e2d8',
                    background: '#ffffff',
                    color: '#1c1917',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Links list */}
      {loading ? (
        <p style={{ fontSize: '13px', color: '#78716c', margin: 0 }}>Cargando...</p>
      ) : error ? (
        <p style={{ fontSize: '13px', color: '#dc2626', margin: 0 }}>{error}</p>
      ) : links.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#78716c', margin: 0 }}>
          Sin vacantes vinculadas — vincular para asociar procesos de Zoho.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {links.map((link) => (
            <li
              key={link.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 12px',
                borderRadius: '9px',
                border: '1px solid #e7e2d8',
                background: '#fafaf9',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <span
                  style={{
                    padding: '2px 9px',
                    borderRadius: '99px',
                    fontSize: '11px',
                    fontWeight: 600,
                    flexShrink: 0,
                    background: link.tipo === 'atraccion' ? '#dbeafe' : '#ede9fe',
                    color: link.tipo === 'atraccion' ? '#1e4b9e' : '#6d28d9',
                  }}
                >
                  {link.tipo === 'atraccion' ? 'Atracción' : 'Formación'}
                </span>
                <span
                  style={{
                    fontSize: '13px',
                    color: '#1c1917',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {link.vacancy_title ?? link.vacancy_id}
                </span>
              </div>
              <button
                onClick={() => handleRemove(link.id)}
                aria-label="Eliminar vínculo"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: '1px solid #e7e2d8',
                  background: '#ffffff',
                  color: '#78716c',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'color 150ms, border-color 150ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#dc2626'
                  e.currentTarget.style.borderColor = '#fca5a5'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#78716c'
                  e.currentTarget.style.borderColor = '#e7e2d8'
                }}
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
