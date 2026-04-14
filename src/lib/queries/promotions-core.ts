/**
 * Core promotions queries.
 *
 * The promotions table is the NUCLEUS of the system — everything connects to it.
 * These queries manage the promotions lifecycle and keep counts in sync.
 */

import { supabase } from '@/lib/supabase/client'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { Promotion, PromotionInsert, PromotionUpdate } from '@/lib/supabase/types'

// Hired-like statuses (mirrors performance.ts)
const HIRED_STATUSES = [
  'Hired',
  'Converted - Temp',
  'Converted - Employee',
  'Permanent Kommune',
  'Temporary Kommune',
  'Permanent Agency',
  'Temporary Agency',
]

// Dropout-related statuses
const DROPOUT_STATUSES = [
  'Offer-Declined',
  'Offer-Withdrawn',
  'Expelled',
  'Transferred',
  'Rejected',
  'Not Valid',
  'Un-Qualified',
]

// Program statuses (started program)
const PROGRAM_STATUSES = [
  'In Training',
  'Training Finished',
  'In Training out of GW',
  'To Place',
  'Assigned',
  'Forward-to-Onboarding',
  ...HIRED_STATUSES,
]

// --- Read queries (use anon client) ---

/**
 * Get all promotions with their calculated counts.
 */
export async function getAllPromotions(): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .order('nombre', { ascending: true })

  if (error) throw error
  return data ?? []
}

/**
 * Get a single promotion by nombre.
 */
export async function getPromotion(nombre: string): Promise<Promotion | null> {
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('nombre', nombre)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * Get only active promotions.
 */
export async function getActivePromotions(): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('is_active', true)
    .order('nombre', { ascending: true })

  if (error) throw error
  return data ?? []
}

// --- Write queries (use admin client) ---

/**
 * Create or update a promotion record.
 * Uses nombre as the conflict key for upsert.
 */
export async function upsertPromotion(
  data: PromotionInsert
): Promise<Promotion> {
  const { data: result, error } = await supabaseAdmin
    .from('promotions')
    .upsert(data, { onConflict: 'nombre' })
    .select()
    .single()

  if (error) throw error
  return result
}

/**
 * Update a promotion by id.
 */
export async function updatePromotion(
  id: string,
  data: PromotionUpdate
): Promise<Promotion> {
  const { data: result, error } = await supabaseAdmin
    .from('promotions')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return result
}

// --- Sync / recalculation ---

export interface SyncPromotionCountsResult {
  synced: number
  errors: string[]
}

/**
 * Recalculate all promotion counts from the candidates table.
 *
 * For each promotion:
 *   - Counts total candidates, hired, dropouts, in program
 *   - Updates the promotions table with fresh counts
 *   - Also links candidates to promotions via promotion_id
 */
export async function syncPromotionsFromCandidates(): Promise<SyncPromotionCountsResult> {
  const result: SyncPromotionCountsResult = { synced: 0, errors: [] }

  // Step 1: get all candidates with a promocion_nombre
  const { data: candidates, error: candError } = await supabaseAdmin
    .from('candidates')
    .select('id, promocion_nombre, current_status')
    .not('promocion_nombre', 'is', null)

  if (candError) {
    result.errors.push(`Failed to fetch candidates: ${candError.message}`)
    return result
  }

  if (!candidates || candidates.length === 0) return result

  // Step 2: get all promotions (for id lookup)
  const { data: promotions, error: promoError } = await supabaseAdmin
    .from('promotions')
    .select('id, nombre')

  if (promoError) {
    result.errors.push(`Failed to fetch promotions: ${promoError.message}`)
    return result
  }

  const promoIdMap = new Map<string, string>()
  for (const p of promotions ?? []) {
    promoIdMap.set(p.nombre, p.id)
  }

  // Step 3: aggregate counts per promo
  const countsMap = new Map<
    string,
    {
      total_candidates: number
      total_aceptados: number
      total_programa: number
      total_hired: number
      total_dropouts: number
      candidateIds: string[]
    }
  >()

  for (const c of candidates) {
    const promo = c.promocion_nombre!
    if (!countsMap.has(promo)) {
      countsMap.set(promo, {
        total_candidates: 0,
        total_aceptados: 0,
        total_programa: 0,
        total_hired: 0,
        total_dropouts: 0,
        candidateIds: [],
      })
    }

    const entry = countsMap.get(promo)!
    entry.total_candidates++
    entry.total_aceptados++ // everyone in the promo was accepted
    entry.candidateIds.push(c.id)

    const status = c.current_status ?? ''
    if (PROGRAM_STATUSES.includes(status)) entry.total_programa++
    if (HIRED_STATUSES.includes(status)) entry.total_hired++
    if (DROPOUT_STATUSES.includes(status)) entry.total_dropouts++
  }

  // Step 4: update each promotion
  for (const [nombre, counts] of countsMap) {
    const promoId = promoIdMap.get(nombre)
    if (!promoId) {
      // Promotion doesn't exist yet — skip (should be created first via import)
      continue
    }

    const { error: updateError } = await supabaseAdmin
      .from('promotions')
      .update({
        total_candidates: counts.total_candidates,
        total_aceptados: counts.total_aceptados,
        total_programa: counts.total_programa,
        total_hired: counts.total_hired,
        total_dropouts: counts.total_dropouts,
        updated_at: new Date().toISOString(),
      })
      .eq('id', promoId)

    if (updateError) {
      result.errors.push(`${nombre}: ${updateError.message}`)
    } else {
      result.synced++
    }

    // Step 5: link candidates to this promotion via promotion_id
    if (counts.candidateIds.length > 0) {
      const { error: linkError } = await supabaseAdmin
        .from('candidates')
        .update({ promotion_id: promoId } as any)
        .in('id', counts.candidateIds)

      if (linkError) {
        result.errors.push(`${nombre} link: ${linkError.message}`)
      }
    }
  }

  return result
}

/**
 * Extract promo number from nombre string.
 * e.g. "Promoción 113" -> 113, "Promo 42 Online" -> 42
 */
export function extractPromoNumber(nombre: string): number | null {
  const match = nombre.match(/\d+/)
  return match ? parseInt(match[0], 10) : null
}
