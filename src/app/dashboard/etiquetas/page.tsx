import EtiquetasView from '@/components/etiquetas/EtiquetasView'

export default function EtiquetasPage() {
  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Etiquetas Candidatos</h1>
        <p className="mt-1 text-sm text-gray-400">
          Distribución de candidatos por etiqueta y estado. Las etiquetas provienen de Zoho Recruit.
        </p>
      </div>
      <div className="mt-8">
        <EtiquetasView />
      </div>
    </div>
  )
}
