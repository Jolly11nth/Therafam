import { useEffect, useState } from 'react';
import Brand from '../components/Brand';
import { supabase } from '../lib/supabase';
import { getStoredUserId } from '../lib/therafamApi';

type Props = { onBack: () => void; onHome: () => void };
type Panel = 'clients' | 'schedule' | 'profile' | 'notes' | 'availability' | 'messages' | null;

type ProfileForm = {
  professionalTitle: string;
  specialization: string;
  licenseNumber: string;
  yearsExperience: string;
  practiceLocation: string;
  bio: string;
};

const emptyProfile: ProfileForm = {
  professionalTitle: '',
  specialization: '',
  licenseNumber: '',
  yearsExperience: '',
  practiceLocation: '',
  bio: '',
};

export default function TherapistPortal({ onBack, onHome }: Props) {
  const [clientCount, setClientCount] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);
  const [isActive, setIsActive] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile);
  const [profileDraft, setProfileDraft] = useState<ProfileForm>(emptyProfile);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const userId = getStoredUserId();

  useEffect(() => {
    if (!supabase || !userId) return;
    Promise.all([
      supabase.from('therapist_client_relationships').select('id', { count: 'exact', head: true }).eq('therapist_id', userId).eq('status', 'active'),
      supabase.from('therapy_sessions').select('id', { count: 'exact', head: true }).eq('therapist_id', userId).eq('status', 'scheduled'),
      supabase.from('therapist_profiles').select('*').eq('user_id', userId).maybeSingle(),
    ]).then(([clients, sessions, therapist]) => {
      setClientCount(clients.count ?? 0);
      setSessionCount(sessions.count ?? 0);
      const row = therapist.data as Record<string, unknown> | null;
      if (row) {
        const next: ProfileForm = {
          professionalTitle: String(row.professional_title ?? ''),
          specialization: String(row.specialization ?? ''),
          licenseNumber: String(row.license_number ?? ''),
          yearsExperience: row.years_experience == null ? '' : String(row.years_experience),
          practiceLocation: String(row.practice_location ?? ''),
          bio: String(row.bio ?? ''),
        };
        setProfile(next);
        setProfileDraft(next);
        if (row.is_accepting_clients !== undefined && row.is_accepting_clients !== null) setIsActive(Boolean(row.is_accepting_clients));
      }
    });
  }, [userId]);

  useEffect(() => {
    if (supabase && userId) return;
    const saved = localStorage.getItem('therafam:therapist-active');
    if (saved !== null) setIsActive(saved === 'true');
    const savedProfile = localStorage.getItem('therafam:therapist-profile');
    if (savedProfile) {
      try {
        const next = JSON.parse(savedProfile) as ProfileForm;
        setProfile(next);
        setProfileDraft(next);
      } catch { /* ignore invalid demo data */ }
    }
  }, [userId]);

  async function toggleActive() {
    const next = !isActive;
    setIsActive(next);
    setSavingStatus(true);
    setStatusMessage('');
    try {
      if (supabase && userId) {
        const { error } = await supabase.from('therapist_profiles').update({ is_accepting_clients: next, updated_at: new Date().toISOString() }).eq('user_id', userId);
        if (error) throw error;
      } else {
        localStorage.setItem('therafam:therapist-active', String(next));
      }
      setStatusMessage(next ? 'You are now accepting clients.' : 'You are now unavailable for new clients.');
    } catch (error) {
      setIsActive(!next);
      setStatusMessage(error instanceof Error ? error.message : 'Could not update your availability.');
    } finally { setSavingStatus(false); }
  }

  function openPanel(next: Panel) {
    setPanel(next);
    setStatusMessage('');
    if (next === 'profile') {
      setProfileDraft(profile);
      setEditingProfile(false);
    }
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    setStatusMessage('');
    try {
      const next = { ...profileDraft, yearsExperience: profileDraft.yearsExperience.trim() };
      if (supabase && userId) {
        const { error } = await supabase.from('therapist_profiles').update({
          professional_title: next.professionalTitle.trim(),
          specialization: next.specialization.trim(),
          license_number: next.licenseNumber.trim(),
          years_experience: next.yearsExperience === '' ? null : Number(next.yearsExperience),
          practice_location: next.practiceLocation.trim(),
          bio: next.bio.trim(),
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId);
        if (error) throw error;
      } else {
        localStorage.setItem('therafam:therapist-profile', JSON.stringify(next));
      }
      setProfile(next);
      setProfileDraft(next);
      setEditingProfile(false);
      setStatusMessage('Professional profile updated successfully.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not save your profile.');
    } finally { setSavingProfile(false); }
  }

  const field = (key: keyof ProfileForm, label: string, placeholder: string) => (
    <label className="therapist-field">{label}
      <input value={profileDraft[key]} disabled={!editingProfile} onChange={event => setProfileDraft(current => ({ ...current, [key]: event.target.value }))} placeholder={placeholder} />
    </label>
  );

  return (
    <section className="workspace-shell therapist-workspace">
      <header className="workspace-topbar">
        <button className="workspace-brand" onClick={onHome} aria-label="Go home"><Brand compact /></button>
        <div className="therapist-topbar-actions">
          <button className="text-link" onClick={() => openPanel('profile')}>My profile</button>
          <button className="text-link" onClick={onBack}>Return to client area</button>
        </div>
      </header>
      <div className="workspace-content">
        <div className="workspace-heading">
          <div><span className="eyebrow">Professional portal</span><h1>Therapist workspace</h1><p>Manage your client relationships, appointments, professional profile, and availability.</p></div>
          <div className="therapist-status-control">
            <span className={`status-dot ${isActive ? 'online' : 'offline'}`} aria-hidden="true"/>
            <div><strong>{isActive ? 'Active' : 'Offline'}</strong><small>{isActive ? 'Accepting new clients' : 'Not accepting new clients'}</small></div>
            <button className={`status-toggle ${isActive ? 'on' : 'off'}`} onClick={toggleActive} disabled={savingStatus} aria-pressed={isActive} aria-label={isActive ? 'Set therapist status to offline' : 'Set therapist status to active'}><span/></button>
          </div>
        </div>
        {statusMessage && <div className="status-feedback" role="status">{statusMessage}</div>}

        <div className="dashboard-grid">
          <article className="dashboard-card"><span className="eyebrow">Active clients</span><strong className="workspace-stat">{clientCount}</strong><p>Clients currently assigned to your care.</p><button className="outline-action" onClick={() => openPanel('clients')}>View clients</button></article>
          <article className="dashboard-card"><span className="eyebrow">Upcoming sessions</span><strong className="workspace-stat">{sessionCount}</strong><p>Scheduled sessions requiring attention.</p><button className="outline-action" onClick={() => openPanel('schedule')}>View schedule</button></article>
          <article className="dashboard-card"><span className="eyebrow">Professional status</span><strong className="status-text">{isActive ? 'Active' : 'Offline'}</strong><p>{isActive ? 'You are currently available to accept new client requests.' : 'You are currently unavailable for new client requests.'}</p><button className="outline-action" onClick={() => openPanel('profile')}>Edit professional profile</button></article>
        </div>

        <div className="therapist-columns">
          <section className="dashboard-card"><div className="card-heading"><strong>Today</strong><span>Schedule</span></div><div className="empty-state compact"><span>◷</span><strong>{sessionCount ? `${sessionCount} upcoming session${sessionCount === 1 ? '' : 's'}` : 'No sessions loaded'}</strong><p>{sessionCount ? 'Open your schedule to review upcoming appointments.' : 'Your appointments will appear here when scheduling data is available.'}</p><button className="outline-action" onClick={() => openPanel('schedule')}>Open schedule</button></div></section>
          <section className="dashboard-card"><div className="card-heading"><strong>Care workflow</strong><span>Secure</span></div><div className="workflow-list"><button onClick={() => openPanel('notes')}>Review client notes <span>→</span></button><button onClick={() => openPanel('availability')}>Update availability <span>→</span></button><button onClick={() => openPanel('messages')}>Open secure messages <span>→</span></button></div></section>
        </div>

        {panel && <section className="settings-card therapist-action-panel" aria-live="polite">
          <div className="support-panel-header"><div><span className="eyebrow">Therapist workspace</span><h2>{panelTitle(panel)}</h2></div><button className="icon-action" onClick={() => setPanel(null)} aria-label="Close">×</button></div>
          {panel === 'profile' ? (
            <form className="therapist-profile-editor" onSubmit={saveProfile}>
              <div className="profile-editor-grid">
                {field('professionalTitle', 'Professional title', 'e.g. Clinical Psychologist')}
                {field('specialization', 'Specialization', 'e.g. CBT & Anxiety')}
                {field('licenseNumber', 'Registration / license number', 'Professional registration number')}
                <label className="therapist-field">Years of experience<input type="number" min="0" max="70" disabled={!editingProfile} value={profileDraft.yearsExperience} onChange={event => setProfileDraft(current => ({ ...current, yearsExperience: event.target.value }))} placeholder="e.g. 5" /></label>
                {field('practiceLocation', 'Country / State of practice', 'e.g. Nigeria, Kaduna State')}
              </div>
              <label className="therapist-field">Professional bio<textarea rows={5} maxLength={500} disabled={!editingProfile} value={profileDraft.bio} onChange={event => setProfileDraft(current => ({ ...current, bio: event.target.value }))} placeholder="Briefly describe your experience and approach..." /></label>
              <div className="panel-actions">
                {!editingProfile ? <button type="button" className="primary-action" onClick={() => setEditingProfile(true)}>Edit profile</button> : <><button type="submit" className="primary-action" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save changes'}</button><button type="button" className="outline-action" onClick={() => { setProfileDraft(profile); setEditingProfile(false); }}>Cancel</button></>}
                <button type="button" className="outline-action" onClick={() => setPanel(null)}>Close</button>
              </div>
            </form>
          ) : (
            <>
              <p>{panelCopy(panel)}</p>
              <div className="panel-actions"><button className="primary-action" onClick={() => panel === 'availability' ? toggleActive() : panel === 'messages' ? setStatusMessage('Secure messaging is ready for the connected messaging service.') : setStatusMessage('This workspace action is ready for backend data when available.')}>{panel === 'availability' ? (isActive ? 'Set offline' : 'Set active') : panel === 'messages' ? 'Check messages' : 'Refresh'}</button><button className="outline-action" onClick={() => setPanel(null)}>Close</button></div>
            </>
          )}
        </section>}
      </div>
    </section>
  );
}

function panelTitle(panel: Exclude<Panel, null>) { return panel === 'clients' ? 'Client relationships' : panel === 'schedule' ? 'Session schedule' : panel === 'profile' ? 'Professional profile' : panel === 'notes' ? 'Client notes' : panel === 'availability' ? 'Availability' : 'Secure messages'; }
function panelCopy(panel: Exclude<Panel, null>) { if (panel === 'clients') return 'Your active client list will appear here when therapist relationships are connected to your account.'; if (panel === 'schedule') return 'Your scheduled therapy sessions will appear here when appointment data is connected.'; if (panel === 'notes') return 'Client notes are intentionally kept behind the authenticated therapist workflow. Connect the secure notes endpoint to load them here.'; if (panel === 'availability') return 'Control whether new clients can request your services. Your current availability is shown above.'; return 'Secure therapist-client messages will appear here when the messaging workflow is connected.'; }
