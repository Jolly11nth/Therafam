🌱 Therafam Database Schema
This directory contains the complete database schema and setup scripts for the Therafam mental health application.

📋 Overview
The Therafam database supports all core functionality including:

User Management: Both clients and therapists with comprehensive profiles
AI Chat System: Vector embeddings for intelligent therapeutic responses
Mood Tracking: Daily mood entries with trends and analytics
Therapy Sessions: Scheduling, notes, and session management
Self-Help Programs: Structured learning modules with progress tracking
Notifications: Multi-channel notification system
Revenue Management: Payment tracking and therapist payouts
Security: Authentication, verification, and privacy controls
🗄️ Database Tables
Core User Tables
users - Main user accounts (clients and therapists)
user_profiles - Client profile information and preferences
therapist_profiles - Therapist credentials and professional details
user_settings - Privacy and notification preferences
email_verifications - Email verification tracking
Therapy and Sessions
therapy_sessions - Appointment scheduling and session data
therapy_session_notes - Clinical notes and session outcomes
therapist_client_relationships - Client-therapist pairings
therapist_availability - Therapist schedule management
Communication
chat_messages - AI and therapist chat conversations
ai_conversations - AI conversation metadata and summaries
documents - Vector embeddings for AI knowledge base
Mental Health Tracking
mood_entries - Daily mood tracking with multiple metrics
self_help_programs - Educational programs and courses
lessons - Individual lessons within programs
lesson_progress - User progress through educational content
System
notifications - In-app, email, and SMS notifications
revenue_transactions - Payment processing and therapist payouts
🚀 Quick Setup
Prerequisites
PostgreSQL 14+ with the following extensions:

# Install pgvector for AI embeddings
sudo apt-get install postgresql-14-pgvector

# Or build from source
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make && sudo make install
Node.js 16+ for setup scripts

Step 1: Environment Configuration
Copy the environment template:

cp database/.env.example .env
Edit .env with your database credentials:

DB_HOST=localhost
DB_PORT=5432
DB_NAME=therafam_db
DB_USER=therafam_app
DB_PASSWORD=your_secure_password
Step 2: Database Setup
Install dependencies:

npm install pg dotenv
Run the setup script:

# Development environment
node database/setup_database.js development

# Production environment
node database/setup_database.js production

# Test environment
node database/setup_database.js test
Step 3: Verify Installation
The setup script will:

✅ Create the database if it doesn't exist
✅ Install required PostgreSQL extensions
✅ Create all tables, indexes, and functions
✅ Insert sample data for development
✅ Verify the installation
🔧 Manual Setup
If you prefer to set up manually:

Create Database:

CREATE DATABASE therafam_db;
CREATE USER therafam_app WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE therafam_db TO therafam_app;
Run Schema:

psql -U therafam_app -d therafam_db -f database/therafam_schema.sql
📊 Database Features
AI and Vector Search
pgvector extension for similarity search
1536-dimensional embeddings (OpenAI compatible)
Optimized indexes for fast vector operations
Match functions for finding relevant therapeutic content
Performance Optimizations
Strategic indexes on frequently queried columns
Composite indexes for complex queries
JSONB columns for flexible metadata storage
Database functions for common operations
Security Features
Row-level security policies (ready to enable)
Password hashing with bcrypt
JWT token management
Email verification workflows
Rate limiting support structures
Data Integrity
Foreign key constraints maintaining referential integrity
Check constraints for data validation
Unique constraints preventing duplicates
Trigger functions for automatic timestamps
🔍 Common Queries
User Authentication
-- Find user by email
SELECT * FROM users WHERE email = 'user@example.com';

-- Get user with profile
SELECT u.*, up.first_name, up.last_name 
FROM users u 
JOIN user_profiles up ON u.id = up.user_id 
WHERE u.id = $1;
AI Chat History
-- Get recent chat messages
SELECT * FROM chat_messages 
WHERE sender_id = $1 OR recipient_id = $1 
ORDER BY created_at DESC 
LIMIT 50;

-- Find crisis messages
SELECT * FROM chat_messages 
WHERE is_crisis_message = true 
AND created_at >= NOW() - INTERVAL '24 hours';
Mood Tracking
-- Get user mood trend
SELECT entry_date, mood_value, anxiety_level, energy_level
FROM mood_entries 
WHERE user_id = $1 
AND entry_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY entry_date;
Therapist Analytics
-- Get therapist dashboard stats
SELECT * FROM therapist_dashboard_view 
WHERE therapist_id = $1;
🛠️ Development Tools
Database Functions
match_documents(embedding, count) - AI similarity search
get_user_mood_trend(user_id, days) - Mood analytics
get_therapist_stats(therapist_id) - Therapist metrics
Database Views
therapist_dashboard_view - Therapist performance metrics
client_mood_trends - Aggregated mood data
Utility Scripts
setup_database.js - Complete database setup
database_config.ts - TypeScript configuration
.env.example - Environment template
🔒 Security Considerations
Production Deployment
Enable SSL/TLS for all database connections
Use strong passwords and rotate them regularly
Enable Row Level Security for multi-tenant isolation
Set up database backups and disaster recovery
Monitor database performance and query patterns
Use connection pooling for better performance
Implement proper logging and audit trails
Environment Variables
# Production settings
NODE_ENV=production
DB_SSL=true
DB_POOL_MAX=50
DB_POOL_IDLE_TIMEOUT=30000
📈 Scaling Considerations
Read Replicas
For high-traffic scenarios, consider:

Read replicas for analytics queries
Connection pooling (PgBouncer)
Query optimization and indexing
Caching layer (Redis) for frequently accessed data
Monitoring
Set up monitoring for:

Connection counts and pool utilization
Query performance and slow queries
Database size and growth trends
Index usage and effectiveness
🆘 Troubleshooting
Common Issues
pgvector extension not found:

# Install pgvector
sudo apt-get install postgresql-14-pgvector
Permission denied:

-- Grant proper permissions
GRANT ALL PRIVILEGES ON DATABASE therafam_db TO therafam_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO therafam_app;
Connection refused:

Check PostgreSQL is running: sudo systemctl status postgresql
Verify pg_hba.conf allows connections
Check firewall settings
Out of memory during setup:

Increase PostgreSQL work_mem setting
Run setup in smaller batches
Check available disk space
Getting Help
Check the PostgreSQL documentation
Review pgvector installation guide
Consult the Therafam development team
📝 Schema Changes
When modifying the schema:

Create migration scripts for existing data
Test in development environment first
Backup production data before applying changes
Use transactions for atomic updates
Update TypeScript interfaces in database_config.ts
🎯 Next Steps
After database setup:

Configure your application to use the database
Set up authentication middleware
Implement API endpoints using the provided queries
Add data validation layers
Set up monitoring and logging
Plan backup and recovery procedures
💙 Happy coding with Therafam! 🌱

For questions or support, please refer to the main project documentation or contact the development team.
