import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { formatTimestamp } from '@/components/form/date-value';
import { SettingsItem, SettingsList } from '@/components/form/settings-list';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import { useOfflineNavigation } from '@/components/offline-navigation';
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
import { DeviceEventLines } from '@/features/stock-events/components/device-event-lines';
import { EventStatus } from '@/features/stock-events/components/event-status';
import { EVENT_KINDS } from '@/features/stock-events/lib/event-kinds';
import { kindLabels } from '@/features/stock-events/lib/kind-labels';
import { refreshAfterStockEventAccepted } from '@/features/stock-events/lib/refresh-after-stock-event-accepted';
import { createStockEventContext } from '@/features/stock-events/lib/stock-event-local';
import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import {
  copyRefusedEvent,
  type DeviceEvent,
  dismissRefusedEvent,
  removeQueuedEvent,
  resolveUncertain,
} from '@/features/stock-events/lib/stock-event-sync';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { announceDeviceSave } from '@/lib/device-save-announcement';
import { orEmpty } from '@/lib/empty-value';
import { recordLabel } from '@/lib/facility-program-selection';
import { useOnline } from '@/lib/online';

const confirmationCopy = {
  resend: { title: 'device-events.send-again', warning: 'device-events.duplicate-warning' },
  copy: { title: 'device-events.copy', warning: 'device-events.copy-warning' },
  remove: { title: 'device-events.remove', warning: 'device-events.remove-warning' },
  dismiss: { title: 'device-events.dismiss', warning: 'device-events.dismiss-warning' },
} as const;
const pauseCopy = {
  'access-changed': {
    title: 'device-events.access-changed',
    description: 'device-events.access-changed-description',
  },
  'draft-changed': {
    title: 'device-events.draft-changed',
    description: 'device-events.draft-changed-description',
  },
} as const;

