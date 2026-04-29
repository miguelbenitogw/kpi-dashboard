export type TipoVacante = 'atraccion' | 'formacion'

/**
 * Derives whether a vacancy is atraccion or formacion from its title.
 * Must stay in sync with the SQL classification in Supabase (tipo_vacante column).
 * Default: 'atraccion'
 *
 * Rules (first match wins, accent-insensitive):
 * - formacion: formaci, programa, promo, promoci, promozione, promotion,
 *              grupo de formaci, curso, bootcamp, masterclass, jornada,
 *              taller, practicas, convocatoria, inserci, orientaci, fp dual
 * - atraccion: everything else (BBDD, country destinations, role titles, etc.)
 */
export function deriveTipoVacante(title: string | null | undefined): TipoVacante {
  if (!title) return 'atraccion'
  const t = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

  if (
    /formaci/.test(t) ||
    /programa/.test(t) ||
    /(^|\s)promo(\s|$|[0-9]|\-)/.test(t) ||
    /promoci/.test(t) ||
    /promozione/.test(t) ||
    /promotion/.test(t) ||
    /grupo\s+(de\s+)?formaci/.test(t) ||
    /\bcurso\b/.test(t) ||
    /bootcamp/.test(t) ||
    /masterclass/.test(t) ||
    /jornada/.test(t) ||
    /taller\s/.test(t) ||
    /practicas/.test(t) ||
    /convocatoria/.test(t) ||
    /inserci/.test(t) ||
    /orientaci/.test(t) ||
    /\bfp\s+dual\b/.test(t)
  ) {
    return 'formacion'
  }

  return 'atraccion'
}

export const TIPO_VACANTE_LABELS: Record<TipoVacante, string> = {
  atraccion: 'Atracción',
  formacion: 'Formación',
}
