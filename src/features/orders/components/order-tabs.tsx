import { AlertTriangleIcon, CircleIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { LoadedOrder } from '@/features/orders/lib/order-load';

export function OrderTabs({
  entries,
  dirty,
  invalid,
}: {
  entries: LoadedOrder[];
  dirty: (id: string) => boolean;
  invalid: (id: string) => boolean;
}) {
  const { t } = useTranslation();
  return (
    <TabsList aria-label={t('orders.create.facilities-label')} size="lg" wrap="column">
      {entries.map((entry) => (
        <TabsTrigger key={entry.id} value={entry.id}>
          {entry.order?.requestingFacility.name ??
            t('orders.edit.order-label', { code: entry.id.slice(0, 8) })}
          {invalid(entry.id) && (
            <>
              <AlertTriangleIcon className="text-destructive" />
              <span className="sr-only">{t('orders.edit.invalid')}</span>
            </>
          )}
          {dirty(entry.id) && (
            <>
              <CircleIcon className="fill-current" />
              <span className="sr-only">{t('orders.edit.unsaved')}</span>
            </>
          )}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
