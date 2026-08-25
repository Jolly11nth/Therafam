import { useEffect, useState } from 'react';
import Brand from './components/Brand';
import ClientDashboard from './pages/ClientDashboard';
import MoodCheckIn from './pages/MoodCheckIn';
import AIChat from './pages/AIChat';
import Programs from './pages/Programs';
import Messages from './pages/Messages';
import Settings from './pages/Settings';
import TherapistPortal from './pages/TherapistPortal';
import { apiBase, callBackend } from './lib/supabase';

type View = 'welcome' | 'anonymous' | 'auth' | 'dashboard' | 'mood' | 'ai' | 'programs' | 'messages' | 'settings' | 'therapist';
type AuthMode = 'signin' | 'signup';
type Session = { userId: string; email: string; userType: 'client' | 'therapist' };

export default function TherafamApp() {
  const [view, setView] = useState<View>('welcome');
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [session, setSession] = useState<Session | null>(() => { const raw = localStorage.getItem('therafam:session'); return raw ? JSON.parse(raw) : null; });
  useEffect(() => { if (session) localStorage.setItem('therafam:session', JSON.stringify(session)); }, [session]);
  function openAuth(mode: AuthMode) { setAuthMode(mode); setView('auth'); }
  function navigate(next: Exclude<View, 'welcome' | 'anonymous' | 'auth' | 'therapist'>) { setView(next); }

  if (view === 'welcome') return <Welcome onSignIn={() => openAuth('signin')} onSignUp={() => openAuth('signup')} onGuest={() => setView('anonymous')} />;
  if (view === 'anonymous') return <AnonymousMode onBack={() => setView('welcome')} onSignIn={() => openAuth('signin')} onSignUp={() => openAuth('signup')} />;
  if (view === 'auth') return <Auth mode={authMode} setMode={setAuthMode} onBack={() => setView('welcome')} onGuest={() => setView('anonymous')} onTherapist={() => setView('therapist')} onSuccess={(next) => { setSession(next); localStorage.setItem('therafam:userId', next.userId); setView(next.userType === 'therapist' ? 'therapist' : 'dashboard'); }} />;
  if (view === 'therapist') return <TherapistPortal onBack={() => setView('auth')} onHome={() => setView('welcome')} />;
  if (view === 'dashboard') return <ClientDashboard onNavigate={navigate} onHome={() => setView('welcome')} />;
  if (view === 'mood') return <MoodCheckIn onBack={() => setView('dashboard')} onHome={() => setView('welcome')} />;
  if (view === 'ai') return <AIChat onBack={() => setView('dashboard')} onHome={() => setView('welcome')} />;
  if (view === 'programs') return <Programs onBack={() => setView('dashboard')} onHome={() => setView('welcome')} />;
  if (view === 'messages') return <Messages onBack={() => setView('dashboard')} onHome={() => setView('welcome')} />;
  if (view === 'settings') return <Settings onBack={() => setView('dashboard')} onHome={() => setView('welcome')} />;
  return <ClientDashboard onNavigate={navigate} onHome={() => setView('welcome')} />;
}

function Welcome({ onSignIn, onSignUp, onGuest }: { onSignIn: () => void; onSignUp: () => void; onGuest: () => void }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const frame = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(frame); }, []);
  return <section className={`landing-shell ${ready ? 'intro-ready' : ''}`}><div className="landing-content">
    <div className="landing-anim landing-heading"><Brand /></div><h1 className="landing-anim landing-heading">Your Safe Space for Mental<br className="desktop-only" /> Wellness.</h1>
    <p className="landing-subtitle landing-anim">Connect with an AI therapist designed to listen, understand, and guide<br className="desktop-only" /> you towards better mental health.</p>
    <div className="landing-logo-card landing-anim"><Brand /></div><select className="language-select landing-anim" defaultValue="English" aria-label="Language"><option>English</option><option>Español</option></select>
    <div className="landing-actions"><button className="outline-action landing-anim" onClick={onSignIn}>Sign In</button><button className="primary-action landing-anim" onClick={onSignUp}>Sign Up</button></div>
    <div className="landing-lower landing-anim"><button className="link-button guest" onClick={onGuest}>Continue as Guest (Anonymous)</button><p className="anonymous-copy">Explore the app anonymously. Data won’t be saved permanently.</p><p className="privacy-copy">Your privacy is important to us, all conversations are end-to-end<br className="desktop-only" /> encrypted.</p></div>
  </div></section>;
}

