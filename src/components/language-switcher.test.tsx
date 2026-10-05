import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTranslation } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageSwitcher } from '@/components/language-switcher';
import { TextDirectionProvider } from '@/components/text-direction';
import { TooltipProvider } from '@/components/ui/tooltip';
import i18n, { initI18n } from '@/integrations/i18n';

const catalogFiles = import.meta.glob<string>('../../public/locales/*.json', {
  eager: true,
  query: '?raw',
  import: 'default',
});

vi.mock('i18next-http-backend', () => ({
  default: class {
    static type = 'backend';
    type = 'backend';
    read(language: string, _namespace: string, callback: (error: null, data: unknown) => void) {
      callback(null, JSON.parse(catalogFiles[`../../public/locales/${language}.json`]));
    }
  },
}));

beforeEach(async () => {
  localStorage.setItem('i18nextLng', 'en');
  await initI18n();
});

function Page() {
  const { t } = useTranslation();
  return (
    <TextDirectionProvider>
      <TooltipProvider>
        <LanguageSwitcher />
        <p>{t('users.title')}</p>
        <input aria-label="Draft" defaultValue="Unsaved value" />
      </TooltipProvider>
    </TextDirectionProvider>
  );
}

describe('LanguageSwitcher', () => {
  it.each([
    ['es', 'Español', 'Usuarios'],
    ['fr', 'Français', 'Utilisateurs'],
  ])('switches to %s without replacing the current form', async (code, name, title) => {
    render(<Page />);
    const draft = screen.getByRole('textbox', { name: 'Draft' });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Change Language' }));
    await user.click(await screen.findByRole('menuitemradio', { name }));

    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Draft' })).toBe(draft);
    expect(draft).toHaveValue('Unsaved value');
    expect(document.documentElement.lang).toBe(code);
    expect(document.documentElement.dir).toBe('ltr');
    expect(localStorage.getItem('i18nextLng')).toBe(code);
  });

  it.each(['es-MX', 'fr-CA'])(
    'restores the persisted %s choice when the app starts',
    async (language) => {
      localStorage.setItem('i18nextLng', language);
      await initI18n();
      expect(i18n.resolvedLanguage).toBe(language.split('-')[0]);
      expect(i18n.t('users.title')).not.toBe('Users');
    },
  );

  it.each(['es', 'fr'])('switches from Arabic back to left-to-right %s', async (language) => {
    await i18n.changeLanguage('ar');
    render(<Page />);
    expect(document.documentElement.dir).toBe('rtl');

    await act(() => i18n.changeLanguage(language));

    await waitFor(() => expect(document.documentElement.lang).toBe(language));
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('uses English when a translated message is absent', async () => {
    await i18n.changeLanguage('fr');
    const messages = i18n.getResourceBundle('fr', 'translation') as Record<string, string>;
    delete messages['profile.title'];
    expect(i18n.t('profile.title')).toBe('Profile');
  });

  it('uses English for an unsupported persisted language', async () => {
    localStorage.setItem('i18nextLng', 'xx');
    await initI18n();
    expect(i18n.resolvedLanguage).toBe('en');
    expect(i18n.t('users.title')).toBe('Users');
  });
});
