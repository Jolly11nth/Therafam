-- =============================================================================
-- THERAFAM THERAPIST REVIEWS
-- =============================================================================
-- A client can review a therapist only after at least three completed sessions.
-- Reviews are anonymous to other clients; only aggregate performance is public.

CREATE TABLE IF NOT EXISTS therapist_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_title VARCHAR(120),
    review_text TEXT NOT NULL CHECK (char_length(trim(review_text)) BETWEEN 10 AND 2000),
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (therapist_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_therapist_reviews_therapist ON therapist_reviews(therapist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_therapist_reviews_client ON therapist_reviews(client_id, created_at DESC);

-- Keep therapist profile aggregates synchronized with published reviews.
UPDATE therapist_profiles tp
SET rating = COALESCE(stats.avg_rating, 0),
    total_reviews = COALESCE(stats.review_count, 0),
    updated_at = NOW()
FROM (
    SELECT therapist_id, AVG(rating)::DECIMAL(3,2) AS avg_rating, COUNT(*)::INTEGER AS review_count
    FROM therapist_reviews
    WHERE is_published = TRUE
    GROUP BY therapist_id
) stats
WHERE tp.user_id = stats.therapist_id;

UPDATE therapist_profiles tp
SET rating = 0,
    total_reviews = 0,
    updated_at = NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM therapist_reviews r
    WHERE r.therapist_id = tp.user_id AND r.is_published = TRUE
);
