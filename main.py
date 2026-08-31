from __future__ import annotations

import os
from typing import Any, Literal
from uuid import UUID

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

try:
    from supabase import create_client
except ImportError:
    create_client = None

app = FastAPI(title="Therafam API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",")],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_supabase():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    if not url or not key or create_client is None:
        return None
    return create_client(url, key)


def require_supabase():
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Database is not configured")
    return client


def current_user_id(
    x_therafam_user_id: str | None = Header(default=None, alias="X-Therafam-User-Id"),
) -> str:
    if not x_therafam_user_id:
        raise HTTPException(status_code=401, detail="Missing user session")
    try:
        return str(UUID(x_therafam_user_id))
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid user session") from exc


def require_user(user_id: str, supabase: Any):
    result = supabase.table("users").select("id,user_type,is_active").eq("id", user_id).maybe_single().execute()
    user = result.data
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is not active")
    return user


def require_therapist(user_id: str, supabase: Any):
    user = require_user(user_id, supabase)
    if user.get("user_type") != "therapist":
        raise HTTPException(status_code=403, detail="Therapist access required")
    return user


def list_value(value: str | None):
    return [item.strip() for item in (value or "").split(",") if item.strip()]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=30)


class MoodContextResponse(BaseModel):
    user_id: str
    entries: list[dict[str, Any]]


class TherapistProfileUpdate(BaseModel):
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    license_number: str | None = Field(default=None, max_length=50)
    license_state: str | None = Field(default=None, max_length=50)
    specializations: list[str] = Field(default_factory=list)
    years_experience: int | None = Field(default=None, ge=0, le=70)
    bio: str | None = Field(default=None, max_length=500)
    phone_number: str | None = Field(default=None, max_length=20)
    timezone: str = Field(default="Africa/Lagos", max_length=50)
    languages_spoken: list[str] = Field(default_factory=list)


class AvailabilityUpdate(BaseModel):
    is_accepting_clients: bool


class SupportRequest(BaseModel):
    category: Literal["contact", "report"]
    message: str = Field(min_length=5, max_length=4000)


class SessionCreate(BaseModel):
    client_id: str
    scheduled_start_time: str
    scheduled_end_time: str
    session_type: Literal["individual", "group", "consultation"] = "individual"
    session_format: Literal["video", "audio", "in_person", "chat"] = "video"


class SessionStatusUpdate(BaseModel):
    status: Literal["scheduled", "in_progress", "completed", "cancelled", "no_show"]


class MessageCreate(BaseModel):
    recipient_id: str
    message_text: str = Field(min_length=1, max_length=5000)
    session_id: str | None = None


class SubscriptionUpgrade(BaseModel):
    plan: Literal["premium_monthly", "premium_annual"] = "premium_monthly"


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "therafam-api", "database_configured": get_supabase() is not None}


@app.post("/api/chat")
def chat(request: ChatRequest, user_id: str = Depends(current_user_id)):
    supabase = get_supabase()
    if supabase:
        require_user(user_id, supabase)

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or OpenAI is None:
        return {
            "response": "The Therafam AI service is currently in demo mode. Your message was received, but a live AI provider is not configured yet.",
            "demo": True,
        }

    client = OpenAI(api_key=api_key)
    messages: list[dict[str, str]] = [{
        "role": "system",
        "content": (
            "You are Therafam AI, a supportive mental-wellness assistant. Be calm, empathetic, concise, and age-appropriate. "
            "Do not diagnose, pretend to be a clinician, or claim certainty about a person's health. "
            "Encourage trusted human support when appropriate. If a user appears to be in immediate danger, encourage them to contact a trusted adult or local emergency service."
        ),
    }]
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

    if supabase:
        try:
            supabase.table("ai_interactions").insert({
                "user_id": user_id,
                "input_text": request.message,
                "response_text": response_text,
                "emotions": [],
                "escalation_level": 0,
            }).execute()
        except Exception:
            pass

    return {"response": response_text, "demo": False}


@app.get("/api/mood-context/me", response_model=MoodContextResponse)
def mood_context_me(user_id: str = Depends(current_user_id)):
    supabase = require_supabase()
    require_user(user_id, supabase)
    result = supabase.table("mood_entries").select(
        "entry_date,mood_value,mood_label,energy_level,anxiety_level,stress_level,sleep_quality"
    ).eq("user_id", user_id).order("entry_date", desc=True).limit(14).execute()
    return {"user_id": user_id, "entries": result.data or []}


@app.get("/api/therapist/dashboard")
def therapist_dashboard(user_id: str = Depends(current_user_id)):
    supabase = require_supabase()
    require_therapist(user_id, supabase)

    profile = supabase.table("therapist_profiles").select("*").eq("user_id", user_id).maybe_single().execute().data
    clients = supabase.table("therapist_client_relationships").select("id", count="exact", head=True).eq("therapist_id", user_id).eq("status", "active").execute()
    sessions = supabase.table("therapy_sessions").select("id", count="exact", head=True).eq("therapist_id", user_id).eq("status", "scheduled").execute()
    return {
        "profile": profile,
        "active_clients": clients.count or 0,
        "upcoming_sessions": sessions.count or 0,
    }


