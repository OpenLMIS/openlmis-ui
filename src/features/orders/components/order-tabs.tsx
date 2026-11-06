import { AlertTriangleIcon, CircleIcon, XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TabsClose, TabsItem, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { LoadedOrder } from '@/features/orders/lib/order-load';

export function OrderTabs({
  entries,
  active,
  dirty,
  invalid,
  deletable,
  onDelete,
  disabled,
}: {
  entries: LoadedOrder[];
  active?: string;
  dirty: (id: string) => boolean;
  invalid: (id: string) => boolean;
  deletable: (id: string) => boolean;
  onDelete: (id: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <TabsList aria-label={t('orders.create.facilities-label')} size="lg" wrap="column">
      {entries.map((entry) => {
        const name =
          entry.order?.requestingFacility.name ??
          t('orders.edit.order-label', { code: entry.id.slice(0, 8) });
        return (
          <TabsItem key={entry.id}>
            <TabsTrigger value={entry.id}>
              {name}
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
            {deletable(entry.id) && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <TabsClose
                      aria-label={t('orders.edit.delete-order-for', { facility: name })}
                      tabIndex={entry.id === active ? 0 : -1}
                      disabled={disabled}
                      onClick={() => onDelete(entry.id)}
                    />
                  }
                >
                  <XIcon />
                </TooltipTrigger>
                <TooltipContent>{t('orders.edit.delete-order')}</TooltipContent>
              </Tooltip>
            )}
          </TabsItem>
        );
      })}
    </TabsList>
  );
}
