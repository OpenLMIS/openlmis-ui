import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EVENTS, PORTAL_ELEMENT_ID, type Step, useJoyride } from 'react-joyride';
import { useDirection } from '@/components/ui/direction';
import { TourLegend } from '@/features/onboarding/components/tour-legend';
import { TourTooltip } from '@/features/onboarding/components/tour-tooltip';
import { toJoyridePlacement } from '@/features/onboarding/lib/placement';
import type { Tour, TourStep } from '@/features/onboarding/lib/types';
import { useResolvedAppearance } from '@/lib/appearance';
import { hasOpenDialog } from '@/lib/has-open-dialog';
import type { TourAnchor } from '@/lib/tour-anchors';

const SPOTLIGHT_PADDING = 8;
/** How long a loaded page may lack every anchor, and how long a loading page may take. */
const PAGE_WAIT_MS = 5000;
const LOAD_WAIT_MS = 30000;

const anchorSelector = (anchor: TourAnchor) => `[data-tour="${anchor}"]`;

/** Shown parts only; Safari before 17.4 lacks checkVisibility, where layout boxes tell instead. */
const isShown = (element: Element | null) =>
  !!element &&
  (typeof element.checkVisibility === 'function'
    ? element.checkVisibility({ visibilityProperty: true })
    : element.getClientRects().length > 0);

/** A skeleton in the page body, outside the top bar whose Show Guide button is busy itself. */
const isPageLoading = () =>
  Array.from(document.querySelectorAll('[data-slot="sidebar-inset"] [aria-busy="true"]')).some(
    (element) => !element.closest('header'),
  );

const shownAnchor = (anchor: TourAnchor) => isShown(document.querySelector(anchorSelector(anchor)));

/** None while the page is loading, unless `anyway` because the load wait ran out. */
const presentSteps = (tour: Tour, anyway = false) =>
  !anyway && isPageLoading()
    ? []
    : tour.steps.filter(
        (step) => shownAnchor(step.anchor) && (!step.spotlight || shownAnchor(step.spotlight)),
      );

const nextFrame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

/** The section's expand button; absent when the menu shows sections as icon flyouts. */
const sectionTrigger = (anchor: TourAnchor) =>
  document.querySelector<HTMLElement>(
    `${anchorSelector(anchor)} [data-slot="collapsible-trigger"]`,
  );

const isSectionOpen = (anchor: TourAnchor) =>
  sectionTrigger(anchor)?.getAttribute('aria-expanded') === 'true';

function setSectionOpen(anchor: TourAnchor, open: boolean) {
  if (isSectionOpen(anchor) !== open) sectionTrigger(anchor)?.click();
}

const isSelected = (anchor: TourAnchor) =>
  document.querySelector(anchorSelector(anchor))?.getAttribute('aria-selected') === 'true';

/** Clicks the tab and waits until it is selected, at most two seconds. */
async function selectTab(anchor: TourAnchor, follow: () => void) {
  if (isSelected(anchor)) return;
  follow();
  document.querySelector<HTMLElement>(anchorSelector(anchor))?.click();
  for (let frame = 0; frame < 120 && !isSelected(anchor); frame++) await nextFrame();
  await nextFrame();
}

/** The header cell of the column with this label inside the part, when the part is a table. */
const columnHeader = (scope: Element | null, label: string) =>
  Array.from(scope?.querySelectorAll<HTMLElement>('th') ?? []).find(
    (cell) =>
      (cell.textContent?.trim() === label ||
        Array.from(cell.querySelectorAll('[title]')).some(
          (part) => part.getAttribute('title') === label,
        )) &&
      isShown(cell),
  ) ?? null;

