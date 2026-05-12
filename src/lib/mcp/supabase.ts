import { createClient } from '@supabase/supabase-js'

// Uses anon key — tables are closed to direct access via RLS.
// All reads go through SECURITY DEFINER mcp_* functions
// that have GRANT EXECUTE TO anon.
export const mcpSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Thin helper to call a typed RPC and return { data, error }
export async function mcpRpc<T = unknown>(
  fn: string,
  params: Record<string, unknown> = {}
): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await mcpSupabase.rpc(fn, params)
  if (error) return { data: null, error: error.message }
  return { data: data as T, error: null }
}
