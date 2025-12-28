# Therafam Backend API

AI-powered mental health support backend for the Therafam application.

## 🚂 Quick Deploy to Railway

**For Railway deployment, see [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) for detailed instructions.**

Quick steps:
1. Push code to GitHub
2. Create new Railway project from GitHub repo
3. Set root directory to `backend`
4. Add environment variables
5. Deploy!

## 🚀 Quick Start

### Prerequisites

- Python 3.10 or higher
- pip (Python package manager)
- Virtual environment tool (venv or virtualenv)
- Supabase account
- OpenAI API key
- Redis instance (optional for production features)

### Local Development Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create and activate virtual environment**
   ```bash
   # On macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   
   # On Windows
   python -m venv venv
   venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your actual credentials
   ```

5. **Run the development server**
   ```bash
   python main.py
   ```

   The API will be available at: `http://localhost:8000`
   - API Documentation: `http://localhost:8000/api/docs`
   - Alternative Docs: `http://localhost:8000/api/redoc`

## 📡 API Endpoints

### Core Endpoints

#### `POST /api/chat`
Main AI chat endpoint for therapeutic conversations.

**Request:**
```json
{
  "message": "I've been feeling really anxious lately",
  "user_id": "user_123",
  "session_id": "session_456"
}
```

**Response:**
```json
{
  "response": "I hear you, and I want you to know that...",
  "is_crisis": false,
  "crisis_keywords": null,
  "detected_emotions": ["anxiety", "stress"],
  "therapist_suggestion": {
    "suggest": true,
    "urgency": "medium",
    "reason": "multiple_concerns",
    "message": "A therapist could help you develop personalized strategies."
  },
  "timestamp": "2025-12-28T10:30:00.000Z"
}
```

#### `POST /api/crisis-check`
Quick crisis detection without full AI response.

**Request:**
```json
{
  "message": "I'm thinking about ending it all"
}
```

**Response:**
```json
{
  "is_crisis": true,
  "crisis_keywords": ["ending it all", "suicide"],
  "crisis_resources": "🆘 IMMEDIATE SUPPORT NEEDED..."
}
```

#### `POST /api/emotion-detection`
Detect emotional states in user messages.

**Request:**
```json
{
  "message": "I feel so overwhelmed and sad"
}
```

**Response:**
```json
{
  "detected_emotions": ["stress", "depression"],
  "therapist_suggestion": {
    "suggest": true,
    "urgency": "medium",
    "reason": "multiple_concerns"
  }
}
```

#### `GET /api/mood-context/{user_id}`
Retrieve mood tracking data for a user.

**Response:**
```json
{
  "user_id": "user_123",
  "mood_data": {
    "recent_moods": [...]
  },
  "timestamp": "2025-12-28T10:30:00.000Z"
}
```

#### `GET /api/health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-12-28T10:30:00.000Z",
  "environment": "development"
}
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | 8000 |
| `ENV` | Environment (development/staging/production) | No | development |
| `LOG_LEVEL` | Logging level | No | INFO |
| `SUPABASE_URL` | Supabase project URL | Yes | - |
| `SUPABASE_KEY` | Supabase service role key | Yes | - |
| `OPENAI_API_KEY` | OpenAI API key | Yes | - |
| `REDIS_HOST` | Redis host URL | Optional | - |
| `REDIS_PORT` | Redis port | Optional | 6379 |
| `REDIS_PASSWORD` | Redis password | Optional | - |

## 🚀 Deployment

### Deploy to Production Server

1. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set environment variables**
   ```bash
   export ENV=production
   export PORT=8000
   export SUPABASE_URL=https://your-project.supabase.co
   export SUPABASE_KEY=your-key
   export OPENAI_API_KEY=your-key
   # ... other variables
   ```

3. **Run with Gunicorn (recommended for production)**
   ```bash
   gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8000
   ```

### Deploy to Railway

