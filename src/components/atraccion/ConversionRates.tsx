'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, UserCheck } from 'lucide-react'
import KpiCard from '@/components/dashboard/KpiCard'
import {
  getConversionRates,
  type ConversionRates as ConversionRatesType,
} from '@/lib/queries/atraccion'

function rateStatus(rate: number): 'good' | 'warning' | 'danger' {
  if (rate >= 15) return 'good'
  if (rate >= 8) return 'warning'
  return 'danger'
}

export default function ConversionRates() {
  const [rates, setRates] = useState<ConversionRatesType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const data = await getConversionRates()
      setRates(data)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="h-[120px] animate-pulse rounded-xl border border-gray-700/50 bg-gray-800/50"
          />
        ))}
      </div>
    )
  }

  if (!rates) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6 text-center">
        <p className="text-sm text-gray-400">Sin datos de conversión disponibles</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-gray-100">
        Tasas de Conversión
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard
          title="% Conversión vs CVs"
          value={`${rates.cvToApproved.toLocaleString('es-AR')}%`}
          icon={TrendingUp}
          status={rateStatus(rates.cvToApproved)}
        />
        <KpiCard
          title="% Conversión vs Contactados"
          value={`${rates.contactedToApproved.toLocaleString('es-AR')}%`}
          icon={UserCheck}
          status={rateStatus(rates.contactedToApproved)}
        />
      </div>
    </div>
  )
}
