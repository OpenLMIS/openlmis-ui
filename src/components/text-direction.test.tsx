import { render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import { TextDirectionProvider } from '@/components/text-direction';

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: ['en', 'pt', 'ar'],
    resources: { en: {}, pt: {}, ar: {} },
  });
});

describe('TextDirectionProvider', () => {
  it('marks the document ltr for a left-to-right language', async () => {
    await i18n.changeLanguage('en');
    render(<TextDirectionProvider>content</TextDirectionProvider>);

    expect(screen.getByText('content')).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
  });

  it('marks the document rtl for a right-to-left language', async () => {
    await i18n.changeLanguage('ar');
    render(<TextDirectionProvider>content</TextDirectionProvider>);

    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('flips back when the language changes', async () => {
    await i18n.changeLanguage('ar');
    render(<TextDirectionProvider>content</TextDirectionProvider>);
    expect(document.documentElement.dir).toBe('rtl');

    await i18n.changeLanguage('pt');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('pt');
  });
});
