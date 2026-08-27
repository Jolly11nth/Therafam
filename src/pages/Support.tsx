import { useState } from 'react';
import Brand from '../components/Brand';

type Props = { onBack: () => void; onHome: () => void };
type SupportPanel = 'faq' | 'contact' | 'report' | 'safety' | null;

export default function Support({ onBack, onHome }: Props) {
  const [panel, setPanel] = useState<SupportPanel>(null);
  const [sent, setSent] = useState(false);

  function openPanel(next: Exclude<SupportPanel, null>) {
    setSent(false);
    setPanel(next);
  }

  function submitSupport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
  }

  return (
    <section className="workspace-shell">
      <header className="workspace-topbar">
        <button className="workspace-brand" onClick={onHome} aria-label="Go home"><Brand compact /></button>
        <button className="text-link" onClick={onBack}>Back to dashboard</button>
      </header>
      <div className="workspace-content narrow-content">
        <div className="workspace-heading">
          <div>
            <span className="eyebrow">Help & care</span>
            <h1>Support</h1>
            <p>Get help using Therafam, report a problem, or find the right next step.</p>
          </div>
        </div>
        <div className="settings-grid support-grid">
          <section className="settings-card"><h2>Help & FAQs</h2><p>Find answers about your account, privacy, AI conversations, mood check-ins, and programs.</p><button className="outline-action" type="button" onClick={() => openPanel('faq')}>View FAQs</button></section>
          <section className="settings-card"><h2>Contact support</h2><p>Need help with the app? Send the Therafam support team a message.</p><button className="primary-action" type="button" onClick={() => openPanel('contact')}>Contact support</button></section>
          <section className="settings-card"><h2>Report a problem</h2><p>Tell us when something is not working as expected so it can be investigated.</p><button className="outline-action" type="button" onClick={() => openPanel('report')}>Report an issue</button></section>
          <section className="settings-card"><h2>Safety & privacy</h2><p>Learn how Therafam handles your information and where to get urgent help when you need immediate support.</p><button className="outline-action" type="button" onClick={() => openPanel('safety')}>View safety information</button></section>
        </div>

        {panel && (
          <section className="support-panel settings-card" aria-live="polite">
            <div className="support-panel-header"><div><span className="eyebrow">Support</span><h2>{panel === 'faq' ? 'Frequently asked questions' : panel === 'contact' ? 'Contact support' : panel === 'report' ? 'Report a problem' : 'Safety & privacy'}</h2></div><button className="icon-action" type="button" onClick={() => setPanel(null)} aria-label="Close support panel">×</button></div>
            {panel === 'faq' && <div className="support-content"><details open><summary>Is my information private?</summary><p>Therafam is designed to keep account and wellbeing information private. Review your account privacy settings for available controls.</p></details><details><summary>Can I use Therafam anonymously?</summary><p>Yes. Anonymous mode lets you explore supported features without creating a persistent account.</p></details><details><summary>Can Therafam AI replace a therapist?</summary><p>No. The AI provides supportive wellbeing guidance and is not a substitute for a licensed mental health professional.</p></details></div>}
            {panel === 'safety' && <div className="support-content"><p>Use Therafam as a wellbeing support tool, not as an emergency service. For immediate danger or urgent safety concerns, contact a trusted person or your local emergency service.</p><p>For privacy questions, review your account privacy controls or contact the support team.</p></div>}
            {(panel === 'contact' || panel === 'report') && (
              <form className="support-form" onSubmit={submitSupport}>
                <label><span>{panel === 'report' ? 'What went wrong?' : 'How can we help?'}</span><textarea required rows={5} placeholder={panel === 'report' ? 'Describe the problem and what you expected to happen…' : 'Tell us what you need help with…'} /></label>
                <div className="support-form-actions"><button className="outline-action" type="button" onClick={() => setPanel(null)}>Cancel</button><button className="primary-action" type="submit">{panel === 'report' ? 'Submit report' : 'Send message'}</button></div>
                {sent && <p className="form-message">Thanks. Your message has been recorded in this session. Backend submission can be connected to the support endpoint next.</p>}
              </form>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
