import GPColocacionView from '@/components/colocacion/GPColocacionView'
import BillingPlaceholder from '@/components/colocacion/BillingPlaceholder'
import CostsPlaceholder from '@/components/colocacion/CostsPlaceholder'

export default function FormacionCandidatosPage() {
  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Candidatos</h1>
        <p className="mt-1 text-sm text-gray-400">
          Estado de colocación y preferencias de los candidatos en formación.
        </p>
      </div>

      {/* GP Status + Open To — expandable tables */}
      <div className="mt-8">
        <GPColocacionView />
      </div>

      {/* Placeholders */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <BillingPlaceholder />
        <CostsPlaceholder />
      </div>
    </div>
  )
}
