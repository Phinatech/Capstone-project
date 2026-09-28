import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangleIcon, BellIcon, CheckIcon, GlobeIcon, KeyRoundIcon, Loader2Icon, PaletteIcon, RotateCcwIcon, ShieldIcon, SparklesIcon } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';
import { modeIcons } from '../components/layout/ThemeMenu';
import { PasswordField } from '../components/auth/PasswordField';
import { PasswordStrength } from '../components/auth/PasswordStrength';
import { Switch } from '../components/ui/Switch';
import { Modal } from '../components/ui/Modal';
import { btnDanger, btnPrimary, btnSecondary } from '../components/ui/buttons';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { AuthError, useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { accentOptions, modeOptions } from '../data/themes';
import { languages } from '../data/translations';
import type { TranslationKey } from '../data/translations';

type SectionId = 'appearance' | 'language' | 'notifications' | 'security' | 'accessibility' | 'danger';

const sections: {id: SectionId;label: string;icon: typeof PaletteIcon;}[] = [
{ id: 'appearance', label: 'Appearance', icon: PaletteIcon },
{ id: 'language', label: 'Language & time', icon: GlobeIcon },
{ id: 'notifications', label: 'Notifications', icon: BellIcon },
{ id: 'security', label: 'Security', icon: ShieldIcon },
{ id: 'accessibility', label: 'Accessibility', icon: SparklesIcon },
{ id: 'danger', label: 'Account', icon: AlertTriangleIcon }];


const optionClass = (active: boolean) =>
`flex min-w-0 items-center gap-3 rounded-lg border p-3 text-left transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
active ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-muted'}`;


function Card({ id, title, hint, children }: {id: SectionId;title: string;hint: string;children: React.ReactNode;}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-lg border border-line bg-surface p-5 md:p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{hint}</p>
      <div className="mt-5">{children}</div>
    </section>);

}

