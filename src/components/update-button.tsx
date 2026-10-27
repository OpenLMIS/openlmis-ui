import { RefreshCwIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { allowUnload, whenLeaveAllowed } from '@/hooks/use-leave-guard';
import { applyUpdate, useUpdateReady } from '@/lib/service-worker';

export function UpdateButton({ tooltipSide = 'top' }: { tooltipSide?: 'top' | 'inline-end' }) {
  const { t } = useTranslation();
  const updateReady = useUpdateReady();
  if (!updateReady) return null;
  const label = t('update.reload-to-update');

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            indicator="info"
            onClick={() => whenLeaveAllowed(() => void applyUpdate(allowUnload), 'leave')}
            size="icon-sm"
            tone="sidebar"
            variant="ghost"
          />
        }
      >
        <RefreshCwIcon />
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  );
}
