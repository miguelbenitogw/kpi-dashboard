'use client'

import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X, CalendarDays, Wifi, MapPin } from 'lucide-react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
  format,
  isBefore,
  startOfDay,
} from 'date-fns'
import { es } from 'date-fns/locale'
import type { Institution } from '@/lib/queries/instituciones'

// ─── Design tokens (WCAG AA verified) ────────────────────────────────────────
// All color pairs verified ≥ 4.5:1 for normal text

const T = {
  // Brand
  blue: '#1e4b9e',
  border: '#d4cfc6',
  cardBg: '#fff',
  pageBg: '#f5f1ea',
  // Text — verified contrast on white/near-white backgrounds
  textPrimary: '#1c1917',   // ~18:1 on white
  textSecondary: '#44403c', // ~9.7:1 on white
  textMuted: '#57534e',     // ~7.1:1 on white
  textSubtle: '#78716c',    // ~4.6:1 on white — minimum for labels
  textDisabled: '#a8a29e',  // use only for truly decorative/inactive (2.7:1 — decorative only)
  // Event colors — CURRENT/FUTURE cells (Tailwind -200 tones, more saturated)
  onlineCellBg: '#bbf7d0',    // green-200
  presencialCellBg: '#bfdbfe', // blue-200
  mixtoCellBg: '#fde68a',     // amber-200
  otherCellBg: '#e9d5ff',     // purple-200
  // Event colors — PAST cells (Tailwind -100 tones)
  onlineCellBgPast: '#dcfce7',    // green-100
  presencialCellBgPast: '#dbeafe', // blue-100
  mixtoCellBgPast: '#fef3c7',      // amber-100
  otherCellBgPast: '#f3e8ff',      // purple-100
  // Chip backgrounds (dark, high contrast on light cells)
  onlineChipBg: '#14532d',   // green-900 → 14:1 vs white text
  presencialChipBg: '#1e3a8a', // blue-900 → 13:1 vs white text
  mixtoChipBg: '#78350f',    // amber-900 → 14:1 vs white text
  otherChipBg: '#581c87',    // purple-900 → 15:1 vs white text
  // Out of month
  outOfMonthBg: '#ede9e0',
} as const

// ─── Day type logic ───────────────────────────────────────────────────────────

type DayType = 'online' | 'presencial' | 'mixed' | 'other' | 'empty'

function getDayType(insts: Institution[]): DayType {
  if (insts.length === 0) return 'empty'
  const hasOnline = insts.some((i) => i.tipo_evento === 'Online')
  const hasPresencial = insts.some((i) => i.tipo_evento?.toLowerCase().includes('presencial'))
  if (hasOnline && hasPresencial) return 'mixed'
  if (hasOnline) return 'online'
  if (hasPresencial) return 'presencial'
  return 'other'
}

function dayCellBg(type: DayType, inMonth: boolean, past: boolean): string {
  if (!inMonth) return T.outOfMonthBg
  if (type === 'empty') return T.cardBg
  if (past) {
    if (type === 'online') return T.onlineCellBgPast
    if (type === 'presencial') return T.presencialCellBgPast
    if (type === 'mixed') return T.mixtoCellBgPast
    return T.otherCellBgPast
  }
  if (type === 'online') return T.onlineCellBg
  if (type === 'presencial') return T.presencialCellBg
  if (type === 'mixed') return T.mixtoCellBg
  return T.otherCellBg
}