export function Settings() {
  const { mode, accent, setMode, setAccent } = useTheme();
  const { language, setLanguage, t } = useI18n();
  const { prefs, setPref, setNotificationPref, resetPrefs } = usePreferences();
  const { user, changePassword, userHasPassword, updateProfile, deleteAccount } = useAuth();
  const ui = useUI();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const [active, setActive] = useState<SectionId>('appearance');
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    const id = hash.replace('#', '') as SectionId;
    if (id && sections.some((s) => s.id === id)) {
      setActive(id);
      window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 250);
    }
  }, [hash]);

  if (!user) return null;
  const hasPw = userHasPassword();

  function jump(id: SectionId) {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next.length < 8) return setPwError(t('error.passwordShort'));
    if (pw.next !== pw.confirm) return setPwError(t('error.passwordMismatch'));
    setPwError(null);
    setPwSaving(true);
    try {
      await changePassword(pw.current, pw.next);
      setPw({ current: '', next: '', confirm: '' });
      toast.success('Password updated');
    } catch (err) {
      setPwError(err instanceof AuthError ? t(err.key) : 'Could not update password');
    } finally {
      setPwSaving(false);
    }
  }

  const notifRows: {key: keyof typeof prefs.notifications;label: string;description: string;}[] = [
  { key: 'payouts', label: 'Payouts', description: 'When a policy pays out to a wallet.' },
  { key: 'evaluations', label: 'Evaluations and policies', description: 'Purchases, settlements and evaluation reminders.' },
  { key: 'oracle', label: 'Oracle feeds', description: 'Rainfall source updates, latency and reputation changes.' },
  { key: 'updates', label: 'Product updates', description: 'New features and system announcements.' }];


  return (
    <div>
      <PageHeader title={t('settings.title')} description="Appearance, language, notifications and account security." />

      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="scroll-area -mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0 lg:sticky lg:top-0 lg:mx-0 lg:self-start lg:overflow-visible lg:px-0">
          <ul className="flex gap-1 lg:flex-col">
            {sections.map((s) =>
            <li key={s.id} className="shrink-0">
                <button
                type="button"
                onClick={() => jump(s.id)}
                aria-current={active === s.id ? 'true' : undefined}
                className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ease-out ${
                active === s.id ? 'bg-accent-soft text-accent-strong' : 'text-muted hover:bg-surface hover:text-ink'}`
                }>
                
                  <s.icon className="h-4 w-4 shrink-0" aria-hidden />
                  {s.label}
                </button>
              </li>
            )}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          <Card id="appearance" title="Appearance" hint={t('settings.modeHint')}>
            <p className="mb-2 text-xs font-medium text-muted">{t('theme.mode')}</p>
            <div role="radiogroup" aria-label={t('theme.mode')} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {modeOptions.map((m) => {
                const Icon = modeIcons[m];
                const on = mode === m;
                return (
                  <button key={m} type="button" role="radio" aria-checked={on} onClick={() => setMode(m)} className={optionClass(on)}>
                    <Icon className={`h-4 w-4 shrink-0 ${on ? 'text-accent-strong' : 'text-muted'}`} aria-hidden />
                    <span className={`truncate text-sm font-medium ${on ? 'text-accent-strong' : ''}`}>{t(`theme.${m}` as TranslationKey)}</span>
                  </button>);

              })}
            </div>
            <p className="mb-2 mt-5 text-xs font-medium text-muted">{t('theme.accent')}</p>
            <div role="radiogroup" aria-label={t('theme.accent')} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {accentOptions.map((a) => {
                const on = accent === a.value;
                return (
                  <button key={a.value} type="button" role="radio" aria-checked={on} onClick={() => setAccent(a.value)} className={optionClass(on)}>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: a.swatch }}>
                      {on && <CheckIcon className="h-3.5 w-3.5 text-white" aria-hidden />}
                    </span>
                    <span className="truncate text-sm font-medium">{t(`theme.${a.value}` as TranslationKey)}</span>
                  </button>);

              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-canvas p-4">
              <span className="text-xs text-muted">{t('settings.preview')}</span>
              <span className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white">{t('auth.signIn')}</span>
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-strong">Active</span>
              <span className="rounded-full bg-clay-soft px-2.5 py-0.5 text-xs font-medium text-clay">Paid out</span>
              <span className="text-xs font-medium text-accent underline">{t('nav.myPolicies')}</span>
            </div>
          </Card>

          <Card id="language" title="Language & time" hint={t('settings.languageHint')}>
            <div role="radiogroup" aria-label={t('lang.label')} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {languages.map((l) => {
                const on = language === l.value;
                return (
                  <button key={l.value} type="button" role="radio" aria-checked={on} onClick={() => setLanguage(l.value)} className={optionClass(on)}>
                    <span className="w-6 shrink-0 font-mono text-xs uppercase text-muted">{l.value}</span>
                    <span className={`truncate text-sm font-medium ${on ? 'text-accent-strong' : ''}`}>{l.native}</span>
                  </button>);

              })}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium text-muted">Clock format</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['24h', '12h'] as const).map((f) =>
                  <button key={f} type="button" onClick={() => setPref('timeFormat', f)} className={optionClass(prefs.timeFormat === f)}>
                      <span className="font-mono text-sm">{f === '24h' ? '14:30' : '2:30 PM'}</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="divide-y divide-line">
                <Switch checked={prefs.showSeconds} onChange={(v) => setPref('showSeconds', v)} label="Show seconds" description="In the navbar clock." />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted">Times are shown in West Africa Time (WAT, UTC+1).</p>
          </Card>

          <Card id="notifications" title="Notifications" hint="Choose which events notify you and how.">
            <div className="divide-y divide-line">
              <Switch checked={prefs.realtime} onChange={(v) => setPref('realtime', v)} label="Live updates" description="Receive events in real time while signed in." />
              {notifRows.map((r) =>
              <Switch key={r.key} checked={prefs.notifications[r.key]} onChange={(v) => setNotificationPref(r.key, v)} label={r.label} description={r.description} />
              )}
            </div>
            <p className="mb-1 mt-5 text-xs font-medium text-muted">Delivery</p>
            <div className="divide-y divide-line">
              <Switch checked={prefs.notifications.email} onChange={(v) => setNotificationPref('email', v)} label="Email" description={user.email} />
              <Switch
                checked={prefs.notifications.sms}
                onChange={(v) => setNotificationPref('sms', v)}
                label="SMS"
                description={user.phone ? user.phone : 'Add a phone number in your profile to enable SMS.'}
                disabled={!user.phone} />
              
            </div>
          </Card>

          <Card id="security" title="Security" hint={hasPw ? 'Change your password and protect your account.' : 'You sign in with Google. Set a password to also sign in with email.'}>
            <form onSubmit={submitPassword} className="grid gap-4 sm:grid-cols-2">
              {hasPw &&
              <PasswordField
                label="Current password"
                autoComplete="current-password"
                value={pw.current}
                onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
                className="min-w-0 sm:col-span-2" />

              }
              <div className="min-w-0">
                <PasswordField
                  label="New password"
                  autoComplete="new-password"
                  value={pw.next}
                  onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
                
                <PasswordStrength password={pw.next} />
              </div>
              <PasswordField
                label="Confirm new password"
                autoComplete="new-password"
                value={pw.confirm}
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                className="min-w-0" />
              
              {pwError &&
              <p role="alert" className="text-sm text-danger sm:col-span-2">
                  {pwError}
                </p>
              }
              <div className="sm:col-span-2 sm:flex sm:justify-end">
                <button type="submit" disabled={pwSaving || !pw.next} className={`${btnPrimary} w-full sm:w-auto`}>
                  {pwSaving ? <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden /> : <KeyRoundIcon className="h-4 w-4" aria-hidden />}
                  {hasPw ? 'Update password' : 'Set password'}
                </button>
              </div>
            </form>
            <div className="mt-5 divide-y divide-line border-t border-line">
              <Switch
                checked={!!user.twoFactor}
                onChange={async (v) => {
                  await updateProfile({ twoFactor: v });
                  toast.success(v ? 'Two-step verification on' : 'Two-step verification off');
                }}
                label="Two-step verification"
                description="Ask for a one-time code when signing in on a new device (demo)." />
              
            </div>
          </Card>

          <Card id="accessibility" title="Accessibility" hint="Motion and onboarding.">
            <div className="divide-y divide-line">
              <Switch checked={prefs.reduceMotion} onChange={(v) => setPref('reduceMotion', v)} label="Reduce motion" description="Turn off page transitions and animated effects." />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => ui.open('welcome')} className={btnSecondary}>
                Replay welcome tour
              </button>
              <button type="button" onClick={() => ui.open('whatsNew')} className={btnSecondary}>
                {t('menu.whatsNew')}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetPrefs();
                  toast('Preferences reset');
                }}
                className={btnSecondary}>
                
                <RotateCcwIcon className="h-4 w-4" aria-hidden />
                Reset preferences
              </button>
            </div>
          </Card>

          <Card id="danger" title="Account" hint="Sign out everywhere or permanently delete this account.">
            <div className="flex flex-col gap-3 rounded-lg border border-line bg-danger-soft p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-danger">Delete account</p>
                <p className="mt-0.5 text-xs text-muted">
                  {user.role === 'admin' ? 'Demo administrator accounts cannot be deleted.' : 'Removes your profile from this browser. On-chain policies remain on the contract.'}
                </p>
              </div>
              <button type="button" disabled={user.role === 'admin'} onClick={() => setDeleteOpen(true)} className={`${btnDanger} shrink-0`}>
                Delete account
              </button>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        size="sm"
        icon={
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger-soft text-danger">
            <AlertTriangleIcon className="h-5 w-5" aria-hidden />
          </span>
        }
        title="Delete your account?"
        description="This can't be undone."
        footer={
        <>
            <button type="button" onClick={() => setDeleteOpen(false)} className={btnSecondary}>
              {t('common.cancel')}
            </button>
            <button
            type="button"
            disabled={confirmText !== 'DELETE'}
            onClick={() => {
              deleteAccount();
              toast('Account deleted');
              navigate('/sign-in', { replace: true });
            }}
            className={btnDanger}>
            
              Delete account
            </button>
          </>
        }>
        
        <label className="block text-sm">
          Type <span className="font-mono font-semibold">DELETE</span> to confirm
          <input
            data-autofocus
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="mt-2 h-10 w-full rounded-md border border-line bg-surface px-3 font-mono text-sm focus:border-danger focus:outline-none" />
          
        </label>
      </Modal>
    </div>);

}