'use client'

import { useState } from 'react'
import ConversionRates from '@/components/atraccion/ConversionRates'
import WeeklyCVChart from '@/components/atraccion/WeeklyCVChart'
import AttractionTrafficLights from '@/components/atraccion/AttractionTrafficLights'
import CharlasSummary from '@/components/atraccion/CharlasSummary'
import VacancyRecruitmentTable from '@/components/atraccion/VacancyRecruitmentTable'
import VacancyStatusCharts from '@/components/atraccion/VacancyStatusCharts'
import CvsResumenCard from '@/components/atraccion/CvsResumenCard'

type Tab = 'resumen' | 'vacantes' | 'canales'

const TABS: { id: Tab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'vacantes', label: 'Vacantes' },
  { id: 'canales', label: 'CVs & Canales' },
]

export default function AtraccionPage() {
  const [tab, setTab] = useState<Tab>('resumen')

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: '#1c1917',
            letterSpacing: '-0.01em',
            margin: 0,
          }}
        >
          Atracción
        </h1>
        <p style={{ fontSize: 13, color: '#78716c', marginTop: 4 }}>
          Vacantes activas, pipeline y conversión inicial
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e7e2d8', gap: 0 }}>
        {TABS.map(({ id, label }) => {
          const isActive = tab === id
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                padding: '10px 18px',
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#1e4b9e' : '#78716c',
                borderBottom: isActive ? '2px solid #1e4b9e' : '2px solid transparent',
                background: 'none',
                border: 'none',
                borderBottomWidth: 2,
                borderBottomStyle: 'solid',
                borderBottomColor: isActive ? '#1e4b9e' : 'transparent',
                cursor: 'pointer',
                marginBottom: -1,
                lineHeight: 1,
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'resumen' && (
        <div className="space-y-6">
          <ConversionRates />
          <AttractionTrafficLights />
          <CvsResumenCard />
        </div>
      )}

      {tab === 'vacantes' && (
        <div className="space-y-6">
          <VacancyRecruitmentTable />
          <VacancyStatusCharts />
        </div>
      )}

      {tab === 'canales' && (
        <div className="space-y-6">
          <WeeklyCVChart />
          <CharlasSummary />
        </div>
      )}
    </div>
  )
}
