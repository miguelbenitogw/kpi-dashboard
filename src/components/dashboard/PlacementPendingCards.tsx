'use client'

import { useEffect, useState } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

interface PendingData {
  norwayToPlace:       number   // gp_training_status = 'To Place'
  norwayApproved:      number   // gp_training_status = 'Approved by client' (sin contrato)
  germanyToPlace:      number   // estado = 'To Place'
}

async function fetchPendingCounts(): Promise<PendingData> {
  const [norwayRes, germanyRes] = await Promise.all([
    (supabase as any)
      .from('candidates_kpi')
      .select('gp_training_status')
      .in('gp_training_status', ['To Place', 'Approved by client']),
    (supabase as any)
      .from('germany_candidates_kpi')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'To Place'),
  ])

  const rows: { gp_training_status: string }[] = norwayRes.data ?? []
  const norwayToPlace  = rows.filter((r) => r.gp_training_status === 'To Place').length
  const norwayApproved = rows.filter((r) => r.gp_training_status === 'Approved by client').length

  return {
    norwayToPlace,
    norwayApproved,
    germanyToPlace: germanyRes.count ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Stat pill inside a card
// ---------------------------------------------------------------------------
interface StatPillProps {
  value:    number
  label:    string
  color:    string
  bg:       string
  border:   string
}

function StatPill({ value, label, color, bg, border }: StatPillProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', borderRadius: 9,
      background: bg, border: `1px solid ${border}`,
      flex: 1, minWidth: 120,
    }}>
      <span style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 11, color, lineHeight: 1.3, fontWeight: 500 }}>{label}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single program card
// ---------------------------------------------------------------------------
interface ProgramCardProps {
  title:     string
  iconColor: string
  bg:        string
  border:    string
  children:  React.ReactNode
}

function ProgramCard({ title, iconColor, bg, border, children }: ProgramCardProps) {
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`,
      borderRadius: 12, padding: '14px 16px',
      flex: 1, minWidth: 0,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <MapPin size={13} color={iconColor} />
        <span style={{ fontSize: 11, fontWeight: 700, color: iconColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {children}
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

  const NORWAY_BLUE  = { color: '#1e4b9e', bg: '#eff6ff', border: '#bfdbfe' }
  const GERMANY_AMB  = { color: '#b45309', bg: '#fffbeb', border: '#fde68a' }
  const PILL_DARK_BG = '#ffffff'

  if (loading) {
    return (
      <div style={{ display: 'flex', gap: 12 }}>
        {[0, 1].map((i) => (
          <div key={i} style={{
            flex: 1, height: 90, borderRadius: 12,
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

      {/* Noruega */}
      <ProgramCard title="Noruega" iconColor={NORWAY_BLUE.color} bg={NORWAY_BLUE.bg} border={NORWAY_BLUE.border}>
        <StatPill
          value={data?.norwayToPlace ?? 0}
          label="To Place"
          color={NORWAY_BLUE.color}
          bg={PILL_DARK_BG}
          border={NORWAY_BLUE.border}
        />
        <StatPill
          value={data?.norwayApproved ?? 0}
          label={`Approved by client\n(sin contrato firmado)`}
          color="#0369a1"
          bg={PILL_DARK_BG}
          border="#bae6fd"
        />
      </ProgramCard>

      {/* Alemania */}
      <ProgramCard title="Alemania" iconColor={GERMANY_AMB.color} bg={GERMANY_AMB.bg} border={GERMANY_AMB.border}>
        <StatPill
          value={data?.germanyToPlace ?? 0}
          label="To Place"
          color={GERMANY_AMB.color}
          bg={PILL_DARK_BG}
          border={GERMANY_AMB.border}
        />
      </ProgramCard>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
