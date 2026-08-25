from __future__ import annotations

import os
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None

try:
    from supabase import create_client
except ImportError:  # pragma: no cover
    create_client = None

app = FastAPI(title="Therafam API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",")],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_supabase():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key or create_client is None:
        return None
    return create_client(url, key)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=30)
    user_id: str | None = None


class MoodContextResponse(BaseModel):
    user_id: str
    entries: list[dict[str, Any]]


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "therafam-api"}


@app.post("/api/chat")
def chat(request: ChatRequest):
    """Return a supportive AI response without exposing provider credentials to the client."""
    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key or OpenAI is None:
        return {
            "response": "The Therafam AI service is currently in demo mode. Your message was received, but a live AI provider is not configured yet.",
            "demo": True,
        }

    client = OpenAI(api_key=api_key)
    messages: list[dict[str, str]] = [
        {
            "role": "system",
            "content": (
                "You are Therafam AI, a supportive mental-wellness assistant. "
                "Be calm, empathetic, concise, and age-appropriate. Do not diagnose, "
                "pretend to be a clinician, or claim certainty about a person's health. "
                "Encourage trusted human support when appropriate. If a user appears to "
                "be in immediate danger, encourage them to contact a trusted adult or "
                "local emergency service. Do not provide instructions for self-harm or "
                "other dangerous behavior."
            ),
        }
    ]
    messages.extend({"role": item.role, "content": item.content} for item in request.history[-20:])
    messages.append({"role": "user", "content": request.message})

    try:
        completion = client.chat.completions.create(
            model=os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
            messages=messages,
            temperature=0.4,
            max_tokens=500,
        )
        response_text = completion.choices[0].message.content or "I’m here to listen. Could you tell me a little more?"
    except Exception as exc:
        raise HTTPException(status_code=502, detail="AI service is temporarily unavailable") from exc

    if request.user_id:
        supabase = get_supabase()
        if supabase:
            try:
                supabase.table("ai_interactions").insert({
                    "user_id": request.user_id,
                    "input_text": request.message,
                    "response_text": response_text,
                    "emotions": [],
                    "escalation_level": 0,
                }).execute()
            except Exception:
                # Logging should never prevent the user from receiving a response.
                pass

    return {"response": response_text, "demo": False}


@app.get("/api/mood-context/{user_id}", response_model=MoodContextResponse)
def mood_context(user_id: str):
    supabase = get_supabase()
    if not supabase:
        return {"user_id": user_id, "entries": []}

    try:
        result = (
            supabase.table("mood_entries")
            .select("entry_date,mood_value,mood_label,energy_level,anxiety_level,stress_level,sleep_quality")
            .eq("user_id", user_id)
            .order("entry_date", desc=True)
            .limit(14)
            .execute()
        )
        return {"user_id": user_id, "entries": result.data or []}
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Unable to load mood context") from exc


@app.post("/api/crisis-check")
def crisis_check(payload: dict[str, Any]):
    """Return a conservative safety status for client-side routing."""
    text = str(payload.get("message", "")).strip()
    if not text:
        return {"flagged": False, "level": "none"}
    # Detailed detection belongs in the protected backend/AI layer.
    return {"flagged": False, "level": "none"}


@app.post("/api/emotion-detection")
def emotion_detection(payload: dict[str, Any]):
    """Reserved API contract for future emotion classification."""
    return {"emotions": [], "confidence": 0.0, "status": "not_configured"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8000)),
    )
