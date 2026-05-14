'use client'

import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X, CalendarDays } from 'lucide-react'
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
  getDay,
} from 'date-fns'
import { es } from 'date-fns/locale'
import type { Institution } from '@/lib/queries/instituciones'

// ─── Tokens ───────────────────────────────────────────────────────────────────

const T = {
  blue: '#1e4b9e',
  border: '#d4cfc6',
  cardBg: '#fff',
  textPrimary: '#1c1917',
  textSecondary: '#44403c',
  textMuted: '#57534e',
  textSubtle: '#78716c',
  // Event cell backgrounds — current
  presencialBg: '#bfdbfe',   // blue-200
  onlineBg: '#bbf7d0',       // green-200
  mixtoBg: '#fde68a',        // amber-200
  // Event cell backgrounds — past
  presencialBgPast: '#dbeafe', // blue-100
  onlineBgPast: '#dcfce7',     // green-100
  mixtoBgPast: '#fef3c7',      // amber-100
  // Event text (dark, high contrast on light cell bg)
  presencialText: '#1e3a8a',  // blue-900
  onlineText: '#14532d',      // green-900
  mixtoText: '#78350f',       // amber-900
  // Chip / label bg (dark pills)
  presencialChip: '#1e3a8a',
  onlineChip: '#14532d',
  mixtoChip: '#78350f',
  // Weekend tint
  weekendBg: '#fdf8f0',
  weekendBgOut: '#f5f0e8',
  // Out of month
  outBg: '#ede9e0',
} as const

// ─── Classification ───────────────────────────────────────────────────────────

function clasificaTipo(tipo: string | null): 'online' | 'presencial' | 'other' {
  if (!tipo) return 'other'
  const t = tipo.toLowerCase()
  const isOnline = t.includes('online') || t.includes('webinar')
  const isPres   = t.includes('presencial')
  if (isOnline)  return 'online'
  if (isPres)    return 'presencial'
  return 'other'
}


function isWeekend(date: Date): boolean {
  const d = getDay(date)
  return d === 0 || d === 6
}

// ─── Profesión colors (borde izquierdo, prominente) ──────────────────────────

const PROF_MIXED_ENF_FIS = '#dc2626'  // red-600

function getProfColor(profesion: string | null): string {
  if (!profesion) return '#78716c'
  const p = profesion.toUpperCase()
  if (p.includes('ENFERMER'))                             return '#1e40af'  // blue-800
  if (p.includes('EDUCACI') && p.includes('INFANTIL'))   return '#166534'  // green-800
  if (p.includes('FISIO'))                               return '#b45309'  // amber-700
  if (p.includes('VETERIN'))                             return '#0369a1'  // sky-700 (celeste)
  return '#78716c'  // stone (otros: Dentistas, Óptica, TO…)
}

/** Rojo si en el mismo día hay tanto Enfermería como Fisioterapia */
function hasMixedEnfFis(insts: Institution[]): boolean {
  const hasEnf = insts.some(i => (i.profesion ?? '').toUpperCase().includes('ENFERMER'))
  const hasFis = insts.some(i => (i.profesion ?? '').toUpperCase().includes('FISIO'))
  return hasEnf && hasFis
}

// ─── Tipo evento colors (borde derecho, tono claro / secundario) ──────────────

function getTipoRightColor(tipo: string | null): string {
  const t = clasificaTipo(tipo)
  if (t === 'presencial') return '#93c5fd'  // blue-300  (claro, para no confundir con ENF)
  if (t === 'online')     return '#6ee7b7'  // emerald-300
  return '#fcd34d'                          // amber-300 / otro
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max) + '…' : s
}

function capitalizeFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  const profItems = [
    { color: '#1e40af',          label: 'Enfermería' },
    { color: '#166534',          label: 'Educ. Infantil' },
    { color: '#b45309',          label: 'Fisioterapia' },
    { color: '#0369a1',          label: 'Veterinaria' },
    { color: PROF_MIXED_ENF_FIS, label: 'Enf. + Fisio.' },
    { color: '#78716c',          label: 'Otros' },
  ]
  const tipoItems = [
    { color: '#93c5fd', label: 'Presencial' },
    { color: '#6ee7b7', label: 'Online / Webinar' },
    { color: '#fcd34d', label: 'Otro tipo' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '7px 16px', borderBottom: `1px solid ${T.border}`, background: '#faf9f7' }}>
      {/* Fila 1: profesión (borde izquierdo) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: T.textSubtle, textTransform: 'uppercase' as const, letterSpacing: '0.5px', minWidth: 56, flexShrink: 0 }}>
          ← Profesión
        </span>
        {profItems.map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: color, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>{label}</span>
          </div>
        ))}
      </div>
      {/* Fila 2: tipo evento (borde derecho) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: T.textSubtle, textTransform: 'uppercase' as const, letterSpacing: '0.5px', minWidth: 56, flexShrink: 0 }}>
          Tipo →
        </span>
        {tipoItems.map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: color, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── EventBlock (non-compact) ─────────────────────────────────────────────────
// Borde izquierdo (4px, oscuro) = profesión
// Borde derecho (2px, claro)   = tipo de evento

interface EventBlockProps {
  inst: Institution
  profBorderColor: string  // calculado a nivel del día (rojo si ENF+FIS mixto)
  past: boolean
  onClick: () => void
}

function EventBlock({ inst, profBorderColor, past, onClick }: EventBlockProps) {
  const rightColor = getTipoRightColor(inst.tipo_evento)
  const tipoTextColor = clasificaTipo(inst.tipo_evento) === 'online'
    ? T.onlineText
    : clasificaTipo(inst.tipo_evento) === 'presencial'
      ? T.presencialText
      : T.mixtoText

  return (
    <div
      role="button"
      tabIndex={0}
      title={`${inst.universidad} · ${inst.tipo_evento ?? ''} · ${inst.profesion ?? ''}`}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onClick() } }}
      style={{
        background: 'rgba(255,255,255,0.88)',
        borderRadius: 4,
        padding: '3px 5px',
        marginBottom: 3,
        cursor: 'pointer',
        opacity: past ? 0.75 : 1,
        borderLeft: `4px solid ${profBorderColor}`,
        borderRight: `2px solid ${rightColor}`,
        userSelect: 'none' as const,
      }}
    >
      {/* Universidad */}
      <div style={{ fontSize: 10, fontWeight: 700, color: T.textPrimary, lineHeight: 1.25, wordBreak: 'break-word' }}>
        {truncate(inst.universidad, 22)}
      </div>
      {/* Tipo evento */}
      {inst.tipo_evento && (
        <div style={{ fontSize: 9, fontWeight: 500, color: tipoTextColor, lineHeight: 1.25, marginTop: 1 }}>
          {truncate(inst.tipo_evento, 24)}
        </div>
      )}
      {/* Compañero */}
      {inst.compañero_asiste && (
        <div style={{ fontSize: 9, color: T.textSubtle, lineHeight: 1.25, marginTop: 1 }}>
          {truncate(inst.compañero_asiste, 20)}
        </div>
      )}
    </div>
  )
}

// ─── CompactChip (compact mode — 3-4 months) ─────────────────────────────────

