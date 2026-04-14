# Social Media Reach & Google Analytics — Design Document

## Overview

A new dashboard page (`/dashboard/analytics`) to consolidate social media reach metrics and Google Analytics data into a single view. The goal is to give Global Working visibility into their digital presence performance: how many people they reach, where traffic comes from, and which platforms/content perform best.

---

## 1. Data Sources

### 1.1 Google Analytics 4 (GA4)

**API**: [GA4 Data API (v1beta)](https://developers.google.com/analytics/devguides/reporting/data/v1)

| Metric | API Dimension/Metric | Notes |
|--------|---------------------|-------|
| Page views | `screenPageViews` | Total and per-page |
| Sessions | `sessions` | Unique sessions over time |
| Active users | `activeUsers` | DAU / WAU / MAU |
| Traffic sources | `sessionSource`, `sessionMedium` | Organic, social, direct, referral, paid |
| Geographic breakdown | `country`, `city` | Where visitors come from |
| Top landing pages | `landingPage` | Which pages attract traffic |
| Conversion events | `eventCount` filtered by event name | Requires GA4 events configured (e.g., form submissions, "Apply Now" clicks) |
| Bounce rate | `bounceRate` | Session quality indicator |
| Avg session duration | `averageSessionDuration` | Engagement depth |

**Credentials needed**:
- GA4 Property ID (e.g., `properties/123456789`)
- Google Cloud service account with "Viewer" role on the GA4 property
- Service account JSON key (stored server-side, NEVER exposed to client)

**Rate limits**: 10 requests per second per property. Batch requests supported (up to 5 report requests per batch). Core quota: 10,000 requests/day for free.

**NPM package**: `@google-analytics/data` (official Node.js client)

---

### 1.2 LinkedIn (Company Page Analytics)

**API**: [LinkedIn Marketing API — Organizational Statistics](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-statistics)

| Metric | Endpoint | Notes |
|--------|----------|-------|
| Followers count | `GET /organizationalEntityFollowerStatistics` | Total + new followers over time |
| Page views | `GET /organizationPageStatistics` | Views on company page |
| Post impressions | `GET /organizationalEntityShareStatistics` | Per-post and aggregate |
| Post engagement | Same endpoint | Likes, comments, shares, clicks |
| Follower demographics | `GET /organizationalEntityFollowerStatistics` | By country, industry, seniority |

**Credentials needed**:
- LinkedIn App (created at developers.linkedin.com)
- OAuth 2.0 access token with scopes: `r_organization_social`, `rw_organization_admin`
- Organization ID (the company page URN)
- Access tokens expire every 60 days — refresh flow required

**Rate limits**: 100 requests/day for most analytics endpoints. Application-level daily throttle.

**Difficulty**: MEDIUM-HIGH. LinkedIn's API requires a verified app and the admin of the company page must authorize it. The 60-day token refresh adds operational overhead.

---

### 1.3 Instagram (via Meta Business API)

**API**: [Instagram Graph API](https://developers.facebook.com/docs/instagram-api/)

| Metric | Endpoint | Notes |
|--------|----------|-------|
| Followers | `GET /{ig-user-id}?fields=followers_count` | Current total |
| Reach | `GET /{ig-user-id}/insights?metric=reach` | Unique accounts that saw any content |
| Impressions | `GET /{ig-user-id}/insights?metric=impressions` | Total views (includes repeats) |
| Profile views | `GET /{ig-user-id}/insights?metric=profile_views` | How many visited the profile |
| Post-level metrics | `GET /{ig-media-id}/insights` | Reach, impressions, saves, shares per post |
| Audience demographics | `GET /{ig-user-id}/insights?metric=audience_city,audience_country` | Requires 100+ followers |
| Stories metrics | `GET /{ig-media-id}/insights` | Replies, exits, taps forward/back |

**Credentials needed**:
- Meta Business App (developers.facebook.com)
- Facebook Page linked to the Instagram Professional account
- Long-lived access token (via OAuth flow, valid 60 days, then refreshable)
- Permissions: `instagram_basic`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`

**Rate limits**: 200 calls/user/hour. Insights endpoints count toward this.

**Difficulty**: MEDIUM. Requires a Professional (Business or Creator) Instagram account linked to a Facebook Page. The Meta review process can take days.

---

### 1.4 Facebook Page (via Meta Business API)

**API**: [Facebook Page Insights](https://developers.facebook.com/docs/graph-api/reference/page/insights/)

| Metric | Endpoint | Notes |
|--------|----------|-------|
| Page likes / followers | `GET /{page-id}?fields=fan_count,followers_count` | Current totals |
| Page reach | `GET /{page-id}/insights/page_impressions_unique` | Unique people who saw any content |
| Post reach & engagement | `GET /{post-id}/insights` | Per-post metrics |
| Page views | `GET /{page-id}/insights/page_views_total` | Profile page visits |
| Video views | `GET /{page-id}/insights/page_video_views` | If video content is posted |
| Audience demographics | `GET /{page-id}/insights/page_fans_city,page_fans_country` | Fan breakdown |

**Credentials needed**:
- Same Meta Business App as Instagram (shared)
- Page access token with permissions: `pages_show_list`, `pages_read_engagement`, `read_insights`
- The Facebook Page must be linked to the Meta Business App

**Rate limits**: 200 calls/user/hour (shared with Instagram if same token).

**Difficulty**: MEDIUM. Facebook and Instagram can share the same Meta app and token, reducing setup effort.

---

### 1.5 TikTok (Business API)

**API**: [TikTok Business API — Creator/Business Insights](https://developers.tiktok.com/doc/research-api-get-user-info/)

| Metric | Available | Notes |
|--------|-----------|-------|
| Followers | Yes | Via user info endpoint |
| Video views | Yes | Per-video and aggregate |
| Likes, comments, shares | Yes | Per-video engagement |
| Profile views | LIMITED | Not always available via API |
| Audience demographics | LIMITED | Requires TikTok for Business with sufficient following |
| Reach / impressions | LIMITED | TikTok's API is less mature than Meta's |

**Credentials needed**:
- TikTok Developer App (developers.tiktok.com)
- OAuth 2.0 authorization from the TikTok Business account
- Scopes: `user.info.basic`, `user.info.stats`, `video.list`

**Rate limits**: Vary by endpoint. Generally 600 requests/minute for most endpoints.

**Difficulty**: HIGH. TikTok's Business API has limited analytics endpoints compared to Meta. The approval process is strict. Worth deferring unless TikTok is a primary channel.

---

### 1.6 YouTube (YouTube Data API v3)

**API**: [YouTube Analytics API](https://developers.google.com/youtube/analytics/reference)

| Metric | Endpoint | Notes |
|--------|----------|-------|
| Subscribers | `GET /channels?part=statistics` | Current count |
| Video views | `GET /channels?part=statistics` | Total + per-video |
| Watch time | YouTube Analytics API | Minutes watched |
| Impressions & CTR | YouTube Analytics API | Thumbnail impressions, click-through rate |
| Traffic sources | YouTube Analytics API | Search, suggested, external, etc. |
| Audience demographics | YouTube Analytics API | Age, gender, geography |
| Top videos | YouTube Analytics API | By views, watch time, engagement |

**Credentials needed**:
- Google Cloud project (can be same as GA4)
- OAuth 2.0 or service account with YouTube Analytics API enabled
- Channel must be linked to the Google Cloud project
- Scopes: `yt-analytics.readonly`, `yt-analytics-monetary.readonly` (if revenue data needed)

**Rate limits**: 10,000 units/day (quota varies by endpoint, most reads cost 1-5 units).

**Difficulty**: LOW-MEDIUM. Uses the same Google Cloud project as GA4. If Global Working has a YouTube channel, this is straightforward to set up alongside GA4.

---

## 2. UI Design Plan

### 2.1 Page Structure

Route: `/dashboard/analytics`
Sidebar label: "Alcance & Analytics"
Icon: `BarChart3` or `TrendingUp` from lucide-react

The page follows the same pattern as `/dashboard/funnel`:
- Header with title and description
- Summary KPI cards row
- Sectioned content with icons and headings
- Dark theme (gray-800/900 backgrounds, gray-100/400 text)

### 2.2 Overview KPI Cards (Top Row)

| Card | Value | Source |
|------|-------|--------|
| Total Reach (7d) | Sum of reach across all platforms | All social APIs |
| Total Followers | Aggregate follower count | All social APIs |
| Website Sessions (7d) | Sessions from GA4 | GA4 |
| Engagement Rate (7d) | (Total interactions / Total impressions) x 100 | All social APIs |

### 2.3 Sections

#### Section A: Website Traffic (GA4)
- **Time series line chart**: Sessions, users, page views over last 30/90 days (date range selector)
- **Traffic sources donut chart**: Organic, Social, Direct, Referral, Paid breakdown
- **Top landing pages table**: Page URL, views, avg time on page, bounce rate
- **Geographic breakdown**: Table or simple bar chart by country (heatmap deferred to later phase)

#### Section B: Platform-by-Platform Social Metrics
- **Card grid** (one card per active platform): Logo, follower count, reach (7d), engagement rate
- **Expandable detail**: Click a platform card to see its detailed time series (reach, impressions, followers over time)
- Each card shows trend arrow (up/down vs previous period)

#### Section C: Reach Over Time
- **Stacked area chart**: Total reach/impressions broken down by platform (LinkedIn, Instagram, Facebook, etc.) over last 30 days
- **Toggle**: Switch between "Reach" and "Impressions"

#### Section D: Top Performing Content
- **Table**: Platform, content title/preview, date, reach, engagement, link to original post
- Sorted by reach or engagement (toggleable)
- Limit to top 10-20

#### Section E: Paid vs Organic
- **Side-by-side bar chart**: Organic reach vs Paid reach per platform
- Only relevant if paid campaigns exist (conditionally rendered)

### 2.4 Date Range Controls

A shared date range picker at the top of the page (similar to how funnel page works):
- Quick presets: Last 7 days, Last 30 days, Last 90 days
- Custom date range
- All sections react to the selected range

---

## 3. Implementation Approach

### 3.1 Recommended Integration Order

| Phase | Platform | Reason |
|-------|----------|--------|
| 1 | **Google Analytics 4** | Easiest to set up. Uses service account (no user OAuth). Most valuable data (website traffic). Same Google Cloud project can later serve YouTube. |
| 2 | **Instagram + Facebook** | Single Meta app covers both. Meta's API is well-documented. High visual impact for a recruitment company. |
| 3 | **LinkedIn** | Important for B2B recruitment reach but API is more restrictive. Token refresh every 60 days adds maintenance. |
| 4 | **YouTube** | Only if actively used. Low effort if GA4 Google Cloud project already exists. |
| 5 | **TikTok** | Defer unless it's a primary channel. API is the least mature. |

### 3.2 Data Architecture

**Option A: Live queries (simpler, recommended for Phase 1)**
- Next.js API routes call platform APIs on demand
- Cache responses in memory or with `next/cache` (revalidate every 15-30 minutes)
- Pros: No database schema changes, faster to ship
- Cons: Slower page loads, rate limit risk with heavy usage

**Option B: Supabase cache layer (recommended for Phase 2+)**
- Scheduled sync job (Supabase Edge Function on cron, or Vercel cron) pulls data every 1-6 hours
- Store aggregated metrics in new Supabase tables:
  - `social_metrics_daily` (platform, date, followers, reach, impressions, engagement)
  - `ga4_metrics_daily` (date, sessions, users, pageviews, source, medium)
  - `social_posts` (platform, post_id, date, content_preview, reach, engagement, url)
- Pros: Fast queries, no rate limit issues at read time, historical data preserved
- Cons: More infrastructure, sync job maintenance

**Recommended path**: Start with Option A for GA4 (server-side, cached). Move to Option B as more platforms are added and historical analysis becomes important.

### 3.3 File Structure (Following Existing Patterns)

```
src/
  app/dashboard/analytics/
    page.tsx                    # Main page component (client)
  components/analytics/
    AnalyticsKpiCards.tsx        # Top summary cards
    TrafficSourcesChart.tsx     # GA4 traffic sources donut
    SessionsTimeChart.tsx       # GA4 sessions over time
    TopLandingPages.tsx         # GA4 top pages table
    PlatformCards.tsx           # Social media platform grid
    ReachOverTimeChart.tsx      # Stacked area chart (all platforms)
    TopContentTable.tsx         # Best performing posts
    PaidVsOrganicChart.tsx      # Paid vs organic comparison
    DateRangeSelector.tsx       # Shared date range picker
  lib/queries/
    analytics.ts               # GA4 data fetching + aggregation
    social-metrics.ts           # Social media API calls + aggregation
```

### 3.4 Environment Variables Needed

```env
# Google Analytics 4
GA4_PROPERTY_ID=properties/XXXXXXXXX
GA4_SERVICE_ACCOUNT_KEY=<base64-encoded JSON key or path to JSON file>

# Meta (Instagram + Facebook)
META_APP_ID=XXXXXXXXXXXXXXXX
META_APP_SECRET=XXXXXXXXXXXXXXXX
META_ACCESS_TOKEN=<long-lived-token>
META_INSTAGRAM_USER_ID=XXXXXXXXXXXXXXXX
META_FACEBOOK_PAGE_ID=XXXXXXXXXXXXXXXX

# LinkedIn
LINKEDIN_CLIENT_ID=XXXXXXXXXXXXXXXX
LINKEDIN_CLIENT_SECRET=XXXXXXXXXXXXXXXX
LINKEDIN_ACCESS_TOKEN=<token>
LINKEDIN_ORGANIZATION_ID=XXXXXXXXXXXXXXXX

# YouTube (if applicable)
# Uses same Google Cloud project as GA4
YOUTUBE_CHANNEL_ID=UCXXXXXXXXXXXXXXXX

# TikTok (if applicable)
TIKTOK_APP_ID=XXXXXXXXXXXXXXXX
TIKTOK_APP_SECRET=XXXXXXXXXXXXXXXX
TIKTOK_ACCESS_TOKEN=<token>
```

### 3.5 Suggested NPM Packages

| Package | Purpose |
|---------|---------|
| `@google-analytics/data` | Official GA4 Data API client for Node.js |
| `googleapis` | Alternative: covers GA4 + YouTube in one package. Heavier but more versatile. |

No additional packages needed for Meta/LinkedIn/TikTok — these are simple REST APIs that can be called with native `fetch()`.

### 3.6 Sidebar Addition

Add to the `navItems` array in `src/components/layout/Sidebar.tsx`:

```ts
{ href: "/dashboard/analytics", label: "Alcance & Analytics", icon: BarChart3 }
```

Import `BarChart3` from `lucide-react`.

---

## 4. Supabase Schema (Phase 2 — When Caching is Needed)

```sql
-- Daily aggregated social media metrics per platform
CREATE TABLE social_metrics_daily (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,          -- 'instagram', 'facebook', 'linkedin', 'tiktok', 'youtube'
  metric_date DATE NOT NULL,
  followers INTEGER,
  reach INTEGER,
  impressions INTEGER,
  engagements INTEGER,             -- likes + comments + shares
  profile_views INTEGER,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, metric_date)
);

-- Daily GA4 metrics
CREATE TABLE ga4_metrics_daily (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_date DATE NOT NULL,
  sessions INTEGER,
  active_users INTEGER,
  pageviews INTEGER,
  bounce_rate NUMERIC(5,2),
  avg_session_duration NUMERIC(8,2),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_date)
);