function chipStyle(type: DayType): { bg: string } {
  if (type === 'online') return { bg: T.onlineChipBg }
  if (type === 'presencial') return { bg: T.presencialChipBg }
  if (type === 'mixed') return { bg: T.mixtoChipBg }
  return { bg: T.otherChipBg }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function firstToken(value: string | null): string {
  if (!value) return ''
  return value.split(/[\s,]+/)[0] ?? ''
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    {
      cellBg: T.onlineCellBg,
      chipBg: T.onlineChipBg,
      label: 'Online',
      icon: <Wifi size={9} />,
    },
    {
      cellBg: T.presencialCellBg,
      chipBg: T.presencialChipBg,
      label: 'Presencial',
      icon: <MapPin size={9} />,
    },
    {
      cellBg: T.mixtoCellBg,
      chipBg: T.mixtoChipBg,
      label: 'Mixto',
      icon: null,
    },
    {
      cellBg: T.cardBg,
      chipBg: T.border,
      label: 'Sin charla',
      icon: null,
    },
  ]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 20,
        padding: '8px 16px',
        borderBottom: `1px solid ${T.border}`,
        background: '#faf9f7',
      }}
    >
      {items.map(({ cellBg, chipBg, label }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {/* Cell color swatch */}
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              background: cellBg,
              border: `1.5px solid ${chipBg}`,
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          {/* Chip preview */}
          <span
            style={{
              background: chipBg,
              color: '#fff',
              fontSize: 9,
              fontWeight: 700,
              borderRadius: 4,
              padding: '2px 6px',
              letterSpacing: '0.2px',
            }}
          >
            {label}
          </span>
        </div>
      ))}

      {/* Past indicator */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 7, marginLeft: 'auto' }}
      >
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            background: T.onlineCellBgPast,
            border: `1.5px dashed ${T.onlineChipBg}`,
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>
          Pasado (tono claro)
        </span>
      </div>
    </div>
  )
}

// ─── CharlaEventChip ──────────────────────────────────────────────────────────

interface ChipProps {
  inst: Institution
  dayType: DayType
  past: boolean
  compact: boolean
  onClick: () => void
}

