'use client'

import { useEffect, useState } from 'react'
import { getResumenAtraccionVacantes, type ResumenVacanteItem } from '@/lib/queries/atraccion'
import { getVacancyCountry, COUNTRY_COLORS } from '@/lib/utils/vacancy-country'

// ─── Design tokens ────────────────────────────────────────────────────────────
const P = {
  card: '#ffffff',
  border: '#e7e2d8',
  divider: '#f0ece4',
  text: '#1c1917',
  muted: '#78716c',
  accent: '#1e4b9e',
  orange: '#e55a2b',
  green: '#16a34a',
  skeleton: '#e7e2d8',
}

// ─── Status color map ─────────────────────────────────────────────────────────
type StatusPalette = { bar: string; text: string; bg: string }

const STATUS_PALETTE: Record<string, StatusPalette> = {
  'Hired':                    { bar: '#16a34a', text: '#15803d', bg: '#dcfce7' },
  'Approved by client':       { bar: '#1d4ed8', text: '#1e40af', bg: '#dbeafe' },
  'In Training':              { bar: '#16a34a', text: '#15803d', bg: '#dcfce7' },
  'Interview in Progress':    { bar: '#7c3aed', text: '#6d28d9', bg: '#ede9fe' },
  'Interview-Scheduled':      { bar: '#7c3aed', text: '#6d28d9', bg: '#ede9fe' },
  'Interview Scheduled':      { bar: '#7c3aed', text: '#6d28d9', bg: '#ede9fe' },
  'Check Interest':           { bar: '#7c3aed', text: '#6d28d9', bg: '#ede9fe' },
  'Waiting for Evaluation':   { bar: '#7c3aed', text: '#6d28d9', bg: '#ede9fe' },
  'Waiting for Consensus':    { bar: '#7c3aed', text: '#6d28d9', bg: '#ede9fe' },
  'First Call':               { bar: '#d97706', text: '#b45309', bg: '#fef3c7' },
  'Second Call':              { bar: '#d97706', text: '#b45309', bg: '#fef3c7' },
  'On Hold':                  { bar: '#d97706', text: '#b45309', bg: '#fef3c7' },
  'Rejected':                 { bar: '#dc2626', text: '#b91c1c', bg: '#fee2e2' },
  'No Answer':                { bar: '#dc2626', text: '#b91c1c', bg: '#fee2e2' },
  'Rejected by client':       { bar: '#dc2626', text: '#b91c1c', bg: '#fee2e2' },
  'Expelled':                 { bar: '#dc2626', text: '#b91c1c', bg: '#fee2e2' },
  'Offer-Declined':           { bar: '#ea580c', text: '#c2410c', bg: '#ffedd5' },
  'Offer-Withdrawn':          { bar: '#ea580c', text: '#c2410c', bg: '#ffedd5' },
  'Offer Withdrawn':          { bar: '#ea580c', text: '#c2410c', bg: '#ffedd5' },
  'No Show':                  { bar: '#f43f5e', text: '#be123c', bg: '#ffe4e6' },
  'Next Project':             { bar: '#0891b2', text: '#0e7490', bg: '#cffafe' },
  'To Place':                 { bar: '#0d9488', text: '#0f766e', bg: '#ccfbf1' },
  'Associated':               { bar: '#a8a29e', text: '#78716c', bg: '#f5f5f4' },
  'New':                      { bar: '#a8a29e', text: '#78716c', bg: '#f5f5f4' },
  'Not Valid':                { bar: '#a8a29e', text: '#78716c', bg: '#f5f5f4' },
}

const STATUS_KEY_ORDER = [
  'Hired', 'Approved by client', 'In Training',
  'Interview in Progress', 'Interview-Scheduled', 'Interview Scheduled',
  'Check Interest', 'Waiting for Evaluation', 'Waiting for Consensus',
  'First Call', 'Second Call', 'On Hold',
  'Rejected', 'No Answer', 'Rejected by client', 'Expelled',
  'Offer-Declined', 'Offer-Withdrawn', 'Offer Withdrawn', 'No Show',
  'Next Project', 'To Place',
]

function statusPalette(s: string): StatusPalette {
  return STATUS_PALETTE[s] ?? { bar: '#a8a29e', text: '#78716c', bg: '#f5f5f4' }
}

// ─── GW helpers ───────────────────────────────────────────────────────────────
const GW_COLORS = [
  '#1e4b9e', '#7c3aed', '#0891b2', '#16a34a', '#d97706',
  '#dc2626', '#0d9488', '#db2777', '#6366f1', '#ea580c',
]
function gwColor(tag: string): string {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0
  return GW_COLORS[h % GW_COLORS.length]
}
function gwName(tag: string): string { return tag.replace(/^GW/i, '') }
function gwInitials(tag: string): string { return (gwName(tag)[0] ?? '?').toUpperCase() }

