-- Railway-only additions for Therafam authentication.
-- Run after database/therafam_schema.sql and the subscriptions/earnings migration.

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(token_hash, expires_at) WHERE revoked_at IS NULL;

-- Keep user settings/profile upserts safe on Railway.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_profiles_user_id ON user_profiles(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_settings_user_id ON user_settings(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_therapist_profiles_user_id ON therapist_profiles(user_id);

-- Seven-day trial is created for every client account, including accounts imported from Supabase.
INSERT INTO user_subscriptions (user_id, plan, status, trial_started_at, trial_ends_at)
SELECT id, 'premium', 'trialing', NOW(), NOW() + INTERVAL '7 days'
FROM users
WHERE user_type = 'client'
ON CONFLICT (user_id) DO NOTHING;
