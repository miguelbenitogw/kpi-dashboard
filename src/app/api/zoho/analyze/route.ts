/**
 * GET /api/zoho/analyze
 *
 * Fetches ALL job openings from Zoho and returns a complete analysis:
 * - Raw records with every field Zoho returns (including tags, custom fields)
 * - Breakdown by status, category, tags
 * - All unique tags found across all records
 * - Custom fields metadata from /settings/fields endpoint
 *
 * Use this to discover the real field names and values in the Zoho instance.
 */
import { type NextRequest } from 'next/server'
import { validateApiKey, unauthorizedResponse } from '../../sync/middleware'
import { fetchAllPages, zohoFetch } from '@/lib/zoho/client'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: NextRequest) {
  try {
    if (!validateApiKey(request)) {
      return unauthorizedResponse()
    }

    const mode = request.nextUrl.searchParams.get('mode') ?? 'summary'
    // mode=summary  → breakdown stats + unique tags + first 5 raw records
    // mode=raw      → all raw records (can be large)
    // mode=fields   → custom field definitions from Zoho settings API

    // -----------------------------------------------------------------------
    // 1. Custom field definitions
    // -----------------------------------------------------------------------
    let fieldsMetadata: Record<string, unknown>[] = []
    try {
      const fieldsResponse = await zohoFetch<{ fields: Record<string, unknown>[] }>(
        '/settings/fields',
        { module: 'Job_Openings' }
      )
      fieldsMetadata = fieldsResponse.fields ?? []
    } catch (err) {
      console.warn('[analyze] Could not fetch fields metadata:', err)
    }

    const customFields = fieldsMetadata
      .filter((f) => f.custom_field === true)
      .map((f) => ({
        api_name: f.api_name,
        label: f.field_label,
        type: f.data_type,
        pick_list_values: (f.pick_list_values as { display_value: string }[] | undefined)?.map(
          (v) => v.display_value
        ),
      }))

    if (mode === 'fields') {
      return Response.json(
        {
          total_fields: fieldsMetadata.length,
          custom_fields: customFields,
          all_fields: fieldsMetadata.map((f) => ({
            api_name: f.api_name,
            label: f.field_label,
            type: f.data_type,
            custom: f.custom_field,
          })),
        },
        { headers: CORS_HEADERS }
      )
    }

    // -----------------------------------------------------------------------
    // 2. Fetch ALL job openings (no field filter — get everything Zoho returns)
    // -----------------------------------------------------------------------
    const allRaw = await fetchAllPages<Record<string, unknown>>('/Job_Openings')

    // -----------------------------------------------------------------------
    // 3. Analysis
    // -----------------------------------------------------------------------

    // All unique keys across all records
    const allKeys = new Set<string>()
    allRaw.forEach((r) => Object.keys(r).forEach((k) => allKeys.add(k)))

    // Status breakdown
    const byStatus: Record<string, number> = {}
    allRaw.forEach((r) => {
      const s = (r.Job_Opening_Status as string) ?? 'unknown'
      byStatus[s] = (byStatus[s] ?? 0) + 1
    })

    // Collect all tags
    const tagCounts: Record<string, number> = {}
    allRaw.forEach((r) => {
      const rawTags = r.tags as Array<string | { name: string }> | null | undefined
      if (!rawTags?.length) return
      rawTags.forEach((t) => {
        const name = typeof t === 'string' ? t : ((t as { name: string }).name ?? '')
        if (name) tagCounts[name] = (tagCounts[name] ?? 0) + 1
      })
    })

    // Tags shape: check if they come as strings or objects
    const sampleWithTags = allRaw.find(
      (r) => Array.isArray(r.tags) && (r.tags as unknown[]).length > 0
    )
    const tagsShape = sampleWithTags
      ? typeof (sampleWithTags.tags as unknown[])[0]
      : 'no tags found in any record'

    // Category-like fields (title pattern)
    const byTitlePattern: Record<string, number> = { promo: 0, other: 0 }
    allRaw.forEach((r) => {
      const t = ((r.Job_Opening_Name as string) ?? '').toLowerCase()
      if (t.includes('promo')) byTitlePattern.promo++
      else byTitlePattern.other++
    })

    // Client breakdown
    const byClient: Record<string, number> = {}
    allRaw.forEach((r) => {
      const clientObj = r.Client_Name as Record<string, unknown> | string | null
      const name =
        typeof clientObj === 'object' && clientObj !== null
          ? (clientObj.name as string)
          : (clientObj as string) ?? 'unknown'
      byClient[name] = (byClient[name] ?? 0) + 1
    })

    // Sample: first 5 records with ALL their fields
    const sample = allRaw.slice(0, 5)

    const response = {
      total_job_openings: allRaw.length,
      // Field discovery
      all_field_keys_in_response: Array.from(allKeys).sort(),
      custom_fields_from_settings: customFields,
      // Tags analysis
      tags_shape_in_response: tagsShape,
      tag_counts: Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .reduce<Record<string, number>>((acc, [k, v]) => { acc[k] = v; return acc }, {}),
      // Status breakdown
      by_status: Object.entries(byStatus)
        .sort((a, b) => b[1] - a[1])
        .reduce<Record<string, number>>((acc, [k, v]) => { acc[k] = v; return acc }, {}),
      // Title pattern (promo vs other)
      by_title_pattern: byTitlePattern,
      // Client breakdown
      by_client: Object.entries(byClient)
        .sort((a, b) => b[1] - a[1])
        .reduce<Record<string, number>>((acc, [k, v]) => { acc[k] = v; return acc }, {}),
      // Raw sample
      sample_records: mode === 'raw' ? allRaw : sample,
    }

    return Response.json(response, { headers: CORS_HEADERS })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json(
      { error: `Analysis failed: ${message}` },
      { status: 502, headers: CORS_HEADERS }
    )
  }
}
