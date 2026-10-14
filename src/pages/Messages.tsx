import { T, translate } from '../lib/i18n';
import { T, translate } from '../lib/i18n';
import { useEffect, useState } from 'react';
import Brand from '../components/Brand';
import { supabase } from '../lib/supabase';
import { getStoredUserId } from '../lib/therafamApi';

type Props = { onBack: () => void; onHome: () => void };
type Message = { id: string; message_text: string; sender_id: string | null; created_at: string };
type SupabaseResult<T> = { data: T | null; error: Error | null; count?: number | null };

export default function Messages({ onBack, onHome }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const userId = getStoredUserId();

  useEffect(() => {
    if (!supabase || !userId) return;
    void (async () => {
      const query = supabase
        .from('chat_messages')
        .select('id,message_text,sender_id,created_at')
        .eq('conversation_type', 'therapist_chat')
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('created_at', { ascending: true })
        .limit(100);
      const result = await (query as unknown as Promise<SupabaseResult<Message[]>>);
      if (result.error) setError('Messages are not available yet. Check your account connection.');
      else setMessages(result.data ?? []);
    })();
  }, [userId]);

  async function send() {
    const text = draft.trim();
    if (!text || !supabase || !userId) return;
    const query = supabase
      .from('chat_messages')
      .insert({ conversation_type: 'therapist_chat', sender_id: userId, message_text: text })
      .select('id,message_text,sender_id,created_at')
      .single();
    const result = await (query as unknown as Promise<SupabaseResult<Message>>);
    if (result.error) setError('Your message could not be sent.');
    else if (result.data) { setMessages((current) => [...current, result.data as Message]); setDraft(''); }
  }

  return (
    <section className="workspace-shell">
      <header className="workspace-topbar"><button className="workspace-brand" onClick={onHome}><Brand compact /></button><button className="text-link" onClick={onBack}><T><T>Back to dashboard</T></T></button></header>
      <div className="workspace-content narrow-content">
        <div className="workspace-heading"><div><span className="eyebrow"><T><T>Private communication</T></T></span><h1><T><T>Secure messages</T></T></h1><p><T><T>Keep conversations with your care team in one place.</T></T></p></div></div>
        <section className="messages-card">
          <div className="messages-header"><strong><T><T>Care team</T></T></strong><span><T><T>Secure conversation</T></T></span></div>
          <div className="message-list">
            {messages.length ? messages.map((message) => <div key={message.id} className={`message-item ${message.sender_id === userId ? 'mine' : ''}`}><span><T><T>{message.message_text}</T></T></span><small><T><T>{new Date(message.created_at).toLocaleString()}</T></T></small></div>) : <div className="empty-state"><span>♡</span><strong><T><T>No messages yet</T></T></strong><p><T><T>When a therapist is connected to your account, secure messages will appear here.</T></T></p></div>}
          </div>
          {error && <div className="form-error"><T><T>{error}</T></T></div>}
          <div className="message-composer"><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={userId ? 'Write a message…' : 'Sign in to send a message'} disabled={!userId} /><button className="primary-action" onClick={send} disabled={!userId || !draft.trim()}><T><T>Send</T></T></button></div>
        </section>
      </div>
    </section>
  );
}
