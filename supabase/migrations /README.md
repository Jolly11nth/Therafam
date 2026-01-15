Therafam Database Migrations
This directory contains all database migrations for the Therafam mental health app.

Migration Files
20250111000001_initial_schema.sql
Creates all core database tables
Sets up indexes for performance optimization
Configures PostgreSQL extensions (uuid-ossp, pgcrypto, vector)
Implements database functions for AI vector search and analytics
Adds triggers for automatic timestamp updates
20250111000002_seed_data.sql
Populates development database with sample data
Creates 3 self-help programs with lessons
Adds sample documents for RAG (Retrieval-Augmented Generation)
Provides realistic test data for development
Running Migrations
Using Supabase CLI
Link to your project:

cd backend/supabase
supabase link --project-ref your-project-ref
Run all migrations:

supabase db push
Reset database (development only):

supabase db reset
Using SQL Editor (Supabase Dashboard)
Go to your Supabase project dashboard
Navigate to SQL Editor
Copy and paste the migration files in order
Run each migration
Creating New Migrations
cd backend/supabase
supabase migration new migration_name
This creates a new migration file with timestamp prefix.

Migration Naming Convention
Format: YYYYMMDDHHMMSS_description.sql

Example: 20250111000001_initial_schema.sql

Important Notes
Always run migrations in order (sorted by timestamp)
Never modify existing migrations - create new ones instead
Test migrations locally first using supabase db reset
Backup production data before running migrations on production
The seed data migration (002) is for development only - don't run in production
Database Extensions Required
uuid-ossp - UUID generation
pgcrypto - Cryptographic functions
vector - AI embeddings and vector search (for RAG functionality)
Environment Setup
Ensure these environment variables are set:

SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
Related Documentation
Supabase CLI Documentation
PostgreSQL Migrations Guide
Vector Extension (pgvector)