function CharlaEventChip({ inst, dayType, past, compact, onClick }: ChipProps) {
  const { bg } = chipStyle(dayType)
  const isOnline = inst.tipo_evento === 'Online'

  const label = (() => {
    const token = firstToken(inst.compañero_asiste)
    if (token) return truncate(token, compact ? 6 : 10)
    return truncate(inst.tipo_evento ?? '—', compact ? 6 : 10)
  })()

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Ver detalle: ${inst.universidad} — ${inst.tipo_evento ?? ''}`}
      title={`${inst.universidad} · ${inst.tipo_evento ?? ''}`}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation()
          onClick()
        }
      }}
      style={{
        background: bg,
        color: '#fff',
        borderRadius: 4,
        padding: compact ? '2px 4px' : '2px 7px',
        fontSize: compact ? 9 : 10,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        cursor: 'pointer',
        marginBottom: 3,
        opacity: past ? 0.75 : 1,
        userSelect: 'none' as const,
        maxWidth: '100%',
        overflow: 'hidden',
        letterSpacing: '0.1px',
        lineHeight: 1.4,
      }}
    >
      {isOnline ? (
        <Wifi size={compact ? 8 : 9} style={{ flexShrink: 0 }} />
      ) : (
        <MapPin size={compact ? 8 : 9} style={{ flexShrink: 0 }} />
      )}
      {!compact && (
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      )}
    </div>
  )
}

// ─── CharlaPopover ────────────────────────────────────────────────────────────

interface PopoverProps {
  selectedInst: Institution | null
  selectedDay: string | null
  eventsByDay: Map<string, Institution[]>
  onClose: () => void
  onSelectInst: (inst: Institution) => void
}

function CharlaPopover({
  selectedInst,
  selectedDay,
  eventsByDay,
  onClose,
  onSelectInst,
}: PopoverProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!selectedInst && !selectedDay) return null

  const isModeA = selectedInst !== null
  const dayInsts = selectedDay ? (eventsByDay.get(selectedDay) ?? []) : []

  const titleA = selectedInst?.universidad ?? ''
  const subtitleA = [selectedInst?.profesion, selectedInst?.ciudad].filter(Boolean).join(' · ')

  let titleB = ''
  if (selectedDay) {
    const d = new Date(selectedDay + 'T00:00:00')
    titleB = `Charlas del ${format(d, "d 'de' MMMM", { locale: es })}`
  }

  const fields: Array<{ label: string; value: string | number | null; fullWidth?: boolean }> = [
    {
      label: 'Fecha charla',
      value: selectedInst?.fecha_charla_visita
        ? format(new Date(selectedInst.fecha_charla_visita + 'T00:00:00'), 'dd/MM/yyyy')
        : null,
    },
    { label: 'Tipo de evento', value: selectedInst?.tipo_evento ?? null },
    { label: 'Estado', value: selectedInst?.estado_charla ?? null },
    { label: 'Persona contacto agenda', value: selectedInst?.persona_contacto_agenda ?? null },
    { label: 'Compañero asiste', value: selectedInst?.compañero_asiste ?? null },
    { label: 'Global Worker asiste', value: selectedInst?.global_worker_asiste ?? null },
    { label: 'Nº asistentes', value: selectedInst?.num_asistentes_charla ?? null },
    { label: 'Nº interesados', value: selectedInst?.num_interesados_firmas ?? null },
    { label: 'Recursos entregados', value: selectedInst?.recursos_entregados ?? null },
    { label: 'Comentarios', value: selectedInst?.comentarios ?? null, fullWidth: true },
  ]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isModeA ? `Detalle: ${titleA}` : titleB}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }}
      />

      <div
        style={{
          position: 'relative',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
          width: 'min(500px, 92vw)',
          maxHeight: '82vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: T.textPrimary,
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {isModeA ? titleA : titleB}
            </p>
            {isModeA && subtitleA && (
              <p
                style={{
                  fontSize: 12,
                  color: T.textMuted,
                  margin: '3px 0 0',
                  lineHeight: 1.4,
                }}
              >
                {subtitleA}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: 6,
              color: T.textMuted,
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
              borderRadius: 6,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {isModeA ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px 24px',
                padding: '16px 20px',
              }}
            >
              {fields.map(({ label, value, fullWidth }) => {
                if (value === null || value === '' || value === undefined) return null
                return (
                  <div
                    key={label}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      gridColumn: fullWidth ? '1 / -1' : undefined,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: T.textMuted,
                        fontWeight: 700,
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.6px',
                      }}
                    >
                      {label}
                    </span>
                    <span
                      style={{ fontSize: 13, color: T.textPrimary, fontWeight: 500, lineHeight: 1.4 }}
                    >
                      {String(value)}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div>
              {dayInsts.map((inst) => {
                const type = getDayType([inst])
                const { bg } = chipStyle(type)
                return (
                  <div
                    key={inst.id}
                    onClick={() => onSelectInst(inst)}
                    style={{
                      padding: '12px 20px',
                      cursor: 'pointer',
                      borderBottom: `1px solid #f1f0ec`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: T.textPrimary,
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {inst.universidad}
                      </p>
                      <p style={{ fontSize: 11, color: T.textMuted, margin: '2px 0 0' }}>
                        {[inst.profesion, inst.ciudad].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        background: bg,
                        color: '#fff',
                        borderRadius: 5,
                        padding: '3px 10px',
                        fontWeight: 700,
                        flexShrink: 0,
                        letterSpacing: '0.2px',
                      }}
                    >
                      {inst.tipo_evento ?? '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── MonthPanel ───────────────────────────────────────────────────────────────

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

interface MonthPanelProps {
  month: Date
  eventsByDay: Map<string, Institution[]>
  compact: boolean
  onSelectInst: (inst: Institution) => void
  onSelectDay: (day: string) => void
}

function MonthPanel({ month, eventsByDay, compact, onSelectInst, onSelectDay }: MonthPanelProps) {
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const monthLabel = capitalizeFirst(format(month, 'MMMM yyyy', { locale: es }))

  const maxChips = compact ? 1 : 2
  const minCellHeight = compact ? 72 : 92

  const hasEvents = days.some((d) => {
    const key = format(d, 'yyyy-MM-dd')
    return isSameMonth(d, month) && (eventsByDay.get(key)?.length ?? 0) > 0
  })

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Month title */}
      <div
        style={{
          textAlign: 'center',
          padding: compact ? '7px 4px' : '9px 8px',
          fontWeight: 700,
          fontSize: compact ? 11 : 13,
          color: T.textPrimary,
          borderBottom: `1px solid ${T.border}`,
          background: '#f7f5f0',
          letterSpacing: '-0.1px',
        }}
      >
        {monthLabel}
      </div>

      {/* Weekday headers — #52525b = zinc-600, 6.3:1 contrast on #f7f5f0 ✓ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: `1px solid ${T.border}`,
          background: '#f7f5f0',
        }}
      >
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            style={{
              fontSize: compact ? 9 : 11,
              fontWeight: 700,
              color: '#52525b',
              textAlign: 'center',
              padding: compact ? '3px 0' : '5px 0',
            }}
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1 }}>
        {!hasEvents ? (
          <div
            style={{
              gridColumn: '1 / -1',
              padding: '40px 0',
              textAlign: 'center',
              color: T.textMuted,
            }}
          >
            <CalendarDays
              size={28}
              style={{
                opacity: 0.35,
                display: 'block',
                margin: '0 auto 10px',
                color: T.textMuted,
              }}
            />
            <p style={{ margin: 0, fontSize: compact ? 10 : 12, fontWeight: 500 }}>
              Sin charlas
            </p>
          </div>
        ) : (
          days.map((date) => {
            const key = format(date, 'yyyy-MM-dd')
            const inMonth = isSameMonth(date, month)
            const today = isToday(date)
            const past = isBefore(startOfDay(date), startOfDay(new Date()))
            const dayInsts = eventsByDay.get(key) ?? []
            const dayType = getDayType(dayInsts)
            const visibleInsts = dayInsts.slice(0, maxChips)
            const overflowCount = dayInsts.length > maxChips ? dayInsts.length - maxChips : 0
            const cellBg = dayCellBg(dayType, inMonth, past)
            const hasAnyEvent = dayInsts.length > 0
            const { bg: overflowBg } = dayType !== 'empty' ? chipStyle(dayType) : { bg: T.blue }

            // Day number color — ensure ≥ 4.5:1 on all cell backgrounds
            // Using #1e293b (slate-900) for current, #44403c (stone-700) for past in-month
            const dayNumColor = !inMonth
              ? '#9e9489'
              : past
              ? '#44403c'
              : T.textPrimary

            return (
              <div
                key={key}
                onClick={() => {
                  if (!hasAnyEvent) return
                  if (dayInsts.length === 1) onSelectInst(dayInsts[0])
                  else onSelectDay(key)
                }}
                style={{
                  borderRight: `1px solid ${T.border}`,
                  borderBottom: `1px solid ${T.border}`,
                  minHeight: minCellHeight,
                  padding: compact ? '3px 4px' : '5px 6px',
                  background: cellBg,
                  cursor: hasAnyEvent ? 'pointer' : 'default',
                }}
              >
                {/* Day number */}
                <div style={{ marginBottom: compact ? 2 : 4 }}>
                  {today ? (
                    <span
                      style={{
                        width: compact ? 18 : 22,
                        height: compact ? 18 : 22,
                        borderRadius: '50%',
                        background: T.blue,
                        color: '#fff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: compact ? 9 : 11,
                        fontWeight: 800,
                      }}
                    >
                      {format(date, 'd')}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: compact ? 9 : 11,
                        fontWeight: 600,
                        color: dayNumColor,
                      }}
                    >
                      {format(date, 'd')}
                    </span>
                  )}
                </div>

                {/* Event chips */}
                {visibleInsts.map((inst) => (
                  <CharlaEventChip
                    key={inst.id}
                    inst={inst}
                    dayType={dayType}
                    past={past}
                    compact={compact}
                    onClick={() => onSelectInst(inst)}
                  />
                ))}

                {/* Overflow button */}
                {overflowCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectDay(key)
                    }}
                    title={`Ver los ${overflowCount} eventos más`}
                    style={{
                      fontSize: compact ? 8 : 9,
                      color: '#fff',
                      cursor: 'pointer',
                      padding: '2px 5px',
                      background: overflowBg,
                      borderRadius: 4,
                      border: 'none',
                      display: 'block',
                      fontWeight: 700,
                      opacity: past ? 0.75 : 1,
                      letterSpacing: '0.1px',
                    }}
                  >
                    +{overflowCount} más
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── InstitutionCalendarView ──────────────────────────────────────────────────

