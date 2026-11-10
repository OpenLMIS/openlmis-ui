import { useQuery } from '@tanstack/react-query';
import { CircleAlertIcon, CircleCheckIcon, CircleHelpIcon, SnowflakeIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { facilityCceOptions } from '@/features/cce-inventory/api/queries';
import { facilityCceStatus } from '@/features/cce-inventory/lib/facility-cce-status';

export function FacilityCceStatus({
  facilityId,
  canView,
}: {
  facilityId: string;
  canView: boolean;
}) {
  const { t } = useTranslation();
  const query = useQuery({ ...facilityCceOptions(facilityId), enabled: canView, retry: false });
  const status = facilityCceStatus(canView && !query.isError ? query.data?.items : undefined);
  const items = query.data?.items ?? [];
  const alerts = query.data?.alerts ?? [];
  const Icon =
    status === 'all-functioning'
      ? CircleCheckIcon
      : status === 'unknown'
        ? CircleHelpIcon
        : status === 'no-cce'
          ? SnowflakeIcon
          : CircleAlertIcon;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={
          status === 'all-functioning'
            ? 'text-success'
            : status === 'not-functioning'
              ? 'text-destructive'
              : status === 'not-fully-functioning'
                ? 'text-warning'
                : 'text-muted-foreground'
        }
      >
        <Icon className="size-4" />
      </span>
      <span>
        {t(
          canView && query.isPending
            ? 'cce-inventory.facility-status.loading'
            : `cce-inventory.facility-status.${status}`,
        )}
      </span>
      {alerts.length > 0 && (
        <span
          className="size-2 rounded-full bg-destructive"
          role="img"
          aria-label={t('cce-inventory.facility-status.alert')}
        />
      )}
      {canView && items.length > 0 && (
        <Popover>
          <PopoverTrigger render={<Button variant="link" size="sm" />}>
            {t('cce-inventory.facility-status.items', { count: items.length })}
          </PopoverTrigger>
          <PopoverContent>
            <div className="flex flex-col gap-3">
              <strong>{t('cce-inventory.facility-status.items', { count: items.length })}</strong>
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <span className="min-w-0 break-words">{item.referenceName}</span>
                  {alerts.some((alert) => alert.device_id === item.id) && (
                    <span
                      className="size-2 shrink-0 rounded-full bg-destructive"
                      role="img"
                      aria-label={t('cce-inventory.facility-status.alert')}
                    />
                  )}
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
