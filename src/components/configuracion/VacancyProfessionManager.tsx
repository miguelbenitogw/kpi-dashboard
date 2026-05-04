'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  getVacanciesForProfessionConfig,
  updateVacancyTipoProfesional,
  type VacancyForConfig,
} from '@/lib/queries/atraccion'
import {
  type TipoProfesional,
  PROFESION_LABELS,
} from '@/lib/utils/vacancy-profession'

// ─── Paleta (sin gray-* de Tailwind) ──────────────────────────────────────────
const C = {
  bg: '#ffffff',
  border: '#e7e2d8',
  radius: 14,
  thBg: '#f7f4ef',
  thColor: '#78716c',
  rowEven: '#ffffff',
  rowOdd: '#faf8f5',
  rowDiff: '#fffbeb',
  selectBorder: '#e7e2d8',
  btnSave: { bg: '#1e4b9e', color: '#fff' },
  btnDisabled: { bg: '#f0ece4', color: '#a8a29e' },
  badgeActive: { bg: '#dcfce7', color: '#16a34a' },
  badgeInactive: { bg: '#f0ece4', color: '#78716c' },
  text: '#1c1917',
  subtle: '#78716c',
  subtler: '#a8a29e',
}

const ALL_TIPOS = Object.keys(PROFESION_LABELS) as TipoProfesional[]

type RowState = 'idle' | 'saving' | 'saved' | 'error'

