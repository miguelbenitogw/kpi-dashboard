import PlacementPreference from '@/components/colocacion/PlacementPreference'
import PlacementStatus from '@/components/colocacion/PlacementStatus'
import PlacementClients from '@/components/colocacion/PlacementClients'
import BillingPlaceholder from '@/components/colocacion/BillingPlaceholder'
import CostsPlaceholder from '@/components/colocacion/CostsPlaceholder'

export default function ColocacionPage() {
  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Colocación</h1>
        <p className="mt-1 text-sm text-gray-400">
          Preferencia, status de placement y facturación por proyecto.
        </p>
      </div>

      {/* Preference donut + Status bar */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PlacementPreference />
        <PlacementStatus />
      </div>

      {/* Clients */}
      <div className="mt-6">
        <PlacementClients />
      </div>

      {/* Placeholders */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <BillingPlaceholder />
        <CostsPlaceholder />
      </div>
    </div>
  )
}
