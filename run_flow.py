import numpy as np
import os
import redis
from supabase import create_client
from openai import OpenAI
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple

# 🔑 Environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://owthpcipmzxflpmnqwkk.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93dGhwY2lwbXp4ZmxwbW5xd2trIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxMzE1ODQsImV4cCI6MjA3MTcwNzU4NH0.bV18YKUje3riKWkWRxadHQKAGLv7wVjW37VQ1IL1uy4")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "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")

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

# 🆘 Comprehensive crisis keywords for mental health
CRISIS_KEYWORDS = [
    # Suicide ideation
    "suicide", "kill myself", "end my life", "end it all", "better off dead",
    "no point living", "want to die", "wish I was dead", "take my own life",
    
    # Self-harm
    "self harm", "self-harm", "cutting", "hurt myself", "punish myself",
    "burning myself", "scratching", "hitting myself",
    
    # Overdose and methods
    "overdose", "pills", "too many pills", "drink bleach", "jump off",
    "hanging", "rope", "gun", "bridge", "train tracks",
    
    # Emotional crisis states
    "can't go on", "hopeless", "no way out", "trapped", "unbearable",
    "can't take it anymore", "giving up", "nothing matters",
    
    # Abuse and trauma
    "abuse", "sexual abuse", "physical abuse", "domestic violence",
    "rape", "assault", "being hurt", "unsafe at home",
    
    # Severe mental health episodes
    "panic attack", "can't breathe", "losing my mind", "going crazy",
    "voices", "hallucinations", "paranoid", "psychotic episode"
]

# 🧠 Therapeutic techniques and approaches
THERAPEUTIC_TECHNIQUES = {
    "anxiety": ["deep breathing", "grounding techniques", "progressive muscle relaxation", "mindfulness"],
    "depression": ["behavioral activation", "thought challenging", "self-compassion", "gratitude practice"],
    "trauma": ["grounding", "self-soothing", "safety planning", "body awareness"],
    "anger": ["anger log", "time-out technique", "assertiveness training", "emotion regulation"],
    "relationships": ["communication skills", "boundary setting", "conflict resolution", "empathy building"],
    "stress": ["stress management", "time management", "problem-solving", "relaxation techniques"]
}

def setup_logging():
    """Configure logging for the Therafam AI system"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('therafam_ai.log'),
            logging.StreamHandler()
        ]
    )
    return logging.getLogger('TherafamAI')

logger = setup_logging()

def is_crisis(user_input: str) -> Tuple[bool, List[str]]:
    """
    Enhanced crisis detection with specific keyword tracking
    Returns: (is_crisis_bool, list_of_detected_keywords)
    """
    user_lower = user_input.lower()
    detected_keywords = [keyword for keyword in CRISIS_KEYWORDS if keyword in user_lower]
    return len(detected_keywords) > 0, detected_keywords

def get_mood_context(user_id: str) -> Dict:
    """Retrieve user's recent mood data for context"""
    try:
        response = supabase.table("mood_tracking").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(5).execute()
        return {"recent_moods": response.data if response.data else []}
    except Exception as e:
        logger.error(f"Failed to fetch mood context: {e}")
        return {"recent_moods": []}

def get_therapy_notes(user_id: str) -> List[str]:
    """Retrieve relevant therapy notes and session history"""
    try:
        response = supabase.table("therapy_sessions").select("notes, insights").eq("user_id", user_id).limit(3).execute()
        if response.data:
            return [f"{row.get('notes', '')} {row.get('insights', '')}".strip() for row in response.data]
        return []
    except Exception as e:
        logger.error(f"Failed to fetch therapy notes: {e}")
        return []

def detect_emotional_state(user_input: str) -> List[str]:
    """Detect emotional indicators in user input"""
    emotion_keywords = {
        "anxiety": ["worried", "anxious", "nervous", "scared", "panic", "fear"],
        "depression": ["sad", "hopeless", "empty", "worthless", "tired", "exhausted"],
        "anger": ["angry", "furious", "frustrated", "mad", "rage", "irritated"],
        "stress": ["stressed", "overwhelmed", "pressure", "busy", "chaotic"],
        "loneliness": ["lonely", "alone", "isolated", "disconnected", "nobody"]
    }
    
    detected_emotions = []
    user_lower = user_input.lower()
    
    for emotion, keywords in emotion_keywords.items():
        if any(keyword in user_lower for keyword in keywords):
            detected_emotions.append(emotion)
    
    return detected_emotions