@app.get("/api/therapist/profile")
def get_therapist_profile(user_id: str = Depends(current_user_id)):
    supabase = require_supabase()
    require_therapist(user_id, supabase)
    result = supabase.table("therapist_profiles").select("*").eq("user_id", user_id).maybe_single().execute()
    return {"profile": result.data}


@app.put("/api/therapist/profile")
def update_therapist_profile(payload: TherapistProfileUpdate, user_id: str = Depends(current_user_id)):
    supabase = require_supabase()
    require_therapist(user_id, supabase)
    data = payload.model_dump()
    existing = supabase.table("therapist_profiles").select("id").eq("user_id", user_id).maybe_single().execute().data
    if existing:
        result = supabase.table("therapist_profiles").update(data).eq("user_id", user_id).execute()
    else:
        result = supabase.table("therapist_profiles").insert({"user_id": user_id, **data}).execute()
    return {"profile": (result.data or [None])[0]}


@app.put("/api/therapist/availability")
def update_therapist_availability(payload: AvailabilityUpdate, user_id: str = Depends(current_user_id)):
    supabase = require_supabase()
    require_therapist(user_id, supabase)
    existing = supabase.table("therapist_profiles").select("id").eq("user_id", user_id).maybe_single().execute().data
    if existing:
        result = supabase.table("therapist_profiles").update({"is_accepting_clients": payload.is_accepting_clients}).eq("user_id", user_id).execute()
    else:
        result = supabase.table("therapist_profiles").insert({"user_id": user_id, "is_accepting_clients": payload.is_accepting_clients}).execute()
    return {"is_accepting_clients": payload.is_accepting_clients, "profile": (result.data or [None])[0]}


@app.get("/api/therapist/clients")
def therapist_clients(user_id: str = Depends(current_user_id)):
    supabase = require_supabase()
    require_therapist(user_id, supabase)
    result = supabase.table("therapist_client_relationships").select("*").eq("therapist_id", user_id).order("created_at", desc=True).execute()
    return {"clients": result.data or []}


@app.get("/api/therapist/sessions")
def therapist_sessions(user_id: str = Depends(current_user_id)):
    supabase = require_supabase()
    require_therapist(user_id, supabase)
    result = supabase.table("therapy_sessions").select("*").eq("therapist_id", user_id).order("scheduled_start_time", desc=False).execute()
    return {"sessions": result.data or []}


@app.post("/api/therapist/sessions")
def create_therapist_session(payload: SessionCreate, user_id: str = Depends(current_user_id)):
    supabase = require_supabase()
    require_therapist(user_id, supabase)
    require_user(payload.client_id, supabase)
    result = supabase.table("therapy_sessions").insert({"therapist_id": user_id, **payload.model_dump()}).execute()
    return {"session": (result.data or [None])[0]}


@app.patch("/api/therapist/sessions/{session_id}")
def update_session_status(session_id: str, payload: SessionStatusUpdate, user_id: str = Depends(current_user_id)):
    supabase = require_supabase()
    require_therapist(user_id, supabase)
    result = supabase.table("therapy_sessions").update({"status": payload.status}).eq("id", session_id).eq("therapist_id", user_id).execute()
    return {"session": (result.data or [None])[0]}


@app.get("/api/therapist/notes")
def therapist_notes(user_id: str = Depends(current_user_id)):
    supabase = require_supabase()
    require_therapist(user_id, supabase)
    result = supabase.table("therapy_session_notes").select("*").eq("therapist_id", user_id).order("created_at", desc=True).execute()
    return {"notes": result.data or []}


@app.get("/api/therapist/messages")
def therapist_messages(user_id: str = Depends(current_user_id)):
    supabase = require_supabase()
    require_therapist(user_id, supabase)
    result = supabase.table("chat_messages").select("*").eq("conversation_type", "therapist_chat").or_(
        f"sender_id.eq.{user_id},recipient_id.eq.{user_id}"
    ).order("created_at", desc=False).limit(200).execute()
    return {"messages": result.data or []}


@app.post("/api/messages")
def send_message(payload: MessageCreate, user_id: str = Depends(current_user_id)):
    supabase = require_supabase()
    require_user(user_id, supabase)
    require_user(payload.recipient_id, supabase)
    result = supabase.table("chat_messages").insert({
        "conversation_type": "therapist_chat",
        "sender_id": user_id,
        "recipient_id": payload.recipient_id,
        "message_text": payload.message_text,
        "session_id": payload.session_id,
    }).execute()
    return {"message": (result.data or [None])[0]}


@app.post("/api/support")
def create_support_request(payload: SupportRequest, user_id: str = Depends(current_user_id)):
    supabase = require_supabase()
    require_user(user_id, supabase)
    result = supabase.table("notifications").insert({
        "user_id": user_id,
        "title": "Support request" if payload.category == "contact" else "Problem report",
        "message": payload.message,
        "notification_type": "system_update",
        "priority": "normal",
        "metadata": {"category": payload.category, "submitted_by": user_id},
    }).execute()
    return {"submitted": True, "record": (result.data or [None])[0]}


