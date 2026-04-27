import Link from 'next/link'
import ConfiguracionClient from './ConfiguracionClient'

export const metadata = {
  title: 'Configuración | KPI Dashboard',
}

export default function ConfiguracionPage() {
  return (
    <div className="space-y-10 p-0">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1c1917' }}>Configuración</h1>
        <p className="mt-1 text-sm" style={{ color: '#78716c' }}>
          Gestioná las fuentes de datos y los umbrales del sistema.
        </p>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#1c1917' }}>Datos & Excels</h2>
          <p className="mt-0.5 text-sm" style={{ color: '#78716c' }}>
            Registrá y sincronizá los Excels Madre que alimentan el dashboard.{' '}
            Para gestionar los sheets por promo, visitá la sección{' '}
            <Link
              href="/dashboard/formacion/sheets"
              style={{ color: '#1e4b9e' }}
            >
              Edición Promos
            </Link>
            .
          </p>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e7e2d8', borderRadius: 14, padding: 20, overflow: 'hidden' }}>
          <ConfiguracionClient section="sheets" />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#1c1917' }}>Alertas & Umbrales SLA</h2>
          <p className="mt-0.5 text-sm" style={{ color: '#78716c' }}>
            Configurá los días de espera que activan alertas amarillas y rojas para cada estado del pipeline.
          </p>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e7e2d8', borderRadius: 14, padding: 20, overflow: 'hidden' }}>
          <ConfiguracionClient section="sla" />
        </div>
      </section>
    </div>
  )
}
