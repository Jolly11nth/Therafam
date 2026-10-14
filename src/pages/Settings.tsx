import { T, translate, LANGUAGES } from '../lib/i18n';
import { T, translate, LANGUAGES } from '../lib/i18n';
import { useEffect, useRef, useState } from 'react';
import Brand from '../components/Brand';
import { getSettings, getStoredUserId, getUserProfile, saveSettings, saveUserProfile, uploadProfileImage, type AppSettings, type UserProfile } from '../lib/therafamApi';
import { applyTheme, getLanguage, getTheme, setLanguage, type Language, type Theme } from '../lib/preferences';
import { supabase } from '../lib/supabase';

type Props = { onBack: () => void; onHome: () => void; onLogout: () => void };

const defaults: AppSettings = {
  user_id: '', email_notifications: true, push_notifications: true, sms_notifications: false,
  appointment_reminders: true, ai_chat_notifications: true, profile_visibility: 'private',
  data_sharing: false, analytics_opt_in: true, theme: getTheme(), language: getLanguage(), auto_save_chat: true,
};

const profileDefaults: UserProfile = {
  user_id: '', first_name: '', last_name: '', phone_number: '', profile_picture_url: '', bio: '', timezone: 'Africa/Lagos', language_preference: getLanguage(),
};

export default function Settings({ onBack, onHome, onLogout }: Props) {
  const userId = getStoredUserId();
  const [settings, setSettings] = useState<AppSettings>({ ...defaults, user_id: userId });
  const [profile, setProfile] = useState<UserProfile>({ ...profileDefaults, user_id: userId });
  const [saving, setSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userId) return;
    Promise.all([getSettings(userId), getUserProfile(userId)]).then(([data, profileData]) => {
      if (data) { setSettings(data); applyTheme(data.theme as Theme); setLanguage(data.language as Language); }
      if (profileData) setProfile({ ...profileDefaults, ...profileData });
    }).catch(() => undefined);
  }, [userId]);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSaved(false); setSettings((current) => ({ ...current, [key]: value }));
    if (key === 'theme') applyTheme(value as Theme);
    if (key === 'language') setLanguage(value as Language);
  }

  function updateProfile<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setProfileSaved(false); setProfile((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    if (!userId) { setSaved(true); return; }
    setSaving(true);
    try { await saveSettings(settings); setSaved(true); } finally { setSaving(false); }
  }

  async function saveProfile() {
    if (!userId) { setProfileSaved(true); return; }
    setProfileSaving(true); setProfileError('');
    try { await saveUserProfile(profile); setProfileSaved(true); } catch (error) { setProfileError(error instanceof Error ? error.message : 'Could not save profile.'); } finally { setProfileSaving(false); }
  }

  async function handleImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true); setProfileError('');
    try {
      const url = await uploadProfileImage(userId, file);
      setProfile((current) => ({ ...current, profile_picture_url: url }));
      await saveUserProfile({ ...profile, profile_picture_url: url });
      setProfileSaved(true);
    } catch (error) { setProfileError(error instanceof Error ? error.message : 'Could not upload profile image.'); }
    finally { setUploading(false); event.target.value = ''; }
  }

  async function handleLogout() {
    if (!window.confirm('Log out of Therafam?')) return;
    setLoggingOut(true);
    try {
      if (supabase) await supabase.auth.signOut();
    } catch {
      // Clear the local session even when the remote sign-out is unavailable.
    } finally {
      localStorage.removeItem('therafam:session');
      localStorage.removeItem('therafam:userId');
      onLogout();
    }
  }

  return (
    <section className="workspace-shell">
      <header className="workspace-topbar"><button className="workspace-brand" onClick={onHome}><Brand compact /></button><div className="workspace-top-actions"><button className="theme-button" onClick={() => update('theme', settings.theme === 'dark' ? 'light' : 'dark')}><T><T>{settings.theme === 'dark' ? '☀ Dark' : '☾ Light'}</T></T></button><button className="text-link" onClick={onBack}><T><T>Back to dashboard</T></T></button></div></header>
      <div className="workspace-content narrow-content">
        <div className="workspace-heading"><div><span className="eyebrow"><T><T>Your account</T></T></span><h1><T><T>Settings</T></T></h1><p><T><T>Manage your profile, preferences, privacy, and Therafam experience.</T></T></p></div></div>

        <section className="settings-card profile-settings-card">
          <div className="profile-settings-header"><div><span className="eyebrow"><T><T>Personal profile</T></T></span><h2><T><T>Profile</T></T></h2><p><T><T>Update the information Therafam uses to personalize your experience.</T></T></p></div></div>
          <div className="profile-editor">
            <div className="avatar-column">
              <div className="profile-avatar">{profile.profile_picture_url ? <img src={profile.profile_picture_url} alt={translate("Profile")} /> : <span><T><T>{(profile.first_name?.[0] || 'T')}{(profile.last_name?.[0] || 'F')}</T></T></span>}</div>
              <input ref={fileRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImage} />
              <button className="outline-action" type="button" onClick={() => fileRef.current?.click()} disabled={uploading || !userId}><T><T>{uploading ? 'Uploading…' : 'Upload photo'}</T></T></button>
              <small><T><T>JPG, PNG or WebP · max 5 MB</T></T></small>
            </div>
            <div className="profile-fields">
              <div className="field-row"><label><span><T><T>First name</T></T></span><input value={profile.first_name} onChange={(e) => updateProfile('first_name', e.target.value)} placeholder={translate("First name")} /></label><label><span><T><T>Last name</T></T></span><input value={profile.last_name} onChange={(e) => updateProfile('last_name', e.target.value)} placeholder={translate("Last name")} /></label></div>
              <div className="field-row"><label><span><T><T>Phone number</T></T></span><input value={profile.phone_number} onChange={(e) => updateProfile('phone_number', e.target.value)} placeholder={translate("Phone number")} /></label><label><span><T><T>Time zone</T></T></span><select value={profile.timezone} onChange={(e) => updateProfile('timezone', e.target.value)}><option value="Africa/Lagos"><T><T>West Africa Time (Lagos)</T></T></option><option value="UTC">UTC</option><option value="Europe/London"><T><T>London</T></T></option></select></label></div>
              <label><span><T><T>About you</T></T></span><textarea value={profile.bio} onChange={(e) => updateProfile('bio', e.target.value)} placeholder={translate("Tell Therafam a little about yourself…")} rows={4} maxLength={500} /></label>
              {profileError && <div className="form-error"><T><T>{profileError}</T></T></div>}
              <div className="settings-footer"><span><T><T>{profileSaved ? 'Profile saved.' : userId ? 'Your profile is stored securely with your account.' : 'Sign in to save your profile.'}</T></T></span><button className="primary-action" type="button" onClick={saveProfile} disabled={profileSaving || !userId}><T><T>{profileSaving ? 'Saving…' : 'Save profile'}</T></T></button></div>
            </div>
          </div>
        </section>

        <div className="settings-grid">
          <section className="settings-card"><h2><T><T>Notifications</T></T></h2><SettingToggle label="Email notifications" checked={settings.email_notifications} onChange={(v) => update('email_notifications', v)} /><SettingToggle label="Push notifications" checked={settings.push_notifications} onChange={(v) => update('push_notifications', v)} /><SettingToggle label="Appointment reminders" checked={settings.appointment_reminders} onChange={(v) => update('appointment_reminders', v)} /><SettingToggle label="AI conversation notifications" checked={settings.ai_chat_notifications} onChange={(v) => update('ai_chat_notifications', v)} /></section>
          <section className="settings-card"><h2><T><T>Privacy</T></T></h2><label className="setting-select"><span><T><T>Profile visibility</T></T></span><select value={settings.profile_visibility} onChange={(e) => update('profile_visibility', e.target.value as AppSettings['profile_visibility'])}><option value="private"><T><T>Private</T></T></option><option value="therapists_only"><T><T>Therapists only</T></T></option><option value="public"><T><T>Public</T></T></option></select></label><SettingToggle label="Share data for service improvement" checked={settings.data_sharing} onChange={(v) => update('data_sharing', v)} /><SettingToggle label="Allow analytics" checked={settings.analytics_opt_in} onChange={(v) => update('analytics_opt_in', v)} /><SettingToggle label="Automatically save AI chats" checked={settings.auto_save_chat} onChange={(v) => update('auto_save_chat', v)} /></section>
          <section className="settings-card"><h2><T><T>Appearance</T></T></h2><label className="setting-select"><span><T><T>Theme</T></T></span><select value={settings.theme} onChange={(e) => update('theme', e.target.value as AppSettings['theme'])}><option value="light"><T><T>Light</T></T></option><option value="dark"><T><T>Dark</T></T></option><option value="auto"><T><T>System</T></T></option></select></label><label className="setting-select"><span><T><T>Language</T></T></span><select value={settings.language} onChange={(e) => update('language', e.target.value as Language)}>{LANGUAGES.map((item)=><option key={item.code} value={item.code}><T>{item.label}</T></option>)}</select></label></section>
        </div>
        <div className="settings-footer"><span><T><T>{saved ? 'Settings saved.' : userId ? 'Changes are saved to your account.' : 'Demo mode — sign in to persist settings.'}</T></T></span><button className="primary-action" onClick={save} disabled={saving}><T><T>{saving ? 'Saving…' : 'Save changes'}</T></T></button></div>

        <section className="settings-card danger-zone">
          <div><span className="eyebrow"><T><T>Account</T></T></span><h2><T><T>Sign out</T></T></h2><p><T><T>End your current Therafam session on this device.</T></T></p></div>
          <button className="logout-action" type="button" onClick={handleLogout} disabled={loggingOut}><T><T>{loggingOut ? 'Signing out…' : 'Log out'}</T></T></button>
        </section>
      </div>
    </section>
  );
}

function SettingToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="setting-toggle"><span><T><T>{label}</T></T></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></label>;
}
