import { BellIcon, BellRingIcon, SquarePenIcon } from 'lucide-react';
import { use } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InventoryRowsContext } from '@/features/cce-inventory/components/inventory-rows-context';
import type { InventoryItem } from '@/features/cce-inventory/lib/types';
import { EQUIPMENT_REASON_KEYS, EQUIPMENT_STATUS } from '@/lib/cce-equipment-status';

export function FunctionalStatusCell({ item }: { item: InventoryItem }) {
  const { t } = useTranslation();
  const { activeAlerts, actions, stale } = use(InventoryRowsContext);
  const alerts = activeAlerts.get(item.id);
  const statusUpdate = actions?.statusUpdate;
  const { labelKey, tone, icon: Icon } = EQUIPMENT_STATUS[item.functionalStatus];
  const reason = item.reasonNotWorkingOrNotInUse;
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <div className="flex flex-nowrap items-center gap-1">
        <Badge variant={tone}>
          <Icon data-icon="inline-start" />
          {t(labelKey)}
        </Badge>
        {alerts && <AlertBell count={alerts.length} />}
        {statusUpdate && (
          <Button
            aria-label={t('cce-inventory.update-status', { name: item.referenceName })}
            disabled={stale}
            onClick={() => statusUpdate(item)}
            size="icon-xs"
            variant="ghost"
          >
            <SquarePenIcon />
          </Button>
        )}
      </div>
      {reason && (
        <span className="text-muted-foreground text-xs">{t(EQUIPMENT_REASON_KEYS[reason])}</span>
      )}
    </div>
  );
}

function AlertBell({ count }: { count: number }) {
  const { t } = useTranslation();
  const label =
    count === 0 ? t('cce-inventory.alerts-past') : t('cce-inventory.alerts-active', { count });
  return (
    <span
      aria-label={label}
      className="flex size-6 shrink-0 items-center justify-center"
      role="img"
    >
      {count === 0 ? (
        <BellIcon aria-hidden className="size-3" />
      ) : (
        <BellRingIcon aria-hidden className="size-3" />
      )}
    </span>
  );
}
