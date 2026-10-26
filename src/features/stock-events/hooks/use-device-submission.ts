import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { serverMessage } from '@/components/dialog-parts';
import type { ValidAssignment } from '@/components/valid-assignments/types';
import type { Reason } from '@/features/reference-data/lib/types';
import { submitStockEvent } from '@/features/stock-events/api/api';
import type { eventStockCardsOptions } from '@/features/stock-events/api/queries';
import type { EventForm } from '@/features/stock-events/hooks/use-event-form';
import { useStockEventAutosave } from '@/features/stock-events/hooks/use-stock-event-autosave';
import {
  type ConfiguredEventKind,
  EVENT_KINDS,
  type EventKindConfig,
} from '@/features/stock-events/lib/event-kinds';
import {
  type StockEventDelivery,
  waitForStockEventReceipt,
} from '@/features/stock-events/lib/stock-event-delivery';
import type { StockEventDisplay } from '@/features/stock-events/lib/stock-event-queue';
import type { EventStockCard, StockEvent } from '@/features/stock-events/lib/types';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { queryKeys } from '@/lib/key-factory';
import { isOnline } from '@/lib/online';

export function useDeviceSubmission({
  kind,
  facilityId,
  programId,
  canViewStock,
  form,
  cards,
  today,
  stockOptions,
  deviceDisplay,
  reasons,
  assignments,
}: {
  kind: ConfiguredEventKind;
  facilityId: string;
  programId: string;
  canViewStock: boolean;
  form: EventForm;
  cards: readonly EventStockCard[] | undefined;
  today: string;
  stockOptions: ReturnType<typeof eventStockCardsOptions>;
  deviceDisplay: StockEventDisplay;
  reasons: readonly Reason[];
  assignments: readonly ValidAssignment[];
}) {
  const config: EventKindConfig = EVENT_KINDS[kind];
  const deviceDrafts = config.drafts === 'device';
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const draft = useStockEventAutosave(
    deviceDrafts && canViewStock,
    { kind, facilityId, programId },
    form,
    cards,
    today,
  );
  const mutation = useSessionMutation({
    mutationFn: async (body: Parameters<typeof submitStockEvent>[0]) => {
      if (deviceDrafts) {
        const queued = await draft.submit(
          body,
          {
            ...deviceDisplay,
            stockCards: (queryClient.getQueryData(stockOptions.queryKey)?.cards ?? [])
              .filter((card) =>
                body.lineItems.some(
                  (item) =>
                    item.orderableId === card.orderable.id &&
                    !item.lot &&
                    (item.lotId ?? null) === (card.lot?.id ?? null),
                ),
              )
              .flatMap((card) =>
                card.id
                  ? [{ id: card.id, orderableId: card.orderable.id, lotId: card.lot?.id }]
                  : [],
              ),
            reasons: reasons.map((reason) => ({ id: reason.id, name: reason.name })),
            ...(config.counterparty === 'none'
              ? {}
              : {
                  [config.counterparty === 'destination' ? 'destinations' : 'sources']:
                    assignments.map((assignment) => ({
                      id: assignment.node.id,
                      name: assignment.name ?? '',
                    })),
                }),
          },
          { foreground: isOnline() },
        );
        const delivery = await waitForStockEventReceipt(queued, queryClient);
        return {
          eventId:
            delivery.kind === 'accepted'
              ? (delivery.receipt.serverEventId ?? queued.localEventId)
              : queued.localEventId,
          synced: delivery.kind === 'accepted',
          delivery,
        };
      }
      return { eventId: await submitStockEvent(body), synced: true, delivery: undefined };
    },
    retry: false,
  });
  return {
    draft,
    mutation,
    failure(error: unknown, hadUnknownOutcome: boolean) {
      const unknown = !deviceDrafts && isAxiosError(error) && !error.response;
      return {
        unknown: unknown || (!deviceDrafts && hadUnknownOutcome),
        alert: {
          title: deviceDrafts
            ? ('stock-events.draft-save-error-title' as const)
            : unknown
              ? ('stock-events.unknown-outcome-title' as const)
              : config.copy.submitErrorTitle,
          description: deviceDrafts
            ? t('stock-events.draft-failed')
            : unknown
              ? t('stock-events.unknown-outcome-description')
              : (serverMessage(error) ?? t(config.copy.submitErrorDescription)),
        },
      };
    },
    async flush() {
      return !deviceDrafts || (await draft.flush());
    },
    complete(
      eventId: string,
      synced: boolean,
      onSubmitted: (eventId: string, synced?: boolean) => void | Promise<void>,
    ) {
      return deviceDrafts ? onSubmitted(eventId, synced) : onSubmitted(eventId);
    },
    notify(body: StockEvent, synced: boolean, delivery?: StockEventDelivery) {
      if (deviceDrafts) {
        if (
          delivery?.kind === 'uncertain' ||
          delivery?.kind === 'blocked' ||
          delivery?.kind === 'held'
        ) {
          toast.warning(
            t(
              delivery.kind === 'uncertain'
                ? 'offline-events.needs-review'
                : delivery.kind === 'held'
                  ? `offline-events.${delivery.reason}`
                  : 'offline-events.blocked-title',
            ),
            {
              description: t(
                delivery.kind === 'uncertain'
                  ? 'offline-events.needs-review-description'
                  : delivery.kind === 'held'
                    ? `offline-events.${delivery.reason}-held-description`
                    : 'offline-events.blocked-description',
              ),
              action: {
                label: t('offline-events.review'),
                onClick: () => void navigate({ to: '/offline-events' }),
              },
            },
          );
        } else
          toast.success(t(synced ? config.copy.submittedTitle : 'stock-events.queued-title'), {
            description: t(
              synced
                ? config.copy.submittedDescription
                : isOnline()
                  ? 'stock-events.queued-online-description'
                  : 'stock-events.queued-description',
            ),
          });
        return;
      }
      toast.success(t(config.copy.submittedTitle), {
        description: t(config.copy.submittedDescription),
      });
      for (const queryKey of [
        queryKeys.stockEvents.all,
        queryKeys.stockCardSummaries.all,
        queryKeys.stockCards.all,
        ...(body.lineItems.some((item) => item.lot) ? [queryKeys.lots.all] : []),
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  };
}
