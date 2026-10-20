import { T, translate } from '../lib/i18n';
import { useEffect, useMemo, useState } from 'react';
import Brand from '../components/Brand';
import { getMoodEntries, getStoredUserId, saveMoodEntry, type MoodEntry } from '../lib/therafamApi';

type Props = { onBack: () => void; onHome: () => void };

const moods = [
  { value: 1, label: 'Very low', detail: 'Today feels heavy.', tone: 'rose' },
  { value: 2, label: 'Low', detail: 'I could use some care.', tone: 'coral' },
  { value: 3, label: 'Okay', detail: 'Taking things as they come.', tone: 'amber' },
  { value: 4, label: 'Good', detail: 'There is some light today.', tone: 'teal' },
  { value: 5, label: 'Very good', detail: 'Feeling bright and balanced.', tone: 'blue' },
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

  const today = new Date().toISOString().slice(0, 10);
  const selectedMood = moods.find((item) => item.value === mood) ?? moods[2];
  const averageMood = useMemo(
    () => history.length
      ? (history.reduce((sum, entry) => sum + entry.mood_value, 0) / history.length).toFixed(1)
      : null,
    [history],
  );
  const checkedInToday = history.some((entry) => entry.entry_date === today);

  useEffect(() => {
    let active = true;
    if (!userId) {
      setHistoryLoading(false);
      return () => { active = false; };
    }
    setHistoryLoading(true);
    setHistoryError('');
    getMoodEntries(userId, 7)
      .then((entries) => { if (active) setHistory(entries); })
      .catch((error) => {
        if (active) setHistoryError(error instanceof Error ? error.message : 'Could not load saved mood history.');
      })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [userId]);

  async function save() {
    if (!userId) {
      setMessage('Sign in to save your check-in to your account.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const saved = await saveMoodEntry({
        user_id: userId,
        mood_value: mood,
        mood_label: selectedMood.label,
        energy_level: energy,
        stress_level: stress,
        notes: note || null,
        entry_date: new Date().toISOString().slice(0, 10),
      });
      setHistory((current) => [saved, ...current.filter((item) => item.entry_date !== saved.entry_date)]);
      setMessage('Your check-in was saved privately.');
      setNote('');
    } catch {
      setMessage('The check-in could not be saved. Please check your account connection.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="workspace-shell mood-page">
      <header className="workspace-topbar">
        <button className="workspace-brand" onClick={onHome} aria-label={translate('Go home')}><Brand compact /></button>
        <div className="mood-topbar-actions">
          <span className="mood-privacy-chip"><span aria-hidden="true" /> <T>Private by default</T></span>
          <button className="text-link" onClick={onBack}><T>Back to dashboard</T></button>
        </div>
      </header>

      <div className="workspace-content mood-content">
        <div className="mood-page-header">
          <div>
            <span className="eyebrow"><T>Your wellbeing, in focus</T></span>
            <h1><T>Check in with yourself.</T></h1>
            <p><T>No scores to chase. Just a moment to understand how you are doing.</T></p>
          </div>
          <div className="mood-date-card">
            <span className="mood-date-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="15" rx="3"/><path d="M7.5 3.5v4M16.5 3.5v4M3.5 10h17"/></svg>
            </span>
            <span><small><T>Today</T></small><strong>{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</strong></span>
            {checkedInToday && <span className="mood-done-indicator" aria-label={translate('Checked in today')}>✓</span>}
          </div>
        </div>

        <div className="mood-layout-grid">
          <section className="settings-card mood-main-card" aria-labelledby="mood-select-heading">
            <div className="mood-card-topline">
              <div className="mood-step"><span>01</span><span><T>DAILY REFLECTION</T></span></div>
              <span className="mood-mini-lock"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><T>Just for you</T></span>
            </div>
            <h2 id="mood-select-heading"><T>How are you feeling right now?</T></h2>
            <p className="mood-card-subtitle"><T>Choose the one that feels closest. There is no right or wrong answer.</T></p>

            <div className="mood-choice-grid" role="group" aria-label={translate('Choose your mood')}>
              {moods.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  data-mood={item.value}
                  className={mood === item.value ? 'mood-choice selected' : 'mood-choice'}
                  onClick={() => setMood(item.value)}
                  aria-pressed={mood === item.value}
                >
                  <span className="mood-face-wrap"><MoodFace value={item.value} /></span>
                  <span className="mood-choice-label"><T>{item.label}</T></span>
                  <span className="mood-choice-scale">{item.value}<span>/5</span></span>
                  <span className="mood-selected-mark" aria-hidden="true">✓</span>
                </button>
              ))}
            </div>

            <div className={`mood-selected-insight mood-tone-${selectedMood.tone}`} aria-live="polite">
              <div className="mood-insight-face"><MoodFace value={mood} small /></div>
              <div className="mood-insight-copy">
                <small><T>YOU SELECTED</T></small>
                <strong><T>{selectedMood.label}</T></strong>
                <span><T>{selectedMood.detail}</T></span>
              </div>
              <span className="mood-insight-spark" aria-hidden="true">✦</span>
            </div>

            <div className="mood-divider" />
            <div className="mood-step mood-measure-heading"><span>02</span><span><T>THE REST OF THE PICTURE</T></span></div>
            <p className="mood-card-subtitle mood-measure-subtitle"><T>Your mood is only one part of your day. Add a little more context.</T></p>

            <div className="mood-metrics">
              <Range label="Energy" hint="How much energy do you have?" value={energy} onChange={setEnergy} tone="energy" />
              <Range label="Stress" hint="How much pressure are you feeling?" value={stress} onChange={setStress} tone="stress" />
            </div>

            <label className="mood-note">
              <span className="mood-note-heading"><span><T>Anything on your mind?</T></span><small><T>OPTIONAL</T></small></span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={translate('Write a note to your future self…')} rows={3} maxLength={1200} />
              <span className="mood-note-footer"><T>Your note stays with your private check-in.</T><span>{note.length}/1200</span></span>
            </label>

            <div className="mood-form-footer">
              <p><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5c0 4.5-3 7.4-7 10-4-2.6-7-5.5-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg><T>Your reflection is private.</T></p>
              <button type="button" className="primary-action mood-save" onClick={save} disabled={saving}>
                <T>{saving ? 'Saving your check-in…' : 'Save check-in'}</T>
                {!saving && <span aria-hidden="true">↗</span>}
              </button>
            </div>
            {message && <p className={message.includes('could not') ? 'form-error mood-feedback' : 'form-message mood-feedback'} role="status"><T>{message}</T></p>}
          </section>

          <aside className="mood-side-column">
            <section className="settings-card mood-trend-card">
              <div className="mood-side-title">
                <div><span className="eyebrow"><T>YOUR PATTERNS</T></span><h2><T>A little perspective.</T></h2></div>
                <span className="mood-chart-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 18V9M10 18V5M16 18v-6M22 18V3"/><path d="M2 21h21"/></svg></span>
              </div>
              <div className="mood-trend-summary">
                <div><strong>{averageMood ?? '—'}</strong><span><T>average mood</T></span></div>
                <div className="mood-trend-caption"><span className="mood-trend-dot" /><span><T>Last 7 check-ins</T></span></div>
              </div>
              <div className="mood-trend-chart" role="img" aria-label={translate('Mood values for your recent check-ins')}>
                {history.length ? [...history].reverse().map((entry, index) => (
                  <div className="mood-trend-column" key={entry.id ?? entry.entry_date ?? index}>
                    <span className="mood-trend-value" data-mood={entry.mood_value} style={{ height: `${Math.max(12, (entry.mood_value / 5) * 100)}%` }} title={`${entry.mood_label}: ${entry.mood_value}/5`} />
                    <small>{new Date(`${entry.entry_date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}</small>
                  </div>
                )) : [1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <div className="mood-trend-column mood-trend-placeholder" key={day}><span /><small>·</small></div>
                ))}
              </div>
              {!history.length && !historyLoading && <p className="mood-chart-empty"><T>Your trend will take shape as you check in over time.</T></p>}
              {historyLoading && <p className="mood-chart-empty"><T>Loading your recent check-ins…</T></p>}
              {historyError && <p className="form-error mood-side-error" role="alert"><T>Your history could not be loaded right now.</T></p>}
              <div className="mood-trend-legend"><span><i className="legend-low" /> <T>Low</T></span><span><i className="legend-mid" /> <T>Okay</T></span><span><i className="legend-high" /> <T>Good</T></span></div>
            </section>

            <section className="settings-card mood-history-card">
              <div className="mood-side-title"><div><span className="eyebrow"><T>YOUR JOURNEY</T></span><h2><T>Recent check-ins</T></h2></div><span className="mood-history-count">{history.length}</span></div>
              {historyLoading && <p className="loading-copy"><T>Loading saved check-ins…</T></p>}
              {historyError && <div className="form-error" role="alert"><T>{historyError}</T></div>}
              {history.length ? <div className="mood-history-list">{history.slice(0, 4).map((entry) => (
                <div className="mood-history-row" key={entry.id ?? entry.entry_date} data-mood={entry.mood_value}>
                  <span className="mood-history-face"><MoodFace value={entry.mood_value} small /></span>
                  <span className="mood-history-label"><strong><T>{entry.mood_label}</T></strong><small>{new Date(`${entry.entry_date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></span>
                  <span className="mood-history-score">{entry.mood_value}<small>/5</small></span>
                </div>
              ))}</div> : !historyLoading && !historyError ? <div className="mood-history-empty"><span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/></svg></span><strong><T>Your story starts here.</T></strong><p><T>Your saved reflections will show up here, ready for you to look back on.</T></p></div> : null}
            </section>

            <div className="mood-reassurance-card"><span aria-hidden="true">✦</span><p><strong><T>Progress is not a straight line.</T></strong><T> Every feeling has a place. Showing up for yourself counts.</T></p></div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function MoodFace({ value, small = false }: { value: number; small?: boolean }) {
  const mouth = value === 1
    ? 'M18 36 Q28 25 38 36'
    : value === 2
      ? 'M19 35 Q28 30 37 35'
      : value === 3
        ? 'M20 34 L36 34'
        : value === 4
          ? 'M18 31 Q28 40 38 31'
          : 'M16 29 Q28 43 40 29';

  return (
    <svg className={small ? 'mood-face-svg mood-face-small' : 'mood-face-svg'} viewBox="0 0 56 56" role="img" aria-label={translate(moods.find((item) => item.value === value)?.label ?? 'Mood')}>
      <circle className="mood-face-disc" cx="28" cy="28" r="26" />
      <circle className="mood-face-eye" cx="20" cy="22" r="2.1" />
      <circle className="mood-face-eye" cx="36" cy="22" r="2.1" />
      <path className="mood-face-mouth" d={mouth} />
    </svg>
  );
}

function Range({ label, hint, value, onChange, tone }: { label: string; hint: string; value: number; onChange: (value: number) => void; tone: 'energy' | 'stress' }) {
  const percentage = ((value - 1) / 9) * 100;
  return (
    <label className={`mood-metric mood-metric-${tone}`}>
      <span className="mood-metric-heading"><b><T>{label}</T></b><strong>{value}<small>/10</small></strong></span>
      <span className="mood-metric-hint"><T>{hint}</T></span>
      <input
        type="range"
        min="1"
        max="10"
        value={value}
        aria-valuetext={`${value} out of 10`}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ background: `linear-gradient(to right, var(--mood-range-color) 0%, var(--mood-range-color) ${percentage}%, #e2eeeb ${percentage}%, #e2eeeb 100%)` }}
      />
      <span className="mood-metric-scale"><T>Low</T><T>High</T></span>
    </label>
  );
}
