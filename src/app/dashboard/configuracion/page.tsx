import Link from 'next/link'
import ConfiguracionClient from './ConfiguracionClient'
import VacancyProfessionManagerWrapper from '@/components/configuracion/VacancyProfessionManagerWrapper'
import KpiQualityDocs from '@/components/configuracion/KpiQualityDocs'
import SyncAllButton from '@/components/configuracion/SyncAllButton'
import DropoutSheetsManager from '@/components/configuracion/DropoutSheetsManager'

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
          <h2 className="text-lg font-semibold" style={{ color: '#1c1917' }}>Sincronización manual</h2>
          <p className="mt-0.5 text-sm" style={{ color: '#78716c' }}>
            Lanza el pipeline completo de sync: Excel Madre (Base Datos + Resumen), todas las promo sheets y el Global Placement de Noruega.
            El cron diario lo corre automáticamente a las 06:00 UTC.
          </p>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e7e2d8', borderRadius: 14, padding: 20 }}>
          <SyncAllButton />
        </div>
      </section>

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
          <h2 className="text-lg font-semibold" style={{ color: '#1c1917' }}>Excels de Abandonos</h2>
          <p className="mt-0.5 text-sm" style={{ color: '#78716c' }}>
            Registrá los Google Sheets que contienen datos de abandonos por promoción.
            Cada sheet se puede sincronizar de forma independiente desde el panel de Sincronización manual.
          </p>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e7e2d8', borderRadius: 14, padding: 20, overflow: 'hidden' }}>
          <DropoutSheetsManager />
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

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#1c1917' }}>Profesión por vacante</h2>
          <p className="mt-0.5 text-sm" style={{ color: '#78716c' }}>
            Asigná el tipo de profesional a cada vacante. Las filas en amarillo tienen diferencia entre el valor guardado en BD y el que derivaría la regex automática.
          </p>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e7e2d8', borderRadius: 14, padding: 20, overflow: 'hidden' }}>
          <VacancyProfessionManagerWrapper />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#1c1917' }}>KPIs de calidad de atracción</h2>
          <p className="mt-0.5 text-sm" style={{ color: '#78716c' }}>
            Documentación de referencia sobre cómo se calculan los ratios de éxito real y descarte por vacante.
          </p>
        </div>
        <KpiQualityDocs />
      </section>
    </div>
  )
}
