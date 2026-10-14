import { type ColumnDef, useTable } from '@tanstack/react-table';
import { liveQuery } from 'dexie';
import { MoreHorizontalIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  type DataTableFeatures,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { ErrorAlert } from '@/components/dialog-parts';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogHeader,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  createStockEventContext,
  deleteStockEventCopy,
  readArchivedStockEvents,
  type StockEventDraft,
  type StockEventSelection,
} from '@/features/stock-events/lib/stock-event-local';
import { announceDeviceSave } from '@/lib/device-save-announcement';
import { getSessionScope } from '@/lib/session-scope';

type Props = StockEventSelection & {
  disabled: boolean;
  onRestore: (copy: StockEventDraft) => Promise<boolean>;
};

export function EventArchivedCopies({ kind, facilityId, programId, disabled, onRestore }: Props) {
  const { t, i18n } = useTranslation();
  const restoreRef = useRef(onRestore);
  restoreRef.current = onRestore;
  const [copies, setCopies] = useState<StockEventDraft[]>([]);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<StockEventDraft | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const context = createStockEventContext({ kind, facilityId, programId });
    const subscription = liveQuery(() => readArchivedStockEvents(context)).subscribe({
      next: (rows) => {
        if (context.sessionScope === getSessionScope()) setCopies(rows);
      },
      error: () => {
        if (context.sessionScope === getSessionScope()) setFailed(true);
      },
    });
    return () => subscription.unsubscribe();
  }, [kind, facilityId, programId]);
  const savedTime = useCallback(
    (copy: StockEventDraft) =>
      new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }).format(
        copy.savedAt,
      ),
    [i18n.language],
  );
  const restore = useCallback(async (copy: StockEventDraft) => {
    setPending(true);
    setFailed(false);
    const scope = getSessionScope();
    try {
      if (await restoreRef.current(copy)) {
        if (scope !== getSessionScope()) return;
        announceDeviceSave('stock-events.draft-restored');
        setOpen(false);
      } else if (scope === getSessionScope()) setFailed(true);
    } catch {
      if (scope === getSessionScope()) setFailed(true);
    } finally {
      if (scope === getSessionScope()) setPending(false);
    }
  }, []);
  const remove = async () => {
    if (!deleting || pending) return;
    const context = createStockEventContext({ kind, facilityId, programId });
    setPending(true);
    setFailed(false);
    try {
      await deleteStockEventCopy(context, deleting);
      if (context.sessionScope === getSessionScope()) setDeleting(null);
    } catch {
      if (context.sessionScope === getSessionScope()) setFailed(true);
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
            <span className="block">
              {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short' }).format(
                row.original.savedAt,
              )}
            </span>
            <span className="block text-xs text-muted-foreground">
              {new Intl.DateTimeFormat(i18n.language, { timeStyle: 'short' }).format(
                row.original.savedAt,
              )}
            </span>
          </time>
        ),
      },
      {
        accessorKey: 'lines',
        header: t('stock-events.draft-line-count'),
        cell: ({ row }) => new Intl.NumberFormat(i18n.language).format(row.original.lines.length),
      },
      {
        id: 'actions',
        header: '',
        meta: { className: 'w-10' },
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={pending || disabled}
                  aria-label={t('stock-events.draft-copy-actions', {
                    time: savedTime(row.original),
                  })}
                />
              }
            >
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void restore(row.original)}>
                {t('stock-events.draft-restore')}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setDeleting(row.original)}>
                {t('stock-events.draft-delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
  if (!copies.length && !open && !failed) return null;
  return (
    <>
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => setOpen(true)}>
        {t('stock-events.draft-archives')}
      </Button>
      <FormDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <FormDialogHeader>
          <FormDialogTitle>{t('stock-events.draft-archives')}</FormDialogTitle>
          <FormDialogDescription>
            {t('stock-events.draft-archives-description')}
          </FormDialogDescription>
        </FormDialogHeader>
        <FormDialogBody>
          {failed && (
            <ErrorAlert
              title={t('stock-events.draft-recovery-error-title')}
              description={t('stock-events.draft-recovery-error-description')}
            />
          )}
          <DataTable table={table} empty={t('stock-events.draft-no-archives')} />
        </FormDialogBody>
        <FormDialogFooter>
          <FormDialogCancel disabled={pending}>{t('dialog.close')}</FormDialogCancel>
        </FormDialogFooter>
      </FormDialog>
      <AlertDialog
        open={!!deleting}
        onOpenChange={(next) => !next && !pending && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('stock-events.draft-delete-title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('stock-events.draft-delete-description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {failed && (
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
    </>
  );
}
