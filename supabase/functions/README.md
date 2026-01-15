Therafam Edge Functions
This directory contains Supabase Edge Functions (Deno-based serverless functions) for the Therafam mental health app.

Current Functions
server
Main API server implementing all backend routes for the Therafam application.

Location: /backend/supabase/functions/server/

Features:

Authentication (signup, login, email verification, password reset)
User profile management
Therapist-specific routes (clients, sessions, revenue)
Messaging system (AI chat and therapist chat)
Mood tracking
Self-help programs and lessons
Notifications
AI integration with crisis detection
KV store for data persistence
Files:

index.tsx - Main Hono server with all API routes
kv_store.tsx - Key-value store operations using Supabase KV
Deploying Edge Functions
Prerequisites
Install Supabase CLI:

npm install -g supabase
Login to Supabase:

supabase login
Link to your project:

supabase link --project-ref your-project-ref
Deploy a Single Function
supabase functions deploy server --project-ref your-project-ref
Deploy All Functions
supabase functions deploy --project-ref your-project-ref
Set Environment Variables
supabase secrets set OPENAI_API_KEY=your_openai_key
supabase secrets set RESEND_API_KEY=your_resend_key
Local Development
Run Functions Locally
cd backend/supabase
supabase start
supabase functions serve
The server function will be available at: http://localhost:54321/functions/v1/server

Test with curl
# Health check
curl http://localhost:54321/functions/v1/server/make-server-a3c0b8e9/health

# Signup
curl -X POST http://localhost:54321/functions/v1/server/make-server-a3c0b8e9/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","userType":"client"}'
Creating New Functions
cd backend/supabase
supabase functions new function-name
This creates a new function at /backend/supabase/functions/function-name/index.ts

Function Structure
Each Edge Function should follow this structure:

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    // Your function logic here
    
    return new Response(
      JSON.stringify({ data: "response" }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
Environment Variables
Edge Functions have access to these environment variables:

SUPABASE_URL - Your Supabase project URL
SUPABASE_ANON_KEY - Public anonymous key
SUPABASE_SERVICE_ROLE_KEY - Service role key (admin access)
Additional secrets can be set using:

supabase secrets set SECRET_NAME=value
API Routes (server function)
Authentication
POST /make-server-a3c0b8e9/auth/signup - Register new user
POST /make-server-a3c0b8e9/auth/login - User login
POST /make-server-a3c0b8e9/auth/verify-email - Verify email with code
POST /make-server-a3c0b8e9/auth/resend-verification - Resend verification email
POST /make-server-a3c0b8e9/auth/reset-password - Request password reset
POST /make-server-a3c0b8e9/auth/update-password - Update password with token
User Profile
GET /make-server-a3c0b8e9/profile/:userId - Get user profile
PUT /make-server-a3c0b8e9/profile/:userId - Update user profile
GET /make-server-a3c0b8e9/settings/:userId - Get user settings
PUT /make-server-a3c0b8e9/settings/:userId - Update user settings
Therapist Routes
GET /make-server-a3c0b8e9/therapist/clients/:therapistId - Get all clients
GET /make-server-a3c0b8e9/therapist/sessions/:therapistId - Get therapist sessions
GET /make-server-a3c0b8e9/therapist/revenue/:therapistId - Get revenue data
Messaging
GET /make-server-a3c0b8e9/messages/:userId - Get all messages
POST /make-server-a3c0b8e9/messages - Send message
PUT /make-server-a3c0b8e9/messages/:messageId/read - Mark as read
GET /make-server-a3c0b8e9/conversations/:userId - Get conversations
DELETE /make-server-a3c0b8e9/messages/:messageId - Delete message
Mood Tracking
POST /make-server-a3c0b8e9/mood - Log mood entry
GET /make-server-a3c0b8e9/mood/:userId - Get mood history
Programs & Lessons
GET /make-server-a3c0b8e9/programs - Get all programs
GET /make-server-a3c0b8e9/programs/:programId/lessons - Get program lessons
POST /make-server-a3c0b8e9/progress - Update lesson progress
GET /make-server-a3c0b8e9/progress/:userId - Get user progress
Notifications
GET /make-server-a3c0b8e9/notifications/:userId - Get notifications
POST /make-server-a3c0b8e9/notifications - Create notification
PUT /make-server-a3c0b8e9/notifications/:notificationId/read - Mark as read
AI Chat
POST /make-server-a3c0b8e9/ai/chat - Send message to AI therapist
GET /make-server-a3c0b8e9/ai/conversations/:userId - Get AI conversations
Logs and Monitoring
View Logs Locally
supabase functions serve --debug
View Production Logs
supabase functions logs server
Best Practices
Always validate input - Check request body and parameters
Handle errors gracefully - Use try/catch blocks
Use CORS properly - Configure for your frontend domains
Keep functions focused - One function per logical endpoint group
Use environment variables - Never hardcode secrets
Log appropriately - Use console.log for debugging
Test locally first - Use supabase functions serve
CORS Configuration
The server function uses Hono's CORS middleware:

cors({
  origin: "*", // In production, specify your domain
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
})
Performance Tips
Edge Functions run on Deno Deploy (globally distributed)
Cold start time: ~100-200ms
Keep function size small for faster cold starts
Use Supabase client for database operations
Implement caching where appropriate
Troubleshooting
Function not deploying
# Check function logs
supabase functions logs server --tail

# Verify Deno syntax
deno check backend/supabase/functions/server/index.tsx
CORS errors
Ensure CORS middleware is properly configured and the correct origin is allowed.

Authentication issues
Verify that SUPABASE_SERVICE_ROLE_KEY is set correctly in secrets.

Related Documentation
Supabase Edge Functions
Deno Documentation
Hono Framework
