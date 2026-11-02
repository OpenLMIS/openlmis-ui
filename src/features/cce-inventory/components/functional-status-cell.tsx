import { BellIcon, BellRingIcon, SquarePenIcon } from 'lucide-react';
import { use } from 'react';
import { useTranslation } from 'react-i18next';
import { formatTimestamp } from '@/components/form/date-value';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { InventoryRowsContext } from '@/features/cce-inventory/components/inventory-rows-context';
import { alertText } from '@/features/cce-inventory/lib/alerts';
import type { InventoryAlert, InventoryItem } from '@/features/cce-inventory/lib/types';
import { EQUIPMENT_REASON_KEYS, EQUIPMENT_STATUS } from '@/lib/cce-equipment-status';

export function FunctionalStatusCell({
  item,
  timeZone,
}: {
  item: InventoryItem;
  timeZone: string | undefined;
}) {
  const { t } = useTranslation();
  const { activeAlerts, actions } = use(InventoryRowsContext);
  const alerts = activeAlerts.get(item.id);
  const statusUpdate = actions?.statusUpdate;
  const { labelKey, tone, icon: Icon } = EQUIPMENT_STATUS[item.functionalStatus];
  const reason = item.reasonNotWorkingOrNotInUse;
  const updateLabel = t('cce-inventory.update-status', { name: item.referenceName });
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-1">
        <Badge variant={tone}>
          <Icon data-icon="inline-start" />
          {t(labelKey)}
        </Badge>
        {alerts && <AlertBell alerts={alerts} timeZone={timeZone} />}
        {statusUpdate && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={updateLabel}
                  onClick={() => statusUpdate(item)}
                  size="icon-xs"
                  variant="ghost"
                />
              }
            >
              <SquarePenIcon />
            </TooltipTrigger>
            <TooltipContent>{updateLabel}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {reason && (
        <span className="text-muted-foreground text-xs">{t(EQUIPMENT_REASON_KEYS[reason])}</span>
      )}
    </div>
  );
}

function AlertBell({
  alerts,
  timeZone,
}: {
  alerts: InventoryAlert[];
  timeZone: string | undefined;
}) {
  const { t } = useTranslation();
  if (alerts.length === 0) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button aria-label={t('cce-inventory.alerts-past')} size="icon-xs" variant="ghost" />
          }
        >
          <BellIcon />
        </TooltipTrigger>
        <TooltipContent>{t('cce-inventory.alerts-past')}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-label={t('cce-inventory.alerts-active', { count: alerts.length })}
            size="icon-xs"
            variant="ghost"
          />
        }
      >
        <BellRingIcon />
      </PopoverTrigger>
      <PopoverContent align="start" side="inline-start">
        <PopoverTitle>{t('cce-inventory.alerts-title')}</PopoverTitle>
        <ul className="flex flex-col gap-2">
          {alerts.map((alert) => (
            <AlertLine alert={alert} key={alert.alert_id} timeZone={timeZone} />
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function AlertLine({ alert, timeZone }: { alert: InventoryAlert; timeZone: string | undefined }) {
  const { i18n } = useTranslation();
  return (
    <li className="flex flex-col gap-0.5 text-sm">
      <span className="text-muted-foreground text-xs">
        {formatTimestamp(alert.start_ts, i18n.language, { time: 'short', timeZone })}
      </span>
      <span dir="auto">{alertText(alert, i18n.language)}</span>
    </li>
  );
}
