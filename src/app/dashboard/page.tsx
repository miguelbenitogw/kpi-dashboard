import KpiCards from '@/components/dashboard/KpiCards'
import AlertsSummary from '@/components/dashboard/AlertsSummary'
import WeeklyTrendChart from '@/components/dashboard/WeeklyTrendChart'
import TopVacancies from '@/components/dashboard/TopVacancies'

export default function DashboardPage() {
  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Resumen Ejecutivo</h1>
        <p className="mt-1 text-sm text-gray-400">
          Vista general de indicadores clave de reclutamiento.
        </p>
      </div>

      {/* KPI Cards Row */}
      <div className="mt-8">
        <KpiCards />
      </div>

      {/* Charts + Alerts Grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Weekly Trend - takes 2 columns */}
        <div className="lg:col-span-2">
          <WeeklyTrendChart />
        </div>

        {/* SLA Alerts - takes 1 column */}
        <div>
          <AlertsSummary />
        </div>
      </div>

      {/* Top Vacancies */}
      <div className="mt-6">
        <TopVacancies />
      </div>
    </div>
  )
}
