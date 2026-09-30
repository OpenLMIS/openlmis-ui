import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { TooltipProvider } from '@/components/ui/tooltip';
import { setAppearanceChoice, useAppearanceStore } from '@/lib/appearance';

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: 'en', resources: {} });
});

beforeEach(() => {
  localStorage.clear();
  useAppearanceStore.setState({ choice: null });
});

function renderSwitcher() {
  return render(
    <TooltipProvider>
      <ThemeSwitcher />
    </TooltipProvider>,
  );
}

async function openMenu() {
  await userEvent.click(screen.getByRole('button', { name: 'sidebar.theme' }));
}

async function pick(name: string) {
  await openMenu();
  await userEvent.click(await screen.findByRole('menuitemradio', { name }));
  await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
}

async function ticked(name: string) {
  await openMenu();
  return (await screen.findByRole('menuitemradio', { name })).getAttribute('aria-checked');
}

describe('ThemeSwitcher', () => {
  it('keeps a light or dark choice for this browser, closes, and ticks it', async () => {
    renderSwitcher();

    await pick('sidebar.theme.dark');

    expect(localStorage.getItem('theme')).toBe('dark');
    expect(await ticked('sidebar.theme.dark')).toBe('true');
  });

  it('ticks Use Default when the choice is forgotten', async () => {
    setAppearanceChoice('dark');
    renderSwitcher();

    await pick('sidebar.theme.default');

    expect(localStorage.getItem('theme')).toBeNull();
    expect(await ticked('sidebar.theme.default')).toBe('true');
  });
});
