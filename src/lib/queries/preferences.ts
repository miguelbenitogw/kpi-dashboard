import { supabaseAdmin } from '@/lib/supabase/server'

const USER_KEY = 'default'
const PREFERENCE_TYPE = 'favorite_promos'

interface FavoritePromosValue {
  ids: string[]
}

export async function getFavoritePromos(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('user_preferences')
    .select('value')
    .eq('user_key', USER_KEY)
    .eq('preference_type', PREFERENCE_TYPE)
    .maybeSingle()

  if (error) throw error
  if (!data) return []

  const value = data.value as unknown as FavoritePromosValue
  return Array.isArray(value?.ids) ? value.ids : []
}

export async function addFavoritePromo(jobOpeningId: string): Promise<string[]> {
  const current = await getFavoritePromos()
  if (current.includes(jobOpeningId)) return current

  const updated = [...current, jobOpeningId]
  await upsertFavorites(updated)
  return updated
}

export async function removeFavoritePromo(jobOpeningId: string): Promise<string[]> {
  const current = await getFavoritePromos()
  const updated = current.filter((id) => id !== jobOpeningId)
  await upsertFavorites(updated)
  return updated
}

export async function isFavoritePromo(jobOpeningId: string): Promise<boolean> {
  const ids = await getFavoritePromos()
  return ids.includes(jobOpeningId)
}

async function upsertFavorites(ids: string[]): Promise<void> {
  const value = { ids } as unknown as import('@/lib/supabase/types').Json

  const { error } = await supabaseAdmin
    .from('user_preferences')
    .upsert(
      {
        user_key: USER_KEY,
        preference_type: PREFERENCE_TYPE,
        value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_key,preference_type' }
    )

  if (error) throw error
}
