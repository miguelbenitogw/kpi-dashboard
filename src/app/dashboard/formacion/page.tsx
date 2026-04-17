import RetentionOverview from '@/components/formacion/RetentionOverview'
import FormacionStates from '@/components/formacion/FormacionStates'
import DropoutAnalysis from '@/components/formacion/DropoutAnalysis'

export default function FormacionPage() {
  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Formacion</h1>
        <p className="mt-1 text-sm text-gray-400">
          Estado de las promociones, retencion y analisis de abandonos.
        </p>
      </div>

      <div className="mt-8">
        <RetentionOverview />
      </div>

      <div className="mt-6">
        <FormacionStates />
      </div>

      <div className="mt-6">
        <DropoutAnalysis />
      </div>
    </div>
  )
}
