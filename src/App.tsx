import { useMemo, useState } from 'react';
import logo from './assets/brand/logo-mark.svg';
import heroArt from './assets/illustrations/therapy-hero.svg';
import moodArt from './assets/illustrations/mood-card.svg';
import { apiBase, supabaseConfigured } from './lib/supabase';

type View = 'home' | 'auth' | 'client' | 'therapist' | 'ai' | 'programs' | 'messages' | 'settings';
type Role = 'client' | 'therapist';
type Language = 'en' | 'es';

type NavItem = { id: View; icon: string; label: string };

const copy = {
  en: {
    start: 'Start your healing journey',
    signIn: 'Sign in',
    subtitle:
      'Personalized therapy support for families, clients, and clinicians—grounded in CBT, compassionate AI, and secure care coordination.'
  },
  es: {
    start: 'Comienza tu camino de bienestar',
    signIn: 'Iniciar sesión',
    subtitle:
      'Apoyo terapéutico personalizado para familias, clientes y terapeutas con CBT, IA compasiva y coordinación segura.'
  }
};

const cards = [
  ['Mood tracking', 'Daily check-ins, trends, and personalized coping recommendations.'],
  ['Therapist matching', 'Verified providers, secure appointments, and collaborative care plans.'],
  ['Guided programs', 'CBT lessons, breathwork, journaling, and family communication skills.']
];

const programs = ['CBT foundations', 'Family communication', 'Sleep reset', 'Mindful parenting', 'Anxiety toolkit', 'Crisis safety plan'];

