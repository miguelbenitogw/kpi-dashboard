export type VacancyCountry =
  | 'Alemania'
  | 'Noruega'
  | 'Bélgica'
  | 'Holanda'
  | 'Francia'
  | 'España'
  | 'Suiza'
  | 'Italia'
  | 'Interno'
  | 'Otros'

/**
 * Derives the destination country from a vacancy title using keyword matching.
 * Must stay in sync with the SQL function derive_pais_destino() in Supabase.
 * Returns 'Otros' if no match.
 */
export function getVacancyCountry(title: string | null | undefined): VacancyCountry {
  if (!title) return 'Otros'
  const t = title.toLowerCase()
  if (t.includes('alemania') || t.includes('germany') || t.includes('deutsch') || t.includes('alemán') || t.includes('aleman')) return 'Alemania'
  if (t.includes('noruega') || t.includes('norway') || t.includes('norsk') || t.includes('norge') || t.includes('norvegia') || t.includes('norvège') || t.includes('discover norway')) return 'Noruega'
  if (t.includes('bélgica') || t.includes('belgica') || t.includes('belgium') || t.includes('belgique')) return 'Bélgica'
  if (t.includes('holanda') || t.includes('países bajos') || t.includes('paises bajos') || t.includes('netherlands') || t.includes('nederland')) return 'Holanda'
  if (t.includes('francia') || t.includes('france') || t.includes('français') || t.includes('frankreich')) return 'Francia'
  if (t.includes('españa') || t.includes('espana') || t.includes('spain') || t.includes('spagna')) return 'España'
  if (t.includes('suiza') || t.includes('suisse') || t.includes('switzerland') || t.includes('schweiz')) return 'Suiza'
  if (t.includes('italia') || t.includes('italy') || t.includes('italie') || t.includes('italien')) return 'Italia'
  if (t.includes('interno') || t.includes('internal') || t.includes('globalworking') || t.includes('global working')) return 'Interno'
  return 'Otros'
}

export const COUNTRY_COLORS: Record<
  VacancyCountry,
  { bg: string; text: string; border: string }
> = {
  Alemania:  { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  Noruega:   { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
  'Bélgica': { bg: '#fce7f3', text: '#9d174d', border: '#fbcfe8' },
  Holanda:   { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
  Francia:   { bg: '#ede9fe', text: '#5b21b6', border: '#ddd6fe' },
  'España':  { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' },
  Suiza:     { bg: '#f0fdfa', text: '#134e4a', border: '#99f6e4' },
  Italia:    { bg: '#f0fdf4', text: '#14532d', border: '#86efac' },
  Interno:   { bg: '#f5f3ff', text: '#5b21b6', border: '#ddd6fe' },
  Otros:     { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' },
}
