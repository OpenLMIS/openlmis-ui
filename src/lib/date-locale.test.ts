import { ar, enUS, pt } from 'react-day-picker/locale';
import { describe, expect, it } from 'vitest';
import { dateLocaleFor } from '@/lib/date-locale';

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
});
