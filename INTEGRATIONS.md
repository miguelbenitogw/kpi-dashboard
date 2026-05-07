# INTEGRATIONS.md — External Service Integrations

> Auto-generated 2026-05-07. Technical reference for all external integrations.

---

## 1. Zoho Recruit

**Location:** `src/lib/zoho/`
**Purpose:** ATS (Applicant Tracking System) — candidates, job openings, associations

### Auth (`auth.ts`)
- OAuth 2.0 refresh token flow
- Access tokens stored in Supabase (`dashboard_config_kpi` where `config_key='zoho_token'`)
- Auto-refresh 5 minutes before expiry

### Client (`client.ts`)
- Rate limit: 200ms between paginated calls, max 200 records/page
- Key endpoints used:
  - `GET /Job_Openings` — all vacancies (paginated)
  - `GET /Candidates` — all candidates (paginated, filter by Modified_Time)
  - `GET /Job_Openings/{id}/associate` — candidates in a vacancy
  - `GET /Candidates/{id}/Associate_Job_Openings` — **BROKEN** (returns 204)
  - `GET /Candidates/{id}/Notes` — candidate notes

### Transform (`transform.ts`)
- Normalizes Zoho records to DB schema
- Derives: `tipo_vacante` (atraccion/formacion), `es_proceso_atraccion_actual`, `tipo_profesional`
- Handles polymorphic tags (string[] or {name, id}[])

### Sync Modules
- `sync-job-openings.ts` — Full or active-only vacancy sync. Preserves manual `tipo_profesional` and `category='interna'`
- `sync-candidates.ts` — History + stage changes for active vacancies. Only creates rows for candidates in the Madre
- `sync-candidate-tags.ts` — Tags from Zoho to `candidates_kpi.tags`
- `sync-germany-candidates.ts` — Germany-specific: tags, history, notes, record ID enrichment

### Known Issues
- **Candidate_ID vs record.id**: `candidates_kpi.id` = short ID ("88082"), NOT long Zoho ID. Always use `record.Candidate_ID ?? record.id`
- **BBDD vacancies excluded**: Titles starting with "BBDD" have 1000s of candidates, cause timeouts. Filtered in all sync operations
- **Promos 114/116**: Vacancies deleted from Zoho, no historical data recoverable

---

## 2. Google Sheets

**Location:** `src/lib/google-sheets/`
**Purpose:** Import training data from Excel Madre and promo-specific sheets

### Client (`client.ts`)
- Service account auth (readonly scope)
- Reads sheets as normalized row objects
- Handles: BOM stripping, empty cells, auto-named columns

### Import Modules

| Module | Source | Target Table |
|--------|--------|-------------|
| `import-madre.ts` | Excel Madre (Base Datos + Resumen) | `candidates_kpi`, `promotions_kpi` |
| `import.ts` | Promo sheets (Alumnos, Dropouts) | `promo_students_kpi` |
| `import-global-placement.ts` | Madre (Global Placement tab) | `candidates_kpi` (placement fields) |
| `import-germany.ts` | Germany Excel (3 tabs) | `germany_candidates_kpi`, `germany_exams_kpi`, `germany_payments_kpi` |
| `import-germany-dropouts.ts` | Germany dropout data | `germany_dropouts_kpi` |
| `import-pagos.ts` | Payment data | `pagos_candidato_kpi` |
| `import-reparto-candidatos.ts` | Candidate distribution | `candidates_kpi` |
| `import-curso-desarrollo.ts` | Course/development data | `curso_desarrollo_kpi` |

### Promo Sheet Import Pipeline
1. Fetch all tabs from Google Sheet
2. Normalize column names (fuzzy matching for Spanish/English variants)
3. Cross-reference with Zoho candidates (email match > name similarity)
4. Upsert to `promo_students_kpi`
5. Sync dropout data back to `candidates_kpi`

### Known GIDs
- `DROPOUTS: '1646413473'`
- `CONTACT_INFO: '1379222708'`

---

## 3. Google Analytics 4

**Location:** `src/lib/google-analytics/client.ts`
**Purpose:** Website traffic metrics

