'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import PromoCard from '@/components/promos/PromoCard'
import PromoDetail from '@/components/promos/PromoDetail'
import RealtimeIndicator from '@/components/promos/RealtimeIndicator'
import {
  getPromoSummary,
  getPromoTimeline,
  getPromoBreakdownFull,
  subscribeToAllPromoChanges,
} from '@/lib/queries/promos'
import type { JobOpening } from '@/lib/supabase/types'
import type { PromoStatusCount, PromoSummaryItem, CandidateWithHistory } from '@/lib/queries/promos'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface PromoData {
  candidates: CandidateWithHistory[]
  breakdown: PromoStatusCount[]
  lastActivity: Date | null
  lastSyncedAt: string | null
}

// Loading skeleton for promo cards
function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
      <div className="mb-3 h-4 w-3/4 rounded bg-gray-700/50" />
      <div className="mb-3 h-8 w-16 rounded bg-gray-700/50" />
      <div className="mb-3 h-2 w-full rounded-full bg-gray-700/50" />
      <div className="mb-3 h-2 w-full rounded-full bg-gray-700/50" />
      <div className="grid grid-cols-3 gap-2">
        <div className="h-10 rounded bg-gray-700/50" />
        <div className="h-10 rounded bg-gray-700/50" />
        <div className="h-10 rounded bg-gray-700/50" />
      </div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div>
        <div className="h-6 w-2/3 rounded bg-gray-700/50" />
        <div className="mt-2 h-4 w-1/2 rounded bg-gray-700/50" />
      </div>
      <div className="flex gap-1 rounded-lg bg-gray-800/80 p-1">
        <div className="h-8 flex-1 rounded-md bg-gray-700/50" />
        <div className="h-8 flex-1 rounded-md bg-gray-700/50" />
        <div className="h-8 flex-1 rounded-md bg-gray-700/50" />
      </div>
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
        <div className="mb-4 h-4 w-1/3 rounded bg-gray-700/50" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between">
                <div className="h-3 w-24 rounded bg-gray-700/50" />
                <div className="h-3 w-12 rounded bg-gray-700/50" />
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-700/50" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function PromosPage() {
  const [summaries, setSummaries] = useState<PromoSummaryItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [promoData, setPromoData] = useState<Record<string, PromoData>>({})
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [lastRealtimeUpdate, setLastRealtimeUpdate] = useState<Date | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const promos = summaries.map((s) => s.promo)

  // Load all active promos with their summary data
  const loadPromos = useCallback(async () => {
    try {
      const result = await getPromoSummary()
      setSummaries(result)

      // Build initial promoData from summaries
      const dataMap: Record<string, PromoData> = {}
      for (const item of result) {
        dataMap[item.promo.id] = {
          candidates: [],
          breakdown: item.breakdown.breakdown,
          lastActivity: item.lastActivity,
          lastSyncedAt: item.lastSyncedAt,
        }
      }
      setPromoData(dataMap)

      return result
    } catch (err) {
      console.error('Error loading promos:', err)
      return []
    }
  }, [])

  // Load detailed data for selected promo (with timeline/history)
  const loadPromoDetail = useCallback(async (id: string) => {
    setLoadingDetail(true)
    try {
      const [candidates, breakdownResult] = await Promise.all([
        getPromoTimeline(id),
        getPromoBreakdownFull(id),
      ])

      const lastMod = candidates.reduce<Date | null>((latest, c) => {
        if (!c.modified_time) return latest
        const d = new Date(c.modified_time)
        return !latest || d > latest ? d : latest
      }, null)

      let lastSync: string | null = null
      for (const c of candidates) {
        if (c.last_synced_at && (!lastSync || c.last_synced_at > lastSync)) {
          lastSync = c.last_synced_at
        }
      }

      setPromoData((prev) => ({
        ...prev,
        [id]: {
          candidates,
          breakdown: breakdownResult.breakdown,
          lastActivity: lastMod,
          lastSyncedAt: lastSync,
        },
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

      // Refresh all summaries
      getPromoSummary().then((result) => {
        setSummaries(result)
        setPromoData((prev) => {
          const next = { ...prev }
          for (const item of result) {
            next[item.promo.id] = {
              ...next[item.promo.id],
              breakdown: item.breakdown.breakdown,
              lastActivity: item.lastActivity,
              lastSyncedAt: item.lastSyncedAt,
            }
          }
          return next
        })
      }).catch(console.error)

      // If a promo is selected, also refresh its detail
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
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="h-7 w-56 animate-pulse rounded bg-gray-700/50" />
            <div className="mt-2 h-4 w-80 animate-pulse rounded bg-gray-700/50" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-1">
            <div className="h-4 w-32 animate-pulse rounded bg-gray-700/50" />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <div className="lg:col-span-2">
            <DetailSkeleton />
          </div>
        </div>
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
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="mt-4 text-lg font-medium text-gray-400">No hay promos activas</p>
          <p className="mt-1 text-sm text-gray-500">
            Las promociones aparecen cuando hay job openings activas con "promo" en el título.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Promo cards grid */}
          <div className="space-y-4 lg:col-span-1">
            <h2 className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Promociones ({promos.length})
            </h2>
            <div className="space-y-3">
              {summaries.map((item) => (
                <PromoCard
                  key={item.promo.id}
                  promo={item.promo}
                  statusBreakdown={promoData[item.promo.id]?.breakdown ?? item.breakdown.breakdown}
                  lastActivity={promoData[item.promo.id]?.lastActivity ?? item.lastActivity}
                  lastSyncedAt={promoData[item.promo.id]?.lastSyncedAt ?? item.lastSyncedAt}
                  isSelected={selectedId === item.promo.id}
                  onSelect={setSelectedId}
                />
              ))}
            </div>
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2">
            {loadingDetail ? (
              <DetailSkeleton />
            ) : selectedPromo && promoData[selectedId!] ? (
              <PromoDetail
                promo={selectedPromo}
                candidates={promoData[selectedId!].candidates}
                statusBreakdown={promoData[selectedId!].breakdown}
              />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-xl border border-gray-700/50 bg-gray-800/50">
                <div className="text-center">
                  <svg className="mx-auto h-8 w-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-500">
                    Seleccioná una promoción para ver el detalle
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
