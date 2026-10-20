import { type ColumnDef, useTable } from '@tanstack/react-table';
import { liveQuery } from 'dexie';
import { RotateCcwIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RowActions } from '@/components/card-actions';
import { type DataTableFeatures, dataTableFeatures } from '@/components/data-table/data-table';
import { ErrorAlert } from '@/components/dialog-parts';
import { DialogTable } from '@/components/dialog-table';
import { formatTimestamp } from '@/components/form/date-value';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogHeader,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { QueryBoundary } from '@/components/query-boundary';
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
  createStockEventContext,
  deleteStockEventCopy,
  readArchivedStockEvents,
  type StockEventDraft,
  type StockEventSelection,
} from '@/features/stock-events/lib/stock-event-local';
import { useDialogCardLayout } from '@/hooks/use-card-view';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { announceDeviceSave } from '@/lib/device-save-announcement';
import { getSessionScope } from '@/lib/session-scope';

type Props = StockEventSelection & {
  disabled: boolean;
  onRestore: (copy: StockEventDraft) => Promise<boolean>;
};

const NoArchives = () => null;

export function EventArchivedCopies(props: Props) {
  return (
    <QueryBoundary
      resetKey={`${props.facilityId}/${props.programId}`}
      pendingFallback={null}
      errorComponent={NoArchives}
    >
      <ArchivedCopies {...props} />
    </QueryBoundary>
  );
}

function ArchivedCopies({ kind, facilityId, programId, disabled, onRestore }: Props) {
  const { t, i18n } = useTranslation();
  const timeZone = useDeploymentTimeZone();
  const { measure, cards } = useDialogCardLayout('lg');
  const closeRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef(onRestore);
  restoreRef.current = onRestore;
  const [copies, setCopies] = useState<StockEventDraft[]>([]);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<StockEventDraft | null>(null);
  const [pending, setPending] = useState(false);
  const [readFailed, setReadFailed] = useState(false);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  useEffect(() => {
    const context = createStockEventContext({ kind, facilityId, programId });
    const subscription = liveQuery(() => readArchivedStockEvents(context)).subscribe({
      next: (rows) => {
        if (context.sessionScope === getSessionScope()) {
          setCopies(rows);
          setReadFailed(false);
        }
      },
      error: () => {
        if (context.sessionScope === getSessionScope()) setReadFailed(true);
      },
    });
    return () => subscription.unsubscribe();
  }, [kind, facilityId, programId]);
  const savedTime = useCallback(
    (copy: StockEventDraft) =>
      formatTimestamp(new Date(copy.savedAt).toISOString(), i18n.language, {
        time: true,
        timeZone,
      }),
    [i18n.language, timeZone],
  );
  const restore = useCallback(async (copy: StockEventDraft) => {
    setPending(true);
    setRestoreFailed(false);
    const scope = getSessionScope();
    try {
      if (await restoreRef.current(copy)) {
        if (scope !== getSessionScope()) return;
        announceDeviceSave('stock-events.draft-restored');
        setOpen(false);
      } else if (scope === getSessionScope()) setRestoreFailed(true);
    } catch {
      if (scope === getSessionScope()) setRestoreFailed(true);
    } finally {
      if (scope === getSessionScope()) setPending(false);
    }
  }, []);
  const remove = async () => {
    if (!deleting || pending) return;
    const context = createStockEventContext({ kind, facilityId, programId });
    setPending(true);
    setDeleteFailed(false);
    try {
      await deleteStockEventCopy(context, deleting);
      if (context.sessionScope === getSessionScope()) setDeleting(null);
    } catch {
      if (context.sessionScope === getSessionScope()) setDeleteFailed(true);
    } finally {
      if (context.sessionScope === getSessionScope()) setPending(false);
    }
  };
  const columns = useMemo<ColumnDef<DataTableFeatures, StockEventDraft>[]>(
    () => [
      {
        accessorKey: 'savedAt',
        header: t('stock-events.draft-saved-at'),
        cell: ({ row }) => (
          <time dateTime={new Date(row.original.savedAt).toISOString()}>
            <span className="block whitespace-normal">{savedTime(row.original)}</span>
          </time>
        ),
      },
      {
        accessorKey: 'lines',
        header: t('stock-events.draft-line-count'),
        meta: { label: t('stock-events.draft-line-count') },
        cell: ({ row }) => new Intl.NumberFormat(i18n.language).format(row.original.lines.length),
      },
      {
        id: 'actions',
        header: '',
        meta: { className: 'w-10' },
        cell: ({ row }) => (
          <RowActions
            label={t('stock-events.draft-copy-actions', { time: savedTime(row.original) })}
            actions={[
              {
                id: 'restore',
                icon: <RotateCcwIcon />,
                label: t('stock-events.draft-restore'),
                disabled: pending || disabled,
                onSelect: () => void restore(row.original),
              },
              {
                id: 'delete',
                icon: <Trash2Icon />,
                destructive: true,
                label: t('stock-events.draft-delete'),
                disabled: pending || disabled,
                onSelect: () => {
                  setDeleteFailed(false);
                  setDeleting(row.original);
                },
              },
            ]}
          />
        ),
      },
    ],
    [t, i18n.language, savedTime, pending, disabled, restore],
  );
  const table = useTable({
    features: dataTableFeatures,
    data: copies,
    columns,
    getRowId: (copy) => copy.draftId,
    manualPagination: true,
    rowCount: copies.length,
  });
  if (!copies.length && !open && !readFailed) return null;
  return (
    <>
      <Button size="lg" variant="outline" disabled={disabled} onClick={() => setOpen(true)}>
        {t('stock-events.draft-archives')}
      </Button>
      <FormDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <div className="flex min-h-0 flex-1 flex-col gap-4" ref={measure}>
          <FormDialogHeader>
            <FormDialogTitle>{t('stock-events.draft-archives')}</FormDialogTitle>
            <FormDialogDescription>
              {t('stock-events.draft-archives-description')}
            </FormDialogDescription>
          </FormDialogHeader>
          <FormDialogBody>
            {(readFailed || restoreFailed) && (
              <ErrorAlert
                title={t('stock-events.draft-recovery-error-title')}
                description={t('stock-events.draft-recovery-error-description')}
              />
            )}
            <DialogTable
              cards={cards}
              title="savedAt"
              table={table}
              empty={t('stock-events.draft-no-archives')}
            />
          </FormDialogBody>
          <FormDialogFooter>
            <div className="contents" ref={closeRef}>
              <FormDialogCancel disabled={pending}>{t('dialog.close')}</FormDialogCancel>
            </div>
          </FormDialogFooter>
        </div>
        <AlertDialog
          open={!!deleting}
          onOpenChange={(next) => !next && !pending && setDeleting(null)}
        >
          <AlertDialogContent finalFocus={() => closeRef.current?.querySelector('button') ?? null}>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('stock-events.draft-delete-title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('stock-events.draft-delete-description')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteFailed && (
              <ErrorAlert
                title={t('stock-events.draft-recovery-error-title')}
                description={t('stock-events.draft-recovery-error-description')}
              />
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>{t('stock-events.cancel')}</AlertDialogCancel>
              <Button variant="destructive" disabled={pending} onClick={() => void remove()}>
                {t('stock-events.draft-delete')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </FormDialog>
    </>
  );
}
