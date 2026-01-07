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
# LAZY CLIENT FACTORIES (CRITICAL FOR RAILWAY / GUNICORN)
# ============================================================================

def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_redis():
    return redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        password=REDIS_PASSWORD,
        username="default",
        decode_responses=False,  # required for vectors + memory bytes
    )


def get_openai():
    return OpenAI(api_key=OPENAI_API_KEY)

# ============================================================================
# CRISIS + EMOTION LOGIC (PURE FUNCTIONS)
# ============================================================================

CRISIS_KEYWORDS = [
    "suicide", "kill myself", "end my life", "end it all",
    "want to die", "better off dead", "self harm", "cutting",
    "overdose", "hang myself", "jump off", "gun"
]


def is_crisis(user_input: str) -> Tuple[bool, List[str]]:
    text = user_input.lower()
    hits = [k for k in CRISIS_KEYWORDS if k in text]
    return bool(hits), hits


def detect_emotional_state(user_input: str) -> List[str]:
    text = user_input.lower()
    emotions = []

    if any(w in text for w in ["anxious", "panic", "fear"]):
        emotions.append("anxiety")
    if any(w in text for w in ["sad", "hopeless", "empty"]):
        emotions.append("depression")
    if any(w in text for w in ["angry", "furious", "rage"]):
        emotions.append("anger")

    return emotions

# ============================================================================
# CONTEXT HELPERS (SUPABASE)
# ============================================================================

def get_mood_context(user_id: str) -> Dict:
    try:
        supabase = get_supabase()
        res = (
            supabase.table("mood_tracking")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )
        return {"recent_moods": res.data or []}
    except Exception as e:
        logger.warning(f"Mood context failed: {e}")
        return {"recent_moods": []}


def get_therapy_notes(user_id: str) -> List[str]:
    try:
        supabase = get_supabase()
        res = (
            supabase.table("therapy_sessions")
            .select("notes, insights")
            .eq("user_id", user_id)
            .limit(3)
            .execute()
        )
        return [
            f"{row.get('notes', '')} {row.get('insights', '')}".strip()
            for row in (res.data or [])
        ]
    except Exception as e:
        logger.warning(f"Therapy notes failed: {e}")
        return []

# ============================================================================
# STEP A — CONVERSATION MEMORY (REDIS)
# ============================================================================

MEMORY_TTL_SECONDS = 60 * 60 * 24  # 24 hours
MAX_MEMORY_TURNS = 6  # user + AI pairs


def load_conversation_memory(user_id: str) -> List[str]:
    try:
        r = get_redis()
        key = f"memory:{user_id}"
        messages = r.lrange(key, 0, -1)
        return [m.decode("utf-8") for m in messages]
    except Exception as e:
        logger.warning(f"Memory load failed: {e}")
        return []


def save_conversation_turn(user_id: str, user_msg: str, ai_msg: str):
    try:
        r = get_redis()
        key = f"memory:{user_id}"

        r.rpush(key, f"User: {user_msg}")
        r.rpush(key, f"Therafam AI: {ai_msg}")

        # keep only last N turns
        r.ltrim(key, -MAX_MEMORY_TURNS * 2, -1)
        r.expire(key, MEMORY_TTL_SECONDS)
    except Exception as e:
        logger.warning(f"Memory save failed: {e}")

# ============================================================================
# AI HELPERS
# ============================================================================

def embed_text(text: str) -> bytes:
    client = get_openai()
    embedding = client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    ).data[0].embedding
    return np.array(embedding, dtype=np.float32).tobytes()


def search_redis_context(vector: bytes, k: int = 5) -> List[str]:
    try:
        r = get_redis()
        results = r.ft("idx:docs").search(
            f"*=>[KNN {k} @embedding $vec]",
            query_params={"vec": vector},
        )
        return [doc.content for doc in results.docs]
    except Exception as e:
        logger.warning(f"Redis search failed: {e}")
        return []

# ============================================================================
# CRISIS RESPONSE
# ============================================================================

def generate_crisis_response(_: List[str]) -> str:
    return (
        "🆘 **IMMEDIATE SUPPORT NEEDED**\n\n"
        "You are not alone, and your life matters.\n\n"
        "• **US**: Call or text **988** (Suicide & Crisis Lifeline)\n"
        "• **If in immediate danger**, call emergency services now\n\n"
        "If you can, reach out to someone you trust and stay connected.\n\n"
        "I care about your safety."
    )

# ============================================================================
# MAIN FLOW (PRODUCTION SAFE)
# ============================================================================

def run_flow(user_input: str, user_id: str = "anonymous") -> str:
    logger.info(f"run_flow invoked for user {user_id}")

    # 1. Crisis detection (hard stop)
    crisis, keywords = is_crisis(user_input)
    if crisis:
        try:
            supabase = get_supabase()
            supabase.table("crisis_logs").insert({
                "user_id": user_id,
                "input_text": user_input[:500],
                "detected_keywords": keywords,
                "timestamp": datetime.utcnow().isoformat(),
            }).execute()
        except Exception:
            pass

        return generate_crisis_response(keywords)

    # 2. Emotion detection
    emotions = detect_emotional_state(user_input)

    # 3. RAG embedding + search
    vector = embed_text(user_input)
    redis_context = search_redis_context(vector)
    therapy_notes = get_therapy_notes(user_id)

    # STEP A — load conversation memory
    conversation_memory = load_conversation_memory(user_id)

    # 4. Build structured context
    context_parts = []

    if conversation_memory:
        context_parts.append(
            "Recent conversation:\n" + "\n".join(conversation_memory)
        )

    if redis_context:
        context_parts.append(
            "Relevant therapeutic knowledge:\n" + "\n".join(redis_context)
        )

    if therapy_notes:
        context_parts.append(
            "Prior therapy notes:\n" + "\n".join(therapy_notes)
        )

    context = "\n\n".join(context_parts) or "No prior context."

    # 5. Prompt
    prompt = f"""
You are Therafam AI, a compassionate, ethical mental health assistant.

Guidelines:
- Be empathetic and non-judgmental
- Offer practical coping strategies when appropriate
- Never encourage harm
- If risk increases, encourage professional support

Context:
{context}

Detected emotions: {', '.join(emotions) if emotions else 'unspecified'}

User:
{user_input}
"""

    # 6. Completion
    client = get_openai()
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a supportive mental health AI."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
        max_tokens=400,
    )

    response = completion.choices[0].message.content.strip()

    # STEP A — persist memory
    save_conversation_turn(
        user_id=user_id,
        user_msg=user_input,
        ai_msg=response,
    )

    return response
