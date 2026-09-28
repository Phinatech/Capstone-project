import { useCallback, useRef, useState } from 'react';
import { CheckIcon, LanguagesIcon } from 'lucide-react';
import { DropdownPanel, iconButtonClass, menuItemClass } from '../DropdownPanel';
import { useDismiss } from '../../hooks/useDismiss';
import { useI18n } from '../../contexts/I18nContext';
import { languages } from '../../data/translations';

export function LanguageMenu({ showLabel = false }: {showLabel?: boolean;}) {
  const { language, setLanguage, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('lang.label')}
        className={
        showLabel ?
        'flex h-9 items-center gap-2 rounded-md border border-line px-2.5 text-xs font-medium text-ink transition-colors duration-150 ease-out hover:border-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent' :
        iconButtonClass
        }>
        
        <LanguagesIcon className="h-[18px] w-[18px]" aria-hidden />
        {showLabel ?
        <span className="uppercase">{language}</span> :

        <span className="sr-only">{language}</span>
        }
      </button>
      <DropdownPanel open={open} className="w-48 py-1.5" label={t('lang.label')}>
        {languages.map((l) =>
        <button
          key={l.value}
          type="button"
          role="menuitemradio"
          aria-checked={language === l.value}
          onClick={() => {
            setLanguage(l.value);
            close();
          }}
          className={menuItemClass}>
          
            <span className="w-6 font-mono text-xs uppercase text-muted">{l.value}</span>
            <span className="flex-1 truncate">{l.native}</span>
            {language === l.value && <CheckIcon className="h-4 w-4 text-accent" aria-hidden />}
          </button>
        )}
      </DropdownPanel>
    </div>);

}