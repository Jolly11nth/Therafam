import { apiBase, supabase } from './supabase';

export type Program = {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty_level: string;
  estimated_duration_days: number | null;
  thumbnail_url?: string | null;
  tags?: string[] | null;
  total_lessons?: number;
};

export type MoodEntry = {
  id?: string;
  user_id: string;
  mood_value: number;
  mood_label: string;
  energy_level?: number | null;
  anxiety_level?: number | null;
  stress_level?: number | null;
  sleep_hours?: number | null;
  sleep_quality?: number | null;
  notes?: string | null;
  entry_date: string;
};

export type AppSettings = {
  user_id: string;
  email_notifications: boolean;
  push_notifications: boolean;
  sms_notifications: boolean;
  appointment_reminders: boolean;
  ai_chat_notifications: boolean;
  profile_visibility: 'public' | 'therapists_only' | 'private';
  data_sharing: boolean;
  analytics_opt_in: boolean;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  auto_save_chat: boolean;
};

export type ChatMessage = {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
};

export async function getHealth() {
  if (!apiBase) return { status: 'demo' };
  const response = await fetch(`${apiBase}/api/health`);
  if (!response.ok) throw new Error('Backend health check failed');
  return response.json() as Promise<{ status: string }>;
}

export async function sendAiMessage(message: string, history: ChatMessage[] = [], userId?: string) {
  if (!apiBase) {
    return {
      response: 'I’m here with you. The AI service is currently in demo mode, but your message was received. Connect the backend to enable live responses.',
      demo: true,
    };
  }
  const response = await fetch(`${apiBase}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, user_id: userId ?? null }),
  });
  if (!response.ok) throw new Error(`AI request failed with ${response.status}`);
  return response.json() as Promise<{ response: string; conversation_id?: string; crisis?: boolean }>;
}

export async function getPrograms() {
  if (!supabase) return [] as Program[];
  const { data, error } = await supabase.from('self_help_programs').select('id,title,description,category,difficulty_level,estimated_duration_days,thumbnail_url,tags,total_lessons').eq('is_published', true).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Program[];
}

export async function getLessons(programId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase.from('lessons').select('id,program_id,title,description,lesson_number,content_type,content_text,duration_minutes,learning_objectives,key_concepts,exercises').eq('program_id', programId).eq('is_published', true).order('lesson_number', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getMoodEntries(userId: string, limit = 14) {
  if (!supabase || !userId) return [] as MoodEntry[];
  const { data, error } = await supabase.from('mood_entries').select('*').eq('user_id', userId).order('entry_date', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as MoodEntry[];
}

export async function saveMoodEntry(entry: MoodEntry) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.from('mood_entries').upsert(entry, { onConflict: 'user_id,entry_date' }).select().single();
  if (error) throw error;
  return data as MoodEntry;
}

export async function getSettings(userId: string) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data as AppSettings | null;
}

export async function saveSettings(settings: AppSettings) {
  if (!supabase) throw new Error('Supabase is not configured');
  const existing = await getSettings(settings.user_id);
  const query = existing
    ? supabase.from('user_settings').update(settings).eq('id', existing.id)
    : supabase.from('user_settings').insert(settings);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data as AppSettings;
}

export function getStoredUserId() {
  return localStorage.getItem('therafam:userId') ?? '';
}
