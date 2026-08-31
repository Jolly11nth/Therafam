-- =============================================================================
-- THERAFAM SUBSCRIPTIONS AND THERAPIST EARNINGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR(30) NOT NULL DEFAULT 'premium',
    status VARCHAR(20) NOT NULL DEFAULT 'trialing'
        CHECK (status IN ('trialing','active','past_due','cancelled','expired')),
    trial_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    subscription_started_at TIMESTAMPTZ,
    subscription_ends_at TIMESTAMPTZ,
    payment_provider VARCHAR(50),
    payment_reference VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS therapist_earnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES therapy_sessions(id) ON DELETE SET NULL,
    amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
    earning_type VARCHAR(30) NOT NULL
        CHECK (earning_type IN ('session_payment','performance_bonus','adjustment','withdrawal')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','available','paid_out','reversed')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    available_at TIMESTAMPTZ,
    paid_out_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS therapist_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    average_rating DECIMAL(3,2) DEFAULT 0 CHECK (average_rating BETWEEN 0 AND 5),
    completed_sessions INTEGER NOT NULL DEFAULT 0,
    activity_score INTEGER NOT NULL DEFAULT 0 CHECK (activity_score BETWEEN 0 AND 100),
    consistency_score INTEGER NOT NULL DEFAULT 0 CHECK (consistency_score BETWEEN 0 AND 100),
    performance_level VARCHAR(20) NOT NULL DEFAULT 'developing'
        CHECK (performance_level IN ('developing','good','very_good','excellent')),
    bonus_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (bonus_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(therapist_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_therapist_earnings_therapist_status ON therapist_earnings(therapist_id, status);
CREATE INDEX IF NOT EXISTS idx_therapist_performance_therapist_period ON therapist_performance(therapist_id, period_end DESC);

CREATE OR REPLACE FUNCTION initialize_user_trial()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_type = 'client' THEN
        INSERT INTO user_subscriptions (user_id, plan, status, trial_started_at, trial_ends_at)
        VALUES (NEW.id, 'premium', 'trialing', NOW(), NOW() + INTERVAL '7 days')
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_initialize_user_trial ON users;
CREATE TRIGGER trg_initialize_user_trial
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION initialize_user_trial();

-- Existing clients receive a seven-day trial from migration time if no subscription exists.
INSERT INTO user_subscriptions (user_id, plan, status, trial_started_at, trial_ends_at)
SELECT id, 'premium', 'trialing', NOW(), NOW() + INTERVAL '7 days'
FROM users
WHERE user_type = 'client'
ON CONFLICT (user_id) DO NOTHING;
