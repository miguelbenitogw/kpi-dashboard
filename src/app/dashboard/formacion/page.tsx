'use client'

import { useState } from 'react'
import { ChevronRight, ChevronLeft, Users } from 'lucide-react'
import FormacionLayout from '@/components/formacion/FormacionLayout'
import PromoVistaGeneral from '@/components/formacion/PromoVistaGeneral'
import CandidatosFormacionView from '@/components/formacion/CandidatosFormacionView'

export default function FormacionPage() {
  const [panel, setPanel] = useState<'main' | 'candidatos'>('main')

  return (
    <div style={{ overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          width: '200%',
          transform: panel === 'candidatos' ? 'translateX(-50%)' : 'translateX(0)',
          transition: 'transform 380ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* ── Panel principal — Formación ── */}
        <div style={{ width: '50%', minWidth: 0 }}>
          {/* Header row with "Ver candidatos" arrow */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <button
              onClick={() => setPanel('candidatos')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid #e7e2d8',
                background: '#ffffff',
                color: '#1e4b9e',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 150ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f5f1ea')}
              onMouseLeave={e => (e.currentTarget.style.background = '#ffffff')}
            >
              <Users size={14} />
              Ver candidatos
              <ChevronRight size={14} />
            </button>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e7e2d8',
              borderRadius: '14px',
              padding: '18px',
            }}
          >
            <FormacionLayout />
          </div>

          <div
            style={{
              marginTop: '16px',
              background: '#ffffff',
              border: '1px solid #e7e2d8',
              borderRadius: '14px',
              padding: '18px',
            }}
          >
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

        {/* ── Panel secundario — Candidatos ── */}
        <div style={{ width: '50%', minWidth: 0 }}>
          {/* Back button */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <button
              onClick={() => setPanel('main')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid #e7e2d8',
                background: '#ffffff',
                color: '#57534e',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 150ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f5f1ea')}
              onMouseLeave={e => (e.currentTarget.style.background = '#ffffff')}
            >
              <ChevronLeft size={14} />
              Volver a Formación
            </button>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e7e2d8',
              borderRadius: '14px',
              padding: '18px',
            }}
          >
            <div style={{ marginBottom: '16px' }}>
              <h1 style={{ fontSize: '1rem', fontWeight: 600, color: '#1c1917' }}>Candidatos</h1>
              <p style={{ marginTop: '4px', fontSize: '13px', color: '#78716c' }}>
                Estado de colocación y preferencias de los candidatos en formación.
              </p>
            </div>
            {panel === 'candidatos' && <CandidatosFormacionView />}
          </div>
        </div>
      </div>
    </div>
  )
}
