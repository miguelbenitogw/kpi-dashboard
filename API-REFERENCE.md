# API-REFERENCE.md — Endpoints, Queries & Data Flows

> Auto-generated 2026-05-07. Complete API documentation for the KPI Dashboard.

---

## 1. Authentication Patterns

| Pattern | Used By | Validation |
|---------|---------|-----------|
| `Bearer {CRON_SECRET}` | All `/api/cron/*` | Matches `CRON_SECRET` env var |
| `x-api-key` header | Most `/api/admin/*`, `/api/process/*`, `/api/sync/*` | Matches `SYNC_API_KEY` env var |
| Auth user (session) | `/api/preferences/*`, some admin routes | Supabase `getUser()` check |
| None (internal) | Some admin/debug endpoints | Internal use only |

---

## 2. Cron Jobs (`/api/cron/*`)

All protected by `Bearer {CRON_SECRET}`. Triggered by Vercel Cron.

| Endpoint | Schedule (UTC) | What It Does |
|----------|---------------|-------------|
| `/api/cron/sync` | `0 2 * * *` (daily 02:00) | Sync active vacancies from Zoho (`es_proceso_atraccion_actual=true`) |
| `/api/cron/sync-full` | `0 3 * * 0` (Sunday 03:00) | Full sync: all vacancies + Excel Madre + candidate tags + tag counts + stage history (6 phases) |
| `/api/cron/sync-madre` | `0 6 * * *` (daily 06:00) | Import Excel Madre (Base Datos + Resumen) + re-sync all promo sheets |
| `/api/cron/sync-social` | `0 4 * * *` (daily 04:00) | YouTube snapshots to `social_media_snapshots_kpi` |
| `/api/cron/sync-vacancy-cvs` | `15 3 * * 1` (Monday 03:15) | Weekly CVs per active vacancy to `vacancy_cv_weekly_kpi` |
| `/api/cron/sync-placement` | `0 8 * * 1` (Monday 08:00) | Global Placement tab to placement fields in `candidates_kpi` |
| `/api/cron/sync-atraccion-history` | `0 5 * * 1` (Monday 05:00) | Candidate-vacancy history for promo candidates (90-day window) |
| `/api/cron/sync-germany` | Ad-hoc | Germany Excel import (3 tabs) |
| `/api/cron/sync-germany-candidates` | Ad-hoc | Zoho tags + job history for Germany candidates |

### Dependency Order
1. `sync` (daily) runs first, updates job openings
2. `sync-full` (Sunday) depends on fresh job opening data
3. `sync-atraccion-history` (Monday) uses updated promo candidates and recent vacancies
4. `sync-madre` (daily) is independent
5. `sync-placement` (weekly) syncs placement for candidates already in DB

---

## 3. Admin Endpoints (`/api/admin/*`)

### Zoho Sync

| Endpoint | Method | Auth | Purpose | Tables |
|----------|--------|------|---------|--------|
| `sync-job-openings` | POST | x-api-key | Full sync of all Zoho job openings | `job_openings_kpi` |
| `sync-candidate-tags` | POST | — | Sync `Associated_Tags` from Zoho | `candidates_kpi.tags` |
| `sync-vacancy-stats` | POST | x-api-key | Aggregate status counts per active vacancy | `vacancy_status_counts_kpi` |
| `sync-social` | POST | x-api-key | Sync YouTube & Instagram stats | `social_media_snapshots_kpi` |
| `debug-zoho-associate` | GET | — | Debug: raw Zoho `/associate` response | — |

### Vacancy CV Sync

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `sync-vacancy-cvs` | POST | x-api-key or auth | CVs per active vacancy (weekly/daily) |
| `sync-vacancy-cvs-historical` | POST | x-api-key or auth | Historical backfill (all vacancies, full refresh) |

### Tag Sync

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `sync-vacancy-tags` | POST | Pre-aggregate tag counts (local + Zoho) |
| `sync-vacancy-tags-local` | POST | Tag counts from Supabase only |
| `sync-vacancy-tags-zoho` | POST | Tag counts from Zoho API only |

### Data Import

| Endpoint | Method | Auth | Purpose | Params |
|----------|--------|------|---------|--------|
| `backfill-atraccion-history` | GET | — | Backfill `candidate_job_history_kpi` | `limit`, `offset`, `dryRun` |
| `import-candidate-placement` | POST | x-api-key | Import CSV of placements | `apply=1`, `syncCurrentStatus` |
| `import-charlas` | POST | — | Import charlas/webinars CSV | multipart body |
| `import-reparto-candidatos` | GET | — | One-time Norway import | `dryRun` |

### Config

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `vacancy-cv-target` | PATCH | auth user | Update weekly CV target per vacancy |

---

## 4. Zoho Endpoints (`/api/zoho/*`)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `candidates` | GET | x-api-key | Search/list candidates (paginated, max 200/page) |
| `candidates/[id]` | GET | x-api-key | Single candidate detail |
| `job-openings` | GET | x-api-key | List all vacancies with filters |
| `job-openings/[id]` | GET | x-api-key | Single vacancy detail |
| `search` | GET | x-api-key | Free-form search |
| `stats` | GET | x-api-key | Aggregated hiring stats |
| `analyze` | POST | x-api-key | Claude-powered agentic search (SSE stream) |

