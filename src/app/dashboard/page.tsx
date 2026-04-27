import KpiCards from '@/components/dashboard/KpiCards'
import AlertsSummary from '@/components/dashboard/AlertsSummary'
import WeeklyTrendChart from '@/components/dashboard/WeeklyTrendChart'
import TopVacancies from '@/components/dashboard/TopVacancies'

export default function DashboardPage() {
  return (
    <div className="space-y-6 p-7">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1c1917' }}>
          Resumen
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#78716c' }}>
          Vista general de indicadores clave de reclutamiento
        </p>
      </div>

      {/* KPI Cards */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span
            className="inline-block w-2 h-2 rounded-sm"
            style={{ background: '#1e4b9e' }}
          />
          <span className="text-sm font-bold" style={{ color: '#1e4b9e' }}>
            Indicadores clave
          </span>
          <span className="text-xs ml-1" style={{ color: '#a8a29e' }}>
            Datos en tiempo real
          </span>
        </div>
        <KpiCards />
      </section>

      {/* Charts + Alerts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Weekly Trend — 2 columns */}
        <div
          className="lg:col-span-2 rounded-xl p-0 overflow-hidden"
          style={{ background: '#ffffff', border: '1px solid #e7e2d8' }}
        >
          <WeeklyTrendChart />
        </div>

        {/* SLA Alerts — 1 column */}
        <div
          className="rounded-xl p-0 overflow-hidden"
          style={{ background: '#ffffff', border: '1px solid #e7e2d8' }}
        >
          <AlertsSummary />
        </div>
      </div>

      {/* Top Vacancies */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: '#ffffff', border: '1px solid #e7e2d8' }}
      >
        <TopVacancies />
      </div>
    </div>
  )
}
