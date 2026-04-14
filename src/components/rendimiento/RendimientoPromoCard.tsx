'use client'

import type { PromoSummaryCard } from '@/lib/queries/performance'

interface RendimientoPromoCardProps {
  promo: PromoSummaryCard
  isSelected: boolean
  isChecked: boolean
  onSelect: (promocion: string) => void
  onToggleCheck: (promocion: string) => void
}

export default function RendimientoPromoCard({
  promo,
  isSelected,
  isChecked,
  onSelect,
  onToggleCheck,
}: RendimientoPromoCardProps) {
  return (
    <div
      className={`group relative cursor-pointer rounded-xl border p-4 transition-all duration-200 ${
        isSelected
          ? 'border-blue-500/60 bg-blue-500/10 ring-2 ring-blue-500/30'
          : 'border-gray-700/50 bg-gray-800/50 hover:border-gray-600/50 hover:bg-gray-800/80'
      }`}
      onClick={() => onSelect(promo.promocion)}
    >
      {/* Checkbox */}
      <div className="absolute top-3 right-3">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => {
            e.stopPropagation()
            onToggleCheck(promo.promocion)
          }}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500/30 focus:ring-offset-0"
        />
      </div>

      {/* Promo name */}
      <h3 className="pr-8 text-sm font-semibold text-gray-100 truncate">
        {promo.promocion}
      </h3>

      {/* Coordinator */}
      {promo.coordinador && (
        <p className="mt-0.5 text-xs text-gray-500 truncate">
          {promo.coordinador}
        </p>
      )}

      {/* Total students */}
      <p className="mt-2 text-2xl font-bold tabular-nums text-gray-200">
        {promo.total}
        <span className="ml-1.5 text-xs font-normal text-gray-500">estudiantes</span>
      </p>

      {/* Quick status counts */}
      <div className="mt-3 flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="tabular-nums text-green-400">{promo.hiredCount}</span>
          <span className="text-gray-500">hired</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span className="tabular-nums text-red-400">{promo.dropoutCount}</span>
          <span className="text-gray-500">bajas</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          <span className="tabular-nums text-blue-400">{promo.activeCount}</span>
          <span className="text-gray-500">activos</span>
        </span>
      </div>

      {/* Mini status bar */}
      {promo.total > 0 && (
        <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-gray-700/40">
          {promo.hiredCount > 0 && (
            <div
              className="h-full bg-green-500"
              style={{ width: `${(promo.hiredCount / promo.total) * 100}%` }}
            />
          )}
          {promo.activeCount > 0 && (
            <div
              className="h-full bg-blue-500"
              style={{ width: `${(promo.activeCount / promo.total) * 100}%` }}
            />
          )}
          {promo.dropoutCount > 0 && (
            <div
              className="h-full bg-red-500"
              style={{ width: `${(promo.dropoutCount / promo.total) * 100}%` }}
            />
          )}
        </div>
      )}
    </div>
  )
}
