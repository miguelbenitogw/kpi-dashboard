'use client';

import type { LandingPage } from '@/lib/google-analytics/client';

interface TopLandingPagesProps {
  data: LandingPage[];
  loading: boolean;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

export default function TopLandingPages({
  data,
  loading,
}: TopLandingPagesProps) {
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
        Sin datos de landing pages disponibles
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700/50 text-left text-gray-400">
            <th className="pb-3 pr-4 font-medium">Pagina</th>
            <th className="pb-3 px-4 font-medium text-right">Pageviews</th>
            <th className="pb-3 px-4 font-medium text-right">Sesiones</th>
            <th className="pb-3 px-4 font-medium text-right">Bounce Rate</th>
            <th className="pb-3 pl-4 font-medium text-right">Duracion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {data.map((page, i) => (
            <tr key={i} className="text-gray-300 hover:bg-gray-800/30">
              <td className="py-3 pr-4 max-w-xs truncate font-mono text-xs">
                {page.page}
              </td>
              <td className="py-3 px-4 text-right tabular-nums">
                {page.pageviews.toLocaleString()}
              </td>
              <td className="py-3 px-4 text-right tabular-nums">
                {page.sessions.toLocaleString()}
              </td>
              <td className="py-3 px-4 text-right tabular-nums">
                {(page.bounceRate * 100).toFixed(1)}%
              </td>
              <td className="py-3 pl-4 text-right tabular-nums">
                {formatDuration(page.avgDuration)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