const isSidebarShortcut = (event: KeyboardEvent) =>
  (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b';

/** A soft ring that contrasts with the dimmed page in both themes. */
const halo = (token: '--background' | '--foreground') =>
  ({
    pointerEvents: 'none',
    stroke: `color-mix(in oklch, var(${token}) 35%, transparent)`,
    strokeWidth: 6,
    filter: 'blur(3px)',
  }) as const;

/** Resolves a theme token to pixels by applying it to a throwaway element. */
function tokenPixels(property: 'borderTopLeftRadius' | 'height', token: string) {
  const probe = document.createElement('div');
  probe.style[property] = `var(${token})`;
  document.body.append(probe);
  const pixels = Number.parseFloat(getComputedStyle(probe)[property]);
  probe.remove();
  return Number.isFinite(pixels) ? pixels : 0;
}

type TourRunnerProps = {
  tour: Tour;
  onEnd: () => void;
  onReady: () => void;
  /** Called before the tour changes the address itself, by switching a tab. */
  onFollow: () => void;
};

/** Plays the steps whose part of the page is shown, once the page stops loading. */
export function TourRunner({ tour, onEnd, onReady, onFollow }: TourRunnerProps) {
  const [steps, setSteps] = useState(() => presentSteps(tour));
  const giveUp = useEffectEvent(onEnd);
  const ready = useEffectEvent(onReady);

  useEffect(() => {
    if (steps.length) {
      ready();
      return;
    }
    const started = Date.now();
    let loadedAt: number | undefined;
    const timer = window.setInterval(() => {
      const now = Date.now();
      const loadedOut = now - started >= LOAD_WAIT_MS;
      if (!isPageLoading()) loadedAt ??= now;
      const found = presentSteps(tour, loadedOut);
      if (found.length) setSteps(found);
      else if (!loadedOut && (loadedAt === undefined || now - loadedAt < PAGE_WAIT_MS)) return;
      else giveUp();
      window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [steps.length, tour]);

  return steps.length ? <TourPlayer steps={steps} onEnd={onEnd} onFollow={onFollow} /> : null;
}

function TourPlayer({
  steps,
  onEnd,
  onFollow,
}: {
  steps: readonly TourStep[];
  onEnd: () => void;
  onFollow: () => void;
}) {
  const { t } = useTranslation();
  const direction = useDirection();
  const appearance = useResolvedAppearance();
  const [layout] = useState(() => ({
    spotlightRadius: tokenPixels('borderTopLeftRadius', '--radius-xl'),
    // Scroll targets clear of the sticky app header.
    scrollOffset: tokenPixels('height', '--app-header-height') + SPOTLIGHT_PADDING * 2,
    scrollDuration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300,
  }));
  // The menu shows one section at a time, so remember the user's to give it back at the end.
  const [userSection] = useState(
    () => steps.find((step) => step.expand && isSectionOpen(step.anchor))?.anchor,
  );
  // Likewise the tab the user was on, when the tour switches tabs.
  const [userTab] = useState(() => {
    const select = steps.find((step) => step.select)?.select;
    const tab = select && document.querySelector(anchorSelector(select));
    return tab
      ?.closest('[role="tablist"]')
      ?.querySelector('[aria-selected="true"]')
      ?.getAttribute('data-tour') as TourAnchor | undefined;
  });
  const followRef = useRef(onFollow);
  followRef.current = onFollow;
  const [startedAt] = useState(() => window.location.pathname);
  const joyrideSteps = useMemo<Step[]>(
    () =>
      steps.map((step) => {
        // A section's arrow points at its name, not the middle of its open list.
        const target = step.expand
          ? `${anchorSelector(step.anchor)} > button`
          : anchorSelector(step.anchor);
        // In a table, a column step sits beside and highlights that column's header.
        const column = step.column && t(step.column);
        // The spotlit part holding the target, so a page with several lists keeps them together.
        const holder = () => {
          const outer = anchorSelector(step.spotlight ?? step.anchor);
          return (
            document.querySelector(target)?.closest<HTMLElement>(outer) ??
            document.querySelector<HTMLElement>(outer)
          );
        };
        const inColumn = (fallback: () => HTMLElement | null) =>
          column ? () => columnHeader(holder(), column) ?? fallback() : fallback;
        const targetElement = () => document.querySelector<HTMLElement>(target);
        return {
          target: column ? inColumn(targetElement) : target,
          // Joyride would scroll to the spotlight, hiding a target above it under the header.
          ...(step.spotlight && {
            spotlightTarget: column ? inColumn(holder) : anchorSelector(step.spotlight),
            scrollTarget: column ? inColumn(targetElement) : target,
          }),
          title: t(step.title),
          content: step.legend ? (
            <>
              <p>{t(step.content)}</p>
              <TourLegend items={step.legend} />
            </>
          ) : (
            t(step.content)
          ),
          placement: toJoyridePlacement(step.placement ?? 'bottom', direction),
          ...(step.expand && {
            before: async () => {
              setSectionOpen(step.anchor, true);
              await nextFrame();
            },
            after: () => setSectionOpen(step.anchor, false),
          }),
          ...(step.select && {
            before: () => selectTab(step.select as TourAnchor, () => followRef.current()),
          }),
        };
      }),
    [steps, t, direction],
  );

  // Leaving the page hands the menu to the next page, which opens its own section.
  useEffect(
    () => () => {
      if (window.location.pathname !== startedAt) return;
      for (const step of steps) {
        if (step.expand && step.anchor !== userSection) setSectionOpen(step.anchor, false);
      }
      if (userSection) setSectionOpen(userSection, true);
      if (userTab && !isSelected(userTab))
        document.querySelector<HTMLElement>(anchorSelector(userTab))?.click();
    },
    [steps, userSection, userTab, startedAt],
  );
  const { controls, Tour } = useJoyride({
    steps: joyrideSteps,
    run: true,
    continuous: true,
    scrollToFirstStep: true,
    loaderComponent: null,
    tooltipComponent: TourTooltip,
    styles: {
      spotlight: { style: halo(appearance === 'dark' ? '--foreground' : '--background') },
    },
    options: {
      ...layout,
      skipBeacon: true,
      blockTargetInteraction: true,
      closeButtonAction: 'skip',
      dismissKeyAction: false,
      overlayClickAction: false,
      spotlightPadding: SPOTLIGHT_PADDING,
      arrowColor: 'var(--card)',
    },
    onEvent: ({ type }) => {
      if (type === EVENTS.TOUR_END) onEnd();
    },
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') controls.skip(null);
    };
    // Collapsing the menu mid-tour would swap an opened section for its icon, out of reach.
    const blockSidebarShortcut = (event: KeyboardEvent) => {
      if (!isSidebarShortcut(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    // A modal hides Joyride's portal from assistive technology and fights its focus trap.
    const observer = new MutationObserver(() => {
      const own = document.querySelector(`#${PORTAL_ELEMENT_ID} [role="alertdialog"]`);
      if (hasOpenDialog({ modalOnly: true, exclude: own })) controls.skip(null);
    });
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('keydown', blockSidebarShortcut, true);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keydown', blockSidebarShortcut, true);
      observer.disconnect();
    };
  }, [controls]);

  return Tour;
}
