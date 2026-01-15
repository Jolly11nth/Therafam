-- =============================================================================
-- THERAFAM MENTAL HEALTH APP - INITIAL DATABASE SCHEMA
-- =============================================================================
-- Migration: 20250111000001_initial_schema
-- Description: Creates all core tables, indexes, and functions for Therafam app
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- CORE USER TABLES
-- =============================================================================

-- Users table (both clients and therapists)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('client', 'therapist')),
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    -- Auth and security
    reset_token VARCHAR(255),
    reset_token_expires_at TIMESTAMP WITH TIME ZONE,
    verification_token VARCHAR(255),
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE
);

-- Email verification tracking
CREATE TABLE email_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    verification_code VARCHAR(10) NOT NULL,
    email VARCHAR(255) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User profiles (clients)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    date_of_birth DATE,
    phone_number VARCHAR(20),
    profile_picture_url TEXT,
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(20),
    bio TEXT,
    -- Mental health specific
    mental_health_goals TEXT[],
    preferred_therapy_types TEXT[],
    triggers TEXT[],
    coping_strategies TEXT[],
    medication_list TEXT[],
    -- Questionnaire responses
    anxiety_level INTEGER CHECK (anxiety_level BETWEEN 1 AND 10),
    depression_level INTEGER CHECK (depression_level BETWEEN 1 AND 10),
    stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 10),
    sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 10),
    -- Preferences
    preferred_session_length INTEGER DEFAULT 60,
    timezone VARCHAR(50) DEFAULT 'UTC',
    language_preference VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Therapist profiles
CREATE TABLE therapist_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    license_number VARCHAR(50) UNIQUE,
    license_state VARCHAR(50),
    license_expiry_date DATE,
    specializations TEXT[],
    degrees TEXT[],
    certifications TEXT[],
    years_experience INTEGER,
    bio TEXT,
    profile_picture_url TEXT,
    hourly_rate DECIMAL(10,2),
    -- Contact and availability
    phone_number VARCHAR(20),
    office_address TEXT,
    timezone VARCHAR(50) DEFAULT 'UTC',
    languages_spoken TEXT[],
    -- Professional details
    treatment_approaches TEXT[],
    age_groups_served TEXT[],
    insurance_accepted TEXT[],
    -- Platform stats
    rating DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    -- Status and verification
    is_verified BOOLEAN DEFAULT FALSE,
    is_accepting_clients BOOLEAN DEFAULT TRUE,
    verification_documents JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User settings and preferences
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Notification preferences
    email_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    sms_notifications BOOLEAN DEFAULT FALSE,
    appointment_reminders BOOLEAN DEFAULT TRUE,
    ai_chat_notifications BOOLEAN DEFAULT TRUE,
    -- Privacy settings
    profile_visibility VARCHAR(20) DEFAULT 'private' CHECK (profile_visibility IN ('public', 'therapists_only', 'private')),
    data_sharing BOOLEAN DEFAULT FALSE,
    analytics_opt_in BOOLEAN DEFAULT TRUE,
    -- App preferences
    theme VARCHAR(10) DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
    language VARCHAR(10) DEFAULT 'en',
    auto_save_chat BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- THERAPIST-CLIENT RELATIONSHIP TABLES
-- =============================================================================

-- Therapist availability schedules
CREATE TABLE therapist_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(therapist_id, day_of_week, start_time)
);

-- Client-therapist relationships
CREATE TABLE therapist_client_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'paused', 'ended')),
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    -- Relationship metadata
    referral_source VARCHAR(100),
    treatment_goals TEXT[],
    session_frequency VARCHAR(20),
    preferred_session_length INTEGER DEFAULT 60,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(therapist_id, client_id)
);

-- =============================================================================
-- THERAPY SESSIONS AND APPOINTMENTS
-- =============================================================================

-- Therapy sessions/appointments
CREATE TABLE therapy_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_type VARCHAR(20) DEFAULT 'individual' CHECK (session_type IN ('individual', 'group', 'consultation')),
    session_format VARCHAR(20) DEFAULT 'video' CHECK (session_format IN ('video', 'audio', 'in_person', 'chat')),
    -- Scheduling
    scheduled_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    -- Status and details
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),
    session_goals TEXT[],
    pre_session_notes TEXT,
    -- Payment
    hourly_rate DECIMAL(10,2),
    total_cost DECIMAL(10,2),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
    -- Meeting details
    meeting_link TEXT,
    meeting_id VARCHAR(100),
    meeting_password VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session notes and outcomes