-- GA4 traffic sources breakdown (daily)
CREATE TABLE ga4_traffic_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_date DATE NOT NULL,
  source TEXT NOT NULL,            -- 'google', 'linkedin', 'direct', etc.
  medium TEXT NOT NULL,            -- 'organic', 'social', 'referral', 'cpc'
  sessions INTEGER,
  users INTEGER,
  UNIQUE(metric_date, source, medium)
);

-- Top social media posts (for "top content" section)
CREATE TABLE social_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  external_post_id TEXT NOT NULL,
  posted_at TIMESTAMPTZ,
  content_preview TEXT,            -- First 200 chars
  post_url TEXT,
  reach INTEGER,
  impressions INTEGER,
  engagements INTEGER,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, external_post_id)
);

-- RLS: read-only for authenticated dashboard users
ALTER TABLE social_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE ga4_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE ga4_traffic_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
```

---

## 5. Questions for the User

Before implementation begins, we need answers to the following:

1. **Which social media platforms does Global Working actively use?**
   - LinkedIn, Instagram, Facebook, TikTok, YouTube — which ones? This determines which APIs to integrate first.

2. **Do you have Google Analytics set up on the website?**
   - If yes, what is the GA4 Property ID?
   - Is it GA4 or the older Universal Analytics (UA)? UA was sunset in July 2024 — if you only have UA, we need to set up GA4 first.

3. **Do you have Business/Professional accounts on social platforms?**
   - Instagram: Is it a Professional (Business or Creator) account? Personal accounts have no API access to insights.
   - Facebook: Is there a Facebook Business Page (not a personal profile)?
   - LinkedIn: Is there a LinkedIn Company Page, and who is the admin?
   - TikTok: Is it a TikTok Business account?

4. **Do you run paid campaigns on any platform?**
   - If yes, do you want paid vs organic reach comparisons?
   - Do you use Meta Ads Manager, LinkedIn Campaign Manager, Google Ads, etc.?

5. **Which metrics matter most to you?**
   - Pure reach/visibility? Engagement quality? Website traffic from social? Follower growth?
   - This helps prioritize what shows at the top of the dashboard.

6. **Do you have a Google Cloud project already?**
   - If yes, we can reuse it for GA4 and YouTube API access.
   - If not, we will need to create one (free tier is sufficient).

7. **Who manages the social media accounts?**
   - We need them to authorize the API connections (OAuth consent flows).
   - They would need to grant our app access to their pages/accounts.

8. **How frequently do you need the data refreshed?**
   - Real-time (every page load) vs periodic snapshots (every 1-6 hours)?
   - This determines whether we go with live API calls or the Supabase cache layer.
