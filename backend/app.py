from __future__ import annotations

import os
import psycopg
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from psycopg.types.json import Jsonb

from .auth import current_user, hash_password, issue_session, revoke_session, verify_password
from .db import connection, execute, many, one

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None
try:
    import boto3
except ImportError:
    boto3 = None

app = FastAPI(title="Therafam API", version="2.0.0")
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "*").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins or ["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class AuthRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=200)
class SignupRequest(AuthRequest):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone_number: str | None = Field(default=None, max_length=20)
    user_type: Literal["client", "therapist"] = "client"
    professional_title: str | None = Field(default=None, max_length=120)
    specialization: str | None = Field(default=None, max_length=200)
    license_number: str | None = Field(default=None, max_length=50)
    years_experience: int | None = Field(default=None, ge=0, le=70)
    practice_location: str | None = Field(default=None, max_length=150)
    professional_bio: str | None = Field(default=None, max_length=500)
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)
class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=30)
    language: Literal["en", "es", "fr", "pt", "ar", "sw", "ha", "yo", "ig"] = "en"
class MoodEntry(BaseModel):
    mood_value: int = Field(ge=1, le=10)
    mood_label: str = Field(min_length=1, max_length=50)
    energy_level: int | None = Field(default=None, ge=1, le=10)
    anxiety_level: int | None = Field(default=None, ge=1, le=10)
    stress_level: int | None = Field(default=None, ge=1, le=10)
    sleep_hours: float | None = Field(default=None, ge=0, le=24)
    sleep_quality: int | None = Field(default=None, ge=1, le=10)
    notes: str | None = Field(default=None, max_length=4000)
    entry_date: str
class SettingsUpdate(BaseModel):
    email_notifications: bool = True; push_notifications: bool = True; sms_notifications: bool = False
    appointment_reminders: bool = True; ai_chat_notifications: bool = True
    profile_visibility: Literal["public", "therapists_only", "private"] = "private"
    data_sharing: bool = False; analytics_opt_in: bool = True
    theme: Literal["light", "dark", "auto"] = "light"; language: str = "en"; auto_save_chat: bool = True
class ProfileUpdate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100); last_name: str = Field(min_length=1, max_length=100)
    phone_number: str = Field(default="", max_length=20); bio: str = Field(default="", max_length=1000)
    timezone: str = Field(default="Africa/Lagos", max_length=50); language_preference: str = Field(default="en", max_length=20)
class TherapistProfileUpdate(BaseModel):
    first_name: str | None = Field(default=None, max_length=100); last_name: str | None = Field(default=None, max_length=100)
    professional_title: str | None = Field(default=None, max_length=120)
    license_number: str | None = Field(default=None, max_length=50); license_state: str | None = Field(default=None, max_length=50)
    specializations: list[str] = Field(default_factory=list); years_experience: int | None = Field(default=None, ge=0, le=70)
    bio: str | None = Field(default=None, max_length=500); phone_number: str | None = Field(default=None, max_length=20)
    timezone: str = Field(default="Africa/Lagos", max_length=50); languages_spoken: list[str] = Field(default_factory=list)
class AvailabilityUpdate(BaseModel): is_accepting_clients: bool
class SupportRequest(BaseModel):
    category: Literal["contact", "report"]; message: str = Field(min_length=5, max_length=4000)
class SessionCreate(BaseModel):
    client_id: str; scheduled_start_time: str; scheduled_end_time: str
    session_type: Literal["individual", "group", "consultation"] = "individual"
    session_format: Literal["video", "audio", "in_person", "chat"] = "video"
class SessionStatusUpdate(BaseModel): status: Literal["scheduled", "in_progress", "completed", "cancelled", "no_show"]
class MessageCreate(BaseModel): recipient_id: str; message_text: str = Field(min_length=1, max_length=5000); session_id: str | None = None
class TherapistNoteCreate(BaseModel):
    session_id: str
    session_summary: str = Field(min_length=1, max_length=10000)
    client_mood: str | None = Field(default=None, max_length=50)
    topics_discussed: list[str] = Field(default_factory=list, max_length=20)
    interventions_used: list[str] = Field(default_factory=list, max_length=20)
    homework_assigned: str | None = Field(default=None, max_length=5000)
    client_progress_notes: str | None = Field(default=None, max_length=5000)
    risk_assessment: Literal["low", "medium", "high", "crisis"] | None = None
    treatment_plan_updates: str | None = Field(default=None, max_length=5000)
    medication_notes: str | None = Field(default=None, max_length=3000)
    next_session_goals: list[str] = Field(default_factory=list, max_length=20)
    follow_up_actions: list[str] = Field(default_factory=list, max_length=20)
