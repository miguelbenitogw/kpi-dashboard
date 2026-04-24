import dynamic from 'next/dynamic'
import Link from 'next/link'

const MadreSheetsManager = dynamic(
  () => import('@/components/configuracion/MadreSheetsManager'),
  { ssr: false }
)

const SlaThresholdsManager = dynamic(
  () => import('@/components/configuracion/SlaThresholdsManager'),
  { ssr: false }
)

export const metadata = {
  title: 'Configuración | KPI Dashboard',
}

export default function ConfiguracionPage() {
  return (
    <div className="space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Configuración</h1>
        <p className="mt-1 text-sm text-gray-400">
          Gestioná las fuentes de datos y los umbrales del sistema.
        </p>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Datos & Excels</h2>
          <p className="mt-0.5 text-sm text-gray-400">
            Registrá y sincronizá los Excels Madre que alimentan el dashboard.{' '}
            Para gestionar los sheets por promo, visitá la sección{' '}
            <Link
              href="/dashboard/formacion/sheets"
              className="text-blue-400 hover:text-blue-300 hover:underline"
            >
              Edición Promos
            </Link>
            .
          </p>
        </div>
        <MadreSheetsManager />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Alertas & Umbrales SLA</h2>
          <p className="mt-0.5 text-sm text-gray-400">
            Configurá los días de espera que activan alertas amarillas y rojas para cada estado del pipeline.
          </p>
        </div>
        <SlaThresholdsManager />
      </section>
    </div>
  )
}
