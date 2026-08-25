import { useState } from 'react';
import logo from './assets/brand/Therafam 1.png';
import { apiBase, supabaseConfigured } from './lib/supabase';

type View = 'landing' | 'auth' | 'therapist' | 'client' | 'ai' | 'programs' | 'messages' | 'settings';
type AuthMode = 'signin' | 'signup';

export default function App() {
  const [view, setView] = useState<View>('landing');
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [language, setLanguage] = useState('English');

  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode);
    setView('auth');
  };

  return (
    <main className="app">
      {view === 'landing' && (
        <Landing
          language={language}
          setLanguage={setLanguage}
          onLogin={() => openAuth('signin')}
          onSignup={() => openAuth('signup')}
        />
      )}
      {view === 'auth' && (
        <AuthScreen
          mode={authMode}
          setMode={setAuthMode}
          onBack={() => setView('landing')}
          onTherapist={() => setView('therapist')}
          onContinue={() => setView('client')}
        />
      )}
      {view === 'therapist' && (
        <TherapistAuth
          onBack={() => setView('landing')}
          onClient={() => setView('auth')}
          onContinue={() => setView('therapist')}
        />
      )}
      {view === 'client' && <ClientView onHome={() => setView('landing')} />}
      {view === 'ai' && <SimplePage title="Therafam AI" onBack={() => setView('landing')} />}
      {view === 'programs' && <SimplePage title="Programs & Lessons" onBack={() => setView('landing')} />}
      {view === 'messages' && <SimplePage title="Secure Messages" onBack={() => setView('landing')} />}
      {view === 'settings' && <SimplePage title="Settings" onBack={() => setView('landing')} />}
    </main>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'brand-lockup compact' : 'brand-lockup'}>
      <img src={logo} alt="Therafam" className="therafam-logo" />
    </div>
  );
}

function Landing({ language, setLanguage, onLogin, onSignup }: { language: string; setLanguage: (value: string) => void; onLogin: () => void; onSignup: () => void; }) {
  return (
    <section className="landing-shell">
      <div className="landing-content">
        <button className="back-button" aria-label="Back">‹</button>
        <h1>Your Safe Space for Mental<br className="desktop-only" /> Wellness.</h1>
        <p className="landing-subtitle">
          Connect with an AI therapist designed to listen, understand, and guide
          <br className="desktop-only" /> you towards better mental health.
        </p>
        <div className="landing-logo-card"><Brand /></div>
        <select className="language-select" value={language} onChange={(event) => setLanguage(event.currentTarget.value)} aria-label="Language">
          <option>English</option>
          <option>Español</option>
        </select>
        <div className="landing-actions">
          <button className="outline-action" onClick={onLogin}>Login</button>
          <button className="primary-action" onClick={onSignup}>Sign up</button>
        </div>
        <button className="link-button guest" onClick={onLogin}>Continue as Guest (Anonymous)</button>
        <p className="anonymous-copy">Explore the app anonymously. Data won&apos;t be saved permanently.</p>
        <p className="privacy-copy">Your privacy is important to us, all conversations are end-to-end<br className="desktop-only" /> encrypted.</p>
      </div>
    </section>
  );
}

