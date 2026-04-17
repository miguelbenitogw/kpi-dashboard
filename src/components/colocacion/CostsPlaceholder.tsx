import { Calculator } from 'lucide-react'

export default function CostsPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-700/50 bg-gray-800/30 p-8 text-center">
      <Calculator className="h-10 w-10 text-gray-600" />
      <h3 className="mt-3 text-sm font-semibold text-gray-400">
        Costes/Margen — Próximamente
      </h3>
      <p className="mt-1 text-xs text-gray-500">
        Pendiente de definición de categorías y fuente de datos
      </p>
    </div>
  )
}
