import { ar, enUS, pt } from 'react-day-picker/locale';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_LANGUAGES } from '@/lib/config';
import { DATE_LOCALES, dateLocaleFor } from '@/lib/date-locale';

describe('dateLocaleFor', () => {
  it('picks the calendar language by the base language, ignoring the region', () => {
    expect(dateLocaleFor('ar-EG')).toBe(ar);
    expect(dateLocaleFor('pt-BR')).toBe(pt);
    expect(dateLocaleFor('en')).toBe(enUS);
  });

  it('falls back to English for a language it does not know', () => {
    expect(dateLocaleFor('xx')).toBe(enUS);
    expect(dateLocaleFor(undefined)).toBe(enUS);
  });

  it('has a calendar language for every supported language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      expect(DATE_LOCALES).toHaveProperty(language.code);
    }
  });
});
