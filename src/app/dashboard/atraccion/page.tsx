'use client'

import { useState } from 'react'
import PromoRecruitmentTable from '@/components/atraccion/PromoRecruitmentTable'
import ConversionRates from '@/components/atraccion/ConversionRates'
import WeeklyCVChart from '@/components/atraccion/WeeklyCVChart'
import AttractionTrafficLights from '@/components/atraccion/AttractionTrafficLights'
import CharlasSummary from '@/components/atraccion/CharlasSummary'
import AtraccionVacanciesList from '@/components/atraccion/AtraccionVacanciesList'
import RRSSOverview from '@/components/atraccion/RRSSOverview'

type Tab = 'candidatos' | 'vacantes' | 'rrss'

function CandidatosTab() {
  return (
    <>
      {/* Main: promos activas × estados */}
      <div className="mt-8">
        <PromoRecruitmentTable />
      </div>

      {/* AF3-AG3: Conversion rates */}
      <div className="mt-6">
        <ConversionRates />
      </div>

      {/* V4: Weekly CV bar chart + AL3: Traffic lights */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WeeklyCVChart />
        </div>
        <div>
          <AttractionTrafficLights />
        </div>
      </div>

      {/* I3-J3-K3-S3: Charlas y Webinars (Instituciones) */}
      <div className="mt-6">
        <CharlasSummary />
      </div>
    </>
  )
}

function VacantesTab() {
  return <AtraccionVacanciesList />
}

function RRSSTab() {
  return <RRSSOverview />
}

export default function AtraccionPage() {
  const [activeTab, setActiveTab] = useState<Tab>('candidatos')

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Atracción</h1>
        <p className="mt-1 text-sm text-gray-400">
          Indicadores de reclutamiento, selección e instituciones (Cuadro de
          Mando GW · columnas A–AL).
        </p>
      </div>

      {/* Tab switcher */}
      <div className="mt-6 flex w-fit gap-1 rounded-lg bg-gray-800/50 p-1">
        <button
          onClick={() => setActiveTab('candidatos')}
          className={[
            'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
            activeTab === 'candidatos'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200',
          ].join(' ')}
        >
          Candidatos
        </button>
        <button
          onClick={() => setActiveTab('vacantes')}
          className={[
            'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
            activeTab === 'vacantes'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200',
          ].join(' ')}
        >
          Vacantes Activas
        </button>
        <button
          onClick={() => setActiveTab('rrss')}
          className={[
            'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
            activeTab === 'rrss'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200',
          ].join(' ')}
        >
          RRSS
        </button>
      </div>

      {activeTab === 'candidatos' && <CandidatosTab />}
      {activeTab === 'vacantes' && <VacantesTab />}
      {activeTab === 'rrss' && <RRSSTab />}
    </div>
  )
}
