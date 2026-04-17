import { Wallet, FileSpreadsheet } from 'lucide-react'

export default function CostesPage() {
  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Costes / Margen</h1>
        <p className="mt-1 text-sm text-gray-400">
          Costes desglosados por categoría por proyecto y margen. (Cuadro de
          Mando GW · columna BY)
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-surface-700/60 bg-surface-850/60 p-8">
        <div className="mx-auto max-w-lg text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-500/15 text-accent-400">
            <Wallet className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-gray-100">
            Sección diferida
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            La sección de Costes depende de un Google Sheet manual que todavía
            no está integrado. Cuando el cliente proporcione la fuente,
            crearemos la tabla{' '}
            <code className="rounded bg-surface-800 px-1.5 py-0.5 text-xs text-brand-300">
              project_costs
            </code>{' '}
            con categorías: personal, publicidad, portales, zoom, training,
            otros.
          </p>

          <div className="mt-6 rounded-lg border border-surface-700/60 bg-surface-900 p-4 text-left">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
              <div>
                <p className="text-sm font-medium text-gray-200">
                  Qué se va a mostrar acá
                </p>
                <ul className="mt-2 space-y-1 text-xs text-gray-400">
                  <li>• Costes totales por proyecto y por categoría</li>
                  <li>• Margen bruto por promoción</li>
                  <li>• Comparativa de costes vs objetivo</li>
                  <li>• Evolución mensual de gasto</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
