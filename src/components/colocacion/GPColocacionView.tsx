'use client'

import { useEffect, useState, useTransition } from 'react'
import { ChevronDown, ChevronRight, Users, RefreshCw, Link2 } from 'lucide-react'
import {
  getGPTrainingStatusCounts,
  getGPOpenToCounts,
  getGPCandidatesByStatus,
  getGPCandidatesByOpenTo,
  getGPPromotions,
  type GPStatusCount,
  type GPCandidateSummary,
  type PromoGPSummary,
} from '@/lib/queries/colocacion'
import { refreshGlobalPlacement } from '@/app/dashboard/colocacion/actions'
import PromoLinker from './PromoLinker'

// ── Candidate detail row ──────────────────────────────────────────────────────

function CandidateRow({
  c,
  showStatus,
  showOpenTo,
}: {
  c: GPCandidateSummary
  showStatus: boolean
  showOpenTo: boolean
}) {
  return (
    <tr className="border-t border-surface-700/20">
      <td className="py-1.5 pr-4 text-gray-200">{c.full_name ?? '—'}</td>
      {showOpenTo && <td className="py-1.5 pr-4 text-gray-400">{c.gp_open_to ?? '—'}</td>}
      {showStatus && <td className="py-1.5 pr-4 text-gray-400">{c.gp_training_status ?? '—'}</td>}
      <td className="py-1.5 pr-4 text-gray-400">{c.assigned_agency ?? '—'}</td>
      <td className="py-1.5 pr-4 text-gray-400">{c.gp_availability ?? '—'}</td>
      <td className="py-1.5 text-gray-500">{c.gp_priority ?? '—'}</td>
    </tr>
  )
}

// ── Expandable group row ──────────────────────────────────────────────────────

