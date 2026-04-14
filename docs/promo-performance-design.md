# Promo Performance View — Design Document

## Overview

A dashboard view to track how candidates perform within "formacion" promos (e.g., Promo 113, Promo 124). Shows status distributions, conversion rates, dropout analysis, and full candidate journey timelines from attraction through hiring.

---

## 1. Data Model Changes

### Migration 003: `job_openings.category`

Adds a `category` column to `job_openings`:

| Value | Description |
|-------|-------------|
| `atraccion` | Large recruitment pools (10K-13K candidates). Default. |
| `formacion` | Training promos (Promo 113, Promo 124, etc.) |
| `interna` | Internal company positions |

Auto-classification: titles matching `%promo%` are set to `formacion`. Internal positions require manual reclassification.

### No Additional Tables Needed

The existing schema already covers the data requirements:

- **`job_openings`** — now filterable by `category = 'formacion'` to list all promos
- **`candidates`** — linked via `job_opening_id`; holds Zoho-sourced candidate data
- **`stage_history`** — tracks status transitions per candidate per job opening
- **`promo_sheets`** — links Google Sheets to promos for Excel/Sheet data
- **`promo_students`** — stores per-student data from sheets, with `zoho_candidate_id` cross-reference

### Data Flow

```
Google Sheet (Promo 113)                  Zoho Recruit
        |                                      |
   promo_students                         candidates
   (sheet data, dropouts)            (statuses, stages)
        |                                      |
        +--- zoho_candidate_id links ----------+
        |
   promo_sheets ---- job_opening_id ----> job_openings (category='formacion')
                                               |
                                          stage_history
                                     (full transition log)
```

---

## 2. Query Layer Plan

File: `src/lib/queries/performance.ts`

### 2.1 `getPromoPerformance(jobOpeningId: string)`

**Purpose**: Get all candidates in a specific promo with their current status and merged sheet data.

**Logic**:
1. Query `candidates` WHERE `job_opening_id = ?`
2. LEFT JOIN with `promo_students` ON `promo_students.zoho_candidate_id = candidates.id` AND `promo_students.job_opening_id = ?`
3. Return: candidate info, `current_status` (from Zoho), `sheet_status`, `dropout_reason`, `dropout_date`, `enrollment_date`
4. Include counts per status for the distribution chart

**Fallback for missing Zoho association**: If candidates can't be fetched by job opening from Zoho yet, fall back to `promo_students` as the primary source, enriched with Zoho data via `zoho_candidate_id`.

**SQL sketch**:
```sql
-- Primary: from promo_students (always available from sheets)
SELECT
  ps.id,
  ps.full_name,
  ps.email,
  ps.sheet_status,
  ps.dropout_reason,
  ps.dropout_date,
  ps.enrollment_date,
  ps.tab_name,
  c.current_status AS zoho_status,
  c.candidate_stage AS zoho_stage,
  c.owner,
  c.days_in_process
FROM promo_students ps
LEFT JOIN candidates c ON c.id = ps.zoho_candidate_id
WHERE ps.job_opening_id = $1

-- When Zoho association is fixed, also union with:
-- SELECT ... FROM candidates WHERE job_opening_id = $1
-- to catch candidates not yet in the sheet
```

### 2.2 `getCandidateHistory(candidateId: string)`

**Purpose**: Full timeline of a candidate across ALL projects they've been in.

**Logic**:
1. Query `stage_history` WHERE `candidate_id = ?` ORDER BY `changed_at ASC`
2. JOIN `job_openings` to get project names and categories
3. Group transitions by `job_opening_id` to show the journey per project
4. Also pull `promo_students` data for sheet-specific info (dropout details, notes)

**Returns**:
```typescript
interface CandidateHistory {
  candidate: Candidate
  projects: Array<{
    jobOpening: JobOpening      // which project
    enteredAt: string           // first stage_history entry
    exitedAt: string | null     // last stage_history entry (null if still active)
    currentStatus: string
    transitions: StageHistory[] // all status changes in this project
    sheetData?: PromoStudent    // if this was a formacion promo with sheet data
  }>
}
```

### 2.3 `getPromoComparison(promoIds: string[])`

**Purpose**: Side-by-side comparison of multiple promos.

