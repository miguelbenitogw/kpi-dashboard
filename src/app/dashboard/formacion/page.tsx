'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown, Users } from 'lucide-react'
import FormacionLayout from '@/components/formacion/FormacionLayout'
import PromoVistaGeneral from '@/components/formacion/PromoVistaGeneral'
import CandidatosFormacionView from '@/components/formacion/CandidatosFormacionView'

export default function FormacionPage() {
  const [panel, setPanel] = useState<'main' | 'candidatos'>('main')

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        height: 'calc(100dvh - 96px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '200%',
          transform: panel === 'candidatos' ? 'translateY(-50%)' : 'translateY(0)',
          transition: 'transform 420ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* ── Panel 1 — Formación ── */}
        <div
          style={{
            height: '50%',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            paddingBottom: '8px',
          }}
        >
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

          {/* ── Handle to open Candidatos ── */}
          <button
            onClick={() => setPanel('candidatos')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              padding: '10px',
              borderRadius: '12px',
              border: '1px dashed #c8bfb0',
              background: 'transparent',
              color: '#78716c',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 150ms, color 150ms, border-color 150ms',
              marginTop: 'auto',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#f5f1ea'
              e.currentTarget.style.color = '#1e4b9e'
              e.currentTarget.style.borderColor = '#1e4b9e'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#78716c'
              e.currentTarget.style.borderColor = '#c8bfb0'
            }}
          >
            <Users size={14} />
            Ver candidatos
            <ChevronDown size={14} />
          </button>
        </div>

        {/* ── Panel 2 — Candidatos ── */}
        <div
          style={{
            height: '50%',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            paddingBottom: '16px',
          }}
        >
          {/* Handle to go back */}
          <button
            onClick={() => setPanel('main')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              padding: '10px',
              borderRadius: '12px',
              border: '1px dashed #c8bfb0',
              background: 'transparent',
              color: '#78716c',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 150ms, color 150ms, border-color 150ms',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#f5f1ea'
              e.currentTarget.style.color = '#1e4b9e'
              e.currentTarget.style.borderColor = '#1e4b9e'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#78716c'
              e.currentTarget.style.borderColor = '#c8bfb0'
            }}
          >
            <ChevronUp size={14} />
            Volver a Formación
          </button>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e7e2d8',
              borderRadius: '14px',
              padding: '18px',
              flex: 1,
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
