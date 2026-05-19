'use client'

import { useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  format,
  isToday,
  isSaturday,
  isSunday,
} from 'date-fns'
import type { PlacementScheduleEntry, PlacementMemberSummary } from '@/lib/queries/placement'

// ─── Palette ──────────────────────────────────────────────────────────────────
const P = {
  bg: '#faf9f7',
  card: '#ffffff',
  border: '#e7e2d8',
  text: '#1c1917',
  muted: '#78716c',
  mutedLight: '#a8a29e',
  online: '#8e7cc3',
  onlineBg: '#f0ecfb',
  presencial: '#d97706',
  presencialBg: '#fef3c7',
  holiday: '#46bdc6',
  holidayBg: '#e0f7f8',
}

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const DAY_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function isoMonday(date: Date): number {
  const d = getDay(date)
  return d === 0 ? 6 : d - 1
}

function firstName(fullName: string): string {
  return fullName.split(' ')[0]
}

function formatTime(t: string | null): string {
  if (!t) return ''
  return t.slice(0, 5)
}

function timeRange(start: string | null, end: string | null): string {
  if (!start && !end) return ''
  if (start && end) return `${formatTime(start)}–${formatTime(end)}`
  if (start) return formatTime(start)
  return ''
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  initialCalendar: PlacementScheduleEntry[]
  initialSummary:  PlacementMemberSummary[]
  initialYear:     number
  initialMonth:    number
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PlacementDashboard({
  initialCalendar,
  initialSummary,
  initialYear,
  initialMonth,
}: Props) {
  const [year,     setYear]     = useState(initialYear)
  const [month,    setMonth]    = useState(initialMonth)
  const [calendar, setCalendar] = useState<PlacementScheduleEntry[]>(initialCalendar)
  const [summary,  setSummary]  = useState<PlacementMemberSummary[]>(initialSummary)
  const [loading,  setLoading]  = useState(false)

  const fetchData = useCallback(async (y: number, m: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/placement/calendar?year=${y}&month=${m}`)
      if (res.ok) {
        const json = await res.json()
        setCalendar(json.calendar ?? [])
        setSummary(json.summary   ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const goPrev = () => {
    const nm = month === 1  ? 12 : month - 1
    const ny = month === 1  ? year - 1 : year
    setMonth(nm)
    setYear(ny)
    fetchData(ny, nm)
  }

  const goNext = () => {
    const nm = month === 12 ? 1 : month + 1
    const ny = month === 12 ? year + 1 : year
    setMonth(nm)
    setYear(ny)
    fetchData(ny, nm)
  }

  // ── Calendar days ──────────────────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const first = startOfMonth(new Date(year, month - 1))
    const last  = endOfMonth(first)
    return eachDayOfInterval({ start: first, end: last })
  }, [year, month])

  const leadingBlanks = isoMonday(calendarDays[0])

  const entryMap = useMemo(() => {
    const map = new Map<string, PlacementScheduleEntry>()
    for (const e of calendar) map.set(e.date, e)
    return map
  }, [calendar])

  // ── Summary totals ─────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    return summary.reduce(
      (acc, s) => ({
        total:     acc.total     + s.total_days,
        online:    acc.online    + s.online_days,
        presencial: acc.presencial + s.presencial_days,
        holiday:   acc.holiday   + s.holiday_days,
      }),
      { total: 0, online: 0, presencial: 0, holiday: 0 },
    )
  }, [summary])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1c1917' }}>
          Calendario de Placement
        </h1>
        <p className="text-sm mt-0.5" style={{ color: P.muted }}>
          Horarios y modalidades del equipo de placement
        </p>
      </div>

      {/* ── Summary strip ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          label="Días este mes"
          value={totals.total}
          color="#1c1917"
          bg="#f5f1ea"
        />
        <SummaryCard
          label="Online"
          value={totals.online}
          color={P.online}
          bg={P.onlineBg}
          dot={P.online}
        />
        <SummaryCard
          label="Presencial"
          value={totals.presencial}
          color={P.presencial}
          bg={P.presencialBg}
          dot={P.presencial}
        />
        <SummaryCard
          label="Holiday"
          value={totals.holiday}
          color={P.holiday}
          bg={P.holidayBg}
          dot={P.holiday}
        />
      </div>

      {/* ── Calendar ────────────────────────────────────────────────────────── */}
      <div
        className="rounded-xl"
        style={{ background: P.card, border: `1px solid ${P.border}`, padding: '20px' }}
      >
        {/* Month nav */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={goPrev}
            className="rounded-lg p-1.5"
            style={{ color: P.muted, border: `1px solid ${P.border}` }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-base font-semibold" style={{ color: '#1c1917' }}>
            {MONTHS_ES[month - 1]} {year}
          </h2>
          <button
            onClick={goNext}
            className="rounded-lg p-1.5"
            style={{ color: P.muted, border: `1px solid ${P.border}` }}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_HEADERS.map((d) => (
            <div
              key={d}
              className="text-center text-xs font-semibold py-1.5 uppercase tracking-wide"
              style={{ color: P.muted }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div
          className="grid grid-cols-7"
          style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 200ms' }}
        >
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <div key={`b${i}`} style={{ borderTop: `1px solid ${P.border}` }} />
          ))}

          {calendarDays.map((day) => {
            const key     = format(day, 'yyyy-MM-dd')
            const entry   = entryMap.get(key)
            const weekend = isSaturday(day) || isSunday(day)
            const today   = isToday(day)

            return (
              <div
                key={key}
                style={{
                  minHeight: 90,
                  padding: '4px 3px',
                  borderTop: `1px solid ${P.border}`,
                  background: today ? '#eff6ff' : weekend ? P.bg : P.card,
                }}
              >
                {/* Day number */}
                <span
                  className="text-xs font-medium inline-flex items-center justify-center"
                  style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: today ? '#1e4b9e' : 'transparent',
                    color: today ? '#fff' : weekend ? P.mutedLight : P.text,
                    fontWeight: today ? 700 : 500,
                  }}
                >
                  {format(day, 'd')}
                </span>

                {/* Members */}
                {entry && (
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {entry.members.map((m, i) => {
                      const isHoliday    = m.status?.toLowerCase() === 'holiday'
                      const isPresencial = m.modality?.toLowerCase() === 'presencial'
                      const range        = timeRange(m.time_start, m.time_end)

                      let bg    = P.onlineBg
                      let color = P.online
                      let borderL = P.online
                      if (isHoliday) {
                        bg = P.holidayBg; color = P.holiday; borderL = P.holiday
                      } else if (isPresencial) {
                        bg = P.presencialBg; color = P.presencial; borderL = P.presencial
                      }

                      return (
                        <div
                          key={i}
                          title={`${m.name}${range ? ' · ' + range : ''}${m.notes ? ' · ' + m.notes : ''}`}
                          style={{
                            fontSize: 9,
                            fontWeight: 600,
                            borderRadius: 3,
                            padding: '1px 4px',
                            background: bg,
                            color: color,
                            borderLeft: `2px solid ${borderL}`,
                            lineHeight: 1.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            cursor: 'default',
                          }}
                        >
                          {firstName(m.name)}
                          {isHoliday ? ' 🎉' : ''}
                          {range ? (
                            <span style={{ fontWeight: 400, opacity: 0.85 }}> {range}</span>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3" style={{ borderTop: `1px solid ${P.border}` }}>
          <LegendItem color={P.online}    bg={P.onlineBg}    label="Online" />
          <LegendItem color={P.presencial} bg={P.presencialBg} label="Presencial" />
          <LegendItem color={P.holiday}   bg={P.holidayBg}   label="Holiday" />
        </div>
      </div>

      {/* ── Member summary table ─────────────────────────────────────────────── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: `1px solid ${P.border}`, background: P.card }}
      >
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${P.border}` }}>
          <h2 className="text-base font-semibold" style={{ color: '#1c1917' }}>
            Resumen del equipo — {MONTHS_ES[month - 1]} {year}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f9f7f4' }}>
                {['Nombre', 'Total días', 'Online', 'Presencial', 'Holiday'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: P.muted, borderBottom: `1px solid ${P.border}` }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.map((s, idx) => (
                <tr key={s.member_id} style={{ background: idx % 2 === 0 ? P.card : P.bg }}>
                  <td className="px-5 py-3 font-medium" style={{ color: '#1c1917' }}>
                    {s.member_name}
                  </td>
                  <td className="px-5 py-3 tabular-nums font-semibold" style={{ color: '#1c1917' }}>
                    {s.total_days}
                  </td>
                  <td className="px-5 py-3">
                    {s.online_days > 0 ? (
                      <span
                        style={{
                          fontSize: 12, fontWeight: 600,
                          background: P.onlineBg, color: P.online,
                          borderRadius: 99, padding: '2px 10px',
                        }}
                      >
                        {s.online_days}
                      </span>
                    ) : (
                      <span style={{ color: P.mutedLight }}>—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {s.presencial_days > 0 ? (
                      <span
                        style={{
                          fontSize: 12, fontWeight: 600,
                          background: P.presencialBg, color: P.presencial,
                          borderRadius: 99, padding: '2px 10px',
                        }}
                      >
                        {s.presencial_days}
                      </span>
                    ) : (
                      <span style={{ color: P.mutedLight }}>—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {s.holiday_days > 0 ? (
                      <span
                        style={{
                          fontSize: 12, fontWeight: 600,
                          background: P.holidayBg, color: P.holiday,
                          borderRadius: 99, padding: '2px 10px',
                        }}
                      >
                        {s.holiday_days}
                      </span>
                    ) : (
                      <span style={{ color: P.mutedLight }}>—</span>
                    )}
                  </td>
                </tr>
              ))}

              {summary.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm" style={{ color: P.mutedLight }}>
                    Sin datos para este mes
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  color,
  bg,
  dot,
}: {
  label: string
  value: number
  color: string
  bg: string
  dot?: string
}) {
  return (
    <div
      className="rounded-xl p-5 flex items-center gap-4"
      style={{ background: '#ffffff', border: '1px solid #e7e2d8' }}
    >
      {dot && (
        <span
          style={{
            width: 12, height: 12, borderRadius: '50%',
            background: dot, flexShrink: 0,
          }}
        />
      )}
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums" style={{ color }}>
          {value}
        </p>
        <p className="text-xs mt-0.5" style={{ color: '#78716c' }}>
          {label}
        </p>
      </div>
    </div>
  )
}

function LegendItem({
  color,
  bg,
  label,
}: {
  color: string
  bg: string
  label: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        style={{
          display: 'inline-block', width: 10, height: 10,
          borderRadius: 2, background: bg,
          border: `1.5px solid ${color}`,
        }}
      />
      <span className="text-xs" style={{ color: '#57534e' }}>{label}</span>
    </div>
  )
}
