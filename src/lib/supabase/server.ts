import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

type SupabaseAdminClient = ReturnType<typeof createClient<Database>>

let _admin: SupabaseAdminClient | null = null

function getAdmin(): SupabaseAdminClient {
  if (!_admin) {
    _admin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _admin
}

/**
 * Lazy singleton — the client is created on first use, not at module evaluation
 * time. This prevents Next.js from crashing during the build "Collecting page
 * data" phase when env vars haven't been loaded yet.
 */
export const supabaseAdmin = new Proxy({} as SupabaseAdminClient, {
  get(_, prop) {
    return (getAdmin() as any)[prop]
  },
})
