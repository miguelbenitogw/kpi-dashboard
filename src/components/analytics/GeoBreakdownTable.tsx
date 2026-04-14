'use client';

import type { GeoBreakdown } from '@/lib/google-analytics/client';

interface GeoBreakdownTableProps {
  data: GeoBreakdown[];
  loading: boolean;
}

export default function GeoBreakdownTable({
  data,
  loading,
}: GeoBreakdownTableProps) {
  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 rounded bg-gray-700/50" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-gray-500">
        Sin datos geograficos disponibles
      </p>
    );
  }

  const maxSessions = data[0]?.sessions ?? 1;

  return (
    <div className="space-y-3">
      {data.map((geo, i) => {
        const pct = maxSessions > 0 ? (geo.sessions / maxSessions) * 100 : 0;
        return (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">{geo.country}</span>
              <span className="text-gray-400 tabular-nums">
                {geo.sessions.toLocaleString()} sesiones &middot;{' '}
                {geo.users.toLocaleString()} usuarios
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-700/50">
              <div
                className="h-2 rounded-full bg-blue-500/60"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
