import os
import json
import numpy as np
import redis
import logging
from datetime import datetime
from typing import Dict, List, Tuple

from supabase import create_client
from openai import OpenAI

# ============================================================================
# LOGGING
# ============================================================================

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TherafamAI")

# ============================================================================
# ENVIRONMENT VARIABLES
# ============================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

REDIS_HOST = os.getenv("REDIS_HOST")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")

# ============================================================================
# CLIENT FACTORIES
# ============================================================================

def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def get_redis():
    return redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        password=REDIS_PASSWORD,
        username="default",
        decode_responses=False,
    )

def get_openai():
    return OpenAI(api_key=OPENAI_API_KEY)

# ============================================================================
# RATE LIMITING (ABUSE PROTECTION)
# ============================================================================

def rate_limit(user_id: str, limit: int = 30) -> bool:
    try:
        r = get_redis()
        key = f"rate:{user_id}"
        count = r.incr(key)
        r.expire(key, 60)
        return count <= limit
    except Exception:
        return True  # fail open to avoid blocking crisis

# ============================================================================
# CRISIS + EMOTION LOGIC
# ============================================================================

CRISIS_KEYWORDS = [
    "suicide", "kill myself", "end my life", "end it all",
    "want to die", "better off dead", "self harm", "cutting",
    "overdose", "hang myself", "jump off", "gun"
]

PASSIVE_IDEATION = [
    "tired of everything", "wish i could disappear",
    "no reason to live", "can't go on"
]

ESCALATION_KEYWORDS = [
    "can't cope", "getting worse", "out of control",
    "nothing helps", "breaking down", "losing it"
]

THERAPIST_KEYWORDS = [
    "therapist", "therapy", "professional help",
    "counselor", "mental health professional"
]

def is_crisis(user_input: str) -> Tuple[bool, List[str]]:
    text = user_input.lower()
    hits = [k for k in CRISIS_KEYWORDS if k in text]
    passive = [k for k in PASSIVE_IDEATION if k in text]
    return bool(hits or passive), hits + passive

def detect_emotional_state(user_input: str) -> List[str]:
    text = user_input.lower()
    emotions = []

    if any(w in text for w in ["anxious", "panic", "fear"]):
        emotions.append("anxiety")
    if any(w in text for w in ["sad", "hopeless", "empty"]):
        emotions.append("depression")
    if any(w in text for w in ["angry", "rage", "furious"]):
        emotions.append("anger")

    return emotions

# ============================================================================
# MEMORY + ESCALATION (REDIS)
# ============================================================================

MEMORY_TTL_SECONDS = 86400
MAX_MEMORY_TURNS = 6

def load_conversation_memory(user_id: str) -> List[str]:
    try:
        r = get_redis()
        msgs = r.lrange(f"memory:{user_id}", -MAX_MEMORY_TURNS * 2, -1)
        return [m.decode() for m in msgs]
    except Exception:
        return []

def save_conversation_turn(user_id: str, user_msg: str, ai_msg: str):
    try:
        r = get_redis()
        key = f"memory:{user_id}"
        r.rpush(key, f"User: {user_msg}")
        r.rpush(key, f"Therafam AI: {ai_msg}")
        r.ltrim(key, -MAX_MEMORY_TURNS * 2, -1)
        r.expire(key, MEMORY_TTL_SECONDS)
    except Exception:
        pass

def increment_escalation(user_id: str) -> int:
    try:
        r = get_redis()
        key = f"escalation:{user_id}"
        score = r.incr(key)
        r.expire(key, MEMORY_TTL_SECONDS)
        return score
    except Exception:
        return 0

# ============================================================================
# CRISIS RESPONSE
# ============================================================================

def generate_crisis_response() -> str:
    return (
        "🆘 **IMMEDIATE SUPPORT NEEDED**\n\n"
        "I’m really concerned about you. You deserve help and safety.\n\n"
        "• **US**: Call or text **988** (24/7)\n"
        "• If you’re in danger, contact emergency services now\n\n"
        "Please reach out to someone you trust and stay with others if you can."
    )

# ============================================================================
# MAIN FLOW
# ============================================================================

def run_flow(user_input: str, user_id: str = "anonymous") -> str:
    logger.info(f"run_flow invoked for {user_id}")

    # Rate limit (non-crisis only)
    if not rate_limit(user_id):
        return "💙 Let’s slow things down a bit so I can support you properly."

    # Crisis detection
    crisis, keywords = is_crisis(user_input)
    if crisis:
        increment_escalation(user_id)
        try:
            get_supabase().table("crisis_logs").insert({
                "user_id": user_id,
                "input_text": user_input[:500],
                "keywords": keywords,
                "timestamp": datetime.utcnow().isoformat(),
            }).execute()
        except Exception:
            pass
        return generate_crisis_response()

    # Escalation logic
    escalation = 0
    if any(k in user_input.lower() for k in ESCALATION_KEYWORDS):
        escalation = increment_escalation(user_id)

    emotions = detect_emotional_state(user_input)

    therapist_requested = any(k in user_input.lower() for k in THERAPIST_KEYWORDS)
    suggest_therapist = therapist_requested or escalation >= 3

    # Context assembly
    memory = load_conversation_memory(user_id)
    vector = get_openai().embeddings.create(
        model="text-embedding-3-small",
        input=user_input,
    ).data[0].embedding

    context = "\n".join(memory) if memory else "No prior context."

    prompt = f"""
You are Therafam AI, a compassionate and ethical mental health assistant.

Rules:
- Be empathetic and grounded
- Never normalize self-harm
- Encourage professional help when distress escalates

Context:
{context}

Detected emotions: {', '.join(emotions) or 'unspecified'}
Escalation level: {escalation}

User:
{user_input}
"""

    completion = get_openai().chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a supportive mental health AI."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
        max_tokens=400,
    )

    response = completion.choices[0].message.content.strip()

    if suggest_therapist:
        response += (
            "\n\n💙 **Additional support**\n"
            "Would you like help connecting with a licensed therapist?"
        )

    save_conversation_turn(user_id, user_input, response)
    return response
