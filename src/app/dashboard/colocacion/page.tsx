'use client'

import { useState, useEffect } from 'react'
import GPColocacionView from '@/components/colocacion/GPColocacionView'
import GPCandidateTable from '@/components/colocacion/GPCandidateTable'
import { getGPPromotions, type PromoGPSummary } from '@/lib/queries/colocacion'

export default function ColocacionPage() {
  const [promos, setPromos]             = useState<PromoGPSummary[]>([])
  const [selectedPromo, setSelectedPromo] = useState('')

  useEffect(() => {
    getGPPromotions().then(setPromos)
  }, [])

  return (
    <div className="space-y-8 pb-10">

      {/* ── Heading ── */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1c1917' }}>Colocación</h1>
        <p className="mt-1 text-sm" style={{ color: '#78716c' }}>
          Global Placement — seguimiento de candidatos noruegos: readiness, solicitudes y estado de colocación.
        </p>
      </div>

      {/* ── Promo selector (shared between both sections) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <label style={{ fontSize: 13, color: '#78716c', fontWeight: 500 }}>Promoción:</label>
        <select
          value={selectedPromo}
          onChange={(e) => setSelectedPromo(e.target.value)}
          style={{
            padding: '6px 12px',
            fontSize: 13,
            border: '1px solid #e7e2d8',
            borderRadius: 8,
            background: '#fff',
            color: '#1c1917',
            outline: 'none',
          }}
        >
          <option value="">Todas ({promos.reduce((s, p) => s + p.count, 0)})</option>
          {promos.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name} ({p.count})
            </option>
          ))}
        </select>
      </div>

      {/* ── Readiness table ── */}
      <section>
        <div style={{ marginBottom: 12 }}>
          <h2 className="text-base font-semibold" style={{ color: '#1c1917' }}>
            Candidatos Global Placement
          </h2>
          <p className="text-sm" style={{ color: '#78716c', marginTop: 2 }}>
            Readiness por candidato: HPR, Webcruiter, solicitudes, CV Norsk y más.
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
          <GPCandidateTable promoFilter={selectedPromo} />
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
