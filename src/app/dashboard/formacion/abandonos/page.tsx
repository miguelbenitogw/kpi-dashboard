import DropoutsView from '@/components/formacion/abandonos/DropoutsView'

export const metadata = { title: 'Análisis de Abandonos | KPI Dashboard' }

export default function AbandonosPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Análisis de Abandonos</h1>
        <p className="mt-1 text-sm text-gray-400">
          Explorá causas, patrones y perfiles de los candidatos que abandonaron el programa.
        </p>
      </div>
      <DropoutsView />
    </div>
  )
}
