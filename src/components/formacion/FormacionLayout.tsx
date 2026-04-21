'use client'

import { useState } from 'react'
import RetentionOverview from './RetentionOverview'
import FormacionGraficos from './FormacionGraficos'
import DropoutAnalysis from './DropoutAnalysis'

/**
 * Manages promotion multi-select state and passes it down to all Formación charts.
 * Empty selectedPromos = "all" (no filter applied).
 */
export default function FormacionLayout() {
  const [selectedPromos, setSelectedPromos] = useState<string[]>([])

  function togglePromo(nombre: string) {
    setSelectedPromos((prev) =>
      prev.includes(nombre)
        ? prev.filter((n) => n !== nombre)
        : [...prev, nombre],
    )
  }

  function selectAll() {
    setSelectedPromos([])
  }

  const activeFilter = selectedPromos.length > 0 ? selectedPromos : undefined

  return (
    <>
      <RetentionOverview
        selectedPromos={selectedPromos}
        onToggle={togglePromo}
        onSelectAll={selectAll}
      />

      <div className="mt-6">
        <FormacionGraficos promoNombres={activeFilter} />
      </div>

      <div className="mt-6">
        <DropoutAnalysis promoNombres={activeFilter} />
      </div>
    </>
  )
}
