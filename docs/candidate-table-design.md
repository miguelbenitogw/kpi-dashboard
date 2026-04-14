# CandidateDetailTable -- Design Document

## Overview

A comprehensive, full-information candidate table that merges data from two sources:
- **Zoho Recruit** (`candidates` table) -- statuses, stages, owner, SLA, activity
- **Google Sheets** (`promo_students` table) -- dropout info, enrollment dates, notes, sheet-specific statuses

The table is used in the Promo Detail page (`/performance/[promoId]`) as a replacement for the current simplified student list in `PromoDetail.tsx`, and can also be mounted standalone for global candidate views.

---

## 1. Component API

### `CandidateDetailTable`

```typescript
interface MergedCandidate {
  // From candidates (Zoho)
  id: string                        // Zoho candidate ID
  full_name: string | null
  email: string | null
  phone: string | null
  nationality: string | null
  native_language: string | null
  english_level: string | null
  german_level: string | null
  work_permit: string | null
  current_status: string | null     // Zoho status (49 possible values)
  candidate_stage: string | null
  global_status: string | null
  owner: string | null              // Recruiter name
  source: string | null             // How they found us
  job_opening_id: string | null
  job_opening_title: string | null
  created_time: string | null
  modified_time: string | null
  last_activity_time: string | null
  days_in_process: number | null
  days_since_activity: number | null
  sla_status: string | null

  // From promo_students (Google Sheets) -- null when no sheet match
  promo_student_id: string | null
  sheet_status: string | null
  sheet_stage: string | null
  enrollment_date: string | null
  start_date: string | null
  end_date: string | null
  dropout_reason: string | null
  dropout_date: string | null
  dropout_notes: string | null
  notes: string | null
  country_of_residence: string | null
  tab_name: string | null           // Sheet tab (e.g. "Activos", "Bajas")
  match_confidence: string | null   // How reliably Zoho <-> Sheet matched

  // Computed
  has_sheet_data: boolean
  is_dropout: boolean
}

interface CandidateDetailTableProps {
  candidates: MergedCandidate[]
  jobOpeningId?: string             // When scoped to a specific promo
  jobOpeningTitle?: string
  showPromoColumn?: boolean         // true when viewing across multiple promos
  onRowClick?: (candidate: MergedCandidate) => void  // Opens detail drawer
  initialFilters?: Partial<FilterState>
}
```

### Filter State

```typescript
interface FilterState {
  search: string                    // Name or email search
  statuses: string[]                // Multi-select from ALL_STATUSES
  nationalities: string[]           // Multi-select
  sources: string[]                 // Multi-select
  owners: string[]                  // Multi-select
  slaStatus: string | null          // green | yellow | red | critical
  hasDropout: boolean | null        // true = only dropouts, false = exclude dropouts, null = all
  sheetTab: string | null           // Filter by sheet tab name
}
```

### Sort State

```typescript
type SortField =
  | 'full_name'
  | 'email'
  | 'nationality'
  | 'current_status'
  | 'owner'
  | 'source'
  | 'created_time'
  | 'last_activity_time'
  | 'days_in_process'
  | 'sla_status'
  | 'enrollment_date'
  | 'dropout_date'

interface SortState {
  field: SortField
  direction: 'asc' | 'desc'
}
```

---

## 2. Column Definitions

### Default Visible Columns

