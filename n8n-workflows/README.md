# n8n Workflows - KPI Dashboard Sync

Workflows to extract data from Zoho Recruit and push to the KPI Dashboard API.

## Workflows

| File | Schedule | Description |
|------|----------|-------------|
| `01-sync-job-openings.json` | Daily 02:00 | Syncs job openings from Zoho Recruit |
| `02-sync-candidates.json` | Daily 02:15 | Syncs candidates (incremental, modified since yesterday) |
| `03-sync-activities.json` | Daily 03:00 | Syncs candidate status change activities |
| `04-process-all.json` | Daily 04:00 | Runs post-sync processing (stats + days calculations) |

## Execution Order

The workflows are scheduled sequentially to respect data dependencies:

```
02:00  Job Openings sync (referenced by candidates)
02:15  Candidates sync (needs job openings to exist)
03:00  Activities sync (needs candidates to exist)
04:00  Processing (recalculates stats and days_in_process)
```

## Setup

### 1. Import Workflows

1. Open your n8n instance
2. Go to **Workflows** > **Import from File**
3. Import each JSON file in order (01 through 04)
4. Activate each workflow after import

### 2. Required Environment Variables

Set these in your n8n instance under **Settings** > **Environment Variables** (or via `N8N_` env vars in Docker/server config):

| Variable | Description | Example |
|----------|-------------|---------|
| `DASHBOARD_URL` | Base URL of the deployed KPI dashboard (no trailing slash) | `https://kpi.example.com` |
| `SYNC_API_KEY` | API key matching the dashboard's `SYNC_API_KEY` env var | `sk-...` |

### 3. Zoho Recruit OAuth2 Credential

The workflows use n8n's built-in Zoho OAuth2 credential type (`zohoRecruitOAuth2Api`).

1. Go to **Credentials** > **New Credential**
2. Search for "Zoho" or "HTTP Request" with OAuth2
3. Configure:
   - **Client ID**: From Zoho API Console
   - **Client Secret**: From Zoho API Console
   - **Authorization URL**: `https://accounts.zoho.com/oauth/v2/auth`
   - **Access Token URL**: `https://accounts.zoho.com/oauth/v2/token`
   - **Scope**: `ZohoRecruit.modules.ALL`
4. Connect the credential and authorize

**Alternative**: If you manage tokens via an existing n8n DataTable workflow, replace the `authentication` config in each Zoho HTTP Request node with a manual `Authorization: Bearer {{token}}` header.

## Manual Execution

To run any workflow manually:

1. Open the workflow in n8n
2. Click **Execute Workflow** (play button)
3. Check the execution log for results

To run all syncs in sequence, execute them in order: 01 > 02 > 03 > 04.

## Rate Limit Considerations

Zoho Recruit API limits:

- **5,000 API calls/day** (standard plan)
- **200 records per page** (max)
- The activities workflow (03) is the heaviest consumer -- it makes 1 API call per candidate
- Activities are capped at **200 candidates per run** to stay within limits
- The HTTP Request nodes for Zoho use **batching** (5 concurrent, 1s interval) to avoid throttling

### Estimated daily API usage

| Workflow | Calls (approx) |
|----------|-----------------|
| 01 - Job Openings | 1-5 (depends on total openings) |
| 02 - Candidates | 5-20 (incremental, pages of 200) |
| 03 - Activities | 1-200 (one per recently modified candidate) |
| 04 - Processing | 2 (dashboard API only, no Zoho calls) |

**Total**: ~10-225 Zoho API calls/day (well within 5,000 limit)

## Troubleshooting

- **401 from dashboard**: Check `SYNC_API_KEY` matches between n8n env and dashboard env
- **401 from Zoho**: Re-authorize the OAuth2 credential in n8n
- **Empty data**: Zoho returns `{"data": null}` when no records match -- the transform nodes handle this
- **Timeout on activities**: Reduce the candidate limit in the "Extract Candidate IDs" code node (default: 200)

## Dashboard API Endpoints Used

| Endpoint | Method | Workflow |
|----------|--------|----------|
| `/api/sync/job-openings` | POST | 01 |
| `/api/sync/candidates` | POST | 02 |
| `/api/sync/activities` | POST | 03 |
| `/api/process/stats` | POST | 04 |
| `/api/process/candidates-days` | POST | 04 |