function CompactChip({ inst, profBorderColor, past, onClick }: EventBlockProps) {
  const label = inst.compañero_asiste?.split(/[\s,y/]+/)[0] ?? inst.tipo_evento ?? '—'

  return (
    <div
      role="button"
      tabIndex={0}
      title={`${inst.universidad} · ${inst.tipo_evento ?? ''} · ${inst.profesion ?? ''}`}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onClick() } }}
      style={{
        background: profBorderColor, color: '#fff',
        borderRadius: 3, padding: '2px 4px',
        fontSize: 8, fontWeight: 700,
        display: 'block', marginBottom: 2,
        opacity: past ? 0.7 : 1,
        cursor: 'pointer', userSelect: 'none' as const,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}
    >
      {truncate(label, 8)}
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

function CharlaPopover({ selectedInst, selectedDay, eventsByDay, onClose, onSelectInst }: PopoverProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!selectedInst && !selectedDay) return null
  const isModeA = selectedInst !== null
  const dayInsts = selectedDay ? (eventsByDay.get(selectedDay) ?? []) : []

  const titleA = selectedInst?.universidad ?? ''
  const subtitleA = [selectedInst?.profesion, selectedInst?.ciudad].filter(Boolean).join(' · ')
  const titleB = selectedDay
    ? `Charlas del ${format(new Date(selectedDay + 'T00:00:00'), "d 'de' MMMM", { locale: es })}`
    : ''

  const fields: Array<{ label: string; value: string | number | null; fullWidth?: boolean }> = [
    { label: 'Fecha charla', value: selectedInst?.fecha_charla_visita ? format(new Date(selectedInst.fecha_charla_visita + 'T00:00:00'), 'dd/MM/yyyy') : null },
    { label: 'Tipo de evento',  value: selectedInst?.tipo_evento ?? null },
    { label: 'Estado',          value: selectedInst?.estado_charla ?? null },
    { label: 'Persona agenda',  value: selectedInst?.persona_contacto_agenda ?? null },
    { label: 'Compañero asiste', value: selectedInst?.compañero_asiste ?? null },
    { label: 'Global Worker',   value: selectedInst?.global_worker_asiste ?? null },
    { label: 'Nº asistentes',   value: selectedInst?.num_asistentes_charla ?? null },
    { label: 'Nº interesados',  value: selectedInst?.num_interesados_firmas ?? null },
    { label: 'Recursos',        value: selectedInst?.recursos_entregados ?? null },
    { label: 'Comentarios',     value: selectedInst?.comentarios ?? null, fullWidth: true },
  ]

  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.28)' }} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', width: 'min(500px, 92vw)', maxHeight: '82vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary, margin: 0, lineHeight: 1.3 }}>
              {isModeA ? titleA : titleB}
            </p>
            {isModeA && subtitleA && (
              <p style={{ fontSize: 12, color: T.textMuted, margin: '3px 0 0', lineHeight: 1.4 }}>{subtitleA}</p>
            )}
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 6, color: T.textSubtle, display: 'flex', alignItems: 'center', flexShrink: 0, borderRadius: 6 }}>
            <X size={16} />
          </button>
        </div>
        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {isModeA ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px', padding: '16px 20px' }}>
              {fields.map(({ label, value, fullWidth }) => {
                if (value == null || value === '') return null
                return (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3, gridColumn: fullWidth ? '1 / -1' : undefined }}>
                    <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{label}</span>
                    <span style={{ fontSize: 13, color: T.textPrimary, fontWeight: 500, lineHeight: 1.4 }}>{String(value)}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div>
              {dayInsts.map(inst => {
                const tipo = clasificaTipo(inst.tipo_evento)
                const chipBg = tipo === 'online' ? T.onlineChip : tipo === 'presencial' ? T.presencialChip : T.mixtoChip
                return (
                  <div key={inst.id} onClick={() => onSelectInst(inst)} style={{ padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f0ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.universidad}</p>
                      <p style={{ fontSize: 11, color: T.textMuted, margin: '2px 0 0' }}>{[inst.profesion, inst.ciudad].filter(Boolean).join(' · ')}</p>
                    </div>
                    <span style={{ fontSize: 10, background: chipBg, color: '#fff', borderRadius: 5, padding: '3px 10px', fontWeight: 700, flexShrink: 0 }}>
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
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })

  const monthLabel = capitalizeFirst(format(month, 'MMMM yyyy', { locale: es }))
  const maxEvents = compact ? 1 : 2
  const minH = compact ? 68 : 100

  const hasEvents = days.some(d => isSameMonth(d, month) && (eventsByDay.get(format(d, 'yyyy-MM-dd'))?.length ?? 0) > 0)

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Month title */}
      <div style={{ textAlign: 'center', padding: compact ? '6px 4px' : '8px', fontWeight: 700, fontSize: compact ? 11 : 13, color: T.textPrimary, borderBottom: `1px solid ${T.border}`, background: '#f7f5f0' }}>
        {monthLabel}
      </div>

      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${T.border}`, background: '#f7f5f0' }}>
        {WEEKDAYS.map((wd, i) => (
          <div key={wd} style={{
            fontSize: compact ? 9 : 11, fontWeight: 700,
            color: i >= 5 ? '#9c7c8a' : '#52525b',
            textAlign: 'center', padding: compact ? '3px 0' : '5px 0',
          }}>
            {wd}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1 }}>
        {!hasEvents ? (
          <div style={{ gridColumn: '1 / -1', padding: '40px 0', textAlign: 'center', color: T.textSubtle }}>
            <CalendarDays size={28} style={{ opacity: 0.35, display: 'block', margin: '0 auto 10px' }} />
            <p style={{ margin: 0, fontSize: compact ? 10 : 12, fontWeight: 500 }}>Sin charlas</p>
          </div>
        ) : (
          days.map((date) => {
            const key = format(date, 'yyyy-MM-dd')
            const inMonth = isSameMonth(date, month)
            const today = isToday(date)
            const past  = isBefore(startOfDay(date), startOfDay(new Date()))
            const weekend = isWeekend(date)
            const dayInsts = eventsByDay.get(key) ?? []
            const visible = dayInsts.slice(0, maxEvents)
            const overflow = dayInsts.length > maxEvents ? dayInsts.length - maxEvents : 0
            const hasAny = dayInsts.length > 0

            // Fondo de celda: uniforme — solo distingue fuera-de-mes y weekend
            const cellBg = !inMonth ? T.outBg : (weekend ? T.weekendBg : T.cardBg)

            // Color de borde izquierdo para los eventos de este día
            // Si hay tanto ENF como FIS → todos se pintan de rojo
            const mixedEnfFis = hasMixedEnfFis(dayInsts)
            const getInstProfColor = (inst: Institution) =>
              mixedEnfFis ? PROF_MIXED_ENF_FIS : getProfColor(inst.profesion)

            // Color del botón de overflow: profesión dominante (o rojo si mixto)
            const overflowColor = mixedEnfFis
              ? PROF_MIXED_ENF_FIS
              : getProfColor(dayInsts[0]?.profesion ?? null)

            const dayNumColor = !inMonth ? '#9e9489' : past ? '#6b7280' : T.textPrimary

            return (
              <div
                key={key}
                onClick={() => {
                  if (!hasAny) return
                  if (dayInsts.length === 1) onSelectInst(dayInsts[0])
                  else onSelectDay(key)
                }}
                style={{
                  borderRight: `1px solid ${T.border}`,
                  borderBottom: `1px solid ${T.border}`,
                  minHeight: minH,
                  padding: compact ? '3px 4px' : '5px 6px',
                  background: cellBg,
                  cursor: hasAny ? 'pointer' : 'default',
                  verticalAlign: 'top',
                  overflow: 'hidden',
                }}
              >
                {/* Day number — punto rojo si ENF+FIS mixto */}
                <div style={{ marginBottom: compact ? 2 : 4, display: 'flex', alignItems: 'center', gap: 3 }}>
                  {today ? (
                    <span style={{ width: compact ? 18 : 21, height: compact ? 18 : 21, borderRadius: '50%', background: T.blue, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: compact ? 9 : 10, fontWeight: 800 }}>
                      {format(date, 'd')}
                    </span>
                  ) : (
                    <span style={{ fontSize: compact ? 9 : 11, fontWeight: 600, color: dayNumColor }}>
                      {format(date, 'd')}
                    </span>
                  )}
                  {mixedEnfFis && (
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: PROF_MIXED_ENF_FIS, display: 'inline-block', flexShrink: 0 }} title="Día con Enfermería + Fisioterapia" />
                  )}
                </div>

                {/* Events */}
                {visible.map(inst => compact
                  ? <CompactChip key={inst.id} inst={inst} profBorderColor={getInstProfColor(inst)} past={past} onClick={() => onSelectInst(inst)} />
                  : <EventBlock  key={inst.id} inst={inst} profBorderColor={getInstProfColor(inst)} past={past} onClick={() => onSelectInst(inst)} />
                )}

                {/* Overflow */}
                {overflow > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelectDay(key) }}
                    style={{ fontSize: compact ? 8 : 9, color: '#fff', background: overflowColor, cursor: 'pointer', padding: '2px 5px', borderRadius: 3, border: 'none', fontWeight: 700, display: 'block', marginTop: 1, opacity: past ? 0.75 : 1 }}
                  >
                    +{overflow} más
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

interface Props { filtered: Institution[] }

export default function InstitutionCalendarView({ filtered }: Props) {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date())
  const [monthCount, setMonthCount] = useState<1 | 2 | 3 | 4>(2)
  const [selectedInst, setSelectedInst] = useState<Institution | null>(null)
  const [selectedDay,  setSelectedDay]  = useState<string | null>(null)

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
    if (monthCount === 1) return capitalizeFirst(format(currentMonth, 'MMMM yyyy', { locale: es }))
    const last = addMonths(currentMonth, monthCount - 1)
    return `${capitalizeFirst(format(currentMonth, 'MMMM', { locale: es }))} — ${capitalizeFirst(format(last, 'MMMM yyyy', { locale: es }))}`
  }, [currentMonth, monthCount])

  const compact = monthCount >= 3

  return (
    <div style={{ background: T.cardBg, borderRadius: 12, border: `1px solid ${T.border}`, overflow: 'hidden', fontFamily: 'inherit' }}>
      <Legend />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${T.border}`, gap: 12 }}>
        <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} aria-label="Mes anterior" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 6, color: T.textMuted, display: 'flex', alignItems: 'center', borderRadius: 6, flexShrink: 0 }}>
          <ChevronLeft size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, justifyContent: 'center', minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {rangeLabel}
          </span>
          {/* Month count toggle */}
          <div style={{ display: 'flex', gap: 2, background: '#ede9e0', borderRadius: 8, padding: 3, flexShrink: 0 }}>
            {([1, 2, 3, 4] as const).map(n => (
              <button key={n} onClick={() => setMonthCount(n)} aria-label={`Ver ${n} mes${n > 1 ? 'es' : ''}`} aria-pressed={monthCount === n}
                style={{ border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: monthCount === n ? T.blue : 'transparent', color: monthCount === n ? '#fff' : T.textSubtle, lineHeight: 1.5, transition: 'background 0.15s, color 0.15s' }}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} aria-label="Mes siguiente" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 6, color: T.textMuted, display: 'flex', alignItems: 'center', borderRadius: 6, flexShrink: 0 }}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Month panels */}
      <div style={{ display: 'flex', overflow: 'hidden' }}>
        {monthsToShow.map((month, idx) => (
          <div key={format(month, 'yyyy-MM')} style={{ flex: 1, minWidth: 0, borderRight: idx < monthsToShow.length - 1 ? `2px solid ${T.border}` : undefined }}>
            <MonthPanel
              month={month}
              eventsByDay={eventsByDay}
              compact={compact}
              onSelectInst={inst => { setSelectedDay(null);  setSelectedInst(inst) }}
              onSelectDay={day  => { setSelectedInst(null); setSelectedDay(day)  }}
            />
          </div>
        ))}
      </div>

      {(selectedInst !== null || selectedDay !== null) && (
        <CharlaPopover
          selectedInst={selectedInst}
          selectedDay={selectedDay}
          eventsByDay={eventsByDay}
          onClose={() => { setSelectedInst(null); setSelectedDay(null) }}
          onSelectInst={inst => { setSelectedDay(null); setSelectedInst(inst) }}
        />
      )}
    </div>
  )
}
