import { useTranslation } from 'react-i18next';
import { formatTimestamp } from '@/components/form/date-value';
import { SettingsItem, SettingsList } from '@/components/form/settings-list';
import { Skeleton } from '@/components/ui/skeleton';
import type { Order } from '@/features/orders/lib/types';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';

export function OrderHeader({ order }: { order: Order }) {
  const { t, i18n } = useTranslation();
  const timeZone = useDeploymentTimeZone();
  const fields = [
    { key: 'status' as const, value: t('orders.edit.status-creating') },
    {
      key: 'date-created' as const,
      value: formatTimestamp(order.createdDate, i18n.language, { timeZone }),
    },
    { key: 'program' as const, value: order.program.name ?? order.program.id },
    {
      key: 'requesting-facility' as const,
      value: order.requestingFacility.name ?? order.requestingFacility.id,
    },
    {
      key: 'supplying-facility' as const,
      value: order.supplyingFacility.name ?? order.supplyingFacility.id,
    },
  ];
  return (
    <SettingsList>
      {fields.map((field) => (
        <SettingsItem key={field.key} label={t(`orders.edit.${field.key}`)}>
          {field.value}
        </SettingsItem>
      ))}
    </SettingsList>
  );
}

export function OrderHeaderSkeleton() {
  const { t } = useTranslation();
  return (
    <SettingsList>
      {(
        ['status', 'date-created', 'program', 'requesting-facility', 'supplying-facility'] as const
      ).map((key) => (
        <SettingsItem key={key} label={t(`orders.edit.${key}`)}>
          <span className="inline-block h-4 w-24">
            <Skeleton fill inline />
          </span>
        </SettingsItem>
      ))}
    </SettingsList>
  );
}