// ─── Misc helpers ─────────────────────────────────────────────────────────────
const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
function todayIso(): string { return new Date().toISOString().split('T')[0] }

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Sk({ w, h, r = 6 }: { w: string | number; h: number; r?: number }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, background: P.skeleton, animation: 'ar-pulse 1.5s ease-in-out infinite' }} />
  )
}

function SkeletonVacancyCard() {
  return (
    <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 14, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${P.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Sk w="70%" h={14} /><Sk w="40%" h={10} />
        </div>
        <Sk w={56} h={22} r={99} />
      </div>
      {/* CVs row */}
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${P.divider}`, display: 'flex', gap: 16 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}><Sk w="50%" h={9} /><Sk w="35%" h={28} r={4} /></div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}><Sk w="50%" h={9} /><Sk w="35%" h={28} r={4} /></div>
        <div style={{ flex: 2, display: 'flex', gap: 3, alignItems: 'flex-end', height: 36 }}>
          {[5, 9, 7, 14, 9, 3, 0].map((h, i) => <Sk key={i} w="100%" h={Math.max(3, h)} r={3} />)}
        </div>
      </div>
      {/* Status */}
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${P.divider}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Sk w="100%" h={8} r={99} />
        {[80, 65, 45, 35, 22].map((w, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sk w={7} h={7} r={99} /><Sk w={110} h={9} /><Sk w={`${w}%`} h={6} r={99} /><Sk w={24} h={9} />
          </div>
        ))}
      </div>
      {/* GW */}
      <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Sk w="30%" h={9} />
        {[70, 45, 25].map((w, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sk w={24} h={24} r={99} /><Sk w={64} h={9} /><Sk w={`${w}%`} h={6} r={99} /><Sk w={24} h={9} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Unified vacancy card ─────────────────────────────────────────────────────
function VacancyCard({ item }: { item: ResumenVacanteItem }) {
  const country = getVacancyCountry(item.title)
  const cc = COUNTRY_COLORS[country]
  const today = todayIso()

  // ── CVs
  const delta = item.cvsThisWeek - item.cvsLastWeek
  const deltaColor = delta > 0 ? P.green : delta < 0 ? P.orange : P.muted
  const maxDay = Math.max(1, ...item.dailyCvsThisWeek.map((d) => d.count))

  // ── Status
  const total = Math.max(item.totalCandidates, 1)
  const hired = item.statusCounts.find((s) => s.status === 'Hired')?.count ?? 0
  const approved = item.statusCounts.find((s) => s.status === 'Approved by client')?.count ?? 0
  const successPct = Math.round(((hired + approved) / total) * 100)

  const allStatuses = item.statusCounts.filter((sc) => sc.count > 0)
  const stackTotal = allStatuses.reduce((s, sc) => s + sc.count, 0) || 1

  // Ordered display: known order first, then unknowns by count
  const keyed = STATUS_KEY_ORDER
    .map((s) => allStatuses.find((sc) => sc.status === s))
    .filter((sc): sc is { status: string; count: number } => sc != null)
  const other = allStatuses
    .filter((sc) => !STATUS_KEY_ORDER.includes(sc.status))
    .sort((a, b) => b.count - a.count)
  const displayStatuses = [...keyed, ...other]  // ALL statuses, no slice

  // ── GW
  const maxGw = Math.max(1, ...item.gwTags.map((t) => t.count))

  return (
    <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${P.divider}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: P.text, lineHeight: 1.35 }} title={item.title}>
            {item.title}
          </div>
          <div style={{ fontSize: 11, color: P.muted, marginTop: 4 }}>
            {item.totalCandidates} candidatos
            {' · '}
            <span style={{ color: successPct >= 20 ? P.green : successPct >= 5 ? P.accent : P.orange, fontWeight: 600 }}>
              {successPct}% Hired+Approved
            </span>
          </div>
        </div>
        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: cc.bg, color: cc.text, border: `1px solid ${cc.border}` }}>
          {country}
        </span>
      </div>

      {/* ── CVs + Sparkline ── */}
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${P.divider}`, display: 'flex', gap: 0, alignItems: 'center' }}>
        {/* Sem pasada */}
        <div style={{ paddingRight: 16, borderRight: `1px solid ${P.border}` }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Sem. pasada</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: P.muted, lineHeight: 1 }}>{item.cvsLastWeek}</div>
          <div style={{ fontSize: 9, color: P.muted, marginTop: 2 }}>CVs</div>
        </div>
        {/* Esta semana */}
        <div style={{ paddingLeft: 16, paddingRight: 20, borderRight: `1px solid ${P.border}` }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Esta semana</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: P.accent, lineHeight: 1 }}>{item.cvsThisWeek}</div>
            {delta !== 0 && (
              <div style={{ fontSize: 11, fontWeight: 700, color: deltaColor }}>{delta > 0 ? '+' : ''}{delta}</div>
            )}
          </div>
          <div style={{ fontSize: 9, color: P.muted, marginTop: 2 }}>CVs</div>
        </div>
        {/* Sparkline */}
        <div style={{ flex: 1, paddingLeft: 16 }}>
          <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 32 }}>
            {item.dailyCvsThisWeek.map((d, i) => {
              const isFuture = d.day > today
              const pct = isFuture ? 0 : Math.max(d.count > 0 ? 15 : 0, Math.round((d.count / maxDay) * 100))
              const isToday = d.day === today
              return (
                <div key={d.day} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <div
                    style={{
                      width: '100%', borderRadius: 3,
                      height: isFuture ? 3 : `${Math.max(3, pct)}%`,
                      background: isFuture ? P.border : isToday ? P.accent : '#93c5fd',
                      opacity: isFuture ? 0.4 : 1,
                      minHeight: 3,
                    }}
                    title={`${DAY_LABELS[i]}: ${isFuture ? '—' : d.count + ' CVs'}`}
                  />
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
            {DAY_LABELS.map((label, i) => {
              const isToday = item.dailyCvsThisWeek[i]?.day === today
              return (
                <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 8, fontWeight: isToday ? 700 : 400, color: isToday ? P.accent : P.muted }}>
                  {label}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Estado de candidatos ── */}
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${P.divider}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Estado</div>

        {/* Stacked bar */}
        {allStatuses.length > 0 && (
          <div style={{ display: 'flex', height: 7, borderRadius: 99, overflow: 'hidden', gap: 1 }}>
            {allStatuses.map((sc) => (
              <div
                key={sc.status}
                style={{ flex: `0 0 ${Math.max(1, Math.round((sc.count / stackTotal) * 100))}%`, background: statusPalette(sc.status).bar }}
                title={`${sc.status}: ${sc.count}`}
              />
            ))}
          </div>
        )}

        {/* All status rows */}
        {displayStatuses.length === 0 ? (
          <div style={{ fontSize: 12, color: P.muted }}>Sin datos de estado</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {displayStatuses.map((sc) => {
              const pct = Math.max(2, Math.round((sc.count / total) * 100))
              const pal = statusPalette(sc.status)
              return (
                <div key={sc.status} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: pal.bar, flexShrink: 0 }} />
                  <div style={{ width: 148, fontSize: 11, color: P.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }} title={sc.status}>
                    {sc.status}
                  </div>
                  <div style={{ flex: 1, height: 5, borderRadius: 99, background: P.divider, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: pal.bar, transition: 'width 0.4s ease' }} />
                  </div>
                  <div style={{ width: 30, fontSize: 11, fontWeight: 700, color: pal.text, textAlign: 'right', flexShrink: 0 }}>
                    {sc.count}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Equipo GW ── */}
      <div style={{ padding: '14px 20px', flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Equipo GW</div>
        {item.gwTags.length === 0 ? (
          <div style={{ fontSize: 12, color: P.muted }}>Sin asignaciones GW</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {item.gwTags.map((t) => {
              const color = gwColor(t.tag)
              const pct = Math.max(4, Math.round((t.count / maxGw) * 100))
              return (
                <div key={t.tag} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', background: color,
                    color: '#fff', fontSize: 9, fontWeight: 700, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {gwInitials(t.tag)}
                  </div>
                  <div style={{ width: 80, fontSize: 11, fontWeight: 600, color: P.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {gwName(t.tag)}
                  </div>
                  <div style={{ flex: 1, height: 5, borderRadius: 99, background: P.divider, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: color, transition: 'width 0.4s ease' }} />
                  </div>
                  <div style={{ width: 28, fontSize: 11, fontWeight: 700, color, textAlign: 'right', flexShrink: 0 }}>
                    {t.count}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`@keyframes ar-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }`}</style>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
          <SkeletonVacancyCard /><SkeletonVacancyCard /><SkeletonVacancyCard />
        </div>
      ) : items.length === 0 ? (
        <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 14, padding: '20px 24px', color: P.muted, fontSize: 13 }}>
          No hay vacantes favoritas. Podés marcarlas en la pestaña Configuración.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
          {items.map((item) => <VacancyCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  )
}
