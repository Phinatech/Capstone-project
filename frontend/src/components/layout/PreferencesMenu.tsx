import { useCallback, useRef, useState } from 'react';
import { CheckIcon, SlidersHorizontalIcon } from 'lucide-react';
import { DropdownPanel, iconButtonClass } from '../DropdownPanel';
import { modeIcons } from './ThemeMenu';
import { useDismiss } from '../../hooks/useDismiss';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useTheme } from '../../contexts/ThemeContext';
import { useI18n } from '../../contexts/I18nContext';
import { accentOptions, modeOptions } from '../../data/themes';
import { languages } from '../../data/translations';
import type { TranslationKey } from '../../data/translations';

/** Combined theme + language menu for mobile and tablet. Opens on hover where a fine pointer is available. */
export function PreferencesMenu() {
  const { mode, accent, setMode, setAccent } = useTheme();
  const { language, setLanguage, t } = useI18n();
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number>();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const hoverProps = canHover ?
  {
    onMouseEnter: () => {
      window.clearTimeout(timer.current);
      setOpen(true);
    },
    onMouseLeave: () => {
      timer.current = window.setTimeout(() => setOpen(false), 180);
    }
  } :
  {};

  const chip = (active: boolean) =>
  `flex min-w-0 items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs font-medium transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
  active ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line text-muted hover:text-ink'}`;


  return (
    <div ref={ref} className="relative" {...hoverProps}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('prefs.title')}
        className={iconButtonClass}>
        
        <SlidersHorizontalIcon className="h-[18px] w-[18px]" aria-hidden />
      </button>
      <DropdownPanel open={open} className="w-[min(288px,calc(100vw-1.5rem))]" label={t('prefs.title')}>
        <div className="space-y-4 p-3">
          <div>
            <p className="px-1 text-xs font-medium text-muted">{t('theme.mode')}</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {modeOptions.map((m) => {
                const Icon = modeIcons[m];
                return (
                  <button key={m} type="button" role="menuitemradio" aria-checked={mode === m} onClick={() => setMode(m)} className={chip(mode === m)}>
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{t(`theme.${m}` as TranslationKey)}</span>
                  </button>);

              })}
            </div>
          </div>
          <div>
            <p className="px-1 text-xs font-medium text-muted">{t('theme.accent')}</p>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {accentOptions.map((a) =>
              <button
                key={a.value}
                type="button"
                role="menuitemradio"
                aria-checked={accent === a.value}
                aria-label={t(`theme.${a.value}` as TranslationKey)}
                title={t(`theme.${a.value}` as TranslationKey)}
                onClick={() => setAccent(a.value)}
                className={chip(accent === a.value)}>
                
                  <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: a.swatch }}>
                    {accent === a.value && <CheckIcon className="h-3 w-3 text-white" aria-hidden />}
                  </span>
                </button>
              )}
            </div>
          </div>
          <div>
            <p className="px-1 text-xs font-medium text-muted">{t('lang.label')}</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {languages.map((l) =>
              <button
                key={l.value}
                type="button"
                role="menuitemradio"
                aria-checked={language === l.value}
                onClick={() => setLanguage(l.value)}
                className={chip(language === l.value)}>
                
                  <span className="truncate">{l.native}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </DropdownPanel>
    </div>);

}