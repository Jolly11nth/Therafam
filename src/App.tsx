import { useEffect, useState } from 'react';
import logo from './assets/brand/Therafam 1.png';
import { apiBase, supabaseConfigured } from './lib/supabase';

type View = 'landing' | 'auth' | 'therapist' | 'client' | 'ai' | 'programs' | 'messages' | 'settings';
type AuthMode = 'signin' | 'signup';

type LandingProps = {
  language: string;
  setLanguage: (value: string) => void;
  onLogin: () => void;
  onSignup: () => void;
  onTherapist: () => void;
};

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
          onTherapist={() => setView('therapist')}
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

function useIntroAnimation() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return ready;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'brand-lockup compact' : 'brand-lockup'}>
      <img src={logo} alt="Therafam" className="therafam-logo" />
    </div>
  );
}

function Landing({ language, setLanguage, onLogin, onSignup, onTherapist }: LandingProps) {
  const ready = useIntroAnimation();

  return (
    <section className={`landing-shell ${ready ? 'intro-ready' : ''}`}>
      <div className="landing-content">
        <button className="back-button landing-anim landing-back" aria-label="Back">‹</button>

        <h1 className="landing-anim landing-heading">
          Your Safe Space for Mental
          <br className="desktop-only" /> Wellness.
        </h1>

        <p className="landing-subtitle landing-anim">
          Connect with an AI therapist designed to listen, understand, and guide
          <br className="desktop-only" /> you towards better mental health.
        </p>

        <div className="landing-logo-card landing-anim">
          <Brand />
        </div>

        <div className="landing-controls">
          <select
            className="language-select landing-anim"
            value={language}
            onChange={(event) => setLanguage(event.currentTarget.value)}
            aria-label="Language"
          >
            <option>English</option>
            <option>Español</option>
          </select>
        </div>

        <div className="landing-actions">
          <button className="outline-action landing-anim" onClick={onLogin}>Sign In</button>
          <button className="primary-action landing-anim" onClick={onSignup}>Sign Up</button>
        </div>

        <div className="landing-lower landing-anim">
          <button className="link-button guest" onClick={onLogin}>Continue as Guest (Anonymous)</button>

          <button className="text-link therapist-landing-link" onClick={onTherapist}>
            Are you a therapist? <strong>Join the Therapist Portal</strong>
          </button>

          <p className="anonymous-copy">
            Explore the app anonymously. Data won&apos;t be saved permanently.
          </p>

          <p className="privacy-copy">
            Your privacy is important to us, all conversations are end-to-end
            <br className="desktop-only" /> encrypted.
          </p>
        </div>
      </div>
    </section>
  );
}

function AuthScreen({ mode, setMode, onBack, onTherapist, onContinue }: {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  onBack: () => void;
  onTherapist: () => void;
  onContinue: () => void;
}) {
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
              <input aria-label="Email" placeholder="Email" type="email" required />
              <div className="password-field">
                <input aria-label="Password" placeholder="Password" type="password" required />
                <span>◉</span>
              </div>

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

        {!supabaseConfigured && (
          <span className="demo-status">{apiBase ? 'Backend configured' : 'Demo mode'}</span>
        )}
      </div>
    </section>
  );
}

function SignupScreen({ onContinue }: { onContinue: () => void }) {
  const [showProfessional, setShowProfessional] = useState(false);

  return (
    <>
      <div className="professional-card">
        <div className="professional-icon">♧</div>
        <div>
          <strong>Create your Therafam account</strong>
          <p>Start with the essentials. You can complete your profile later.</p>
        </div>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); onContinue(); }} className="auth-form">
        <input aria-label="First name" placeholder="First Name" type="text" required />
        <input aria-label="Last name" placeholder="Last Name" type="text" required />
        <input aria-label="Email" placeholder="Email" type="email" required />
        <input aria-label="Phone number" placeholder="Phone Number (optional)" type="tel" />
        <div className="password-field">
          <input aria-label="Password" placeholder="Password" type="password" required minLength={8} />
          <span>◉</span>
        </div>

        <button
          type="button"
          className="text-link professional-details-toggle"
          onClick={() => setShowProfessional((current) => !current)}
          aria-expanded={showProfessional}
        >
          {showProfessional ? 'Hide professional details' : 'Are you a mental health professional? Add professional details'}
        </button>

        {showProfessional && (
          <div className="professional-details">
            <label>Professional title *<input aria-label="Professional title" placeholder="Psychologist, Psychiatrist, Counselor, Therapist..." required /></label>
            <label>Area of specialization *<input aria-label="Area of specialization" placeholder="CBT, Family Therapy, Trauma, Anxiety & Stress..." required /></label>
            <label>Professional registration / license number *<input aria-label="Professional registration number" placeholder="Registration or license number" required /></label>
            <label>Years of experience *<input aria-label="Years of experience" placeholder="e.g. 5" type="number" min="0" max="70" required /></label>
            <label>Country / State of practice *<input aria-label="Country or state of practice" placeholder="e.g. Nigeria, Kaduna State" required /></label>
            <label>Short professional bio *<textarea aria-label="Professional bio" placeholder="Briefly describe your experience and approach..." rows={4} maxLength={500} required /></label>
            <p className="form-note">Professional details help Therafam review and present your professional profile. You can update your profile later.</p>
          </div>
        )}

        <button className="full-action" type="submit">Create Account</button>
      </form>
    </>
  );
}