class SubscriptionUpgrade(BaseModel): plan: Literal["premium_monthly", "premium_annual"] = "premium_monthly"

def clean(row: dict[str, Any] | None):
    if row is None: return None
    uuid_keys = {"id", "user_id", "therapist_id", "client_id", "sender_id", "recipient_id", "session_id", "program_id", "lesson_id"}
    return {k: (str(v) if k in uuid_keys and v is not None else v) for k,v in row.items()}
def therapist(user):
    if user.get("user_type") != "therapist": raise HTTPException(403, "Therapist access required")
    return user

def public_user(user):
    return {k: (str(user[k]) if k == "id" else user[k]) for k in ("id","email","user_type","is_verified","is_active")}

@app.get("/api/health")
def health():
    required_tables = [
        "users", "email_verifications", "user_sessions", "user_profiles", "user_settings",
        "therapist_profiles", "therapist_availability", "therapist_client_relationships",
        "therapy_sessions", "therapy_session_notes", "therapy_notes", "chat_messages",
        "ai_conversations", "crisis_logs", "ai_interactions", "documents", "mood_entries",
        "self_help_programs", "lessons", "lesson_progress", "notifications",
        "revenue_transactions", "therapist_handoffs", "user_subscriptions",
        "therapist_earnings", "therapist_performance", "therapist_reviews",
        "therafam_knowledge_chunks",
    ]
    try:
        one("SELECT 1 AS ok")
        existing = {row["tablename"] for row in many(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename = ANY(%s)",
            (required_tables,),
        )}
        missing = [table for table in required_tables if table not in existing]
        required_extensions = ["uuid-ossp", "pgcrypto", "vector"]
        installed_extensions = {row["extname"] for row in many(
            "SELECT extname FROM pg_extension WHERE extname = ANY(%s)",
            (required_extensions,),
        )}
        missing_extensions = [ext for ext in required_extensions if ext not in installed_extensions]
        required_columns = [("therapist_profiles", "professional_title")]
        existing_columns = {
            (row["table_name"], row["column_name"]) for row in many(
                """SELECT table_name,column_name FROM information_schema.columns
                   WHERE table_schema='public'
                     AND (table_name,column_name) IN (('therapist_profiles','professional_title'))"""
            )
        }
        missing_columns = [f"{table}.{column}" for table, column in required_columns if (table, column) not in existing_columns]
        vector = "vector" in installed_extensions
        db = True
    except Exception:
        db = False
        missing = required_tables
        missing_extensions = ["uuid-ossp", "pgcrypto", "vector"]
        missing_columns = ["therapist_profiles.professional_title"]
        vector = False
    ready = db and not missing and not missing_extensions and not missing_columns
    return {
        "status": "ok" if ready else "degraded" if db else "unavailable",
        "service": "therafam-api",
        "database_configured": db,
        "schema_ready": ready,
        "missing_tables": missing,
        "missing_columns": missing_columns,
        "missing_extensions": missing_extensions,
        "vector_extension": vector,
    }

