import { NextResponse } from 'next/server'
import { validateApiKey, unauthorizedResponse } from '../../sync/middleware'
import { supabaseAdmin } from '@/lib/supabase/server'
import { createServerSupabaseClient } from '@/lib/supabase/server-auth'
import { searchModule } from '@/lib/zoho/direct-queries'

export const maxDuration = 300

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LinkedRow = {
  table: string
  id: string | number
  nombre: string
  zoho_id: string
}

type NotFoundRow = {
  table: string
  id: string | number
  nombre: string
}

type AmbiguousRow = {
  table: string
  id: string | number
  nombre: string
  candidates: Array<{ zoho_id: string; full_name: string; email: string | null }>
}

// ---------------------------------------------------------------------------
// Auth helper (same pattern as sync-vacancy-cvs)
// ---------------------------------------------------------------------------

async function isAuthorizedRequest(request: Request): Promise<boolean> {
  if (validateApiKey(request)) return true

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  return Boolean(user) && !error
}

// ---------------------------------------------------------------------------
// Rate-limit helper
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Zoho search: returns raw records with the record-level `id` field
// ---------------------------------------------------------------------------

async function searchZohoByName(
  name: string
): Promise<Array<{ zoho_id: string; full_name: string; email: string | null }>> {
  const trimmedName = name.trim()
  if (!trimmedName) return []

  const criteria = `(Full_Name:equals:${trimmedName})`

  let result: { data: Array<Record<string, unknown>> }

  try {
    result = await searchModule('Candidates', criteria, 1, 5)
  } catch (err) {
    // Zoho returns 204/empty when no records match — treat as not found
    const msg = err instanceof Error ? err.message : String(err)
    if (
      msg.includes('204') ||
      msg.includes('No Content') ||
      msg.includes('no data') ||
      msg.includes('Empty response')
    ) {
      return []
    }
    throw err
  }

  return (result.data ?? []).map((raw) => ({
    // `raw.id` is the Zoho record-level ID (long numeric string).
    // This is the value stored as zoho_candidate_id throughout this codebase.
    zoho_id: String(raw.id ?? ''),
    full_name: String(raw.Full_Name ?? raw.full_name ?? ''),
    email: raw.Email != null ? String(raw.Email) : null,
  }))
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  if (!(await isAuthorizedRequest(request))) {
    return unauthorizedResponse()
  }

  const startedAt = Date.now()
  const linked: LinkedRow[] = []
  const not_found: NotFoundRow[] = []
  const ambiguous: AmbiguousRow[] = []
  const errors: string[] = []

  // ── 1. Fetch Norway dropouts with null zoho_candidate_id ─────────────────
  // Table: promo_students_kpi
  // Name field: full_name   Email field: email (often null in dropout rows)
  const { data: norwayRows, error: norwayError } = await (supabaseAdmin as any)
    .from('promo_students_kpi')
    .select('id, full_name, email')
    .eq('tab_name', 'Dropouts')
    .is('zoho_candidate_id', null) as Promise<{
      data: Array<{ id: string; full_name: string | null; email: string | null }> | null
      error: { message: string } | null
    }>

  if (norwayError) {
    return NextResponse.json(
      { success: false, error: `Failed to fetch Norway dropouts: ${norwayError.message}` },
      { status: 500 }
    )
  }

  // ── 2. Fetch Germany dropouts with null zoho_candidate_id ────────────────
  // Table: germany_candidates_kpi
  // Name field: nombre   (no email column)
  const { data: germanyRows, error: germanyError } = await (supabaseAdmin as any)
    .from('germany_candidates_kpi')
    .select('id, nombre')
    .is('zoho_candidate_id', null) as Promise<{
      data: Array<{ id: number; nombre: string | null }> | null
      error: { message: string } | null
    }>

  if (germanyError) {
    return NextResponse.json(
      { success: false, error: `Failed to fetch Germany dropouts: ${germanyError.message}` },
      { status: 500 }
    )
  }

  // Normalise to a unified shape for processing
  type WorkItem = {
    table: 'promo_students_kpi' | 'germany_candidates_kpi'
    id: string | number
    nombre: string
    email: string | null
  }

  const workItems: WorkItem[] = [
    ...(norwayRows ?? [])
      .filter((r) => r.full_name && r.full_name.trim().length > 0)
      .map((r) => ({
        table: 'promo_students_kpi' as const,
        id: r.id,
        nombre: r.full_name!.trim(),
        email: r.email ?? null,
      })),
    ...(germanyRows ?? [])
      .filter((r) => r.nombre && r.nombre.trim().length > 0)
      .map((r) => ({
        table: 'germany_candidates_kpi' as const,
        id: r.id,
        nombre: r.nombre!.trim(),
        email: null,
      })),
  ]

  // ── 3. Process each row ───────────────────────────────────────────────────

  for (let i = 0; i < workItems.length; i++) {
    const item = workItems[i]

    // Rate-limit: 250ms between each Zoho call
    if (i > 0) {
      await sleep(250)
    }

    let matches: Array<{ zoho_id: string; full_name: string; email: string | null }>

    try {
      matches = await searchZohoByName(item.nombre)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`[${item.table}] id=${item.id} nombre="${item.nombre}": Zoho search failed — ${msg}`)
      continue
    }

    if (matches.length === 0) {
      // ── a. Not found in Zoho ──────────────────────────────────────────────
      not_found.push({ table: item.table, id: item.id, nombre: item.nombre })
      continue
    }

    if (matches.length === 1) {
      // ── b. Exactly one match — write back to DB ───────────────────────────
      const zohoId = matches[0].zoho_id

      if (!zohoId) {
        errors.push(
          `[${item.table}] id=${item.id} nombre="${item.nombre}": Zoho returned a record with no id field`
        )
        continue
      }

      const { error: updateError } = await (supabaseAdmin as any)
        .from(item.table)
        .update({ zoho_candidate_id: zohoId })
        .eq('id', item.id)

      if (updateError) {
        errors.push(
          `[${item.table}] id=${item.id} nombre="${item.nombre}": DB update failed — ${updateError.message}`
        )
        continue
      }

      linked.push({ table: item.table, id: item.id, nombre: item.nombre, zoho_id: zohoId })
      continue
    }

    // ── c. Multiple matches — ambiguous, skip ─────────────────────────────
    ambiguous.push({
      table: item.table,
      id: item.id,
      nombre: item.nombre,
      candidates: matches,
    })
  }

  const total = workItems.length

  return NextResponse.json(
    {
      linked,
      not_found,
      ambiguous,
      errors,
      total,
      linked_count: linked.length,
      not_found_count: not_found.length,
      ambiguous_count: ambiguous.length,
      error_count: errors.length,
      norway_rows_processed: (norwayRows ?? []).filter((r) => r.full_name?.trim()).length,
      germany_rows_processed: (germanyRows ?? []).filter((r) => r.nombre?.trim()).length,
      duration_ms: Date.now() - startedAt,
    },
    { status: errors.length > 0 && linked.length === 0 ? 500 : 200 }
  )
}
