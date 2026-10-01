import type { Locale } from 'react-day-picker';
import { ar, enUS, pt } from 'react-day-picker/locale';
import type { SUPPORTED_LANGUAGES } from '@/lib/config';

type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const DATE_LOCALES: Record<LanguageCode, Locale> = { en: enUS, pt, ar };

export function dateLocaleFor(language: string | undefined): Locale {
  const code = language?.split('-')[0] as LanguageCode;
  return DATE_LOCALES[code] ?? enUS;
}
