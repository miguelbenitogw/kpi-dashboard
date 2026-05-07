# STRUCTURE.md — Project Structure & Component Map

> Auto-generated 2026-05-07. Full codebase analysis of the KPI Dashboard.

---

## 1. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.3 |
| Language | TypeScript | 5.x |
| UI | React | 19.2.4 |
| Styling | Tailwind CSS | 4.x |
| Charts | Recharts | 3.8.1 |
| Icons | Lucide React | 1.8.0 |
| Database | Supabase (PostgreSQL) | 2.103.0 |
| Auth | Supabase Auth + MFA (TOTP) | — |
| Hosting | Vercel | — |
| External APIs | Zoho Recruit, Google Sheets, YouTube, GA4, OpenAI | — |

---

## 2. Source File Tree

```
src/
├── app/
│   ├── page.tsx                          # Root → redirects to /dashboard
│   ├── layout.tsx                        # Root layout (Sidebar + main)
│   ├── auth/
│   │   ├── login/page.tsx                # Login (email/password)
│   │   ├── mfa/page.tsx                  # MFA enrollment/verification
│   │   └── callback/route.ts             # Supabase auth callback
│   ├── dashboard/
│   │   ├── page.tsx                      # Resumen (main dashboard)
│   │   ├── layout.tsx                    # Dashboard wrapper
│   │   ├── atraccion/                    # Recruitment operations
│   │   │   ├── page.tsx
│   │   │   ├── layout.tsx
│   │   │   ├── cerradas/page.tsx
│   │   │   └── cvs-recibidos/page.tsx
│   │   ├── formacion/                    # Training programs
│   │   │   ├── page.tsx
│   │   │   ├── layout.tsx
│   │   │   ├── abandonos/page.tsx
│   │   │   ├── candidatos/page.tsx
│   │   │   └── sheets/page.tsx
│   │   ├── colocacion/                   # Placement
│   │   │   ├── page.tsx
│   │   │   ├── layout.tsx
│   │   │   └── actions.ts
│   │   ├── alemania/                     # Germany program
│   │   │   ├── page.tsx
│   │   │   └── abandonos/page.tsx
│   │   ├── analytics/page.tsx            # Google Analytics
│   │   ├── funnel/page.tsx               # Recruitment funnel
│   │   ├── pipeline/page.tsx             # Candidate pipeline
│   │   ├── rendimiento/page.tsx          # Performance metrics
│   │   ├── promos/page.tsx               # Promotions overview
│   │   ├── sla/page.tsx                  # SLA monitoring
│   │   ├── candidates/page.tsx           # Candidate search
│   │   ├── chat/page.tsx                 # AI chat (beta)
│   │   ├── configuracion/page.tsx        # Settings
│   │   ├── etiquetas/page.tsx            # Tag management
│   │   └── costes/page.tsx               # Costs (placeholder)
│   └── api/                              # ~51 API routes
│       ├── admin/                        # 15 data management endpoints
│       ├── cron/                         # 9 scheduled sync jobs
│       ├── zoho/                         # 8 Zoho CRM endpoints
│       ├── sheets/                       # 8 Google Sheets endpoints
│       ├── process/                      # 5 data processing endpoints
│       ├── sync/                         # 3 sync endpoints
│       ├── germany/                      # 2 Germany program endpoints
│       ├── preferences/favorites/route.ts
│       ├── analytics/ga4/route.ts
│       └── chat/route.ts
├── components/                           # ~135 UI components
│   ├── layout/          (2)              # Sidebar, SyncStatus
│   ├── dashboard/       (6)              # KpiCards, AlertsSummary, charts
│   ├── atraccion/       (17)             # Vacancy tracking, CVs, recruitment
│   ├── formacion/       (12+5)           # Training, promos, dropouts
│   ├── alemania/        (7)              # Germany program
│   ├── colocacion/      (4)              # Placement (mostly placeholders)
│   ├── funnel/          (4)              # Recruitment funnel
│   ├── pipeline/        (4)              # Candidate pipeline
│   ├── rendimiento/     (8)              # Performance metrics
│   ├── analytics/       (7)              # Google Analytics
│   ├── candidates/      (4)              # Search, filters, export
│   ├── chat/            (4)              # AI chat assistant
│   ├── sla/             (4)              # SLA monitoring
│   ├── promos/          (4)              # Promotion cards, detail
│   ├── configuracion/   (4)              # Settings UIs
│   ├── etiquetas/       (2)              # Tag management
│   ├── shared/          (3)              # KPIDetailModal, SemaphoreCard, Sparkline
│   ├── resumen/         (1)              # VacantesPrincipalesStrip
│   └── settings/        (1)              # SheetCard
└── lib/                                  # ~55 modules
    ├── supabase/        (6)              # DB clients, types, tag sync
    ├── queries/         (19)             # Data queries by feature
    ├── zoho/            (9)              # Zoho CRM integration
    ├── google-sheets/   (9)              # Google Sheets import
    ├── google-analytics/ (1)             # GA4 client
    ├── social-media/    (3)              # YouTube, Instagram, accounts
    ├── csv/             (2)              # CSV parsers
    ├── auth/            (1)              # Auth config
    ├── utils/           (4)              # vacancy-type, vacancy-profession, etc.
    ├── constants.ts                      # Terminal statuses
    └── theme.ts                          # Brand colors, chart presets
```

