'use client'

import { useEffect, useState } from 'react'
import { getResumenAtraccionVacantes, type ResumenVacanteItem } from '@/lib/queries/atraccion'
import { getVacancyCountry, COUNTRY_COLORS } from '@/lib/utils/vacancy-country'

// ─── Design tokens ────────────────────────────────────────────────────────────
const P = {
  bg: '#f9f7f4',
  card: '#ffffff',
  border: '#e7e2d8',
  text: '#1c1917',
  muted: '#78716c',
  accent: '#1e4b9e',
  orange: '#e55a2b',
  green: '#16a34a',
  greenBg: '#dcfce7',
  blueBg: '#dbeafe',
  purpleBg: '#ede9fe',
  amberBg: '#fef3c7',
  skeleton: '#e7e2d8',
}

// ─── Status palette ────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, { bar: string; chip: string; text: string }> = {
  'Hired':                  { bar: '#16a34a', chip: P.greenBg,  text: '#15803d' },
  'Approved by client':     { bar: '#1d4ed8', chip: P.blueBg,   text: '#1e40af' },
  'Interview in Progress':  { bar: '#7c3aed', chip: P.purpleBg, text: '#6d28d9' },
  'Interview-Scheduled':    { bar: '#7c3aed', chip: P.purpleBg, text: '#6d28d9' },
  'First Call':             { bar: '#d97706', chip: P.amberBg,  text: '#b45309' },
  'Second Call':            { bar: '#d97706', chip: P.amberBg,  text: '#b45309' },
}
function statusColor(s: string) {
  return STATUS_COLORS[s] ?? { bar: '#a8a29e', chip: '#f3f4f6', text: '#78716c' }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ w, h, radius = 6 }: { w: string | number; h: number; radius?: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        background: P.skeleton,
        animation: 'ar-pulse 1.5s ease-in-out infinite',
      }}
    />
  )
}

function SkeletonCvCard() {
  return (
    <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: 20 }}>
      <Skeleton w="70%" h={14} />
      <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
        <div style={{ flex: 1 }}>
          <Skeleton w="50%" h={10} />
          <div style={{ marginTop: 8 }}><Skeleton w="40%" h={32} radius={8} /></div>
        </div>
        <div style={{ flex: 1 }}>
          <Skeleton w="50%" h={10} />
          <div style={{ marginTop: 8 }}><Skeleton w="40%" h={32} radius={8} /></div>
        </div>
      </div>
    </div>
  )
}

