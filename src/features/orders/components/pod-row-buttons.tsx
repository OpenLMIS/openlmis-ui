import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ClipboardCheckIcon, PrinterIcon } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  type CardAction,
  CardActions,
  RowActions,
  useInCards,
} from '@/components/display/card-actions';
import { Button } from '@/components/ui/button';
import { fetchProofOfDeliveryPdf, findProofOfDelivery } from '@/features/orders/api/api';
import { podLotOptions, podProductOptions, podReasonsOptions } from '@/features/orders/api/queries';
import { orderReturnState } from '@/features/orders/lib/order-return';
import type { PodListSearch } from '@/features/orders/lib/pod-search';
import type { OrderSummary } from '@/features/orders/lib/types';
import { usePrintReport } from '@/hooks/use-print-report';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { openReport } from '@/lib/open-report';
import { getSessionUserId } from '@/lib/session-scope';

export function PodRowButtons({
  order,
  search,
  disabled,
}: {
  order: OrderSummary;
  search: PodListSearch;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const navigate = useNavigate();
  const cards = useInCards();
  const missing = () =>
    toast.error(t('orders.pod.not-found'), { description: t('orders.pod.not-found-description') });
  const manage = useSessionMutation({
    mutationFn: () => findProofOfDelivery(order.id),
    onSuccess: (pod) => {
      if (!pod) {
        missing();
        return;
      }
      client.prefetchQuery(podProductOptions(pod));
      client.prefetchQuery(podLotOptions(pod));
      if (order.program && order.facility?.type)
        client.prefetchQuery(
          podReasonsOptions({ program: order.program.id, facilityType: order.facility.type.id }),
        );
      void navigate({
        to: '/orders/proof-of-delivery/$podId',
        params: { podId: pod.id },
        state: orderReturnState({ to: '/orders/proof-of-delivery', search }),
      });
    },
    onError: () =>
      toast.error(t('orders.view.error-title'), {
        description: t('orders.view.error-description'),
      }),
  });
  const printPodId = useRef('');
  const print = usePrintReport({
    serverAuthorized: true,
    userId: getSessionUserId() ?? '',
    beforeRequest: async () => {
      const pod = await findProofOfDelivery(order.id);
      if (!manage.isCurrent()) return false;
      if (!pod) {
        missing();
        return false;
      }
      printPodId.current = pod.id;
      return true;
    },
    request: (language) => fetchProofOfDeliveryPdf(printPodId.current, language),
    onReport: () => openReport(`${order.orderCode ?? order.id}.pdf`, t('orders.print')),
    successTitle: t('orders.print-success-title'),
    successDescription: t('orders.print-success-description'),
    errorTitle: t('orders.print-error-title'),
    errorDescription: t('orders.print-error-description'),
    refusedDescription: t('orders.print-refused-description'),
  });
  const named = (action: string) =>
    t('orders.action-for', { action, order: order.orderCode ?? order.id });
  const label = t('card-actions.actions-for', { name: order.orderCode ?? order.id });
  const action: CardAction = {
    id: 'manage',
    icon: <ClipboardCheckIcon />,
    label: t('orders.pod.manage'),
    name: named(t('orders.pod.manage')),
    disabled: disabled || manage.isPending,
    onSelect: () => manage.mutate(),
  };
  const printAction: CardAction = {
    id: 'print',
    icon: <PrinterIcon />,
    label: t('orders.print'),
    name: named(t('orders.print')),
    disabled: disabled || print.isPending || print.offline,
    onSelect: print.print,
  };
  return cards ? (
    <CardActions label={label} actions={[action, printAction]} />
  ) : (
    <div className="flex items-center justify-end gap-1">
      <Button
        size="sm"
        variant="outline"
        aria-label={action.name}
        disabled={action.disabled}
        onClick={() => manage.mutate()}
      >
        {action.label}
      </Button>
      <RowActions label={label} actions={[printAction]} />
    </div>
  );
}
