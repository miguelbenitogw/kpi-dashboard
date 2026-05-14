'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Check,
  Clock,
  Sun,
} from 'lucide-react'
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
import type { TeamMember, VacationMemberSummary, CalendarDayEntry } from '@/lib/queries/vacaciones'

type Props = {
  members: TeamMember[]
  summary: VacationMemberSummary[]
  calendarData: CalendarDayEntry[]
  initialYear: number
  initialMonth: number
}

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const DAY_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const TOTAL_DAYS_PER_YEAR = 22

function isoMonday(date: Date): number {
  const d = getDay(date)
  return d === 0 ? 6 : d - 1
}

function firstName(fullName: string): string {
  return fullName.split(' ')[0]
}

export default function VacacionesDashboard({
  members,
  summary,
  calendarData: initialCalendarData,
  initialYear,
  initialMonth,
}: Props) {
  const [year, setYear]                     = useState(initialYear)
  const [month, setMonth]                   = useState(initialMonth)
  const [calendarData, setCalendarData]     = useState<CalendarDayEntry[]>(initialCalendarData)
  const [summaryData, setSummaryData]       = useState<VacationMemberSummary[]>(summary)
  const [loading, setLoading]               = useState(false)

  const fetchCalendar = useCallback(async (y: number, m: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/vacaciones/calendar?year=${y}&month=${m}`)
      if (res.ok) setCalendarData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSummary = useCallback(async (y: number) => {
    try {
      const res = await fetch(`/api/vacaciones/summary?year=${y}`)
      if (res.ok) setSummaryData(await res.json())
    } catch { /* keep previous data on error */ }
  }, [])

  const changeYear = useCallback((y: number) => {
    setYear(y)
    fetchCalendar(y, month)
    fetchSummary(y)
  }, [month, fetchCalendar, fetchSummary])

  const goPrev = () => {
    const nm = month === 1 ? 12 : month - 1
    const ny = month === 1 ? year - 1 : year
    setMonth(nm)
    if (ny !== year) { setYear(ny); fetchSummary(ny) }
    fetchCalendar(ny, nm)
  }

  const goNext = () => {
    const nm = month === 12 ? 1 : month + 1
    const ny = month === 12 ? year + 1 : year
    setMonth(nm)
    if (ny !== year) { setYear(ny); fetchSummary(ny) }
    fetchCalendar(ny, nm)
  }

  const calendarDays = useMemo(() => {
    const first = startOfMonth(new Date(year, month - 1))
    const last  = endOfMonth(first)
    return eachDayOfInterval({ start: first, end: last })
  }, [year, month])

  const leadingBlanks = isoMonday(calendarDays[0])

  const entryMap = useMemo(() => {
    const map = new Map<string, CalendarDayEntry>()
    for (const e of calendarData) map.set(e.date, e)
    return map
  }, [calendarData])

  const totalApproved = summaryData.reduce((s, r) => s + r.approved, 0)
  const totalPending  = summaryData.reduce((s, r) => s + r.pending, 0)

  const onVacationToday = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    return entryMap.get(today)?.members.length ?? 0
  }, [entryMap])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1c1917' }}>
            Vacaciones del Equipo
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#78716c' }}>
            Gestión de días libres y ausencias del equipo interno
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => changeYear(year - 1)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium"
            style={{ border: '1px solid #e7e2d8', background: '#fff', color: '#57534e' }}
          >
            {year - 1}
          </button>
          <span
            className="rounded-lg px-4 py-1.5 text-sm font-bold"
            style={{ background: '#1e4b9e', color: '#fff' }}
          >
            {year}
          </span>
          <button
            onClick={() => changeYear(year + 1)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium"
            style={{ border: '1px solid #e7e2d8', background: '#fff', color: '#57534e' }}
          >
            {year + 1}
          </button>
        </div>
      </div>

      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          icon={<Users className="h-5 w-5" />}
          iconBg="#1e4b9e1a" iconColor="#1e4b9e"
          value={members.length} label="Total miembros"
        />
        <SummaryCard
          icon={<Check className="h-5 w-5" />}
          iconBg="#16a34a1a" iconColor="#16a34a"
          value={totalApproved} label="Días aprobados"
        />
        <SummaryCard
          icon={<Clock className="h-5 w-5" />}
          iconBg="#e55a2b1a" iconColor="#e55a2b"
          value={totalPending} label="Días pendientes"
        />
        <SummaryCard
          icon={<Sun className="h-5 w-5" />}
          iconBg="#f59e0b1a" iconColor="#d97706"
          value={onVacationToday} label="De vacaciones hoy"
        />
      </div>

      {/* ── Calendar ──────────────────────────────────────────────────────── */}
      <div
        className="rounded-xl"
        style={{ background: '#fff', border: '1px solid #e7e2d8', padding: '20px' }}
      >
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={goPrev}
            className="rounded-lg p-1.5"
            style={{ color: '#78716c', border: '1px solid #e7e2d8' }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-base font-semibold" style={{ color: '#1c1917' }}>
            {MONTHS_ES[month - 1]} {year}
          </h2>
          <button
            onClick={goNext}
            className="rounded-lg p-1.5"
            style={{ color: '#78716c', border: '1px solid #e7e2d8' }}
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
              style={{ color: '#78716c' }}
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
            <div key={`b${i}`} style={{ borderTop: '1px solid #e7e2d8' }} />
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
                  minHeight: 76,
                  padding: '4px 3px',
                  borderTop: '1px solid #e7e2d8',
                  background: today ? '#eff6ff' : weekend ? '#faf9f7' : '#fff',
                }}
              >
                <span
                  className="text-xs font-medium inline-flex items-center justify-center"
                  style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: today ? '#1e4b9e' : 'transparent',
                    color: today ? '#fff' : weekend ? '#a8a29e' : '#1c1917',
                    fontWeight: today ? 700 : 500,
                  }}
                >
                  {format(day, 'd')}
                </span>

                {entry && (
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {entry.members.map((m, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-medium rounded px-1 py-px truncate block leading-4"
                        style={{
                          background: m.status === 'Aprobado' ? '#dbeafe' : '#ffedd5',
                          color:      m.status === 'Aprobado' ? '#1e4b9e' : '#c2410c',
                        }}
                      >
                        {firstName(m.name)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3" style={{ borderTop: '1px solid #e7e2d8' }}>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded" style={{ background: '#dbeafe' }} />
            <span className="text-xs" style={{ color: '#57534e' }}>Aprobado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded" style={{ background: '#ffedd5' }} />
            <span className="text-xs" style={{ color: '#57534e' }}>Pendiente</span>
          </div>
        </div>
      </div>

      {/* ── Team summary table ────────────────────────────────────────────── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid #e7e2d8', background: '#fff' }}
      >
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #e7e2d8' }}>
          <h2 className="text-base font-semibold" style={{ color: '#1c1917' }}>
            Resumen del equipo — {year}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f9f7f4' }}>
                {['Nombre', 'Tarde Larga', 'Días Totales', 'Aprobados', 'Pendientes', 'Uso'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: '#78716c', borderBottom: '1px solid #e7e2d8' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((member, idx) => {
                const s = summaryData.find((r) => r.member_id === member.id) ?? {
                  total_days: 0, approved: 0, pending: 0,
                }
                const pct         = Math.min(Math.round((s.total_days / TOTAL_DAYS_PER_YEAR) * 100), 100)
                const approvedPct = Math.min(Math.round((s.approved   / TOTAL_DAYS_PER_YEAR) * 100), 100)
                const pendingPct  = Math.min(
                  Math.round((s.pending / TOTAL_DAYS_PER_YEAR) * 100),
                  100 - approvedPct,
                )

                return (
                  <tr key={member.id} style={{ background: idx % 2 === 0 ? '#fff' : '#faf9f7' }}>
                    <td className="px-5 py-3 font-medium" style={{ color: '#1c1917' }}>
                      {member.name}
                    </td>
                    <td className="px-5 py-3" style={{ color: '#57534e' }}>
                      {member.tarde_larga_dia ?? '—'}
                    </td>
                    <td className="px-5 py-3 tabular-nums font-semibold" style={{ color: '#1c1917' }}>
                      {s.total_days}
                      <span className="text-xs font-normal ml-1" style={{ color: '#a8a29e' }}>
                        / {TOTAL_DAYS_PER_YEAR}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5"
                        style={{ background: '#dbeafe', color: '#1e4b9e' }}
                      >
                        {s.approved}d
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {s.pending > 0 ? (
                        <span
                          className="inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5"
                          style={{ background: '#ffedd5', color: '#c2410c' }}
                        >
                          {s.pending}d
                        </span>
                      ) : (
                        <span style={{ color: '#a8a29e' }}>—</span>
                      )}
                    </td>
                    <td className="px-5 py-3" style={{ minWidth: 140 }}>
                      <div className="flex items-center gap-2">
                        <div
                          className="relative flex-1 rounded-full overflow-hidden"
                          style={{ height: 6, background: '#e7e2d8' }}
                        >
                          <div
                            style={{
                              position: 'absolute', left: 0, top: 0, height: '100%',
                              width: `${approvedPct}%`,
                              background: '#1e4b9e', borderRadius: 99,
                              transition: 'width 400ms ease',
                            }}
                          />
                          {pendingPct > 0 && (
                            <div
                              style={{
                                position: 'absolute', left: `${approvedPct}%`, top: 0, height: '100%',
                                width: `${pendingPct}%`,
                                background: '#e55a2b', borderRadius: 99,
                                transition: 'width 400ms ease',
                              }}
                            />
                          )}
                        </div>
                        <span className="text-xs tabular-nums w-8 text-right" style={{ color: '#78716c' }}>
                          {pct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {members.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm" style={{ color: '#a8a29e' }}>
                    No hay miembros del equipo registrados
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

function SummaryCard({
  icon, iconBg, iconColor, value, label,
}: {
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  value: number
  label: string
}) {
  return (
    <div
      className="rounded-xl p-5 flex items-start gap-4"
      style={{ background: '#fff', border: '1px solid #e7e2d8' }}
    >
      <div
        className="flex items-center justify-center rounded-lg flex-shrink-0"
        style={{ width: 40, height: 40, background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums" style={{ color: '#1c1917' }}>
          {value}
        </p>
        <p className="text-xs mt-0.5" style={{ color: '#78716c' }}>
          {label}
        </p>
      </div>
    </div>
  )
}
