import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@/lib/config';

export const defaultNS = 'translation' as const;

// Catalogs are served from `public/locales/` instead of being bundled, so a
// deployment can add or correct a language without a rebuild.
export function initI18n() {
  return i18n
    .use(ICU)
    .use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      defaultNS,
      ns: [defaultNS],
      supportedLngs: SUPPORTED_LANGUAGES.map((lang) => lang.code),
      // `pt-BR` and `ar-EG` resolve to the `pt` and `ar` catalogs.
      load: 'languageOnly',
      fallbackLng: 'en',
      // Keys are flat: t('users.title') is a literal lookup, not a nested path.
      keySeparator: false,
      nsSeparator: false,
      interpolation: {
        escapeValue: false,
      },
      backend: {
        loadPath: `${import.meta.env.BASE_URL}locales/{{lng}}.json`,
      },
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage'],
      },
    });
}

export default i18n;