CREATE TABLE therapy_session_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES therapy_sessions(id) ON DELETE CASCADE,
    therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Session content
    session_summary TEXT NOT NULL,
    client_mood VARCHAR(50),
    topics_discussed TEXT[],
    interventions_used TEXT[],
    homework_assigned TEXT,
    client_progress_notes TEXT,
    -- Clinical assessments
    risk_assessment VARCHAR(20) CHECK (risk_assessment IN ('low', 'medium', 'high', 'crisis')),
    treatment_plan_updates TEXT,
    medication_notes TEXT,
    -- Next session planning
    next_session_goals TEXT[],
    follow_up_actions TEXT[],
    -- Metadata
    is_private BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Legacy therapy notes
CREATE TABLE therapy_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- CHAT AND MESSAGING SYSTEM
-- =============================================================================

-- Chat messages (both AI and human therapist conversations)
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_type VARCHAR(20) NOT NULL CHECK (conversation_type IN ('ai_chat', 'therapist_chat', 'group_chat')),
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    recipient_id UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Message content
    message_text TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'audio', 'video', 'system')),
    attachment_url TEXT,
    attachment_metadata JSONB,
    -- AI specific fields
    detected_emotions TEXT[],
    sentiment_score DECIMAL(3,2),
    is_crisis_message BOOLEAN DEFAULT FALSE,
    ai_response_type VARCHAR(30),
    -- Status and metadata
    is_read BOOLEAN DEFAULT FALSE,
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    parent_message_id UUID REFERENCES chat_messages(id),
    session_id UUID REFERENCES therapy_sessions(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI conversation tracking
CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_title VARCHAR(200),
    -- Conversation metadata
    total_messages INTEGER DEFAULT 0,
    last_message_at TIMESTAMP WITH TIME ZONE,
    conversation_summary TEXT,
    dominant_emotions TEXT[],
    crisis_episodes INTEGER DEFAULT 0,
    therapist_referral_suggested BOOLEAN DEFAULT FALSE,
    -- Privacy and status
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- CRISIS LOGS (AI SAFETY + COMPLIANCE)
-- =============================================================================

CREATE TABLE crisis_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    input_text TEXT,
    detected_keywords TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- AI INTERACTION AUDIT LOG
-- =============================================================================

CREATE TABLE ai_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    input_text TEXT,
    response_text TEXT,
    emotions TEXT[],
    escalation_level INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- AI AND VECTOR SEARCH
-- =============================================================================

-- Documents table with UUID ID for vector search
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(1536) NOT NULL,
    -- Additional fields for therapy context
    document_type VARCHAR(50),
    category VARCHAR(50),
    tags TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for fast similarity search
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =============================================================================
-- MOOD TRACKING SYSTEM
-- =============================================================================

-- Daily mood entries
CREATE TABLE mood_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Core mood data
    mood_value INTEGER NOT NULL CHECK (mood_value BETWEEN 1 AND 5),
    mood_label VARCHAR(20) NOT NULL,
    energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 10),
    anxiety_level INTEGER CHECK (anxiety_level BETWEEN 1 AND 10),
    stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 10),
    sleep_hours DECIMAL(3,1),
    sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 10),
    -- Additional context
    notes TEXT,
    activities TEXT[],
    triggers TEXT[],
    medications_taken TEXT[],
    symptoms TEXT[],
    gratitude_entries TEXT[],
    -- Environmental factors
    weather VARCHAR(20),
    social_interactions INTEGER,
    exercise_minutes INTEGER,
    -- Metadata
    entry_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, entry_date)
);

-- =============================================================================
-- SELF-HELP PROGRAMS AND LESSONS
-- =============================================================================

-- Self-help programs
CREATE TABLE self_help_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    difficulty_level VARCHAR(20) DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    estimated_duration_days INTEGER,
    -- Content
    thumbnail_url TEXT,
    tags TEXT[],
    learning_objectives TEXT[],
    prerequisites TEXT[],
    -- Program metadata
    is_published BOOLEAN DEFAULT TRUE,
    total_lessons INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    total_enrollments INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Individual lessons within programs
