from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .auth import current_user
from .db import execute, many, one

router = APIRouter()


class TherapistReviewCreate(BaseModel):
    therapist_id: str
    rating: int = Field(ge=1, le=5)
    review_title: str | None = Field(default=None, max_length=120)
    review_text: str = Field(min_length=10, max_length=2000)


def clean(row):
    if row is None:
        return None
    return {k: (str(v) if k in {"id", "user_id", "therapist_id", "client_id"} and v is not None else v) for k, v in row.items()}


@router.get("/api/therapists")
def available_therapists(user=Depends(current_user)):
    rows = many("""SELECT tp.user_id,tp.first_name,tp.last_name,tp.license_state,tp.specializations,
                        tp.degrees,tp.certifications,tp.years_experience,tp.bio,tp.profile_picture_url,
                        tp.languages_spoken,tp.treatment_approaches,tp.age_groups_served,tp.rating,
                        tp.total_reviews,tp.total_sessions,tp.is_verified,tp.is_accepting_clients,
                        COALESCE((SELECT COUNT(*) FROM therapy_sessions ts
                                  WHERE ts.therapist_id=tp.user_id AND ts.status='completed'),0) AS completed_sessions
                 FROM therapist_profiles tp
                 JOIN users u ON u.id=tp.user_id
                 WHERE u.user_type='therapist' AND u.is_active=TRUE
                   AND tp.is_verified=TRUE AND tp.is_accepting_clients=TRUE
                 ORDER BY tp.rating DESC, tp.total_reviews DESC,
                          completed_sessions DESC, tp.years_experience DESC NULLS LAST""")
    return {"therapists": [clean(r) for r in rows]}


@router.get("/api/therapists/{therapist_id}/reviews")
def therapist_reviews(therapist_id: str, user=Depends(current_user)):
    if not one("SELECT id FROM users WHERE id=%s AND user_type='therapist' AND is_active=TRUE", (therapist_id,)):
        raise HTTPException(404, "Therapist not found")
    rows = many("""SELECT id,rating,review_title,review_text,created_at
                  FROM therapist_reviews
                  WHERE therapist_id=%s AND is_published=TRUE
                  ORDER BY created_at DESC LIMIT 50""", (therapist_id,))
    return {"reviews": [clean(r) for r in rows]}


@router.get("/api/therapists/{therapist_id}/review-status")
def therapist_review_status(therapist_id: str, user=Depends(current_user)):
    if user["user_type"] != "client":
        raise HTTPException(403, "Only clients can review therapists")
    if not one("SELECT id FROM users WHERE id=%s AND user_type='therapist'", (therapist_id,)):
        raise HTTPException(404, "Therapist not found")
    completed = one("""SELECT COUNT(*) AS count FROM therapy_sessions
                      WHERE therapist_id=%s AND client_id=%s AND status='completed'""", (therapist_id, user["id"]))
    existing = one("SELECT id FROM therapist_reviews WHERE therapist_id=%s AND client_id=%s", (therapist_id, user["id"]))
    count = int(completed["count"] if completed else 0)
    return {"completed_sessions": count, "required_sessions": 3, "eligible": count >= 3 and not existing, "already_reviewed": bool(existing)}


@router.post("/api/therapists/reviews")
def create_therapist_review(payload: TherapistReviewCreate, user=Depends(current_user)):
    if user["user_type"] != "client":
        raise HTTPException(403, "Only clients can review therapists")
    if not one("SELECT id FROM users WHERE id=%s AND user_type='therapist' AND is_active=TRUE", (payload.therapist_id,)):
        raise HTTPException(404, "Therapist not found")
    completed = one("""SELECT COUNT(*) AS count FROM therapy_sessions
                      WHERE therapist_id=%s AND client_id=%s AND status='completed'""", (payload.therapist_id, user["id"]))
    if int(completed["count"] if completed else 0) < 3:
        raise HTTPException(403, "You can leave a review after three completed sessions with this therapist")
    if one("SELECT id FROM therapist_reviews WHERE therapist_id=%s AND client_id=%s", (payload.therapist_id, user["id"])):
        raise HTTPException(409, "You have already reviewed this therapist")
    review = execute("""INSERT INTO therapist_reviews(therapist_id,client_id,rating,review_title,review_text)
                        VALUES(%s,%s,%s,%s,%s)
                        RETURNING id,rating,review_title,review_text,created_at""",
                     (payload.therapist_id, user["id"], payload.rating, payload.review_title, payload.review_text.strip()))
    execute("""UPDATE therapist_profiles
               SET rating=COALESCE((SELECT ROUND(AVG(rating)::numeric,2) FROM therapist_reviews
                                    WHERE therapist_id=%s AND is_published=TRUE),0),
                   total_reviews=(SELECT COUNT(*) FROM therapist_reviews
                                  WHERE therapist_id=%s AND is_published=TRUE),
                   updated_at=NOW()
               WHERE user_id=%s""", (payload.therapist_id, payload.therapist_id, payload.therapist_id))
    return {"review": clean(review), "submitted": True}
