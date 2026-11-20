import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useNavigate,
  useSearch,
} from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TourLauncher } from '@/features/onboarding/components/tour-launcher';
import type { Tour, TourStep } from '@/features/onboarding/lib/types';
import { offlineEventsTab, sectionAnchor, TOUR_ANCHORS } from '@/lib/tour-anchors';
import { renderPage } from '@/test-utils/render-page';

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
      anchor: TOUR_ANCHORS.requisitionsResults,
      title: 'onboarding.requisitions-view.filters.title',
      content: 'onboarding.requisitions-view.filters.content',
    },
  ],
};

const state = vi.hoisted(() => ({ enabled: true, tour: undefined as Tour | undefined }));

vi.mock('@/lib/feature-flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/feature-flags')>()),
  useFlag: () => state.enabled,
}));

const SECTION_TOUR: Tour = {
  ...TOUR,
  steps: [
    TOUR.steps[0],
    ...(['orders', 'requisitions'] as const).map(
      (name): TourStep => ({
        anchor: sectionAnchor(`nav.${name}`),
        title: `nav.${name}`,
        content: `onboarding.home.section.${name}`,
        expand: true,
      }),
    ),
  ],
};

const toastInfo = vi.hoisted(() => vi.fn());
vi.mock('sonner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sonner')>()),
  toast: { info: toastInfo },
}));

vi.mock('@/features/onboarding/lib/tours', () => ({
  tourForRoute: () => state.tour,
}));

/** Shows a busy placeholder first, then the filters part, as a page skeleton does. */
function LoadingFilters() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 300);
    return () => clearTimeout(timer);
  }, []);
  return loaded ? (
    <div data-tour={TOUR_ANCHORS.requisitionsResults}>Filters</div>
  ) : (
    <div aria-busy="true">Loading</div>
  );
}

/** Two menu sections where opening one closes the other, as the sidebar does. */
function Sections() {
  const [open, setOpen] = useState<string | null>('nav.orders');
  return (['nav.orders', 'nav.requisitions'] as const).map((key) => (
    <Collapsible
      data-tour={sectionAnchor(key)}
      key={key}
      onOpenChange={(next) => setOpen(next ? key : null)}
      open={open === key}
    >
      <CollapsibleTrigger>{key}</CollapsibleTrigger>
      <CollapsibleContent>{key} screens</CollapsibleContent>
    </Collapsible>
  ));
}

function renderLauncher({ filters = true } = {}) {
  return renderPage(
    <TooltipProvider>
      <TourLauncher />
      <div data-tour={TOUR_ANCHORS.requisitionsPicker}>Picker</div>
      {filters && <div data-tour={TOUR_ANCHORS.requisitionsResults}>Filters</div>}
      <Sections />
    </TooltipProvider>,
  );
}

