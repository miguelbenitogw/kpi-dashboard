import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase/server'
import type { NorwayCandidateCronologia } from '@/lib/queries/formacion'

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  // Fetch all in parallel
  const [candidateRes, vacanciesRes, stageRes, notesRes] = await Promise.all([
    // Base candidate info
    (supabase as any)
      .from('candidates_kpi')
      .select('full_name, current_status, promocion_nombre, nationality')
      .eq('id', id)
      .maybeSingle() as Promise<{
        data: {
          full_name: string | null
          current_status: string | null
          promocion_nombre: string | null
          nationality: string | null
        } | null
        error: unknown
      }>,

    // Vacancies (includes job_opening_id so we can build a title map for stage history)
    (supabase as any)
      .from('candidate_job_history_kpi')
      .select('job_opening_id, job_opening_title, candidate_status_in_jo, fetched_at')
      .eq('candidate_id', id)
      .order('fetched_at', { ascending: false }) as Promise<{
        data: Array<{
          job_opening_id: string | null
          job_opening_title: string | null
          candidate_status_in_jo: string | null
          fetched_at: string | null
        }> | null
        error: unknown
      }>,

    // Stage history
    (supabase as any)
      .from('stage_history_kpi')
      .select('job_opening_id, from_status, to_status, changed_at')
      .eq('candidate_id', id)
      .order('changed_at', { ascending: false }) as Promise<{
        data: Array<{
          job_opening_id: string | null
          from_status: string | null
          to_status: string | null
          changed_at: string | null
        }> | null
        error: unknown
      }>,

    // Notes
    (supabase as any)
      .from('candidate_notes_kpi')
      .select('note_title, note_content, author, created_at')
      .eq('candidate_id', id)
      .order('created_at', { ascending: false }) as Promise<{
        data: Array<{
          note_title: string | null
          note_content: string | null
          author: string | null
          created_at: string | null
        }> | null
        error: unknown
      }>,
  ])

  if (candidateRes.error || !candidateRes.data) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
  }

  // Build a job_opening_id → title map from vacancies (already fetched above)
  const jobTitleMap = new Map<string, string>()
  for (const v of vacanciesRes.data ?? []) {
    if (v.job_opening_id && v.job_opening_title) {
      jobTitleMap.set(v.job_opening_id, v.job_opening_title)
    }
  }

  const result: NorwayCandidateCronologia = {
    candidate: candidateRes.data,
    vacancies: (vacanciesRes.data ?? []).map((v) => ({
      job_opening_title: v.job_opening_title,
      candidate_status: v.candidate_status_in_jo,
      fetched_at: v.fetched_at,
    })),
    stage_history: (stageRes.data ?? []).map((s) => ({
      job_opening_title: s.job_opening_id ? (jobTitleMap.get(s.job_opening_id) ?? s.job_opening_id) : null,
      from_status: s.from_status,
      to_status: s.to_status,
      changed_at: s.changed_at,
    })),
    notes: (notesRes.data ?? []).map((n) => ({
      note_title: n.note_title,
      note_content: n.note_content,
      note_owner: n.author,
      created_at: n.created_at,
    })),
  }

  return NextResponse.json(result)
}