function GroupRow({
  item,
  isExpanded,
  isLoadingDetail,
  candidates,
  onToggle,
  accentColor,
  showStatusCol,
  showOpenToCol,
}: {
  item: GPStatusCount
  isExpanded: boolean
  isLoadingDetail: boolean
  candidates: GPCandidateSummary[]
  onToggle: (status: string) => void
  accentColor: string
  showStatusCol: boolean
  showOpenToCol: boolean
}) {
  return (
    <>
      <tr
        className="cursor-pointer border-b border-surface-700/30 transition-colors hover:bg-surface-800/60"
        onClick={() => onToggle(item.status)}
      >
        <td className="py-3 pl-4 pr-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </span>
            <span className="text-sm text-gray-200">{item.status}</span>
          </div>
        </td>
        <td className="py-3 pr-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-700/60">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(item.percentage, 100)}%`, backgroundColor: accentColor }}
            />
          </div>
        </td>
        <td className="py-3 pr-2 text-right text-sm font-semibold tabular-nums text-gray-200">{item.count}</td>
        <td className="py-3 pr-4 text-right text-xs tabular-nums text-gray-500">{item.percentage.toFixed(1)}%</td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={4} className="bg-surface-800/30 px-6 pb-4 pt-2">
            {isLoadingDetail ? (
              <div className="flex h-10 items-center justify-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              </div>
            ) : candidates.length === 0 ? (
              <p className="py-2 text-xs text-gray-500">Sin candidatos</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="pb-1.5 text-left font-medium">Nombre</th>
                      {showOpenToCol && <th className="pb-1.5 text-left font-medium">Open To</th>}
                      {showStatusCol && <th className="pb-1.5 text-left font-medium">Status</th>}
                      <th className="pb-1.5 text-left font-medium">Agencia</th>
                      <th className="pb-1.5 text-left font-medium">Disponibilidad</th>
                      <th className="pb-1.5 text-left font-medium">Prioridad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c) => (
                      <CandidateRow key={c.id} c={c} showStatus={showStatusCol} showOpenTo={showOpenToCol} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({
  title,
  subtitle,
  data,
  loading,
  expandedRow,
  candidates,
  candidatesLoading,
  onToggle,
  accentColor,
  showStatusCol,
  showOpenToCol,
}: {
  title: string
  subtitle: string
  data: GPStatusCount[]
  loading: boolean
  expandedRow: string | null
  candidates: GPCandidateSummary[]
  candidatesLoading: boolean
  onToggle: (status: string) => void
  accentColor: string
  showStatusCol: boolean
  showOpenToCol: boolean
}) {
  const total = data.reduce((s, r) => s + r.count, 0)

  return (
    <div className="rounded-xl border border-surface-700/60 bg-surface-850/60">
      <div className="flex items-start justify-between border-b border-surface-700/40 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
          <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-surface-700/40 px-2.5 py-1">
          <Users className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-sm font-semibold tabular-nums text-gray-200">{total}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center px-6 text-center">
          <p className="text-sm text-gray-400">Sin datos</p>
          <p className="mt-1 text-xs text-gray-500">
            Importá el tab Global Placement del Excel Madre para ver datos
          </p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className="pb-2 pl-4 pt-3 text-left text-[10px] font-medium uppercase tracking-wider text-gray-500">Estado</th>
              <th className="pb-2 pt-3 text-left text-[10px] font-medium uppercase tracking-wider text-gray-500">Dist.</th>
              <th className="pb-2 pr-2 pt-3 text-right text-[10px] font-medium uppercase tracking-wider text-gray-500">N</th>
              <th className="pb-2 pr-4 pt-3 text-right text-[10px] font-medium uppercase tracking-wider text-gray-500">%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <GroupRow
                key={item.status}
                item={item}
                isExpanded={expandedRow === item.status}
                isLoadingDetail={expandedRow === item.status && candidatesLoading}
                candidates={expandedRow === item.status ? candidates : []}
                onToggle={onToggle}
                accentColor={accentColor}
                showStatusCol={showStatusCol}
                showOpenToCol={showOpenToCol}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function GPColocacionView() {
  // Promotions
  const [promos, setPromos] = useState<PromoGPSummary[]>([])
  const [selectedPromo, setSelectedPromo] = useState<string>('') // '' = todas
  const [linkerPromo, setLinkerPromo] = useState<PromoGPSummary | null>(null)

  // Counts
  const [statusData, setStatusData] = useState<GPStatusCount[]>([])
  const [openToData, setOpenToData] = useState<GPStatusCount[]>([])
  const [loadingCounts, setLoadingCounts] = useState(true)

  // Status expanded
  const [expandedStatus, setExpandedStatus] = useState<string | null>(null)
  const [statusCandidates, setStatusCandidates] = useState<GPCandidateSummary[]>([])
  const [statusCandLoading, setStatusCandLoading] = useState(false)

  // Open To expanded
  const [expandedOpenTo, setExpandedOpenTo] = useState<string | null>(null)
  const [openToCandidates, setOpenToCandidates] = useState<GPCandidateSummary[]>([])
  const [openToCandLoading, setOpenToCandLoading] = useState(false)

  // Refresh
  const [isPending, startTransition] = useTransition()
  const [refreshMsg, setRefreshMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // ── Load promotions once ──────────────────────────────────────────────────

  useEffect(() => {
    getGPPromotions().then(setPromos)
  }, [])

  // ── Load counts when promo filter changes ─────────────────────────────────

  async function loadCounts(promoName?: string | null) {
    setLoadingCounts(true)
    setExpandedStatus(null)
    setExpandedOpenTo(null)
    const promo = promoName ?? (selectedPromo || null)
    const [s, o] = await Promise.all([
      getGPTrainingStatusCounts(promo),
      getGPOpenToCounts(promo),
    ])
    setStatusData(s)
    setOpenToData(o)
    setLoadingCounts(false)
  }

  useEffect(() => {
    loadCounts(selectedPromo || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPromo])

  // ── Refresh handler ───────────────────────────────────────────────────────

  function handleRefresh() {
    setRefreshMsg(null)
    startTransition(async () => {
      const result = await refreshGlobalPlacement()
      if (result.errors.length === 0 || result.gpUpdated > 0) {
        const parts = []
        if (result.madreUpdated + result.madreInserted > 0)
          parts.push(`Base Datos: ${result.madreUpdated + result.madreInserted}`)
        parts.push(`GP: ${result.gpUpdated} actualizados`)
        if (result.gpNotMatched > 0) parts.push(`${result.gpNotMatched} sin match`)
        setRefreshMsg({ ok: true, text: parts.join(' · ') })
      } else {
        setRefreshMsg({ ok: false, text: result.errors[0] ?? 'Error desconocido' })
      }
      if (result.gpUpdated > 0 || result.madreUpdated > 0) {
        const updatedPromos = await getGPPromotions()
        setPromos(updatedPromos)
        await loadCounts(selectedPromo || null)
      }
    })
  }

  // ── Toggle handlers ───────────────────────────────────────────────────────

  async function handleStatusToggle(status: string) {
    if (expandedStatus === status) { setExpandedStatus(null); return }
    setExpandedStatus(status)
    setStatusCandidates([])
    setStatusCandLoading(true)
    const cands = await getGPCandidatesByStatus(status, selectedPromo || null)
    setStatusCandidates(cands)
    setStatusCandLoading(false)
  }

  async function handleOpenToToggle(openTo: string) {
    if (expandedOpenTo === openTo) { setExpandedOpenTo(null); return }
    setExpandedOpenTo(openTo)
    setOpenToCandidates([])
    setOpenToCandLoading(true)
    const cands = await getGPCandidatesByOpenTo(openTo, selectedPromo || null)
    setOpenToCandidates(cands)
    setOpenToCandLoading(false)
  }

  // ── When promo gets linked, refresh promos list ───────────────────────────

  function handleLinked(jobOpeningId: string | null, title: string | null) {
    if (!linkerPromo) return
    setPromos((prev) =>
      prev.map((p) =>
        p.name === linkerPromo.name
          ? { ...p, linked_job_opening_id: jobOpeningId, linked_job_opening_title: title }
          : p,
      ),
    )
  }

  // ── Derived: current promo object ─────────────────────────────────────────

  const currentPromo = promos.find((p) => p.name === selectedPromo) ?? null

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Promo selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Promoción:</label>
          <select
            value={selectedPromo}
            onChange={(e) => setSelectedPromo(e.target.value)}
            className="rounded-lg border border-surface-600/60 bg-surface-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500/50 focus:outline-none"
          >
            <option value="">Todas ({promos.reduce((s, p) => s + p.count, 0)})</option>
            {promos.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name} ({p.count})
                {p.linked_job_opening_title ? ` — ${p.linked_job_opening_title}` : ' ⚠ sin vincular'}
              </option>
            ))}
          </select>
        </div>

        {/* Link button — only when a specific promo is selected */}
        {selectedPromo && (
          <button
            onClick={() => setLinkerPromo(currentPromo ?? { name: selectedPromo, count: 0, linked_job_opening_id: null, linked_job_opening_title: null })}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              currentPromo?.linked_job_opening_id
                ? 'border-ok-500/30 bg-ok-500/10 text-ok-400 hover:bg-ok-500/20'
                : 'border-warn-500/30 bg-warn-500/10 text-warn-400 hover:bg-warn-500/20'
            }`}
          >
            <Link2 className="h-3.5 w-3.5" />
            {currentPromo?.linked_job_opening_title
              ? currentPromo.linked_job_opening_title
              : 'Vincular vacante Zoho'}
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Refresh feedback */}
        {refreshMsg && (
          <span className={`text-xs ${refreshMsg.ok ? 'text-ok-400' : 'text-danger-400'}`}>
            {refreshMsg.text}
          </span>
        )}

        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg border border-surface-600/60 bg-surface-800/60 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-surface-700/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
          {isPending ? 'Importando…' : 'Actualizar'}
        </button>
      </div>

      {/* ── Two-column GP view ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Status (Training)"
          subtitle={selectedPromo ? selectedPromo : 'Todos los candidatos GP'}
          data={statusData}
          loading={loadingCounts}
          expandedRow={expandedStatus}
          candidates={statusCandidates}
          candidatesLoading={statusCandLoading}
          onToggle={handleStatusToggle}
          accentColor="#6366f1"
          showStatusCol={false}
          showOpenToCol={true}
        />
        <SectionCard
          title="Open To"
          subtitle={selectedPromo ? selectedPromo : 'Todos los candidatos GP'}
          data={openToData}
          loading={loadingCounts}
          expandedRow={expandedOpenTo}
          candidates={openToCandidates}
          candidatesLoading={openToCandLoading}
          onToggle={handleOpenToToggle}
          accentColor="#10b981"
          showStatusCol={true}
          showOpenToCol={false}
        />
      </div>

      {/* ── Promo linker modal ── */}
      {linkerPromo && (
        <PromoLinker
          promocionNombre={linkerPromo.name}
          linkedJobOpeningId={linkerPromo.linked_job_opening_id}
          linkedJobOpeningTitle={linkerPromo.linked_job_opening_title}
          onLinked={handleLinked}
          onClose={() => setLinkerPromo(null)}
        />
      )}
    </div>
  )
}
