import GPColocacionView from '@/components/colocacion/GPColocacionView'
import BillingPlaceholder from '@/components/colocacion/BillingPlaceholder'
import CostsPlaceholder from '@/components/colocacion/CostsPlaceholder'

export default function ColocacionPage() {
  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Colocación</h1>
        <p className="mt-1 text-sm text-gray-400">
          Status de training y preferencias de colocación por candidato.
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
