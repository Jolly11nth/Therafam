"""
Therafam Backend API - Main Entry Point
========================================

This is the main entry point for the Therafam Python backend server.
It provides REST API endpoints for the Therafam AI chatbot and mental health services.

Deployment Instructions:
-----------------------
1. Install dependencies: pip install -r requirements.txt
2. Set environment variables (see .env.example)
3. Run locally: python main.py
4. Deploy to production: gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app

Environment Variables Required:
-------------------------------
- SUPABASE_URL: Your Supabase project URL
- SUPABASE_KEY: Your Supabase service role key
- OPENAI_API_KEY: Your OpenAI API key
- REDIS_HOST: Redis host URL
- REDIS_PORT: Redis port (default: 6379)
- REDIS_PASSWORD: Redis password
- PORT: Server port (default: 8000)
"""

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict
import os
import logging
from datetime import datetime
import uvicorn

# Import Therafam AI core functionality
from run_flow import (
    run_flow, 
    is_crisis, 
    detect_emotional_state,
    should_suggest_therapist,
    generate_crisis_response,
    get_mood_context,
    logger as ai_logger
)

# ============================================================================
# APPLICATION CONFIGURATION
# ============================================================================

# Environment setup
PORT = int(os.getenv("PORT", 8000))
ENV = os.getenv("ENV", "development")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Configure logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('therafam_backend.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('TherafamBackend')

# Initialize FastAPI application
app = FastAPI(
    title="Therafam Backend API",
    description="AI-powered mental health support backend for Therafam application",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# ============================================================================
# MIDDLEWARE CONFIGURATION
# ============================================================================

# CORS Configuration - Allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative dev port
        "https://*.supabase.co",  # Supabase hosted app
        "*"  # Allow all in production (configure based on your domain)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests"""
    start_time = datetime.utcnow()
    
    logger.info(f"📥 {request.method} {request.url.path}")
    
    try:
        response = await call_next(request)
        
        process_time = (datetime.utcnow() - start_time).total_seconds()
        logger.info(f"✅ {request.method} {request.url.path} - {response.status_code} - {process_time:.3f}s")
        
        return response
    except Exception as e:
        logger.error(f"❌ {request.method} {request.url.path} - Error: {str(e)}")
        raise

# ============================================================================
# PYDANTIC MODELS (Request/Response Schemas)
# ============================================================================

class ChatRequest(BaseModel):
    """Request model for AI chat endpoint"""
    message: str = Field(..., min_length=1, max_length=2000, description="User's message to Therafam AI")
    user_id: Optional[str] = Field(None, description="User ID for personalized responses")
    session_id: Optional[str] = Field(None, description="Session ID for conversation tracking")
    
    @validator('message')
    def message_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Message cannot be empty')
        return v.strip()

class ChatResponse(BaseModel):
    """Response model for AI chat endpoint"""
    response: str = Field(..., description="AI-generated response")
    is_crisis: bool = Field(False, description="Whether crisis was detected")
    crisis_keywords: Optional[List[str]] = Field(None, description="Crisis keywords detected")
    detected_emotions: List[str] = Field(default_factory=list, description="Detected emotional states")
    therapist_suggestion: Optional[Dict] = Field(None, description="Therapist connection suggestion")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    version: str
    timestamp: str
    environment: str

class CrisisCheckRequest(BaseModel):
    """Request model for crisis detection endpoint"""
    message: str = Field(..., min_length=1, max_length=2000)

class CrisisCheckResponse(BaseModel):
    """Response model for crisis detection"""
    is_crisis: bool
    crisis_keywords: List[str]
    crisis_resources: Optional[str]

class EmotionDetectionRequest(BaseModel):
    """Request model for emotion detection"""
    message: str = Field(..., min_length=1, max_length=2000)

class EmotionDetectionResponse(BaseModel):
    """Response model for emotion detection"""
    detected_emotions: List[str]
    therapist_suggestion: Dict

# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.get("/", response_model=Dict)
async def root():
    """Root endpoint - API information"""
    return {
        "name": "Therafam Backend API",
        "version": "1.0.0",
        "status": "running",
        "documentation": "/api/docs",
        "endpoints": {
            "health": "/api/health",
            "chat": "/api/chat",
            "crisis_check": "/api/crisis-check",
            "emotion_detection": "/api/emotion-detection"
        }
    }

@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint
    
    Returns server status and basic information
    """
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        timestamp=datetime.utcnow().isoformat(),
        environment=ENV
    )

@app.post("/api/chat", response_model=ChatResponse, status_code=status.HTTP_200_OK)
async def chat_with_ai(request: ChatRequest):
    """
    Main AI chat endpoint
    
    Processes user messages through Therafam AI and returns therapeutic responses.
    Includes crisis detection, emotion analysis, and therapist suggestions.
    
    Parameters:
    - message: User's message (required)
    - user_id: User identifier for personalization (optional)
    - session_id: Session identifier for conversation tracking (optional)
    
    Returns:
    - Therapeutic AI response
    - Crisis detection results
    - Detected emotions
    - Therapist connection suggestions
    """
    try:
        logger.info(f"🤖 Processing chat request from user: {request.user_id or 'anonymous'}")
        
        # Detect crisis situation
        is_crisis_situation, crisis_keywords = is_crisis(request.message)
        
        # Detect emotional states
        emotions = detect_emotional_state(request.message)
        
        # Generate AI response
        ai_response = run_flow(
            user_input=request.message,
            user_id=request.user_id or "anonymous_user"
        )
        
        # Check for therapist suggestion (only if not in crisis)
        therapist_suggestion = None
        if not is_crisis_situation:
            therapist_suggestion = should_suggest_therapist(
                emotions=emotions,
                user_input=request.message,
                interaction_count=0  # You can track this per session
            )
        
        return ChatResponse(
            response=ai_response,
            is_crisis=is_crisis_situation,
            crisis_keywords=crisis_keywords if is_crisis_situation else None,
            detected_emotions=emotions,
            therapist_suggestion=therapist_suggestion if therapist_suggestion and therapist_suggestion.get("suggest") else None,
            timestamp=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        logger.error(f"❌ Error in chat endpoint: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Failed to process chat request",
                "message": "An unexpected error occurred. Please try again.",
                "timestamp": datetime.utcnow().isoformat()
            }
        )

@app.post("/api/crisis-check", response_model=CrisisCheckResponse)
async def check_for_crisis(request: CrisisCheckRequest):
    """
    Crisis detection endpoint
    
    Quickly checks if a message contains crisis indicators without
    generating a full AI response.
    
    Useful for real-time crisis detection as user types.
    """
    try:
        is_crisis_situation, crisis_keywords = is_crisis(request.message)
        
        crisis_resources = None
        if is_crisis_situation:
            crisis_resources = generate_crisis_response(crisis_keywords)
        
        return CrisisCheckResponse(
            is_crisis=is_crisis_situation,
            crisis_keywords=crisis_keywords,
            crisis_resources=crisis_resources
        )
        
    except Exception as e:
        logger.error(f"❌ Error in crisis check: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check for crisis indicators"
        )

@app.post("/api/emotion-detection", response_model=EmotionDetectionResponse)
async def detect_emotions(request: EmotionDetectionRequest):
    """
    Emotion detection endpoint
    
    Analyzes a message and returns detected emotional states and
    whether a therapist connection should be suggested.
    """
    try:
        emotions = detect_emotional_state(request.message)
        therapist_suggestion = should_suggest_therapist(
            emotions=emotions,
            user_input=request.message,
            interaction_count=0
        )
        
        return EmotionDetectionResponse(
            detected_emotions=emotions,
            therapist_suggestion=therapist_suggestion
        )
        
    except Exception as e:
        logger.error(f"❌ Error in emotion detection: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to detect emotions"
        )

@app.get("/api/mood-context/{user_id}")
async def get_user_mood_context(user_id: str):
    """
    Get mood context for a specific user
    
    Retrieves recent mood tracking data for personalized responses.
    """
    try:
        mood_data = get_mood_context(user_id)
        return {
            "user_id": user_id,
            "mood_data": mood_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Error fetching mood context: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch mood context"
        )

# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "timestamp": datetime.utcnow().isoformat(),
            "path": str(request.url)
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions"""
    logger.error(f"❌ Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred",
            "timestamp": datetime.utcnow().isoformat()
        }
    )

# ============================================================================
# STARTUP AND SHUTDOWN EVENTS
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Execute on application startup"""
    logger.info("🚀 Starting Therafam Backend API...")
    logger.info(f"📍 Environment: {ENV}")
    logger.info(f"🔌 Port: {PORT}")
    logger.info("✅ Therafam Backend API started successfully")

@app.on_event("shutdown")
async def shutdown_event():
    """Execute on application shutdown"""
    logger.info("👋 Shutting down Therafam Backend API...")
    logger.info("✅ Shutdown complete")

# ============================================================================
# APPLICATION RUNNER
# ============================================================================

if __name__ == "__main__":
    logger.info("🌱 Therafam Backend - AI-Powered Mental Health Support")
    logger.info("=" * 70)
    
    # Run the application with Uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=PORT,
        reload=ENV == "development",
        log_level=LOG_LEVEL.lower(),
        access_log=True
    )