def generate_crisis_response(detected_keywords: List[str]) -> str:
    """Generate appropriate crisis response based on detected keywords"""
    
    # Immediate safety response with therapist connection offer
    safety_response = """🆘 **IMMEDIATE SUPPORT NEEDED** 🆘

I'm deeply concerned about what you've shared. You are not alone, and your life has value.

**🚨 CRISIS RESOURCES:**
• **US**: Call 988 (Suicide & Crisis Lifeline) - Available 24/7
• **Crisis Text Line**: Text HOME to 741741
• **Emergency**: Call 911 or go to your nearest emergency room

**🌟 REMEMBER:**
• This feeling is temporary, even though it doesn't feel that way
• You matter and your life has meaning
• Professional help is available right now
• Many people who felt this way found their situation improved

**💙 IMMEDIATE STEPS:**
1. Reach out to someone you trust RIGHT NOW
2. Remove any means of self-harm from your immediate area
3. Stay with someone or in a public place
4. Call one of the crisis numbers above

**🔗 THERAFAM PROFESSIONAL SUPPORT:**
Our licensed therapists are also available for immediate crisis support. Would you like to connect with one of our mental health professionals right now?

I'm here to support you, but please connect with emergency services or a crisis counselor immediately."""

    return safety_response

def should_suggest_therapist(emotions: List[str], user_input: str, interaction_count: int = 0) -> Dict[str, any]:
    """
    Determine if user should be offered therapist connection based on various factors
    Returns: {"suggest": bool, "urgency": str, "reason": str}
    """
    
    # High urgency triggers
    high_urgency_emotions = ['depression', 'anxiety', 'trauma']
    high_urgency_keywords = [
        'therapy', 'therapist', 'professional help', 'medication', 'severe',
        'getting worse', 'months', 'can\'t cope', 'need help'
    ]
    
    # Medium urgency triggers
    medium_urgency_emotions = ['stress', 'anger', 'loneliness']
    medium_urgency_keywords = [
        'overwhelmed', 'struggling', 'relationship problems', 'work stress',
        'family issues', 'sleep problems', 'concentration'
    ]
    
    user_lower = user_input.lower()
    
    # Check for direct requests for professional help
    if any(keyword in user_lower for keyword in ['therapist', 'therapy', 'professional help', 'counselor']):
        return {
            "suggest": True,
            "urgency": "high",
            "reason": "direct_request",
            "message": "I heard you mention wanting professional support. That's a wonderful step!"
        }
    
    # High urgency cases
    if (any(emotion in emotions for emotion in high_urgency_emotions) and 
        any(keyword in user_lower for keyword in high_urgency_keywords)):
        return {
            "suggest": True,
            "urgency": "high",
            "reason": "severe_symptoms",
            "message": "Based on what you've shared, a licensed therapist could provide specialized support for what you're experiencing."
        }
    
    # Medium urgency cases
    if (len(emotions) >= 2 or  # Multiple emotions detected
        any(emotion in emotions for emotion in high_urgency_emotions) or
        any(keyword in user_lower for keyword in medium_urgency_keywords)):
        return {
            "suggest": True,
            "urgency": "medium",
            "reason": "multiple_concerns",
            "message": "It sounds like you're dealing with several challenges. A therapist could help you develop personalized strategies."
        }
    
    # Long-term support suggestion (after multiple interactions)
    if interaction_count >= 5:
        return {
            "suggest": True,
            "urgency": "low",
            "reason": "continued_support",
            "message": "You've been actively working on your mental health, which is wonderful! A therapist could help take your progress even further."
        }
    
    return {"suggest": False, "urgency": "low", "reason": "not_indicated", "message": ""}

def build_therapeutic_prompt(user_input: str, context: str, emotions: List[str], mood_data: Dict) -> str:
    """Build a comprehensive therapeutic prompt for Therafam AI"""
    
    techniques = []
    for emotion in emotions:
        if emotion in THERAPEUTIC_TECHNIQUES:
            techniques.extend(THERAPEUTIC_TECHNIQUES[emotion])
    
    mood_context = ""
    if mood_data.get("recent_moods"):
        mood_context = f"\nRecent mood patterns: {json.dumps(mood_data['recent_moods'][:3])}"
    
    prompt = f"""You are the Therafam AI Therapist - a compassionate, evidence-based mental health companion designed to provide immediate emotional support and practical coping strategies.

**YOUR CORE IDENTITY:**
- Name: Therafam AI
- Approach: Warm, empathetic, non-judgmental, and solution-focused
- Expertise: CBT, DBT, mindfulness, trauma-informed care, and crisis intervention
- Tone: Caring but professional, hopeful, and empowering

**THERAFAM'S THERAPEUTIC FRAMEWORK:**
1. **Validate** the user's feelings and experiences
2. **Assess** emotional state and immediate needs
3. **Educate** about mental health concepts in accessible ways
4. **Provide** specific, actionable coping strategies
5. **Encourage** self-compassion and hope

**CONTEXT:**
Knowledge base context: {context}
Detected emotions: {', '.join(emotions) if emotions else 'Not specifically detected'}
{mood_context}

**RESPONSE GUIDELINES:**
- Start with validation and empathy
- Use the 🌱 emoji to introduce coping strategies
- Provide 2-3 specific, actionable techniques
- Include a gentle check-in question
- Keep responses warm but concise (200-300 words)
- Use mint/teal themed emojis: 🌱💚🌿💙✨
- End with encouragement and hope

**CRISIS PROTOCOL:**
If ANY crisis indicators are present, immediately provide safety resources and encourage professional help.

**SPECIALIZED TECHNIQUES TO CONSIDER:**
{', '.join(set(techniques)) if techniques else 'General emotional support techniques'}

User: {user_input}

Therafam AI:"""

    return prompt

