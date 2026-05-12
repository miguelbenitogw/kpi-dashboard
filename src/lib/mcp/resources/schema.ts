import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

const TABLES_SCHEMA = `# KPI Dashboard — Table Schema

## candidates_kpi
Main candidates table for the GlobalWorking recruitment pipeline.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| nombre_completo | text | Full name |
| promocion_nombre | text | Promotion name the candidate belongs to |
| estado_actual | text | Current status (e.g. "Formación", "Dropout", "Graduado", "Contratado") |
| fecha_ingreso_formacion | date | Date the candidate entered training |
| pais_destino | text | Destination country for placement |
| contratado_en | text | Company/vacancy where the candidate was hired |

## job_openings_kpi
Job vacancies synced from Zoho Recruit.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| title | text | Vacancy title. BBDD = database-only entries, not real vacancies |
| tipo_profesional | text | Professional type (e.g. "Enfermería", "Auxiliar de Enfermería") |
| is_vacante_principal | boolean | True = shown in dashboard as main vacancy |
| total_candidates | integer | Total candidates associated |
| hired_count | integer | Number hired |
| hiring_target | integer | Target number of hires |
| closing_date | date | Vacancy closing date |
| date_opened | date | Date vacancy was opened |
| ratio_exito_contactados | numeric | Success rate (hired / total contacted) |
| ratio_descarte | numeric | Discard rate |
| zoho_job_number | text | Zoho Recruit job number |

## candidate_job_history_kpi
Many-to-many relationship between candidates and job openings.

| Column | Type | Description |
|--------|------|-------------|
| candidate_id | uuid | FK to candidates_kpi.id |
| job_opening_id | uuid | FK to job_openings_kpi.id |
| association_type | text | "atraccion" (recruitment) or "formacion" (training) |
| current_status | text | Candidate's current status in this vacancy |

## promotions_kpi
Training promotions (cohorts of candidates in a training program).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| nombre | text | Promotion name |
| numero_promo | integer | Promotion number |
| coordinador | text | Coordinator name |
| cliente | text | Client organization |
| fecha_inicio | date | Start date |
| fecha_fin | date | End date (NULL = ongoing) |
| objetivo_atraccion | integer | Attraction objective (target candidates) |
| total_aceptados | integer | Total candidates accepted |

## promo_students_kpi
Individual students within a promotion (from Google Sheets).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| promo_id | uuid | FK to promotions_kpi.id |
| nombre_completo | text | Full name |
| estado | text | Student status |
| fecha_ingreso | date | Entry date |

## vacancy_cv_weekly_kpi
Weekly CV (curriculum) submission counts per vacancy.

| Column | Type | Description |
|--------|------|-------------|
| vacancy_id | uuid | FK to job_openings_kpi.id |
| week_start | date | ISO date of Monday of the week |
| candidate_count | integer | Number of CVs received that week |
| synced_at | timestamptz | When this record was last synced |
| baseline_count | integer | Baseline count at week start |

## vacancy_status_counts_kpi
Candidate count breakdown by status for each vacancy.

| Column | Type | Description |
|--------|------|-------------|
| vacancy_id | uuid | FK to job_openings_kpi.id |
| status | text | Status name (Zoho stage) |
| count | integer | Number of candidates in that status |

## vacancy_tag_counts_kpi
Tag breakdown for each vacancy (from Zoho source tags).

| Column | Type | Description |
|--------|------|-------------|
| vacancy_id | uuid | FK to job_openings_kpi.id |
| tag | text | Tag name. GW% prefix = GlobalWorking internal tags |
| count | integer | Number of candidates with that tag |

## germany_candidates_kpi
Candidates in the Germany placement program.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| nombre_completo | text | Full name |
| stage | text | Current pipeline stage |
| fecha_inicio | date | Start date in program |
| pais_destino | text | Destination country (always Germany) |

## sync_log_kpi
Log of data synchronization operations.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| created_at | timestamptz | When the sync ran |
| phase | text | Sync phase name |
| status | text | "success", "error", "partial" |
| inserted | integer | Number of rows inserted/updated |
| errors | jsonb | Error details if any |
`

