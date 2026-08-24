import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function callBackend(path: string, init?: RequestInit) {
  if (!apiBase) {
    throw new Error('VITE_API_BASE_URL is not configured');
  }

  const response = await fetch(`${apiBase}${path}`, init);

  if (!response.ok) {
    throw new Error(`Backend request failed with ${response.status}`);
  }

  return response;
}