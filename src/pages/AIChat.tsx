import { T, translate } from '../lib/i18n';
import { FormEvent, useEffect, useState } from 'react';
import Brand from '../components/Brand';
import { getAiChatHistory, getStoredUserId, sendAiMessage, type ChatMessage } from '../lib/therafamApi';

type Props = { onBack: () => void; onHome: () => void };

export default function AIChat({ onBack, onHome }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hello. I’m Therafam AI. You can use this space to reflect, ask questions, or work through a challenge at your own pace.' },
  ]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [historyNotice, setHistoryNotice] = useState('');
  const [historyLoading, setHistoryLoading] = useState(true);
  const userId = getStoredUserId();

  useEffect(() => {
    let active = true;
    if (!userId) { setHistoryLoading(false); return () => { active = false; }; }
    getAiChatHistory(userId).then((items) => {
      if (!active || !items.length) return;
      const restored: ChatMessage[] = [];
      for (const item of items) {
        if (item.input_text) restored.push({ role: 'user', content: item.input_text, created_at: item.created_at });
        if (item.response_text) restored.push({ role: 'assistant', content: item.response_text, created_at: item.created_at });
      }
      if (restored.length) setMessages(restored);
    }).catch(() => {
      if (active) setHistoryNotice('Saved conversation history could not be loaded from your account.');
    }).finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [userId]);

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
      const result = await sendAiMessage(message, messages, userId);
      setMessages((current) => [...current, { role: 'assistant', content: result.response }]);
      if (result.history_saved === false) setHistoryNotice('Your reply was generated, but this exchange could not be saved to your account.');
      else setHistoryNotice('');
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
        <button className="text-link" onClick={onBack}><T>Back to dashboard</T></button>
      </header>
      <div className="ai-layout">
        <aside className="ai-info-card">
          <span className="ai-orb">✦</span>
          <span className="eyebrow"><T>Therafam AI</T></span>
          <h1><T>A private space to talk.</T></h1>
          <p><T>Therafam AI is designed for supportive conversations and practical wellbeing guidance. It does not replace a licensed mental health professional.</T></p>
          <div className="ai-note"><strong><T>Privacy first</T></strong><span><T>Save or delete conversations according to your account settings.</T></span></div>
          <button className="outline-action" onClick={() => setMessages([{ role: 'assistant', content: 'We can start fresh. What would you like to focus on today?' }])}><T>New conversation</T></button>
        </aside>

        <div className="chat-panel">
          <div className="chat-header"><div><strong><T>Therafam AI</T></strong><span><T>Supportive conversation</T></span></div><span className="online-dot"><T>Available</T></span></div>
          <div className="chat-messages">
            {messages.map((message, index) => <div key={index} className={`chat-bubble ${message.role === 'user' ? 'chat-user' : 'chat-ai'}`}><T>{message.content}</T></div>)}
            {sending && <div className="chat-bubble chat-ai"><T>Thinking…</T></div>}
          </div>
          {historyLoading && <div className="loading-copy"><T>Loading saved conversation…</T></div>}{historyNotice && <div className="chat-error"><T>{historyNotice}</T></div>}{error && <div className="chat-error"><T>{error}</T></div>}
          <form className="chat-composer" onSubmit={submit}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={translate("Write what’s on your mind…")} aria-label={translate("Message Therafam AI")} />
            <button className="primary-action" type="submit" disabled={sending || !draft.trim()}><T>{sending ? 'Sending…' : 'Send'}</T></button>
          </form>
          <p className="disclaimer-copy"><T>For urgent safety concerns, seek immediate help from a trusted person or local emergency service. Therafam AI is not an emergency service.</T></p>
        </div>
      </div>
    </section>
  );
}
