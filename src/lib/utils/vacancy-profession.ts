export type TipoProfesional = string

/**
 * Derives the professional type from a vacancy title using keyword matching.
 * Must stay in sync with the SQL function derive_profesion_tipo() in Supabase.
 *
 * Order matters — more specific patterns come first.
 * Returns 'otro' if no match.
 */
export function deriveProfesionTipo(title: string | null | undefined): string {
  if (!title) return 'otro'
  // Strip diacritics for accent-insensitive matching
  const t = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

  if (/auxiliar|tapsd|cuidador|gerocult/.test(t)) return 'auxiliar_enfermeria'
  if (/enferm|infermier|infirmier|nurs|enfermeiro|sjukepleier/.test(t)) return 'enfermero'
  if (/medic|doctor|physician|lege/.test(t)) return 'medico'
  if (/fisioterap|physiother/.test(t)) return 'fisioterapeuta'
  if (/primaria|primary/.test(t)) return 'maestro_primaria'
  if (/infantil|educador/.test(t)) return 'maestro_infantil'
  if (/farmaceut|pharma/.test(t)) return 'farmaceutico'
  if (/ingenier|engineer/.test(t)) return 'ingeniero'
  if (/electric/.test(t)) return 'electricista'
  if (/conductor|driver|chauf/.test(t)) return 'conductor'
  return 'otro'
}

export const PROFESION_LABELS: Record<string, string> = {
  enfermero:           'Enfermero/a',
  auxiliar_enfermeria: 'Auxiliar de Enfermería',
  medico:              'Médico/a',
  fisioterapeuta:      'Fisioterapeuta',
  maestro_primaria:    'Maestro/a Primaria',
  maestro_infantil:    'Maestro/a Infantil',
  farmaceutico:        'Farmacéutico/a',
  ingeniero:           'Ingeniero/a',
  electricista:        'Electricista',
  conductor:           'Conductor/a',
  otro:                'Otro',
}

export const PROFESION_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  enfermero:           { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
  auxiliar_enfermeria: { bg: '#ede9fe', text: '#5b21b6', border: '#ddd6fe' },
  medico:              { bg: '#dcfce7', text: '#14532d', border: '#86efac' },
  fisioterapeuta:      { bg: '#f0fdfa', text: '#134e4a', border: '#99f6e4' },
  maestro_primaria:    { bg: '#fef9c3', text: '#713f12', border: '#fef08a' },
  maestro_infantil:    { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  farmaceutico:        { bg: '#fce7f3', text: '#9d174d', border: '#fbcfe8' },
  ingeniero:           { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
  electricista:        { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
  conductor:           { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
  otro:                { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' },
}
