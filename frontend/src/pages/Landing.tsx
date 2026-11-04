import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CloudRainIcon, HandCoinsIcon, ScanSearchIcon, SlidersHorizontalIcon, SproutIcon, UsersIcon, WalletIcon } from 'lucide-react';
import { Brand } from '../components/layout/Brand';
import { LanguageMenu } from '../components/layout/LanguageMenu';
import { ThemeMenu } from '../components/layout/ThemeMenu';
import { PreferencesMenu } from '../components/layout/PreferencesMenu';
import { RoleRedirect } from '../components/layout/RequireRole';
import { CardSlider } from '../components/CardSlider';
import { btnGhost, btnPrimary, btnSecondary } from '../components/ui/buttons';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { oracleSources } from '../data/rainfall';
import { formatDayRange } from '../utils/format';
import type { TranslationKey } from '../data/translations';

const ease = [0.23, 1, 0.32, 1] as const;

// Policy #0 on Sepolia: window #19 (11 Sep – 10 Oct 2026) recorded 78.3 mm
// against an 85 mm threshold and paid out without a claim.
const EXAMPLE = { start: new Date(Date.UTC(2026, 8, 11)), end: new Date(Date.UTC(2026, 9, 10)), thresholdMm: 85, recordedMm: 78.3, scaleMm: 100 };

const steps: { icon: typeof CloudRainIcon; key: string }[] = [
  { icon: SlidersHorizontalIcon, key: 'step1' },
  { icon: CloudRainIcon, key: 'step2' },
  { icon: WalletIcon, key: 'step3' }
];
const audiences: { icon: typeof CloudRainIcon; key: string }[] = [
  { icon: SproutIcon, key: 'farmers' },
  { icon: UsersIcon, key: 'agents' },
  { icon: ScanSearchIcon, key: 'open' }
];

