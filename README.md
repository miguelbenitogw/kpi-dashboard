This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Security: Google Sign-In + MFA (Supabase)

This project now includes:

- Google OAuth sign-in (`/auth/login`)
- Mandatory second factor with TOTP (`/auth/mfa`)
- Server-side route protection with `middleware.ts`
- Supabase RLS migration for authenticated-only reads

### Required configuration

1. In Supabase Auth:
   - Enable **Google** provider
   - Enable **MFA (TOTP)**
   - Add redirect URL: `https://YOUR_DOMAIN/auth/callback` (and localhost in dev)

2. Set env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ALLOWED_EMAIL_DOMAINS` (optional, CSV)
   - `ALLOWED_EMAILS` (optional, CSV)

3. Run DB migration:
   - `supabase/migrations/20260427173000_secure_authenticated_reads.sql`
   - This migration:
     - enables RLS on all `public.*_kpi` tables
     - removes legacy `"Allow public read"` policies
     - allows read only for authenticated users by default
     - keeps `dashboard_config_kpi` and `user_openai_keys_kpi` service-role only
     - applies owner-based read policies for `ai_alerts_kpi`, `ai_alert_events_kpi`, `chat_sessions_kpi`, `chat_messages_kpi`
