import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Trash2Icon } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { formatTimestamp } from '@/components/form/date-value';
import { SettingsList } from '@/components/form/settings-list';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import { useOfflineNavigationDialog } from '@/components/offline-navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DeviceEventLines,
  EventDetailItem,
} from '@/features/stock-events/components/device-event-lines';
import {
  canRemoveDeviceEvent,
  DeviceEventRemoval,
} from '@/features/stock-events/components/device-event-removal';
import { EventStatus } from '@/features/stock-events/components/event-status';
import { useRefusedEventRetry } from '@/features/stock-events/hooks/use-refused-event-retry';
import { announceDeviceSave } from '@/features/stock-events/lib/device-save-announcement';
import { EVENT_KINDS } from '@/features/stock-events/lib/event-kinds';
import { refreshAfterStockEventAccepted } from '@/features/stock-events/lib/refresh-after-stock-event-accepted';
import { refusalMessage } from '@/features/stock-events/lib/refusal-message';
import { createStockEventContext } from '@/features/stock-events/lib/stock-event-local';
import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import {
  copyRefusedEvent,
  type DeviceEvent,
  resolveUncertain,
} from '@/features/stock-events/lib/stock-event-sync';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { recordLabel } from '@/lib/facility-program-selection';
import { useOnline } from '@/lib/online';

const confirmationCopy = {
  recorded: { title: 'offline-events.recorded', warning: 'offline-events.recorded-warning' },
  resend: { title: 'offline-events.send-again', warning: 'offline-events.duplicate-warning' },
  copy: { title: 'offline-events.copy', warning: 'offline-events.copy-warning' },
} as const;
const pauseCopy = {
  'access-changed': {
    title: 'offline-events.access-changed',
    description: 'offline-events.access-changed-description',
  },
  'draft-changed': {
    title: 'offline-events.draft-changed',
    description: 'offline-events.draft-changed-description',
  },
} as const;

