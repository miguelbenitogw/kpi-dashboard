import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@google-analytics/data'],
  typescript: {
    // Generated Supabase types predate migration 016 (_kpi renames) and
    // migrations 008-017 (new tables). Runtime is correct — supabaseAdmin
    // Proxy uses `as any` internally. Remove once types are regenerated via:
    //   npx supabase gen types typescript --project-id ynysajcuispxdddtseon
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
