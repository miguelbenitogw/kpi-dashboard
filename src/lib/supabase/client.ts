import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

type SupabaseClient = ReturnType<typeof createBrowserClient<Database>>

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!_client) {
    _client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _client
}

/**
 * Lazy singleton — the client is created on first use, not at module evaluation
 * time. This prevents Next.js from crashing during the build "Collecting page
 * data" phase when env vars haven't been loaded yet.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getClient() as any)[prop]
  },
})
