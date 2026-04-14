'use client';

import { Activity, Users, Eye, ArrowDownUp, Clock } from 'lucide-react';
import type { OverviewMetrics } from '@/lib/google-analytics/client';

interface AnalyticsKpiCardsProps {
  data: OverviewMetrics | null;
  loading: boolean;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

export default function AnalyticsKpiCards({
  data,
  loading,
}: AnalyticsKpiCardsProps) {
  const cards = [
    {
      label: 'Sesiones',
      value: data?.sessions.toLocaleString() ?? '0',
      icon: Activity,
      color: 'text-blue-400',
    },
    {
      label: 'Usuarios',
      value: data?.users.toLocaleString() ?? '0',
      icon: Users,
      color: 'text-green-400',
    },
    {
      label: 'Pageviews',
      value: data?.pageviews.toLocaleString() ?? '0',
      icon: Eye,
      color: 'text-purple-400',
    },
    {
      label: 'Bounce Rate',
      value: data ? `${(data.bounceRate * 100).toFixed(1)}%` : '0%',
      icon: ArrowDownUp,
      color: 'text-amber-400',
    },
    {
      label: 'Duracion Promedio',
      value: data ? formatDuration(data.avgSessionDuration) : '0s',
      icon: Clock,
      color: 'text-teal-400',
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-gray-700/50 bg-gray-800/50 p-5"
          >
            <div className="h-4 w-20 rounded bg-gray-700" />
            <div className="mt-3 h-8 w-24 rounded bg-gray-700" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5"
          >
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${card.color}`} />
              <p className="text-sm text-gray-400">{card.label}</p>
            </div>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-gray-100">
              {card.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}
