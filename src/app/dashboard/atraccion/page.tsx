import ConversionRates from '@/components/atraccion/ConversionRates'
import WeeklyCVChart from '@/components/atraccion/WeeklyCVChart'
import AttractionTrafficLights from '@/components/atraccion/AttractionTrafficLights'
import CharlasSummary from '@/components/atraccion/CharlasSummary'
import VacancyRecruitmentTable from '@/components/atraccion/VacancyRecruitmentTable'
import VacancyStatusCharts from '@/components/atraccion/VacancyStatusCharts'

export default function AtraccionPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Reclutamiento</h1>
        <p className="mt-1 text-sm text-gray-400">
          Indicadores de reclutamiento, selección e instituciones.
        </p>
      </div>

      <ConversionRates />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><WeeklyCVChart /></div>
        <div><AttractionTrafficLights /></div>
      </div>

      <CharlasSummary />

      <VacancyStatusCharts />

      <VacancyRecruitmentTable />
    </div>
  )
}