const GLOSSARY = `# KPI Dashboard — Business Glossary

## Pipeline Phases

### Atracción (Attraction)
The recruitment phase. Candidates are sourced, contacted, and screened.
- Tracked in Zoho Recruit as job applications.
- association_type = "atraccion" in candidate_job_history_kpi.
- KPIs: ratio_exito_contactados (success rate), ratio_descarte (discard rate).

### Formación (Training)
The training phase. Selected candidates enter a training program (promotion) to qualify for placement.
- Each promotion is a cohort of candidates in training.
- association_type = "formacion" in candidate_job_history_kpi.
- Tracked in promotions_kpi + promo_students_kpi.

### Colocación (Placement)
The placement phase. Trained candidates are placed in jobs in the destination country.
- Tracked in job_openings_kpi via hired_count.
- germany_candidates_kpi tracks the Germany placement pipeline specifically.

## Key Concepts

### Promoción (Promotion)
A cohort of candidates undergoing a training program together. Each promotion has a coordinator, a client, start/end dates, and a target number of candidates.
- In Zoho Recruit, a promotion may appear as a job opening with association_type = "formacion".
- In the KPI system, promotions are tracked in promotions_kpi.

### Vacante Principal (Principal Vacancy)
A real, active job vacancy shown in the main KPI dashboard.
- is_vacante_principal = true in job_openings_kpi.
- Excludes BBDD entries and formation vacancies.

### Vacante BBDD
A special vacancy type used as a "database" container in Zoho Recruit to group candidates without a specific opening.
- title = "BBDD" in job_openings_kpi.
- ALWAYS excluded from KPI calculations and reports.

### Zoho Recruit
The ATS (Applicant Tracking System) used by GlobalWorking. Source of truth for:
- Candidates and their statuses.
- Job openings and their pipeline stages.
- Weekly CV submission counts (synced to vacancy_cv_weekly_kpi).

### association_type
The relationship type between a candidate and a job opening:
- "atraccion" = the candidate is/was in a recruitment process for this vacancy.
- "formacion" = the candidate is/was in a training program (this vacancy represents a promotion).

### GW Tags
Tags in vacancy_tag_counts_kpi with prefix "GW" are internal GlobalWorking process tags (e.g., GW-Seleccionado, GW-Entrevista).

## Status Values (estado_actual in candidates_kpi)
- "Formación" or similar = currently in training.
- "Dropout" = dropped out of the program.
- "Graduado" = completed training.
- "Contratado" = hired/placed.
`

const KPI_DEFINITIONS = `# KPI Dashboard — KPI Definitions

## Per-Vacancy KPIs (from job_openings_kpi)

### ratio_exito_contactados (Success Rate)
Percentage of contacted candidates who were successfully hired.
- Formula: hired_count / total_candidates * 100
- Stored as a decimal in Supabase (e.g., 0.15 = 15%).
- Applies to: principal vacancies (is_vacante_principal = true).

### ratio_descarte (Discard Rate)
Percentage of candidates who were discarded from the process.
- Formula: discarded_count / total_candidates * 100
- Stored as a decimal.
- Applies to: principal vacancies.

### total_candidates
Total number of candidates ever associated with this vacancy (all statuses).

### hired_count
Number of candidates who reached the "hired" status for this vacancy.

### hiring_target
The goal number of candidates to hire for this vacancy.

## Weekly CVs

### CVs This Week
Sum of candidate_count in vacancy_cv_weekly_kpi WHERE week_start = ISO date of the current Monday.
- Represents the number of new CVs received in the current week across all vacancies.
- week_start is always a Monday in ISO format (YYYY-MM-DD).

### CV Trend
Weekly series of candidate_count values from vacancy_cv_weekly_kpi, ordered by week_start ASC.
- Used for time-series charts showing recruitment activity over time.
- Can be filtered by vacancy_id for per-vacancy trend.

## Global Aggregates

### avg_ratio_exito (Average Success Rate)
Average of ratio_exito_contactados across all principal vacancies (is_vacante_principal = true, title != "BBDD").

### avg_ratio_descarte (Average Discard Rate)
Average of ratio_descarte across all principal vacancies.

## Germany Pipeline

### Stage Counts
germany_candidates_kpi is grouped by "stage" column. Each stage represents a step in the Germany placement pipeline.
- No fixed stage list — stages come from the source Google Sheet.

## Active Promotions
Promotions where fecha_fin > today OR fecha_fin IS NULL.
- "Active" means the training cohort is still ongoing.

## Active Candidates in Formation
Candidates in candidates_kpi where:
- estado_actual != "Dropout"
- estado_actual != "Graduado"
- (Implicitly: still enrolled in a training program)
`

export function registerSchemaResources(server: McpServer) {
  server.resource(
    'tables-schema',
    'schema://tables',
    {
      description: 'Full schema documentation for all KPI Dashboard database tables with column definitions.',
      mimeType: 'text/markdown',
    },
    async () => ({
      contents: [
        {
          uri: 'schema://tables',
          mimeType: 'text/markdown',
          text: TABLES_SCHEMA,
        },
      ],
    })
  )

  server.resource(
    'business-glossary',
    'schema://glossary',
    {
      description: 'Business glossary for the GlobalWorking KPI Dashboard — defines Atracción, Formación, Colocación, Promoción, Vacante Principal, BBDD, Zoho, association_type, and GW tags.',
      mimeType: 'text/markdown',
    },
    async () => ({
      contents: [
        {
          uri: 'schema://glossary',
          mimeType: 'text/markdown',
          text: GLOSSARY,
        },
      ],
    })
  )

  server.resource(
    'kpi-definitions',
    'schema://kpi-definitions',
    {
      description: 'Definitions and formulas for all KPI metrics: success rate, discard rate, weekly CVs, average metrics, and Germany pipeline.',
      mimeType: 'text/markdown',
    },
    async () => ({
      contents: [
        {
          uri: 'schema://kpi-definitions',
          mimeType: 'text/markdown',
          text: KPI_DEFINITIONS,
        },
      ],
    })
  )
}
