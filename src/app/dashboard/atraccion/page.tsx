'use client'

import { useState } from 'react'
import ConversionRates from '@/components/atraccion/ConversionRates'
import WeeklyCVChart from '@/components/atraccion/WeeklyCVChart'
import AttractionTrafficLights from '@/components/atraccion/AttractionTrafficLights'
import CharlasSummary from '@/components/atraccion/CharlasSummary'
import VacancyRecruitmentTable from '@/components/atraccion/VacancyRecruitmentTable'
import VacancyStatusCharts from '@/components/atraccion/VacancyStatusCharts'
import ReceivedCvsByVacancyView from '@/components/atraccion/ReceivedCvsByVacancyView'
import CvsResumenCard from '@/components/atraccion/CvsResumenCard'
import ClosedVacancyCvsView from '@/components/atraccion/ClosedVacancyCvsView'

type Tab = 'resumen' | 'vacantes' | 'cvs' | 'cerradas'

const TABS: { id: Tab; label: string }[] = [
  { id: 'resumen',   label: 'Resumen' },
  { id: 'vacantes',  label: 'Vacantes' },
  { id: 'cvs',       label: 'CVs recibidos' },
  { id: 'cerradas',  label: 'CVs cerradas' },
]

export default function AtraccionPage() {
  const [tab, setTab] = useState<Tab>('resumen')

  return (
    <div className="space-y-4">
      {/* Heading */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1c1917', letterSpacing: '-0.01em', margin: 0 }}>
          Atracción
        </h1>
        <p style={{ fontSize: 13, color: '#78716c', marginTop: 4 }}>
          Vacantes activas, pipeline y conversión inicial
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e7e2d8' }}>
        {TABS.map(({ id, label }) => {
          const active = tab === id
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                color: active ? '#1e4b9e' : '#78716c',
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${active ? '#1e4b9e' : 'transparent'}`,
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

      {/* ─── RESUMEN ─── */}
      {tab === 'resumen' && (
        <div className="space-y-4">
          {/* CVs recibidos — números grandes arriba */}
          <CvsResumenCard />

          {/* Tasas de conversión */}
          <ConversionRates />

          {/* WeeklyCVChart + Semáforos */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <WeeklyCVChart />
            </div>
            <div>
              <AttractionTrafficLights />
            </div>
          </div>

          {/* Charlas */}
          <CharlasSummary />
        </div>
      )}

      {/* ─── VACANTES ─── */}
      {tab === 'vacantes' && (
        <div className="space-y-4">
          <VacancyStatusCharts />
          <VacancyRecruitmentTable />
        </div>
      )}

      {/* ─── CVS RECIBIDOS ─── */}
      {tab === 'cvs' && (
        <ReceivedCvsByVacancyView />
      )}

      {/* ─── CVS CERRADAS ─── */}
      {tab === 'cerradas' && (
        <ClosedVacancyCvsView />
      )}
    </div>
  )
}
