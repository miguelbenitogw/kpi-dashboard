'use client'

import { useEffect, useState } from 'react'
import { getResumenAtraccionVacantes, type ResumenVacanteItem } from '@/lib/queries/atraccion'
import { getVacancyCountry, COUNTRY_COLORS } from '@/lib/utils/vacancy-country'

// ─── Design tokens ────────────────────────────────────────────────────────────
const P = {
  card: '#ffffff',
  border: '#e7e2d8',
  text: '#1c1917',
  muted: '#78716c',
  accent: '#1e4b9e',
  orange: '#e55a2b',
  green: '#16a34a',
  skeleton: '#e7e2d8',
}

// ─── Complete status color map ────────────────────────────────────────────────
type StatusPalette = { bar: string; text: string; bg: string }

const STATUS_PALETTE: Record<string, StatusPalette> = {
  'Hired':                        { bar: '#16a34a', text: '#15803d', bg: '#dcfce7' },
  'Approved by client':           { bar: '#1d4ed8', text: '#1e40af', bg: '#dbeafe' },
  'In Training':                  { bar: '#16a34a', text: '#15803d', bg: '#dcfce7' },
  'Interview in Progress':        { bar: '#7c3aed', text: '#6d28d9', bg: '#ede9fe' },
  'Interview-Scheduled':          { bar: '#7c3aed', text: '#6d28d9', bg: '#ede9fe' },
  'Interview Scheduled':          { bar: '#7c3aed', text: '#6d28d9', bg: '#ede9fe' },
  'Check Interest':               { bar: '#7c3aed', text: '#6d28d9', bg: '#ede9fe' },
  'Waiting for Evaluation':       { bar: '#7c3aed', text: '#6d28d9', bg: '#ede9fe' },
  'Waiting for Consensus':        { bar: '#7c3aed', text: '#6d28d9', bg: '#ede9fe' },
  'First Call':                   { bar: '#d97706', text: '#b45309', bg: '#fef3c7' },
  'Second Call':                  { bar: '#d97706', text: '#b45309', bg: '#fef3c7' },
  'On Hold':                      { bar: '#d97706', text: '#b45309', bg: '#fef3c7' },
  'Rejected':                     { bar: '#dc2626', text: '#b91c1c', bg: '#fee2e2' },
  'No Answer':                    { bar: '#dc2626', text: '#b91c1c', bg: '#fee2e2' },
  'Rejected by client':           { bar: '#dc2626', text: '#b91c1c', bg: '#fee2e2' },
  'Expelled':                     { bar: '#dc2626', text: '#b91c1c', bg: '#fee2e2' },
  'Offer-Declined':               { bar: '#ea580c', text: '#c2410c', bg: '#ffedd5' },
  'Offer-Withdrawn':              { bar: '#ea580c', text: '#c2410c', bg: '#ffedd5' },
  'Offer Withdrawn':              { bar: '#ea580c', text: '#c2410c', bg: '#ffedd5' },
  'No Show':                      { bar: '#f43f5e', text: '#be123c', bg: '#ffe4e6' },
  'Next Project':                 { bar: '#0891b2', text: '#0e7490', bg: '#cffafe' },
  'To Place':                     { bar: '#0d9488', text: '#0f766e', bg: '#ccfbf1' },
  'Associated':                   { bar: '#a8a29e', text: '#78716c', bg: '#f5f5f4' },
  'New':                          { bar: '#a8a29e', text: '#78716c', bg: '#f5f5f4' },
  'Not Valid':                    { bar: '#a8a29e', text: '#78716c', bg: '#f5f5f4' },
}

function statusPalette(s: string): StatusPalette {
  return STATUS_PALETTE[s] ?? { bar: '#a8a29e', text: '#78716c', bg: '#f5f5f4' }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Sk({ w, h, r = 6 }: { w: string | number; h: number; r?: number }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, background: P.skeleton, animation: 'ar-pulse 1.5s ease-in-out infinite' }} />
  )
}