function AuthScreen({ mode, setMode, onBack, onTherapist, onContinue }: { mode: AuthMode; setMode: (mode: AuthMode) => void; onBack: () => void; onTherapist: () => void; onContinue: () => void; }) {
  return (
    <section className="auth-shell">
      <div className="auth-card">
        <button className="mobile-back" onClick={onBack} aria-label="Back">‹</button>
        <Brand compact />
        <div className="auth-tabs">
          <button className={mode === 'signin' ? 'tab active' : 'tab'} onClick={() => setMode('signin')}>Sign In</button>
          <button className={mode === 'signup' ? 'tab active' : 'tab'} onClick={() => setMode('signup')}>Sign Up</button>
        </div>
        {mode === 'signin' ? (
          <>
            <div className="demo-card">
              <div className="demo-icon">🔑</div>
              <div>
                <strong>Demo Account Available</strong>
                <p>Try the app without signing up using these demo credentials:</p>
                <p>Email: <b>test@therafam.com</b></p>
                <p>Password: <b>Test1234!</b></p>
                <small>⚠️ Demo authentication is offline. Using local fallback mode for demo.</small>
              </div>
            </div>
            <form onSubmit={(event) => { event.preventDefault(); onContinue(); }} className="auth-form">
              <input aria-label="Email" placeholder="Email" type="email" />
              <div className="password-field"><input aria-label="Password" placeholder="Password" type="password" /><span>◉</span></div>
              <div className="auth-links">
                <button type="button" className="text-link">Forgot Password?</button>
                <button type="button" className="text-link" onClick={() => setMode('signup')}>Don&apos;t have an account? Sign Up</button>
              </div>
              <button className="full-action" type="submit">Sign In</button>
            </form>
            <div className="or-divider"><span>or</span></div>
            <button className="google-action" onClick={onContinue}>Continue with Google</button>
            <p className="therapist-prompt">Are you a mental health professional?</p>
            <button className="text-link centered" onClick={onTherapist}>Access Therapist Portal</button>
            <button className="text-link centered" onClick={onBack}>Continue as Guest (Anonymous)</button>
          </>
        ) : (
          <SignupScreen onContinue={onContinue} />
        )}
        {!supabaseConfigured && <span className="demo-status">{apiBase ? 'Backend configured' : 'Demo mode'}</span>}
      </div>
    </section>
  );
}

function SignupScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <>
      <div className="professional-card">
        <div className="professional-icon">♧</div>
        <div><strong>Personalized Access</strong><p>Licensed Mental Health Providers</p></div>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); onContinue(); }} className="auth-form">
        <input aria-label="Professional email" placeholder="Professional Email" type="email" />
        <div className="password-field"><input aria-label="Password" placeholder="Password" type="password" /><span>◉</span></div>
        <p className="application-copy">Need to apply for access? <button className="text-link" type="button">Apply here</button></p>
        <button className="full-action" type="submit">Access Professional Portal</button>
      </form>
      <div className="test-account-card">
        <button className="small-outline" type="button"><span>✎ Test Account</span><span>Create Account</span></button>
        <p>Email: therapist@test.com</p><p>Password: Test1234!</p>
      </div>
    </>
  );
}

function TherapistAuth({ onBack, onClient, onContinue }: { onBack: () => void; onClient: () => void; onContinue: () => void; }) {
  return (
    <section className="auth-shell">
      <div className="auth-card therapist-card">
        <button className="mobile-back" onClick={onBack} aria-label="Back">‹</button>
        <Brand compact />
        <div className="auth-tabs"><button className="tab active">Sign In</button><button className="tab">Apply to Join</button></div>
        <div className="professional-card">
          <div className="professional-icon">♧</div>
          <div><strong>Professional Access</strong><p>Licensed Mental Health Providers</p></div>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); onContinue(); }} className="auth-form">
          <input aria-label="Professional email" placeholder="Professional Email" type="email" />
          <div className="password-field"><input aria-label="Password" placeholder="Password" type="password" /><span>◉</span></div>
          <p className="application-copy">Need to apply for access? <button className="text-link" type="button">Apply here</button></p>
          <button className="full-action" type="submit">Access Professional Portal</button>
        </form>
        <div className="or-divider"><span>or</span></div>
        <div className="test-account-card">
          <button className="small-outline" type="button"><span>✎ Test Account</span><span>Create Account</span></button>
          <p>Email: therapist@test.com · Password: Test1234!</p>
        </div>
        <button className="text-link centered" onClick={onClient}>Return to Client Sign In</button>
      </div>
    </section>
  );
}

function ClientView({ onHome }: { onHome: () => void }) {
  return <section className="simple-page"><Brand compact /><h1>Welcome to Therafam</h1><p>Your secure mental wellness space is ready.</p><button className="full-action" onClick={onHome}>Return Home</button></section>;
}

function SimplePage({ title, onBack }: { title: string; onBack: () => void }) {
  return <section className="simple-page"><Brand compact /><h1>{title}</h1><p>This area is connected to the React application and ready for the next implementation pass.</p><button className="full-action" onClick={onBack}>Return Home</button></section>;
}
