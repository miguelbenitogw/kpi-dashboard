'use client'

import { useEffect, useState } from 'react'
import {
  getPromoVistaGeneral,
  type PromoVistaGeneralRow,
} from '@/lib/queries/formacion'

type PromoFilter = 'active' | 'finished' | 'all'

function fmtN(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('es-ES')
}

function fmtZero(n: number): string {
  return n === 0 ? '—' : n.toLocaleString('es-ES')
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const [year, month, day] = d.split('-')
  return `${day}/${month}/${year}`
}

function PctCell({ value }: { value: number }) {
  const cls =
    value >= 100
      ? 'text-emerald-400'
      : value >= 80
        ? 'text-amber-400'
        : 'text-red-400'
  return <span className={`tabular-nums ${cls}`}>{value.toLocaleString('es-ES')}%</span>
}

const FILTER_LABELS: Record<PromoFilter, string> = {
  active: 'Activas',
  finished: 'Terminadas',
  all: 'Todas',
}

function LoadingSkeleton() {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-max w-full">
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}>
              {Array.from({ length: 30 }).map((_, j) => (
                <td key={j} className="px-2 py-2">
                  <div className="h-4 w-16 animate-pulse rounded bg-gray-700/60" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function PromoVistaGeneral() {
  const [filter, setFilter] = useState<PromoFilter>('active')
  const [rows, setRows] = useState<PromoVistaGeneralRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getPromoVistaGeneral(filter).then((data) => {
      setRows(data)
      setLoading(false)
    })
  }, [filter])

  // ── Totals row ────────────────────────────────────────────────────────────
  const totals = rows.reduce(
    (acc, r) => {
      acc.objetivo_atraccion += r.objetivo_atraccion
      acc.total_aceptados += r.total_aceptados
      acc.objetivo_programa += r.objetivo_programa
      acc.total_programa += r.total_programa
      acc.expectativa_finalizan += r.expectativa_finalizan
      acc.contratos_firmados += r.contratos_firmados ?? 0
      acc.hired += r.hired
      acc.training_finished += r.training_finished
      acc.to_place += r.to_place
      acc.assigned += r.assigned
      acc.in_training += r.in_training
      acc.next_project += r.next_project
      acc.offer_withdrawn += r.offer_withdrawn
      acc.offer_declined += r.offer_declined
      acc.expelled += r.expelled
      acc.transferred += r.transferred
      acc.rejected_by_client += r.rejected_by_client
      acc.exito_total += r.exito_total
      return acc
    },
    {
      objetivo_atraccion: 0,
      total_aceptados: 0,
      objetivo_programa: 0,
      total_programa: 0,
      expectativa_finalizan: 0,
      contratos_firmados: 0,
      hired: 0,
      training_finished: 0,
      to_place: 0,
      assigned: 0,
      in_training: 0,
      next_project: 0,
      offer_withdrawn: 0,
      offer_declined: 0,
      expelled: 0,
      transferred: 0,
      rejected_by_client: 0,
      exito_total: 0,
    }
  )

  const totalsPctAtraccion =
    totals.objetivo_atraccion > 0
      ? Math.round((totals.total_aceptados / totals.objetivo_atraccion) * 10000) / 100
      : 0
  const totalsPctPrograma =
    totals.objetivo_programa > 0
      ? Math.round((totals.total_programa / totals.objetivo_programa) * 10000) / 100
      : 0
  const totalsPctExitoReal =
    totals.total_programa > 0
      ? Math.round((totals.exito_total / totals.total_programa) * 10000) / 100
      : 0

  return (
    <div className="space-y-3">
      {/* ── Filter tabs ── */}
      <div className="flex items-center gap-1.5">
        {(['active', 'finished', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              filter === f
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                : 'border border-gray-600/50 bg-gray-700/40 text-gray-400 hover:bg-gray-700 hover:text-gray-200',
            ].join(' ')}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <LoadingSkeleton />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6 text-center">
          <p className="text-sm text-gray-400">Sin promociones</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-700/50 bg-gray-900/60">
          <table className="min-w-max w-full text-xs">
            <thead className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur">
              {/* ── Group header row ── */}
              <tr className="border-b border-gray-700/40">
                {/* Info cols — no group */}
                <th colSpan={7} className="px-3 py-2" />
                {/* Atracción */}
                <th
                  colSpan={3}
                  className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-indigo-400 border-l border-gray-700/40"
                >
                  Atracción
                </th>
                {/* Programa */}
                <th
                  colSpan={3}
                  className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-blue-400 border-l border-gray-700/40"
                >
                  Programa
                </th>
                {/* Retención */}
                <th
                  colSpan={3}
                  className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-purple-400 border-l border-gray-700/40"
                >
                  Retención
                </th>
                {/* Estado actual */}
                <th
                  colSpan={11}
                  className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 border-l border-gray-700/40"
                >
                  Estado actual
                </th>
                {/* Resultado */}
                <th
                  colSpan={2}
                  className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-emerald-400 border-l border-gray-700/40"
                >
                  Resultado
                </th>
              </tr>

              {/* ── Column header row ── */}
              <tr className="border-b border-gray-700/60 text-[10px] text-gray-400">
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium">Promo</th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium">Modalidad</th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium">País</th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium">Coord.</th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium">Cliente</th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium">Inicio</th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium">Fin</th>
                {/* Atracción */}
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium border-l border-gray-700/40">OBJ.ATRAC</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">ACEP</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">%ATR</th>
                {/* Programa */}
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium border-l border-gray-700/40">OBJ.PROG</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">PROG</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">%PROG</th>
                {/* Retención */}
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium border-l border-gray-700/40">EXPECT.</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">%ÉXITO</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">FIRMADOS</th>
                {/* Estado actual */}
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium border-l border-gray-700/40">Hired</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">TF</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">TP</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Asig</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">IT</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">NP</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">OW</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">OD</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Exp</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Transf</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">RBC</th>
                {/* Resultado */}
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium border-l border-gray-700/40">ÉXITO</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">%ÉX</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-700/20">
              {rows.map((r, i) => (
                <tr
                  key={r.id}
                  className={i % 2 === 0 ? 'bg-gray-800/20' : ''}
                >
                  {/* Info */}
                  <td className="whitespace-nowrap px-3 py-1.5 font-medium text-gray-200">{r.nombre}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-gray-400">{r.modalidad ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-gray-400">{r.pais ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-gray-400">{r.coordinador ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-gray-400">{r.cliente ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-gray-400">{fmtDate(r.fecha_inicio)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-gray-400">{fmtDate(r.fecha_fin)}</td>
                  {/* Atracción */}
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-gray-300 border-l border-gray-700/40">{fmtN(r.objetivo_atraccion)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-gray-300">{fmtN(r.total_aceptados)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right"><PctCell value={r.pct_consecucion_atraccion} /></td>
                  {/* Programa */}
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-gray-300 border-l border-gray-700/40">{fmtN(r.objetivo_programa)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-gray-300">{fmtN(r.total_programa)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right"><PctCell value={r.pct_consecucion_programa} /></td>
                  {/* Retención */}
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-gray-300 border-l border-gray-700/40">{fmtN(r.expectativa_finalizan)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-gray-300">{r.pct_exito_estimado.toLocaleString('es-ES')}%</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-gray-300">{fmtN(r.contratos_firmados)}</td>
                  {/* Estado actual — active */}
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-emerald-300 border-l border-gray-700/40">{fmtZero(r.hired)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-blue-300">{fmtZero(r.training_finished)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-blue-300">{fmtZero(r.to_place)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-blue-300">{fmtZero(r.assigned)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-blue-300">{fmtZero(r.in_training)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-blue-300">{fmtZero(r.next_project)}</td>
                  {/* Estado actual — dropout */}
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-red-300/70">{fmtZero(r.offer_withdrawn)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-red-300/70">{fmtZero(r.offer_declined)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-red-300/70">{fmtZero(r.expelled)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-red-300/70">{fmtZero(r.transferred)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-red-300/70">{fmtZero(r.rejected_by_client)}</td>
                  {/* Resultado */}
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums font-semibold text-emerald-400 border-l border-gray-700/40">{fmtN(r.exito_total)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right"><PctCell value={r.pct_exito_real} /></td>
                </tr>
              ))}
            </tbody>

            {/* ── Footer totals ── */}
            <tfoot>
              <tr className="border-t-2 border-gray-600 bg-gray-800/80 font-semibold text-gray-200">
                <td className="whitespace-nowrap px-3 py-2" colSpan={7}>TOTAL</td>
                {/* Atracción */}
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums border-l border-gray-700/40">{fmtN(totals.objetivo_atraccion)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtN(totals.total_aceptados)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right"><PctCell value={totalsPctAtraccion} /></td>
                {/* Programa */}
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums border-l border-gray-700/40">{fmtN(totals.objetivo_programa)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtN(totals.total_programa)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right"><PctCell value={totalsPctPrograma} /></td>
                {/* Retención */}
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums border-l border-gray-700/40">{fmtN(totals.expectativa_finalizan)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">—</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtN(totals.contratos_firmados)}</td>
                {/* Estado actual */}
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-emerald-300 border-l border-gray-700/40">{fmtZero(totals.hired)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-blue-300">{fmtZero(totals.training_finished)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-blue-300">{fmtZero(totals.to_place)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-blue-300">{fmtZero(totals.assigned)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-blue-300">{fmtZero(totals.in_training)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-blue-300">{fmtZero(totals.next_project)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-red-300/70">{fmtZero(totals.offer_withdrawn)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-red-300/70">{fmtZero(totals.offer_declined)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-red-300/70">{fmtZero(totals.expelled)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-red-300/70">{fmtZero(totals.transferred)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-red-300/70">{fmtZero(totals.rejected_by_client)}</td>
                {/* Resultado */}
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-emerald-400 border-l border-gray-700/40">{fmtN(totals.exito_total)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right"><PctCell value={totalsPctExitoReal} /></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
