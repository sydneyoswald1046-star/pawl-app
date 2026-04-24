import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getLocales } from 'expo-localization';
import en, { type TranslationKey } from './en';
import es from './es';

export type Locale = 'en' | 'es';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'es'];

export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
};

const DICTS: Record<Locale, Record<string, string>> = { en, es };

let currentLocale: Locale = detectInitialLocale();

function detectInitialLocale(): Locale {
  try {
    const device = getLocales()[0]?.languageCode;
    if (device && (SUPPORTED_LOCALES as string[]).includes(device)) {
      return device as Locale;
    }
  } catch {
    // ignore
  }
  return 'en';
}

export function getCurrentLocale(): Locale {
  return currentLocale;
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(currentLocale);

  const setLocale = useCallback((l: Locale) => {
    currentLocale = l;
    setLocaleState(l);
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const dict = DICTS[locale];
      let val = dict[key] ?? DICTS.en[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          val = val.replace(`{${k}}`, String(v));
        }
      }
      return val;
    },
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>.');
  return ctx;
}

export function useT() {
  return useI18n().t;
}

export function tPlural(
  t: I18nContextValue['t'],
  baseKey: string,
  count: number,
  params?: Record<string, string | number>
): string {
  const key = (count === 1 ? `${baseKey}_one` : `${baseKey}_other`) as TranslationKey;
  return t(key, { count, ...(params ?? {}) });
}