### Auth
- Service account (base64-encoded JSON in `GA4_SERVICE_ACCOUNT_KEY`)
- Property ID in `GA4_PROPERTY_ID`
- Service account must be added as Viewer in GA4 property

### Available Queries

| Function | Returns |
|----------|---------|
| `getSessionsOverTime(start, end)` | Daily sessions, users, pageviews |
| `getTrafficSources(start, end)` | Sessions by source/medium (top 20) |
| `getTopLandingPages(start, end)` | Top pages by views + bounce rate |
| `getGeographicBreakdown(start, end)` | Sessions by country (top 20) |
| `getPageViewsByTitle(start, end)` | Pageviews by page title |
| `getOverviewMetrics(start, end)` | Aggregate period metrics |

### Error Handling
- Returns empty arrays/defaults on auth or API failure
- Custom `GA4Error` with codes: PERMISSION_DENIED, NOT_CONFIGURED, API_ERROR

---

## 4. YouTube

**Location:** `src/lib/social-media/youtube.ts`
**Purpose:** Channel statistics and top videos

### Auth
- API key (`YOUTUBE_API_KEY`) with YouTube Data API v3 enabled

### Functions
- `fetchYouTubeStats(handle)` — Channel stats + top-5 videos
- `fetchAllYouTubeStats()` — Batch for all active handles

### Tracked Channels
- `GlobalWorking`, `globalworkingfrance`, `GlobalWorkingNorge`

### Quota
- ~190 units per handle (well within daily quota)

---

## 5. Instagram (Meta Graph API)

**Location:** `src/lib/social-media/instagram.ts`
**Purpose:** Follower counts, media engagement

### Auth
- `META_ACCESS_TOKEN` — Page/User access token

### Data Collected
- Followers, following, media count, top media

---

## 6. OpenAI

**Used in:** `/api/chat/route.ts`, `/api/zoho/analyze/route.ts`
**Purpose:** AI-powered chat assistant for data queries

### Config
- Model: `gpt-4o-mini`
- Streaming SSE responses with tool execution loop
- Tools: promo status breakdown, candidate search, vacancy list, hiring stats, candidate detail

---

## 7. Supabase

**Location:** `src/lib/supabase/`

### Server Client (`server.ts`)
- Lazy singleton with Proxy-based init
- Uses service role key (admin access, bypasses RLS)
- `SUPABASE_SERVICE_ROLE_KEY`

### Browser Client (`client.ts`)
- Lazy singleton for browser-side operations
- Uses anon key (RLS-protected)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Auth
- Email/password + mandatory MFA (TOTP)
- SSR middleware handles cookie refresh
- MFA enforcement in middleware.ts

### RLS Policy
- All tables: `ENABLE ROW LEVEL SECURITY`
- Public `SELECT` policy on all tables
- Writes only via `supabaseAdmin` service-role client

---

## 8. Social Media Account Registry

**Location:** `src/lib/social-media/accounts.ts`

18 accounts tracked across:
- Instagram (3), Facebook (2), TikTok (2), LinkedIn (4), YouTube (4)
- Platforms with API integration: YouTube, Instagram
- Others: placeholder snapshots

---

## 9. Environment Variables

### Required

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Zoho
ZOHO_API_BASE_URL
ZOHO_TOKEN_URL
ZOHO_CLIENT_ID
ZOHO_CLIENT_SECRET
ZOHO_REFRESH_TOKEN

# Google
GOOGLE_SERVICE_ACCOUNT_JSON

# Security
SYNC_API_KEY
CRON_SECRET
```

### Optional

```
# Google Analytics
GA4_SERVICE_ACCOUNT_KEY    (base64)
GA4_PROPERTY_ID

# YouTube
YOUTUBE_API_KEY

# Instagram
META_ACCESS_TOKEN

# OpenAI
OPENAI_API_KEY

# App
NEXT_PUBLIC_APP_URL
VACANCY_CV_SYNC_FULL_REFRESH_HOURS   (default: 24)
ALLOWED_EMAIL_DOMAINS
ALLOWED_EMAILS
```
