import ClosedVacanciesView from '@/components/atraccion/ClosedVacanciesView'

export default function VacantasCerradasPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Vacantes cerradas</h1>
        <p className="mt-1 text-sm text-gray-400">
          Historial de vacantes inactivas y distribución de etiquetas por año.
        </p>
      </div>
      <ClosedVacanciesView />
    </div>
  )
}