describe('TourLauncher', () => {
  beforeEach(() => {
    state.enabled = true;
    state.tour = TOUR;
  });

  it('offers no guide on a screen without a tour', async () => {
    state.tour = undefined;
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

  it('keeps focus in the tour between steps, so Escape on a later step still ends it', async () => {
    const user = userEvent.setup();
    renderLauncher();
    const guide = await screen.findByRole('button', { name: 'onboarding.show-guide' });
    await user.click(guide);
    const next = within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'onboarding.next',
    });
    const focusedGuide = vi.fn();
    guide.addEventListener('focus', focusedGuide);
    await user.click(next);
    await screen.findByRole('alertdialog', { name: 'onboarding.requisitions-view.filters.title' });
    expect(focusedGuide).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('cancels a guide still waiting for the page with Escape', async () => {
    const user = userEvent.setup();
    renderPage(
      <TooltipProvider>
        <div data-slot="sidebar-inset">
          <header>
            <TourLauncher />
          </header>
          <div aria-busy="true">Loading</div>
        </div>
      </TooltipProvider>,
    );
    const guide = await screen.findByRole('button', { name: 'onboarding.show-guide' });
    await user.click(guide);
    expect(guide).toHaveAttribute('aria-busy', 'true');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(guide).not.toHaveAttribute('aria-busy'));
  });

  it('says the guide is unavailable without taking focus from what the user moved to', async () => {
    const user = userEvent.setup();
    renderPage(
      <TooltipProvider>
        <TourLauncher />
        <input aria-label="Notes" />
      </TooltipProvider>,
    );
    await user.click(await screen.findByRole('button', { name: 'onboarding.show-guide' }));
    await user.click(screen.getByRole('textbox', { name: 'Notes' }));

    await waitFor(() =>
      expect(toastInfo).toHaveBeenCalledWith('onboarding.unavailable.title', expect.anything()),
    );
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveFocus();
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

  it.each(['missing', 'hidden', 'spotlit but missing'])(
    'leaves out a step whose part of the page is %s, so the count stays true',
    async (how) => {
      const user = userEvent.setup();
      if (how === 'spotlit but missing')
        state.tour = {
          ...TOUR,
          steps: [TOUR.steps[0], { ...TOUR.steps[0], spotlight: TOUR_ANCHORS.requisitionsResults }],
        };
      renderLauncher({ filters: how === 'hidden' });
      if (how === 'hidden') (await screen.findByText('Filters')).style.display = 'none';
      await user.click(await screen.findByRole('button', { name: 'onboarding.show-guide' }));

      const tooltip = await screen.findByRole('alertdialog');
      expect(within(tooltip).getByRole('button', { name: 'onboarding.finish' })).toBeVisible();
    },
  );

  it('plays a step on the shown copy of its part when an earlier copy is hidden', async () => {
    const user = userEvent.setup();
    renderPage(
      <TooltipProvider>
        <TourLauncher />
        <div data-tour={TOUR_ANCHORS.requisitionsPicker}>Picker</div>
        <div data-tour={TOUR_ANCHORS.requisitionsResults}>Hidden Filters</div>
        <div data-tour={TOUR_ANCHORS.requisitionsResults}>Shown Filters</div>
      </TooltipProvider>,
    );
    (await screen.findByText('Hidden Filters')).style.display = 'none';
    await user.click(await screen.findByRole('button', { name: 'onboarding.show-guide' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'onboarding.next',
      }),
    );

    await waitFor(() =>
      expect(screen.getByRole('alertdialog')).toHaveAccessibleName(
        'onboarding.requisitions-view.filters.title',
      ),
    );
  });

  it('opens a menu section for its step, then gives the user back the section they had open', async () => {
    const user = userEvent.setup();
    state.tour = SECTION_TOUR;
    renderLauncher();
    const requisitions = await screen.findByRole('button', { name: 'nav.requisitions' });
    const orders = screen.getByRole('button', { name: 'nav.orders' });
    await user.click(await screen.findByRole('button', { name: 'onboarding.show-guide' }));
    await user.click(await screen.findByRole('button', { name: 'onboarding.next' }));
    await screen.findByRole('alertdialog', { name: 'nav.orders' });
    await user.click(screen.getByRole('button', { name: 'onboarding.next' }));

    expect(await screen.findByRole('alertdialog', { name: 'nav.requisitions' })).toBeVisible();
    expect(requisitions).toHaveAttribute('aria-expanded', 'true');
    expect(orders).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByRole('button', { name: 'onboarding.finish' }));
    await waitFor(() => expect(orders).toHaveAttribute('aria-expanded', 'true'));
    expect(requisitions).toHaveAttribute('aria-expanded', 'false');
  });

  it('gives the user back their section when they close the tour on that section', async () => {
    const user = userEvent.setup();
    state.tour = SECTION_TOUR;
    renderLauncher();
    const orders = await screen.findByRole('button', { name: 'nav.orders' });
    await user.click(await screen.findByRole('button', { name: 'onboarding.show-guide' }));
    await user.click(await screen.findByRole('button', { name: 'onboarding.next' }));
    await screen.findByRole('alertdialog', { name: 'nav.orders' });

    await user.click(screen.getByRole('button', { name: 'onboarding.close' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(orders).toHaveAttribute('aria-expanded', 'true');
  });

  it('waits for the page to finish loading before counting its steps', async () => {
    const user = userEvent.setup();
    renderPage(
      <TooltipProvider>
        <div data-slot="sidebar-inset">
          <header>
            <TourLauncher />
          </header>
          <div data-tour={TOUR_ANCHORS.requisitionsPicker}>Picker</div>
          <LoadingFilters />
        </div>
      </TooltipProvider>,
    );
    const guide = await screen.findByRole('button', { name: 'onboarding.show-guide' });
    expect(screen.getByText('Loading')).toBeInTheDocument();
    await user.click(guide);

    const tooltip = await screen.findByRole('alertdialog');
    expect(within(tooltip).getByRole('button', { name: 'onboarding.next' })).toBeVisible();
  });

  it("waits for the next page while it loads, then plays that page's guide", async () => {
    const user = userEvent.setup();
    const rootRoute = createRootRoute({
      component: () => (
        <TooltipProvider>
          <TourLauncher />
          <Outlet />
        </TooltipProvider>
      ),
    });
    const routeTree = rootRoute.addChildren([
      createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: () => <div data-tour={TOUR_ANCHORS.requisitionsPicker}>Picker</div>,
      }),
      createRoute({
        getParentRoute: () => rootRoute,
        path: '/next',
        loader: () => new Promise((resolve) => setTimeout(resolve, 2000)),
        component: () => <div data-tour={TOUR_ANCHORS.requisitionsResults}>Next Page</div>,
      }),
    ]);
    const router = createRouter({ routeTree, history: createMemoryHistory() });
    render(<RouterProvider router={router} />);
    const guide = await screen.findByRole('button', { name: 'onboarding.show-guide' });

    router.history.push('/next');
    await user.click(guide);
    expect(guide).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('alertdialog')).toBeNull();

    await screen.findByText('Next Page');
    expect(await screen.findByRole('alertdialog')).toHaveAccessibleName(
      'onboarding.requisitions-view.filters.title',
    );
    expect(guide).not.toHaveAttribute('aria-busy');
  });

  it('switches tabs for its steps without ending, then gives the user back their tab', async () => {
    const user = userEvent.setup();
    state.tour = {
      ...TOUR,
      steps: [TOUR.steps[0], { ...TOUR.steps[1], select: offlineEventsTab('errors') }],
    };
    function Tabs() {
      const { tab = 'pending' } = useSearch({ strict: false }) as { tab?: string };
      const navigate = useNavigate();
      return (
        <div role="tablist">
          {(['pending', 'errors'] as const).map((value) => (
            <button
              aria-selected={tab === value}
              data-tour={offlineEventsTab(value)}
              key={value}
              onClick={() => void navigate({ to: '.', search: { tab: value } })}
              role="tab"
              type="button"
            >
              {value}
            </button>
          ))}
        </div>
      );
    }
    const rootRoute = createRootRoute({
      component: () => (
        <TooltipProvider>
          <TourLauncher />
          <Outlet />
        </TooltipProvider>
      ),
    });
    const routeTree = rootRoute.addChildren([
      createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        validateSearch: (search: Record<string, unknown>) => search as { tab?: string },
        component: () => (
          <>
            <Tabs />
            <div data-tour={TOUR_ANCHORS.requisitionsPicker}>Picker</div>
            <div data-tour={TOUR_ANCHORS.requisitionsResults}>Filters</div>
          </>
        ),
      }),
    ]);
    const router = createRouter({ routeTree, history: createMemoryHistory() });
    render(<RouterProvider router={router} />);
    await user.click(await screen.findByRole('button', { name: 'onboarding.show-guide' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'onboarding.next',
      }),
    );

    await waitFor(() =>
      expect(screen.getByRole('alertdialog')).toHaveAccessibleName(
        'onboarding.requisitions-view.filters.title',
      ),
    );
    expect(screen.getByRole('tab', { name: 'errors' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: 'onboarding.finish' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'pending' })).toHaveAttribute('aria-selected', 'true'),
    );
  });

  it('ends the tour when the user leaves after it switched a tab that keeps the address', async () => {
    const user = userEvent.setup();
    state.tour = {
      ...TOUR,
      steps: [TOUR.steps[0], { ...TOUR.steps[1], select: offlineEventsTab('errors') }],
    };
    function LocalTabs() {
      const [tab, setTab] = useState('pending');
      return (
        <div role="tablist">
          {(['pending', 'errors'] as const).map((value) => (
            <button
              aria-selected={tab === value}
              data-tour={offlineEventsTab(value)}
              key={value}
              onClick={() => setTab(value)}
              role="tab"
              type="button"
            >
              {value}
            </button>
          ))}
        </div>
      );
    }
    const router = renderPage(
      <TooltipProvider>
        <TourLauncher />
        <LocalTabs />
        <div data-tour={TOUR_ANCHORS.requisitionsPicker}>Picker</div>
        <div data-tour={TOUR_ANCHORS.requisitionsResults}>Filters</div>
      </TooltipProvider>,
    );
    await user.click(await screen.findByRole('button', { name: 'onboarding.show-guide' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'onboarding.next',
      }),
    );
    await screen.findByRole('alertdialog', { name: 'onboarding.requisitions-view.filters.title' });

    await router.navigate({ to: '/', search: { page: 2 } });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('still plays every step in browsers without Element.checkVisibility', async () => {
    const user = userEvent.setup();
    const checkVisibility = Element.prototype.checkVisibility;
    // @ts-expect-error simulates Safari before 17.4
    delete Element.prototype.checkVisibility;
    try {
      renderLauncher();
      await user.click(await screen.findByRole('button', { name: 'onboarding.show-guide' }));
      const tooltip = await screen.findByRole('alertdialog');
      expect(within(tooltip).getByRole('button', { name: 'onboarding.next' })).toBeVisible();
    } finally {
      Element.prototype.checkVisibility = checkVisibility;
    }
  });
});
