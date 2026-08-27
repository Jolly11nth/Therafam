import { useEffect, useState } from 'react';
import Brand from '../components/Brand';
import { supabase } from '../lib/supabase';
import { getStoredUserId } from '../lib/therafamApi';

type Props = { onBack: () => void; onHome: () => void };
type Panel = 'clients' | 'schedule' | 'profile' | 'notes' | 'availability' | 'messages' | null;

export default function TherapistPortal({ onBack, onHome }: Props) {
  const [clientCount, setClientCount] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);
  const [isActive, setIsActive] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const userId = getStoredUserId();

  useEffect(() => {
    if (!supabase || !userId) return;
    Promise.all([
      supabase.from('therapist_client_relationships').select('id', { count: 'exact', head: true }).eq('therapist_id', userId).eq('status', 'active'),
      supabase.from('therapy_sessions').select('id', { count: 'exact', head: true }).eq('therapist_id', userId).eq('status', 'scheduled'),
      supabase.from('therapist_profiles').select('is_accepting_clients').eq('user_id', userId).maybeSingle(),
    ]).then(([clients, sessions, profile]) => {
      setClientCount(clients.count ?? 0);
      setSessionCount(sessions.count ?? 0);
      if (profile.data?.is_accepting_clients !== undefined && profile.data?.is_accepting_clients !== null) setIsActive(Boolean(profile.data.is_accepting_clients));
    });
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

  useEffect(() => {
    if (supabase && userId) return;
    const saved = localStorage.getItem('therafam:therapist-active');
    if (saved !== null) setIsActive(saved === 'true');
  }, [userId]);

  return (
    <section className="workspace-shell therapist-workspace">
      <header className="workspace-topbar"><button className="workspace-brand" onClick={onHome} aria-label="Go home"><Brand compact /></button><button className="text-link" onClick={onBack}>Return to client area</button></header>
      <div className="workspace-content">
        <div className="workspace-heading"><div><span className="eyebrow">Professional portal</span><h1>Therapist workspace</h1><p>Manage your client relationships, appointments, and professional workflow securely.</p></div><div className="therapist-status-control"><span className={`status-dot ${isActive ? 'online' : 'offline'}`} aria-hidden="true"/><div><strong>{isActive ? 'Active' : 'Offline'}</strong><small>{isActive ? 'Accepting new clients' : 'Not accepting new clients'}</small></div><button className={`status-toggle ${isActive ? 'on' : 'off'}`} onClick={toggleActive} disabled={savingStatus} aria-pressed={isActive} aria-label={isActive ? 'Set therapist status to offline' : 'Set therapist status to active'}><span/></button></div></div>
        {statusMessage && <div className="status-feedback" role="status">{statusMessage}</div>}
        <div className="dashboard-grid">
          <article className="dashboard-card"><span className="eyebrow">Active clients</span><strong className="workspace-stat">{clientCount}</strong><p>Clients currently assigned to your care.</p><button className="outline-action" onClick={() => setPanel('clients')}>View clients</button></article>
          <article className="dashboard-card"><span className="eyebrow">Upcoming sessions</span><strong className="workspace-stat">{sessionCount}</strong><p>Scheduled sessions requiring attention.</p><button className="outline-action" onClick={() => setPanel('schedule')}>View schedule</button></article>
          <article className="dashboard-card"><span className="eyebrow">Professional status</span><strong className="status-text">{isActive ? 'Active' : 'Offline'}</strong><p>{isActive ? 'You are currently available to accept new client requests.' : 'You are currently unavailable for new client requests.'}</p><button className="outline-action" onClick={() => setPanel('profile')}>Manage profile</button></article>
        </div>
        <div className="therapist-columns">
          <section className="dashboard-card"><div className="card-heading"><strong>Today</strong><span>Schedule</span></div><div className="empty-state compact"><span>◷</span><strong>No sessions loaded</strong><p>Connect your therapist account to load your appointments from Supabase.</p></div></section>
          <section className="dashboard-card"><div className="card-heading"><strong>Care workflow</strong><span>Secure</span></div><div className="workflow-list"><button onClick={() => setPanel('notes')}>Review client notes <span>→</span></button><button onClick={() => setPanel('availability')}>Update availability <span>→</span></button><button onClick={() => setPanel('messages')}>Open secure messages <span>→</span></button></div></section>
        </div>
        {panel && <section className="settings-card therapist-action-panel"><div className="support-panel-header"><div><span className="eyebrow">Therapist workspace</span><h2>{panelTitle(panel)}</h2></div><button className="icon-action" onClick={() => setPanel(null)} aria-label="Close">×</button></div><p>{panelCopy(panel)}</p><button className="outline-action" onClick={() => setPanel(null)}>Close</button></section>}
      </div>
    </section>
  );
}

function panelTitle(panel: Panel) { return panel === 'clients' ? 'Client relationships' : panel === 'schedule' ? 'Session schedule' : panel === 'profile' ? 'Professional profile' : panel === 'notes' ? 'Client notes' : panel === 'availability' ? 'Availability' : 'Secure messages'; }
function panelCopy(panel: Panel) { if (panel === 'clients') return 'Your active client list will appear here when therapist relationships are connected to your account.'; if (panel === 'schedule') return 'Your scheduled therapy sessions will appear here when appointment data is connected.'; if (panel === 'profile') return 'Professional profile editing can be connected to your therapist profile record and verification workflow.'; if (panel === 'notes') return 'Client notes are intentionally kept behind the authenticated therapist workflow. Connect the secure notes endpoint to load them here.'; if (panel === 'availability') return 'Availability management will update the therapist scheduling records once the scheduling workflow is connected.'; return 'Secure therapist-client messages will appear here when the messaging workflow is connected.'; }
