'use client'

import { useState, useEffect } from 'react'
import { ChevronRight, ChevronLeft, Users } from 'lucide-react'
import RetentionOverview from '@/components/formacion/RetentionOverview'
import FormacionGraficos from '@/components/formacion/FormacionGraficos'
import PromoVistaGeneral from '@/components/formacion/PromoVistaGeneral'
import CandidatosFormacionView from '@/components/formacion/CandidatosFormacionView'
import PromoVacancyDistributionChart from '@/components/formacion/PromoVacancyDistributionChart'
import PromoVacancyLinksManager from '@/components/formacion/PromoVacancyLinksManager'
import { getIntentosStats } from '@/lib/queries/formacion'

type IntentosStats = {
  total: number
  primera_vez: number
  traslado_directo: number
  traslado: number
  retornado: number
  max_intentos: number
  candidato_record: string | null
}

export default function FormacionPage() {
  const [selectedPromos, setSelectedPromos] = useState<string[]>([])
  const [panel, setPanel] = useState<'main' | 'candidatos'>('main')
  const [intentosStats, setIntentosStats] = useState<IntentosStats | null>(null)

  const hasSelection = selectedPromos.length > 0
  const activeFilter = hasSelection ? selectedPromos : undefined

  // Load trayectoria stats when a single promo is selected
  useEffect(() => {
    if (selectedPromos.length !== 1) {
      setIntentosStats(null)
      return
    }
    getIntentosStats(selectedPromos[0]).then(setIntentosStats)
  }, [selectedPromos])

  function togglePromo(nombre: string) {
    setSelectedPromos(prev =>
      prev.includes(nombre) ? prev.filter(n => n !== nombre) : [...prev, nombre]
    )
  }

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e7e2d8',
        borderRadius: '14px',
        padding: '18px',
        overflow: 'hidden',
      }}
    >
      {/* ── Header: siempre visible ── */}
      <RetentionOverview
        selectedPromos={selectedPromos}
        onToggle={togglePromo}
        onSelectAll={() => setSelectedPromos([])}
      />

      {/* ── Nav strip: aparece solo cuando hay promo seleccionada ── */}
      <div
        style={{
          marginTop: '16px',
          display: 'flex',
          justifyContent: 'flex-end',
          height: hasSelection ? '36px' : '0px',
          overflow: 'hidden',
          transition: 'height 250ms ease',
        }}
      >
        <button
          onClick={() => setPanel(p => p === 'main' ? 'candidatos' : 'main')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '8px',
            border: '1px solid #e7e2d8',
            background: panel === 'candidatos' ? '#f5f1ea' : '#ffffff',
            color: '#1e4b9e',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 150ms',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f5f1ea')}
          onMouseLeave={e => {
            e.currentTarget.style.background = panel === 'candidatos' ? '#f5f1ea' : '#ffffff'
          }}
        >
          {panel === 'candidatos'
            ? <><ChevronLeft size={14} />Formación</>
            : <><Users size={14} />Ver candidatos<ChevronRight size={14} /></>
          }
        </button>
      </div>

      {/* ── Contenido deslizante ── */}
      <div style={{ marginTop: '20px', overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            width: '200%',
            transform: panel === 'candidatos' ? 'translateX(-50%)' : 'translateX(0)',
            transition: 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Panel principal — Formación */}
          <div style={{ width: '50%', minWidth: 0 }}>
            <FormacionGraficos promoNombres={activeFilter} />

            {hasSelection && (
              <div style={{ marginTop: '24px' }}>
                <PromoVacancyDistributionChart promoNombre={selectedPromos[0]} />
              </div>
            )}

            {/* Vacancy classification: wire formación/atracción links per promo */}
            {hasSelection && (
              <div style={{ marginTop: '24px' }}>
                <PromoVacancyLinksManager promoNombre={selectedPromos[0]} />
              </div>
            )}

            {/* Trayectoria de candidatos — shown only when a single promo is selected */}
            {intentosStats && (
              <div style={{ marginTop: '24px' }}>
                <h2
                  style={{
                    marginBottom: '12px',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: '#1c1917',
                  }}
                >
                  Trayectoria de candidatos
                </h2>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: '12px',
                  }}
                >
                  {/* Primera vez */}
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e7e2d8',
                      borderRadius: '10px',
                      padding: '14px 16px',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '11px', color: '#78716c', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Primera vez
                    </p>
                    <p style={{ margin: '6px 0 2px', fontSize: '1.5rem', fontWeight: 700, color: '#1c1917', lineHeight: 1 }}>
                      {intentosStats.primera_vez}
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#a8a29e' }}>
                      {intentosStats.total > 0
                        ? `${Math.round((intentosStats.primera_vez / intentosStats.total) * 100)}%`
                        : '—'}
                    </p>
                  </div>

                  {/* Traslados directos */}
                  <div
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '10px',
                      padding: '14px 16px',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '11px', color: '#15803d', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Traslado directo
                    </p>
                    <p style={{ margin: '6px 0 2px', fontSize: '1.5rem', fontWeight: 700, color: '#166534', lineHeight: 1 }}>
                      {intentosStats.traslado_directo}
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#4ade80' }}>
                      {intentosStats.total > 0
                        ? `${Math.round((intentosStats.traslado_directo / intentosStats.total) * 100)}%`
                        : '—'}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#86efac' }}>≤ 90 días</p>
                  </div>

                  {/* Traslados */}
                  <div
                    style={{
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '10px',
                      padding: '14px 16px',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '11px', color: '#1d4ed8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Traslados
                    </p>
                    <p style={{ margin: '6px 0 2px', fontSize: '1.5rem', fontWeight: 700, color: '#1e40af', lineHeight: 1 }}>
                      {intentosStats.traslado}
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#3b82f6' }}>
                      {intentosStats.total > 0
                        ? `${Math.round((intentosStats.traslado / intentosStats.total) * 100)}%`
                        : '—'}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#93c5fd' }}>91–365 días</p>
                  </div>

                  {/* Retornados */}
                  <div
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: '10px',
                      padding: '14px 16px',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '11px', color: '#b45309', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Retornados
                    </p>
                    <p style={{ margin: '6px 0 2px', fontSize: '1.5rem', fontWeight: 700, color: '#92400e', lineHeight: 1 }}>
                      {intentosStats.retornado}
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#d97706' }}>
                      {intentosStats.total > 0
                        ? `${Math.round((intentosStats.retornado / intentosStats.total) * 100)}%`
                        : '—'}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#fcd34d' }}>&gt; 12 meses</p>
                  </div>

                  {/* Récord */}
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e7e2d8',
                      borderRadius: '10px',
                      padding: '14px 16px',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '11px', color: '#78716c', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Récord
                    </p>
                    <p style={{ margin: '6px 0 2px', fontSize: '1.5rem', fontWeight: 700, color: '#1e4b9e', lineHeight: 1 }}>
                      {intentosStats.max_intentos}
                      <span style={{ fontSize: '12px', fontWeight: 400, color: '#78716c', marginLeft: '4px' }}>intentos</span>
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '11px',
                        color: '#a8a29e',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={intentosStats.candidato_record ?? ''}
                    >
                      {intentosStats.candidato_record ?? '—'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: '24px' }}>
              <h2
                style={{
                  marginBottom: '16px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: '#1c1917',
                }}
              >
                Vista General por Promoción
              </h2>
              <PromoVistaGeneral />
            </div>
          </div>

          {/* Panel candidatos */}
          <div style={{ width: '50%', minWidth: 0, paddingLeft: '20px' }}>
            <h2
              style={{
                marginBottom: '4px',
                fontSize: '1rem',
                fontWeight: 600,
                color: '#1c1917',
              }}
            >
              Candidatos
            </h2>
            <p style={{ marginBottom: '16px', fontSize: '13px', color: '#78716c' }}>
              Estado de colocación y preferencias de los candidatos en formación.
            </p>
            {panel === 'candidatos' && (
              <CandidatosFormacionView initialPromo={selectedPromos[0] ?? null} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