---

## 3. Route Map

### Public Routes

| URL | Purpose |
|-----|---------|
| `/auth/login` | Login (email/password, Supabase) |
| `/auth/mfa` | MFA setup/verification (TOTP) |
| `/auth/callback` | Supabase OAuth callback |

### Dashboard Routes (protected, MFA required)

| URL | Purpose | Key Components |
|-----|---------|----------------|
| `/dashboard` | Main KPI summary & alerts | KpiCards, TopVacancies, WeeklyTrendChart, AlertsSummary |
| `/dashboard/atraccion` | Recruitment operations | AtraccionResumen, VacancyRecruitmentTable, WeeklyCVChart |
| `/dashboard/atraccion/cerradas` | Closed vacancies | ClosedVacanciesView, ClosedVacancyCvsView |
| `/dashboard/atraccion/cvs-recibidos` | CVs by vacancy | ReceivedCvsByVacancyView |
| `/dashboard/formacion` | Training programs | PromoVistaGeneral, FormacionGraficos, RetentionOverview |
| `/dashboard/formacion/abandonos` | Dropout analysis | DropoutsView, DropoutsKpiBanner, DropoutsCharts |
| `/dashboard/formacion/candidatos` | Candidate details | CandidatosFormacionView |
| `/dashboard/formacion/sheets` | Google Sheets manager | PromoSheetsManager |
| `/dashboard/colocacion` | Global placement | GPColocacionView, PromoLinker |
| `/dashboard/alemania` | Germany program | GermanyKpiStrip, GermanyExamsDashboard, GermanyPaymentsSummary |
| `/dashboard/alemania/abandonos` | Germany dropouts | GermanyAbandonosView |
| `/dashboard/funnel` | Recruitment funnel | FunnelChart, ConversionTable, SourceEffectiveness |
| `/dashboard/pipeline` | Candidate pipeline | PipelineChart, CandidateTable, VacancySelector |
| `/dashboard/rendimiento` | Performance metrics | PromoComparisonView, DropoutAnalysis, HistoryView |
| `/dashboard/promos` | Promotions overview | PromoCard, PromoDetail, StatusBreakdown |
| `/dashboard/analytics` | Google Analytics | AnalyticsCarousel, SessionsTimeChart, TrafficSourcesChart |
| `/dashboard/sla` | SLA monitoring | SlaHeatmap, AlertList, SlaThresholdConfig |
| `/dashboard/candidates` | Candidate search | CandidateDetailTable, CandidateFilters, ExportCSV |
| `/dashboard/chat` | AI assistant (beta) | ChatInput, ChatMessage, SuggestedQuestions |
| `/dashboard/configuracion` | Settings | MadreSheetsManager, SlaThresholdsManager |
| `/dashboard/etiquetas` | Tags | EtiquetasView, TagPrefixCharts |
| `/dashboard/costes` | Costs (placeholder) | CostsPlaceholder |

---

