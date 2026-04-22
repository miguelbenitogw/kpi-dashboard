import PromoEdicionHub from '@/components/formacion/PromoEdicionHub'

export const metadata = {
  title: 'Edición Promos | KPI Dashboard',
}

export default function PromoSheetsPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Edición de Promociones</h1>
        <p className="mt-1 text-sm text-gray-400">
          Editá los metadatos, vacantes vinculadas y sheets de Google de cada promoción desde un único lugar.
        </p>
      </div>
      <PromoEdicionHub />
    </div>
  )
}