export default function VacancyProfessionManager() {
  const [vacancies, setVacancies] = useState<VacancyForConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [onlyActive, setOnlyActive] = useState(true)
  const [search, setSearch] = useState('')
  // draft values per vacancy id
  const [drafts, setDrafts] = useState<Record<string, TipoProfesional>>({})
  // row-level save state
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getVacanciesForProfessionConfig().then((data) => {
      if (cancelled) return
      setVacancies(data)
      const init: Record<string, TipoProfesional> = {}
      for (const v of data) init[v.id] = v.tipoProfesionalDb
      setDrafts(init)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return vacancies.filter((v) => {
      if (onlyActive && !v.isActive) return false
      if (q && !v.title.toLowerCase().includes(q) && !v.shortId.includes(q)) return false
      return true
    })
  }, [vacancies, onlyActive, search])

  async function handleSave(v: VacancyForConfig) {
    const draft = drafts[v.id]
    if (!draft) return
    setRowStates((prev) => ({ ...prev, [v.id]: 'saving' }))
    const { error } = await updateVacancyTipoProfesional(v.id, draft)
    if (error) {
      setRowStates((prev) => ({ ...prev, [v.id]: 'error' }))
      setTimeout(() => setRowStates((prev) => ({ ...prev, [v.id]: 'idle' })), 3000)
      return
    }
    // update local cache
    setVacancies((prev) =>
      prev.map((item) =>
        item.id === v.id ? { ...item, tipoProfesionalDb: draft } : item,
      ),
    )
    setRowStates((prev) => ({ ...prev, [v.id]: 'saved' }))
    setTimeout(() => setRowStates((prev) => ({ ...prev, [v.id]: 'idle' })), 2000)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              height: 36,
              borderRadius: 8,
              background: '#f0ece4',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    )
  }

  const totalActive = vacancies.filter((v) => v.isActive).length
  const totalMismatch = vacancies.filter(
    (v) => v.tipoProfesionalDb !== v.tipoProfesionalRegex,
  ).length

  return (
    <div>
      {/* Sub-header */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: C.subtle }}>
          Asigná el tipo de profesional a cada vacante. El valor se persiste en la base de datos y se usa como fuente de verdad para los filtros.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: C.subtler }}>
            {vacancies.length} vacantes totales · {totalActive} activas
          </span>
          {totalMismatch > 0 && (
            <span
              style={{
                fontSize: 12,
                background: '#fef9c3',
                color: '#92400e',
                borderRadius: 99,
                padding: '1px 8px',
                border: '1px solid #fde68a',
              }}
            >
              {totalMismatch} con diferencia BD vs regex
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {/* Toggle activas */}
        <button
          type="button"
          onClick={() => setOnlyActive((v) => !v)}
          style={{
            fontSize: 12,
            borderRadius: 6,
            padding: '4px 12px',
            border: `1px solid ${C.border}`,
            background: onlyActive ? '#1e4b9e' : C.thBg,
            color: onlyActive ? '#fff' : C.subtle,
            cursor: 'pointer',
            fontWeight: 500,
            transition: 'all 0.15s',
          }}
        >
          {onlyActive ? 'Solo activas' : 'Todas'}
        </button>

        {/* Buscador */}
        <input
          type="text"
          placeholder="Buscar por título o ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            fontSize: 12,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: '4px 10px',
            color: C.text,
            background: '#fff',
            outline: 'none',
            width: 220,
          }}
        />

        <span style={{ fontSize: 12, color: C.subtler, marginLeft: 4 }}>
          {filtered.length} vacante{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabla */}
      <div
        style={{
          overflowX: 'auto',
          border: `1px solid ${C.border}`,
          borderRadius: 10,
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
          }}
        >
          <thead>
            <tr
              style={{
                background: C.thBg,
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <th
                style={{
                  padding: '7px 10px',
                  textAlign: 'left',
                  color: C.thColor,
                  fontSize: 11,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  width: 70,
                }}
              >
                ID corto
              </th>
              <th
                style={{
                  padding: '7px 10px',
                  textAlign: 'left',
                  color: C.thColor,
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                Vacante
              </th>
              <th
                style={{
                  padding: '7px 10px',
                  textAlign: 'center',
                  color: C.thColor,
                  fontSize: 11,
                  fontWeight: 500,
                  width: 70,
                }}
              >
                Activa
              </th>
              <th
                style={{
                  padding: '7px 10px',
                  textAlign: 'left',
                  color: C.thColor,
                  fontSize: 11,
                  fontWeight: 500,
                  width: 180,
                }}
              >
                Prof. BD
              </th>
              <th
                style={{
                  padding: '7px 10px',
                  textAlign: 'left',
                  color: C.thColor,
                  fontSize: 11,
                  fontWeight: 500,
                  width: 160,
                }}
              >
                Prof. Regex
              </th>
              <th
                style={{
                  padding: '7px 10px',
                  textAlign: 'center',
                  color: C.thColor,
                  fontSize: 11,
                  fontWeight: 500,
                  width: 90,
                }}
              >
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    color: C.subtler,
                    fontSize: 13,
                  }}
                >
                  Sin vacantes{search ? ' que coincidan con la búsqueda' : ''}
                </td>
              </tr>
            ) : (
              filtered.map((v, i) => {
                const draft = drafts[v.id] ?? v.tipoProfesionalDb
                const hasDiff = v.tipoProfesionalDb !== v.tipoProfesionalRegex
                const isDirty = draft !== v.tipoProfesionalDb
                const rowState = rowStates[v.id] ?? 'idle'
                const rowBg = hasDiff
                  ? C.rowDiff
                  : i % 2 === 0
                    ? C.rowEven
                    : C.rowOdd

                return (
                  <tr
                    key={v.id}
                    style={{
                      background: rowBg,
                      borderBottom: `1px solid ${C.border}`,
                    }}
                  >
                    {/* ID corto */}
                    <td
                      style={{
                        padding: '6px 10px',
                        fontFamily: 'monospace',
                        fontSize: 11,
                        color: C.subtler,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      …{v.shortId}
                    </td>

                    {/* Título */}
                    <td
                      style={{
                        padding: '6px 10px',
                        color: C.text,
                        maxWidth: 340,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={v.title}
                    >
                      {v.title}
                    </td>

                    {/* Activa */}
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      <span
                        style={{
                          background: v.isActive
                            ? C.badgeActive.bg
                            : C.badgeInactive.bg,
                          color: v.isActive
                            ? C.badgeActive.color
                            : C.badgeInactive.color,
                          borderRadius: 99,
                          fontSize: 10,
                          padding: '1px 6px',
                          fontWeight: 500,
                        }}
                      >
                        {v.isActive ? 'Sí' : 'No'}
                      </span>
                    </td>

                    {/* Prof. BD — select editable */}
                    <td style={{ padding: '6px 10px' }}>
                      <select
                        value={draft}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [v.id]: e.target.value as TipoProfesional,
                          }))
                        }
                        style={{
                          border: `1px solid ${isDirty ? '#1e4b9e' : C.selectBorder}`,
                          borderRadius: 6,
                          fontSize: 12,
                          padding: '3px 8px',
                          background: '#fff',
                          color: C.text,
                          outline: 'none',
                          width: '100%',
                          cursor: 'pointer',
                        }}
                      >
                        {ALL_TIPOS.map((t) => (
                          <option key={t} value={t}>
                            {PROFESION_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Prof. Regex — readonly badge */}
                    <td style={{ padding: '6px 10px' }}>
                      <span
                        style={{
                          background: '#f3f4f6',
                          color: '#374151',
                          border: '1px solid #e5e7eb',
                          borderRadius: 6,
                          fontSize: 11,
                          padding: '2px 8px',
                          display: 'inline-block',
                          maxWidth: 150,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={PROFESION_LABELS[v.tipoProfesionalRegex]}
                      >
                        {PROFESION_LABELS[v.tipoProfesionalRegex]}
                      </span>
                    </td>

                    {/* Acción */}
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      {rowState === 'saving' ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            color: C.subtler,
                          }}
                        >
                          <svg
                            style={{
                              width: 12,
                              height: 12,
                              animation: 'spin 1s linear infinite',
                            }}
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              style={{ opacity: 0.25 }}
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              style={{ opacity: 0.75 }}
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
                            />
                          </svg>
                        </span>
                      ) : rowState === 'saved' ? (
                        <span style={{ fontSize: 13, color: '#16a34a' }}>✓</span>
                      ) : rowState === 'error' ? (
                        <span style={{ fontSize: 13, color: '#dc2626' }}>✗</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSave(v)}
                          disabled={!isDirty}
                          style={{
                            background: isDirty
                              ? C.btnSave.bg
                              : C.btnDisabled.bg,
                            color: isDirty
                              ? C.btnSave.color
                              : C.btnDisabled.color,
                            border: 'none',
                            borderRadius: 6,
                            fontSize: 11,
                            padding: '3px 10px',
                            cursor: isDirty ? 'pointer' : 'not-allowed',
                            fontWeight: 500,
                            transition: 'all 0.15s',
                          }}
                        >
                          Guardar
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