**Metrics per promo**:
- Total students
- Status distribution (count per status)
- Conversion rate: `In Training` -> `Training Finished` -> `Hired`
- Dropout rate: count of students with `dropout_reason` IS NOT NULL (from sheets) or terminal statuses like `Expelled`, `Rejected`
- Average time to hire: from `enrollment_date` to status `Hired` (using `stage_history.changed_at`)
- Funnel: how many pass each stage

**Logic**:
1. For each promo ID, run aggregation queries
2. Use `promo_students` for dropout data (more reliable, comes from sheets)
3. Use `stage_history` for timing data
4. Return normalized comparison object

### 2.4 `getFormacionPromos()`

**Purpose**: List all formacion promos for the selector.

**Logic**:
```sql
SELECT jo.*, ps.sheet_name, ps.last_synced_at, ps.sync_status,
  (SELECT count(*) FROM promo_students WHERE job_opening_id = jo.id) AS student_count
FROM job_openings jo
LEFT JOIN promo_sheets ps ON ps.job_opening_id = jo.id
WHERE jo.category = 'formacion'
ORDER BY jo.date_opened DESC
```

---

## 3. Sync Strategy

### Active Promos (current/recent)

- Periodic sync from Zoho via existing sync pipeline
- When Zoho association API is available: fetch candidates by job opening, update `candidates` table
- Sheet sync: re-import from Google Sheets on demand or scheduled (already designed in `promo_sheets`)

### Archived Promos (old/completed)

- Candidates stored permanently in `promo_students` (from sheets) and `candidates` (from Zoho)
- No ongoing API calls needed — data is frozen
- Sheet data serves as the source of truth for dropout info, notes, etc.

### Excel Integration (Promos 113+)

- Google Sheets are already integrated via `promo_sheets` / `promo_students`
- Dropouts tab: stored in `promo_students` with `tab_name = 'Bajas'` (or similar), `dropout_reason`, `dropout_date`
- Future applications/placements: additional tabs parsed into `promo_students` with appropriate `tab_name`

---

## 4. UI Plan

### 4.1 Route Structure

```
/performance              -> Promo overview (list of all formacion promos)
/performance/[promoId]    -> Single promo detail view
/performance/compare      -> Multi-promo comparison view
```

### 4.2 Promo Overview Page (`/performance`)

**Layout**: Grid of promo cards, each showing:
- Promo name (e.g., "Promo 113")
- Status badge (active/completed/archived)
- Student count
- Key metrics: hired count, dropout count
- Last sync timestamp
- Click to navigate to detail

**Filters**:
- Status: active / completed / all
- Date range (by `date_opened`)
- Search by name

### 4.3 Promo Detail Page (`/performance/[promoId]`)

**Top Section — Summary Cards**:
- Total students
- Currently in training
- Training finished
- Hired
- Dropouts
- Conversion rate (enrolled -> hired)

**Middle Section — Status Distribution Chart**:
- Horizontal bar chart or donut chart showing count per status
- Color-coded: green (positive outcomes), red (dropouts/rejected), yellow (in progress), gray (pending)
- Statuses grouped into logical phases:
  - Pre-training: Associated, Approved by client, etc.
  - In training: In Training, Training Finished
  - Post-training: To Place, Hired, Recolocation Process
  - Dropout/Exit: Expelled, Rejected, dropout_reason from sheet

**Bottom Section — Student Table**:
- Columns: Name, Status (Zoho), Sheet Status, Enrolled Date, Owner, Days in Process
- Sortable, filterable
- Status filter chips at the top
- Search by name/email
- Click row -> opens Student Detail Drawer

### 4.4 Student Detail Drawer

A slide-over panel (right side) showing the FULL journey of a student.

**Header**: Name, email, phone, nationality

**Journey Timeline** (vertical):
```
[Atraccion Project: "DACH Nurses 2024"]
  2024-01-15  Associated
  2024-01-20  First Call
  2024-02-01  Approved by client
       |
       v
[Formacion: "Promo 113"]
  2024-02-15  In Training          <- from stage_history
  2024-02-15  Enrolled             <- from promo_students.enrollment_date
  2024-06-01  Training Finished
  2024-06-15  To Place
  2024-07-01  Hired
```

