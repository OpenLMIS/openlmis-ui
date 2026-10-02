import type { Locale } from 'react-day-picker';
import type { SUPPORTED_LANGUAGES } from '@/lib/config';

type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const loadEnglish = () => import('react-day-picker/locale/en-US').then((module) => module.enUS);

// Loaded only with a calendar, so no page pays for the date libraries until it shows one.
const DATE_LOCALES: Record<LanguageCode, () => Promise<Locale>> = {
  en: loadEnglish,
  pt: () => import('react-day-picker/locale/pt').then((module) => module.pt),
  ar: () => import('react-day-picker/locale/ar').then((module) => module.ar),
};

export function loadDateLocale(language: string | undefined): Promise<Locale> {
  const code = language?.split('-')[0] as LanguageCode;
  return (DATE_LOCALES[code] ?? loadEnglish)();
}
