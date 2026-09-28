import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BadgeCheckIcon,
  CalendarIcon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  Loader2Icon,
  MailIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
  ShieldIcon } from
'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';
import { Avatar } from '../components/Avatar';
import { ActivityList } from '../components/ActivityList';
import { TextField, fieldInputClass } from '../components/auth/TextField';
import { btnPrimary, btnSecondary } from '../components/ui/buttons';
import { useAuth } from '../contexts/AuthContext';
import { usePolicies } from '../contexts/PolicyContext';
import { crops, lgas } from '../data/policies';
import { formatDate, formatDateTime, formatEth } from '../utils/format';
import { buildActivity } from '../utils/activity';
import type { ProfilePatch } from '../types/user';

export function Profile() {
  const { user, updateProfile } = useAuth();
  const { policies, balanceOf } = usePolicies();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<ProfilePatch>({});

  useEffect(() => {
    if (user)
    setForm({
      name: user.name,
      phone: user.phone ?? '',
      lga: user.lga ?? lgas[0],
      village: user.village ?? '',
      primaryCrop: user.primaryCrop ?? crops[0],
      farmSizeHa: user.farmSizeHa,
      bio: user.bio ?? '',
      title: user.title ?? ''
    });
  }, [user, editing]);

  if (!user) return null;
  const isFarmer = user.role === 'farmer';
  const mine = isFarmer ? policies.filter((p) => p.farmerId === user.id) : policies;
  const paidOut = mine.filter((p) => p.status === 'paid').reduce((s, p) => s + p.payoutEth, 0);
  const activeCover = mine.filter((p) => p.status === 'active').reduce((s, p) => s + p.payoutEth, 0);
  const settledByMe = policies.filter((p) => p.status !== 'active').length;

  const stats = isFarmer ?
  [
  { label: 'Policies held', value: String(mine.length) },
  { label: 'Active cover', value: formatEth(activeCover) },
  { label: 'Payouts received', value: formatEth(paidOut) },
  { label: 'Wallet balance', value: formatEth(balanceOf(user.id)) }] :

  [
  { label: 'Policies on contract', value: String(policies.length) },
  { label: 'Settled', value: String(settledByMe) },
  { label: 'Open exposure', value: formatEth(activeCover) },
  { label: 'Total paid out', value: formatEth(paidOut) }];


  async function copyWallet() {
    try {
      await navigator.clipboard.writeText(user!.wallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {

      /* clipboard unavailable */}
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name?.trim()) return toast.error('Name is required');
    setSaving(true);
    await updateProfile({
      ...form,
      name: form.name.trim(),
      farmSizeHa: form.farmSizeHa ? Number(form.farmSizeHa) : undefined
    });
    setSaving(false);
    setEditing(false);
    toast.success('Profile updated');
  }

  const set = (key: keyof ProfilePatch) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
  setForm((f) => ({ ...f, [key]: e.target.value }));

  const contact = [
  { icon: MailIcon, label: 'Email', value: user.email, badge: user.emailVerified !== false },
  { icon: PhoneIcon, label: 'Phone', value: user.phone || '—' },
  ...(isFarmer ? [{ icon: MapPinIcon, label: 'Location', value: `${user.village ? `${user.village}, ` : ''}${user.lga ?? '—'}` }] : []),
  { icon: CalendarIcon, label: 'Member since', value: formatDate(user.joinedAt) },
  { icon: ShieldIcon, label: 'Sign-in method', value: user.provider === 'google' ? 'Google' : 'Email and password' }];


  return (
    <div>
      <PageHeader
        title="Profile"
        description="Your account on the Sokoto Rainfall Cover contract."
        actions={
        !editing &&
        <button type="button" onClick={() => setEditing(true)} className={btnSecondary}>
              <PencilIcon className="h-4 w-4" aria-hidden />
              Edit profile
            </button>

        } />
      

      <section className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="h-20 bg-accent md:h-24" aria-hidden />
        <div className="-mt-10 flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end md:px-6">
          <div className="rounded-full ring-4 ring-surface">
            <Avatar name={user.name} src={user.avatarUrl} size="lg" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <span className="truncate">{user.name}</span>
              {user.emailVerified !== false && <BadgeCheckIcon className="h-4 w-4 shrink-0 text-accent" aria-label="Verified" />}
            </h2>
            <p className="truncate text-sm text-muted">
              {isFarmer ? `Smallholder farmer${user.primaryCrop ? ` · ${user.primaryCrop}` : ''}${user.farmSizeHa ? ` · ${user.farmSizeHa} ha` : ''}` : user.title ?? 'Administrator'}
            </p>
          </div>
          <button
            type="button"
            onClick={copyWallet}
            className="flex min-w-0 max-w-full items-center gap-2 rounded-md border border-line px-3 py-2 font-mono text-xs transition-colors duration-150 ease-out hover:border-muted">
            
            <span className="truncate">{user.wallet}</span>
            {copied ? <CheckIcon className="h-3.5 w-3.5 shrink-0 text-accent" aria-label="Copied" /> : <CopyIcon className="h-3.5 w-3.5 shrink-0 text-muted" aria-label="Copy wallet" />}
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-px border-t border-line bg-line md:grid-cols-4">
          {stats.map((s, i) =>
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.04, ease: [0.23, 1, 0.32, 1] }}
            className="min-w-0 bg-surface px-5 py-4 md:px-6">
            
              <dt className="truncate text-xs text-muted">{s.label}</dt>
              <dd className="mt-1 truncate font-mono text-base font-medium">{s.value}</dd>
            </motion.div>
          )}
        </dl>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="min-w-0 rounded-lg border border-line bg-surface p-5 md:p-6">
          {editing ?
          <form onSubmit={save} className="space-y-4">
              <h3 className="text-sm font-semibold">Edit details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Full name" value={form.name ?? ''} onChange={set('name')} className="min-w-0" />
                <TextField label="Phone" type="tel" value={form.phone ?? ''} onChange={set('phone')} className="min-w-0" />
                {isFarmer ?
              <>
                    <div className="min-w-0">
                      <label htmlFor="p-lga" className="block text-sm font-medium">LGA</label>
                      <select id="p-lga" value={form.lga} onChange={set('lga')} className={`${fieldInputClass} mt-1.5 border-line focus:border-accent`}>
                        {lgas.map((l) =>
                    <option key={l}>{l}</option>
                    )}
                      </select>
                    </div>
                    <TextField label="Village" value={form.village ?? ''} onChange={set('village')} className="min-w-0" />
                    <div className="min-w-0">
                      <label htmlFor="p-crop" className="block text-sm font-medium">Primary crop</label>
                      <select id="p-crop" value={form.primaryCrop} onChange={set('primaryCrop')} className={`${fieldInputClass} mt-1.5 border-line focus:border-accent`}>
                        {crops.map((c) =>
                    <option key={c}>{c}</option>
                    )}
                      </select>
                    </div>
                    <TextField
                  label="Farm size (ha)"
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.farmSizeHa ?? ''}
                  onChange={set('farmSizeHa')}
                  className="min-w-0" />
                
                  </> :

              <TextField label="Job title" value={form.title ?? ''} onChange={set('title')} className="min-w-0 sm:col-span-2" />
              }
              </div>
              <div>
                <label htmlFor="p-bio" className="block text-sm font-medium">About</label>
                <textarea
                id="p-bio"
                rows={3}
                maxLength={240}
                value={form.bio ?? ''}
                onChange={set('bio')}
                className={`${fieldInputClass} mt-1.5 resize-none border-line focus:border-accent`} />
              
                <p className="mt-1 text-right text-xs text-muted">{(form.bio ?? '').length}/240</p>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setEditing(false)} className={btnSecondary}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className={btnPrimary}>
                  {saving && <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />}
                  Save changes
                </button>
              </div>
            </form> :

          <>
              <h3 className="text-sm font-semibold">About</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{user.bio || 'No bio yet. Add a short description from Edit profile.'}</p>
              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                {contact.map((c) =>
              <div key={c.label} className="flex min-w-0 items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-canvas text-muted">
                      <c.icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted">{c.label}</dt>
                      <dd className="flex min-w-0 items-center gap-1.5 text-sm">
                        <span className="truncate">{c.value}</span>
                        {'badge' in c && c.badge &&
                    <span className="shrink-0 rounded-full bg-success-soft px-1.5 py-px text-[10px] font-medium text-success">Verified</span>
                    }
                      </dd>
                    </div>
                  </div>
              )}
              </dl>
              {user.lastSignInAt && <p className="mt-6 text-xs text-muted">Last signed in {formatDateTime(user.lastSignInAt)}</p>}
            </>
          }
        </section>

        <section className="min-w-0 rounded-lg border border-line bg-surface p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Recent activity</h3>
            <Link to={`/${user.role}/notifications`} className="text-xs font-medium text-accent hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-3">
            <ActivityList items={buildActivity(mine, 5)} basePath={`/${user.role}/policies`} showFarmer={!isFarmer} />
          </div>
          <a
            href={`https://sepolia.etherscan.io/address/${user.wallet}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
            
            View wallet on Etherscan
            <ExternalLinkIcon className="h-3.5 w-3.5" aria-hidden />
          </a>
        </section>
      </div>
    </div>);

}