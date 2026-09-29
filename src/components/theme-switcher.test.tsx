import { render, screen } from '@testing-library/react';
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
  await userEvent.click(screen.getByRole('button', { name: 'sidebar.toggle-theme' }));
}

describe('ThemeSwitcher', () => {
  it('keeps a light or dark choice for this browser and ticks it', async () => {
    renderSwitcher();
    await openMenu();

    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'sidebar.theme.dark' }));

    expect(localStorage.getItem('theme')).toBe('dark');
    expect(screen.getByRole('menuitemradio', { name: 'sidebar.theme.dark' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('ticks Use Default at once when the choice is forgotten', async () => {
    setAppearanceChoice('dark');
    renderSwitcher();
    await openMenu();

    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'sidebar.theme.default' }),
    );

    expect(localStorage.getItem('theme')).toBeNull();
    expect(screen.getByRole('menuitemradio', { name: 'sidebar.theme.default' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