export default function App() {
  const [view, setView] = useState<View>('home');
  const [role, setRole] = useState<Role>('client');
  const [dark, setDark] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const [mood, setMood] = useState(7);

  const navItems = useMemo<NavItem[]>(
    () => [
      { id: 'home', icon: '⌂', label: 'Home' },
      { id: 'client', icon: '♡', label: 'Client' },
      { id: 'therapist', icon: '◉', label: 'Therapist' },
      { id: 'ai', icon: '✦', label: 'AI Chat' },
      { id: 'programs', icon: '▶', label: 'Programs' },
      { id: 'messages', icon: '✉', label: 'Messages' },
      { id: 'settings', icon: '⚙', label: 'Settings' }
    ],
    []
  );

  const t = copy[language];

  return (
    <main className={dark ? 'app dark' : 'app'}>
      <aside className="rail" aria-label="Primary navigation">
        <button className="brand" onClick={() => setView('home')}>
          <img src={logo} alt="Therafam logo" />
          <span>Therafam</span>
        </button>

        {navItems.map((item) => (
          <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}>
            <span className="navIcon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}

        <div className="railBottom">
          <button onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}>
            <span className="navIcon">🌐</span>
            <span>{language.toUpperCase()}</span>
          </button>
          <button onClick={() => setDark(!dark)}>
            <span className="navIcon">{dark ? '☀' : '☾'}</span>
            <span>Theme</span>
          </button>
        </div>
      </aside>

      <section className="canvas">
        <header className="topbar">
          <div>
            <p className="eyebrow">Secure mental health platform</p>
            <h1>{t.start}</h1>
          </div>
          <button className="pill" onClick={() => setView('auth')}>
            {t.signIn} <span>›</span>
          </button>
        </header>

        {view === 'home' && <HomeView subtitle={t.subtitle} onNavigate={setView} />}
        {view === 'auth' && <AuthView role={role} setRole={setRole} onContinue={() => setView(role)} />}
        {view === 'client' && <ClientView mood={mood} setMood={setMood} />}
        {view === 'therapist' && <TherapistView />}
        {view === 'ai' && <ChatView title="Therafam AI companion" placeholder="Message Therafam AI..." />}
        {view === 'programs' && <ProgramsView />}
        {view === 'messages' && <MessagesView />}
        {view === 'settings' && (
          <SettingsView language={language} setLanguage={setLanguage} dark={dark} setDark={setDark} />
        )}
      </section>
    </main>
  );
}

function HomeView({ subtitle, onNavigate }: { subtitle: string; onNavigate: (view: View) => void }) {
  return (
    <>
      <section className="hero">
        <div>
          <div className="badge">🌿 CBT + family systems + AI support</div>
          <h2>Care that feels warm, intelligent, and human.</h2>
          <p>{subtitle}</p>
          <div className="actions">
            <button onClick={() => onNavigate('auth')}>Create account</button>
            <button className="ghost" onClick={() => onNavigate('ai')}>
              Try AI companion
            </button>
          </div>
        </div>
        <img src={heroArt} alt="Warm therapy illustration" />
      </section>

      <section className="grid three" aria-label="Therafam features">
        {cards.map(([title, body]) => (
          <article className="card" key={title}>
            <span className="cardIcon">✦</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </section>
    </>
  );
}

function AuthView({ role, setRole, onContinue }: { role: Role; setRole: (role: Role) => void; onContinue: () => void }) {
  return (
    <section className="auth">
      <div className="panel">
        <h2>Welcome back</h2>
        <p>Sign in securely as a client or therapist. Supabase is used when configured; secrets remain on the server.</p>
        <div className="seg" role="tablist" aria-label="Account type">
          <button className={role === 'client' ? 'sel' : ''} onClick={() => setRole('client')}>
            Client
          </button>
          <button className={role === 'therapist' ? 'sel' : ''} onClick={() => setRole('therapist')}>
            Therapist
          </button>
        </div>
        <label>
          Email address
          <input placeholder="maya@example.com" type="email" />
        </label>
        <label>
          Password
          <input placeholder="••••••••" type="password" />
        </label>
        <button onClick={onContinue}>{supabaseConfigured ? 'Continue with Supabase' : 'Continue demo'}</button>
        <small>{apiBase ? `Backend connected: ${apiBase}` : 'Connect VITE_API_BASE_URL for backend AI chat.'}</small>
      </div>

      <div className="panel soft">
        <span className="cardIcon">🛡</span>
        <h3>Private by design</h3>
        <p>Email verification, therapist profile review, protected session notes, and crisis escalation UI are ready for production integration.</p>
      </div>
    </section>
  );
}

function ClientView({ mood, setMood }: { mood: number; setMood: (mood: number) => void }) {
  return (
    <section className="dash">
      <div className="welcome">
        <h2>Good afternoon, Maya</h2>
        <p>Your plan today focuses on anxiety relief, family boundaries, and sleep hygiene.</p>
      </div>
      <div className="grid two">
        <article className="card mood">
          <img src={moodArt} alt="Mood trend illustration" />
          <h3>How are you feeling?</h3>
          <input min="1" max="10" type="range" value={mood} onChange={(event) => setMood(Number(event.currentTarget.value))} />
          <b>{mood}/10 — steady and hopeful</b>
        </article>
        <article className="card appointment">
          <h3>Next appointment</h3>
          <p className="big">Today · 4:30 PM</p>
          <p>Video session with Dr. Rivera</p>
          <button>Join waiting room</button>
        </article>
      </div>
    </section>
  );
}

function TherapistView() {
  return (
    <section className="dash">
      <h2>Therapist workspace</h2>
      <div className="grid three">
        {['8 clients active', '4 sessions today', '3 notes pending'].map((stat) => (
          <article className="stat" key={stat}>{stat}</article>
        ))}
      </div>
      <article className="card">
        <h3>Client risk board</h3>
        {['Maya — improving mood trend', 'Jon — missed check-in', 'Family A — new message'].map((row) => (
          <p className="row" key={row}>{row}<span>›</span></p>
        ))}
      </article>
    </section>
  );
}

function ChatView({ title, placeholder }: { title: string; placeholder: string }) {
  return (
    <section className="chat">
      <h2>{title}</h2>
      <div className="bubble ai">I can help you reframe thoughts, practice grounding, and decide when to contact your therapist.</div>
      <div className="bubble me">I feel overwhelmed after an argument.</div>
      <div className="bubble ai">Let’s slow down. Name one body sensation, one thought, and one need you can express calmly.</div>
      <div className="composer">
        <input placeholder={placeholder} />
        <button>Send</button>
      </div>
    </section>
  );
}

function ProgramsView() {
  return (
    <section>
      <h2>Programs & lessons</h2>
      <div className="grid three">
        {programs.map((program) => (
          <article className="card program" key={program}>
            <span className="cardIcon">▶</span>
            <h3>{program}</h3>
            <p>Short lesson · guided practice · progress saved</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function MessagesView() {
  return (
    <section className="chat">
      <h2>Secure messages</h2>
      <div className="bubble ai">Dr. Rivera: Please complete the reflection before our session.</div>
      <div className="bubble me">Maya: I updated my mood log.</div>
      <div className="bubble ai">System: Appointment reminder sent.</div>
      <div className="composer">
        <input placeholder="Write a secure message..." />
        <button>Send</button>
      </div>
    </section>
  );
}

function SettingsView({
  language,
  setLanguage,
  dark,
  setDark
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  dark: boolean;
  setDark: (dark: boolean) => void;
}) {
  return (
    <section>
      <h2>Settings</h2>
      <article className="card">
        <p className="row">Language <button onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}>{language === 'en' ? 'English' : 'Español'}</button></p>
        <p className="row">Theme <button onClick={() => setDark(!dark)}>{dark ? 'Dark' : 'Light'}</button></p>
        <p className="row">Notifications <button>Enabled</button></p>
      </article>
    </section>
  );
}
