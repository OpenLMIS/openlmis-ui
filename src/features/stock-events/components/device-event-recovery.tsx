import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { DataTableHeaderLabel } from '@/components/data-table/data-table';
import { formatDateValue, formatTimestamp } from '@/components/form/date-value';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EVENT_KINDS } from '@/features/stock-events/lib/event-kinds';
import { kindLabels } from '@/features/stock-events/lib/kind-labels';
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
import { queryKeys } from '@/lib/key-factory';
import { refreshOfflineProgram } from '@/lib/offline-download-status';
import { useOnline } from '@/lib/online';

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
          refreshOfflineProgram(event);
          for (const queryKey of [
            queryKeys.stockEvents.all,
            queryKeys.stockCards.all,
            queryKeys.stockCardSummaries.all,
          ])
            void queryClient.invalidateQueries({ queryKey });
          announceDeviceSave('device-events.recorded-by-you');
        }
        if (choice === 'resend') announceDeviceSave('device-events.status-queued');
        if (choice === 'remove') announceDeviceSave('device-events.removed');
        onClose();
        if (choice === 'copy' && onCopied) onCopied();
        else if (choice === 'copy')
          await navigate({
            to: EVENT_KINDS[event.kind].editorRoute,
            params: { programId: event.programId },
          });
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
        <DialogContent size="2xl" layout="scroll">
          <DialogHeader>
            <DialogTitle>{t('device-events.details')}</DialogTitle>
            <DialogDescription>
              {t(
                event.receipt?.source === 'user'
                  ? 'device-events.recorded-by-you'
                  : `device-events.status-${event.status}`,
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-w-0 flex-col gap-4 overflow-y-auto">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                [t('device-events.type'), t(kindLabels[event.kind])],
                [t('facility-program.facility'), event.facility.name || event.facility.code],
                [t('facility-program.program'), event.program.name || event.program.code],
                [t('device-events.queued-at'), timestamp(event.queuedAt)],
                [t('device-events.attempted-at'), timestamp(event.attemptStartedAt)],
                [t('device-events.signature'), event.payload.signature],
                [t('device-events.server-event-id'), event.receipt?.serverEventId],
                [t('stock-event.document-number'), event.receipt?.documentNumber],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd dir="auto">{value}</dd>
                </div>
              ))}
            </dl>
            <Table layout="auto">
              <TableHeader>
                <TableRow>
                  {(
                    [
                      'device-events.products',
                      'device-events.lots',
                      'device-events.quantity',
                      'device-events.reason',
                      'stock-events.reason-comments',
                      'device-events.occurred-date',
                      'stock-events.vvm-status',
                    ] as const
                  ).map((key) => (
                    <TableHead key={key}>
                      <DataTableHeaderLabel>{t(key)}</DataTableHeaderLabel>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {event.payload.lineItems.map((item, index) => (
                  <TableRow key={event.lines[index]?.key ?? index}>
                    <TableCell>
                      <span dir="auto">
                        {event.lines[index]?.orderable.fullProductName || item.orderableId}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span dir="auto">{event.lines[index]?.lot?.lotCode}</span>
                    </TableCell>
                    <TableCell>
                      {new Intl.NumberFormat(i18n.language).format(item.quantity)}
                    </TableCell>
                    <TableCell>
                      <div className="min-w-32 whitespace-pre-wrap" dir="auto">
                        {event.reasons?.find((reason) => reason.id === item.reasonId)?.name ||
                          item.reasonId}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span dir="auto">{item.reasonFreeText}</span>
                    </TableCell>
                    <TableCell>{formatDateValue(item.occurredDate, i18n.language)}</TableCell>
                    <TableCell>{item.extraData?.vvmStatus}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
                <AlertTitle>
                  {t(
                    event.pauseReason === 'access-changed'
                      ? 'device-events.access-changed'
                      : 'device-events.draft-changed',
                  )}
                </AlertTitle>
                <AlertDescription>
                  {t(
                    event.pauseReason === 'access-changed'
                      ? 'device-events.access-changed-description'
                      : 'device-events.draft-changed-description',
                  )}
                </AlertDescription>
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
                      <Button
                        variant="outline"
                        disabled={!online}
                        nativeButton={false}
                        role="link"
                        render={
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
                        }
                      >
                        {t('device-events.history')}
                      </Button>
                      {event.stockCards?.map((card) => (
                        <div key={card.id} className="max-w-full min-w-0">
                          <Button
                            width="full"
                            variant="outline"
                            disabled={!online}
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
          {event.receipt?.serverEventId && canView && (
            <Button
              variant="outline"
              disabled={!online}
              nativeButton={false}
              role="link"
              render={
                <Link
                  to="/stock-management/transaction-history/$eventId"
                  params={{ eventId: event.receipt.serverEventId }}
                  preload={false}
                />
              }
            >
              {t('device-events.history')}
            </Button>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={operation.isPending} onClick={onClose}>
              {t('device-events.close')}
            </Button>
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
                  variant="destructive"
                  disabled={operation.isPending}
                  onClick={() => setConfirmation('dismiss')}
                >
                  {t('device-events.dismiss')}
                </Button>
                <Button
                  disabled={operation.isPending || !!event.error?.resolvedAt}
                  onClick={() => setConfirmation('copy')}
                >
                  {t('device-events.copy')}
                </Button>
              </>
            )}
            {event.status === 'queued' && !event.attemptId && (
              <Button
                variant="destructive"
                disabled={operation.isPending}
                onClick={() => setConfirmation('remove')}
              >
                {t('device-events.remove')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog {...confirmationTarget.dialogProps(operation.isPending)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(
                confirmationShown === 'resend'
                  ? 'device-events.send-again'
                  : confirmationShown === 'copy'
                    ? 'device-events.copy'
                    : confirmationShown === 'dismiss'
                      ? 'device-events.dismiss'
                      : 'device-events.remove',
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                confirmationShown === 'resend'
                  ? 'device-events.duplicate-warning'
                  : confirmationShown === 'copy'
                    ? 'device-events.copy-warning'
                    : confirmationShown === 'dismiss'
                      ? 'device-events.dismiss-warning'
                      : 'device-events.remove-warning',
              )}
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
              {t(
                confirmationShown === 'resend'
                  ? 'device-events.send-again'
                  : confirmationShown === 'copy'
                    ? 'device-events.copy'
                    : confirmationShown === 'dismiss'
                      ? 'device-events.dismiss'
                      : 'device-events.remove',
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
