import { supabaseAdmin } from '@/lib/supabase/server'

const USER_KEY = 'default'

type FavoriteType = 'favorite_promos' | 'favorite_vacancies'

interface FavoriteIdsValue {
  ids: string[]
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

async function getFavoriteIds(preferenceType: FavoriteType): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('user_preferences')
    .select('value')
    .eq('user_key', USER_KEY)
    .eq('preference_type', preferenceType)
    .maybeSingle()

  if (error) throw error
  if (!data) return []

  const value = data.value as unknown as FavoriteIdsValue
  return Array.isArray(value?.ids) ? value.ids : []
}

async function addFavoriteId(
  preferenceType: FavoriteType,
  id: string
): Promise<string[]> {
  const current = await getFavoriteIds(preferenceType)
  if (current.includes(id)) return current

  const updated = [...current, id]
  await upsertFavoriteIds(preferenceType, updated)
  return updated
}

async function removeFavoriteId(
  preferenceType: FavoriteType,
  id: string
): Promise<string[]> {
  const current = await getFavoriteIds(preferenceType)
  const updated = current.filter((existing) => existing !== id)
  await upsertFavoriteIds(preferenceType, updated)
  return updated
}

async function upsertFavoriteIds(
  preferenceType: FavoriteType,
  ids: string[]
): Promise<void> {
  const value = { ids } as unknown as import('@/lib/supabase/types').Json

  const { error } = await supabaseAdmin
    .from('user_preferences')
    .upsert(
      {
        user_key: USER_KEY,
        preference_type: preferenceType,
        value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_key,preference_type' }
    )

  if (error) throw error
}

// ---------------------------------------------------------------------------
// Promos
// ---------------------------------------------------------------------------

export async function getFavoritePromos(): Promise<string[]> {
  return getFavoriteIds('favorite_promos')
}

export async function addFavoritePromo(jobOpeningId: string): Promise<string[]> {
  return addFavoriteId('favorite_promos', jobOpeningId)
}

export async function removeFavoritePromo(jobOpeningId: string): Promise<string[]> {
  return removeFavoriteId('favorite_promos', jobOpeningId)
}

export async function isFavoritePromo(jobOpeningId: string): Promise<boolean> {
  const ids = await getFavoritePromos()
  return ids.includes(jobOpeningId)
}

// ---------------------------------------------------------------------------
// Vacancies (Atraccion)
// ---------------------------------------------------------------------------

export async function getFavoriteVacancies(): Promise<string[]> {
  return getFavoriteIds('favorite_vacancies')
}

export async function addFavoriteVacancy(jobOpeningId: string): Promise<string[]> {
  return addFavoriteId('favorite_vacancies', jobOpeningId)
}

export async function removeFavoriteVacancy(jobOpeningId: string): Promise<string[]> {
  return removeFavoriteId('favorite_vacancies', jobOpeningId)
}
