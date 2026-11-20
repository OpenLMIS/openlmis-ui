import { XIcon } from 'lucide-react';
import { type KeyboardEvent, useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TooltipRenderProps } from 'react-joyride';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/** Keeps Joyride's click wiring but not its English labels or the redundant button role. */
function joyrideButton({
  'aria-label': _label,
  title: _title,
  role: _role,
  ...props
}: TooltipRenderProps['primaryProps']) {
  return props;
}

export function TourTooltip({
  backProps,
  closeProps,
  index,
  isLastStep,
  primaryProps,
  size,
  skipProps,
  step,
  tooltipProps,
}: TooltipRenderProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const progressId = useId();
  const contentId = useId();
  const primary = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (index >= 0) primary.current?.focus({ preventScroll: true });
  }, [index]);

  // Tab cycles through the tooltip's buttons, so focus never falls behind the overlay.
  const trapTab = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const buttons = Array.from(event.currentTarget.querySelectorAll('button'));
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = (at + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
    event.preventDefault();
    buttons[next]?.focus();
  };

  return (
    <div className="w-80">
      <Card
        {...tooltipProps}
        onKeyDown={trapTab}
        aria-labelledby={titleId}
        aria-describedby={`${progressId} ${contentId}`}
      >
        <CardHeader>
          <CardTitle id={titleId}>{step.title}</CardTitle>
          <CardDescription id={progressId}>
            {t('onboarding.progress', { current: index + 1, total: size })}
          </CardDescription>
          <CardAction>
            <Button
              {...joyrideButton(closeProps)}
              aria-label={t('onboarding.close')}
              variant="ghost"
              size="icon-sm"
            >
              <XIcon />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent id={contentId}>{step.content}</CardContent>
        <CardFooter>
          <div className="flex w-full flex-wrap items-center gap-2">
            {!isLastStep && (
              <Button {...joyrideButton(skipProps)} variant="ghost">
                {t('onboarding.skip')}
              </Button>
            )}
            <div className="ms-auto flex gap-2">
              {index > 0 && (
                <Button {...joyrideButton(backProps)} variant="outline">
                  {t('onboarding.back')}
                </Button>
              )}
              <Button {...joyrideButton(primaryProps)} ref={primary}>
                {t(isLastStep ? 'onboarding.finish' : 'onboarding.next')}
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