| # | Column | Field | Width | Sortable | Notes |
|---|--------|-------|-------|----------|-------|
| 1 | Name | `full_name` | 180px min | Yes | Bold, primary identifier |
| 2 | Email | `email` | 200px min | Yes | Truncated with tooltip, `mailto:` link |
| 3 | Phone | `phone` | 130px | No | Click-to-copy |
| 4 | Nationality | `nationality` | 120px | Yes | Flag emoji + country name |
| 5 | Languages | `native_language`, `english_level`, `german_level` | 160px | No | Compact: "ES / B2 / A1" format |
| 6 | Status | `current_status` | 180px | Yes | Color-coded badge using `STATUS_COLORS` from `StatusBreakdown.tsx` |
| 7 | SLA | `sla_status` | 80px | Yes | Colored pill: green/yellow/red/critical |
| 8 | Source | `source` | 130px | Yes | How they found us |
| 9 | Owner | `owner` | 130px | Yes | Recruiter name |
| 10 | Created | `created_time` | 100px | Yes | Relative date ("3 days ago") with tooltip for full date |
| 11 | Last Activity | `last_activity_time` | 110px | Yes | Relative date with full tooltip |
| 12 | Days | `days_in_process` | 70px | Yes | Numeric, right-aligned |
| 13 | Promo/Job | `job_opening_title` | 150px | No | Only when `showPromoColumn=true` |
| 14 | Zoho ID | `id` | 100px | No | External link to `https://recruit.zoho.eu/recruit/EntityInfo.do?module=Candidates&id={id}` |

### Expandable Row Detail (shown on row click or chevron)

When a row is expanded, show a panel below the row with:

| Section | Fields | Layout |
|---------|--------|--------|
| **Sheet Data** | `sheet_status`, `sheet_stage`, `enrollment_date`, `start_date`, `end_date`, `tab_name` | 3-column grid |
| **Dropout Info** | `dropout_reason`, `dropout_date`, `dropout_notes` | Highlighted in red/amber if present |
| **Notes** | `notes` | Full-width text block |
| **Match Info** | `match_confidence`, `zoho_candidate_id` link | Small metadata row |
| **Stage History** | Timeline of `stage_history` entries | Vertical timeline (reuse pattern from `PromoDetail.tsx`) |

The expanded row re-uses the timeline pattern already in `PromoDetail.tsx` (dot + from/to status badges + date).

---

## 3. Filter Options

### Search Bar
- Searches across `full_name` and `email`
- Debounced (300ms)
- Case-insensitive, partial match

### Filter Dropdowns

| Filter | Source | UI Element |
|--------|--------|------------|
| Status | `ALL_STATUSES` from `transform.ts` (49 values) | Multi-select dropdown with colored dots |
| Nationality | Distinct values from loaded candidates | Multi-select dropdown |
| Source | Distinct values from loaded candidates | Multi-select dropdown |
| Owner | Distinct values from loaded candidates | Multi-select dropdown |
| SLA | `green`, `yellow`, `red`, `critical` | Single-select dropdown |
| Dropout | `All` / `Dropouts only` / `No dropouts` | Toggle/segmented control |
| Sheet Tab | Distinct `tab_name` values | Single-select dropdown (only visible when sheet data exists) |

### Active Filter Chips
- Show active filters as removable chips above the table
- "Clear all filters" button when any filter is active
- Show filtered count: "(23 of 145 candidates)"

---

## 4. Features

### 4.1 Sorting
- Click column header to sort ascending, click again for descending
- Visual indicator: chevron up/down icon (matching existing `SortIcon` pattern from `CandidateTable.tsx`)
- Default sort: `current_status` ascending

### 4.2 Pagination
- 50 candidates per page (configurable via prop)
- Page controls: Previous / Next + page number display
- "Showing 1-50 of 342" text
- Jump to first/last page buttons
- Persist current page in URL query params (`?page=3`)

### 4.3 Export to CSV
- Button in toolbar: "Export CSV"
- Exports ALL filtered candidates (not just current page)
- Columns match visible table columns
- Filename: `candidates-{jobOpeningTitle}-{date}.csv`
- Uses client-side CSV generation (no server round-trip)

### 4.4 Expandable Rows
- Chevron icon on the left of each row
- Click row or chevron to expand/collapse
- Only one row expanded at a time (accordion pattern)
- Expanded panel shows: sheet data, dropout info, notes, stage history timeline
- If `onRowClick` prop is provided, clicking opens the StudentDetailDrawer instead

### 4.5 Responsive
- Horizontal scroll wrapper (`overflow-x-auto`) on mobile
- Minimum table width: 1200px
- Sticky first column (Name) on horizontal scroll
- Filter bar collapses into a "Filters" button with slide-out panel on mobile (<768px)

