import { useEffect, useState } from 'react';
import Brand from '../components/Brand';
import { getSettings, getStoredUserId, saveSettings, type AppSettings } from '../lib/therafamApi';
import { applyTheme, getLanguage, getTheme, setLanguage, type Language, type Theme } from '../lib/preferences';

type Props = { onBack: () => void; onHome: () => void };

const defaults: AppSettings = {
  user_id: '', email_notifications: true, push_notifications: true, sms_notifications: false,
  appointment_reminders: true, ai_chat_notifications: true, profile_visibility: 'private',
  data_sharing: false, analytics_opt_in: true, theme: getTheme(), language: getLanguage(), auto_save_chat: true,
};

export default function Settings({ onBack, onHome }: Props) {
  const userId = getStoredUserId();
  const [settings, setSettings] = useState<AppSettings>({ ...defaults, user_id: userId });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!userId) return;
    getSettings(userId).then((data) => {
      if (!data) return;
      setSettings(data);
      applyTheme(data.theme as Theme);
      setLanguage(data.language as Language);
    }).catch(() => undefined);
  }, [userId]);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSaved(false);
    setSettings((current) => ({ ...current, [key]: value }));
    if (key === 'theme') applyTheme(value as Theme);
    if (key === 'language') setLanguage(value as Language);
  }

  async function save() {
    if (!userId) { setSaved(true); return; }
    setSaving(true);
    try { await saveSettings(settings); setSaved(true); } finally { setSaving(false); }
  }

  return (
    <section className="workspace-shell">
      <header className="workspace-topbar"><button className="workspace-brand" onClick={onHome}><Brand compact /></button><div className="workspace-top-actions"><button className="theme-button" onClick={() => update('theme', settings.theme === 'dark' ? 'light' : 'dark')}>{settings.theme === 'dark' ? '☀ Dark' : '☾ Light'}</button><button className="text-link" onClick={onBack}>Back to dashboard</button></div></header>
      <div className="workspace-content narrow-content">
        <div className="workspace-heading"><div><span className="eyebrow">Your preferences</span><h1>Settings</h1><p>Control how Therafam communicates with you and handles your data.</p></div></div>
        <div className="settings-grid">
          <section className="settings-card"><h2>Notifications</h2><SettingToggle label="Email notifications" checked={settings.email_notifications} onChange={(v) => update('email_notifications', v)} /><SettingToggle label="Push notifications" checked={settings.push_notifications} onChange={(v) => update('push_notifications', v)} /><SettingToggle label="Appointment reminders" checked={settings.appointment_reminders} onChange={(v) => update('appointment_reminders', v)} /><SettingToggle label="AI conversation notifications" checked={settings.ai_chat_notifications} onChange={(v) => update('ai_chat_notifications', v)} /></section>
          <section className="settings-card"><h2>Privacy</h2><label className="setting-select"><span>Profile visibility</span><select value={settings.profile_visibility} onChange={(e) => update('profile_visibility', e.target.value as AppSettings['profile_visibility'])}><option value="private">Private</option><option value="therapists_only">Therapists only</option><option value="public">Public</option></select></label><SettingToggle label="Share data for service improvement" checked={settings.data_sharing} onChange={(v) => update('data_sharing', v)} /><SettingToggle label="Allow analytics" checked={settings.analytics_opt_in} onChange={(v) => update('analytics_opt_in', v)} /><SettingToggle label="Automatically save AI chats" checked={settings.auto_save_chat} onChange={(v) => update('auto_save_chat', v)} /></section>
          <section className="settings-card"><h2>Appearance</h2><label className="setting-select"><span>Theme</span><select value={settings.theme} onChange={(e) => update('theme', e.target.value as AppSettings['theme'])}><option value="light">Light</option><option value="dark">Dark</option><option value="auto">System</option></select></label><label className="setting-select"><span>Language</span><select value={settings.language} onChange={(e) => update('language', e.target.value as Language)}><option value="en">English</option><option value="es">Español</option></select></label></section>
        </div>
        <div className="settings-footer"><span>{saved ? 'Settings saved.' : userId ? 'Changes are saved to your account.' : 'Demo mode — sign in to persist settings.'}</span><button className="primary-action" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
      </div>
    </section>
  );
}

function SettingToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="setting-toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></label>;
}
