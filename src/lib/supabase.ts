export const supabaseConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
export const apiBase = import.meta.env.VITE_API_BASE_URL || '';
export async function callBackend(path: string, init?: RequestInit) {
  if (!apiBase) throw new Error('VITE_API_BASE_URL is not configured');
  return fetch(`${apiBase}${path}`, init);
}
