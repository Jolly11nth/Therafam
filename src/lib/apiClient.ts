/**
 * Same-origin/FastAPI transport used by the Railway single-service deployment.
 * Leave VITE_API_BASE_URL unset in production so requests use the current origin.
 */
export const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';

export function callBackend(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = localStorage.getItem('therafam:token');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${apiBase}${path}`, { ...init, headers });
}
