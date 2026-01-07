// =============================================================================
// THERAFAM DATABASE CONFIGURATION
// =============================================================================

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  schema?: string;
}

// Helper function to safely access environment variables
const getEnvVar = (key: string, defaultValue: string = ''): string => {
  // Check if we're in a Node.js environment (setup scripts)
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || defaultValue;
  }
  
  // Check if we're in a Vite environment (browser with build-time variables)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return (import.meta.env as any)[`VITE_${key}`] || defaultValue;
  }
  
  // Fallback for browser environment
  return defaultValue;
};

// Database connection configuration
export const databaseConfig: DatabaseConfig = {
  host: getEnvVar('DB_HOST', 'localhost'),
  port: parseInt(getEnvVar('DB_PORT', '5432')),
  database: getEnvVar('DB_NAME', 'therafam_db'),
  username: getEnvVar('DB_USER', 'therafam_app'),
  password: getEnvVar('DB_PASSWORD', 'your_secure_password'),
  ssl: getEnvVar('NODE_ENV', 'development') === 'production',
  schema: 'public'
};

// Database table names (for type safety)
export const TABLES = {
  USERS: 'users',
  USER_PROFILES: 'user_profiles',
  THERAPIST_PROFILES: 'therapist_profiles',
  USER_SETTINGS: 'user_settings',
  EMAIL_VERIFICATIONS: 'email_verifications',
  THERAPIST_AVAILABILITY: 'therapist_availability',
  THERAPIST_CLIENT_RELATIONSHIPS: 'therapist_client_relationships',
  THERAPY_SESSIONS: 'therapy_sessions',
  THERAPY_SESSION_NOTES: 'therapy_session_notes',
  THERAPY_NOTES: 'therapy_notes',
  CHAT_MESSAGES: 'chat_messages',
  AI_CONVERSATIONS: 'ai_conversations',
  DOCUMENTS: 'documents',
  MOOD_ENTRIES: 'mood_entries',
  SELF_HELP_PROGRAMS: 'self_help_programs',
  LESSONS: 'lessons',
  LESSON_PROGRESS: 'lesson_progress',
  NOTIFICATIONS: 'notifications',
  REVENUE_TRANSACTIONS: 'revenue_transactions'
} as const;

// TypeScript interfaces for database entities

export interface User {
  id: string;
  email: string;
  password_hash: string;
  user_type: 'client' | 'therapist';
  is_verified: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  last_login_at?: Date;
  reset_token?: string;
  reset_token_expires_at?: Date;
  verification_token?: string;
  login_attempts: number;
  locked_until?: Date;
}

export interface UserProfile {
  id: string;
  user_id: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: Date;
  phone_number?: string;
  profile_picture_url?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  bio?: string;
  mental_health_goals?: string[];
  preferred_therapy_types?: string[];
  triggers?: string[];
  coping_strategies?: string[];
  medication_list?: string[];
  anxiety_level?: number;
  depression_level?: number;
  stress_level?: number;
  sleep_quality?: number;
  preferred_session_length: number;
  timezone: string;
  language_preference: string;
  created_at: Date;
  updated_at: Date;
}

export interface TherapistProfile {
  id: string;
  user_id: string;
  first_name?: string;
  last_name?: string;
  license_number?: string;
  license_state?: string;
  license_expiry_date?: Date;
  specializations?: string[];
  degrees?: string[];
  certifications?: string[];
  years_experience?: number;
  bio?: string;
  profile_picture_url?: string;
  hourly_rate?: number;
  phone_number?: string;
  office_address?: string;
  timezone: string;
  languages_spoken?: string[];
  treatment_approaches?: string[];
  age_groups_served?: string[];
  insurance_accepted?: string[];
  rating: number;
  total_reviews: number;
  total_sessions: number;
  is_verified: boolean;
  is_accepting_clients: boolean;
  verification_documents?: any;
  created_at: Date;
  updated_at: Date;
}

