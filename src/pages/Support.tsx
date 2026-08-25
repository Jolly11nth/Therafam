import Brand from '../components/Brand';

type Props = { onBack: () => void; onHome: () => void };

export default function Support({ onBack, onHome }: Props) {
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
          <section className="settings-card"><h2>Help & FAQs</h2><p>Find answers about your account, privacy, AI conversations, mood check-ins, and programs.</p><button className="outline-action" type="button">View FAQs</button></section>
          <section className="settings-card"><h2>Contact support</h2><p>Need help with the app? Send the Therafam support team a message.</p><button className="primary-action" type="button">Contact support</button></section>
          <section className="settings-card"><h2>Report a problem</h2><p>Tell us when something is not working as expected so it can be investigated.</p><button className="outline-action" type="button">Report an issue</button></section>
          <section className="settings-card"><h2>Safety & privacy</h2><p>Learn how Therafam handles your information and where to get urgent help when you need immediate support.</p><button className="outline-action" type="button">View safety information</button></section>
        </div>
      </div>
    </section>
  );
}
