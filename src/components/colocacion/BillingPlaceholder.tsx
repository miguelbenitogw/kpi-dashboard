import { Receipt } from 'lucide-react'

export default function BillingPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-700/50 bg-gray-800/30 p-8 text-center">
      <Receipt className="h-10 w-10 text-gray-600" />
      <h3 className="mt-3 text-sm font-semibold text-gray-400">
        Facturación — Próximamente
      </h3>
      <p className="mt-1 text-xs text-gray-500">
        Pendiente de integración con Google Sheet de facturación
      </p>
    </div>
  )
}
