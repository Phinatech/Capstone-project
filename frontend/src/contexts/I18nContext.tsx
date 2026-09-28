import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { languages, translations } from '../data/translations';
import type { Language, TranslationKey } from '../data/translations';

const LANG_KEY = 'sokoto-cover-language';

interface I18nContextValue {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
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
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      let text: string = translations[language][key] ?? translations.en[key] ?? key;
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