function TherapistAuth({ onBack, onClient, onContinue }: { onBack: () => void; onClient: () => void; onContinue: () => void; }) {
  const [mode, setMode] = useState<'signin' | 'apply'>('signin');

  return (
    <section className="auth-shell">
      <div className="auth-card therapist-card">
        <button className="mobile-back" onClick={onBack} aria-label="Back">‹</button>
        <Brand compact />
        <div className="auth-tabs">
          <button className={mode === 'signin' ? 'tab active' : 'tab'} onClick={() => setMode('signin')}>Sign In</button>
          <button className={mode === 'apply' ? 'tab active' : 'tab'} onClick={() => setMode('apply')}>Apply to Join</button>
        </div>

        {mode === 'signin' ? (
          <>
            <div className="professional-card">
              <div className="professional-icon">♧</div>
              <div><strong>Professional Access</strong><p>Licensed Mental Health Providers</p></div>
            </div>
            <form onSubmit={(event) => { event.preventDefault(); onContinue(); }} className="auth-form">
              <input aria-label="Professional email" placeholder="Professional Email" type="email" required />
              <div className="password-field"><input aria-label="Password" placeholder="Password" type="password" required /><span>◉</span></div>
              <p className="application-copy">Need to apply for access? <button className="text-link" type="button" onClick={() => setMode('apply')}>Apply here</button></p>
              <button className="full-action" type="submit">Access Professional Portal</button>
            </form>
            <div className="or-divider"><span>or</span></div>
            <div className="test-account-card">
              <button className="small-outline" type="button"><span>✎ Test Account</span><span>Create Account</span></button>
              <p>Email: therapist@test.com · Password: Test1234!</p>
            </div>
            <button className="text-link centered" onClick={onClient}>Return to Client Sign In</button>
          </>
        ) : (
          <TherapistApplication onContinue={onContinue} onBackToSignIn={() => setMode('signin')} />
        )}
      </div>
    </section>
  );
}

function TherapistApplication({ onContinue, onBackToSignIn }: { onContinue: () => void; onBackToSignIn: () => void }) {
  return (
    <>
      <div className="professional-card">
        <div className="professional-icon">♧</div>
        <div><strong>Join the Therapist Portal</strong><p>Tell us the essentials about your professional practice.</p></div>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); onContinue(); }} className="auth-form therapist-application-form">
        <div className="form-section-title">Account</div>
        <div className="form-grid-two">
          <input aria-label="First name" placeholder="First Name" required />
          <input aria-label="Last name" placeholder="Last Name" required />
        </div>
        <input aria-label="Professional email" placeholder="Professional Email" type="email" required />
        <input aria-label="Phone number" placeholder="Phone Number (optional)" type="tel" />
        <input aria-label="Password" placeholder="Password" type="password" minLength={8} required />

        <div className="form-section-title">Professional information</div>
        <label>Professional title *<input aria-label="Professional title" placeholder="Psychologist, Psychiatrist, Counselor, Therapist..." required /></label>
        <label>Area of specialization *<input aria-label="Area of specialization" placeholder="CBT, Family Therapy, Trauma, Anxiety & Stress..." required /></label>
        <label>Professional registration / license number *<input aria-label="Professional registration number" placeholder="Registration or license number" required /></label>
        <div className="form-grid-two">
          <label>Years of experience *<input aria-label="Years of experience" placeholder="e.g. 5" type="number" min="0" max="70" required /></label>
          <label>Country / State of practice *<input aria-label="Country or state of practice" placeholder="e.g. Nigeria, Kaduna State" required /></label>
        </div>
        <label>Short professional bio *<textarea aria-label="Professional bio" placeholder="Briefly describe your experience and approach..." rows={4} maxLength={500} required /></label>
        <p className="form-note">Keep your bio concise. You can complete additional professional profile details after your account is created.</p>

        <button className="full-action" type="submit">Submit Application</button>
        <button className="text-link centered" type="button" onClick={onBackToSignIn}>Already have a professional account? Sign in</button>
      </form>
    </>
  );
}

function ClientView({ onHome }: { onHome: () => void }) {
  return <section className="simple-page"><Brand compact /><h1>Welcome to Therafam</h1><p>Your secure mental wellness space is ready.</p><button className="full-action" onClick={onHome}>Return Home</button></section>;
}

function SimplePage({ title, onBack }: { title: string; onBack: () => void }) {
  return <section className="simple-page"><Brand compact /><h1>{title}</h1><p>This area is connected to the React application and ready for the next implementation pass.</p><button className="full-action" onClick={onBack}>Return Home</button></section>;
}
