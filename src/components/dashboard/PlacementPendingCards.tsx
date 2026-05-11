'use client'

import { useEffect, useState } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { getGPKPIStats } from '@/lib/queries/colocacion'

interface PendingData {
  norwayPending: number
  germanyToPlace: number
}

async function fetchPendingCounts(): Promise<PendingData> {
  const [gpStats, germanyRes] = await Promise.all([
    getGPKPIStats(),
    (supabase as any)
      .from('germany_candidates_kpi')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'To Place'),
  ])

  return {
    norwayPending:  gpStats.pending,
    germanyToPlace: germanyRes.count ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Single stat card
// ---------------------------------------------------------------------------
interface StatCardProps {
  label:    string
  sublabel: string
  value:    number | null
  color:    string
  bg:       string
  border:   string
}

function StatCard({ label, sublabel, value, color, bg, border }: StatCardProps) {
  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 12,
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        background: color + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <MapPin size={16} color={color} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>
            {value ?? '—'}
          </span>
          <span style={{ fontSize: 11, color: '#a8a29e' }}>personas</span>
        </div>
        <div style={{ fontSize: 11, color: '#a8a29e', marginTop: 2 }}>{sublabel}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PlacementPendingCards
// ---------------------------------------------------------------------------
export default function PlacementPendingCards() {
  const [data, setData]       = useState<PendingData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPendingCounts()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', gap: 12 }}>
        {[0, 1].map((i) => (
          <div key={i} style={{
            flex: 1, height: 84, borderRadius: 12,
            border: '1px solid #e7e2d8', background: '#f8f7f4',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Loader2 size={16} color="#a8a29e" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ))}
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <StatCard
        label="Pendientes de colocación · Noruega"
        sublabel="Formación completa, sin plaza confirmada"
        value={data?.norwayPending ?? null}
        color="#1e4b9e"
        bg="#eff6ff"
        border="#bfdbfe"
      />
      <StatCard
        label="To Place · Alemania"
        sublabel="Estado «To Place» en Germany Candidates"
        value={data?.germanyToPlace ?? null}
        color="#b45309"
        bg="#fffbeb"
        border="#fde68a"
      />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