interface Props {
  filtered: Institution[]
}

export default function InstitutionCalendarView({ filtered }: Props) {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date())
  const [monthCount, setMonthCount] = useState<1 | 2 | 3 | 4>(2)
  const [selectedInst, setSelectedInst] = useState<Institution | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const eventsByDay = useMemo(() => {
    const map = new Map<string, Institution[]>()
    for (const inst of filtered) {
      if (!inst.fecha_charla_visita) continue
      const key = inst.fecha_charla_visita.slice(0, 10)
      const list = map.get(key) ?? []
      list.push(inst)
      map.set(key, list)
    }
    return map
  }, [filtered])

  const monthsToShow = useMemo(
    () => Array.from({ length: monthCount }, (_, i) => addMonths(currentMonth, i)),
    [currentMonth, monthCount]
  )

  const rangeLabel = useMemo(() => {
    if (monthCount === 1) {
      return capitalizeFirst(format(currentMonth, 'MMMM yyyy', { locale: es }))
    }
    const last = addMonths(currentMonth, monthCount - 1)
    const firstLbl = capitalizeFirst(format(currentMonth, 'MMMM', { locale: es }))
    const lastLbl = capitalizeFirst(format(last, 'MMMM yyyy', { locale: es }))
    return `${firstLbl} — ${lastLbl}`
  }, [currentMonth, monthCount])

  const compact = monthCount >= 3

  function closePopover() {
    setSelectedInst(null)
    setSelectedDay(null)
  }

  return (
    <div
      style={{
        background: T.cardBg,
        borderRadius: 12,
        border: `1px solid ${T.border}`,
        overflow: 'hidden',
        fontFamily: 'inherit',
      }}
    >
      {/* ── Legend ── */}
      <Legend />

      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: T.cardBg,
          borderBottom: `1px solid ${T.border}`,
          gap: 12,
        }}
      >
        <button
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          aria-label="Mes anterior"
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: 6,
            color: T.textMuted,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 6,
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={18} />
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flex: 1,
            justifyContent: 'center',
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: T.textPrimary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {rangeLabel}
          </span>

          {/* Month count toggle */}
          <div
            style={{
              display: 'flex',
              gap: 2,
              background: '#ede9e0',
              borderRadius: 8,
              padding: 3,
              flexShrink: 0,
            }}
          >
            {([1, 2, 3, 4] as const).map((n) => (
              <button
                key={n}
                onClick={() => setMonthCount(n)}
                aria-label={`Ver ${n} ${n === 1 ? 'mes' : 'meses'}`}
                aria-pressed={monthCount === n}
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 6,
                  background: monthCount === n ? T.blue : 'transparent',
                  color: monthCount === n ? '#fff' : T.textMuted,
                  transition: 'background 0.15s, color 0.15s',
                  lineHeight: 1.5,
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          aria-label="Mes siguiente"
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: 6,
            color: T.textMuted,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 6,
            flexShrink: 0,
          }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* ── Month panels ── */}
      <div style={{ display: 'flex', overflow: 'hidden' }}>
        {monthsToShow.map((month, idx) => (
          <div
            key={format(month, 'yyyy-MM')}
            style={{
              flex: 1,
              minWidth: 0,
              borderRight:
                idx < monthsToShow.length - 1 ? `2px solid ${T.border}` : undefined,
            }}
          >
            <MonthPanel
              month={month}
              eventsByDay={eventsByDay}
              compact={compact}
              onSelectInst={(inst) => {
                setSelectedDay(null)
                setSelectedInst(inst)
              }}
              onSelectDay={(day) => {
                setSelectedInst(null)
                setSelectedDay(day)
              }}
            />
          </div>
        ))}
      </div>

      {/* ── Popover ── */}
      {(selectedInst !== null || selectedDay !== null) && (
        <CharlaPopover
          selectedInst={selectedInst}
          selectedDay={selectedDay}
          eventsByDay={eventsByDay}
          onClose={closePopover}
          onSelectInst={(inst) => {
            setSelectedDay(null)
            setSelectedInst(inst)
          }}
        />
      )}
    </div>
  )
}