### AI Chat Tools (used by `/api/zoho/analyze`)
- `get_promo_status_breakdown` — candidate count by status for a promo/vacancy
- `search_candidates` — name/status/vacancy filter
- `get_job_openings` — list vacancies
- `get_hiring_stats` — funnel metrics
- `get_candidate_detail` — full candidate record

---

## 5. Google Sheets Endpoints (`/api/sheets/*`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `import` | POST | Main promo sheet import |
| `import-madre` | POST | Excel Madre import (batch all active sheets) |
| `import-germany` | POST | Germany Excel (3 tabs) |
| `import-global-placement` | POST | Placement status sync |
| `sync` | POST | Batch sync all registered promo sheets |
| `test` | GET | Health check: Sheets connectivity |
| `[id]` | GET | Single sheet details |
| `madre/[id]` | GET | Single madre sheet details |

---

## 6. Process Endpoints (`/api/process/*`)

| Endpoint | Method | Auth | Purpose | Reads | Writes |
|----------|--------|------|---------|-------|--------|
| `all` | POST | x-api-key | Orchestrate all processing | — | calls sub-endpoints |
| `candidates-days` | POST | x-api-key | Time-in-stage metrics | candidates_kpi, stage_history_kpi | daily_snapshot_kpi |
| `stats` | POST | x-api-key | Funnel stats, conversion rates | candidates_kpi, stage_history_kpi | — |
| `snapshot` | POST | x-api-key | Daily candidate count snapshot | candidates_kpi | daily_snapshot_kpi |
| `sla` | POST | x-api-key | SLA breach alerts | candidates_kpi, stage_history_kpi | sla_alerts_kpi |

---

## 7. Germany Endpoints (`/api/germany/*`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `candidates` | GET | List Germany candidates (paginated + filters) |
| `candidates/[id]/cronologia` | GET | Candidate timeline (vacancies, stages, notes) |

---

## 8. Other Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sync/job-openings` | POST | Manual job opening upsert |
| `/api/sync/status` | GET | Last sync status |
| `/api/preferences/favorites` | GET/POST | User favorite promos/vacancies |
| `/api/analytics/ga4` | GET | Google Analytics 4 metrics |
| `/api/chat` | POST | AI chat (OpenAI gpt-4o-mini with tool calls, SSE stream) |

---

## 9. Data Pipeline Overview

```
                    ┌─────────────┐
                    │  Zoho API   │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    job_openings     candidates      /associate
          │                │                │
          ▼                ▼                ▼
   job_openings_kpi  candidates_kpi  candidate_job_history_kpi
                                            │
                                     stage_history_kpi

                    ┌─────────────┐
                    │Google Sheets│
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    Excel Madre      Promo Sheets    Global Placement
          │                │                │
          ▼                ▼                ▼
   candidates_kpi   promo_students_kpi  candidates_kpi
   promotions_kpi                       (placement fields)

                    ┌─────────────┐
                    │  YouTube    │
                    └──────┬──────┘
                           │
                           ▼
              social_media_snapshots_kpi

                    ┌─────────────┐
                    │     GA4     │
                    └──────┬──────┘
                           │
                           ▼
                    (queried on demand)
```

---

## 10. Supabase Tables Summary

### Core

| Table | Purpose | Source |
|-------|---------|--------|
| `candidates_kpi` | All candidates | Excel Madre + Zoho |
| `job_openings_kpi` | All vacancies (~496) | Zoho Recruit |
| `candidate_job_history_kpi` | Candidate-vacancy associations | Zoho `/associate` |
| `promotions_kpi` | Promotion metadata | Excel Madre (Resumen) |
| `stage_history_kpi` | Status change log | Zoho sync (detected changes) |

### Pre-computed KPIs

| Table | Purpose |
|-------|---------|
| `vacancy_status_counts_kpi` | Status counts per active vacancy (~26) |
| `vacancy_cv_weekly_kpi` | Weekly CVs per vacancy |
| `vacancy_cv_daily_kpi` | Daily CVs per vacancy |
| `vacancy_tag_counts_kpi` | Tag counts per vacancy |
| `daily_snapshot_kpi` | Daily candidate count snapshots |
| `sla_alerts_kpi` | SLA breach alerts |

### Training & Events

| Table | Purpose |
|-------|---------|
| `promo_students_kpi` | Students imported from promo sheets |
| `promo_sheets_kpi` | Registered Google Sheets per promo |
| `madre_sheets_kpi` | Active Excel Madre sheets |
| `charlas_temporada_kpi` | Charla/webinar data by season |

### Germany Program

| Table | Purpose |
|-------|---------|
| `germany_candidates_kpi` | Germany candidates |
| `germany_exams_kpi` | Exam records |
| `germany_payments_kpi` | Payment records |
| `germany_candidate_history_kpi` | Vacancy associations |
| `germany_stage_history_kpi` | Status changes |
| `germany_candidate_notes_kpi` | Synced notes |

### Config & Preferences

| Table | Purpose |
|-------|---------|
| `promo_vacancy_links` | Manual promo-vacancy classification |
| `promo_job_link_kpi` | Promo to job opening links |
| `user_preferences_kpi` | User favorites |
| `dashboard_config_kpi` | Global config (Zoho tokens, etc.) |
| `sync_log_kpi` | Sync operation logs |
| `vacancy_cv_sync_state_kpi` | CV sync state (skip optimization) |
