# INFRASTRUCTURE.md — Configuration, Deployment & Schema

> Auto-generated 2026-05-07. Ops reference for the KPI Dashboard.

---

## 1. Deployment

| Aspect | Details |
|--------|---------|
| Platform | Vercel |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (email/password + TOTP MFA) |
| Realtime | Supabase Realtime (WebSocket subscriptions) |
| CDN | Vercel Edge Network |

---

## 2. Next.js Config (`next.config.ts`)

| Setting | Value | Why |
|---------|-------|-----|
| `serverExternalPackages` | `['@google-analytics/data']` | Server-only dependency, excluded from bundle |
| `typescript.ignoreBuildErrors` | `true` | Supabase types outdated (pre-migration 016); runtime types correct via proxy |

---

## 3. Middleware (`middleware.ts`)

**Route protection with mandatory MFA:**

1. Check session → redirect to `/auth/login?next={path}` if missing
2. Check MFA status → redirect to `/auth/mfa` if TOTP required but not verified
3. Redirect authenticated users from `/auth/*` to dashboard

**Public paths:** `/auth/*`, `/_next/*`, `/favicon.ico`
**Protected:** Everything else (all dashboard routes)

**MFA flow:**
- `listFactors()` checks for verified TOTP
- `getAuthenticatorAssuranceLevel()` ensures `aal2`
- No TOTP enrolled → forced enrollment at `/auth/mfa`
- TOTP enrolled but session not aal2 → redirect to MFA challenge

---

## 4. Cron Schedule (`vercel.json`)

| Job | Schedule (UTC) | Purpose |
|-----|---------------|---------|
| `/api/cron/sync` | 02:00 daily | Active vacancies from Zoho |
| `/api/cron/sync-full` | 03:00 Sunday | Full refresh (6 phases) |
| `/api/cron/sync-madre` | 06:00 daily | Excel Madre + promo sheets |
| `/api/cron/sync-social` | 04:00 daily | YouTube snapshots |
| `/api/cron/sync-vacancy-cvs` | 03:15 Monday | Weekly CVs per vacancy |
| `/api/cron/sync-placement` | 08:00 Monday | Global Placement tab |
| `/api/cron/sync-atraccion-history` | 05:00 Monday | Attraction history |

All crons protected by `Bearer {CRON_SECRET}`.

---

## 5. TypeScript (`tsconfig.json`)

| Setting | Value |
|---------|-------|
| Target | ES2017 |
| Module | ESNext/Bundler |
| Strict | true |
| Path alias | `@/*` → `./src/*` |
| Incremental | true |

---

## 6. Styling

- **Tailwind CSS v4** with `@tailwindcss/postcss` plugin
- **Theme** defined in `src/lib/theme.ts`:
  - Brand blue: `#2e6bc2`
  - Accent orange: `#e55a2b`
  - Dark navy surfaces: `#0a1324` to `#3a4f78`
  - Chart presets: categorical (8 colors), semaphore (ok/warn/danger)

---

## 7. Database Schema (33 migrations)

### Migration Timeline

| Range | Period | What Changed |
|-------|--------|-------------|
| 001–007 | Apr 14–15 | Core schema: promotions, candidates, jobs, targets, history |
| 008–015 | Apr 17–20 | Phase 2: charlas, GA4 mapping, job enrichment |
| 016 | Apr 20 | **Major rename**: all tables get `_kpi` suffix |
| 017–019 | Apr 20–21 | Social media schema, RLS policies |
| 020–021 | Apr 21–22 | Promotions proper model, normalization |
| 022–027 | Apr 23–May 5 | Madre sheets, vacancy CVs, Germany candidates, weekly targets |

### Table Count: ~30+ tables

**Core:** candidates_kpi, job_openings_kpi, candidate_job_history_kpi, promotions_kpi, stage_history_kpi

**Pre-computed:** vacancy_status_counts_kpi, vacancy_cv_weekly_kpi, vacancy_cv_daily_kpi, vacancy_tag_counts_kpi, daily_snapshot_kpi, sla_alerts_kpi

**Training:** promo_students_kpi, promo_sheets_kpi, madre_sheets_kpi, charlas_temporada_kpi

**Germany:** germany_candidates_kpi, germany_exams_kpi, germany_payments_kpi, germany_candidate_history_kpi, germany_stage_history_kpi, germany_candidate_notes_kpi

**Config:** promo_vacancy_links, promo_job_link_kpi, user_preferences_kpi, dashboard_config_kpi, sync_log_kpi

### RLS
- All tables: `ENABLE ROW LEVEL SECURITY`
- Public `SELECT` for all
- Writes via service-role client only

---

## 8. Rate Limiting & Batching

| Service | Delay | Batch Size | Notes |
|---------|-------|-----------|-------|
| Zoho (pagination) | 200ms | 200/page | Between paginated calls |
| Zoho (vacancy iteration) | 500ms | — | Between vacancies in sync loops |
| Germany sync | 300ms | 20 candidates | Stricter to avoid rate limits |
| CV sync | — | 100 upserts | Batch upsert size |
| Job opening sync | — | 100 upserts | Batch upsert size |

---

## 9. Utility Scripts (project root)

| Script | Purpose |
|--------|---------|
| `analyze_madre.mjs` | Parse Excel Madre, explore schema |
| `analyze_noruega.mjs` / `v2.cjs` | Norway program analysis (legacy) |
| `backfill-zoho-job-numbers.mjs` | Backfill missing job numbers |
| `import_noruega.cjs` | Norway import (legacy) |
| `resync_madre.cjs` | Madre re-sync |
| `run-germany-import.mjs` | Germany Excel import (3 tabs) |
| `sync-germany-candidates.mjs` | Germany candidate data sync |
| `inspect-*.mjs` | Debug/inspection scripts |

---

## 10. NPM Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `next dev` | Local dev server (port 3000) |
| `build` | `next build` | Production build |
| `start` | `next start` | Production server |
| `lint` | `eslint` | Run linter |

---

## 11. Dependencies

### Runtime

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.2.3 | Framework |
| react / react-dom | 19.2.4 | UI |
| @supabase/supabase-js | 2.103.0 | Database client |
| @supabase/ssr | 0.10.2 | SSR auth middleware |
| @google-analytics/data | 5.2.1 | GA4 (server-only) |
| googleapis | 171.4.0 | Google APIs (Sheets, Drive) |
| recharts | 3.8.1 | Charts |
| lucide-react | 1.8.0 | Icons |
| date-fns | 4.1.0 | Date utilities |

### Dev

| Package | Version | Purpose |
|---------|---------|---------|
| typescript | 5.x | Type checking |
| tailwindcss | 4.x | Styling |
| eslint | 9.x | Linting |
| eslint-config-next | 16.2.3 | Next.js ESLint rules |