Each project shown as a card/section with:
- Project name and category badge
- Entry date -> exit date
- All status transitions with dates
- Days spent in each status

**Sheet-Specific Data** (if available):
- Dropout reason and date (from sheet)
- Notes from sheet
- German/English level at time of enrollment

**Quick Actions**:
- Link to Zoho candidate profile
- Link to Zoho job opening

### 4.5 Promo Comparison Page (`/performance/compare`)

**Selection**: Multi-select dropdown to pick 2-4 promos to compare.

**Comparison Table**:
| Metric | Promo 113 | Promo 124 | Promo 130 |
|--------|-----------|-----------|-----------|
| Total Students | 45 | 52 | 38 |
| Currently Training | 0 | 12 | 38 |
| Hired | 28 | 15 | 0 |
| Dropouts | 8 | 5 | 2 |
| Conversion Rate | 62% | 29% | - |
| Avg Days to Hire | 142 | - | - |

**Funnel Chart**: Overlaid funnels showing how each promo progresses through stages.

**Dropout Analysis**: Bar chart comparing dropout rates and reasons across promos.

---

## 5. Component Hierarchy

```
/performance
  PromoOverviewPage
    PromoCardGrid
      PromoCard (x N)

/performance/[promoId]
  PromoDetailPage
    PromoSummaryCards
    StatusDistributionChart
    StudentTable
      StudentRow (x N)
    StudentDetailDrawer        <- opens on row click
      CandidateHeader
      JourneyTimeline
        ProjectSection (x N)
          StatusTransition (x N)
      SheetDataPanel

/performance/compare
  PromoComparisonPage
    PromoMultiSelect
    ComparisonTable
    FunnelChart
    DropoutAnalysisChart
```

---

## 6. Implementation Steps

### Phase 1: Data Foundation
1. Apply migration 003 (category column)
2. Classify existing job openings (migration handles auto-classify)
3. Manually classify internal positions via Supabase dashboard

### Phase 2: Query Layer
4. Create `src/lib/queries/performance.ts` with all four query functions
5. Use `promo_students` as primary source (sheets already imported)
6. Enrich with `candidates` + `stage_history` via `zoho_candidate_id` join

### Phase 3: Promo Overview
7. Build `/performance` route with promo card grid
8. Fetch formacion promos with student counts
9. Add status badges and basic metrics per card

### Phase 4: Promo Detail
10. Build `/performance/[promoId]` route
11. Summary cards with aggregated counts
12. Status distribution chart (use existing charting library)
13. Student table with sort/filter

### Phase 5: Student Detail Drawer
14. Build drawer component with candidate header
15. Journey timeline: query `stage_history` across all job openings
16. Sheet data panel showing dropout info, notes
17. Deep-link to Zoho

### Phase 6: Comparison View
18. Build `/performance/compare` route
19. Multi-select promo picker
20. Comparison table with computed metrics
21. Funnel and dropout charts

### Phase 7: Polish
22. Loading states, error boundaries
23. Empty states for promos with no sheet data
24. Responsive layout for the drawer
25. URL state management (selected promo in query params)

---

## 7. Known Constraints and Workarounds

| Constraint | Workaround |
|-----------|------------|
| Can't fetch candidates by job opening from Zoho (yet) | Use `promo_students` as primary source, join via `zoho_candidate_id` |
| Old promos may have incomplete Zoho data | Sheet data (promo_students) is the source of truth for historical promos |
| `stage_history` only captures transitions we've seen since sync started | For historical promos, rely on sheet_status; for active promos, stage_history fills in over time |
| Candidate may appear in multiple projects | `getCandidateHistory` queries `stage_history` across ALL job openings, not just the current promo |
| Excel/Sheet column names vary between promos | `raw_data` JSONB column stores original data; normalized columns filled during import |

---

## 8. Future Enhancements

- **Automated promo detection**: When a new job opening is synced with "promo" in the title, auto-set `category = 'formacion'`
- **Alerts**: Notify when dropout rate exceeds threshold
- **Cohort analysis**: Compare promos by start month, nationality mix, language level
- **Export**: Download promo performance report as PDF/Excel
- **Zoho association fix**: Once available, enrich `candidates` table directly and simplify queries
