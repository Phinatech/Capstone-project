import { useCallback, useRef, useState } from 'react';
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { DropdownPanel, iconButtonClass } from '../DropdownPanel';
import { useDismiss } from '../../hooks/useDismiss';
import { useTheme } from '../../contexts/ThemeContext';
import { useI18n } from '../../contexts/I18nContext';
import { accentOptions, modeOptions } from '../../data/themes';
import type { ThemeMode } from '../../data/themes';
import type { TranslationKey } from '../../data/translations';

export const modeIcons: Record<ThemeMode, typeof SunIcon> = { light: SunIcon, dark: MoonIcon, system: MonitorIcon };

export function ThemeMenu() {
  const { mode, resolvedMode, accent, setMode, setAccent } = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  const Current = resolvedMode === 'dark' ? MoonIcon : SunIcon;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('theme.appearance')}
        className={iconButtonClass}>
        
        <Current className="h-[18px] w-[18px]" aria-hidden />
      </button>
      <DropdownPanel open={open} className="w-64" label={t('theme.appearance')}>
        <div className="p-3">
          <p className="px-1 text-xs font-medium text-muted">{t('theme.mode')}</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {modeOptions.map((m) => {
              const Icon = modeIcons[m];
              const active = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => setMode(m)}
                  className={`flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-xs font-medium transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  active ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line text-muted hover:text-ink'}`
                  }>
                  
                  <Icon className="h-4 w-4" aria-hidden />
                  <span className="max-w-full truncate">{t(`theme.${m}` as TranslationKey)}</span>
                </button>);

            })}
          </div>
          <p className="mt-4 px-1 text-xs font-medium text-muted">{t('theme.accent')}</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {accentOptions.map((a) => {
              const active = accent === a.value;
              return (
                <button
                  key={a.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => setAccent(a.value)}
                  className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  active ? 'border-accent text-ink' : 'border-line text-muted hover:text-ink'}`
                  }>
                  
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{ background: a.swatch }}>
                    {active && <CheckIcon className="h-2.5 w-2.5 text-white" aria-hidden />}
                  </span>
                  <span className="truncate">{t(`theme.${a.value}` as TranslationKey)}</span>
                </button>);

            })}
          </div>
        </div>
      </DropdownPanel>
    </div>);

}