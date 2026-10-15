import { T, translate } from '../lib/i18n';
import { useEffect, useState } from 'react';
import Brand from '../components/Brand';
import { getMoodEntries, getStoredUserId, saveMoodEntry, type MoodEntry } from '../lib/therafamApi';

type Props = { onBack: () => void; onHome: () => void };
const moods = [
  { value: 1, label: 'Very low' },
  { value: 2, label: 'Low' },
  { value: 3, label: 'Okay' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Very good' },
];

export default function MoodCheckIn({ onBack, onHome }: Props) {
  const userId = getStoredUserId();
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(5);
  const [stress, setStress] = useState(5);
  const [note, setNote] = useState('');
  const [history, setHistory] = useState<MoodEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    let active = true;
    if (!userId) { setHistoryLoading(false); return () => { active = false; }; }
    setHistoryLoading(true);
    setHistoryError('');
    getMoodEntries(userId, 7).then((entries) => { if (active) setHistory(entries); })
      .catch((error) => { if (active) setHistoryError(error instanceof Error ? error.message : 'Could not load saved mood history.'); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [userId]);

  async function save() {
    if (!userId) { setMessage('Sign in to save your check-in to PostgreSQL.'); return; }
    setSaving(true); setMessage('');
    try {
      const saved = await saveMoodEntry({ user_id: userId, mood_value: mood, mood_label: moods.find((item) => item.value === mood)?.label ?? 'Okay', energy_level: energy, stress_level: stress, notes: note || null, entry_date: new Date().toISOString().slice(0, 10) });
      setHistory((current) => [saved, ...current.filter((item) => item.entry_date !== saved.entry_date)]);
      setMessage('Your check-in was saved privately.');
      setNote('');
    } catch { setMessage('The check-in could not be saved. Please check your account connection.'); }
    finally { setSaving(false); }
  }

  return (
    <section className="workspace-shell">
      <header className="workspace-topbar"><button className="workspace-brand" onClick={onHome}><Brand compact /></button><button className="text-link" onClick={onBack}><T>Back to dashboard</T></button></header>
      <div className="workspace-content narrow-content">
        <div className="workspace-heading"><div><span className="eyebrow"><T>Daily reflection</T></span><h1><T>How are you feeling?</T></h1><p><T>A quick check-in can help you notice patterns without judging yourself.</T></p></div></div>
        <div className="settings-grid">
          <section className="settings-card mood-form-card"><h2><T>Mood</T></h2><div className="mood-choice-grid">{moods.map((item) => <button key={item.value} className={mood === item.value ? 'mood-choice selected' : 'mood-choice'} onClick={() => setMood(item.value)}><strong><T>{item.value}</T></strong><span><T>{item.label}</T></span></button>)}</div><Range label="Energy" value={energy} onChange={setEnergy} /><Range label="Stress" value={stress} onChange={setStress} /><label className="mood-note"><span><T>Anything you want to remember?</T></span><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={translate("Optional note")} /></label><button className="primary-action mood-save" onClick={save} disabled={saving}><T>{saving ? 'Saving…' : 'Save check-in'}</T></button>{message && <p className="form-message"><T>{message}</T></p>}</section>
          <section className="settings-card"><h2><T>Recent check-ins</T></h2>{historyLoading && <p className="loading-copy"><T>Loading saved check-ins…</T></p>}{historyError && <div className="form-error" role="alert"><T>{historyError}</T></div>}{history.length ? <div className="mood-history">{history.map((entry) => <div className="mood-history-row" key={entry.id ?? entry.entry_date}><span><T>{new Date(entry.entry_date).toLocaleDateString()}</T></span><strong><T>{entry.mood_label}</T></strong><span>{entry.mood_value}/5</span></div>)}</div> : !historyLoading && !historyError ? <div className="empty-state compact"><span>♡</span><strong><T>No saved check-ins yet</T></strong><p><T>Your private mood history will appear here after your first saved check-in.</T></p></div>}</section>
        </div>
      </div>
    </section>
  );
}

function Range({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="range-control"><span><b><T>{label}</T></b><em>{value}/10</em></span><input type="range" min="1" max="10" value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>;
}
