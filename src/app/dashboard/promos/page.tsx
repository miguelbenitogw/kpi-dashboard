'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import PromoCard from '@/components/promos/PromoCard'
import PromoDetail from '@/components/promos/PromoDetail'
import RealtimeIndicator from '@/components/promos/RealtimeIndicator'
import {
  getActivePromos,
  getPromoCandidates,
  getPromoStatusBreakdown,
  subscribeToAllPromoChanges,
} from '@/lib/queries/promos'
import type { JobOpening, Candidate } from '@/lib/supabase/types'
import type { PromoStatusCount } from '@/lib/queries/promos'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface PromoData {
  candidates: Candidate[]
  breakdown: PromoStatusCount[]
  lastActivity: Date | null
}

export default function PromosPage() {
  const [promos, setPromos] = useState<JobOpening[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [promoData, setPromoData] = useState<Record<string, PromoData>>({})
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [lastRealtimeUpdate, setLastRealtimeUpdate] = useState<Date | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Load all active promos and their breakdowns
  const loadPromos = useCallback(async () => {
    try {
      const promoList = await getActivePromos()
      setPromos(promoList)

      // Load breakdowns for all promos in parallel
      const breakdowns = await Promise.all(
        promoList.map(async (p) => {
          const breakdown = await getPromoStatusBreakdown(p.id)
          return { id: p.id, breakdown }
        })
      )

      const dataMap: Record<string, PromoData> = {}
      for (const { id, breakdown } of breakdowns) {
        dataMap[id] = {
          candidates: [],
          breakdown,
          lastActivity: null,
        }
      }
      setPromoData(dataMap)

      return promoList
    } catch (err) {
      console.error('Error loading promos:', err)
      return []
    }
  }, [])

  // Load detailed data for selected promo
  const loadPromoDetail = useCallback(async (id: string) => {
    setLoadingDetail(true)
    try {
      const [candidates, breakdown] = await Promise.all([
        getPromoCandidates(id),
        getPromoStatusBreakdown(id),
      ])

      const lastMod = candidates.reduce<Date | null>((latest, c) => {
        if (!c.modified_time) return latest
        const d = new Date(c.modified_time)
        return !latest || d > latest ? d : latest
      }, null)

      setPromoData((prev) => ({
        ...prev,
        [id]: { candidates, breakdown, lastActivity: lastMod },
      }))
    } catch (err) {
      console.error('Error loading promo detail:', err)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    loadPromos().finally(() => setLoading(false))
  }, [loadPromos])

  // Subscribe to realtime changes
  useEffect(() => {
    if (promos.length === 0) return

    const promoIds = promos.map((p) => p.id)

    channelRef.current = subscribeToAllPromoChanges(promoIds, () => {
      setLastRealtimeUpdate(new Date())

      // Refresh breakdowns for all promos
      Promise.all(
        promoIds.map(async (id) => {
          const breakdown = await getPromoStatusBreakdown(id)
          return { id, breakdown }
        })
      ).then((results) => {
        setPromoData((prev) => {
          const next = { ...prev }
          for (const { id, breakdown } of results) {
            next[id] = { ...next[id], breakdown, lastActivity: new Date() }
          }
          return next
        })
      })

      // If a promo is selected, also refresh its candidates
      if (selectedId) {
        loadPromoDetail(selectedId)
      }
    })

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
    }
  }, [promos, selectedId, loadPromoDetail])

  // Load detail when selection changes
  useEffect(() => {
    if (selectedId) {
      loadPromoDetail(selectedId)
    }
  }, [selectedId, loadPromoDetail])

  const selectedPromo = promos.find((p) => p.id === selectedId)

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">
            Promociones Activas
          </h1>
          <p className="mt-1 text-gray-400">
            Seguimiento en tiempo real de estudiantes por promoción.
          </p>
        </div>
        <RealtimeIndicator lastUpdate={lastRealtimeUpdate} />
      </div>

      {promos.length === 0 ? (
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-12 text-center text-gray-500">
          No se encontraron promociones activas
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Promo cards grid */}
          <div className="space-y-4 lg:col-span-1">
            <h2 className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Promociones ({promos.length})
            </h2>
            <div className="space-y-3">
              {promos.map((p) => (
                <PromoCard
                  key={p.id}
                  promo={p}
                  statusBreakdown={promoData[p.id]?.breakdown ?? []}
                  lastActivity={promoData[p.id]?.lastActivity ?? null}
                  isSelected={selectedId === p.id}
                  onSelect={setSelectedId}
                />
              ))}
            </div>
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2">
            {loadingDetail ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              </div>
            ) : selectedPromo && promoData[selectedId!] ? (
              <PromoDetail
                promo={selectedPromo}
                candidates={promoData[selectedId!].candidates}
                statusBreakdown={promoData[selectedId!].breakdown}
              />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-xl border border-gray-700/50 bg-gray-800/50 text-gray-500">
                Seleccioná una promoción para ver el detalle
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
