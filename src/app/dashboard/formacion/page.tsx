import FormacionLayout from '@/components/formacion/FormacionLayout'

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
        <FormacionLayout />
      </div>
    </div>
  )
}
