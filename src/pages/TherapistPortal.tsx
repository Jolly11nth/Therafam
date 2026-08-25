import { useEffect, useState } from 'react';
import Brand from '../components/Brand';
import { supabase } from '../lib/supabase';
import { getStoredUserId } from '../lib/therafamApi';

type Props = { onBack: () => void; onHome: () => void };

export default function TherapistPortal({ onBack, onHome }: Props) {
  const [clientCount, setClientCount] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const userId = getStoredUserId();

  useEffect(() => {
    if (!supabase || !userId) return;
    Promise.all([
      supabase.from('therapist_client_relationships').select('id', { count: 'exact', head: true }).eq('therapist_id', userId).eq('status', 'active'),
      supabase.from('therapy_sessions').select('id', { count: 'exact', head: true }).eq('therapist_id', userId).eq('status', 'scheduled'),
    ]).then(([clients, sessions]) => {
      setClientCount(clients.count ?? 0);
      setSessionCount(sessions.count ?? 0);
    });
  }, [userId]);

  return (
    <section className="workspace-shell therapist-workspace">
      <header className="workspace-topbar"><button className="workspace-brand" onClick={onHome}><Brand compact /></button><button className="text-link" onClick={onBack}>Return to client area</button></header>
      <div className="workspace-content">
        <div className="workspace-heading"><div><span className="eyebrow">Professional portal</span><h1>Therapist workspace</h1><p>Manage your client relationships, appointments, and professional workflow securely.</p></div><span className="verified-badge">Professional access</span></div>
        <div className="dashboard-grid">
          <article className="dashboard-card"><span className="eyebrow">Active clients</span><strong className="workspace-stat">{clientCount}</strong><p>Clients currently assigned to your care.</p><button className="outline-action">View clients</button></article>
          <article className="dashboard-card"><span className="eyebrow">Upcoming sessions</span><strong className="workspace-stat">{sessionCount}</strong><p>Scheduled sessions requiring attention.</p><button className="outline-action">View schedule</button></article>
          <article className="dashboard-card"><span className="eyebrow">Professional status</span><strong className="status-text">Active</strong><p>Keep your availability and profile information current.</p><button className="outline-action">Manage profile</button></article>
        </div>
        <div className="therapist-columns">
          <section className="dashboard-card"><div className="card-heading"><strong>Today</strong><span>Schedule</span></div><div className="empty-state compact"><span>◷</span><strong>No sessions loaded</strong><p>Connect your therapist account to load your appointments from Supabase.</p></div></section>
          <section className="dashboard-card"><div className="card-heading"><strong>Care workflow</strong><span>Secure</span></div><div className="workflow-list"><button>Review client notes <span>→</span></button><button>Update availability <span>→</span></button><button>Open secure messages <span>→</span></button></div></section>
        </div>
      </div>
    </section>
  );
}
