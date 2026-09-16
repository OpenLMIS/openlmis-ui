import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@/lib/config';
import en from '@/messages/en.json';
import pl from '@/messages/pl.json';

export const defaultNS = 'translation' as const;

i18n
  // ICU MessageFormat for plurals, selects, etc.
  .use(ICU)
  // Auto-detect language from localStorage / browser
  .use(LanguageDetector)
  // Bind to React context + Suspense
  .use(initReactI18next)
  .init({
    defaultNS,
    supportedLngs: SUPPORTED_LANGUAGES.map((lang) => lang.code),
    // Translations bundled in code - no HTTP loading
    resources: {
      en: { translation: en },
      pl: { translation: pl },
    },
    fallbackLng: 'en',
    // Flat keys: t('users.title') looks up literal "users.title", not nested { users: { title } }
    keySeparator: false,
    // Single namespace: disable ":" separator to avoid conflicts with key names
    nsSeparator: false,
    interpolation: {
      // React already escapes JSX output
      escapeValue: false,
    },
    detection: {
      // localStorage first (user's explicit choice), then browser language
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
