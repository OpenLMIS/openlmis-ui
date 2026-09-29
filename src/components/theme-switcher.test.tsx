import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import { ThemeProvider } from 'next-themes';
import { initReactI18next } from 'react-i18next';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { TooltipProvider } from '@/components/ui/tooltip';
import { parseAppConfiguration, setAppConfiguration } from '@/lib/app-configuration';

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: 'en', resources: {} });
});

beforeEach(() => {
  localStorage.clear();
  setAppConfiguration(parseAppConfiguration({ theme: { defaultAppearance: 'dark' } }));
});

function renderSwitcher() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <ThemeSwitcher />
      </TooltipProvider>
    </ThemeProvider>,
  );
}

async function choose(name: string) {
  await userEvent.click(screen.getByRole('button', { name: 'sidebar.toggle-theme' }));
  await userEvent.click(await screen.findByRole('menuitemradio', { name }));
}

describe('ThemeSwitcher', () => {
  it('keeps a light or dark choice for this browser', async () => {
    renderSwitcher();

    await choose('sidebar.theme.light');

    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('forgets the choice with Use Default, so the deployment default applies again', async () => {
    localStorage.setItem('theme', 'light');
    renderSwitcher();

    await choose('sidebar.theme.default');

    expect(localStorage.getItem('theme')).toBeNull();
    expect(document.documentElement).toHaveClass('dark');
  });
});
