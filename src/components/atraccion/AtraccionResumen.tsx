'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { getResumenAtraccionVacantes, type ResumenVacanteItem } from '@/lib/queries/atraccion'
import { getVacancyCountry, COUNTRY_COLORS } from '@/lib/utils/vacancy-country'
import { SegmentedStatusBar } from '@/components/atraccion/VacancyStatusCharts'
import MiniLineChart from '@/components/resumen/MiniLineChart'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
  'Approved by client':       { bar: '#16a34a', text: '#15803d', bg: '#dcfce7' },
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

// ─── Deadline color logic ─────────────────────────────────────────────────────
const DEADLINE_COLORS = {
  green:   '#16a34a',
  amber:   '#d97706',
  orange:  '#ea580c',
  red:     '#dc2626',
  neutral: '#e7e2d8',
}

interface DeadlineInfo {
  color: string
  tint: string        // color + '18' for header tint
  isExpired: boolean
  label: string | null
}

/**
 * Deadline color based on VOLUME PACE (when hiringTarget is set) or time progress (fallback).
 *
 * Volume logic:
 *   pace_needed    = hiringTarget / totalWeeks
 *   expected_now   = pace_needed * weeksElapsed
 *   ratio          = approvedSoFar / expected_now
 *   ≥ 1.0  → green (on track or ahead)
 *   ≥ 0.75 → amber (slightly behind)
 *   ≥ 0.50 → orange (notably behind)
 *   < 0.50 → red (very behind)
 *
 * If hiringTarget is null/0 → falls back to time-based progress coloring.
 */
function getDeadlineInfo(
  closingDate: string | null,
  dateOpened: string | null,
  hiringTarget: number | null,
  approvedSoFar: number,
): DeadlineInfo {
  const neutral: DeadlineInfo = { color: DEADLINE_COLORS.neutral, tint: 'transparent', isExpired: false, label: null }

  if (!closingDate) return neutral

  const now = Date.now()
  const closing = new Date(closingDate).getTime()

  // Already past closing date
  if (now > closing) {
    return { color: DEADLINE_COLORS.red, tint: `${DEADLINE_COLORS.red}18`, isExpired: true, label: 'Cerrada' }
  }

  const opened = dateOpened ? new Date(dateOpened).getTime() : null
  if (!opened || opened >= closing) return neutral

  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000
  const totalWeeks = (closing - opened) / MS_PER_WEEK
  const weeksElapsed = (now - opened) / MS_PER_WEEK

  let color: string

  if (hiringTarget && hiringTarget > 0 && totalWeeks > 0) {
    // ── Volume-based: are we hiring fast enough?
    const expectedNow = (hiringTarget / totalWeeks) * weeksElapsed
    // In the very first days, expectedNow is near 0 — don't penalise
    if (expectedNow < 0.5) {
      color = DEADLINE_COLORS.green
    } else {
      const ratio = approvedSoFar / expectedNow
      if (ratio >= 1.0) {
        color = DEADLINE_COLORS.green
      } else if (ratio >= 0.75) {
        color = DEADLINE_COLORS.amber
      } else if (ratio >= 0.50) {
        color = DEADLINE_COLORS.orange
      } else {
        color = DEADLINE_COLORS.red
      }
    }
  } else {
    // ── Time-based fallback (no target set)
    const progress = (now - opened) / (closing - opened)
    if (progress <= 0.50) {
      color = DEADLINE_COLORS.green
    } else if (progress <= 0.75) {
      color = DEADLINE_COLORS.amber
    } else if (progress <= 0.90) {
      color = DEADLINE_COLORS.orange
    } else {
      color = DEADLINE_COLORS.red
    }
  }

  return { color, tint: `${color}18`, isExpired: false, label: null }
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
// Uses position:fixed + getBoundingClientRect so it escapes any overflow:hidden parent
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  return (
    <span
      style={{ position: 'relative', cursor: 'help' }}
      onMouseEnter={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        setPos({ x: r.left + r.width / 2, y: r.top })
      }}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && (
        <span
          style={{
            position: 'fixed',
            top: pos.y - 8,
            left: pos.x,
            transform: 'translate(-50%, -100%)',
            background: '#1c1917',
            color: '#fafaf9',
            fontSize: 11,
            fontWeight: 400,
            lineHeight: 1.45,
            padding: '7px 11px',
            borderRadius: 7,
            whiteSpace: 'normal',
            width: 220,
            zIndex: 9999,
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          }}
        >
          {text}
          {/* Arrow */}
          <span style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '5px solid #1c1917',
          }} />
        </span>
      )}
    </span>
  )
}

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

