import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeftIcon } from 'lucide-react';
import { api } from '../api/client';
import { Brand } from '../components/layout/Brand';
import { LanguageMenu } from '../components/layout/LanguageMenu';
import { ThemeMenu } from '../components/layout/ThemeMenu';
import { PreferencesMenu } from '../components/layout/PreferencesMenu';
import { LegalBody } from '../components/TermsLink';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { formatDate } from '../utils/format';
import { homePath } from '../utils/users';
import type { TranslationKey } from '../data/translations';

/** Bump when the text changes in substance; it is shown as "Last updated". */
const UPDATED = '2026-11-03';
const TERMS = [1, 2, 3, 4, 5, 6, 7];
const PRIVACY = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Terms of use and privacy notice: public, readable before signing up. */
export function Legal() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { hash } = useLocation();
  // The contact address is the operator's choice (CONTACT_EMAIL on the
  // server); without one, replying to our emails reaches us.
  const [contact, setContact] = useState<string | null>(null);

  useEffect(() => {
    api<{ contactEmail?: string | null }>('/auth/config')
      .then((c) => setContact(c.contactEmail ?? null))
      .catch(() => setContact(null));
  }, []);

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  const section = (prefix: 't' | 'p', n: number) => (
    <section key={`${prefix}${n}`} aria-labelledby={`${prefix}${n}`} className="space-y-2">
      <h3 id={`${prefix}${n}`} className="text-base font-semibold text-ink">{t(`legal.${prefix}${n}.h` as TranslationKey)}</h3>
      <LegalBody text={t(`legal.${prefix}${n}.b` as TranslationKey)} />
      {prefix === 'p' && n === 1 &&
      <p>{contact ? t('legal.contactEmail', { email: contact }) : t('legal.contactReply')}</p>
      }
    </section>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex items-center justify-between gap-3 px-5 py-4 md:px-8 lg:px-10">
        <Brand to={user ? homePath(user) : '/'} compact />
        <div className="flex items-center gap-1">
          <div className="hidden items-center gap-1 lg:flex">
            <LanguageMenu bordered />
            <ThemeMenu />
          </div>
          <div className="lg:hidden">
            <PreferencesMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-2 md:px-8">
        <Link to={user ? homePath(user) : '/'} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeftIcon className="h-4 w-4" aria-hidden />
          {t('common.back')}
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{t('legal.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('legal.updated', { date: formatDate(UPDATED) })}</p>
        <p className="mt-4 text-[15px] leading-relaxed text-ink">{t('legal.intro')}</p>

        <article className="mt-8 space-y-10 text-[15px] leading-relaxed text-ink">
          <div id="terms" className="space-y-6 rounded-lg border border-line bg-surface p-5 sm:p-7">
            <h2 className="text-lg font-semibold tracking-tight">{t('legal.termsHeading')}</h2>
            {TERMS.map((n) => section('t', n))}
          </div>
          <div id="privacy" className="space-y-6 rounded-lg border border-line bg-surface p-5 sm:p-7">
            <h2 className="text-lg font-semibold tracking-tight">{t('legal.privacyHeading')}</h2>
            {PRIVACY.map((n) => section('p', n))}
          </div>
        </article>
      </main>
    </div>);

}
