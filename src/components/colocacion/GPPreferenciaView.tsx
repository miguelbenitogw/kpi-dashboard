'use client'

import { useState, useEffect } from 'react'
import {
  getGPPreferenciaBreakdown, type GPPreferenciaCount,
  getGPPreferenciaCombinations, type GPPreferenciaCombination,
} from '@/lib/queries/colocacion'

const PREF_COLORS: Record<string, string> = {
  'Kommuner': '#1e4b9e',
  'Vikar and Kommuner': '#0e7490',
  'Only Vikar': '#0891b2',
  'Training + Kommuner Fast': '#7c3aed',
  'Training + Vikar': '#6d28d9',
  'No feedback': '#9ca3af',
}

const PREF_DEFINITIONS: { label: string; description: string }[] = [
  { label: 'Kommuner', description: 'Trabajo directo con municipios noruegos' },
  { label: 'Vikar and Kommuner', description: 'Abierto a agencias de trabajo temporal y municipios' },
  { label: 'Only Vikar', description: 'Prefiere agencias de trabajo temporal' },
  { label: 'Training + Vikar', description: 'Formación complementaria + agencia temporal' },
  { label: 'Training + Kommuner Fast', description: 'Formación complementaria + contrato directo con municipio' },
  { label: 'No feedback', description: 'No ha indicado preferencia' },
]

function getColor(preference: string): string {
  return PREF_COLORS[preference] ?? '#64748b'
}

interface Props {
  promoFilter: string
  year?: number | null
}

export default function GPPreferenciaView({ promoFilter, year }: Props) {
  const [data, setData] = useState<GPPreferenciaCount[]>([])
  const [combinations, setCombinations] = useState<GPPreferenciaCombination[]>([])
  const [loading, setLoading] = useState(true)
  const [showDefs, setShowDefs] = useState(false)
  const [showCombos, setShowCombos] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getGPPreferenciaBreakdown(promoFilter || null, year),
      getGPPreferenciaCombinations(promoFilter || null, year),
    ]).then(([breakdown, combos]) => {
      setData(breakdown)
      setCombinations(combos)
      setLoading(false)
    })
  }, [promoFilter, year])

  const maxCount = data.length > 0 ? data[0].count : 1

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1c1917', margin: 0 }}>
            Preferencia de destino
          </h3>
          <p style={{ fontSize: 12, color: '#78716c', marginTop: 2 }}>
            Distribución por preferencia declarada (gp_open_to).
          </p>
        </div>
        <button
          onClick={() => setShowDefs((v) => !v)}
          style={{
            fontSize: 13,
            color: '#78716c',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: 4,
            lineHeight: 1,
          }}
          title="Ver definiciones"
        >
          ⓘ
        </button>
      </div>

      <p style={{ fontSize: 11, color: '#a8a29e', marginBottom: 12 }}>
        Un candidato puede tener múltiples preferencias.
      </p>

      {/* Definitions panel */}
      {showDefs && (
        <div
          style={{
            background: '#faf9f7',
            border: '1px solid #e7e2d8',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 14,
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 600, color: '#1c1917', marginBottom: 8 }}>
            Definiciones
          </p>
          <dl style={{ margin: 0 }}>
            {PREF_DEFINITIONS.map((d) => (
              <div key={d.label} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                <dt style={{ fontSize: 11, fontWeight: 600, color: getColor(d.label), minWidth: 170 }}>
                  {d.label}
                </dt>
                <dd style={{ fontSize: 11, color: '#78716c', margin: 0 }}>
                  {d.description}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Bars */}
      {loading ? (
        <div style={{ fontSize: 13, color: '#a8a29e', textAlign: 'center', padding: '20px 0' }}>
          Cargando…
        </div>
      ) : data.length === 0 ? (
        <div style={{ fontSize: 13, color: '#a8a29e', textAlign: 'center', padding: '20px 0' }}>
          Sin datos para este filtro.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.map((item) => {
              const color = getColor(item.preference)
              const barWidth = Math.round((item.count / maxCount) * 100)
              return (
                <div key={item.preference}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, color: '#1c1917', fontWeight: 500 }}>
                      {item.preference}
                    </span>
                    <span style={{ fontSize: 12, color: '#78716c', whiteSpace: 'nowrap', marginLeft: 8 }}>
                      {item.count} &nbsp;
                      <span style={{ color: '#a8a29e' }}>{item.percentage}%</span>
                    </span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: '#f5f1ea', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${barWidth}%`, borderRadius: 4, background: color, transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Combinations section */}
          {combinations.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <button
                onClick={() => setShowCombos((v) => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0',
                  borderTop: '1px solid #e7e2d8',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: '#78716c' }}>
                  Agrupación por combinación de etiquetas
                  <span style={{ fontWeight: 400, marginLeft: 6 }}>· {combinations.length} grupos</span>
                </span>
                <span style={{ fontSize: 14, color: '#a8a29e', transform: showCombos ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>▾</span>
              </button>

              {showCombos && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                  {combinations.map((item) => {
                    const comboWidth = Math.round((item.count / (combinations[0]?.count ?? 1)) * 100)
                    return (
                      <div key={item.combination}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flex: 1 }}>
                            {item.tags.map((tag) => (
                              <span key={tag} style={{
                                display: 'inline-block', padding: '1px 7px', borderRadius: 99,
                                fontSize: 10, fontWeight: 500, background: `${getColor(tag)}18`,
                                color: getColor(tag), border: `1px solid ${getColor(tag)}30`,
                                whiteSpace: 'nowrap',
                              }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                          <span style={{ fontSize: 12, color: '#78716c', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            <strong style={{ color: '#1c1917' }}>{item.count}</strong>
                            <span style={{ color: '#a8a29e', marginLeft: 4 }}>{item.percentage}%</span>
                          </span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: '#f5f1ea', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${comboWidth}%`, borderRadius: 3, background: '#94a3b8', transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
