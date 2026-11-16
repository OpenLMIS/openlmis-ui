import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EVENTS, PORTAL_ELEMENT_ID, type Step, useJoyride } from 'react-joyride';
import { useDirection } from '@/components/ui/direction';
import { TourTooltip } from '@/features/onboarding/components/tour-tooltip';
import { toJoyridePlacement } from '@/features/onboarding/lib/placement';
import type { Tour, TourStep } from '@/features/onboarding/lib/types';
import { useResolvedAppearance } from '@/lib/appearance';
import { hasOpenDialog } from '@/lib/has-open-dialog';

const SPOTLIGHT_PADDING = 8;
const PAGE_WAIT_MS = 5000;

const targetOf = (step: TourStep) => `[data-tour="${step.anchor}"]`;
const presentSteps = (tour: Tour) =>
  tour.steps.filter((step) => document.querySelector(targetOf(step)));

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
};

/** Plays only the steps whose part of the page is shown, waiting while the page still loads. */
export function TourRunner({ tour, onEnd }: TourRunnerProps) {
  const [steps, setSteps] = useState(() => presentSteps(tour));
  const giveUp = useEffectEvent(onEnd);

  useEffect(() => {
    if (steps.length) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const found = presentSteps(tour);
      if (found.length) setSteps(found);
      else if (Date.now() - started < PAGE_WAIT_MS) return;
      else giveUp();
      window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [steps.length, tour]);

  return steps.length ? <TourPlayer steps={steps} onEnd={onEnd} /> : null;
}

function TourPlayer({ steps, onEnd }: { steps: readonly TourStep[]; onEnd: () => void }) {
  const { t } = useTranslation();
  const direction = useDirection();
  const appearance = useResolvedAppearance();
  const [layout] = useState(() => ({
    spotlightRadius: tokenPixels('borderTopLeftRadius', '--radius-xl'),
    // Scroll targets clear of the sticky app header.
    scrollOffset: tokenPixels('height', '--app-header-height') + SPOTLIGHT_PADDING * 2,
    scrollDuration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300,
  }));
  const joyrideSteps = useMemo<Step[]>(
    () =>
      steps.map((step) => ({
        target: targetOf(step),
        title: t(step.title),
        content: t(step.content),
        placement: toJoyridePlacement(step.placement ?? 'bottom', direction),
      })),
    [steps, t, direction],
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
    // A modal hides Joyride's portal from assistive technology and fights its focus trap.
    const observer = new MutationObserver(() => {
      const own = document.querySelector(`#${PORTAL_ELEMENT_ID} [role="alertdialog"]`);
      if (hasOpenDialog({ modalOnly: true, exclude: own })) controls.skip(null);
    });
    document.addEventListener('keydown', onKeyDown);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      observer.disconnect();
    };
  }, [controls]);

  return Tour;
}
