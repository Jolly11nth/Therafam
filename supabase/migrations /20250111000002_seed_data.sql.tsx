-- =============================================================================
-- THERAFAM - SEED DATA FOR DEVELOPMENT
-- =============================================================================
-- Migration: 20250111000002_seed_data
-- Description: Populates database with sample data for testing and development
-- =============================================================================

-- =============================================================================
-- SEED SELF-HELP PROGRAMS
-- =============================================================================

INSERT INTO self_help_programs (id, title, description, category, difficulty_level, estimated_duration_days, tags, learning_objectives, is_published) VALUES
(
    '11111111-1111-1111-1111-111111111111',
    'Understanding Anxiety',
    'Learn practical techniques to manage anxiety and reduce stress in your daily life.',
    'anxiety',
    'beginner',
    14,
    ARRAY['anxiety', 'stress-management', 'breathing-exercises', 'mindfulness'],
    ARRAY['Recognize anxiety triggers', 'Practice grounding techniques', 'Develop coping strategies'],
    true
),
(
    '22222222-2222-2222-2222-222222222222',
    'Building Resilience',
    'Develop mental strength and emotional resilience to handle life''s challenges.',
    'stress',
    'intermediate',
    21,
    ARRAY['resilience', 'emotional-strength', 'coping-skills'],
    ARRAY['Build emotional resilience', 'Develop problem-solving skills', 'Practice self-compassion'],
    true
),
(
    '33333333-3333-3333-3333-333333333333',
    'Overcoming Depression',
    'Evidence-based strategies to manage depression symptoms and improve mood.',
    'depression',
    'intermediate',
    28,
    ARRAY['depression', 'mood-improvement', 'behavioral-activation'],
    ARRAY['Understand depression patterns', 'Increase positive activities', 'Challenge negative thoughts'],
    true
);

-- =============================================================================
-- SEED LESSONS
-- =============================================================================

-- Lessons for "Understanding Anxiety" program
INSERT INTO lessons (program_id, title, description, lesson_number, content_type, content_text, duration_minutes, learning_objectives, key_concepts, exercises, is_published) VALUES
(
    '11111111-1111-1111-1111-111111111111',
    'What is Anxiety?',
    'Introduction to anxiety and how it affects your mind and body',
    1,
    'text',
    'Anxiety is a natural response to stress. In this lesson, we''ll explore what anxiety is, how it manifests in your body, and why understanding it is the first step to managing it effectively.',
    15,
    ARRAY['Define anxiety', 'Identify physical symptoms', 'Understand the anxiety cycle'],
    ARRAY['Fight-or-flight response', 'Physical symptoms', 'Emotional responses', 'Thought patterns'],
    ARRAY['Anxiety symptoms journal', 'Body scan meditation'],
    true
),
(
    '11111111-1111-1111-1111-111111111111',
    'Breathing Techniques',
    'Learn and practice evidence-based breathing exercises',
    2,
    'interactive',
    'Deep breathing is one of the most effective tools for managing anxiety. We''ll practice several breathing techniques including box breathing, 4-7-8 breathing, and diaphragmatic breathing.',
    20,
    ARRAY['Master box breathing', 'Practice 4-7-8 technique', 'Use breathing in daily life'],
    ARRAY['Box breathing', '4-7-8 breathing', 'Diaphragmatic breathing', 'Breath awareness'],
    ARRAY['5-minute box breathing practice', 'Morning breathing routine', 'Emergency anxiety breathing'],
    true
),
(
    '11111111-1111-1111-1111-111111111111',
    'Grounding Techniques',
    'Use your senses to stay present during anxious moments',
    3,
    'text',
    'Grounding techniques help you stay connected to the present moment when anxiety tries to pull you into worried thoughts about the future. The 5-4-3-2-1 technique is particularly powerful.',
    15,
    ARRAY['Practice 5-4-3-2-1 technique', 'Use sensory grounding', 'Apply grounding in real situations'],
    ARRAY['5-4-3-2-1 method', 'Sensory awareness', 'Present moment focus', 'Distraction techniques'],
    ARRAY['5-4-3-2-1 practice', 'Create a grounding kit', 'Daily grounding routine'],
    true
);