### 4.6 Status Badges
- Use `STATUS_COLORS` map from `StatusBreakdown.tsx` (all 49 statuses mapped)
- Badge format: colored dot + text (matching existing pattern in `PromoDetail.tsx`)
- SLA badges use existing `SLA_BADGE` color classes from `PromoDetail.tsx`
- Dropout rows get a subtle red-tinted background: `bg-red-500/5`

### 4.7 Empty/Loading States
- Loading: skeleton rows (8 rows with pulsing gray blocks)
- Empty (no candidates): centered message with icon
- Empty (filters too restrictive): "No candidates match your filters" + clear filters button

---

## 5. Data Fetching Strategy

### 5.1 Query: `getMergedCandidates(jobOpeningId: string)`

File: `src/lib/queries/candidates-merged.ts`

**Approach**: Two parallel queries, merge client-side.

```
Query 1: candidates
  SELECT * FROM candidates
  WHERE job_opening_id = $1
  ORDER BY modified_time DESC

Query 2: promo_students
  SELECT * FROM promo_students
  WHERE job_opening_id = $1

Merge logic:
  1. Index promo_students by zoho_candidate_id -> Map<string, PromoStudent>
  2. For each candidate, look up matching promo_student
  3. Merge fields into MergedCandidate
  4. For promo_students WITHOUT a zoho_candidate_id match:
     - Create a MergedCandidate with sheet data only (Zoho fields null)
     - These are students in the sheet who haven't been matched to Zoho yet
```

**Why two queries instead of a DB join?**
- Supabase JS client doesn't support LEFT JOIN across unrelated tables easily
- The merge is simple (Map lookup by ID) and fast client-side
- Keeps each query cacheable independently
- Avoids complex RPC functions for a straightforward operation

### 5.2 Query: `getCandidateStageHistory(candidateId: string)`

For the expandable row detail, fetched on-demand when a row is expanded.

```
SELECT * FROM stage_history
WHERE candidate_id = $1
ORDER BY changed_at ASC
```

This is lazy-loaded -- not fetched until the user expands a row.

### 5.3 Query: `getAllCandidatesMerged()` (global view, no promo filter)

For a global candidate table (future use):

```
Query 1: candidates (all, paginated server-side)
  SELECT * FROM candidates
  ORDER BY modified_time DESC
  LIMIT 50 OFFSET $1

Query 2: promo_students (only for matched candidates)
  SELECT * FROM promo_students
  WHERE zoho_candidate_id IN ($candidateIds)
```

For the global view, server-side pagination is required (too many candidates to load all at once). For the promo-scoped view, client-side pagination is fine since a single promo typically has <500 candidates.

### 5.4 Real-time Updates

Re-use the existing `subscribeToPromoChanges()` from `promos.ts`. On change:
1. Update the affected candidate in the local array
2. Re-apply filters and sort
3. Flash the updated row briefly (green border pulse animation)

---

## 6. Component Hierarchy

```
CandidateDetailTable
  TableToolbar
    SearchInput                    -- debounced text search
    FilterDropdowns
      StatusMultiSelect            -- multi-select with colored dots
      NationalityMultiSelect
      SourceMultiSelect
      OwnerMultiSelect
      SlaSelect
      DropoutToggle
    ActiveFilterChips              -- removable filter badges
    ExportCsvButton
    PaginationInfo                 -- "Showing 1-50 of 342"
  TableContainer                   -- overflow-x-auto wrapper
    TableHeader                    -- sortable column headers
      SortableHeaderCell (x N)
    TableBody
      CandidateRow (x N)           -- main row
        StatusBadge                -- colored dot + text
        SlaBadge                   -- colored pill
        ZohoLink                   -- external link icon
      ExpandedRowPanel             -- sheet data, dropout, history
        SheetDataGrid
        DropoutInfoCard
        NotesBlock
        StageHistoryTimeline       -- reuses timeline pattern
  PaginationControls               -- prev/next page buttons
```