@app.get("/api/subscription")
def get_subscription(user_id: str = Depends(current_user_id)):
    supabase = require_supabase()
    user = require_user(user_id, supabase)
    if user.get("user_type") != "client":
        return {"status": "not_required", "plan": None, "features_locked": False}

    result = supabase.table("user_subscriptions").select("*").eq("user_id", user_id).maybe_single().execute()
    subscription = result.data
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription record not found")

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    trial_end = subscription.get("trial_ends_at")
    if subscription.get("status") == "trialing" and trial_end:
        expires = datetime.fromisoformat(trial_end.replace("Z", "+00:00"))
        if now >= expires:
            supabase.table("user_subscriptions").update({"status": "expired"}).eq("user_id", user_id).execute()
            subscription["status"] = "expired"

    status_value = subscription.get("status")
    active = status_value in ("trialing", "active")
    trial_days_remaining = None
    if status_value == "trialing" and subscription.get("trial_ends_at"):
        delta = datetime.fromisoformat(subscription["trial_ends_at"].replace("Z", "+00:00")) - now
        trial_days_remaining = max(0, (delta.total_seconds() + 86399) // 86400)

    return {
        "subscription": subscription,
        "features_locked": not active,
        "trial_days_remaining": int(trial_days_remaining) if trial_days_remaining is not None else None,
    }


@app.post("/api/subscription/upgrade")
def begin_subscription_upgrade(payload: SubscriptionUpgrade, user_id: str = Depends(current_user_id)):
    supabase = require_supabase()
    user = require_user(user_id, supabase)
    if user.get("user_type") != "client":
        raise HTTPException(status_code=403, detail="Only client accounts can manage subscriptions")

    # Payment providers will replace this activation step once Paystack/Flutterwave is connected.
    result = supabase.table("user_subscriptions").update({
        "plan": payload.plan,
        "status": "active",
        "subscription_started_at": "now()",
    }).eq("user_id", user_id).execute()
    return {"activated": True, "plan": payload.plan, "payment_required": False, "record": (result.data or [None])[0]}


@app.get("/api/therapist/earnings")
def therapist_earnings(user_id: str = Depends(current_user_id)):
    supabase = require_supabase()
    require_therapist(user_id, supabase)

    rows = supabase.table("therapist_earnings").select("*").eq("therapist_id", user_id).order("created_at", desc=True).limit(100).execute().data or []
    available = sum(float(row.get("amount") or 0) for row in rows if row.get("status") == "available" and row.get("earning_type") != "withdrawal")
    pending = sum(float(row.get("amount") or 0) for row in rows if row.get("status") == "pending" and row.get("earning_type") != "withdrawal")
    withdrawn = sum(float(row.get("amount") or 0) for row in rows if row.get("earning_type") == "withdrawal" and row.get("status") == "paid_out")
    total_earned = available + pending + withdrawn

    performance = supabase.table("therapist_performance").select("*").eq("therapist_id", user_id).order("period_end", desc=True).limit(1).maybe_single().execute().data
    return {
        "available_balance": round(available, 2),
        "pending_balance": round(pending, 2),
        "total_earned": round(total_earned, 2),
        "total_withdrawn": round(withdrawn, 2),
        "performance": performance,
        "transactions": rows,
    }


@app.post("/api/therapist/earnings/recalculate")
def recalculate_therapist_earnings(user_id: str = Depends(current_user_id)):
    supabase = require_supabase()
    require_therapist(user_id, supabase)

    sessions = supabase.table("therapy_sessions").select("id,client_id,total_cost,status,payment_status").eq("therapist_id", user_id).eq("status", "completed").eq("payment_status", "paid").execute().data or []
    existing = supabase.table("therapist_earnings").select("session_id").eq("therapist_id", user_id).eq("earning_type", "session_payment").execute().data or []
    existing_ids = {row.get("session_id") for row in existing}

    inserted = 0
    for session in sessions:
        if session.get("id") in existing_ids:
            continue
        gross = float(session.get("total_cost") or 0)
        if gross <= 0:
            continue
        therapist_share = round(gross * 0.80, 2)
        supabase.table("therapist_earnings").insert({
            "therapist_id": user_id,
            "client_id": session.get("client_id"),
            "session_id": session.get("id"),
            "amount": therapist_share,
            "earning_type": "session_payment",
            "status": "available",
            "description": "80% therapist share from completed paid session",
        }).execute()
        inserted += 1

    return {"recalculated": True, "new_earnings": inserted}


@app.get("/api/therapist/performance")
def therapist_performance(user_id: str = Depends(current_user_id)):
    supabase = require_supabase()
    require_therapist(user_id, supabase)
    rows = supabase.table("therapist_performance").select("*").eq("therapist_id", user_id).order("period_end", desc=True).limit(12).execute().data or []
    return {"performance_history": rows}


@app.post("/api/crisis-check")
def crisis_check(payload: dict[str, Any]):
    return {"flagged": False, "level": "none"}


@app.post("/api/emotion-detection")
def emotion_detection(payload: dict[str, Any]):
    return {"emotions": [], "confidence": 0.0, "status": "not_configured"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
