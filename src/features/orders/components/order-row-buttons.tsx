import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import {
  DownloadIcon,
  PackageOpenIcon,
  PencilIcon,
  PrinterIcon,
  RefreshCwIcon,
} from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type CardAction, CardActions, useInCards } from '@/components/display/card-actions';
import { InvalidSubmitDialog } from '@/components/display/invalid-submit-dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { fetchOrderCsv, fetchOrderPdf, retryOrderTransfer } from '@/features/orders/api/api';
import { orderReturnState } from '@/features/orders/lib/order-return';
import {
  fulfillAction,
  type OrderAccess,
  viewOrderActions,
} from '@/features/orders/lib/order-row-actions';
import {
  fulfillOrdersSearchSchema,
  type ViewOrdersSearch,
} from '@/features/orders/lib/order-search';
import { loadShipmentEntry } from '@/features/orders/lib/shipment-entry';
import type { OrderSummary } from '@/features/orders/lib/types';
import { usePrintReport } from '@/hooks/use-print-report';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { apiErrorText } from '@/lib/api-error';
import { downloadFile } from '@/lib/download-file';
import { isRefused } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
import { openReport } from '@/lib/open-report';
import { reportApiError } from '@/lib/report-error';
import { getSessionUserId } from '@/lib/session-scope';

const RETRY_KEY = [...queryKeys.orders.all, 'retry'];
const SHIPMENT_ENTRY_KEY = [...queryKeys.orders.all, 'open-shipment'];
export function OrderRowButtons({
  order,
  search,
  access,
  disabled,
}: {
  order: OrderSummary;
  search: ViewOrdersSearch;
  access: OrderAccess;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const retryPending = useIsMutating({ mutationKey: RETRY_KEY }) > 0;
  const print = usePrintReport({
    serverAuthorized: true,
    userId: getSessionUserId() ?? '',
    request: (language) => fetchOrderPdf(order.id, language),
    onReport: () => openReport(`${order.orderCode ?? order.id}.pdf`, t('orders.print')),
    successTitle: t('orders.print-success-title'),
    successDescription: t('orders.print-success-description'),
    errorTitle: t('orders.print-error-title'),
    errorDescription: t('error.description'),
    refusedDescription: t('orders.print-refused-description'),
  });
  const download = useSessionMutation({
    mutationFn: () => fetchOrderCsv(order.id),
    onSuccess: ({ blob, filename }) =>
      downloadFile(blob, filename ?? `${order.orderCode ?? order.id}.csv`),
    onError: (error) => {
      reportApiError(error);
      const description = apiErrorText(
        error,
        isRefused(error) ? 'orders.download-refused-description' : 'error.description',
        t,
        { write: false, allowServerMessage: false },
      );
      if (description !== null) toast.error(t('orders.download-error-title'), { description });
    },
  });
  const retry = useSessionMutation({
    mutationKey: RETRY_KEY,
    mutationFn: () => retryOrderTransfer(order.id),
    onSuccess: async ({ result }) => {
      if (!result) {
        toast.error(t('orders.retry-error-title'), {
          description: t('error.description'),
        });
        return;
      }
      toast.success(t('orders.retry-success-title'), {
        description: t('orders.retry-success-description'),
      });
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.orders.all }),
        client.invalidateQueries({ queryKey: queryKeys.home.all }),
      ]);
    },
    onError: (error) => {
      reportApiError(error);
      const status = isAxiosError(error) ? error.response?.status : undefined;
      const description = apiErrorText(error, 'error.description', t, {
        write: true,
        allowServerMessage: status !== undefined && status >= 400 && status < 500,
      });
      if (description !== null) toast.error(t('orders.retry-error-title'), { description });
    },
  });
  const named = (action: string) =>
    t('orders.action-for', { action, order: order.orderCode ?? order.id });
  const actions: Record<ReturnType<typeof viewOrderActions>[number], CardAction> = {
    edit: {
      id: 'edit',
      icon: <PencilIcon />,
      label: t('orders.edit'),
      name: named(t('orders.edit')),
      disabled,
      link: (
        <Link
          to="/requisitions/create-orders/$orderIds"
          params={{ orderIds: order.id }}
          state={orderReturnState({ to: '/orders/view', search })}
        />
      ),
    },
    print: {
      id: 'print',
      icon: <PrinterIcon />,
      label: t('orders.print'),
      name: named(t('orders.print')),
      disabled: disabled || print.isPending || print.offline,
      onSelect: print.print,
    },
    download: {
      id: 'download',
      icon: <DownloadIcon />,
      label: t('orders.download'),
      name: named(t('orders.download')),
      disabled: disabled || download.isPending,
      onSelect: () => download.mutate(),
    },
    retry: {
      id: 'retry',
      icon: <RefreshCwIcon />,
      label: t('orders.retry'),
      name: named(t('orders.retry')),
      disabled: disabled || retryPending,
      onSelect: () => {
        if (!client.isMutating({ mutationKey: RETRY_KEY })) retry.mutate();
      },
    },
  };
  return (
    <div className="flex justify-end">
      {/* CardActions puts the first action last; preserve this list's display order. */}
      <CardActions
        label={t('card-actions.actions-for', { name: order.orderCode ?? order.id })}
        actions={viewOrderActions(order, access)
          .toReversed()
          .map((action) => actions[action])}
      />
    </div>
  );
}

