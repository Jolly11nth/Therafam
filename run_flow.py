import numpy as np
import os
import redis
from supabase import create_client
from openai import OpenAI

# 🔑 Environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://your-project.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "your-supabase-key")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "your-openai-key")

# ⚡ Initialize clients
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
r = redis.Redis(
    host="redis-11131.c44.us-east-1-2.ec2.redns.redis-cloud.com",
    port=11131,
    decode_responses=True,
    username="default",
    password="cM9M6XxqPhpC5Ypmst5LEtGLiEIzthXs",
)
client = OpenAI(api_key=OPENAI_API_KEY)

# 🆘 Crisis keywords
CRISIS_KEYWORDS = [
    "suicide", "kill myself", "end my life", "self harm", "cutting",
    "can't go on", "hopeless", "overdose", "panic attack", "abuse"
]

def is_crisis(user_input: str) -> bool:
    return any(word in user_input.lower() for word in CRISIS_KEYWORDS)

def run_flow(user_input: str):
    """
    Executes the flow:
    1. Crisis detection
    2. Embed input & query Redis
    3. Pull context from Supabase
    4. Build structured therapist response
    """
    # Step 1: Crisis handling
    if is_crisis(user_input):
        return (
            "⚠ It sounds like you may be in a crisis or facing very serious distress. "
            "You are not alone. Please consider reaching out immediately to a trusted person or professional. "
            "If you are located in the US, you can dial *988* for the Suicide & Crisis Lifeline. "
            "If outside the US, please look up your local emergency helpline number. "
            "You deserve care and support right now. 💙"
        )

    # Step 2: Embed input
    embedding = client.embeddings.create(
        input=user_input,
        model="text-embedding-3-small"
    ).data[0].embedding
    embedding_bytes = np.array(embedding, dtype=np.float32).tobytes()

    # Step 3: Query Redis for similar docs
    results = r.ft("idx:docs").search(
        f"*=>[KNN 3 @embedding $vec_param]",
        query_params={"vec_param": embedding_bytes}
    )
    context_docs = [res["content"] for res in results.docs] if results.docs else []

    if context_docs:
        print("\n📖 Redis retrieved context:")
        for i, doc in enumerate(context_docs, start=1):
            snippet = doc[:150].replace("\n", " ") + "..."
            print(f"   [{i}] {snippet}")

    # Step 4: Supabase notes
    supa_context = []
    try:
        resp = supabase.table("therapy_notes").select("*").limit(3).execute()
        if resp.data:
            supa_context = [row["note"] for row in resp.data]
    except Exception as e:
        print(f"⚠ Supabase fetch failed: {e}")

    # Step 5: Build final prompt
    context = "\n".join(context_docs + supa_context)
    prompt = f"""You are *Therafam*, a supportive AI therapist.
Your goals:
- Provide evidence-based, step-by-step coping strategies (CBT, grounding, journaling).
- If user shows signs of crisis, respond with safety + helpline info (no medical advice).
- Be empathetic, non-judgmental, and validating.
- Always ground advice in the provided context when possible.

Context from knowledge base:
{context}

User: {user_input}
Therafam:"""

    # Step 6: Generate response
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are Therafam, an empathetic AI therapist."},
            {"role": "user", "content": prompt}
        ]
    )

    return completion.choices[0].message.content

# 🚀 Run interactive loop
print("✅ Therafam RAG flow is running with crisis-handling enabled")
print("💬 Type your message (or 'exit' to quit):\n")

while True:
    user_input = input("You: ")
    if user_input.lower() in ["exit", "quit"]:
        print("👋 Exiting Therafam. Take care!")
        break

    response = run_flow(user_input)
    print(f"\nTherafam: {response}\n")