@app.post("/api/auth/signup")
def signup(p: SignupRequest):
    email = p.email.strip().lower()
    try:
        with connection() as conn:
            existing = conn.execute(
                "SELECT id FROM users WHERE lower(email)=%s",
                (email,),
            ).fetchone()
            if existing:
                raise HTTPException(409, "An account with this email already exists")
            u = conn.execute(
                """INSERT INTO users(email,password_hash,user_type,is_verified,is_active)
                   VALUES(%s,%s,%s,FALSE,TRUE)
                   RETURNING id,email,user_type,is_verified,is_active""",
                (email, hash_password(p.password), p.user_type),
            ).fetchone()
            uid = str(u["id"])
            if p.user_type == "therapist":
                conn.execute(
                    """INSERT INTO therapist_profiles
                       (user_id,first_name,last_name,professional_title,license_number,license_state,
                        specializations,years_experience,bio,phone_number)
                       VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (uid, p.first_name, p.last_name, p.professional_title, p.license_number,
                     p.practice_location, [p.specialization] if p.specialization else [],
                     p.years_experience, p.professional_bio, p.phone_number),
                )
            else:
                conn.execute(
                    """INSERT INTO user_profiles(user_id,first_name,last_name,phone_number)
                       VALUES(%s,%s,%s,%s)""",
                    (uid, p.first_name, p.last_name, p.phone_number),
                )
            token = issue_session(uid, conn=conn)
    except psycopg.errors.UniqueViolation as exc:
        if getattr(exc.diag, "constraint_name", None) == "users_email_key":
            raise HTTPException(409, "An account with this email already exists") from exc
        raise
    return {"user": public_user(u), "token": token}

@app.post("/api/auth/signin")
def signin(p: AuthRequest):
    u=one("SELECT id,email,password_hash,user_type,is_verified,is_active FROM users WHERE lower(email)=%s",(p.email.strip().lower(),))
    if not u or not u["is_active"] or not verify_password(p.password,u["password_hash"]): raise HTTPException(401,"Invalid email or password")
    execute("UPDATE users SET last_login_at=NOW(),updated_at=NOW() WHERE id=%s",(u["id"],))
    return {"user":public_user(u),"token":issue_session(str(u["id"]))}

@app.post("/api/auth/signout")
def signout(authorization: str | None = Header(default=None), user=Depends(current_user)):
    # Revoke the hashed bearer token so it cannot be reused after sign-out.
    if authorization and authorization.lower().startswith("bearer "):
        revoke_session(authorization.split(" ", 1)[1].strip())
    return {"signed_out": True, "user_id": str(user["id"])}
@app.get("/api/me")
def me(user=Depends(current_user)): return {"user":public_user(user)}

@app.post("/api/chat")
def chat(p: ChatRequest, user=Depends(current_user)):
    """Therafam CBT companion powered by the repository guide and Railway pgvector."""
    from .rag_ai import answer_with_rag
    try:
        result = answer_with_rag(
            p.message,
            [{"role": x.role, "content": x.content} for x in p.history[-12:]],
            p.language,
        )
    except RuntimeError as exc:
        # Fail explicitly rather than silently presenting a non-RAG demo response.
        raise HTTPException(503, str(exc)) from exc
    except Exception as exc:
        # Avoid leaking database/provider details to the client.
        raise HTTPException(502, "Therafam AI is temporarily unavailable") from exc
    history_saved = False
    try:
        execute(
            "INSERT INTO ai_interactions(user_id,input_text,response_text,emotions,escalation_level) VALUES(%s,%s,%s,%s,%s)",
            (user["id"], p.message, result["response"], [], 1 if result.get("crisis") else 0),
        )
        history_saved = True
    except Exception:
        # Preserve the AI response but tell the client that persistence failed.
        history_saved = False
    result["history_saved"] = history_saved
    return result

@app.get("/api/chat/history")
def chat_history(limit: int = 50, user=Depends(current_user)):
    rows = many(
        """SELECT id,input_text,response_text,created_at
           FROM (
               SELECT id,input_text,response_text,created_at
               FROM ai_interactions WHERE user_id=%s
               ORDER BY created_at DESC LIMIT %s
           ) recent
           ORDER BY created_at ASC""",
        (user["id"], max(1, min(limit, 100))),
    )
    return {"interactions": [clean(row) for row in rows]}

@app.get("/api/programs")
def programs(user=Depends(current_user)):
    return {"programs":[clean(r) for r in many("SELECT id,title,description,category,difficulty_level,estimated_duration_days,thumbnail_url,tags,total_lessons FROM self_help_programs WHERE is_published=TRUE ORDER BY created_at ASC")]}
@app.get("/api/programs/{program_id}/lessons")
def lessons(program_id,user=Depends(current_user)):
    return {"lessons":[clean(r) for r in many("SELECT id,program_id,title,description,lesson_number,content_type,content_text,duration_minutes,learning_objectives,key_concepts,exercises FROM lessons WHERE program_id=%s AND is_published=TRUE ORDER BY lesson_number ASC",(program_id,))]}
@app.get("/api/programs/{program_id}/progress")
def program_progress(program_id: str, user=Depends(current_user)):
    if not one("SELECT id FROM self_help_programs WHERE id=%s AND is_published=TRUE", (program_id,)):
        raise HTTPException(404, "Program not found")
    rows = many(
        """SELECT lesson_id,status,progress_percentage,started_at,completed_at,updated_at
           FROM lesson_progress WHERE user_id=%s AND program_id=%s""",
        (user["id"], program_id),
    )
    return {"progress": [clean(row) for row in rows]}

@app.post("/api/programs/{program_id}/lessons/{lesson_id}/complete")
def complete_lesson(program_id: str, lesson_id: str, user=Depends(current_user)):
    lesson = one(
        """SELECT id FROM lessons
           WHERE id=%s AND program_id=%s AND is_published=TRUE""",
        (lesson_id, program_id),
    )
    if not lesson:
        raise HTTPException(404, "Lesson not found in this published program")
    row = execute(
        """INSERT INTO lesson_progress
           (user_id,program_id,lesson_id,status,progress_percentage,started_at,completed_at,updated_at)
           VALUES(%s,%s,%s,'completed',100,NOW(),NOW(),NOW())
           ON CONFLICT(user_id,lesson_id) DO UPDATE
           SET status='completed',progress_percentage=100,
               started_at=COALESCE(lesson_progress.started_at,NOW()),
               completed_at=NOW(),updated_at=NOW()
           RETURNING *""",
        (user["id"], program_id, lesson_id),
    )
    return {"progress": clean(row), "completed": True}

@app.get("/api/mood")
def get_mood(limit:int=14,user=Depends(current_user)):
    return {"entries":[clean(r) for r in many("SELECT * FROM mood_entries WHERE user_id=%s ORDER BY entry_date DESC LIMIT %s",(user["id"],max(1,min(limit,100))))]}
@app.post("/api/mood")
def save_mood(p:MoodEntry,user=Depends(current_user)):
    r=execute("""INSERT INTO mood_entries(user_id,mood_value,mood_label,energy_level,anxiety_level,stress_level,sleep_hours,sleep_quality,notes,entry_date) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(user_id,entry_date) DO UPDATE SET mood_value=EXCLUDED.mood_value,mood_label=EXCLUDED.mood_label,energy_level=EXCLUDED.energy_level,anxiety_level=EXCLUDED.anxiety_level,stress_level=EXCLUDED.stress_level,sleep_hours=EXCLUDED.sleep_hours,sleep_quality=EXCLUDED.sleep_quality,notes=EXCLUDED.notes,updated_at=NOW() RETURNING *""",(user["id"],p.mood_value,p.mood_label,p.energy_level,p.anxiety_level,p.stress_level,p.sleep_hours,p.sleep_quality,p.notes,p.entry_date))
    return {"entry":clean(r)}

@app.get("/api/settings")
def get_settings(user=Depends(current_user)): return {"settings":clean(one("SELECT * FROM user_settings WHERE user_id=%s",(user["id"],)))}
@app.put("/api/settings")
def save_settings(p:SettingsUpdate,user=Depends(current_user)):
    d=p.model_dump(); r=execute("""INSERT INTO user_settings(user_id,email_notifications,push_notifications,sms_notifications,appointment_reminders,ai_chat_notifications,profile_visibility,data_sharing,analytics_opt_in,theme,language,auto_save_chat) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(user_id) DO UPDATE SET email_notifications=EXCLUDED.email_notifications,push_notifications=EXCLUDED.push_notifications,sms_notifications=EXCLUDED.sms_notifications,appointment_reminders=EXCLUDED.appointment_reminders,ai_chat_notifications=EXCLUDED.ai_chat_notifications,profile_visibility=EXCLUDED.profile_visibility,data_sharing=EXCLUDED.data_sharing,analytics_opt_in=EXCLUDED.analytics_opt_in,theme=EXCLUDED.theme,language=EXCLUDED.language,auto_save_chat=EXCLUDED.auto_save_chat,updated_at=NOW() RETURNING *""",(user["id"],d["email_notifications"],d["push_notifications"],d["sms_notifications"],d["appointment_reminders"],d["ai_chat_notifications"],d["profile_visibility"],d["data_sharing"],d["analytics_opt_in"],d["theme"],d["language"],d["auto_save_chat"]))
    return {"settings":clean(r)}
@app.get("/api/profile")
def get_profile(user=Depends(current_user)): return {"profile":clean(one("SELECT id,user_id,first_name,last_name,phone_number,profile_picture_url,bio,timezone,language_preference FROM user_profiles WHERE user_id=%s",(user["id"],)))}
@app.put("/api/profile")
def save_profile(p:ProfileUpdate,user=Depends(current_user)):
    d=p.model_dump(); r=execute("""INSERT INTO user_profiles(user_id,first_name,last_name,phone_number,bio,timezone,language_preference) VALUES(%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(user_id) DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,phone_number=EXCLUDED.phone_number,bio=EXCLUDED.bio,timezone=EXCLUDED.timezone,language_preference=EXCLUDED.language_preference,updated_at=NOW() RETURNING id,user_id,first_name,last_name,phone_number,profile_picture_url,bio,timezone,language_preference""",(user["id"],d["first_name"],d["last_name"],d["phone_number"],d["bio"],d["timezone"],d["language_preference"]))
    return {"profile":clean(r)}

@app.post("/api/profile/image")
def profile_image(file:UploadFile=File(...),user=Depends(current_user)):
    if not file.content_type or not file.content_type.startswith("image/"): raise HTTPException(400,"Please select an image file")
    data=file.file.read()
    if len(data)>5*1024*1024: raise HTTPException(413,"Profile images must be 5 MB or smaller")
    if boto3 is None: raise HTTPException(503,"File storage is not configured")
    bucket=os.getenv("BUCKET") or os.getenv("AWS_S3_BUCKET_NAME"); endpoint=os.getenv("ENDPOINT") or os.getenv("AWS_ENDPOINT_URL"); ak=os.getenv("ACCESS_KEY_ID") or os.getenv("AWS_ACCESS_KEY_ID"); sk=os.getenv("SECRET_ACCESS_KEY") or os.getenv("AWS_SECRET_ACCESS_KEY")
    if not all([bucket,endpoint,ak,sk]): raise HTTPException(503,"File storage is not configured")
    ext=(file.filename or "jpg").split(".")[-1].lower(); key=f"profile-images/{user['id']}/avatar-{int(datetime.now().timestamp())}.{ext}"
    s3=boto3.client("s3",endpoint_url=endpoint,aws_access_key_id=ak,aws_secret_access_key=sk,region_name=os.getenv("REGION","auto")); s3.put_object(Bucket=bucket,Key=key,Body=data,ContentType=file.content_type)
    url=s3.generate_presigned_url("get_object",Params={"Bucket":bucket,"Key":key},ExpiresIn=86400*30); execute("UPDATE user_profiles SET profile_picture_url=%s,updated_at=NOW() WHERE user_id=%s",(url,user["id"]))
    return {"url":url}

@app.get("/api/mood-context/me")
def mood_context(user=Depends(current_user)): return {"user_id":str(user["id"]),"entries":many("SELECT entry_date,mood_value,mood_label,energy_level,anxiety_level,stress_level,sleep_quality FROM mood_entries WHERE user_id=%s ORDER BY entry_date DESC LIMIT 14",(user["id"],))}

@app.get("/api/therapist/dashboard")
def therapist_dashboard(user=Depends(current_user)):
    therapist(user); p=one("SELECT * FROM therapist_profiles WHERE user_id=%s",(user["id"],)); c=one("SELECT COUNT(*) count FROM therapist_client_relationships WHERE therapist_id=%s AND status='active'",(user["id"],)); s=one("SELECT COUNT(*) count FROM therapy_sessions WHERE therapist_id=%s AND status='scheduled'",(user["id"],))
    return {"profile":clean(p),"active_clients":int(c["count"] if c else 0),"upcoming_sessions":int(s["count"] if s else 0)}
@app.get("/api/therapist/profile")
def therapist_profile(user=Depends(current_user)): therapist(user); return {"profile":clean(one("SELECT * FROM therapist_profiles WHERE user_id=%s",(user["id"],)))}
@app.put("/api/therapist/profile")
def save_therapist(p:TherapistProfileUpdate,user=Depends(current_user)):
    therapist(user); d=p.model_dump(); r=execute("""INSERT INTO therapist_profiles(user_id,first_name,last_name,professional_title,license_number,license_state,specializations,years_experience,bio,phone_number,timezone,languages_spoken) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(user_id) DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,professional_title=EXCLUDED.professional_title,license_number=EXCLUDED.license_number,license_state=EXCLUDED.license_state,specializations=EXCLUDED.specializations,years_experience=EXCLUDED.years_experience,bio=EXCLUDED.bio,phone_number=EXCLUDED.phone_number,timezone=EXCLUDED.timezone,languages_spoken=EXCLUDED.languages_spoken,updated_at=NOW() RETURNING *""",(user["id"],d["first_name"],d["last_name"],d["professional_title"],d["license_number"],d["license_state"],d["specializations"],d["years_experience"],d["bio"],d["phone_number"],d["timezone"],d["languages_spoken"]))
    return {"profile":clean(r)}
@app.put("/api/therapist/availability")
def availability(p:AvailabilityUpdate,user=Depends(current_user)):
    therapist(user); r=execute("UPDATE therapist_profiles SET is_accepting_clients=%s,updated_at=NOW() WHERE user_id=%s RETURNING *",(p.is_accepting_clients,user["id"]))
    if not r: r=execute("INSERT INTO therapist_profiles(user_id,is_accepting_clients) VALUES(%s,%s) RETURNING *",(user["id"],p.is_accepting_clients))
    return {"is_accepting_clients":p.is_accepting_clients,"profile":clean(r)}
@app.get("/api/therapist/clients")
def clients(user=Depends(current_user)):
    therapist(user)
    rows = many("""SELECT r.id,r.therapist_id,r.client_id,r.status,r.start_date,r.end_date,r.notes,r.created_at,
                          u.email AS client_email,up.first_name AS client_first_name,up.last_name AS client_last_name
                   FROM therapist_client_relationships r
                   JOIN users u ON u.id=r.client_id
                   LEFT JOIN user_profiles up ON up.user_id=u.id
                   WHERE r.therapist_id=%s ORDER BY r.created_at DESC""", (user["id"],))
    return {"clients": [clean(row) for row in rows]}

@app.get("/api/therapist/sessions")
def sessions(user=Depends(current_user)):
    therapist(user)
    rows = many("""SELECT ts.*,u.email AS client_email,up.first_name AS client_first_name,up.last_name AS client_last_name
                   FROM therapy_sessions ts
                   JOIN users u ON u.id=ts.client_id
                   LEFT JOIN user_profiles up ON up.user_id=u.id
                   WHERE ts.therapist_id=%s ORDER BY ts.scheduled_start_time ASC""", (user["id"],))
    return {"sessions": [clean(row) for row in rows]}

@app.post("/api/therapist/sessions")
def create_session(p:SessionCreate,user=Depends(current_user)):
    therapist(user); r=execute("INSERT INTO therapy_sessions(therapist_id,client_id,scheduled_start_time,scheduled_end_time,session_type,session_format) VALUES(%s,%s,%s,%s,%s,%s) RETURNING *",(user["id"],p.client_id,p.scheduled_start_time,p.scheduled_end_time,p.session_type,p.session_format)); return {"session":clean(r)}
@app.patch("/api/therapist/sessions/{session_id}")
def session_status(session_id:str,p:SessionStatusUpdate,user=Depends(current_user)):
    therapist(user); r=execute("UPDATE therapy_sessions SET status=%s WHERE id=%s AND therapist_id=%s RETURNING *",(p.status,session_id,user["id"]));
    if not r: raise HTTPException(404,"Session not found")
    return {"session":clean(r)}
@app.get("/api/therapist/notes")
def notes(user=Depends(current_user)):
    therapist(user)
    return {"notes": [clean(row) for row in many(
        "SELECT * FROM therapy_session_notes WHERE therapist_id=%s ORDER BY created_at DESC LIMIT 200",
        (user["id"],),
    )]}

@app.post("/api/therapist/notes")
def create_therapist_note(payload: TherapistNoteCreate, user=Depends(current_user)):
    therapist(user)
    if not one("SELECT id FROM therapy_sessions WHERE id=%s AND therapist_id=%s", (payload.session_id, user["id"])):
        raise HTTPException(404, "Session not found for this therapist")
    row = execute(
        """INSERT INTO therapy_session_notes
           (session_id,therapist_id,session_summary,client_mood,topics_discussed,interventions_used,
            homework_assigned,client_progress_notes,risk_assessment,treatment_plan_updates,
            medication_notes,next_session_goals,follow_up_actions)
           VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
        (payload.session_id,user["id"],payload.session_summary,payload.client_mood,
         payload.topics_discussed,payload.interventions_used,payload.homework_assigned,
         payload.client_progress_notes,payload.risk_assessment,payload.treatment_plan_updates,
         payload.medication_notes,payload.next_session_goals,payload.follow_up_actions),
    )
    return {"note": clean(row), "saved": True}

@app.get("/api/therapist/messages")
def therapist_messages(user=Depends(current_user)):
    therapist(user)
    return {"messages": [clean(row) for row in many(
        """SELECT * FROM chat_messages WHERE conversation_type='therapist_chat'
           AND (sender_id=%s OR recipient_id=%s) ORDER BY created_at ASC LIMIT 200""",
        (user["id"], user["id"]),
    )]}

@app.get("/api/messages/contacts")
def message_contacts(user=Depends(current_user)):
    if user["user_type"] == "therapist":
        rows = many(
            """SELECT u.id,u.email,u.user_type,up.first_name,up.last_name
               FROM therapist_client_relationships r
               JOIN users u ON u.id=r.client_id
               LEFT JOIN user_profiles up ON up.user_id=u.id
               WHERE r.therapist_id=%s AND r.status='active' AND u.is_active=TRUE
               ORDER BY up.last_name,up.first_name,u.email""",
            (user["id"],),
        )
    else:
        rows = many(
            """SELECT u.id,u.email,u.user_type,tp.first_name,tp.last_name
               FROM therapist_client_relationships r
               JOIN users u ON u.id=r.therapist_id
               LEFT JOIN therapist_profiles tp ON tp.user_id=u.id
               WHERE r.client_id=%s AND r.status='active' AND u.is_active=TRUE
               ORDER BY tp.last_name,tp.first_name,u.email""",
            (user["id"],),
        )
    return {"contacts": [clean(row) for row in rows]}

@app.get("/api/messages/with/{contact_id}")
def messages_with_contact(contact_id: str, user=Depends(current_user)):
    if user["user_type"] == "therapist":
        relation = one(
            """SELECT id FROM therapist_client_relationships
               WHERE therapist_id=%s AND client_id=%s AND status='active'""",
            (user["id"], contact_id),
        )
    else:
        relation = one(
            """SELECT id FROM therapist_client_relationships
               WHERE client_id=%s AND therapist_id=%s AND status='active'""",
            (user["id"], contact_id),
        )
    if not relation:
        raise HTTPException(403, "Messaging is limited to an active care-team relationship")
    rows = many(
        """SELECT id,sender_id,recipient_id,message_text,created_at,is_read
           FROM chat_messages WHERE conversation_type='therapist_chat'
             AND ((sender_id=%s AND recipient_id=%s) OR (sender_id=%s AND recipient_id=%s))
           ORDER BY created_at ASC LIMIT 200""",
        (user["id"], contact_id, contact_id, user["id"]),
    )
    return {"messages": [clean(row) for row in rows]}

@app.post("/api/messages")
def messages(p:MessageCreate,user=Depends(current_user)):
    recipient = one("SELECT id,user_type FROM users WHERE id=%s AND is_active=TRUE", (p.recipient_id,))
    if not recipient:
        raise HTTPException(404, "Recipient not found")
    if user["user_type"] == "therapist":
        allowed = recipient["user_type"] == "client" and one(
            """SELECT id FROM therapist_client_relationships
               WHERE therapist_id=%s AND client_id=%s AND status='active'""",
            (user["id"], p.recipient_id),
        )
    else:
        allowed = recipient["user_type"] == "therapist" and one(
            """SELECT id FROM therapist_client_relationships
               WHERE client_id=%s AND therapist_id=%s AND status='active'""",
            (user["id"], p.recipient_id),
        )
    if not allowed:
        raise HTTPException(403, "Messaging is limited to an active care-team relationship")
    if p.session_id and not one(
        """SELECT id FROM therapy_sessions WHERE id=%s
           AND ((therapist_id=%s AND client_id=%s) OR (therapist_id=%s AND client_id=%s))""",
        (p.session_id, user["id"], p.recipient_id, p.recipient_id, user["id"]),
    ):
        raise HTTPException(400, "Session does not belong to this care-team conversation")
    row = execute(
        """INSERT INTO chat_messages(conversation_type,sender_id,recipient_id,message_text,session_id)
           VALUES('therapist_chat',%s,%s,%s,%s) RETURNING *""",
        (user["id"],p.recipient_id,p.message_text,p.session_id),
    )
    return {"message": clean(row)}

@app.post("/api/support")
def support(p:SupportRequest,user=Depends(current_user)):
    r=execute("INSERT INTO notifications(user_id,title,message,notification_type,priority,metadata) VALUES(%s,%s,%s,'system_update','normal',%s) RETURNING *",(user["id"],"Support request" if p.category=="contact" else "Problem report",p.message,Jsonb({"category":p.category}))); return {"submitted":True,"record":clean(r)}

@app.get("/api/subscription")
def subscription(user=Depends(current_user)):
    if user["user_type"]!="client": return {"status":"not_required","plan":None,"features_locked":False}
    s=one("SELECT * FROM user_subscriptions WHERE user_id=%s",(user["id"],))
    if not s: execute("INSERT INTO user_subscriptions(user_id) VALUES(%s) ON CONFLICT(user_id) DO NOTHING",(user["id"],)); s=one("SELECT * FROM user_subscriptions WHERE user_id=%s",(user["id"],))
    if s and s["status"]=="trialing" and s["trial_ends_at"] and datetime.now(timezone.utc)>=s["trial_ends_at"]: s=execute("UPDATE user_subscriptions SET status='expired',updated_at=NOW() WHERE user_id=%s RETURNING *",(user["id"],))
    active=bool(s and s["status"] in ("trialing","active")); rem=None
    if s and s["status"]=="trialing": rem=max(0,(s["trial_ends_at"]-datetime.now(timezone.utc)).total_seconds())//86400
    return {"subscription":clean(s),"features_locked":not active,"trial_days_remaining":int(rem) if rem is not None else None}
@app.post("/api/subscription/upgrade")
def upgrade(p:SubscriptionUpgrade,user=Depends(current_user)):
    if user["user_type"]!="client": raise HTTPException(403,"Only client accounts can manage subscriptions")
    r=execute("UPDATE user_subscriptions SET plan=%s,status='active',subscription_started_at=NOW(),updated_at=NOW() WHERE user_id=%s RETURNING *",(p.plan,user["id"])); return {"activated":True,"plan":p.plan,"payment_required":False,"record":clean(r)}
@app.get("/api/therapist/earnings")
def earnings(user=Depends(current_user)):
    therapist(user); rows=many("SELECT * FROM therapist_earnings WHERE therapist_id=%s ORDER BY created_at DESC LIMIT 100",(user["id"],)); available=sum(float(r["amount"] or 0) for r in rows if r["status"]=="available" and r["earning_type"]!="withdrawal"); pending=sum(float(r["amount"] or 0) for r in rows if r["status"]=="pending" and r["earning_type"]!="withdrawal"); withdrawn=sum(float(r["amount"] or 0) for r in rows if r["earning_type"]=="withdrawal" and r["status"]=="paid_out"); perf=one("SELECT * FROM therapist_performance WHERE therapist_id=%s ORDER BY period_end DESC LIMIT 1",(user["id"],)); return {"available_balance":round(available,2),"pending_balance":round(pending,2),"total_earned":round(available+pending+withdrawn,2),"total_withdrawn":round(withdrawn,2),"performance":clean(perf),"transactions":[clean(r) for r in rows]}
@app.post("/api/therapist/earnings/recalculate")
def recalc(user=Depends(current_user)):
    therapist(user); sessions=many("SELECT id,client_id,total_cost FROM therapy_sessions WHERE therapist_id=%s AND status='completed' AND payment_status='paid'",(user["id"],)); existing={r["session_id"] for r in many("SELECT session_id FROM therapist_earnings WHERE therapist_id=%s AND earning_type='session_payment'",(user["id"],))}; inserted=0
    for s in sessions:
        if s["id"] in existing or float(s["total_cost"] or 0)<=0: continue
        execute("INSERT INTO therapist_earnings(therapist_id,client_id,session_id,amount,earning_type,status,description,available_at) VALUES(%s,%s,%s,%s,'session_payment','available','80% therapist share from completed paid session',NOW())",(user["id"],s["client_id"],s["id"],round(float(s["total_cost"])*.8,2))); inserted+=1
    return {"recalculated":True,"new_earnings":inserted}
@app.get("/api/therapist/performance")
def performance(user=Depends(current_user)): therapist(user); return {"performance_history":[clean(r) for r in many("SELECT * FROM therapist_performance WHERE therapist_id=%s ORDER BY period_end DESC LIMIT 12",(user["id"],))]}
@app.post("/api/crisis-check")
def crisis(payload:dict[str,Any]): return {"flagged":False,"level":"none"}
@app.post("/api/emotion-detection")
def emotion(payload:dict[str,Any]): return {"emotions":[],"confidence":0.0,"status":"not_configured"}

DIST=Path(__file__).resolve().parents[1]/"dist"
if (DIST/"assets").exists(): app.mount("/assets",StaticFiles(directory=DIST/"assets"),name="assets")
@app.get("/")
def root():
    if (DIST/"index.html").exists(): return FileResponse(DIST/"index.html")
    return {"service":"therafam","status":"ok"}
@app.get("/{path:path}")
def spa(path:str):
    if path.startswith("api/"): raise HTTPException(404,"Not found")
    f=DIST/path
    if f.is_file(): return FileResponse(f)
    if (DIST/"index.html").exists(): return FileResponse(DIST/"index.html")
    raise HTTPException(404,"Not found")
