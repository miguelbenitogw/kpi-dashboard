import RecruitmentStatusGrid from '@/components/atraccion/RecruitmentStatusGrid'
import ConversionRates from '@/components/atraccion/ConversionRates'
import WeeklyCVChart from '@/components/atraccion/WeeklyCVChart'
import AttractionTrafficLights from '@/components/atraccion/AttractionTrafficLights'
import CharlasSummary from '@/components/atraccion/CharlasSummary'

export default function AtraccionPage() {
  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Atracción</h1>
        <p className="mt-1 text-sm text-gray-400">
          Indicadores de reclutamiento, selección e instituciones (Cuadro de
          Mando GW · columnas A–AL).
        </p>
      </div>

      {/* V3-AE3: Candidates by status */}
      <div className="mt-8">
        <RecruitmentStatusGrid />
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
    </div>
  )
}