export function FulfillOrderButton({
  order,
  search,
  disabled,
}: {
  order: OrderSummary;
  search: ViewOrdersSearch;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const cards = useInCards();
  const client = useQueryClient();
  const navigate = useNavigate();
  const trigger = useRef<HTMLButtonElement>(null);
  const pending = useIsMutating({ mutationKey: SHIPMENT_ENTRY_KEY }) > 0;
  const entry = useSessionMutation({
    onError: reportApiError,
    mutationKey: SHIPMENT_ENTRY_KEY,
    mutationFn: () => loadShipmentEntry(client, order.id),
    onSuccess: (shipmentEntry) =>
      navigate({
        to: '/orders/fulfillment/$orderId',
        params: { orderId: order.id },
        state: {
          ...orderReturnState({
            to: '/orders/fulfillment',
            search: fulfillOrdersSearchSchema.parse(search),
          }),
          shipmentEntry,
        },
      }),
  });
  const openShipment = (button: HTMLButtonElement) => {
    trigger.current = button;
    if (!client.isMutating({ mutationKey: SHIPMENT_ENTRY_KEY })) entry.mutate();
  };
  const continuing = fulfillAction(order) === 'continue';
  const variant = continuing ? 'secondary' : 'default';
  const label = t(continuing ? 'orders.continue-fulfillment' : 'orders.start-fulfillment');
  const name = t('orders.action-for', { action: label, order: order.orderCode ?? order.id });
  const refused = isRefused(entry.error);
  const description = entry.error
    ? apiErrorText(entry.error, refused ? 'orders.shipment.cannot-view' : 'error.description', t, {
        write: false,
      })
    : null;
  return (
    <>
      {cards ? (
        <CardActions
          label={t('card-actions.actions-for', { name: order.orderCode ?? order.id })}
          actions={[
            {
              id: 'fulfill',
              icon: entry.isPending ? (
                <Spinner aria-hidden="true" role="presentation" />
              ) : (
                <PackageOpenIcon />
              ),
              label,
              name,
              disabled: disabled || pending,
              onSelect: openShipment,
              variant,
            },
          ]}
        />
      ) : (
        <Button
          aria-label={name}
          aria-busy={entry.isPending}
          size="sm"
          variant={variant}
          disabled={disabled || pending}
          onClick={(event) => openShipment(event.currentTarget)}
        >
          {entry.isPending && (
            <Spinner aria-hidden="true" data-icon="inline-start" role="presentation" />
          )}
          {label}
        </Button>
      )}
      <InvalidSubmitDialog
        open={description !== null}
        onOpenChange={(open) => {
          if (!open) entry.reset();
        }}
        finalFocus={trigger}
        title={t(refused ? 'orders.shipment.not-authorized' : 'orders.shipment.load-error')}
        description={<bdi>{description}</bdi>}
        closeLabel={t('dialog.close')}
      />
    </>
  );
}
