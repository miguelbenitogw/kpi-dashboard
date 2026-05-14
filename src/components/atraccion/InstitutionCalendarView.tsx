'use client'

import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X, CalendarDays, Wifi } from 'lucide-react'
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

// ─── Brand tokens ─────────────────────────────────────────────────────────────

const T = {
  blue: '#1e4b9e',
  orange: '#e55a2b',
  border: '#e7e2d8',
  cardBg: '#fff',
  pageBg: '#f5f1ea',
  textPrimary: '#1c1917',
  textMuted: '#78716c',
  textVeryMuted: '#a8a29e',
  green: '#16a34a',
  greenBg: '#f0fdf4',
  blueBg: '#eff6ff',
  amber: '#d97706',
  red: '#ef4444',
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chipColors(tipoEvento: string | null): { bg: string; color: string } {
  if (tipoEvento === 'Online') return { bg: T.greenBg, color: T.green }
  if (tipoEvento?.toLowerCase().includes('presencial')) return { bg: T.blueBg, color: T.blue }
  return { bg: T.pageBg, color: T.textMuted }
}

function firstToken(value: string | null): string {
  if (!value) return ''
  return value.split(/[\s,]+/)[0] ?? ''
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str
}

// ─── CharlaEventChip ──────────────────────────────────────────────────────────

interface ChipProps {
  inst: Institution
  past: boolean
  onClick: () => void
}

function CharlaEventChip({ inst, past, onClick }: ChipProps) {
  const { bg, color } = chipColors(inst.tipo_evento)
  const isOnline = inst.tipo_evento === 'Online'

  const label = (() => {
    const token = firstToken(inst.compañero_asiste)
    if (token) return truncate(token, 11)
    return truncate(inst.tipo_evento ?? '—', 11)
  })()

  return (
    <div
      onClick={onClick}
      style={{
        background: bg,
        color,
        borderRadius: 4,
        padding: '2px 6px',
        fontSize: 10,
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        cursor: 'pointer',
        marginBottom: 2,
        opacity: past ? 0.55 : 1,
        userSelect: 'none',
      }}
    >
      {isOnline ? (
        <Wifi size={10} style={{ flexShrink: 0 }} />
      ) : (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
            display: 'inline-block',
          }}
        />
      )}
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 90,
        }}
      >
        {label}
      </span>
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

  // Mode A — title & subtitle
  const titleA = selectedInst?.universidad ?? ''
  const subtitleA = [selectedInst?.profesion, selectedInst?.ciudad].filter(Boolean).join(' · ')

  // Mode B — title
  let titleB = ''
  if (selectedDay) {
    const d = new Date(selectedDay + 'T00:00:00')
    const dayLabel = format(d, "d 'de' MMMM", { locale: es })
    titleB = `Charlas del ${dayLabel}`
  }

  // Mode A detail fields
  const fields: Array<{ label: string; value: string | number | null; fullWidth?: boolean }> = [
    { label: 'Fecha charla', value: selectedInst?.fecha_charla_visita ? format(new Date(selectedInst.fecha_charla_visita + 'T00:00:00'), 'dd/MM/yyyy') : null },
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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.18)',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'relative',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          width: 'min(480px, 92vw)',
          maxHeight: '80vh',
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
                fontSize: 14,
                fontWeight: 700,
                color: T.textPrimary,
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {isModeA ? titleA : titleB}
            </p>
            {isModeA && subtitleA && (
              <p style={{ fontSize: 11, color: T.textMuted, margin: '2px 0 0', lineHeight: 1.4 }}>
                {subtitleA}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: 4,
              color: T.textVeryMuted,
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {isModeA ? (
            // Mode A — detail grid
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
                      gap: 2,
                      gridColumn: fullWidth ? '1 / -1' : undefined,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: T.textVeryMuted,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {label}
                    </span>
                    <span style={{ fontSize: 13, color: T.textPrimary, fontWeight: 500 }}>
                      {String(value)}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            // Mode B — day list
            <div>
              {dayInsts.map((inst) => {
                const { bg, color } = chipColors(inst.tipo_evento)
                return (
                  <div
                    key={inst.id}
                    onClick={() => onSelectInst(inst)}
                    style={{
                      padding: '10px 16px',
                      cursor: 'pointer',
                      borderBottom: `1px solid #f1f0ec`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 12,
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
                      <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>
                        {[inst.profesion, inst.ciudad].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        background: bg,
                        color,
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontWeight: 500,
                        flexShrink: 0,
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

// ─── InstitutionCalendarView ──────────────────────────────────────────────────

interface Props {
  filtered: Institution[]
}

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

export default function InstitutionCalendarView({ filtered }: Props) {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date())
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

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const monthLabel = (() => {
    const raw = format(currentMonth, 'MMMM yyyy', { locale: es })
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  })()

  // Check if there are any events in the current month
  const hasEventsThisMonth = Array.from(eventsByDay.keys()).some((key) => {
    const d = new Date(key + 'T00:00:00')
    return isSameMonth(d, currentMonth)
  })

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
      {/* ── Calendar Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: T.cardBg,
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        <button
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: 4,
            color: T.textMuted,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 4,
          }}
        >
          <ChevronLeft size={16} />
        </button>

        <span style={{ fontWeight: 700, fontSize: 15, color: T.textPrimary }}>
          {monthLabel}
        </span>

        <button
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: 4,
            color: T.textMuted,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 4,
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* ── Weekday Headers ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: T.textVeryMuted,
              textAlign: 'center',
              padding: '6px 0',
            }}
          >
            {wd}
          </div>
        ))}
      </div>

      {/* ── Day Grid ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderTop: `1px solid ${T.border}`,
        }}
      >
        {!hasEventsThisMonth ? (
          <div
            style={{
              gridColumn: '1 / -1',
              padding: '48px 0',
              textAlign: 'center',
              color: T.textVeryMuted,
              fontSize: 13,
            }}
          >
            <CalendarDays size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p style={{ margin: 0 }}>
              Sin charlas en {monthLabel.toLowerCase()}
            </p>
          </div>
        ) : (
          days.map((date) => {
            const key = format(date, 'yyyy-MM-dd')
            const inMonth = isSameMonth(date, currentMonth)
            const today = isToday(date)
            const past = isBefore(startOfDay(date), startOfDay(new Date()))
            const dayInsts = eventsByDay.get(key) ?? []
            const overflowCount = dayInsts.length > 2 ? dayInsts.length - 2 : 0
            const visibleInsts = dayInsts.slice(0, 2)

            return (
              <div
                key={key}
                style={{
                  borderRight: `1px solid ${T.border}`,
                  borderBottom: `1px solid ${T.border}`,
                  minHeight: 90,
                  padding: '4px 6px',
                  position: 'relative',
                  verticalAlign: 'top',
                  background: inMonth ? '#fff' : '#faf8f5',
                }}
              >
                {/* Day number */}
                <div style={{ marginBottom: 3 }}>
                  {today ? (
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: T.blue,
                        color: '#fff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      {format(date, 'd')}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: inMonth ? '#57534e' : '#c4b9a8',
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
                    past={past}
                    onClick={() => {
                      setSelectedDay(null)
                      setSelectedInst(inst)
                    }}
                  />
                ))}

                {/* Overflow button */}
                {overflowCount > 0 && (
                  <button
                    onClick={() => {
                      setSelectedInst(null)
                      setSelectedDay(key)
                    }}
                    style={{
                      fontSize: 10,
                      color: T.blue,
                      cursor: 'pointer',
                      padding: '1px 4px',
                      background: T.blueBg,
                      borderRadius: 4,
                      border: 'none',
                      display: 'block',
                      marginTop: 1,
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
