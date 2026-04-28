import DropoutsView from '@/components/formacion/abandonos/DropoutsView'

export const metadata = { title: 'Análisis de Abandonos | KPI Dashboard' }

export default function AbandonosPage() {
  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1c1917' }}>Análisis de Abandonos</h1>
        <p className="mt-1 text-sm" style={{ color: '#78716c' }}>
          Explorá causas, patrones y perfiles de los candidatos que abandonaron el programa.
        </p>
      </div>
      <DropoutsView />
    </div>
  )
}
