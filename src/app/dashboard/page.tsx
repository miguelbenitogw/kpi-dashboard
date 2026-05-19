import { Suspense } from 'react'
import KpiCards from '@/components/dashboard/KpiCards'
import AlertsSummary from '@/components/dashboard/AlertsSummary'
import TopVacancies from '@/components/dashboard/TopVacancies'
import CvsPerVacancyChart from '@/components/dashboard/CvsPerVacancyChart'
import VacantesPrincipalesStrip from '@/components/resumen/VacantesPrincipalesStrip'
import PlacementPendingCards from '@/components/dashboard/PlacementPendingCards'
import EquipoHoyWidget from '@/components/resumen/EquipoHoyWidget'

export default function DashboardPage() {
  return (
    <div className="space-y-4 px-5 py-4">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1c1917' }}>
          Resumen
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#78716c' }}>
          Vista general de indicadores clave de reclutamiento
        </p>
      </div>

      {/* ¿Quién está hoy? */}
      <div style={{ background: '#f9f7f4', borderRadius: 14, padding: '16px 20px', border: '1px solid #e7e2d8' }}>
        <Suspense fallback={null}>
          <EquipoHoyWidget />
        </Suspense>
      </div>

      {/* Vacantes principales */}
      <div style={{ background: '#f9f7f4', borderRadius: 14, padding: '16px 20px', border: '1px solid #e7e2d8' }}>
        <Suspense fallback={null}>
          <VacantesPrincipalesStrip />
        </Suspense>
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

      {/* Placement pending — Norway + Germany */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span
            className="inline-block w-2 h-2 rounded-sm"
            style={{ background: '#b45309' }}
          />
          <span className="text-sm font-bold" style={{ color: '#b45309' }}>
            Colocación pendiente
          </span>
        </div>
        <PlacementPendingCards />
      </section>

      {/* CVs por vacante activa */}
      <div
        style={{
          borderRadius: 14,
          border: '1px solid #e7e2d8',
          background: '#ffffff',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(28,25,23,0.06)',
        }}
      >
        <CvsPerVacancyChart />
      </div>

      {/* SLA Alerts */}
      <div
        className="rounded-xl p-0 overflow-hidden"
        style={{ background: '#ffffff', border: '1px solid #e7e2d8' }}
      >
        <AlertsSummary />
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
