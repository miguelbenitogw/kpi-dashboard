@AGENTS.md

## Context Files

| File | Purpose |
|------|---------|
| `SYSTEM.md` | Source of truth: data architecture, business logic, known issues, API quirks |
| `AGENTS.md` | Agent instructions, pending ideas, context management rules |
| `STRUCTURE.md` | Full file tree, route map, component inventory by area, query modules |
| `API-REFERENCE.md` | All 51 API endpoints, cron jobs, auth patterns, data pipeline flows |
| `INTEGRATIONS.md` | External services: Zoho, Google Sheets, GA4, YouTube, Supabase, OpenAI |
| `INFRASTRUCTURE.md` | Deployment, middleware, vercel.json, env vars, DB migrations, dependencies |

### Quick Reference

**Stack**: Next.js 16.2.3 + React 19 + TypeScript + Supabase + Tailwind 4 + Recharts + Vercel

**Business domain**: GlobalWorking recruitment pipeline — 3 axes: Atraccion (recruitment), Formacion (training), Colocacion (placement). Plus Germany program.

**Data sources**: Zoho Recruit (ATS), Google Sheets (Excel Madre + promo sheets), YouTube, GA4, OpenAI chat

**Key tables**: candidates_kpi, job_openings_kpi, candidate_job_history_kpi, promotions_kpi, promo_students_kpi, germany_candidates_kpi

**Auth**: Supabase Auth + mandatory TOTP MFA. Middleware enforces on all dashboard routes.

**Crons**: 7 scheduled jobs (daily/weekly) syncing Zoho, Madre sheets, social media. Protected by CRON_SECRET.

**Source layout**: ~135 components (19 areas), ~55 lib modules (9 areas), ~51 API routes, 33 DB migrations
