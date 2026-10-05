import { describe, expect, it } from 'vitest';
import { loadDateLocale } from '@/lib/date-locale';

describe('loadDateLocale', () => {
  it('loads the calendar language by the base language, ignoring the region', async () => {
    expect((await loadDateLocale('ar-EG')).code).toBe('ar');
    expect((await loadDateLocale('pt-BR')).code).toBe('pt');
    expect((await loadDateLocale('en')).code).toBe('en-US');
    expect((await loadDateLocale('es-MX')).code).toBe('es');
    expect((await loadDateLocale('fr-CA')).code).toBe('fr');
  });

  it('falls back to English for a language it does not know', async () => {
    expect((await loadDateLocale('xx')).code).toBe('en-US');
    expect((await loadDateLocale(undefined)).code).toBe('en-US');
  });
});
