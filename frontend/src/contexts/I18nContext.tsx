import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { languages, translations } from '../data/translations';
import type { Language, TranslationKey } from '../data/translations';

const LANG_KEY = 'sokoto-cover-language';

interface I18nContextValue {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  /**
   * Resolves a translation key, or passes a plain string through untouched.
   *
   * Auth errors now arrive from the backend as machine-readable codes, and
   * only some of them have a key of our own. The ones that do not are shown
   * in the server's wording rather than being dropped on the floor — so `t`
   * has to accept a bare string as well as a known key.
   */
  t: (key: TranslationKey | string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readLanguage(): Language {
  try {
    const v = window.localStorage.getItem(LANG_KEY);
    return v === 'ha' || v === 'fr' || v === 'en' ? v : 'en';
  } catch {
    return 'en';
  }
}

export function I18nProvider({ children }: {children: React.ReactNode;}) {
  const [language, setLanguage] = useState<Language>(readLanguage);
  const locale = languages.find((l) => l.value === language)?.locale ?? 'en-NG';

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem(LANG_KEY, language);
    } catch {

      /* storage unavailable */}
  }, [language]);

  const t = useCallback(
    (key: TranslationKey | string, vars?: Record<string, string | number>) => {
      // Indexed as a plain string map so an unrecognised value falls through
      // to itself, which is what lets a server message render as written.
      const table = translations[language] as Record<string, string>;
      const english = translations.en as Record<string, string>;
      let text: string = table[key] ?? english[key] ?? key;
      if (vars) Object.entries(vars).forEach(([k, v]) => text = text.replace(`{${k}}`, String(v)));
      return text;
    },
    [language]
  );

  const value = useMemo(() => ({ language, locale, setLanguage, t }), [language, locale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}