CREATE TABLE lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES self_help_programs(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    lesson_number INTEGER NOT NULL,
    -- Content
    content_type VARCHAR(20) DEFAULT 'text' CHECK (content_type IN ('text', 'video', 'audio', 'interactive', 'quiz')),
    content_text TEXT,
    content_url TEXT,
    content_metadata JSONB,
    -- Lesson structure
    duration_minutes INTEGER,
    learning_objectives TEXT[],
    key_concepts TEXT[],
    exercises TEXT[],
    reflection_questions TEXT[],
    -- Metadata
    is_published BOOLEAN DEFAULT TRUE,
    prerequisite_lesson_id UUID REFERENCES lessons(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(program_id, lesson_number)
);

-- User progress tracking for programs and lessons
CREATE TABLE lesson_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES self_help_programs(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    -- Progress tracking
    status VARCHAR(20) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'skipped')),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
    time_spent_minutes INTEGER DEFAULT 0,
    -- Lesson specific
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    quiz_score INTEGER,
    user_notes TEXT,
    reflection_responses JSONB,
    -- Program level
    program_started_at TIMESTAMP WITH TIME ZONE,
    program_completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, lesson_id)
);

-- =============================================================================
-- NOTIFICATIONS SYSTEM
-- =============================================================================

-- User notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Notification content
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(30) NOT NULL CHECK (notification_type IN (
        'appointment_reminder', 'session_cancelled', 'new_message', 'mood_reminder',
        'program_milestone', 'therapist_match', 'crisis_follow_up', 'system_update',
        'payment_due', 'lesson_available', 'ai_insight', 'emergency_contact'
    )),
    -- Delivery and status
    delivery_method VARCHAR(20)[] DEFAULT ARRAY['in_app'],
    is_read BOOLEAN DEFAULT FALSE,
    is_delivered BOOLEAN DEFAULT FALSE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    -- Scheduling
    scheduled_for TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    -- Metadata and actions
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    action_url TEXT,
    action_text VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- REVENUE AND BILLING
-- =============================================================================

-- Revenue and payment transactions
CREATE TABLE revenue_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES therapy_sessions(id),
    -- Transaction details
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
        'session_payment', 'subscription_fee', 'cancellation_fee', 'refund', 'bonus', 'platform_fee'
    )),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    -- Platform fees
    platform_fee_amount DECIMAL(10,2) DEFAULT 0.00,
    therapist_payout_amount DECIMAL(10,2),
    -- Payment processing
    payment_method VARCHAR(20),
    payment_processor VARCHAR(30),
    external_transaction_id VARCHAR(100),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN (
        'pending', 'processing', 'completed', 'failed', 'refunded', 'disputed'
    )),
    -- Dates
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    settled_at TIMESTAMP WITH TIME ZONE,
    -- Metadata
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- THERAPIST HANDOFF STATE
-- =============================================================================

CREATE TABLE therapist_handoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (
        status IN ('suggested', 'requested', 'connected', 'declined')
    ),
    escalation_level INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- User and authentication indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_type ON users(user_type);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_email_verifications_user_id ON email_verifications(user_id);
CREATE INDEX idx_email_verifications_code ON email_verifications(verification_code);

-- Profile indexes
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_therapist_profiles_user_id ON therapist_profiles(user_id);
CREATE INDEX idx_therapist_profiles_verified ON therapist_profiles(is_verified);
CREATE INDEX idx_therapist_profiles_accepting ON therapist_profiles(is_accepting_clients);

-- Session and relationship indexes
CREATE INDEX idx_therapy_sessions_therapist_id ON therapy_sessions(therapist_id);
CREATE INDEX idx_therapy_sessions_client_id ON therapy_sessions(client_id);
CREATE INDEX idx_therapy_sessions_scheduled_start ON therapy_sessions(scheduled_start_time);
CREATE INDEX idx_therapy_sessions_status ON therapy_sessions(status);
CREATE INDEX idx_therapist_client_relationships_therapist ON therapist_client_relationships(therapist_id);
CREATE INDEX idx_therapist_client_relationships_client ON therapist_client_relationships(client_id);

-- Chat and messaging indexes
CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_recipient ON chat_messages(recipient_id);
CREATE INDEX idx_chat_messages_conversation_type ON chat_messages(conversation_type);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX idx_chat_messages_crisis ON chat_messages(is_crisis_message) WHERE is_crisis_message = true;