/** Public front page; signed-in users go straight to their portal. */
export function Landing() {
  const { user } = useAuth();
  const { t } = useI18n();
  if (user) return <RoleRedirect />;
  const k = (key: string) => t(`landing.${key}` as TranslationKey);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex w-[80%] sm:w-[90%] items-center justify-between gap-3 py-3">
          <Brand to="/" compact />
          <nav className="flex items-center gap-1 sm:gap-2" aria-label={t('shell.primary')}>
            <div className="hidden items-center gap-1 lg:flex">
              <LanguageMenu bordered />
              <ThemeMenu />
            </div>
            <div className="lg:hidden">
              <PreferencesMenu />
            </div>
            <Link to="/sign-in" className={btnGhost}>{t('auth.signIn')}</Link>
            <Link to="/sign-up" className={`${btnPrimary} hidden sm:inline-flex`}>{t('auth.createOne')}</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="bg-accent text-white">
          <div className="mx-auto grid w-[80%] sm:w-[90%] items-center gap-10 py-14 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:py-20">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease }}>
              <p className="inline-flex rounded-full border border-white/25 px-3 py-1 text-xs text-white/85">{k('badge')}</p>
              <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">{k('title')}</h1>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/85 sm:text-base">{k('subtitle')}</p>
              <div className="mt-8 flex flex-col gap-2 sm:flex-row">
                <Link to="/sign-up" className="inline-flex h-11 items-center justify-center rounded-md bg-white px-5 text-sm font-semibold text-accent transition-colors duration-150 ease-out hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                  {t('auth.createOne')}
                </Link>
                <a href="#how" className="inline-flex h-11 items-center justify-center rounded-md border border-white/40 px-5 text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                  {k('ctaHow')}
                </a>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1, ease }}
              className="rounded-xl bg-surface p-5 text-ink shadow-pop sm:p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{k('exampleLabel')}</p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted">{k('exampleWindow')}</dt><dd className="font-mono text-right">{formatDayRange(EXAMPLE.start, EXAMPLE.end)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">{k('exampleThreshold')}</dt><dd className="font-mono">{EXAMPLE.thresholdMm} mm</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">{k('exampleRecorded')}</dt><dd className="font-mono font-semibold">{EXAMPLE.recordedMm} mm</dd></div>
              </dl>
              <div className="relative mt-5 h-3 rounded-full bg-canvas" aria-hidden>
                <div className="h-3 rounded-full bg-accent" style={{ width: `${(EXAMPLE.recordedMm / EXAMPLE.scaleMm) * 100}%` }} />
                <div className="absolute -top-1.5 h-6 w-0.5 bg-clay" style={{ left: `${(EXAMPLE.thresholdMm / EXAMPLE.scaleMm) * 100}%` }} />
              </div>
              <p className="mt-4 flex items-center gap-2 text-sm font-medium text-accent-strong">
                <HandCoinsIcon className="h-4 w-4 shrink-0" aria-hidden />
                {k('exampleResult')}
              </p>
              <ul className="mt-5 flex flex-wrap gap-1.5">
                {oracleSources.map((s) =>
                <li key={s.id} className="rounded-md border border-line px-2 py-1 text-xs text-muted">{s.name}</li>
                )}
              </ul>
            </motion.div>
          </div>
        </section>

        <section id="how" className="mx-auto w-[80%] sm:w-[90%] scroll-mt-20 py-14 md:py-20">
          <h2 className="text-2xl font-semibold tracking-tight">{k('stepsTitle')}</h2>
          <div className="mt-8">
            <CardSlider label={k('stepsTitle')}>
            {steps.map(({ icon: Icon, key }, i) =>
            <div key={key} className="rounded-lg border border-line bg-surface p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong"><Icon className="h-5 w-5" aria-hidden /></span>
                  <span className="font-mono text-xs text-muted">0{i + 1}</span>
                </div>
                <h3 className="mt-4 text-base font-semibold">{k(`${key}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{k(`${key}.body`)}</p>
              </div>
            )}
            </CardSlider>
          </div>
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto w-[80%] sm:w-[90%] py-14 md:py-20">
            <h2 className="text-2xl font-semibold tracking-tight">{k('forTitle')}</h2>
            <div className="mt-8">
              <CardSlider label={k('forTitle')}>
              {audiences.map(({ icon: Icon, key }) =>
              <div key={key} className="rounded-lg border border-line bg-canvas p-5">
                  <Icon className="h-6 w-6 text-accent" aria-hidden />
                  <h3 className="mt-3 text-base font-semibold">{k(`${key}.title`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{k(`${key}.body`)}</p>
                </div>
              )}
              </CardSlider>
            </div>
          </div>
        </section>

        <section className="mx-auto w-[80%] sm:w-[90%] py-14 md:py-20">
          <h2 className="text-2xl font-semibold tracking-tight">{k('faqTitle')}</h2>
          <div className="mt-6 max-w-3xl divide-y divide-line rounded-lg border border-line bg-surface">
            {['faq1', 'faq2', 'faq3'].map((key) =>
            <details key={key} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold">
                  {k(`${key}.q`)}
                  <span className="text-muted transition-transform duration-150 group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted">{k(`${key}.a`)}</p>
              </details>
            )}
          </div>
        </section>

        <section className="mx-auto w-[80%] sm:w-[90%] pb-16">
          <div className="flex flex-col items-start justify-between gap-5 rounded-xl border border-line bg-surface p-6 sm:flex-row sm:items-center sm:p-8">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{k('closingTitle')}</h2>
              <p className="mt-1 text-sm text-muted">{k('closingBody')}</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Link to="/sign-up" className={btnPrimary}>{t('auth.createOne')}</Link>
              <Link to="/sign-in" className={btnSecondary}>{t('auth.signIn')}</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-[80%] sm:w-[90%] flex-col gap-2 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>{t('brand.name')}</span>
          <Link to="/terms" className="hover:text-ink hover:underline">{t('legal.footerLink')}</Link>
        </div>
      </footer>
    </div>);

}
