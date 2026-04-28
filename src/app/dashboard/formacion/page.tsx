'use client'

import { useState } from 'react'
import { ChevronRight, ChevronLeft, Users } from 'lucide-react'
import RetentionOverview from '@/components/formacion/RetentionOverview'
import FormacionGraficos from '@/components/formacion/FormacionGraficos'
import PromoVistaGeneral from '@/components/formacion/PromoVistaGeneral'
import CandidatosFormacionView from '@/components/formacion/CandidatosFormacionView'

export default function FormacionPage() {
  const [selectedPromos, setSelectedPromos] = useState<string[]>([])
  const [panel, setPanel] = useState<'main' | 'candidatos'>('main')

  const hasSelection = selectedPromos.length > 0
  const activeFilter = hasSelection ? selectedPromos : undefined

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
