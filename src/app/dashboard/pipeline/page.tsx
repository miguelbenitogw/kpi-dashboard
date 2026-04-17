'use client'

import { useState, useEffect, useCallback } from 'react'
import VacancySelector from '@/components/pipeline/VacancySelector'
import PipelineChart from '@/components/pipeline/PipelineChart'
import CandidateTable from '@/components/pipeline/CandidateTable'
import {
  getJobOpenings,
  getCandidatesByVacancy,
  getPipelineStats,
} from '@/lib/queries/pipeline'
import type { JobOpening, Candidate } from '@/lib/supabase/types'
import type { PipelineStatusCount } from '@/lib/queries/pipeline'

type CandidateRow = Candidate & {
  alert_level: string | null
  days_stuck: number | null
}

export default function PipelinePage() {
  const [vacancies, setVacancies] = useState<JobOpening[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<CandidateRow[]>([])
  const [stats, setStats] = useState<PipelineStatusCount[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)

  // Load vacancies on mount
  useEffect(() => {
    getJobOpenings()
      .then((data) => {
        setVacancies(data)
        if (data.length > 0) {
          setSelectedId(data[0].id)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Load data when vacancy changes
  const loadVacancyData = useCallback(async (id: string) => {
    setLoadingData(true)
    try {
      const [cands, pipeStats] = await Promise.all([
        getCandidatesByVacancy(id),
        getPipelineStats(id),
      ])
      setCandidates(cands)
      setStats(pipeStats)
    } catch (err) {
      console.error('Error loading vacancy data:', err)
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) {
      loadVacancyData(selectedId)
    }
  }, [selectedId, loadVacancyData])

  const selectedVacancy = vacancies.find((v) => v.id === selectedId)

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Pipeline</h1>
        <p className="mt-1 text-gray-400">
          Candidate pipeline by vacancy and status stage.
        </p>
      </div>

      {/* Vacancy selector */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-gray-400">
          Vacancy
        </label>
        <VacancySelector
          vacancies={vacancies}
          selected={selectedId}
          onSelect={setSelectedId}
        />
        {selectedVacancy && (
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-400">
            {selectedVacancy.client_name && (
              <span>
                Client: <span className="text-gray-200">{selectedVacancy.client_name}</span>
              </span>
            )}
            {selectedVacancy.owner && (
              <span>
                Owner: <span className="text-gray-200">{selectedVacancy.owner}</span>
              </span>
            )}
            {selectedVacancy.total_candidates != null && (
              <span>
                Candidates: <span className="text-gray-200">{selectedVacancy.total_candidates}</span>
              </span>
            )}
            {selectedVacancy.hired_count != null && (
              <span>
                Hired: <span className="text-emerald-400">{selectedVacancy.hired_count}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {loadingData ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : selectedId ? (
        <>
          {/* Pipeline chart */}
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-400">
              Pipeline Distribution
            </h2>
            <PipelineChart data={stats} />
          </div>

          {/* Two-column grid */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* Candidate table */}
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6 xl:col-span-2">
              <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-400">
                Candidates ({candidates.length})
              </h2>
              <CandidateTable candidates={candidates} />
            </div>
          </div>

        </>
      ) : (
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-12 text-center text-gray-500">
          Select a vacancy to view its pipeline
        </div>
      )}
    </div>
  )
}
