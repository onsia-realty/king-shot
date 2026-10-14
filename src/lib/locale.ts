import { useSyncExternalStore } from 'react';

export type Locale = 'ko' | 'en';
export const LOCALE_STORAGE_KEY = 'ks-language';
export const LOCALE_EVENT = 'ks-language-change';

const translators = {
  ko: (ko: string, _en: string) => ko,
  en: (_ko: string, en: string) => en,
};

type LocaleWindow = Window & { __ksLocale?: Locale };
const validLocale = (value: unknown): value is Locale => value === 'ko' || value === 'en';

export function isLocaleScope(pathname: string): boolean {
  return /^\/player\/?$/.test(pathname) || /^\/tools(?:\/|$)/.test(pathname);
}

export function getLocale(): Locale {
  if (typeof window === 'undefined') return 'ko';
  const current = (window as LocaleWindow).__ksLocale;
  if (validLocale(current)) return current;
  try {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return validLocale(saved) ? saved : 'ko';
  } catch {
    return 'ko';
  }
}

export function setLocale(locale: Locale): void {
  if (typeof window === 'undefined' || !validLocale(locale)) return;
  (window as LocaleWindow).__ksLocale = locale;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // The choice still works for this page when browser storage is blocked.
  }
  window.dispatchEvent(new CustomEvent(LOCALE_EVENT, { detail: locale }));
}

export function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key !== LOCALE_STORAGE_KEY && event.key !== null) return;
    (window as LocaleWindow).__ksLocale = validLocale(event.newValue) ? event.newValue : 'ko';
    onChange();
  };
  window.addEventListener(LOCALE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(LOCALE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

export function useLocale(): { locale: Locale; t: (ko: string, en: string) => string } {
  const locale = useSyncExternalStore<Locale>(subscribe, getLocale, () => 'ko');
  return { locale, t: translators[locale] };
}
