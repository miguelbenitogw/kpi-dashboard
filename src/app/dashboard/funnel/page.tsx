'use client';

import { useEffect, useState, useCallback } from 'react';
import { Filter, GitCompareArrows, Users, Target } from 'lucide-react';
import FunnelChart from '@/components/funnel/FunnelChart';
import ConversionTable from '@/components/funnel/ConversionTable';
import SourceEffectiveness from '@/components/funnel/SourceEffectiveness';
import RecruiterComparison from '@/components/funnel/RecruiterComparison';
import {
  getFunnelData,
  getConversionRates,
  getSourceStats,
  getRecruiterStats,
  getFunnelComparison,
  getJobOpenings,
  type FunnelStageData,
  type ConversionRow,
  type SourceStat,
  type RecruiterStat,
} from '@/lib/queries/funnel';

interface JobOption {
  id: string;
  title: string;
  client_name: string | null;
  status: string | null;
  total_candidates: number | null;
}

interface ComparisonData {
  jobOpeningId: string;
  title: string;
  stages: FunnelStageData[];
}

export default function FunnelPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [funnelData, setFunnelData] = useState<FunnelStageData[]>([]);
  const [conversionData, setConversionData] = useState<ConversionRow[]>([]);
  const [sourceData, setSourceData] = useState<SourceStat[]>([]);
  const [recruiterData, setRecruiterData] = useState<RecruiterStat[]>([]);

  // Vacancy comparison
  const [jobOpenings, setJobOpenings] = useState<JobOption[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  // Active section for scroll highlighting
  const [activeSection, setActiveSection] = useState<string>('funnel');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [funnel, conversion, sources, recruiters, jobs] =
        await Promise.all([
          getFunnelData(),
          getConversionRates(),
          getSourceStats(),
          getRecruiterStats(),
          getJobOpenings(),
        ]);

      setFunnelData(funnel);
      setConversionData(conversion);
      setSourceData(sources);
      setRecruiterData(recruiters);
      setJobOpenings(jobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load comparison data when selected jobs change
  useEffect(() => {
    if (selectedJobs.length === 0) {
      setComparisonData([]);
      return;
    }

    let cancelled = false;
    setComparisonLoading(true);

    getFunnelComparison(selectedJobs)
      .then((data) => {
        if (!cancelled) setComparisonData(data);
      })
      .catch(() => {
        if (!cancelled) setComparisonData([]);
      })
      .finally(() => {
        if (!cancelled) setComparisonLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedJobs]);

  const toggleJob = (jobId: string) => {
    setSelectedJobs((prev) => {
      if (prev.includes(jobId)) return prev.filter((id) => id !== jobId);
      if (prev.length >= 3) return prev; // Max 3
      return [...prev, jobId];
    });
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div>
          <div className="h-8 w-48 rounded bg-gray-800" />
          <div className="mt-2 h-5 w-72 rounded bg-gray-800/60" />
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-64 rounded-xl border border-gray-700/50 bg-gray-800/50"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
        <p className="text-red-400">Error loading funnel data: {error}</p>
        <button
          onClick={loadData}
          className="mt-3 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/30"
        >
          Retry
        </button>
      </div>
    );
  }

  // Summary stats
  const totalCandidates = funnelData[0]?.count ?? 0;
  const totalHired = funnelData[funnelData.length - 1]?.count ?? 0;
  const overallRate =
    totalCandidates > 0
      ? Math.round((totalHired / totalCandidates) * 100)
      : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">
          Conversion Funnel
        </h1>
        <p className="mt-1 text-gray-400">
          Recruitment pipeline conversion rates and analysis
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
          <p className="text-sm text-gray-400">Total in Pipeline</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-gray-100">
            {totalCandidates.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
          <p className="text-sm text-gray-400">Total Hired</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-green-400">
            {totalHired.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
          <p className="text-sm text-gray-400">Overall Conversion</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-blue-400">
            {overallRate}%
          </p>
        </div>
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
          <p className="text-sm text-gray-400">Active Sources</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-gray-100">
            {sourceData.length}
          </p>
        </div>
      </div>

      {/* Global Funnel */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-gray-100">
            Global Funnel
          </h2>
        </div>
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
          <FunnelChart data={funnelData} />
        </div>
      </section>

      {/* Conversion Table */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-teal-400" />
          <h2 className="text-lg font-semibold text-gray-100">
            Stage Conversion Rates
          </h2>
        </div>
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
          <ConversionTable data={conversionData} />
        </div>
      </section>

      {/* Vacancy Comparison */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <GitCompareArrows className="h-5 w-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-gray-100">
            Compare by Vacancy
          </h2>
          <span className="text-xs text-gray-500 ml-2">
            Select up to 3 vacancies
          </span>
        </div>
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
          {/* Vacancy selector */}
          <div className="mb-6 flex flex-wrap gap-2">
            {jobOpenings.map((job) => {
              const isSelected = selectedJobs.includes(job.id);
              return (
                <button
                  key={job.id}
                  onClick={() => toggleJob(job.id)}
                  disabled={!isSelected && selectedJobs.length >= 3}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40'
                      : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  {job.title}
                  {job.client_name && (
                    <span className="ml-1 text-gray-500">
                      ({job.client_name})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Comparison funnels */}
          {comparisonLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
              <span className="ml-3 text-gray-400">Loading comparison...</span>
            </div>
          ) : comparisonData.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
              {comparisonData.map((comp) => (
                <div
                  key={comp.jobOpeningId}
                  className="rounded-lg border border-gray-700/30 bg-gray-900/50 p-4"
                >
                  <FunnelChart
                    data={comp.stages}
                    title={comp.title}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-gray-500">
              Select vacancies above to compare their funnels
            </p>
          )}
        </div>
      </section>

      {/* Source Effectiveness */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-gray-100">
            Source Effectiveness
          </h2>
        </div>
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
          <SourceEffectiveness data={sourceData} />
        </div>
      </section>

      {/* Recruiter Performance */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-sky-400" />
          <h2 className="text-lg font-semibold text-gray-100">
            Recruiter Performance
          </h2>
        </div>
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
          <RecruiterComparison data={recruiterData} />
        </div>
      </section>
    </div>
  );
}
