import GPColocacionView from '@/components/colocacion/GPColocacionView'

export default function FormacionCandidatosPage() {
  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Candidatos</h1>
        <p className="mt-1 text-sm text-gray-400">
          Estado de colocación y preferencias de los candidatos en formación.
        </p>
      </div>
      <div className="mt-8">
        <GPColocacionView />
      </div>
    </div>
  )
}