export function DeviceEventRecovery({
  event,
  canView,
  canSend,
  timeZone,
  onClose,
  onCopied,
  onRemoved,
  refreshOfflineDownload,
}: {
  event: DeviceEvent;
  canView: boolean;
  canSend: boolean;
  timeZone?: string;
  onClose: () => void;
  onCopied?: () => void;
  onRemoved?: () => void;
  refreshOfflineDownload?: (refreshKey: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const online = useOnline();
  const descriptionId = useId();
  const connectionId = useId();
  const sendReasonId = useId();
  const copyReasonId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const offlineNavigation = useOfflineNavigationDialog();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [removing, setRemoving] = useState(false);
  const [confirmation, setConfirmation] = useState<'recorded' | 'resend' | 'copy' | null>(null);
  const confirmationTarget = useDialogTarget(confirmation ?? undefined, () =>
    setConfirmation(null),
  );
  const confirmationShown = confirmationTarget.shown;
  const operation = useSessionMutation({
    mutationFn: async (choice: 'recorded' | 'resend' | 'copy') => {
      const context = createStockEventContext(event);
      if (choice === 'resend' && !canSend) return false;
      if (choice === 'copy')
        return event.error ? copyRefusedEvent(context, event.error) : undefined;
      return resolveUncertain(context, event as QueuedStockEvent, choice);
    },
    retry: false,
  });
  const retry = useRefusedEventRetry(event, canSend, onClose);
  const pending = operation.isPending || retry.pending;
  const act = async (choice: 'recorded' | 'resend' | 'copy') => {
    try {
      const changed = await operation.mutateAsync(choice);
      if (!operation.isCurrent()) return;
      setConfirmation(null);
      if (changed) {
        if (choice === 'recorded') {
          refreshAfterStockEventAccepted(queryClient, event, refreshOfflineDownload);
          announceDeviceSave('offline-events.recorded-by-you');
        }
        if (choice === 'resend') announceDeviceSave('offline-events.status-queued');
        if (choice === 'copy' && onCopied) onCopied();
        else if (choice === 'copy')
          await navigate({
            to: EVENT_KINDS[event.kind].editorRoute,
            params: { programId: event.programId },
            replace: true,
          });
        else onClose();
      } else {
        toast.warning(t('offline-events.changed-title'), {
          description: t('offline-events.changed-description'),
        });
        onClose();
      }
    } catch {
      if (!operation.isCurrent()) return;
      toast.error(t('offline-events.action-failed'), {
        description: t('offline-events.action-failed-description'),
      });
    }
  };
  const timestamp = (value?: number) =>
    value
      ? formatTimestamp(new Date(value).toISOString(), i18n.language, { time: true, timeZone })
      : '';
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !pending) onClose();
        }}
      >
        <DialogContent
          size="xl"
          layout="scroll"
          aria-describedby={descriptionId}
          initialFocus={closeRef}
        >
          <DialogHeader>
            <DialogTitle>{t('offline-events.details')}</DialogTitle>
            <p className="sr-only" id={descriptionId}>
              {t(EVENT_KINDS[event.kind].copy.eventType)}.{' '}
              {t(
                event.receipt?.source === 'user'
                  ? 'offline-events.recorded-by-you'
                  : `offline-events.status-${event.status}`,
              )}
            </p>
          </DialogHeader>
          <div className="shrink-0 min-w-0">
            <SettingsList density="compact">
              <EventDetailItem label={t('offline-events.type')}>
                <span className="inline-flex flex-wrap items-center justify-end gap-2">
                  <span>{t(EVENT_KINDS[event.kind].copy.eventType)}</span>
                  <EventStatus event={event} />
                </span>
              </EventDetailItem>
              {[
                [t('facility-program.facility'), recordLabel(event.facility)],
                [t('facility-program.program'), recordLabel(event.program)],
                [t('offline-events.queued-at'), timestamp(event.queuedAt)],
                [t('offline-events.attempted-at'), timestamp(event.attemptStartedAt)],
                [t('offline-events.signature'), event.payload.signature],
                ...(event.receipt
                  ? [
                      [t('offline-events.server-event-id'), event.receipt.serverEventId],
                      [t('stock-event.document-number'), event.receipt.documentNumber],
                    ]
                  : []),
              ]
                .filter(([, value]) => value != null && value !== '')
                .map(([label, value]) => (
                  <EventDetailItem key={label} label={label}>
                    <span dir="auto">{value}</span>
                  </EventDetailItem>
                ))}
            </SettingsList>
          </div>
          <div
            data-event-lines-region
            className="min-h-0 min-w-0 flex flex-col gap-3 overflow-y-auto"
          >
            <DeviceEventLines event={event} />
            {event.error?.category === 'stock-changed' && (
              <Alert variant="warning">
                <AlertTitle>{t('offline-events.stock-changed')}</AlertTitle>
                <AlertDescription>{t('offline-events.stock-changed-description')}</AlertDescription>
              </Alert>
            )}
            {event.status === 'refused' && (
              <div className="flex min-w-0 flex-col gap-2">
                <h3 className="font-medium">{t('offline-events.full-error')}</h3>
                <p dir="auto">{refusalMessage(event.error, t)}</p>
              </div>
            )}
            {event.pauseReason && (
              <Alert variant="warning">
                <AlertTitle>{t(pauseCopy[event.pauseReason].title)}</AlertTitle>
                <AlertDescription>{t(pauseCopy[event.pauseReason].description)}</AlertDescription>
              </Alert>
            )}
            {event.status === 'uncertain' && (
              <>
                <Alert variant="warning">
                  <AlertDescription>{t('offline-events.uncertain-description')}</AlertDescription>
                </Alert>
                {canView ? (
                  <>
                    {!online && (
                      <p className="text-sm text-muted-foreground">
                        {t('offline-events.history-offline')}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {event.stockCards?.map((card) => (
                        <div key={card.id} className="max-w-full min-w-0">
                          <Button
                            width="full"
                            variant="outline"
                            onClick={(click) => {
                              if (!online) {
                                click.preventDefault();
                                offlineNavigation.show(click.currentTarget);
                              }
                            }}
                            aria-describedby={!online ? connectionId : undefined}
                            nativeButton={false}
                            role="link"
                            render={
                              <Link
                                to="/stock-management/stock-on-hand/$stockCardId"
                                params={{ stockCardId: card.id }}
                                preload={false}
                              />
                            }
                          >
                            <span className="truncate">
                              {t('offline-events.stock-card', {
                                product:
                                  event.lines.find(
                                    (line) =>
                                      line.orderable.id === card.orderableId &&
                                      (line.lot && 'id' in line.lot ? line.lot.id : null) ===
                                        (card.lotId ?? null),
                                  )?.orderable.fullProductName || card.orderableId,
                              })}
                            </span>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm">{t('offline-events.no-view')}</p>
                )}
              </>
            )}
          </div>
          {!online && canView && (
            <p id={connectionId} className="sr-only">
              {t('offline.connection-required')}
            </p>
          )}
          {!canSend && (event.status === 'uncertain' || retry.available) && (
            <p id={sendReasonId} className="text-sm text-muted-foreground">
              {t('offline-events.no-send')}
            </p>
          )}
          {event.status === 'refused' && event.error?.resolvedAt && (
            <p id={copyReasonId} className="text-sm text-muted-foreground">
              {t('offline-events.copy-resolved')}
            </p>
          )}
          <DialogFooter wrap>
            {canView && (
              <Button
                variant="outline"
                nativeButton={false}
                role="link"
                onClick={(click) => {
                  if (!online) {
                    click.preventDefault();
                    offlineNavigation.show(click.currentTarget);
                  }
                }}
                aria-describedby={!online ? connectionId : undefined}
                render={
                  event.receipt?.serverEventId ? (
                    <Link
                      to="/stock-management/transaction-history/$eventId"
                      params={{ eventId: event.receipt.serverEventId }}
                      preload={false}
                    />
                  ) : (
                    <Link
                      to="/stock-management/transaction-history"
                      search={{
                        mode: 'my',
                        facilityId: event.facilityId,
                        programId: event.programId,
                        type: EVENT_KINDS[event.kind].historyType,
                      }}
                      preload={false}
                    />
                  )
                }
              >
                {t('offline-events.history')}
              </Button>
            )}
            {retry.available && (
              <Button
                variant="outline"
                disabled={pending || !canSend}
                focusableWhenDisabled
                aria-describedby={!canSend ? sendReasonId : undefined}
                onClick={() => {
                  void retry.retry();
                }}
              >
                {t('offline-events.retry-refused')}
              </Button>
            )}
            {event.status === 'uncertain' && (
              <>
                <Button
                  disabled={pending}
                  variant="outline"
                  onClick={() => setConfirmation('recorded')}
                >
                  {t('offline-events.recorded')}
                </Button>
                <Button
                  variant="outline"
                  disabled={pending || !canSend}
                  focusableWhenDisabled
                  aria-describedby={!canSend ? sendReasonId : undefined}
                  onClick={() => setConfirmation('resend')}
                >
                  {t('offline-events.send-again')}
                </Button>
              </>
            )}
            {event.status === 'refused' && (
              <Button
                variant="outline"
                disabled={pending || !!event.error?.resolvedAt}
                focusableWhenDisabled
                aria-describedby={event.error?.resolvedAt ? copyReasonId : undefined}
                onClick={() => setConfirmation('copy')}
              >
                {t('offline-events.copy')}
              </Button>
            )}
            {canRemoveDeviceEvent(event) && (
              <Button variant="destructive" disabled={pending} onClick={() => setRemoving(true)}>
                <Trash2Icon data-icon="inline-start" />
                {t('offline-events.remove')}
              </Button>
            )}
            <Button ref={closeRef} disabled={pending} onClick={onClose}>
              {t('offline-events.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
        {removing && (
          <DeviceEventRemoval
            event={event}
            onClose={() => setRemoving(false)}
            onRemoved={() => {
              onRemoved?.();
              onClose();
            }}
          />
        )}
        <AlertDialog {...confirmationTarget.dialogProps(pending)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t(confirmationCopy[confirmationShown ?? 'resend'].title)}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t(confirmationCopy[confirmationShown ?? 'resend'].warning)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>{t('offline-events.cancel')}</AlertDialogCancel>
              <Button
                disabled={pending}
                variant={confirmationShown === 'resend' ? 'destructive' : 'default'}
                onClick={() => {
                  if (confirmation) void act(confirmation);
                }}
              >
                {t(confirmationCopy[confirmationShown ?? 'resend'].title)}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Dialog>
      {offlineNavigation.dialog}
    </>
  );
}
