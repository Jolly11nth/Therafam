-- =============================================================================
-- THERAFAM MENTAL HEALTH APP - COMPLETE DATABASE SCHEMA
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- CLEANUP (for development - remove in production)
-- =============================================================================

-- Drop functions first
DROP FUNCTION IF EXISTS match_documents(vector, int);
DROP FUNCTION IF EXISTS get_user_mood_trend(uuid, int);
DROP FUNCTION IF EXISTS get_therapist_stats(uuid);

-- Drop tables in correct order (reverse of creation due to foreign keys)
DROP TABLE IF EXISTS ai_conversations CASCADE;
DROP TABLE IF EXISTS therapy_session_notes CASCADE;
DROP TABLE IF EXISTS therapy_sessions CASCADE;
DROP TABLE IF EXISTS mood_entries CASCADE;
DROP TABLE IF EXISTS lesson_progress CASCADE;
DROP TABLE IF EXISTS lessons CASCADE;
DROP TABLE IF EXISTS self_help_programs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS therapist_client_relationships CASCADE;
DROP TABLE IF EXISTS therapist_availability CASCADE;
DROP TABLE IF EXISTS revenue_transactions CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS therapist_profiles CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS email_verifications CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS therapy_notes CASCADE;
DROP TABLE IF EXISTS documents CASCADE;

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
    preferred_session_length INTEGER DEFAULT 60, -- minutes
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
    age_groups_served TEXT[], -- ['children', 'teens', 'adults', 'seniors']
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
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday
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
    session_frequency VARCHAR(20), -- 'weekly', 'biweekly', 'monthly'
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

-- Legacy therapy notes (from your original schema)
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
    sentiment_score DECIMAL(3,2), -- -1.0 to 1.0
    is_crisis_message BOOLEAN DEFAULT FALSE,
    ai_response_type VARCHAR(30), -- 'therapeutic_support', 'crisis_intervention', 'general_support'
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
-- AI AND VECTOR SEARCH (from your original schema)
-- =============================================================================

-- Documents table with UUID ID for vector search
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(1536) NOT NULL,
    -- Additional fields for therapy context
    document_type VARCHAR(50), -- 'therapy_technique', 'crisis_resource', 'educational_content'
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
    mood_value INTEGER NOT NULL CHECK (mood_value BETWEEN 1 AND 5), -- 1=very low, 5=very high
    mood_label VARCHAR(20) NOT NULL, -- 'happy', 'sad', 'anxious', etc.
    energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 10),
    anxiety_level INTEGER CHECK (anxiety_level BETWEEN 1 AND 10),
    stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 10),
    sleep_hours DECIMAL(3,1),
    sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 10),
    -- Additional context
    notes TEXT,
    activities TEXT[], -- what the user did that day
    triggers TEXT[], -- what may have affected their mood
    medications_taken TEXT[],
    symptoms TEXT[],
    gratitude_entries TEXT[],
    -- Environmental factors
    weather VARCHAR(20),
    social_interactions INTEGER, -- 1-10 scale
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
    category VARCHAR(50) NOT NULL, -- 'anxiety', 'depression', 'stress', 'relationships'
    difficulty_level VARCHAR(20) DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    estimated_duration_days INTEGER, -- how many days to complete
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
    quiz_score INTEGER, -- if lesson is a quiz
    user_notes TEXT,
    reflection_responses JSONB, -- answers to reflection questions
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
    delivery_method VARCHAR(20)[] DEFAULT ARRAY['in_app'], -- 'in_app', 'email', 'sms', 'push'
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
    payment_method VARCHAR(20), -- 'credit_card', 'bank_transfer', 'paypal', etc.
    payment_processor VARCHAR(30), -- 'stripe', 'paypal', etc.
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
    this_month_revenue numeric,
    average_rating numeric
) LANGUAGE sql STABLE AS $$
    SELECT 
        COUNT(DISTINCT tcr.client_id) as total_clients,
        COUNT(DISTINCT CASE WHEN tcr.status = 'active' THEN tcr.client_id END) as active_clients,
        COUNT(ts.id) as total_sessions,
        COUNT(CASE WHEN ts.status = 'completed' THEN ts.id END) as completed_sessions,
        COALESCE(SUM(CASE 
            WHEN rt.transaction_date >= DATE_TRUNC('month', CURRENT_DATE) 
            AND rt.payment_status = 'completed'
            THEN rt.therapist_payout_amount 
        END), 0) as this_month_revenue,
        tp.rating as average_rating
    FROM therapist_profiles tp
    LEFT JOIN therapist_client_relationships tcr ON tcr.therapist_id = p_therapist_id
    LEFT JOIN therapy_sessions ts ON ts.therapist_id = p_therapist_id
    LEFT JOIN revenue_transactions rt ON rt.therapist_id = p_therapist_id
    WHERE tp.user_id = p_therapist_id
    GROUP BY tp.rating;
