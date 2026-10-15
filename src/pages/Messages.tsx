import { T, translate } from '../lib/i18n';
import { useEffect, useState } from 'react';
import Brand from '../components/Brand';
import { getMessageContacts, getMessagesWithContact, getStoredUserId, sendMessage, type CareMessage, type MessageContact } from '../lib/therafamApi';

type Props = { onBack: () => void; onHome: () => void; onFindTherapists: () => void };

function contactName(contact: MessageContact) {
  const name = `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim();
  return name || contact.email;
}

export default function Messages({ onBack, onHome, onFindTherapists }: Props) {
  const userId = getStoredUserId();
  const [contacts, setContacts] = useState<MessageContact[]>([]);
  const [contactId, setContactId] = useState('');
  const [messages, setMessages] = useState<CareMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!userId) {
      setError('Sign in to access account messages.');
      setLoadingContacts(false);
      return () => { active = false; };
    }
    getMessageContacts(userId).then((items) => {
      if (!active) return;
      setContacts(items);
      setContactId((current) => current && items.some((item) => item.id === current) ? current : items[0]?.id ?? '');
    }).catch((e) => {
      if (active) setError(e instanceof Error ? e.message : 'Could not load your care-team contacts.');
    }).finally(() => { if (active) setLoadingContacts(false); });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    let active = true;
    if (!userId || !contactId) {
      setMessages([]);
      setLoadingMessages(false);
      return () => { active = false; };
    }
    setLoadingMessages(true);
    setError('');
    getMessagesWithContact(contactId, userId).then((items) => {
      if (active) setMessages(items);
    }).catch((e) => {
      if (active) setError(e instanceof Error ? e.message : 'Messages could not be loaded.');
    }).finally(() => { if (active) setLoadingMessages(false); });
    return () => { active = false; };
  }, [userId, contactId]);

  async function send() {
    const text = draft.trim();
    if (!text || !userId || !contactId || sending) return;
    setSending(true);
    setError('');
    try {
      const result = await sendMessage(userId, contactId, text);
      setMessages((current) => [...current, result.message]);
      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your message could not be sent.');
    } finally {
      setSending(false);
    }
  }

  const selectedContact = contacts.find((contact) => contact.id === contactId);

  return (
    <section className="workspace-shell">
      <header className="workspace-topbar">
        <button className="workspace-brand" onClick={onHome}><Brand compact /></button>
        <button className="text-link" onClick={onBack}><T>Back to dashboard</T></button>
      </header>
      <div className="workspace-content narrow-content">
        <div className="workspace-heading">
          <div><span className="eyebrow"><T>Private communication</T></span><h1><T>Secure messages</T></h1><p><T>Messages are saved to your Therafam PostgreSQL account and limited to your active care-team relationships.</T></p></div>
        </div>
        <section className="messages-card">
          <div className="messages-header">
            <strong><T>Care team</T></strong>
            {contacts.length > 0 && (
              <label>
                <span className="visually-hidden"><T>Choose contact</T></span>
                <select aria-label={translate('Choose care-team contact')} value={contactId} onChange={(event) => setContactId(event.target.value)}>
                  {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contactName(contact)}</option>)}
                </select>
              </label>
            )}
          </div>
          <div className="message-list" aria-live="polite">
            {loadingContacts || loadingMessages ? <div className="empty-state"><strong><T>Loading messages…</T></strong></div>
              : contacts.length === 0 ? <div className="empty-state"><span>♡</span><strong><T>No active care-team contact yet</T></strong><p><T>After you connect with a therapist through a booking, that person will appear here.</T></p><button className="primary-action" onClick={onFindTherapists}><T>Find a therapist</T></button></div>
              : messages.length ? messages.map((message) => <div key={message.id} className={`message-item ${message.sender_id === userId ? 'mine' : ''}`}><span><T>{message.message_text}</T></span><small><T>{new Date(message.created_at).toLocaleString()}</T></small></div>)
              : <div className="empty-state"><span>♡</span><strong><T>No messages yet</T></strong><p><T>Start a conversation with</T> {selectedContact ? contactName(selectedContact) : <T>your care team</T>}.</p></div>}
          </div>
          {error && <div className="form-error"><T>{error}</T></div>}
          <form className="message-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={contactId ? 'Write a message…' : 'Connect with a therapist first'} disabled={!contactId || sending} aria-label={translate('Write a message')} />
            <button className="primary-action" type="submit" disabled={!contactId || !draft.trim() || sending}><T>{sending ? 'Sending…' : 'Send'}</T></button>
          </form>
        </section>
      </div>
    </section>
  );
}