def run_flow(user_input: str, user_id: str = "demo_user") -> str:
    """
    Enhanced Therafam AI therapeutic flow with comprehensive mental health support
    """
    logger.info(f"Processing user input for user {user_id}")
    
    try:
        # Step 1: Crisis detection with enhanced tracking
        is_crisis_situation, crisis_keywords = is_crisis(user_input)
        
        if is_crisis_situation:
            logger.warning(f"Crisis detected for user {user_id}: {crisis_keywords}")
            
            # Log crisis event to Supabase
            try:
                supabase.table("crisis_logs").insert({
                    "user_id": user_id,
                    "input_text": user_input[:500],  # Truncated for privacy
                    "detected_keywords": crisis_keywords,
                    "timestamp": datetime.utcnow().isoformat(),
                    "response_type": "crisis_intervention"
                }).execute()
            except Exception as e:
                logger.error(f"Failed to log crisis event: {e}")
            
            return generate_crisis_response(crisis_keywords)

        # Step 2: Emotional state detection
        detected_emotions = detect_emotional_state(user_input)
        logger.info(f"Detected emotions: {detected_emotions}")

        # Step 3: Embed input for context retrieval
        try:
            embedding = client.embeddings.create(
                input=user_input,
                model="text-embedding-3-small"
            ).data[0].embedding
            embedding_bytes = np.array(embedding, dtype=np.float32).tobytes()
        except Exception as e:
            logger.error(f"Failed to create embedding: {e}")
            embedding_bytes = None

        # Step 4: Query Redis for relevant therapeutic content
        context_docs = []
        if embedding_bytes:
            try:
                results = r.ft("idx:docs").search(
                    f"*=>[KNN 5 @embedding $vec_param]",
                    query_params={"vec_param": embedding_bytes}
                )
                context_docs = [res["content"] for res in results.docs] if results.docs else []
                logger.info(f"Retrieved {len(context_docs)} context documents from Redis")
            except Exception as e:
                logger.error(f"Redis query failed: {e}")

        # Step 5: Get user-specific context
        mood_data = get_mood_context(user_id)
        therapy_notes = get_therapy_notes(user_id)

        # Step 6: Build comprehensive context
        all_context = context_docs + therapy_notes
        context_text = "\n".join(all_context) if all_context else "No specific context available"

        # Step 7: Generate therapeutic response
        therapeutic_prompt = build_therapeutic_prompt(
            user_input, context_text, detected_emotions, mood_data
        )

        try:
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system", 
                        "content": "You are Therafam AI, a compassionate and evidence-based mental health support companion."
                    },
                    {"role": "user", "content": therapeutic_prompt}
                ],
                temperature=0.7,
                max_tokens=400
            )
            
            response = completion.choices[0].message.content
            
            # Step 8: Log interaction for learning and improvement
            try:
                supabase.table("ai_interactions").insert({
                    "user_id": user_id,
                    "input_text": user_input[:500],
                    "response_text": response[:1000],
                    "detected_emotions": detected_emotions,
                    "context_used": len(all_context),
                    "timestamp": datetime.utcnow().isoformat(),
                    "response_type": "therapeutic_support"
                }).execute()
            except Exception as e:
                logger.error(f"Failed to log interaction: {e}")
            
            # Step 9: Check if therapist connection should be suggested
            therapist_suggestion = should_suggest_therapist(detected_emotions, user_input, len(all_context))
            
            # Add therapist suggestion to response if appropriate
            if therapist_suggestion["suggest"] and not is_crisis_situation:
                therapist_prompt = f"\n\n💫 **{therapist_suggestion['message']}**\n\nWould you like to explore connecting with one of our licensed therapists? They can provide personalized treatment plans and deeper therapeutic work."
                response += therapist_prompt
            
            return response
            
        except Exception as e:
            logger.error(f"OpenAI API call failed: {e}")
            return """💙 I'm here to support you, though I'm experiencing some technical difficulties right now. 

🌱 **In the meantime, here are some quick coping strategies:**
• Take 5 deep breaths: Inhale for 4 counts, hold for 4, exhale for 6
• Name 5 things you can see, 4 you can touch, 3 you can hear
• Remind yourself: "This feeling will pass, and I am stronger than I think"

✨ Please try reaching out again, or consider connecting with one of our human therapists if you need immediate support."""

    except Exception as e:
        logger.error(f"Unexpected error in run_flow: {e}")
        return """💙 I apologize, but I'm experiencing technical difficulties. Your wellbeing matters to me.

🆘 **If this is urgent:**
• Call 988 (Suicide & Crisis Lifeline)
• Text HOME to 741741 (Crisis Text Line)
• Reach out to a trusted friend, family member, or healthcare provider

🌱 **For immediate self-care:**
• Focus on your breathing
• Drink some water
• Step outside or near a window
• Practice self-compassion

✨ Please try again when you're ready. I'm here to support you."""