$$;

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
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

CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mood_entries_updated_at BEFORE UPDATE ON mood_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SAMPLE DATA (for development and testing)
-- =============================================================================

-- Insert sample client user
INSERT INTO users (id, email, password_hash, user_type, is_verified) VALUES 
('11111111-1111-1111-1111-111111111111', 'client@therafam.com', '$2b$12$sample_hash', 'client', true);

-- Insert sample therapist user
INSERT INTO users (id, email, password_hash, user_type, is_verified) VALUES 
('22222222-2222-2222-2222-222222222222', 'therapist@therafam.com', '$2b$12$sample_hash', 'therapist', true);

-- Insert sample client profile
INSERT INTO user_profiles (user_id, first_name, last_name, anxiety_level, depression_level) VALUES 
('11111111-1111-1111-1111-111111111111', 'Demo', 'Client', 6, 4);

-- Insert sample therapist profile
INSERT INTO therapist_profiles (user_id, first_name, last_name, license_number, specializations, hourly_rate, is_verified) VALUES 
('22222222-2222-2222-2222-222222222222', 'Dr. Sarah', 'Johnson', 'LIC123456', ARRAY['anxiety', 'depression', 'trauma'], 150.00, true);

-- Insert sample self-help programs
INSERT INTO self_help_programs (id, title, description, category, total_lessons) VALUES 
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Anxiety Management Basics', 'Learn fundamental techniques for managing anxiety in daily life', 'anxiety', 7),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Mindfulness for Beginners', 'Introduction to mindfulness and meditation practices', 'stress', 5);

-- Insert sample lessons
INSERT INTO lessons (program_id, title, lesson_number, content_text, duration_minutes) VALUES 
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Understanding Anxiety', 1, 'Learn what anxiety is and how it affects your body and mind...', 15),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Breathing Techniques', 2, 'Practice deep breathing exercises to calm your nervous system...', 20);

-- =============================================================================
-- SECURITY AND PERMISSIONS
-- =============================================================================

-- Row Level Security policies would go here in a production environment
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY user_own_data ON users FOR ALL USING (id = current_user_id());

-- Grant permissions for application user
-- GRANT USAGE ON SCHEMA public TO therafam_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO therafam_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO therafam_app;

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- View for therapist dashboard stats
CREATE VIEW therapist_dashboard_view AS
SELECT 
    tp.user_id as therapist_id,
    tp.first_name,
    tp.last_name,
    tp.rating,
    COUNT(DISTINCT tcr.client_id) as total_clients,
    COUNT(DISTINCT CASE WHEN tcr.status = 'active' THEN tcr.client_id END) as active_clients,
    COUNT(DISTINCT ts.id) as total_sessions,
    COUNT(DISTINCT CASE WHEN ts.status = 'completed' THEN ts.id END) as completed_sessions,
    COALESCE(SUM(CASE 
        WHEN rt.transaction_date >= DATE_TRUNC('month', CURRENT_DATE) 
        AND rt.payment_status = 'completed'
        THEN rt.therapist_payout_amount 
    END), 0) as monthly_revenue
FROM therapist_profiles tp
LEFT JOIN therapist_client_relationships tcr ON tcr.therapist_id = tp.user_id
LEFT JOIN therapy_sessions ts ON ts.therapist_id = tp.user_id
LEFT JOIN revenue_transactions rt ON rt.therapist_id = tp.user_id
GROUP BY tp.user_id, tp.first_name, tp.last_name, tp.rating;

-- View for client mood trends
CREATE VIEW client_mood_trends AS
SELECT 
    user_id,
    DATE_TRUNC('week', entry_date) as week_start,
    AVG(mood_value) as avg_mood,
    AVG(anxiety_level) as avg_anxiety,
    AVG(energy_level) as avg_energy,
    COUNT(*) as entries_count
FROM mood_entries
GROUP BY user_id, DATE_TRUNC('week', entry_date)
ORDER BY user_id, week_start;

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '🌱 Therafam Database Schema Created Successfully! 🌱';
    RAISE NOTICE 'Tables: % created', (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public');
    RAISE NOTICE 'Indexes: % created', (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public');
    RAISE NOTICE 'Functions: % created', (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public');
    RAISE NOTICE '💙 Ready for Therafam mental health app! 💙';
END $$;