function SkeletonStatusCard() {
  return (
    <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: 20 }}>
      <Skeleton w="55%" h={14} />
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[80, 65, 50, 40].map((w, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Skeleton w={90} h={11} />
            <Skeleton w={`${w}%`} h={8} radius={99} />
            <Skeleton w={28} h={11} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── CV weekly card ───────────────────────────────────────────────────────────
function CvWeekCard({ item }: { item: ResumenVacanteItem }) {
  const country = getVacancyCountry(item.title)
  const cc = COUNTRY_COLORS[country]
  const delta = item.cvsThisWeek - item.cvsLastWeek
  const deltaColor = delta > 0 ? P.green : delta < 0 ? P.orange : P.muted
  const deltaPrefix = delta > 0 ? '+' : ''

  return (
    <div
      style={{
        background: P.card,
        border: `1px solid ${P.border}`,
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 16 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: P.text,
            lineHeight: 1.35,
            flex: 1,
            minWidth: 0,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
          title={item.title}
        >
          {item.title}
        </div>
        <span
          style={{
            flexShrink: 0,
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 99,
            background: cc.bg,
            color: cc.text,
            border: `1px solid ${cc.border}`,
          }}
        >
          {country}
        </span>
      </div>

      {/* CV numbers */}
      <div style={{ display: 'flex', gap: 0 }}>
        {/* Semana pasada */}
        <div style={{ flex: 1, paddingRight: 16, borderRight: `1px solid ${P.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Sem. pasada
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: P.text, lineHeight: 1 }}>
            {item.cvsLastWeek}
          </div>
          <div style={{ fontSize: 10, color: P.muted, marginTop: 4 }}>CVs</div>
        </div>

        {/* Esta semana */}
        <div style={{ flex: 1, paddingLeft: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Esta semana
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: P.accent, lineHeight: 1 }}>
              {item.cvsThisWeek}
            </div>
            {delta !== 0 && (
              <div style={{ fontSize: 12, fontWeight: 700, color: deltaColor }}>
                {deltaPrefix}{delta}
              </div>
            )}
          </div>
          <div style={{ fontSize: 10, color: P.muted, marginTop: 4 }}>CVs</div>
        </div>
      </div>
    </div>
  )
}

// ─── Status breakdown card ────────────────────────────────────────────────────
function StatusCard({ item }: { item: ResumenVacanteItem }) {
  const country = getVacancyCountry(item.title)
  const cc = COUNTRY_COLORS[country]
  const total = item.totalCandidates > 0 ? item.totalCandidates : 1

  // Group: key statuses first, then rest
  const KEY_ORDER = ['Hired', 'Approved by client', 'Interview in Progress', 'Interview-Scheduled', 'First Call', 'Second Call']
  const keyStatuses = KEY_ORDER
    .map((s) => item.statusCounts.find((sc) => sc.status === s))
    .filter((sc): sc is { status: string; count: number } => !!sc && sc.count > 0)
  const otherStatuses = item.statusCounts
    .filter((sc) => !KEY_ORDER.includes(sc.status) && sc.count > 0)
    .sort((a, b) => b.count - a.count)
  const displayStatuses = [...keyStatuses, ...otherStatuses]

  const hired = item.statusCounts.find((s) => s.status === 'Hired')?.count ?? 0
  const approved = item.statusCounts.find((s) => s.status === 'Approved by client')?.count ?? 0
  const successPct = Math.round(((hired + approved) / total) * 100)

  return (
    <div
      style={{
        background: P.card,
        border: `1px solid ${P.border}`,
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: P.text,
              lineHeight: 1.35,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
            title={item.title}
          >
            {item.title}
          </div>
          <div style={{ fontSize: 11, color: P.muted, marginTop: 3 }}>
            {item.totalCandidates} candidatos · {successPct}% Hired+Approved
          </div>
        </div>
        <span
          style={{
            flexShrink: 0,
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 99,
            background: cc.bg,
            color: cc.text,
            border: `1px solid ${cc.border}`,
          }}
        >
          {country}
        </span>
      </div>

      {/* Bar chart */}
      {displayStatuses.length === 0 ? (
        <div style={{ fontSize: 12, color: P.muted }}>Sin datos de estado</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {displayStatuses.slice(0, 8).map((sc) => {
            const pct = Math.max(2, Math.round((sc.count / total) * 100))
            const col = statusColor(sc.status)
            return (
              <div key={sc.status} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 110,
                    fontSize: 11,
                    color: P.muted,
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                  title={sc.status}
                >
                  {sc.status}
                </div>
                <div
                  style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 99,
                    background: P.border,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      borderRadius: 99,
                      background: col.bar,
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
                <div
                  style={{
                    width: 28,
                    fontSize: 11,
                    fontWeight: 700,
                    color: col.text,
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  {sc.count}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: 2,
          background: P.accent,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 14, fontWeight: 700, color: P.accent }}>{title}</span>
      {subtitle && (
        <span style={{ fontSize: 12, color: P.muted, marginLeft: 2 }}>{subtitle}</span>
      )}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        background: P.card,
        border: `1px solid ${P.border}`,
        borderRadius: 12,
        padding: '20px 24px',
        color: P.muted,
        fontSize: 13,
      }}
    >
      {message}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AtraccionResumen() {
  const [items, setItems] = useState<ResumenVacanteItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getResumenAtraccionVacantes().then((data) => {
      if (!cancelled) { setItems(data); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <style>{`
        @keyframes ar-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>

      {/* ── CVs esta semana vs semana pasada ── */}
      <section>
        <SectionHeader
          title="CVs recibidos"
          subtitle="Vacantes favoritas — semana pasada vs esta semana"
        />

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            <SkeletonCvCard />
            <SkeletonCvCard />
            <SkeletonCvCard />
          </div>
        ) : items.length === 0 ? (
          <EmptyState message="No hay vacantes favoritas. Podés marcarlas en la pestaña Configuración." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {items.map((item) => (
              <CvWeekCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* ── Estado de candidatos por vacante ── */}
      <section>
        <SectionHeader
          title="Estado de candidatos"
          subtitle="Por vacante favorita"
        />

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            <SkeletonStatusCard />
            <SkeletonStatusCard />
            <SkeletonStatusCard />
          </div>
        ) : items.length === 0 ? null : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {items.map((item) => (
              <StatusCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