def interactive_therafam_session():
    """Run an interactive Therafam AI therapy session with therapist connection options"""
    print("🌱💙 Welcome to Therafam AI - Your Compassionate Mental Health Companion 💙🌱")
    print("━" * 70)
    print("✨ I'm here to provide emotional support and evidence-based coping strategies")
    print("🆘 In crisis? Type 'crisis' for immediate resources")
    print("👩‍⚕️ Want to connect with a therapist? Type 'therapist'")
    print("💭 Type 'exit' when you're ready to end our session")
    print("━" * 70)
    print()

    session_count = 0
    while True:
        try:
            user_input = input("💬 You: ").strip()
            
            if user_input.lower() in ["exit", "quit", "goodbye"]:
                print("\n🌟 Thank you for trusting Therafam AI with your thoughts and feelings.")
                print("💙 Remember: You are resilient, worthy of care, and never alone.")
                print("✨ Take care of yourself, and don't hesitate to reach out again anytime.")
                break
            
            if user_input.lower() == "crisis":
                print(f"\n🆘 Therafam AI: {generate_crisis_response([])}")
                print("\n" + "─" * 50)
                print("🔗 THERAPIST CONNECTION OVERLAY TRIGGERED")
                print("   Trigger: Crisis Detection")
                print("   Urgency: HIGH")
                print("   In the app, an overlay would appear offering:")
                print("   • Immediate connection to crisis therapist")
                print("   • Emergency resources")
                print("   • Safety planning tools")
                print("─" * 50)
                continue
            
            if user_input.lower() == "therapist":
                print("\n👩‍⚕️ Therafam AI: I'd be happy to help you connect with one of our licensed therapists!")
                print("🔗 THERAPIST CONNECTION OVERLAY TRIGGERED")
                print("   Trigger: Manual Request")
                print("   Urgency: MEDIUM")
                print("   In the app, an overlay would appear offering:")
                print("   • Browse available therapists")
                print("   • Schedule consultation")
                print("   • Learn about therapy options")
                continue
            
            if not user_input:
                print("💙 I'm here when you're ready to share. Take your time.")
                continue
            
            session_count += 1
            print(f"\n🌱 Therafam AI: ", end="")
            
            response = run_flow(user_input, f"interactive_user_{session_count}")
            print(response)
            
            # Check if therapist should be suggested based on the response
            detected_emotions = detect_emotional_state(user_input)
            therapist_suggestion = should_suggest_therapist(detected_emotions, user_input, session_count)
            
            if therapist_suggestion["suggest"] and session_count % 3 == 0:  # Show every 3rd interaction to avoid spam
                print("\n" + "─" * 50)
                print("🔗 THERAPIST CONNECTION OVERLAY WOULD TRIGGER")
                print(f"   Trigger: AI Suggestion")
                print(f"   Urgency: {therapist_suggestion['urgency'].upper()}")
                print(f"   Reason: {therapist_suggestion['reason']}")
                print(f"   Message: {therapist_suggestion['message']}")
                print("   In the app, an overlay would appear with connection options.")
                print("─" * 50)
            
            print()
            
        except KeyboardInterrupt:
            print("\n\n🌟 Session ended. Take care of yourself! 💙")
            break
        except Exception as e:
            print(f"\n💙 I apologize for the technical difficulty. Let's try again: {e}")

if __name__ == "__main__":
    # Run interactive session
    interactive_therafam_session()