// ─── Sortable wrapper ─────────────────────────────────────────────────────────
function SortableVacancyCard({ item }: { item: ResumenVacanteItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    cursor: 'grab',
    touchAction: 'none',
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <VacancyCard item={item} />
    </div>
  )
}

// ─── Zoho ID badge (click to copy) ───────────────────────────────────────────
function ZohoIdBadge({ jobNumber }: { jobNumber: number }) {
  const [copied, setCopied] = useState(false)

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(String(jobNumber)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => { /* clipboard unavailable */ })
  }

  return (
    <span
      onClick={handleCopy}
      title={copied ? '¡Copiado!' : 'Clic para copiar ID'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 10,
        fontWeight: 500,
        color: copied ? '#16a34a' : '#a8a29e',
        background: copied ? '#f0fdf4' : 'transparent',
        border: `1px solid ${copied ? '#bbf7d0' : '#e7e2d8'}`,
        borderRadius: 5,
        padding: '1px 6px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        userSelect: 'none',
        letterSpacing: '0.02em',
        marginTop: 3,
      }}
    >
      {copied ? '✓ Copiado' : `#${jobNumber}`}
    </span>
  )
}

// ─── Unified vacancy card ─────────────────────────────────────────────────────
function VacancyCard({ item }: { item: ResumenVacanteItem }) {
  const country = getVacancyCountry(item.title)
  const cc = COUNTRY_COLORS[country]
  // ── CVs
  const delta = item.cvsThisWeek - item.cvsLastWeek
  const deltaColor = delta > 0 ? P.green : delta < 0 ? P.orange : P.muted

  // ── Status
  const total = Math.max(item.totalCandidates, 1)
  const hired = item.statusCounts.find((s) => s.status === 'Hired')?.count ?? 0
  const approved = item.statusCounts.find((s) => s.status === 'Approved by client')?.count ?? 0
  const successPct = Math.round(((hired + approved) / total) * 100)

  // ── Deadline color (volume-based when hiringTarget is set)
  const deadline = getDeadlineInfo(item.closingDate, item.dateOpened, item.hiringTarget ?? null, hired + approved)

  const allStatuses = item.statusCounts.filter((sc) => sc.count > 0)

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
    <div style={{ background: P.card, border: `2px solid ${deadline.color}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${P.divider}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, background: deadline.tint }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: P.text, lineHeight: 1.35, flex: 1, minWidth: 0 }} title={item.title}>
              {item.title}
            </div>
            {item.zohoJobNumber != null && (
              <ZohoIdBadge jobNumber={item.zohoJobNumber} />
            )}
          </div>
          <div style={{ fontSize: 11, color: P.muted, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span>{item.totalCandidates} candidatos</span>
            {item.ratioExitoContactados != null && (() => {
              const pct = Math.round(item.ratioExitoContactados! * 100)
              const threshold = (item.ratioExitoThreshold ?? 0.06) * 100
              const color = pct >= threshold ? '#16a34a' : pct >= threshold * 0.5 ? '#d97706' : '#dc2626'
              return (
                <>
                  <span>·</span>
                  <Tooltip text={`Candidatos que avanzaron positivamente (Hired + Approved by client) sobre el total del proceso. Umbral configurado en Configuración: ${Math.round(threshold)}%`}>
                    <span style={{ color, fontWeight: 700 }}>✓ {pct}% éxito</span>
                  </Tooltip>
                </>
              )
            })()}
            {item.ratioDescarte != null && (() => {
              const pct = Math.round(item.ratioDescarte! * 100)
              const threshold = (item.ratioDescarteThreshold ?? 0.50) * 100
              const color = pct <= threshold * 0.6 ? '#78716c' : pct <= threshold ? '#d97706' : '#dc2626'
              return (
                <>
                  <span>·</span>
                  <Tooltip text={`Porcentaje de candidatos que no valen — descartados o rechazados del proceso. Un valor alto indica mismatch de perfil o proceso muy selectivo. Umbral configurado: ${Math.round(threshold)}%`}>
                    <span style={{ color, fontWeight: 700 }}>✗ {pct}% descarte</span>
                  </Tooltip>
                </>
              )
            })()}
            {item.closingDate && (
              <>
                <span>·</span>
                <span style={{ color: deadline.color, fontWeight: 600 }}>
                  {deadline.isExpired ? '⚠ Cerrada' : `Cierre: ${new Date(item.closingDate).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                </span>
              </>
            )}
            {item.hiringTarget != null && (
              <>
                <span>·</span>
                <span style={{ color: P.muted }}>Obj. {item.hiringTarget}</span>
              </>
            )}
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
        {/* 6-week sparkline */}
        <div style={{ flex: 1, paddingLeft: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
            últimas 6 sem.
          </div>
          <MiniLineChart points={item.weeklyPoints} />
        </div>
      </div>

      {/* ── Estado de candidatos ── */}
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${P.divider}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Estado</div>

        {/* Grouped segmented bar — 5 semantic groups */}
        {allStatuses.length > 0 && (
          <SegmentedStatusBar
            byStatus={Object.fromEntries(allStatuses.map(sc => [sc.status, sc.count]))}
            height={7}
            hoverLabels
          />
        )}

        {/* All status rows */}
        {displayStatuses.length === 0 ? (
          <div style={{ fontSize: 12, color: P.muted }}>Sin datos de estado</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {displayStatuses.map((sc) => {
              const rawPct = (sc.count / total) * 100
              const barPct = Math.max(2, Math.round(rawPct))
              const labelPct = rawPct < 1 ? '<1' : Math.round(rawPct).toString()
              const pal = statusPalette(sc.status)
              return (
                <div key={sc.status} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: pal.bar, flexShrink: 0 }} />
                  <div style={{ width: 148, fontSize: 11, color: P.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }} title={sc.status}>
                    {sc.status}
                  </div>
                  <div style={{ flex: 1, height: 5, borderRadius: 99, background: P.divider, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${barPct}%`, borderRadius: 99, background: pal.bar, transition: 'width 0.4s ease' }} />
                  </div>
                  <div style={{ width: 52, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: pal.text }}>{sc.count}</span>
                    <span style={{ fontSize: 9, fontWeight: 500, color: P.muted }}>{labelPct}%</span>
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

// ─── Sync button ──────────────────────────────────────────────────────────────

type PhaseStatus = 'idle' | 'running' | 'done' | 'error'

interface SyncPhase {
  key: string
  label: string
  status: PhaseStatus
  detail: string | null
}

const INITIAL_PHASES: SyncPhase[] = [
  { key: 'openings', label: 'Vacantes',      status: 'idle', detail: null },
  { key: 'stats',    label: 'Estados',         status: 'idle', detail: null },
]

function SyncZohoVacanciesButton({ onSynced }: { onSynced: () => void }) {
  const [running, setRunning]   = useState(false)
  const [done, setDone]         = useState(false)
  const [phases, setPhases]     = useState<SyncPhase[]>(INITIAL_PHASES.map(p => ({ ...p })))

  function patchPhase(key: string, patch: Partial<SyncPhase>) {
    setPhases(prev => prev.map(p => p.key === key ? { ...p, ...patch } : p))
  }

  async function callPhase(key: string, url: string): Promise<boolean> {
    patchPhase(key, { status: 'running', detail: null })
    try {
      const res  = await fetch(url, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data.error) {
        patchPhase(key, { status: 'error', detail: data.error ?? `HTTP ${res.status}` })
        return false
      }
      const detail = data.synced != null
        ? `${data.synced} actualizadas`
        : data.vacancies_processed != null
          ? `${data.vacancies_processed} vacantes procesadas`
          : null
      patchPhase(key, { status: 'done', detail })
      return true
    } catch (e) {
      patchPhase(key, { status: 'error', detail: String(e) })
      return false
    }
  }

  async function handleSync() {
    setRunning(true)
    setDone(false)
    setPhases(INITIAL_PHASES.map(p => ({ ...p })))

    const ok1 = await callPhase('openings', '/api/admin/sync-zoho-vacancies')
    if (ok1) await callPhase('stats', '/api/admin/sync-vacancy-stats-session?principalsOnly=true')

    setRunning(false)
    setDone(true)
    onSynced()
  }

  const hasError = phases.some(p => p.status === 'error')

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <button
        onClick={handleSync}
        disabled={running}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 7,
          border: `1px solid ${running ? '#cbd5e1' : '#c7d2fe'}`,
          background: running ? '#f8fafc' : '#eff6ff',
          color: running ? '#94a3b8' : P.accent,
          fontWeight: 600, fontSize: 12,
          cursor: running ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s',
        }}
      >
        {running
          ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
          : <RefreshCw size={13} />}
        {running ? 'Sincronizando…' : 'Sincronizar desde Zoho'}
      </button>

      {/* Phase pills — only visible while running or after completion */}
      {(running || done) && phases.map(p => {
        const colors = {
          idle:    { bg: '#f8fafc', border: '#e2e8f0', text: '#94a3b8' },
          running: { bg: '#eff6ff', border: '#bfdbfe', text: P.accent   },
          done:    { bg: '#f0fdf4', border: '#bbf7d0', text: P.green    },
          error:   { bg: '#fef2f2', border: '#fecaca', text: '#dc2626'  },
        }[p.status]
        return (
          <div key={p.key} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 6,
            border: `1px solid ${colors.border}`,
            background: colors.bg, fontSize: 11, fontWeight: 500, color: colors.text,
          }}>
            {p.status === 'running' && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />}
            {p.status === 'done'    && <CheckCircle2 size={11} />}
            {p.status === 'error'   && <XCircle size={11} />}
            <span>{p.label}</span>
            {p.detail && <span style={{ opacity: 0.75 }}>· {p.detail}</span>}
          </div>
        )
      })}

      {done && !hasError && (
        <span style={{ fontSize: 11, color: '#9ca3af' }}>Datos actualizados ✓</span>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ─── Cards-per-row selector ───────────────────────────────────────────────────
const CPR_OPTIONS = [4, 5, 6] as const
type CardsPerRow = (typeof CPR_OPTIONS)[number]

function CardsPerRowSelector({ value, onChange }: { value: CardsPerRow; onChange: (v: CardsPerRow) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, color: P.muted, fontWeight: 500 }}>Por fila:</span>
      {CPR_OPTIONS.map((n) => {
        const active = value === n
        return (
          <button
            key={n}
            onClick={() => onChange(n)}
            style={{
              width: 30, height: 26,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: active ? 700 : 500,
              color: active ? '#ffffff' : P.muted,
              background: active ? P.accent : P.card,
              border: `1px solid ${active ? P.accent : P.border}`,
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'all 0.12s',
            }}
          >
            {n}
          </button>
        )
      })}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const LS_ORDER_KEY = 'atraccion-card-order'
const LS_CPR_KEY   = 'atraccion-cards-per-row'

export default function AtraccionResumen() {
  const [items, setItems]             = useState<ResumenVacanteItem[]>([])
  const [order, setOrder]             = useState<string[]>([])
  const [cardsPerRow, setCardsPerRow] = useState<CardsPerRow>(4)
  const [loading, setLoading]         = useState(true)
  const [hydrated, setHydrated]       = useState(false)

  // ── Hydrate localStorage (client-only, avoids SSR mismatch)
  useEffect(() => {
    try {
      const savedOrder = localStorage.getItem(LS_ORDER_KEY)
      if (savedOrder) setOrder(JSON.parse(savedOrder) as string[])

      const savedCpr = localStorage.getItem(LS_CPR_KEY)
      if (savedCpr) {
        const parsed = parseInt(savedCpr, 10)
        if ((CPR_OPTIONS as readonly number[]).includes(parsed)) {
          setCardsPerRow(parsed as CardsPerRow)
        }
      }
    } catch { /* localStorage unavailable */ }
    setHydrated(true)
  }, [])

  const fetchData = useCallback(() => {
    setLoading(true)
    getResumenAtraccionVacantes().then((data) => {
      setItems(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Derived sorted list: apply saved order, append new items at the end
  const sortedItems = (() => {
    if (order.length === 0) return items
    const idMap = new Map(items.map((i) => [i.id, i]))
    const ordered = order.flatMap((id) => {
      const item = idMap.get(id)
      return item ? [item] : []
    })
    const known = new Set(order)
    const newItems = items.filter((i) => !known.has(i.id))
    return [...ordered, ...newItems]
  })()

  // ── DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const ids = sortedItems.map((i) => i.id)
    const oldIdx = ids.indexOf(active.id as string)
    const newIdx = ids.indexOf(over.id as string)
    const newOrder = arrayMove(ids, oldIdx, newIdx)

    setOrder(newOrder)
    try { localStorage.setItem(LS_ORDER_KEY, JSON.stringify(newOrder)) } catch { /* noop */ }
  }

  function handleCardsPerRowChange(v: CardsPerRow) {
    setCardsPerRow(v)
    try { localStorage.setItem(LS_CPR_KEY, String(v)) } catch { /* noop */ }
  }

  const gridCols = `repeat(${cardsPerRow}, 1fr)`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`@keyframes ar-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }`}</style>

      {/* Toolbar: sync + cards-per-row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <SyncZohoVacanciesButton onSynced={fetchData} />
        {hydrated && !loading && sortedItems.length > 0 && (
          <CardsPerRowSelector value={cardsPerRow} onChange={handleCardsPerRowChange} />
        )}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
          <SkeletonVacancyCard /><SkeletonVacancyCard /><SkeletonVacancyCard />
        </div>
      ) : items.length === 0 ? (
        <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 14, padding: '20px 24px', color: P.muted, fontSize: 13 }}>
          No hay vacantes favoritas. Podés marcarlas en la pestaña Configuración.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortedItems.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 16 }}>
              {sortedItems.map((item) => (
                <SortableVacancyCard key={item.id} item={item} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
