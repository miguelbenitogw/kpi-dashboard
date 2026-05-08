'use client'

import { useState, useEffect } from 'react'
import GPColocacionView from '@/components/colocacion/GPColocacionView'
import GPPreferenciaView from '@/components/colocacion/GPPreferenciaView'
import GPStatusView from '@/components/colocacion/GPStatusView'
import { getGPPromotions, type PromoGPSummary } from '@/lib/queries/colocacion'

export default function ColocacionPage() {
  const [promos, setPromos]               = useState<PromoGPSummary[]>([])
  const [selectedPromo, setSelectedPromo] = useState('')

  useEffect(() => {
    getGPPromotions().then(setPromos)
  }, [])

  return (
    <div className="space-y-8 pb-10">

      {/* ── Promo pill selector ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => setSelectedPromo('')}
          style={{
            borderRadius: 99,
            padding: '4px 12px',
            fontSize: 12,
            fontWeight: selectedPromo === '' ? 600 : 500,
            border: selectedPromo === '' ? '1px solid #1e4b9e' : '1px solid #e7e2d8',
            background: selectedPromo === '' ? '#eff6ff' : '#fff',
            color: selectedPromo === '' ? '#1e4b9e' : '#78716c',
            cursor: 'pointer',
            transition: 'all 120ms',
            whiteSpace: 'nowrap',
          }}
        >
          Todas
        </button>

        <span style={{ width: 1, height: 16, background: '#e7e2d8', flexShrink: 0 }} />

        {promos.map((p) => {
          const active = selectedPromo === p.name
          return (
            <button
              key={p.name}
              onClick={() => setSelectedPromo(active ? '' : p.name)}
              style={{
                borderRadius: 99,
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: active ? 600 : 500,
                border: active ? '1px solid #1e4b9e' : '1px solid #e7e2d8',
                background: active ? '#eff6ff' : '#fff',
                color: active ? '#1e4b9e' : '#78716c',
                cursor: 'pointer',
                transition: 'all 120ms',
                whiteSpace: 'nowrap',
              }}
            >
              {p.name}
              <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.7 }}>
                {p.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Preferencia y estado de colocación ── */}
      <section>
        <div style={{ marginBottom: 12 }}>
          <h2 className="text-base font-semibold" style={{ color: '#1c1917' }}>
            Preferencias y estado de colocación
          </h2>
          <p className="text-sm" style={{ color: '#78716c', marginTop: 2 }}>
            Distribución por preferencia de destino y estado actual del proceso de placement.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div style={{ background: '#ffffff', border: '1px solid #e7e2d8', borderRadius: 14, padding: 18 }}>
            <GPPreferenciaView promoFilter={selectedPromo} />
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e7e2d8', borderRadius: 14, padding: 18 }}>
            <GPStatusView promoFilter={selectedPromo} />
          </div>
        </div>
      </section>

      {/* ── Estado + Open To breakdown ── */}
      <section>
        <div style={{ marginBottom: 12 }}>
          <h2 className="text-base font-semibold" style={{ color: '#1c1917' }}>
            Distribución por estado y preferencias
          </h2>
          <p className="text-sm" style={{ color: '#78716c', marginTop: 2 }}>
            Desglose de candidatos por estado Zoho y preferencia de destino (Open To).
          </p>
        </div>
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e7e2d8',
            borderRadius: 14,
            padding: 18,
          }}
        >
          <GPColocacionView externalPromo={selectedPromo} />
        </div>
      </section>

    </div>
  )
}
