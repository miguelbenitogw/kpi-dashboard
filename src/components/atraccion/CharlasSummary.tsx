'use client'

import { useEffect, useState } from 'react'
import { Users2, Presentation, Video, TrendingUp } from 'lucide-react'
import KpiCard from '@/components/dashboard/KpiCard'
import { brandColors, chartTheme } from '@/lib/theme'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

type SummaryResponse = {
  porTemporada: {
    temporada: string
    programa: string
    total_inscritos_charlas: number | null
    total_inscritos_webinars: number | null
    total_inscritos: number | null
    charlas_realizadas: number | null
    total_formacion: number | null
  }[]
  totales: {
    temporadas: number
    totalInscritos: number
    totalEnFormacion: number
    totalCharlasPresenciales: number
    totalInscritosWebinars: number
    conversionRate: number
  }
}

export default function CharlasSummary() {
  const [data, setData] = useState<SummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        // Use the query function directly via a client call.
        const { getCharlasSummary } = await import('@/lib/queries/charlas')
        const result = await getCharlasSummary()
        setData(result as SummaryResponse)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="h-[300px] animate-pulse rounded-xl border border-surface-700/60 bg-surface-850/60" />
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-danger-500/40 bg-danger-500/10 p-5">
        <p className="text-sm text-danger-400">
          Error cargando charlas: {error}
        </p>
      </div>
    )
  }

  if (!data || data.porTemporada.length === 0) {
    return (
      <div className="rounded-xl border border-surface-700/60 bg-surface-850/60 p-6">
        <h2 className="text-lg font-semibold text-gray-100">
          Charlas y Webinars
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          No hay datos cargados todavía. Importá el CSV{' '}
          <code className="rounded bg-surface-800 px-1.5 py-0.5 text-xs text-brand-300">
            Registrados Charlas y Webinars - Total.csv
          </code>{' '}
          vía{' '}
          <code className="rounded bg-surface-800 px-1.5 py-0.5 text-xs text-accent-400">
            POST /api/admin/import-charlas
          </code>
          .
        </p>
      </div>
    )
  }

  // Aggregate per temporada (sum across programas)
  const bySeason = new Map<
    string,
    { temporada: string; presenciales: number; online: number; formacion: number }
  >()
  for (const r of data.porTemporada) {
    const key = r.temporada
    const prev = bySeason.get(key) ?? {
      temporada: key,
      presenciales: 0,
      online: 0,
      formacion: 0,
    }
    prev.presenciales += r.total_inscritos_charlas ?? 0
    prev.online += r.total_inscritos_webinars ?? 0
    prev.formacion += r.total_formacion ?? 0
    bySeason.set(key, prev)
  }
  const chartData = Array.from(bySeason.values()).sort((a, b) =>
    a.temporada.localeCompare(b.temporada),
  )

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-100">
          Charlas y Webinars
        </h2>
        <p className="text-xs text-gray-500">
          {data.totales.temporadas} temporadas ·{' '}
          {data.totales.totalInscritos.toLocaleString('es-AR')} inscripciones
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Charlas presenciales"
          value={data.totales.totalCharlasPresenciales.toLocaleString('es-AR')}
          icon={Presentation}
          status="good"
        />
        <KpiCard
          title="Webinars online"
          value={data.totales.totalInscritosWebinars.toLocaleString('es-AR')}
          icon={Video}
          status="good"
        />
        <KpiCard
          title="A formación"
          value={data.totales.totalEnFormacion.toLocaleString('es-AR')}
          icon={Users2}
          status="good"
        />
        <KpiCard
          title="Conversión → formación"
          value={`${data.totales.conversionRate.toFixed(1)}%`}
          icon={TrendingUp}
          status={
            data.totales.conversionRate >= 5
              ? 'good'
              : data.totales.conversionRate >= 3
                ? 'warning'
                : 'danger'
          }
        />
      </div>

      <div className="mt-6 rounded-xl border border-surface-700/60 bg-surface-850/60 p-5">
        <h3 className="mb-4 text-sm font-semibold text-gray-200">
          Inscripciones por temporada
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <XAxis
              dataKey="temporada"
              tick={chartTheme.axis.tick}
              axisLine={chartTheme.axis.axisLine}
              tickLine={false}
            />
            <YAxis
              tick={chartTheme.axis.tick}
              axisLine={chartTheme.axis.axisLine}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={chartTheme.tooltip.contentStyle}
              labelStyle={chartTheme.tooltip.labelStyle}
              itemStyle={chartTheme.tooltip.itemStyle}
            />
            <Legend wrapperStyle={{ color: brandColors.neutral[400] }} />
            <Bar
              dataKey="presenciales"
              name="Presenciales"
              fill={brandColors.brand[500]}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="online"
              name="Online"
              fill={brandColors.accent[500]}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="formacion"
              name="A formación"
              fill={brandColors.ok[500]}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
