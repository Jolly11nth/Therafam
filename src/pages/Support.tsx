import { T, translate } from '../lib/i18n';
import { T, translate } from '../lib/i18n';
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
        <button className="workspace-brand" onClick={onHome} aria-label={translate("Go home")}><Brand compact /></button>
        <button className="text-link" onClick={onBack}><T><T>Back to dashboard</T></T></button>
      </header>
      <div className="workspace-content narrow-content">
        <div className="workspace-heading">
          <div>
            <span className="eyebrow"><T><T>Help & care</T></T></span>
            <h1><T><T>Support</T></T></h1>
            <p><T><T>Get help using Therafam, report a problem, or find the right next step.</T></T></p>
          </div>
        </div>
        <div className="settings-grid support-grid">
          <section className="settings-card"><h2><T><T>Help & FAQs</T></T></h2><p><T><T>Find answers about your account, privacy, AI conversations, mood check-ins, and programs.</T></T></p><button className="outline-action" type="button" onClick={() => openPanel('faq')}><T><T>View FAQs</T></T></button></section>
          <section className="settings-card"><h2><T><T>Contact support</T></T></h2><p><T><T>Need help with the app? Send the Therafam support team a message.</T></T></p><button className="primary-action" type="button" onClick={() => openPanel('contact')}><T><T>Contact support</T></T></button></section>
          <section className="settings-card"><h2><T><T>Report a problem</T></T></h2><p><T><T>Tell us when something is not working as expected so it can be investigated.</T></T></p><button className="outline-action" type="button" onClick={() => openPanel('report')}><T><T>Report an issue</T></T></button></section>
          <section className="settings-card"><h2><T><T>Safety & privacy</T></T></h2><p><T><T>Learn how Therafam handles your information and where to get urgent help when you need immediate support.</T></T></p><button className="outline-action" type="button" onClick={() => openPanel('safety')}><T><T>View safety information</T></T></button></section>
        </div>

        {panel && (
          <section className="support-panel settings-card" aria-live="polite">
            <div className="support-panel-header"><div><span className="eyebrow"><T><T>Support</T></T></span><h2><T><T>{panel === 'faq' ? 'Frequently asked questions' : panel === 'contact' ? 'Contact support' : panel === 'report' ? 'Report a problem' : 'Safety & privacy'}</T></T></h2></div><button className="icon-action" type="button" onClick={() => setPanel(null)} aria-label={translate("Close support panel")}>×</button></div>
            {panel === 'faq' && <div className="support-content"><details open><summary><T><T>Is my information private?</T></T></summary><p><T><T>Therafam is designed to keep account and wellbeing information private. Review your account privacy settings for available controls.</T></T></p></details><details><summary><T><T>Can I use Therafam anonymously?</T></T></summary><p><T><T>Yes. Anonymous mode lets you explore supported features without creating a persistent account.</T></T></p></details><details><summary><T><T>Can Therafam AI replace a therapist?</T></T></summary><p><T><T>No. The AI provides supportive wellbeing guidance and is not a substitute for a licensed mental health professional.</T></T></p></details></div>}
            {panel === 'safety' && <div className="support-content"><p><T><T>Use Therafam as a wellbeing support tool, not as an emergency service. For immediate danger or urgent safety concerns, contact a trusted person or your local emergency service.</T></T></p><p><T><T>For privacy questions, review your account privacy controls or contact the support team.</T></T></p></div>}
            {(panel === 'contact' || panel === 'report') && (
              <form className="support-form" onSubmit={submitSupport}>
                <label><span><T><T>{panel === 'report' ? 'What went wrong?' : 'How can we help?'}</T></T></span><textarea required rows={5} placeholder={panel === 'report' ? 'Describe the problem and what you expected to happen…' : 'Tell us what you need help with…'} /></label>
                <div className="support-form-actions"><button className="outline-action" type="button" onClick={() => setPanel(null)}><T><T>Cancel</T></T></button><button className="primary-action" type="submit"><T><T>{panel === 'report' ? 'Submit report' : 'Send message'}</T></T></button></div>
                {sent && <p className="form-message"><T><T>Thanks. Your message has been recorded in this session. Backend submission can be connected to the support endpoint next.</T></T></p>}
              </form>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
