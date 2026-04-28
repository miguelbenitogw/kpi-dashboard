'use client'

import { useEffect, useState } from 'react'
import { getReceivedCvsByVacancyStats, type VacancyRankingRow } from '@/lib/queries/atraccion'

interface BarItem {
  vacancyId: string
  title: string
  total: number
}

function formatSyncedAt(isoString: string | null): string {
  if (!isoString) return 'Sin datos'
  const date = new Date(isoString)
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + '…'
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: '0 20px 20px' }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              width: 140,
              height: 14,
              borderRadius: 6,
              background: '#e7e2d8',
              animation: 'pulse 1.4s ease-in-out infinite',
              opacity: 0.7 - i * 0.06,
            }}
          />
          <div
            style={{
              flex: 1,
              height: 8,
              borderRadius: 99,
              background: '#e7e2d8',
              animation: 'pulse 1.4s ease-in-out infinite',
              opacity: 0.8 - i * 0.07,
            }}
          />
          <div
            style={{
              width: 32,
              height: 20,
              borderRadius: 6,
              background: '#e7e2d8',
              animation: 'pulse 1.4s ease-in-out infinite',
            }}
          />
        </div>
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        padding: '32px 20px',
        textAlign: 'center',
        color: '#a8a29e',
        fontSize: 14,
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
      <div style={{ fontWeight: 600, color: '#78716c', marginBottom: 4 }}>
        Sin datos
      </div>
      <div>Ejecutá sync para cargar los CVs por vacante</div>
    </div>
  )
}

export default function CvsPerVacancyChart() {
  const [items, setItems] = useState<BarItem[]>([])
  const [total, setTotal] = useState(0)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const stats = await getReceivedCvsByVacancyStats(4)

        if (cancelled) return

        setGeneratedAt(stats.generatedAt)

        if (stats.ranking.length === 0) {
          setItems([])
          setTotal(0)
          setLoading(false)
          return
        }

        const processed: BarItem[] = stats.ranking
          .map((row: VacancyRankingRow) => ({
            vacancyId: row.vacancyId,
            title: row.vacancyTitle,
            total: (row.newThisWeek ?? 0) + (row.previousWeek ?? 0),
          }))
          .filter((item) => item.total > 0)
          .sort((a, b) => b.total - a.total)
          .slice(0, 8)

        const grandTotal = processed.reduce((sum, item) => sum + item.total, 0)

        setItems(processed)
        setTotal(grandTotal)
      } catch (err) {
        console.error('[CvsPerVacancyChart] load error:', err)
        setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  const maxValue = items.length > 0 ? items[0].total : 1

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px 10px',
          borderBottom: '1px solid #f5f1ea',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: '#1c1917',
              marginBottom: 2,
            }}
          >
            CVs por vacante activa
          </div>
          <div style={{ fontSize: 12, color: '#78716c' }}>
            Últimas 2 semanas
          </div>
        </div>

        {!loading && total > 0 && (
          <div
            style={{
              background: '#eaf0fb',
              color: '#1e4b9e',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              padding: '4px 12px',
            }}
          >
            {total} CVs
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '12px 16px 6px' }}>
        {loading ? (
          <LoadingSkeleton />
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((item) => {
              const pct = maxValue > 0 ? (item.total / maxValue) * 100 : 0
              const label = truncate(item.title, 30)

              return (
                <div
                  key={item.vacancyId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  {/* Title */}
                  <div
                    title={item.title}
                    style={{
                      width: 160,
                      flexShrink: 0,
                      fontSize: 13,
                      color: '#1c1917',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </div>

                  {/* Bar track */}
                  <div
                    style={{
                      flex: 1,
                      height: 8,
                      borderRadius: 99,
                      background: '#f5f1ea',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        borderRadius: 99,
                        background: '#1e4b9e',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>

                  {/* Count badge */}
                  <div
                    style={{
                      background: '#eaf0fb',
                      color: '#1e4b9e',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '2px 8px',
                      flexShrink: 0,
                      minWidth: 28,
                      textAlign: 'center',
                    }}
                  >
                    {item.total}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading && (
        <div
          style={{
            padding: '6px 16px 10px',
            fontSize: 11,
            color: '#a8a29e',
            borderTop: items.length > 0 ? '1px solid #f5f1ea' : 'none',
          }}
        >
          Actualizado: {formatSyncedAt(generatedAt)}
        </div>
      )}
    </div>
  )
}
