import AtraccionCarousel from '@/components/atraccion/AtraccionCarousel'

export default function AtraccionPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Reclutamiento</h1>
        <p className="mt-1 text-sm text-gray-400">
          Indicadores de reclutamiento, selección e instituciones.
        </p>
      </div>
      <AtraccionCarousel />
    </div>
  )
}