-- Mood tracking indexes
CREATE INDEX idx_mood_entries_user_id ON mood_entries(user_id);
CREATE INDEX idx_mood_entries_date ON mood_entries(entry_date);
CREATE INDEX idx_mood_entries_user_date ON mood_entries(user_id, entry_date);

-- Program and lesson indexes
CREATE INDEX idx_lessons_program_id ON lessons(program_id);
CREATE INDEX idx_lesson_progress_user_id ON lesson_progress(user_id);
CREATE INDEX idx_lesson_progress_program_id ON lesson_progress(program_id);
CREATE INDEX idx_lesson_progress_lesson_id ON lesson_progress(lesson_id);

-- Notification indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(notification_type);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_for) WHERE scheduled_for IS NOT NULL;

-- Revenue indexes
CREATE INDEX idx_revenue_transactions_therapist ON revenue_transactions(therapist_id);
CREATE INDEX idx_revenue_transactions_client ON revenue_transactions(client_id);
CREATE INDEX idx_revenue_transactions_date ON revenue_transactions(transaction_date);
CREATE INDEX idx_revenue_transactions_status ON revenue_transactions(payment_status);

-- Crisis and AI indexes
CREATE INDEX idx_crisis_logs_user_id ON crisis_logs(user_id);
CREATE INDEX idx_crisis_logs_created_at ON crisis_logs(created_at);
CREATE INDEX idx_ai_interactions_user_id ON ai_interactions(user_id);
CREATE INDEX idx_ai_interactions_created_at ON ai_interactions(created_at);
CREATE INDEX idx_therapist_handoffs_user_id ON therapist_handoffs(user_id);

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Similarity function for AI document matching
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(1536),
    match_count int DEFAULT 5
) RETURNS TABLE(
    id uuid,
    content text,
    metadata jsonb,
    similarity float
) LANGUAGE sql STABLE AS $$
    SELECT id, content, metadata,
           1 - (embedding <=> query_embedding) as similarity
    FROM documents
    WHERE is_active = true
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
$$;

-- Function to get user mood trend
CREATE OR REPLACE FUNCTION get_user_mood_trend(
    p_user_id uuid,
    days_back int DEFAULT 30
) RETURNS TABLE(
    date date,
    mood_value integer,
    anxiety_level integer,
    energy_level integer
) LANGUAGE sql STABLE AS $$
    SELECT entry_date, mood_value, anxiety_level, energy_level
    FROM mood_entries
    WHERE user_id = p_user_id
      AND entry_date >= CURRENT_DATE - INTERVAL '1 day' * days_back
    ORDER BY entry_date DESC;
$$;

-- Function to get therapist statistics
CREATE OR REPLACE FUNCTION get_therapist_stats(
    p_therapist_id uuid
) RETURNS TABLE(
    total_clients bigint,
    active_clients bigint,
    total_sessions bigint,
    completed_sessions bigint,
    total_revenue numeric
) LANGUAGE sql STABLE AS $$
    SELECT
        COUNT(DISTINCT tcr.client_id) as total_clients,
        COUNT(DISTINCT CASE WHEN tcr.status = 'active' THEN tcr.client_id END) as active_clients,
        COUNT(ts.id) as total_sessions,
        COUNT(CASE WHEN ts.status = 'completed' THEN ts.id END) as completed_sessions,
        COALESCE(SUM(CASE WHEN rt.payment_status = 'completed' THEN rt.therapist_payout_amount END), 0) as total_revenue
    FROM therapist_client_relationships tcr
    LEFT JOIN therapy_sessions ts ON ts.therapist_id = tcr.therapist_id AND ts.client_id = tcr.client_id
    LEFT JOIN revenue_transactions rt ON rt.therapist_id = tcr.therapist_id
    WHERE tcr.therapist_id = p_therapist_id
    GROUP BY tcr.therapist_id;
$$;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_therapist_profiles_updated_at BEFORE UPDATE ON therapist_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_therapy_sessions_updated_at BEFORE UPDATE ON therapy_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mood_entries_updated_at BEFORE UPDATE ON mood_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_therapist_handoffs_updated_at BEFORE UPDATE ON therapist_handoffs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
