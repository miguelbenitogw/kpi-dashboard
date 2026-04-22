import PromoSheetsManager from '@/components/formacion/PromoSheetsManager'

export const metadata = {
  title: 'Promos Sheets | KPI Dashboard',
}

export default function PromoSheetsPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Gestión de Sheets por Promo</h1>
        <p className="mt-1 text-sm text-gray-400">
          Vinculá Google Sheets de dropout a cada promoción para sincronizar datos automáticamente.
        </p>
      </div>
      <PromoSheetsManager />
    </div>
  )
}