export interface TherapySession {
  id: string;
  therapist_id: string;
  client_id: string;
  session_type: 'individual' | 'group' | 'consultation';
  session_format: 'video' | 'audio' | 'in_person' | 'chat';
  scheduled_start_time: Date;
  scheduled_end_time: Date;
  actual_start_time?: Date;
  actual_end_time?: Date;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  session_goals?: string[];
  pre_session_notes?: string;
  hourly_rate?: number;
  total_cost?: number;
  payment_status: 'pending' | 'paid' | 'refunded';
  meeting_link?: string;
  meeting_id?: string;
  meeting_password?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ChatMessage {
  id: string;
  conversation_type: 'ai_chat' | 'therapist_chat' | 'group_chat';
  sender_id?: string;
  recipient_id?: string;
  message_text: string;
  message_type: 'text' | 'image' | 'file' | 'audio' | 'video' | 'system';
  attachment_url?: string;
  attachment_metadata?: any;
  detected_emotions?: string[];
  sentiment_score?: number;
  is_crisis_message: boolean;
  ai_response_type?: string;
  is_read: boolean;
  is_edited: boolean;
  is_deleted: boolean;
  parent_message_id?: string;
  session_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface MoodEntry {
  id: string;
  user_id: string;
  mood_value: number;
  mood_label: string;
  energy_level?: number;
  anxiety_level?: number;
  stress_level?: number;
  sleep_hours?: number;
  sleep_quality?: number;
  notes?: string;
  activities?: string[];
  triggers?: string[];
  medications_taken?: string[];
  symptoms?: string[];
  gratitude_entries?: string[];
  weather?: string;
  social_interactions?: number;
  exercise_minutes?: number;
  entry_date: Date;
  created_at: Date;
  updated_at: Date;
}

export interface SelfHelpProgram {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  estimated_duration_days?: number;
  thumbnail_url?: string;
  tags?: string[];
  learning_objectives?: string[];
  prerequisites?: string[];
  is_published: boolean;
  total_lessons: number;
  average_rating: number;
  total_enrollments: number;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Lesson {
  id: string;
  program_id: string;
  title: string;
  description?: string;
  lesson_number: number;
  content_type: 'text' | 'video' | 'audio' | 'interactive' | 'quiz';
  content_text?: string;
  content_url?: string;
  content_metadata?: any;
  duration_minutes?: number;
  learning_objectives?: string[];
  key_concepts?: string[];
  exercises?: string[];
  reflection_questions?: string[];
  is_published: boolean;
  prerequisite_lesson_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface LessonProgress {
  id: string;
  user_id: string;
  program_id: string;
  lesson_id?: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'skipped';
  progress_percentage: number;
  time_spent_minutes: number;
  started_at?: Date;
  completed_at?: Date;
  quiz_score?: number;
  user_notes?: string;
  reflection_responses?: any;
  program_started_at?: Date;
  program_completed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: string;
  delivery_method: string[];
  is_read: boolean;
  is_delivered: boolean;
  delivered_at?: Date;
  scheduled_for?: Date;
  expires_at?: Date;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  action_url?: string;
  action_text?: string;
  metadata?: any;
  created_at: Date;
  updated_at: Date;
}

export interface Document {
  id: string;
  content: string;
  metadata: any;
  embedding: number[]; // vector embedding
  document_type?: string;
  category?: string;
  tags?: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Database query helpers
export const DB_QUERIES = {
  // User queries
  getUserByEmail: `SELECT * FROM ${TABLES.USERS} WHERE email = $1`,
  getUserById: `SELECT * FROM ${TABLES.USERS} WHERE id = $1`,
  createUser: `
    INSERT INTO ${TABLES.USERS} (email, password_hash, user_type) 
    VALUES ($1, $2, $3) RETURNING *
  `,

  // Profile queries
  getUserProfile: `SELECT * FROM ${TABLES.USER_PROFILES} WHERE user_id = $1`,
  getTherapistProfile: `SELECT * FROM ${TABLES.THERAPIST_PROFILES} WHERE user_id = $1`,
  
  // Chat queries
  getChatMessages: `
    SELECT * FROM ${TABLES.CHAT_MESSAGES} 
    WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)
    ORDER BY created_at ASC
  `,
  insertChatMessage: `
    INSERT INTO ${TABLES.CHAT_MESSAGES} 
    (conversation_type, sender_id, recipient_id, message_text, message_type, detected_emotions, is_crisis_message)
    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
  `,

  // Mood queries
  getUserMoodEntries: `
    SELECT * FROM ${TABLES.MOOD_ENTRIES} 
    WHERE user_id = $1 AND entry_date >= $2 
    ORDER BY entry_date DESC
  `,
  insertMoodEntry: `
    INSERT INTO ${TABLES.MOOD_ENTRIES} 
    (user_id, mood_value, mood_label, energy_level, anxiety_level, stress_level, entry_date)
    VALUES ($1, $2, $3, $4, $5, $6, $7) 
    ON CONFLICT (user_id, entry_date) 
    DO UPDATE SET mood_value = $2, mood_label = $3, energy_level = $4, 
                  anxiety_level = $5, stress_level = $6, updated_at = NOW()
    RETURNING *
  `,

  // Program queries
  getSelfHelpPrograms: `SELECT * FROM ${TABLES.SELF_HELP_PROGRAMS} WHERE is_published = true ORDER BY created_at DESC`,
  getProgramLessons: `SELECT * FROM ${TABLES.LESSONS} WHERE program_id = $1 AND is_published = true ORDER BY lesson_number`,
  getUserProgress: `SELECT * FROM ${TABLES.LESSON_PROGRESS} WHERE user_id = $1 AND program_id = $2`,

  // Therapist queries
  getAvailableTherapists: `
    SELECT tp.*, u.email FROM ${TABLES.THERAPIST_PROFILES} tp
    JOIN ${TABLES.USERS} u ON tp.user_id = u.id
    WHERE tp.is_verified = true AND tp.is_accepting_clients = true
    ORDER BY tp.rating DESC, tp.total_reviews DESC
  `,

  // Session queries
  getTherapySessions: `
    SELECT * FROM ${TABLES.THERAPY_SESSIONS} 
    WHERE (therapist_id = $1 OR client_id = $1) AND status != 'cancelled'
    ORDER BY scheduled_start_time DESC
  `,

  // Notification queries
  getUserNotifications: `
    SELECT * FROM ${TABLES.NOTIFICATIONS} 
    WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at DESC LIMIT $2
  `,

  // AI/Vector queries
  searchDocuments: `SELECT * FROM match_documents($1, $2)`,
  insertDocument: `
    INSERT INTO ${TABLES.DOCUMENTS} (content, metadata, embedding, document_type, category, tags)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
  `
} as const;

// Database connection pool configuration
export const poolConfig = {
  max: 20, // Maximum number of connections in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // Return an error after this many milliseconds if a connection cannot be established
};

// Export environment-specific configurations
export const getConfig = (environment: 'development' | 'production' | 'test' = 'development') => {
  const configs = {
    development: {
      ...databaseConfig,
      host: 'localhost',
      database: 'therafam_dev',
      ssl: false
    },
    production: {
      ...databaseConfig,
      ssl: true,
      // Additional production settings
      pool: {
        ...poolConfig,
        max: 50
      }
    },
    test: {
      ...databaseConfig,
      database: 'therafam_test',
      ssl: false
    }
  };

  return configs[environment];
};

export default databaseConfig;