1. Create a new project on [Railway](https://railway.app)
2. Connect your GitHub repository
3. Set the root directory to `/backend`
4. Add environment variables in Railway dashboard
5. Railway will automatically detect and deploy the Python application

### Deploy to Render

1. Create a new Web Service on [Render](https://render.com)
2. Connect your repository
3. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT`
4. Add environment variables
5. Deploy

### Deploy to Heroku

1. Install Heroku CLI
2. Create a `Procfile` in the backend directory:
   ```
   web: gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT
   ```
3. Deploy:
   ```bash
   heroku create your-app-name
   heroku config:set SUPABASE_URL=your-url
   heroku config:set SUPABASE_KEY=your-key
   heroku config:set OPENAI_API_KEY=your-key
   git subtree push --prefix backend heroku main
   ```

### Deploy to Fly.io

1. Install Fly CLI
2. Create `fly.toml` in backend directory:
   ```toml
   app = "therafam-backend"
   
   [env]
     PORT = "8000"
   
   [[services]]
     internal_port = 8000
     protocol = "tcp"
   
     [[services.ports]]
       handlers = ["http"]
       port = 80
   
     [[services.ports]]
       handlers = ["tls", "http"]
       port = 443
   ```
3. Deploy:
   ```bash
   fly launch
   fly secrets set SUPABASE_URL=your-url
   fly secrets set SUPABASE_KEY=your-key
   fly secrets set OPENAI_API_KEY=your-key
   fly deploy
   ```

## 🧪 Testing

### Manual Testing with curl

```bash
# Health check
curl http://localhost:8000/api/health

# Chat endpoint
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "I feel anxious", "user_id": "test_user"}'

# Crisis check
curl -X POST http://localhost:8000/api/crisis-check \
  -H "Content-Type: application/json" \
  -d '{"message": "I want to hurt myself"}'
```

### Testing with the Interactive CLI

The `run_flow.py` script includes an interactive CLI for testing:

```bash
python run_flow.py
```

This provides a conversational interface to test the AI responses.

## 📊 Monitoring and Logs

Logs are written to:
- Console (stdout)
- `therafam_backend.log` file
- `therafam_ai.log` file (from run_flow.py)

Log format:
```
2025-12-28 10:30:00 - TherafamBackend - INFO - Processing chat request from user: user_123
```

## 🔒 Security Considerations

1. **Never commit `.env` file** - Add to `.gitignore`
2. **Use HTTPS in production** - Configure SSL/TLS
3. **Rotate API keys regularly** - Update OpenAI and Supabase keys
4. **Rate limiting** - Implement rate limiting for production
5. **Authentication** - Add authentication middleware for sensitive endpoints
6. **CORS** - Configure CORS to only allow your frontend domain

## 🛠️ Development

### Project Structure

```
backend/
├── main.py                    # FastAPI application entry point
├── run_flow.py               # Therafam AI core logic
├── requirements.txt          # Python dependencies
├── .env.example             # Environment template
├── README.md                # This file
├── database/
│   ├── therafam_schema.sql  # Database schema
│   └── setup_database.js    # Database setup script
└── logs/
    ├── therafam_backend.log # API logs
    └── therafam_ai.log      # AI processing logs
```

### Adding New Endpoints

1. Add route decorator to `main.py`:
   ```python
   @app.post("/api/new-endpoint")
   async def new_endpoint(request: RequestModel):
       # Implementation
       return response
   ```

2. Create Pydantic models for request/response
3. Update API documentation in this README
4. Test the endpoint

## 📝 License

Copyright © 2025 Therafam. All rights reserved.

## 🆘 Crisis Resources

If you or someone you know is in crisis:
- **US**: Call 988 (Suicide & Crisis Lifeline)
- **Crisis Text Line**: Text HOME to 741741
- **Emergency**: Call 911

## 📧 Support

For technical support or questions about deployment:
- Check the documentation at `/api/docs`
- Review logs in `therafam_backend.log`
- Contact the development team
