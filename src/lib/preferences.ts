export type Language = 'en' | 'es';
export type Theme = 'light' | 'dark' | 'auto';

const LANGUAGE_KEY = 'therafam:language';
const THEME_KEY = 'therafam:theme';

export function getLanguage(): Language {
  return localStorage.getItem(LANGUAGE_KEY) === 'es' ? 'es' : 'en';
}

export function setLanguage(language: Language) {
  localStorage.setItem(LANGUAGE_KEY, language);
  document.documentElement.lang = language;
  window.dispatchEvent(new CustomEvent('therafam:preferences', { detail: { language } }));
}

export function getTheme(): Theme {
  const value = localStorage.getItem(THEME_KEY);
  return value === 'dark' || value === 'auto' ? value : 'light';
}

export function applyTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme);
  const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.classList.toggle('dark', dark);
  window.dispatchEvent(new CustomEvent('therafam:preferences', { detail: { theme } }));
}

export function initializePreferences() {
  setLanguage(getLanguage());
  applyTheme(getTheme());
}

export const copy = {
  en: {
    signIn: 'Sign In', signUp: 'Sign Up', guest: 'Continue as Guest (Anonymous)',
    language: 'Language', light: 'Light', dark: 'Dark', system: 'System', backHome: 'Back to Home',
  },
  es: {
    signIn: 'Iniciar sesión', signUp: 'Registrarse', guest: 'Continuar como invitado (Anónimo)',
    language: 'Idioma', light: 'Claro', dark: 'Oscuro', system: 'Sistema', backHome: 'Volver al inicio',
  },
} as const;