-- Lessons for "Building Resilience" program
INSERT INTO lessons (program_id, title, description, lesson_number, content_type, content_text, duration_minutes, learning_objectives, key_concepts, exercises, is_published) VALUES
(
    '22222222-2222-2222-2222-222222222222',
    'Understanding Resilience',
    'What resilience is and why it matters',
    1,
    'text',
    'Resilience is your ability to bounce back from adversity. It''s not about avoiding stress, but about developing the mental and emotional tools to navigate challenges effectively.',
    20,
    ARRAY['Define resilience', 'Identify your current resilience level', 'Recognize resilience role models'],
    ARRAY['Resilience definition', 'Growth mindset', 'Adaptability', 'Recovery patterns'],
    ARRAY['Resilience self-assessment', 'Identify past resilient moments', 'Define resilience goals'],
    true
),
(
    '22222222-2222-2222-2222-222222222222',
    'Building Your Support Network',
    'Creating and maintaining meaningful connections',
    2,
    'text',
    'Strong relationships are a cornerstone of resilience. Learn how to build, nurture, and lean on your support network during difficult times.',
    25,
    ARRAY['Map your support network', 'Strengthen key relationships', 'Ask for help effectively'],
    ARRAY['Social support types', 'Relationship quality', 'Reciprocity', 'Boundaries'],
    ARRAY['Support network mapping', 'Reach out to 3 people', 'Practice asking for help'],
    true
);

-- Lessons for "Overcoming Depression" program
INSERT INTO lessons (program_id, title, description, lesson_number, content_type, content_text, duration_minutes, learning_objectives, key_concepts, exercises, is_published) VALUES
(
    '33333333-3333-3333-3333-333333333333',
    'Understanding Depression',
    'Learn about depression and its impact',
    1,
    'text',
    'Depression is more than feeling sad. It''s a medical condition that affects your thoughts, feelings, and behaviors. Understanding depression is the first step toward recovery.',
    20,
    ARRAY['Recognize depression symptoms', 'Understand the biological basis', 'Reduce self-blame'],
    ARRAY['Depression symptoms', 'Neurobiology', 'Types of depression', 'Treatment options'],
    ARRAY['Symptom tracking', 'Self-compassion practice', 'Depression education'],
    true
),
(
    '33333333-3333-3333-3333-333333333333',
    'Behavioral Activation',
    'Using activity to improve mood',
    2,
    'interactive',
    'Behavioral activation involves scheduling and engaging in positive activities, even when you don''t feel like it. It''s one of the most effective strategies for depression.',
    30,
    ARRAY['Create activity schedule', 'Identify mood-boosting activities', 'Overcome avoidance'],
    ARRAY['Activity scheduling', 'Pleasant events', 'Avoidance patterns', 'Momentum building'],
    ARRAY['Weekly activity plan', 'Mood and activity log', 'Pleasurable activities list'],
    true
);

-- =============================================================================
-- SEED SAMPLE DOCUMENTS FOR RAG (AI Vector Search)
-- =============================================================================

-- Note: In production, you would generate real embeddings using OpenAI API
-- For development, we'll create placeholder vectors (all zeros)
-- These should be replaced with actual embeddings in production

INSERT INTO documents (id, content, metadata, embedding, document_type, category, tags, is_active) VALUES
(
    '44444444-4444-4444-4444-444444444444',
    'Anxiety management techniques include deep breathing, progressive muscle relaxation, grounding exercises, and cognitive restructuring.',
    '{"source": "therapy_knowledge_base", "topic": "anxiety_techniques"}',
    array_fill(0, ARRAY[1536])::vector,
    'therapy_technique',
    'anxiety',
    ARRAY['anxiety', 'coping-skills', 'breathing', 'relaxation'],
    true
),
(
    '55555555-5555-5555-5555-555555555555',
    'If you are experiencing thoughts of self-harm or suicide, please reach out for immediate help. National Suicide Prevention Lifeline: 988 or 1-800-273-8255.',
    '{"source": "crisis_resources", "urgency": "critical"}',
    array_fill(0, ARRAY[1536])::vector,
    'crisis_resource',
    'crisis_intervention',
    ARRAY['crisis', 'suicide-prevention', 'emergency'],
    true
),
(
    '66666666-6666-6666-6666-666666666666',
    'Cognitive Behavioral Therapy (CBT) helps identify and change negative thought patterns. The ABC model: Activating event, Beliefs, Consequences.',
    '{"source": "therapy_knowledge_base", "approach": "CBT"}',
    array_fill(0, ARRAY[1536])::vector,
    'therapy_technique',
    'cognitive_therapy',
    ARRAY['CBT', 'cognitive-restructuring', 'thought-patterns'],
    true
);

-- Update program lesson counts
UPDATE self_help_programs SET total_lessons = 3 WHERE id = '11111111-1111-1111-1111-111111111111';
UPDATE self_help_programs SET total_lessons = 2 WHERE id = '22222222-2222-2222-2222-222222222222';
UPDATE self_help_programs SET total_lessons = 2 WHERE id = '33333333-3333-3333-3333-333333333333';