function AnonymousMode({ onBack, onSignIn, onSignUp }: { onBack: () => void; onSignIn: () => void; onSignUp: () => void }) {
  return <section className="anonymous-shell"><header className="anonymous-topbar"><button className="workspace-brand" onClick={onBack}><Brand compact /></button><button className="theme-button">☼ Light</button></header><div className="anonymous-content">
    <article className="anonymous-notice"><div className="notice-icon">◯</div><div><button className="notice-close" onClick={onBack}>×</button><strong>Anonymous Mode</strong><p>You’re exploring Therafam anonymously. Your conversations and data will only be stored temporarily in your browser. Create an account to save your progress and access all features.</p><div className="notice-actions"><button className="primary-action" onClick={onSignUp}>Create Free Account</button><button className="outline-action" onClick={onSignIn}>Sign In</button></div></div></article>
    <div className="anonymous-heading"><h1>Welcome to Therafam</h1><p>Explore our mental wellness features anonymously</p></div><article className="anonymous-feature-card"><span>Backend connection is not available.</span><button className="primary-action" onClick={() => window.location.reload()}>Try Again</button></article>
    <article className="privacy-card"><span className="privacy-icon">♧</span><strong>Your Privacy Matters</strong><p>In anonymous mode, your data stays in your browser and is not linked to an account. For a persistent experience with data synced across devices, create a free account.</p></article><button className="text-link" onClick={onBack}>Back to Home</button>
  </div></section>;
}

function Auth({ mode, setMode, onBack, onGuest, onTherapist, onSuccess }: { mode: AuthMode; setMode: (mode: AuthMode) => void; onBack: () => void; onGuest: () => void; onTherapist: () => void; onSuccess: (session: Session) => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { if (apiBase) { const response = await callBackend(`/api/${mode === 'signin' ? 'auth/signin' : 'auth/signup'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mode === 'signin' ? { email, password } : { email, password, userType: 'client', fullName: name }) }); const data = await response.json(); if (!data.success) throw new Error(data.error ?? 'Authentication failed'); onSuccess({ userId: data.userId ?? data.user?.id ?? crypto.randomUUID(), email, userType: 'client' }); } else onSuccess({ userId: crypto.randomUUID(), email: email || 'demo@therafam.local', userType: 'client' }); } catch (err) { setError(err instanceof Error ? err.message : 'Authentication failed'); } finally { setBusy(false); } }
  return <section className="auth-shell"><div className="auth-card"><button className="mobile-back" onClick={onBack}>‹</button><Brand compact /><div className="auth-tabs"><button className={mode === 'signin' ? 'tab active' : 'tab'} onClick={() => setMode('signin')}>Sign In</button><button className={mode === 'signup' ? 'tab active' : 'tab'} onClick={() => setMode('signup')}>Sign Up</button></div>
    <div className="demo-card"><div className="demo-icon">🔑</div><div><strong>{mode === 'signin' ? 'Demo Account Available' : 'Create your Therafam account'}</strong><p>{mode === 'signin' ? 'Connect the backend to use your real account. Demo mode keeps the UI testable locally.' : 'Your account unlocks saved mood history, programs, settings, and secure care features.'}</p></div></div>
    <form className="auth-form" onSubmit={submit}>{mode === 'signup' && <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required />}<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" required /><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" required minLength={8} /><button className="full-action" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}</button></form>
    {error && <div className="form-error">{error}</div>}<button className="google-action" onClick={() => onSuccess({ userId: crypto.randomUUID(), email: 'demo@therafam.local', userType: 'client' })}>Continue with Google</button><p className="therapist-prompt">Are you a mental health professional?</p><button className="text-link centered" onClick={onTherapist}>Access Therapist Portal</button><button className="text-link centered" onClick={onGuest}>Continue as Guest (Anonymous)</button>
  </div></section>;
}