## 4. Component Inventory by Area

### Atraccion (17 components)
Recruitment vacancy tracking, CV intake, conversion rates, traffic lights.

Key: `VacancyRecruitmentTable`, `WeeklyCVChart`, `ConversionRates`, `AttractionTrafficLights`, `CharlasSummary`, `ReceivedCvsByVacancyView`, `ClosedVacancyCvsView`

### Formacion (17 components incl. abandonos/)
Training programs, promotion management, retention, dropouts.

Key: `PromoVistaGeneral`, `FormacionGraficos`, `RetentionOverview`, `PromoVacancyDistributionChart`, `PromoVacancyLinksManager`, `DropoutsView`, `DropoutsCharts`

### Alemania (7 components)
Germany-specific program: candidates, exams, payments.

Key: `GermanyKpiStrip`, `GermanyCandidatesTable`, `GermanyExamsDashboard`, `GermanyPaymentsSummary`

### Dashboard (6 components)
Main KPI cards, alerts, top vacancies, weekly trends.

### Rendimiento (8 components)
Performance metrics, dropout analysis, promo comparisons.

### Analytics (7 components)
GA4 metrics: sessions, traffic sources, geo breakdown, top pages.

### Pipeline / Funnel / SLA / Promos / Candidates / Chat / Config / Etiquetas
4 components each (see tree above for details).

### Shared (3 components)
`KPIDetailModal` (modal with sparkline + breakdown), `SemaphoreCard` (traffic light card), `Sparkline` (compact trend chart).

---

## 5. Query Modules (lib/queries/)

| Module | Tables | Purpose |
|--------|--------|---------|
| `atraccion.ts` | job_openings_kpi, vacancy_cv_weekly_kpi, vacancy_status_counts_kpi, promo_vacancy_links | CV counts, conversion rates, traffic lights, vacancy status |
| `formacion.ts` | candidates_kpi, promo_students_kpi, candidate_job_history_kpi | Retention, dropouts, candidato con intentos (retornados) |
| `germany.ts` | germany_candidates_kpi, germany_exams_kpi, germany_payments_kpi | Germany KPIs, exams, payments, chronology |
| `dashboard.ts` | candidates_kpi, job_openings_kpi, sla_alerts_kpi, daily_snapshot_kpi | Main dashboard KPIs, alerts, weekly trends |
| `pipeline.ts` | candidates_kpi, job_openings_kpi, sla_alerts_kpi | Pipeline stages, SLA enrichment |
| `funnel.ts` | candidates_kpi, stage_history_kpi | Multi-stage funnel, conversion rates |
| `candidates.ts` | candidates_kpi, candidate_job_history_kpi | Search, filters, job history |
| `colocacion.ts` | candidates_kpi, promo_job_link_kpi | GP metrics, open-to, training status |
| `dropouts.ts` | promo_students_kpi | Dropout analysis by reason, level, month |
| `sla.ts` | sla_alerts_kpi, stage_history_kpi | SLA breach alerts, response times |
| `promos.ts` | promotions_kpi | Promotion KPIs |
| `charlas.ts` | charlas_temporada_kpi, charlas_programa_totales_kpi | Talks/webinar data |
| `rrss.ts` | social_media_snapshots_kpi | Social media engagement |
| `preferences.ts` | user_preferences_kpi | User favorites |
| `etiquetas.ts` | vacancy_tag_counts_kpi | Tag queries |

---

## 6. Design Patterns

1. **Skeleton Loading** — All tables/charts show animated skeleton on load
2. **Color-coded Status** — Green (success), Orange (warning), Red (danger)
3. **Expandable Rows** — CandidateDetailTable with job history expansion
4. **Pagination** — 50 items per page with navigation controls
5. **Multi-select Filters** — Status, nationality, source filters with clear-all
6. **CSV Export** — Export buttons on candidate tables
7. **Stacked Progress Bars** — Proportional status bars on promo cards
8. **Favorite/Star Toggle** — Persisted in user_preferences_kpi
9. **Realtime Indicators** — Pulsing dots for live data freshness
10. **Modal Drill-down** — KPIDetailModal with sparkline + breakdown by promo
