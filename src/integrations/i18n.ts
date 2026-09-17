import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@/lib/config';
import en from '@/messages/en.json';
import pl from '@/messages/pl.json';

export const defaultNS = 'translation' as const;

i18n
  .use(ICU)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    defaultNS,
    supportedLngs: SUPPORTED_LANGUAGES.map((lang) => lang.code),
    resources: {
      en: { translation: en },
      pl: { translation: pl },
    },
    fallbackLng: 'en',
    // Keys are flat: t('users.title') is a literal lookup, not a nested path.
    keySeparator: false,
    nsSeparator: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