---

## 7. File Structure

```
src/
  lib/
    queries/
      candidates-merged.ts         -- getMergedCandidates(), getCandidateStageHistory()
  components/
    candidates/
      CandidateDetailTable.tsx      -- main table component
      TableToolbar.tsx              -- search + filters + export
      CandidateRow.tsx              -- single row + expand logic
      ExpandedRowPanel.tsx          -- expanded detail panel
      StatusBadge.tsx               -- reusable status badge (uses STATUS_COLORS)
      SlaBadge.tsx                  -- reusable SLA badge
      PaginationControls.tsx        -- page navigation
      csv-export.ts                 -- CSV generation utility
      types.ts                      -- MergedCandidate, FilterState, SortState
```

---

## 8. Implementation Plan

### Phase 1: Types and Query Layer (1-2 hours)
1. Create `src/components/candidates/types.ts` with `MergedCandidate`, `FilterState`, `SortState`
2. Create `src/lib/queries/candidates-merged.ts` with `getMergedCandidates()`
3. Add `getCandidateStageHistory()` for lazy-loaded expanded rows

### Phase 2: Core Table (2-3 hours)
4. Build `CandidateDetailTable.tsx` with column definitions and rendering
5. Build `CandidateRow.tsx` with status/SLA badges
6. Implement sort logic (reuse pattern from existing `CandidateTable.tsx`)
7. Add horizontal scroll wrapper with sticky name column

### Phase 3: Filters and Search (1-2 hours)
8. Build `TableToolbar.tsx` with search input
9. Add multi-select filter dropdowns (status, nationality, source, owner)
10. Add active filter chips with clear functionality
11. Wire up debounced search

### Phase 4: Expandable Rows (1-2 hours)
12. Build `ExpandedRowPanel.tsx` with sheet data grid
13. Add dropout info display (conditionally highlighted)
14. Add lazy-loaded stage history timeline (reuse existing timeline pattern)
15. Accordion behavior (one expanded at a time)

### Phase 5: Pagination and Export (1 hour)
16. Build `PaginationControls.tsx`
17. Implement client-side CSV export
18. URL query param persistence for page number

### Phase 6: Integration (1 hour)
19. Replace existing student list in `PromoDetail.tsx` with `CandidateDetailTable`
20. Wire up `onRowClick` to open `StudentDetailDrawer` (from promo-performance-design.md)
21. Connect real-time subscription for live updates

### Phase 7: Polish (1 hour)
22. Loading skeleton states
23. Empty states (no data, no filter matches)
24. Row flash animation on real-time update
25. Responsive filter panel for mobile

**Total estimated effort: 8-12 hours**

---

## 9. Dependencies

- No new packages required
- Uses existing Supabase client (`@/lib/supabase/client`)
- Uses existing status color system (`StatusBreakdown.tsx` -> `STATUS_COLORS`)
- Uses existing SLA badge pattern (`PromoDetail.tsx` -> `SLA_BADGE`)
- Uses existing sort icon pattern (`CandidateTable.tsx` -> `SortIcon`)
- Tailwind CSS for all styling (dark theme, consistent with existing components)

---

## 10. Design Decisions and Tradeoffs

| Decision | Rationale |
|----------|-----------|
| Client-side merge instead of DB join | Simpler queries, each independently cacheable, avoids RPC complexity |
| Client-side pagination for promo view | Promos have <500 candidates typically; avoids server round-trips on page change |
| Server-side pagination for global view | Global candidate list can be 10K+; must paginate at DB level |
| Lazy-load stage history on expand | Avoids loading N*M rows upfront; most users only expand a few rows |
| Single expanded row at a time | Keeps DOM manageable; multiple open panels would be visually cluttered |
| CSV export client-side | No server endpoint needed; works with filtered data; small enough datasets |
| Sticky first column | Name is the primary identifier; must remain visible during horizontal scroll |
| URL query params for page | Allows bookmarking and sharing specific table states |
