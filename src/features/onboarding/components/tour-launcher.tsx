import { CatchBoundary, useLocation, useMatches, useRouterState } from '@tanstack/react-router';
import { CircleHelpIcon } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { tourForRoute } from '@/features/onboarding/lib/tours';
import { useFlag } from '@/lib/feature-flags';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';

const TourRunner = lazy(() =>
  import('@/features/onboarding/components/tour-runner').then(({ TourRunner }) => ({
    default: TourRunner,
  })),
);

export function TourLauncher() {
  const { t } = useTranslation();
  const enabled = useFlag('ONBOARDING');
  const routeId = useMatches({ select: (matches) => matches.at(-1)?.routeId });
  const href = useLocation({ select: (location) => location.href });
  // While the next page loads, the address is new but the matched route is still the old one.
  const navigating = useRouterState({ select: (state) => state.status === 'pending' });
  const tour = tourForRoute(routeId);
  // The page the tour was started on; leaving it ends the tour for good.
  const [runningAt, setRunningAt] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // A tab the tour itself switches changes the address without leaving the page.
  const following = useRef(false);
  if (runningAt !== null && runningAt !== href) {
    if (following.current) setRunningAt(href);
    else {
      setRunningAt(null);
      setPreparing(false);
    }
  }

  useEffect(() => {
    if (!navigating) following.current = false;
  }, [navigating]);

  if (!enabled || !tour) return null;

  const label = t('onboarding.show-guide');
  const running = runningAt === href;
  const busy = running && (navigating || preparing);
  const end = () => {
    setRunningAt(null);
    setPreparing(false);
    buttonRef.current?.focus();
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              ref={buttonRef}
              aria-busy={busy || undefined}
              aria-label={label}
              data-tour={TOUR_ANCHORS.shellGuide}
              onClick={() => {
                setRunningAt(href);
                setPreparing(true);
              }}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          {busy ? <Spinner aria-hidden="true" /> : <CircleHelpIcon />}
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
      {running && (!navigating || following.current) && (
        <CatchBoundary getResetKey={() => tour.id} onCatch={end} errorComponent={() => null}>
          <Suspense fallback={null}>
            <TourRunner
              key={tour.id}
              tour={tour}
              onEnd={end}
              onReady={() => setPreparing(false)}
              onFollow={() => {
                following.current = true;
              }}
            />
          </Suspense>
        </CatchBoundary>
      )}
    </>
  );
}
