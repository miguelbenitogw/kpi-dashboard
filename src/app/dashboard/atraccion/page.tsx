'use client'

import VacancyRecruitmentTable from '@/components/atraccion/VacancyRecruitmentTable'
import ConversionRates from '@/components/atraccion/ConversionRates'
import WeeklyCVChart from '@/components/atraccion/WeeklyCVChart'
import AttractionTrafficLights from '@/components/atraccion/AttractionTrafficLights'
import CharlasSummary from '@/components/atraccion/CharlasSummary'

export default function AtraccionPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Atracción</h1>
        <p className="mt-1 text-sm text-gray-400">
          Indicadores de reclutamiento, selección e instituciones (Cuadro de
          Mando GW · columnas A–AL).
        </p>
      </div>

      {/* Vacantes activas × estados — tabla principal */}
      <VacancyRecruitmentTable />

      {/* AF3-AG3: Tasas de conversión */}
      <ConversionRates />

      {/* V4: Weekly CV bar chart + AL3: Semáforos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WeeklyCVChart />
        </div>
        <div>
          <AttractionTrafficLights />
        </div>
      </div>

      {/* I3-J3-K3-S3: Charlas y Webinars */}
      <CharlasSummary />
    </div>
  )
}
