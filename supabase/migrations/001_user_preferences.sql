CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key text NOT NULL DEFAULT 'default',  -- no auth for now, use 'default'
  preference_type text NOT NULL,             -- 'favorite_promos', 'dashboard_config', etc
  value jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_key, preference_type)
);
