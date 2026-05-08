'use client'

import { useState, useEffect } from 'react'
import GPColocacionView from '@/components/colocacion/GPColocacionView'
import GPPreferenciaView from '@/components/colocacion/GPPreferenciaView'
import GPStatusView     from '@/components/colocacion/GPStatusView'
import GPKommunerTab    from '@/components/colocacion/GPKommunerTab'
import GPAgenciasTab    from '@/components/colocacion/GPAgenciasTab'
import { getGPAvailableYears } from '@/lib/queries/colocacion'

type Tab = 'kommuner' | 'agencias' | 'overview'

const TABS: { id: Tab; label: string }[] = [
  { id: 'kommuner',  label: 'Kommuner' },
  { id: 'agencias',  label: 'Agencias' },
  { id: 'overview',  label: 'Vista general' },
]

// ── Year pill ─────────────────────────────────────────────────────────────────

function YearPills({
  years,
  selected,
  onChange,
}: {
  years: number[]
  selected: number
  onChange: (y: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 12, color: '#78716c', fontWeight: 500, marginRight: 2 }}>
        Excel Madre
      </span>
      {years.map((y) => {
        const active = selected === y
        return (
          <button
            key={y}
            onClick={() => onChange(y)}
            style={{
              borderRadius: 99,
              padding: '4px 14px',
              fontSize: 12,
              fontWeight: active ? 700 : 500,
              border: active ? '1px solid #0e7490' : '1px solid #e7e2d8',
              background: active ? '#ecfeff' : '#fff',
              color: active ? '#0e7490' : '#78716c',
              cursor: 'pointer',
              transition: 'all 120ms',
            }}
          >
            {y}
          </button>
        )
      })}
    </div>
  )
}

// ── Tab switcher ──────────────────────────────────────────────────────────────

function TabBar({
  active,
  onChange,
}: {
  active: Tab
  onChange: (t: Tab) => void
}) {
  return (
    <div style={{
      display: 'flex',
      gap: 2,
      background: '#f5f5f4',
      borderRadius: 10,
      padding: 4,
      width: 'fit-content',
    }}>
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          style={{
            padding: '6px 16px',
            borderRadius: 7,
            border: 'none',
            fontSize: 13,
            fontWeight: active === id ? 600 : 500,
            background: active === id ? '#fff' : 'transparent',
            color: active === id ? '#1c1917' : '#78716c',
            cursor: 'pointer',
            boxShadow: active === id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 100ms',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ColocacionPage() {
  const [years,       setYears]       = useState<number[]>([])
  const [selectedYear, setYear]       = useState<number>(0)
  const [activeTab,   setActiveTab]   = useState<Tab>('kommuner')

  useEffect(() => {
    getGPAvailableYears().then((ys) => {
      setYears(ys)
      if (ys.length > 0) setYear(ys[ys.length - 1]) // default → latest year
    })
  }, [])

  return (
    <div className="space-y-8 pb-10">

      {/* ── Top bar: year pills + tabs ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        <TabBar active={activeTab} onChange={setActiveTab} />
        {years.length > 0 && selectedYear > 0 && (
          <YearPills years={years} selected={selectedYear} onChange={setYear} />
        )}
      </div>

      {/* ── Tab content ── */}
      {activeTab === 'kommuner' && selectedYear > 0 && (
        <section>
          <div style={{ marginBottom: 12 }}>
            <h2 className="text-base font-semibold" style={{ color: '#1c1917' }}>
              Kommuner · {selectedYear}
            </h2>
            <p className="text-sm" style={{ color: '#78716c', marginTop: 2 }}>
              Candidatos colocados en municipios noruegos — Excel Madre {selectedYear}.
            </p>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e7e2d8', borderRadius: 14, padding: 18 }}>
            <GPKommunerTab year={selectedYear} />
          </div>
        </section>
      )}

      {activeTab === 'agencias' && selectedYear > 0 && (
        <section>
          <div style={{ marginBottom: 12 }}>
            <h2 className="text-base font-semibold" style={{ color: '#1c1917' }}>
              Agencias · {selectedYear}
            </h2>
            <p className="text-sm" style={{ color: '#78716c', marginTop: 2 }}>
              Candidatos colocados en agencias Vikar — Excel Madre {selectedYear}.
            </p>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e7e2d8', borderRadius: 14, padding: 18 }}>
            <GPAgenciasTab year={selectedYear} />
          </div>
        </section>
      )}

      {activeTab === 'overview' && (
        <>
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
                <GPPreferenciaView promoFilter="" />
              </div>
              <div style={{ background: '#ffffff', border: '1px solid #e7e2d8', borderRadius: 14, padding: 18 }}>
                <GPStatusView promoFilter="" />
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
            <div style={{ background: '#ffffff', border: '1px solid #e7e2d8', borderRadius: 14, padding: 18 }}>
              <GPColocacionView externalPromo={''} />
            </div>
          </section>
        </>
      )}

    </div>
  )
}