function SkeletonCvCard() {
  return (
    <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><Sk w="65%" h={14} /><Sk w={48} h={20} r={99} /></div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}><Sk w="50%" h={10} /><div style={{ marginTop: 8 }}><Sk w="40%" h={34} r={8} /></div></div>
        <div style={{ flex: 1 }}><Sk w="50%" h={10} /><div style={{ marginTop: 8 }}><Sk w="40%" h={34} r={8} /></div></div>
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
        {[6, 10, 8, 14, 10, 4, 0].map((h, i) => <Sk key={i} w={20} h={Math.max(4, h)} r={3} />)}
      </div>
    </div>
  )
}

function SkeletonStatusCard() {
  return (
    <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Sk w="60%" h={14} />
      <Sk w="100%" h={10} r={99} />
      {[75, 55, 40, 30, 20].map((w, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sk w={100} h={10} /><Sk w={`${w}%`} h={7} r={99} /><Sk w={24} h={10} />
        </div>
      ))}
    </div>
  )
}

// ─── CV weekly card ───────────────────────────────────────────────────────────
function CvWeekCard({ item }: { item: ResumenVacanteItem }) {
  const country = getVacancyCountry(item.title)
  const cc = COUNTRY_COLORS[country]
  const delta = item.cvsThisWeek - item.cvsLastWeek
  const deltaColor = delta > 0 ? P.green : delta < 0 ? P.orange : P.muted
  const today = todayIso()

  // Sparkline — max for scaling
  const maxCount = Math.max(1, ...item.dailyCvsThisWeek.map((d) => d.count))

  return (
    <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div
          style={{ fontSize: 13, fontWeight: 600, color: P.text, lineHeight: 1.35, flex: 1, minWidth: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          title={item.title}
        >
          {item.title}
        </div>
        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: cc.bg, color: cc.text, border: `1px solid ${cc.border}` }}>
          {country}
        </span>
      </div>

      {/* CV numbers */}
      <div style={{ display: 'flex', gap: 0 }}>
        <div style={{ flex: 1, paddingRight: 16, borderRight: `1px solid ${P.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Sem. pasada</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: P.text, lineHeight: 1 }}>{item.cvsLastWeek}</div>
          <div style={{ fontSize: 10, color: P.muted, marginTop: 3 }}>CVs</div>
        </div>
        <div style={{ flex: 1, paddingLeft: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Esta semana</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: P.accent, lineHeight: 1 }}>{item.cvsThisWeek}</div>
            {delta !== 0 && (
              <div style={{ fontSize: 12, fontWeight: 700, color: deltaColor }}>{delta > 0 ? '+' : ''}{delta}</div>
            )}
          </div>
          <div style={{ fontSize: 10, color: P.muted, marginTop: 3 }}>CVs</div>
        </div>
      </div>

      {/* Daily sparkline */}
      <div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 36 }}>
          {item.dailyCvsThisWeek.map((d, i) => {
            const isFuture = d.day > today
            const pct = isFuture ? 0 : Math.max(d.count > 0 ? 15 : 0, Math.round((d.count / maxCount) * 100))
            const isToday = d.day === today
            return (
              <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
                <div
                  style={{
                    width: '100%',
                    height: isFuture ? 3 : `${Math.max(3, pct)}%`,
                    borderRadius: 3,
                    background: isFuture ? P.border : isToday ? P.accent : '#93c5fd',
                    transition: 'height 0.3s ease',
                    opacity: isFuture ? 0.4 : 1,
                    minHeight: 3,
                  }}
                  title={`${DAY_LABELS[i]}: ${isFuture ? '—' : d.count + ' CVs'}`}
                />
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {DAY_LABELS.map((label, i) => {
            const isToday = item.dailyCvsThisWeek[i]?.day === today
            return (
              <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, fontWeight: isToday ? 700 : 400, color: isToday ? P.accent : P.muted }}>
                {label}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Status breakdown card ────────────────────────────────────────────────────
function StatusCard({ item }: { item: ResumenVacanteItem }) {
  const country = getVacancyCountry(item.title)
  const cc = COUNTRY_COLORS[country]
  const total = Math.max(item.totalCandidates, 1)

  const hired = item.statusCounts.find((s) => s.status === 'Hired')?.count ?? 0
  const approved = item.statusCounts.find((s) => s.status === 'Approved by client')?.count ?? 0
  const successPct = Math.round(((hired + approved) / total) * 100)

  // Key statuses for stacked bar (skip very small counts)
  const stackStatuses = item.statusCounts.filter((sc) => sc.count > 0).slice(0, 10)
  const stackTotal = stackStatuses.reduce((s, sc) => s + sc.count, 0) || 1

  // Display list: meaningful statuses ordered by relevance then count
  const KEY_ORDER = [
    'Hired', 'Approved by client', 'In Training',
    'Interview in Progress', 'Interview-Scheduled', 'Check Interest',
    'Waiting for Evaluation', 'Waiting for Consensus',
    'First Call', 'Second Call', 'On Hold',
    'Rejected', 'No Answer', 'Rejected by client', 'Expelled',
    'Offer-Declined', 'Offer-Withdrawn', 'No Show',
    'Next Project', 'To Place',
  ]
  const keyed = KEY_ORDER
    .map((s) => item.statusCounts.find((sc) => sc.status === s))
    .filter((sc): sc is { status: string; count: number } => !!sc && sc.count > 0)
  const other = item.statusCounts.filter((sc) => !KEY_ORDER.includes(sc.status) && sc.count > 0)
    .sort((a, b) => b.count - a.count)
  const display = [...keyed, ...other].slice(0, 8)

  return (
    <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{ fontSize: 13, fontWeight: 600, color: P.text, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            title={item.title}
          >
            {item.title}
          </div>
          <div style={{ fontSize: 11, color: P.muted, marginTop: 3 }}>
            {item.totalCandidates} candidatos
            {' · '}
            <span style={{ color: successPct >= 20 ? P.green : successPct >= 5 ? P.accent : P.orange, fontWeight: 600 }}>
              {successPct}% Hired+Approved
            </span>
          </div>
        </div>
        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: cc.bg, color: cc.text, border: `1px solid ${cc.border}` }}>
          {country}
        </span>
      </div>

      {/* Stacked percentage bar */}
      {stackStatuses.length > 0 && (
        <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', gap: 1 }}>
          {stackStatuses.map((sc) => {
            const w = Math.max(1, Math.round((sc.count / stackTotal) * 100))
            return (
              <div
                key={sc.status}
                style={{ flex: `0 0 ${w}%`, background: statusPalette(sc.status).bar, height: '100%' }}
                title={`${sc.status}: ${sc.count}`}
              />
            )
          })}
        </div>
      )}

      {/* Status rows with bar */}
      {display.length === 0 ? (
        <div style={{ fontSize: 12, color: P.muted }}>Sin datos de estado</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {display.map((sc) => {
            const pct = Math.max(2, Math.round((sc.count / total) * 100))
            const pal = statusPalette(sc.status)
            return (
              <div key={sc.status} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Color dot */}
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: pal.bar, flexShrink: 0 }} />
                {/* Label */}
                <div style={{ width: 130, fontSize: 11, color: P.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }} title={sc.status}>
                  {sc.status}
                </div>
                {/* Bar */}
                <div style={{ flex: 1, height: 6, borderRadius: 99, background: P.border, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: pal.bar, transition: 'width 0.4s ease' }} />
                </div>
                {/* Count */}
                <div style={{ width: 28, fontSize: 11, fontWeight: 700, color: pal.text, textAlign: 'right', flexShrink: 0 }}>
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

// ─── GW tag color palette ─────────────────────────────────────────────────────
// Deterministic color per worker name — same name always same color
const GW_COLORS = [
  '#1e4b9e', '#7c3aed', '#0891b2', '#16a34a', '#d97706',
  '#dc2626', '#0d9488', '#db2777', '#6366f1', '#ea580c',
]
function gwColor(tag: string): string {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0
  return GW_COLORS[h % GW_COLORS.length]
}
function gwInitials(tag: string): string {
  // "GWMaria" → "M", "GWFrancesco" → "F"
  const name = tag.replace(/^GW/i, '')
  return (name[0] ?? '?').toUpperCase()
}
function gwName(tag: string): string {
  return tag.replace(/^GW/i, '')
}

function SkeletonGwCard() {
  return (
    <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><Sk w="60%" h={14} /><Sk w={48} h={20} r={99} /></div>
      {[70, 55, 40, 25].map((w, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sk w={28} h={28} r={99} /><Sk w={64} h={10} /><Sk w={`${w}%`} h={7} r={99} /><Sk w={24} h={10} />
        </div>
      ))}
    </div>
  )
}

// ─── GW tags card ─────────────────────────────────────────────────────────────
function GwTagsCard({ item }: { item: ResumenVacanteItem }) {
  const country = getVacancyCountry(item.title)
  const cc = COUNTRY_COLORS[country]
  const maxCount = Math.max(1, ...item.gwTags.map((t) => t.count))
  const display = item.gwTags.slice(0, 10)

  return (
    <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div
          style={{ fontSize: 13, fontWeight: 600, color: P.text, lineHeight: 1.35, flex: 1, minWidth: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          title={item.title}
        >
          {item.title}
        </div>
        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: cc.bg, color: cc.text, border: `1px solid ${cc.border}` }}>
          {country}
        </span>
      </div>

      {/* Worker rows */}
      {display.length === 0 ? (
        <div style={{ fontSize: 12, color: P.muted }}>Sin asignaciones GW</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {display.map((t) => {
            const color = gwColor(t.tag)
            const pct = Math.max(4, Math.round((t.count / maxCount) * 100))
            return (
              <div key={t.tag} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Avatar */}
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', background: color,
                  color: '#fff', fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {gwInitials(t.tag)}
                </div>
                {/* Name */}
                <div style={{ width: 84, fontSize: 12, fontWeight: 600, color: P.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {gwName(t.tag)}
                </div>
                {/* Bar */}
                <div style={{ flex: 1, height: 6, borderRadius: 99, background: P.border, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: color, transition: 'width 0.4s ease' }} />
                </div>
                {/* Count */}
                <div style={{ width: 28, fontSize: 12, fontWeight: 700, color, textAlign: 'right', flexShrink: 0 }}>
                  {t.count}
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
      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: P.accent, flexShrink: 0 }} />
      <span style={{ fontSize: 14, fontWeight: 700, color: P.accent }}>{title}</span>
      {subtitle && <span style={{ fontSize: 12, color: P.muted }}>{subtitle}</span>}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: '20px 24px', color: P.muted, fontSize: 13 }}>
      {message}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <style>{`@keyframes ar-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }`}</style>

      {/* ── CVs esta semana vs semana pasada ── */}
      <section>
        <SectionHeader title="CVs recibidos" subtitle="Vacantes favoritas — semana pasada vs esta semana" />
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            <SkeletonCvCard /><SkeletonCvCard /><SkeletonCvCard />
          </div>
        ) : items.length === 0 ? (
          <EmptyState message="No hay vacantes favoritas. Podés marcarlas en la pestaña Configuración." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {items.map((item) => <CvWeekCard key={item.id} item={item} />)}
          </div>
        )}
      </section>

      {/* ── Estado de candidatos por vacante ── */}
      <section>
        <SectionHeader title="Estado de candidatos" subtitle="Por vacante favorita" />
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            <SkeletonStatusCard /><SkeletonStatusCard /><SkeletonStatusCard />
          </div>
        ) : items.length === 0 ? null : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {items.map((item) => <StatusCard key={item.id} item={item} />)}
          </div>
        )}
      </section>

      {/* ── Etiquetas GW por vacante ── */}
      <section>
        <SectionHeader title="Equipo GW" subtitle="Candidatos por gestor en vacantes favoritas" />
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            <SkeletonGwCard /><SkeletonGwCard /><SkeletonGwCard />
          </div>
        ) : items.length === 0 ? null : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {items.map((item) => <GwTagsCard key={item.id} item={item} />)}
          </div>
        )}
      </section>
    </div>
  )
}
