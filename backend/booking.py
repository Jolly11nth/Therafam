from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .auth import current_user
from .db import execute, many, one

router = APIRouter()


class BookingCreate(BaseModel):
    therapist_id: str
    scheduled_start_time: datetime
    scheduled_end_time: datetime
    session_type: str = Field(default="individual", pattern="^(individual|group|consultation)$")
    session_format: str = Field(default="video", pattern="^(video|audio|in_person|chat)$")
    session_goals: list[str] = Field(default_factory=list, max_length=10)


@router.get("/api/therapists/{therapist_id}/availability")
def therapist_availability(therapist_id: str, user=Depends(current_user)):
    therapist = one("""SELECT tp.user_id,tp.first_name,tp.last_name,tp.timezone,tp.is_accepting_clients
                       FROM therapist_profiles tp JOIN users u ON u.id=tp.user_id
                       WHERE tp.user_id=%s AND u.user_type='therapist' AND u.is_active=TRUE""", (therapist_id,))
    if not therapist:
        raise HTTPException(404, "Therapist not found")
    slots = many("""SELECT id,day_of_week,start_time,end_time,is_available
                  FROM therapist_availability WHERE therapist_id=%s AND is_available=TRUE
                  ORDER BY day_of_week,start_time""", (therapist_id,))
    return {"therapist": {k: (str(v) if k == 'user_id' else v) for k,v in therapist.items()}, "slots": slots}


@router.get("/api/my/bookings")
def my_bookings(user=Depends(current_user)):
    rows = many("""SELECT ts.*, tp.first_name AS therapist_first_name,tp.last_name AS therapist_last_name,
                        tp.specializations,tp.rating,tp.profile_picture_url
                 FROM therapy_sessions ts JOIN therapist_profiles tp ON tp.user_id=ts.therapist_id
                 WHERE ts.client_id=%s ORDER BY ts.scheduled_start_time DESC""", (user["id"],))
    return {"bookings": rows}


@router.post("/api/bookings")
def create_booking(payload: BookingCreate, user=Depends(current_user)):
    if user["user_type"] != "client":
        raise HTTPException(403, "Only client accounts can book therapists")
    therapist = one("""SELECT tp.user_id,tp.is_accepting_clients,tp.timezone FROM therapist_profiles tp
                       JOIN users u ON u.id=tp.user_id
                       WHERE tp.user_id=%s AND u.user_type='therapist' AND u.is_active=TRUE
                         AND tp.is_verified=TRUE AND tp.is_accepting_clients=TRUE""", (payload.therapist_id,))
    if not therapist:
        raise HTTPException(404, "Therapist is not currently accepting clients")
    if payload.scheduled_start_time.tzinfo is None or payload.scheduled_end_time.tzinfo is None:
        raise HTTPException(400, "Booking times must include a timezone")
    if payload.scheduled_start_time <= datetime.now(payload.scheduled_start_time.tzinfo):
        raise HTTPException(400, "Choose a future session time")
    if payload.scheduled_end_time <= payload.scheduled_start_time:
        raise HTTPException(400, "Session end time must be after start time")
    duration_minutes = (payload.scheduled_end_time - payload.scheduled_start_time).total_seconds() / 60
    if duration_minutes < 30 or duration_minutes > 180:
        raise HTTPException(400, "Sessions must be between 30 and 180 minutes")
    tz_name = therapist.get("timezone") or "UTC"
    try:
        local_start = payload.scheduled_start_time.astimezone(ZoneInfo(tz_name))
        local_end = payload.scheduled_end_time.astimezone(ZoneInfo(tz_name))
    except Exception:
        local_start = payload.scheduled_start_time.astimezone(ZoneInfo("UTC"))
        local_end = payload.scheduled_end_time.astimezone(ZoneInfo("UTC"))
    if local_start.date() != local_end.date():
        raise HTTPException(400, "A session must start and end on the same day")
    day = (local_start.weekday() + 1) % 7
    slot = one("""SELECT id FROM therapist_availability
                 WHERE therapist_id=%s AND day_of_week=%s AND is_available=TRUE
                   AND start_time <= %s::time AND end_time >= %s::time LIMIT 1""",
               (payload.therapist_id, day, local_start.time(), local_end.time()))
    if not slot:
        raise HTTPException(409, "That time is outside the therapist's available hours")
    overlap = one("""SELECT id FROM therapy_sessions
                     WHERE therapist_id=%s AND status IN ('scheduled','in_progress')
                       AND scheduled_start_time < %s AND scheduled_end_time > %s LIMIT 1""",
                  (payload.therapist_id, payload.scheduled_end_time, payload.scheduled_start_time))
    if overlap:
        raise HTTPException(409, "That time is no longer available")
    relationship = one("""SELECT id FROM therapist_client_relationships
                        WHERE therapist_id=%s AND client_id=%s AND status='active'""", (payload.therapist_id, user["id"]))
    if not relationship:
        execute("""INSERT INTO therapist_client_relationships(therapist_id,client_id,status)
                   VALUES(%s,%s,'active') RETURNING id""", (payload.therapist_id,user["id"]))
    session = execute("""INSERT INTO therapy_sessions
        (therapist_id,client_id,scheduled_start_time,scheduled_end_time,session_type,session_format,session_goals,status)
        VALUES(%s,%s,%s,%s,%s,%s,%s,'scheduled') RETURNING *""",
        (payload.therapist_id,user["id"],payload.scheduled_start_time,payload.scheduled_end_time,
         payload.session_type,payload.session_format,payload.session_goals))
    return {"booking": session, "confirmed": True}
