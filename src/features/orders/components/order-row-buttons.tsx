import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import {
  DownloadIcon,
  PackageOpenIcon,
  PencilIcon,
  PrinterIcon,
  RefreshCwIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type CardAction, CardActions, useInCards } from '@/components/display/card-actions';
import { serverMessage } from '@/components/display/dialog-parts';
import { Button } from '@/components/ui/button';
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
import type { OrderSummary } from '@/features/orders/lib/types';
import { usePrintReport } from '@/hooks/use-print-report';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { downloadFile } from '@/lib/download-file';
import { isRefused } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
import { openReport } from '@/lib/open-report';
import { getSessionUserId } from '@/lib/session-scope';

const RETRY_KEY = [...queryKeys.orders.all, 'retry'];
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
    errorDescription: t('orders.print-error-description'),
    refusedDescription: t('orders.print-refused-description'),
  });
  const download = useSessionMutation({
    mutationFn: () => fetchOrderCsv(order.id),
    onSuccess: ({ blob, filename }) =>
      downloadFile(blob, filename ?? `${order.orderCode ?? order.id}.csv`),
    onError: (error) =>
      toast.error(t('orders.download-error-title'), {
        description: isRefused(error)
          ? t('orders.download-refused-description')
          : t('orders.download-error-description'),
      }),
  });
  const retry = useSessionMutation({
    mutationKey: RETRY_KEY,
    mutationFn: () => retryOrderTransfer(order.id),
    onSuccess: async ({ result }) => {
      if (!result) {
        toast.error(t('orders.retry-error-title'), {
          description: t('orders.retry-error-description'),
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
    onError: (error) =>
      toast.error(t('orders.retry-error-title'), {
        description:
          (isAxiosError(error) &&
            error.response &&
            error.response.status >= 400 &&
            error.response.status < 500 &&
            serverMessage(error)) ||
          t('orders.retry-error-description'),
      }),
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
      <CardActions
        label={t('card-actions.actions-for', { name: order.orderCode ?? order.id })}
        actions={viewOrderActions(order, access).map((action) => actions[action])}
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
  const label = t(
    fulfillAction(order) === 'continue'
      ? 'orders.continue-fulfillment'
      : 'orders.start-fulfillment',
  );
  const name = t('orders.action-for', { action: label, order: order.orderCode ?? order.id });
  const link = (
    <Link
      to="/orders/fulfillment/$orderId"
      params={{ orderId: order.id }}
      state={orderReturnState({
        to: '/orders/fulfillment',
        search: fulfillOrdersSearchSchema.parse(search),
      })}
    />
  );
  return cards ? (
    <CardActions
      label={t('card-actions.actions-for', { name: order.orderCode ?? order.id })}
      actions={[{ id: 'fulfill', icon: <PackageOpenIcon />, label, name, disabled, link }]}
    />
  ) : (
    <Button
      aria-label={name}
      size="sm"
      variant="outline"
      disabled={disabled}
      nativeButton={false}
      role="link"
      render={link}
    >
      {label}
    </Button>
  );
}