export function DeviceEventRecovery({
  event,
  canView,
  canSend,
  timeZone,
  onClose,
  onCopied,
}: {
  event: DeviceEvent;
  canView: boolean;
  canSend: boolean;
  timeZone?: string;
  onClose: () => void;
  onCopied?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const online = useOnline();
  const descriptionId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const offlineNavigation = useOfflineNavigation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [confirmation, setConfirmation] = useState<'resend' | 'copy' | 'remove' | 'dismiss' | null>(
    null,
  );
  const confirmationTarget = useDialogTarget(confirmation ?? undefined, () =>
    setConfirmation(null),
  );
  const confirmationShown = confirmationTarget.shown;
  const operation = useSessionMutation({
    mutationFn: async (choice: 'recorded' | 'resend' | 'copy' | 'remove' | 'dismiss') => {
      const context = createStockEventContext(event);
      if (choice === 'resend' && !canSend) return false;
      if (choice === 'dismiss')
        return event.error ? dismissRefusedEvent(context, event.error) : false;
      if (choice === 'copy')
        return event.error ? copyRefusedEvent(context, event.error) : undefined;
      if (choice === 'remove') return removeQueuedEvent(context, event as QueuedStockEvent);
      return resolveUncertain(context, event as QueuedStockEvent, choice);
    },
    retry: false,
  });
  const act = async (choice: 'recorded' | 'resend' | 'copy' | 'remove' | 'dismiss') => {
    try {
      const changed = await operation.mutateAsync(choice);
      if (!operation.isCurrent()) return;
      setConfirmation(null);
      if (changed) {
        if (choice === 'recorded') {
          refreshAfterStockEventAccepted(queryClient, event);
          announceDeviceSave('device-events.recorded-by-you');
        }
        if (choice === 'resend') announceDeviceSave('device-events.status-queued');
        if (choice === 'remove') announceDeviceSave('device-events.removed');
        if (choice === 'copy' && onCopied) onCopied();
        else if (choice === 'copy')
          await navigate({
            to: EVENT_KINDS[event.kind].editorRoute,
            params: { programId: event.programId },
            replace: true,
          });
        else onClose();
      } else {
        toast.warning(t('device-events.changed-title'), {
          description: t('device-events.changed-description'),
        });
        onClose();
      }
    } catch {
      if (!operation.isCurrent()) return;
      toast.error(t('device-events.action-failed'), {
        description: t('device-events.action-failed-description'),
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
          if (!open && !operation.isPending) onClose();
        }}
      >
        <DialogContent
          size="table"
          layout="scroll"
          aria-describedby={descriptionId}
          initialFocus={closeRef}
        >
          <DialogHeader>
            <DialogTitle>{t('device-events.details')}</DialogTitle>
            <p className="sr-only" id={descriptionId}>
              {t(kindLabels[event.kind])}.{' '}
              {t(
                event.receipt?.source === 'user'
                  ? 'device-events.recorded-by-you'
                  : `device-events.status-${event.status}`,
              )}
            </p>
          </DialogHeader>
          <div className="flex min-w-0 flex-col gap-4 overflow-y-auto">
            <SettingsList>
              <SettingsItem label={t('device-events.type')}>
                <span className="inline-flex flex-wrap items-center justify-end gap-2">
                  <span>{t(kindLabels[event.kind])}</span>
                  <EventStatus event={event} />
                </span>
              </SettingsItem>
              {[
                [t('facility-program.facility'), recordLabel(event.facility)],
                [t('facility-program.program'), recordLabel(event.program)],
                [t('device-events.queued-at'), timestamp(event.queuedAt)],
                [t('device-events.attempted-at'), timestamp(event.attemptStartedAt)],
                [t('device-events.signature'), event.payload.signature],
                ...(event.receipt
                  ? [
                      [t('device-events.server-event-id'), event.receipt.serverEventId],
                      [t('stock-event.document-number'), event.receipt.documentNumber],
                    ]
                  : []),
              ].map(([label, value]) => (
                <SettingsItem key={label} label={label}>
                  <span dir="auto">{orEmpty(value)}</span>
                </SettingsItem>
              ))}
            </SettingsList>
            <DeviceEventLines event={event} />
            {event.error?.category === 'stock-changed' && (
              <Alert variant="warning">
                <AlertTitle>{t('device-events.stock-changed')}</AlertTitle>
                <AlertDescription>{t('device-events.stock-changed-description')}</AlertDescription>
              </Alert>
            )}
            {event.status === 'refused' && (
              <div className="flex min-w-0 flex-col gap-2">
                <h3 className="font-medium">{t('device-events.full-error')}</h3>
                <p dir="auto">
                  {event.error?.messageKey === event.error?.message
                    ? t('device-events.refused-description')
                    : event.error?.message}
                </p>
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
                  <AlertDescription>{t('device-events.uncertain-description')}</AlertDescription>
                </Alert>
                {canView ? (
                  <>
                    {!online && (
                      <p className="text-sm text-muted-foreground">
                        {t('device-events.history-offline')}
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
                            aria-describedby={!online ? 'event-history-connection' : undefined}
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
                              {t('device-events.stock-card', {
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
                  <p className="text-sm">{t('device-events.no-view')}</p>
                )}
              </>
            )}
          </div>
          {!online && canView && (
            <p id="event-history-connection" className="sr-only">
              {t('offline.connection-required')}
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
                aria-describedby={!online ? 'event-history-connection' : undefined}
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
                {t('device-events.history')}
              </Button>
            )}
            {event.status === 'uncertain' && (
              <>
                <Button
                  disabled={operation.isPending}
                  variant="outline"
                  onClick={() => void act('recorded')}
                >
                  {t('device-events.recorded')}
                </Button>
                <Button
                  variant="outline"
                  disabled={operation.isPending || !canSend}
                  onClick={() => setConfirmation('resend')}
                >
                  {t('device-events.send-again')}
                </Button>
              </>
            )}
            {event.status === 'refused' && (
              <>
                <Button
                  variant="destructive-outline"
                  disabled={operation.isPending}
                  onClick={() => setConfirmation('dismiss')}
                >
                  {t('device-events.dismiss')}
                </Button>
                <Button
                  variant="outline"
                  disabled={operation.isPending || !!event.error?.resolvedAt}
                  onClick={() => setConfirmation('copy')}
                >
                  {t('device-events.copy')}
                </Button>
              </>
            )}
            {event.status === 'queued' && !event.attemptId && (
              <Button
                variant="destructive-outline"
                disabled={operation.isPending}
                onClick={() => setConfirmation('remove')}
              >
                {t('device-events.remove')}
              </Button>
            )}
            <Button ref={closeRef} disabled={operation.isPending} onClick={onClose}>
              {t('device-events.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {offlineNavigation.dialog}
      <AlertDialog {...confirmationTarget.dialogProps(operation.isPending)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(confirmationCopy[confirmationShown ?? 'remove'].title)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(confirmationCopy[confirmationShown ?? 'remove'].warning)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={operation.isPending}>
              {t('device-events.cancel')}
            </AlertDialogCancel>
            <Button
              disabled={operation.isPending}
              variant={confirmationShown === 'copy' ? 'default' : 'destructive'}
              onClick={() => {
                if (confirmation) void act(confirmation);
              }}
            >
              {t(confirmationCopy[confirmationShown ?? 'remove'].title)}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
