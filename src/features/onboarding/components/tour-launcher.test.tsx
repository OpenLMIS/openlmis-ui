import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TourLauncher } from '@/features/onboarding/components/tour-launcher';
import type { Tour } from '@/features/onboarding/lib/types';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';
import { renderPage } from '@/test-utils/render-page';

const state = vi.hoisted(() => ({ enabled: true, hasTour: true }));

const TOUR: Tour = {
  id: 'test',
  routeIds: [],
  steps: [
    {
      anchor: TOUR_ANCHORS.requisitionsPicker,
      title: 'onboarding.requisitions-view.picker.title',
      content: 'onboarding.requisitions-view.picker.content',
    },
    {
      anchor: TOUR_ANCHORS.requisitionsFilters,
      title: 'onboarding.requisitions-view.filters.title',
      content: 'onboarding.requisitions-view.filters.content',
    },
  ],
};

vi.mock('@/lib/feature-flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/feature-flags')>()),
  useFlag: () => state.enabled,
}));

vi.mock('@/features/onboarding/lib/tours', () => ({
  tourForRoute: () => (state.hasTour ? TOUR : undefined),
}));

function renderLauncher({ filters = true } = {}) {
  return renderPage(
    <TooltipProvider>
      <TourLauncher />
      <div data-tour={TOUR_ANCHORS.requisitionsPicker}>Picker</div>
      {filters && <div data-tour={TOUR_ANCHORS.requisitionsFilters}>Filters</div>}
    </TooltipProvider>,
  );
}

describe('TourLauncher', () => {
  beforeEach(() => {
    state.enabled = true;
    state.hasTour = true;
  });

  it('offers no guide on a screen without a tour', async () => {
    state.hasTour = false;
    renderLauncher();
    await screen.findByText('Picker');
    expect(screen.queryByRole('button', { name: 'onboarding.show-guide' })).toBeNull();
  });

  it('starts only on click, and Escape ends the tour with focus back on the button', async () => {
    const user = userEvent.setup();
    renderLauncher();
    const button = await screen.findByRole('button', { name: 'onboarding.show-guide' });
    expect(screen.queryByRole('alertdialog')).toBeNull();

    await user.click(button);
    const tooltip = await screen.findByRole('alertdialog');
    expect(tooltip).toHaveAccessibleName('onboarding.requisitions-view.picker.title');
    expect(tooltip).toHaveAccessibleDescription(/^onboarding\.progress /);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(button).toHaveFocus();
  });

  it('does not restart by itself when the user leaves mid-tour and comes back', async () => {
    const user = userEvent.setup();
    const router = renderLauncher();
    await user.click(await screen.findByRole('button', { name: 'onboarding.show-guide' }));
    await screen.findByRole('alertdialog');

    await router.navigate({ to: '/', search: { page: 2 } });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    router.history.back();
    await waitFor(() => expect(router.state.location.searchStr).toBe(''));
    await screen.findByText('Picker');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('leaves out steps whose part of the page is missing, so the count stays true', async () => {
    const user = userEvent.setup();
    renderLauncher({ filters: false });
    await user.click(await screen.findByRole('button', { name: 'onboarding.show-guide' }));

    const tooltip = await screen.findByRole('alertdialog');
    expect(within(tooltip).getByRole('button', { name: 'onboarding.finish' })).toBeVisible();
  });
});
