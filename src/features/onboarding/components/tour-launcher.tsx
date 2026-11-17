import { CatchBoundary, useLocation, useMatches } from '@tanstack/react-router';
import { CircleHelpIcon } from 'lucide-react';
import { lazy, Suspense, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
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
  const tour = tourForRoute(routeId);
  // The page the tour was started on; leaving it ends the tour for good.
  const [runningAt, setRunningAt] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  if (runningAt !== null && runningAt !== href) setRunningAt(null);

  if (!enabled || !tour) return null;

  const label = t('onboarding.show-guide');
  const end = () => {
    setRunningAt(null);
    buttonRef.current?.focus();
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              ref={buttonRef}
              aria-label={label}
              data-tour={TOUR_ANCHORS.shellGuide}
              onClick={() => setRunningAt(href)}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <CircleHelpIcon />
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
      {runningAt === href && (
        <CatchBoundary getResetKey={() => href} onCatch={end} errorComponent={() => null}>
          <Suspense fallback={null}>
            <TourRunner tour={tour} onEnd={end} />
          </Suspense>
        </CatchBoundary>
      )}
    </>
  );
}
