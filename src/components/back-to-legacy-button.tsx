import { HistoryIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useBackToLegacy } from '@/hooks/use-back-to-legacy';

export function BackToLegacyButton({
  tooltipSide = 'top',
}: {
  tooltipSide?: 'top' | 'inline-end';
}) {
  const legacy = useBackToLegacy();
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={legacy.label}
            onClick={legacy.onClick}
            size="icon-sm"
            tone="sidebar"
            variant="warning"
          />
        }
      >
        <HistoryIcon />
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>
        <div>
          <div>{legacy.label}</div>
          <div>{legacy.description}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
