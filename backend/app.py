from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .auth import current_user, hash_password, issue_session, verify_password
from .db import execute, many, one

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
class SubscriptionUpgrade(BaseModel): plan: Literal["premium_monthly", "premium_annual"] = "premium_monthly"

def clean(row: dict[str, Any] | None):
    if row is None: return None
    return {k: (str(v) if k in {"id","user_id","therapist_id","client_id","session_id","program_id"} and v is not None else v) for k,v in row.items()}
def therapist(user):
    if user.get("user_type") != "therapist": raise HTTPException(403, "Therapist access required")
    return user

def public_user(user):
    return {k: (str(user[k]) if k == "id" else user[k]) for k in ("id","email","user_type","is_verified","is_active")}

@app.get("/api/health")
def health():
    try: one("SELECT 1 AS ok"); db=True
    except Exception: db=False
    return {"status":"ok","service":"therafam-api","database_configured":db}

@app.post("/api/auth/signup")
def signup(p: SignupRequest):
    email=p.email.strip().lower()
    if one("SELECT id FROM users WHERE lower(email)=%s",(email,)): raise HTTPException(409,"An account with this email already exists")
    u=execute("INSERT INTO users(email,password_hash,user_type,is_verified,is_active) VALUES(%s,%s,%s,FALSE,TRUE) RETURNING id,email,user_type,is_verified,is_active",(email,hash_password(p.password),p.user_type))
    uid=str(u["id"])
    if p.user_type=="therapist":
        execute("INSERT INTO therapist_profiles(user_id,first_name,last_name,license_number,specializations,years_experience,bio,phone_number) VALUES(%s,%s,%s,%s,%s,%s,%s,%s)",(uid,p.first_name,p.last_name,p.license_number,[p.specialization] if p.specialization else [],p.years_experience,p.professional_bio,p.phone_number))
    else: execute("INSERT INTO user_profiles(user_id,first_name,last_name,phone_number) VALUES(%s,%s,%s,%s)",(uid,p.first_name,p.last_name,p.phone_number))
    return {"user":public_user(u),"token":issue_session(uid)}

@app.post("/api/auth/signin")
def signin(p: AuthRequest):
    u=one("SELECT id,email,password_hash,user_type,is_verified,is_active FROM users WHERE lower(email)=%s",(p.email.strip().lower(),))
    if not u or not u["is_active"] or not verify_password(p.password,u["password_hash"]): raise HTTPException(401,"Invalid email or password")
    execute("UPDATE users SET last_login_at=NOW(),updated_at=NOW() WHERE id=%s",(u["id"],))
    return {"user":public_user(u),"token":issue_session(str(u["id"]))}

@app.post("/api/auth/signout")
def signout(user=Depends(current_user)): return {"signed_out":True,"user_id":str(user["id"])}
@app.get("/api/me")
def me(user=Depends(current_user)): return {"user":public_user(user)}

@app.post("/api/chat")
def chat(p: ChatRequest,user=Depends(current_user)):
    key=os.getenv("OPENAI_API_KEY")
    if not key or OpenAI is None: return {"response":"The Therafam AI service is currently in demo mode. Your message was received, but a live AI provider is not configured yet.","demo":True}
    messages=[{"role":"system","content":"You are Therafam AI, a supportive mental-wellness assistant. Be calm, empathetic, concise, and age-appropriate. Do not diagnose or pretend to be a clinician. Encourage trusted human support when appropriate."}]
    messages += [{"role":x.role,"content":x.content} for x in p.history[-20:]] + [{"role":"user","content":p.message}]
    try: text=OpenAI(api_key=key).chat.completions.create(model=os.getenv("OPENAI_CHAT_MODEL","gpt-4o-mini"),messages=messages,temperature=.4,max_tokens=500).choices[0].message.content or "I’m here to listen. Could you tell me a little more?"
    except Exception as e: raise HTTPException(502,"AI service is temporarily unavailable") from e
    try: execute("INSERT INTO ai_interactions(user_id,input_text,response_text,emotions,escalation_level) VALUES(%s,%s,%s,%s,%s)",(user["id"],p.message,text,[],0))
    except Exception: pass
    return {"response":text,"demo":False}

@app.get("/api/programs")
def programs(user=Depends(current_user)):
    return {"programs":[clean(r) for r in many("SELECT id,title,description,category,difficulty_level,estimated_duration_days,thumbnail_url,tags,total_lessons FROM self_help_programs WHERE is_published=TRUE ORDER BY created_at ASC")]}
