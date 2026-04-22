/**
 * Shared tag color-coding utilities for the KPI dashboard.
 *
 * Tag prefix semantics:
 *   FR   — Canal de llegada del CV (recruitment source)
 *   CP   — Cómo nos conocieron (how they found us)
 *   GW   — Reclutador de GlobalWorking que gestionó el candidato
 *   ONL/SEMI/PRESEN — Modalidad de la promoción
 */

export type TagPrefix = 'FR' | 'CP' | 'GW' | 'MODALIDAD' | 'OTHER'

/** Returns the Tailwind chip classes for a tag based on its prefix. */
export function tagChipStyle(tag: string): string {
  const upper = tag.toUpperCase()
  if (upper.startsWith('FR ') || upper === 'FR')
    return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
  if (upper.startsWith('CP ') || upper === 'CP')
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  if (upper.startsWith('GW'))
    return 'bg-purple-500/20 text-purple-300 border-purple-500/30'
  if (upper.startsWith('ONL') || upper.startsWith('SEMI') || upper.startsWith('PRESEN'))
    return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
  return 'bg-gray-700/50 text-gray-400 border-gray-600/30'
}

/** Returns the hex fill color for a tag — used in recharts bar/cell fills. */
export function tagColor(tag: string): string {
  const upper = tag.toUpperCase()
  if (upper.startsWith('FR ') || upper === 'FR') return '#6366f1'   // indigo-500
  if (upper.startsWith('CP ') || upper === 'CP') return '#10b981'   // emerald-500
  if (upper.startsWith('GW')) return '#a855f7'                       // purple-500
  if (upper.startsWith('ONL') || upper.startsWith('SEMI') || upper.startsWith('PRESEN'))
    return '#f59e0b'                                                  // amber-500
  return '#6b7280'                                                    // gray-500
}

/** Returns the semantic prefix category for a tag. */
export function tagPrefix(tag: string): TagPrefix {
  const upper = tag.toUpperCase()
  if (upper.startsWith('FR ') || upper === 'FR') return 'FR'
  if (upper.startsWith('CP ') || upper === 'CP') return 'CP'
  if (upper.startsWith('GW')) return 'GW'
  if (upper.startsWith('ONL') || upper.startsWith('SEMI') || upper.startsWith('PRESEN'))
    return 'MODALIDAD'
  return 'OTHER'
}

export interface TagLegendItem {
  prefix: string
  label: string
  color: string      // Tailwind text color class for the prefix label
  dotColor: string   // Tailwind bg color class for the dot indicator
}

export const TAG_LEGEND: TagLegendItem[] = [
  { prefix: 'FR', label: 'Canal llegada CV', color: 'text-indigo-400', dotColor: 'bg-indigo-500' },
  { prefix: 'CP', label: 'Cómo nos conocieron', color: 'text-emerald-400', dotColor: 'bg-emerald-500' },
  { prefix: 'GW', label: 'Reclutador', color: 'text-purple-400', dotColor: 'bg-purple-500' },
  { prefix: 'ONL/SEMI', label: 'Modalidad', color: 'text-amber-400', dotColor: 'bg-amber-500' },
]
