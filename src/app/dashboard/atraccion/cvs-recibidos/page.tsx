import ReceivedCvsByVacancyView from '@/components/atraccion/ReceivedCvsByVacancyView'

export default function ReceivedCvsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">CVs recibidos</h1>
        <p className="mt-1 text-sm text-gray-400">
          Ranking semanal por vacante y evolución histórica de CVs nuevos.
        </p>
      </div>

      <ReceivedCvsByVacancyView />
    </div>
  )
}