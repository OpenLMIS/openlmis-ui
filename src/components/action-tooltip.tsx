import type { ReactElement } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function ActionTooltip({ children, reason }: { children: ReactElement; reason?: string }) {
  return (
    <Tooltip disabled={!reason}>
      <TooltipTrigger render={children} />
      {reason && <TooltipContent>{reason}</TooltipContent>}
    </Tooltip>
  );
}
