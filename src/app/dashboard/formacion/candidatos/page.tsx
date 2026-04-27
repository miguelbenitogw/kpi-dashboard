import CandidatosFormacionView from '@/components/formacion/CandidatosFormacionView'
import BillingPlaceholder from '@/components/colocacion/BillingPlaceholder'
import CostsPlaceholder from '@/components/colocacion/CostsPlaceholder'

export default function FormacionCandidatosPage() {
  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1c1917' }}>Candidatos</h1>
        <p className="mt-1 text-sm" style={{ color: '#78716c' }}>
          Estado de colocación y preferencias de los candidatos en formación.
        </p>
      </div>

      <div className="mt-8">
        <CandidatosFormacionView />
      </div>

      {/* Placeholders */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <BillingPlaceholder />
        <CostsPlaceholder />
      </div>
    </div>
  )
}