@app.get("/api/programs/{program_id}/lessons")
def lessons(program_id,user=Depends(current_user)):
    return {"lessons":[clean(r) for r in many("SELECT id,program_id,title,description,lesson_number,content_type,content_text,duration_minutes,learning_objectives,key_concepts,exercises FROM lessons WHERE program_id=%s AND is_published=TRUE ORDER BY lesson_number ASC",(program_id,))]}
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
    therapist(user); d=p.model_dump(); r=execute("""INSERT INTO therapist_profiles(user_id,first_name,last_name,license_number,license_state,specializations,years_experience,bio,phone_number,timezone,languages_spoken) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(user_id) DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,license_number=EXCLUDED.license_number,license_state=EXCLUDED.license_state,specializations=EXCLUDED.specializations,years_experience=EXCLUDED.years_experience,bio=EXCLUDED.bio,phone_number=EXCLUDED.phone_number,timezone=EXCLUDED.timezone,languages_spoken=EXCLUDED.languages_spoken,updated_at=NOW() RETURNING *""",(user["id"],d["first_name"],d["last_name"],d["license_number"],d["license_state"],d["specializations"],d["years_experience"],d["bio"],d["phone_number"],d["timezone"],d["languages_spoken"]))
    return {"profile":clean(r)}
@app.put("/api/therapist/availability")
def availability(p:AvailabilityUpdate,user=Depends(current_user)):
    therapist(user); r=execute("UPDATE therapist_profiles SET is_accepting_clients=%s,updated_at=NOW() WHERE user_id=%s RETURNING *",(p.is_accepting_clients,user["id"]))
    if not r: r=execute("INSERT INTO therapist_profiles(user_id,is_accepting_clients) VALUES(%s,%s) RETURNING *",(user["id"],p.is_accepting_clients))
    return {"is_accepting_clients":p.is_accepting_clients,"profile":clean(r)}
@app.get("/api/therapist/clients")
def clients(user=Depends(current_user)): therapist(user); return {"clients":[clean(r) for r in many("SELECT * FROM therapist_client_relationships WHERE therapist_id=%s ORDER BY created_at DESC",(user["id"],))]}
@app.get("/api/therapist/sessions")
def sessions(user=Depends(current_user)): therapist(user); return {"sessions":[clean(r) for r in many("SELECT * FROM therapy_sessions WHERE therapist_id=%s ORDER BY scheduled_start_time ASC",(user["id"],))]}
@app.post("/api/therapist/sessions")
def create_session(p:SessionCreate,user=Depends(current_user)):
    therapist(user); r=execute("INSERT INTO therapy_sessions(therapist_id,client_id,scheduled_start_time,scheduled_end_time,session_type,session_format) VALUES(%s,%s,%s,%s,%s,%s) RETURNING *",(user["id"],p.client_id,p.scheduled_start_time,p.scheduled_end_time,p.session_type,p.session_format)); return {"session":clean(r)}
@app.patch("/api/therapist/sessions/{session_id}")
def session_status(session_id:str,p:SessionStatusUpdate,user=Depends(current_user)):
    therapist(user); r=execute("UPDATE therapy_sessions SET status=%s WHERE id=%s AND therapist_id=%s RETURNING *",(p.status,session_id,user["id"]));
    if not r: raise HTTPException(404,"Session not found")
    return {"session":clean(r)}
@app.get("/api/therapist/notes")
def notes(user=Depends(current_user)): therapist(user); return {"notes":[clean(r) for r in many("SELECT * FROM therapy_session_notes WHERE therapist_id=%s ORDER BY created_at DESC",(user["id"],))]}
@app.get("/api/therapist/messages")
def therapist_messages(user=Depends(current_user)): therapist(user); return {"messages":[clean(r) for r in many("SELECT * FROM chat_messages WHERE conversation_type='therapist_chat' AND (sender_id=%s OR recipient_id=%s) ORDER BY created_at ASC LIMIT 200",(user["id"],user["id"]))]}
@app.post("/api/messages")
def messages(p:MessageCreate,user=Depends(current_user)):
    if not one("SELECT id FROM users WHERE id=%s AND is_active=TRUE",(p.recipient_id,)): raise HTTPException(404,"Recipient not found")
    r=execute("INSERT INTO chat_messages(conversation_type,sender_id,recipient_id,message_text,session_id) VALUES('therapist_chat',%s,%s,%s,%s) RETURNING *",(user["id"],p.recipient_id,p.message_text,p.session_id)); return {"message":clean(r)}
@app.post("/api/support")
def support(p:SupportRequest,user=Depends(current_user)):
    r=execute("INSERT INTO notifications(user_id,title,message,notification_type,priority,metadata) VALUES(%s,%s,%s,'system_update','normal',%s) RETURNING *",(user["id"],"Support request" if p.category=="contact" else "Problem report",p.message,{"category":p.category})); return {"submitted":True,"record":clean(r)}

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
    therapist(user); sessions=many("SELECT id,client_id,total_cost FROM therapy_sessions WHERE therapist_id=%s AND status='completed' AND payment_status='paid'",(user["id"],)); existing={r["session_id"] for r in many("SELECT session_id FROM therapist_earnings WHERE therapist_id=%s AND earning_type='session_payment'",(user["id"],)); inserted=0
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
