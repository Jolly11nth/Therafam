import { FormEvent, useState } from 'react';
import Brand from '../components/Brand';
import { sendAiMessage, type ChatMessage } from '../lib/therafamApi';

type Props = { onBack: () => void; onHome: () => void };

export default function AIChat({ onBack, onHome }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hello. I’m Therafam AI. You can use this space to reflect, ask questions, or work through a challenge at your own pace.' },
  ]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending) return;
    setError('');
    setDraft('');
    const next = [...messages, { role: 'user' as const, content: message }];
    setMessages(next);
    setSending(true);
    try {
      const result = await sendAiMessage(message, next);
      setMessages((current) => [...current, { role: 'assistant', content: result.response }]);
    } catch {
      setError('The AI service could not be reached. Your conversation is still visible here; try again when the backend is available.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="workspace-shell ai-shell">
      <header className="workspace-topbar">
        <button className="workspace-brand" onClick={onHome}><Brand compact /></button>
        <button className="text-link" onClick={onBack}>Back to dashboard</button>
      </header>
      <div className="ai-layout">
        <aside className="ai-info-card">
          <span className="ai-orb">✦</span>
          <span className="eyebrow">Therafam AI</span>
          <h1>A private space to talk.</h1>
          <p>Therafam AI is designed for supportive conversations and practical wellbeing guidance. It does not replace a licensed mental health professional.</p>
          <div className="ai-note"><strong>Privacy first</strong><span>Save or delete conversations according to your account settings.</span></div>
          <button className="outline-action" onClick={() => setMessages([{ role: 'assistant', content: 'We can start fresh. What would you like to focus on today?' }])}>New conversation</button>
        </aside>

        <div className="chat-panel">
          <div className="chat-header"><div><strong>Therafam AI</strong><span>Supportive conversation</span></div><span className="online-dot">Available</span></div>
          <div className="chat-messages">
            {messages.map((message, index) => <div key={index} className={`chat-bubble ${message.role === 'user' ? 'chat-user' : 'chat-ai'}`}>{message.content}</div>)}
            {sending && <div className="chat-bubble chat-ai">Thinking…</div>}
          </div>
          {error && <div className="chat-error">{error}</div>}
          <form className="chat-composer" onSubmit={submit}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write what’s on your mind…" aria-label="Message Therafam AI" />
            <button className="primary-action" type="submit" disabled={sending || !draft.trim()}>{sending ? 'Sending…' : 'Send'}</button>
          </form>
          <p className="disclaimer-copy">For urgent safety concerns, seek immediate help from a trusted person or local emergency service. Therafam AI is not an emergency service.</p>
        </div>
      </div>
    </section>
  );
}
