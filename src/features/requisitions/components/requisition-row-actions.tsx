import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ClipboardCheckIcon, EyeIcon, Trash2Icon } from 'lucide-react';
import { use, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RowActions } from '@/components/display/card-actions';
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
import { ViewRequisition } from '@/features/requisitions/components/requisition-list-parts';
import {
  COPIES_KEY,
  LOCAL_LIST_KEY,
  RequisitionCopiesContext,
} from '@/features/requisitions/hooks/use-offline-copies';
import { removalDecision, removeCopy } from '@/features/requisitions/lib/offline-copies';
import type { RequisitionSearch } from '@/features/requisitions/lib/search-facilities';
import type { RequisitionSearchResult } from '@/features/requisitions/lib/types';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { useOnline } from '@/lib/online';

type Decision = Awaited<ReturnType<typeof removalDecision>>;
export function RequisitionRowActions({
  record,
  search,
  disabled,
}: {
  record: RequisitionSearchResult;
  search: RequisitionSearch;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const online = useOnline();
  const client = useQueryClient();
  const copies = use(RequisitionCopiesContext);
  const copy = copies?.find((copy) => copy.id === record.id);
  const [decision, setDecision] = useState<Decision>();
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const mutation = useSessionMutation({
    mutationFn: removeCopy,
    onSuccess: async () => {
      const heading = document.querySelector<HTMLElement>('main h1');
      setOpen(false);
      await Promise.all([
        client.invalidateQueries({ queryKey: COPIES_KEY }),
        client.invalidateQueries({ queryKey: LOCAL_LIST_KEY }),
      ]);
      if (!mutation.isCurrent()) return;
      requestAnimationFrame(() => {
        if (mutation.isCurrent() && heading?.isConnected && !trigger.current?.isConnected) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
      });
    },
    onError: () => {
      setError(true);
    },
  });
  const start = useSessionMutation({
    mutationFn: () => removalDecision(record.id),
    onSuccess: (current) => {
      setDecision(current);
      setError(false);
      setOpen(true);
    },
    onError: () => {
      setDecision(undefined);
      setError(true);
      setOpen(true);
    },
  });
  if (!copy && online)
    return <ViewRequisition record={record} disabled={disabled} linkProps={{ search }} />;
  return (
    <>
      <RowActions
        label={t('card-actions.actions-for', {
          name: [record.program?.name, record.processingPeriod?.name].filter(Boolean).join(' - '),
        })}
        actions={[
          {
            id: 'view',
            icon: <EyeIcon />,
            label: t('requisitions.view.action'),
            disabled: disabled || (!online && !copy?.single),
            link: (
              <Link
                to="/requisitions/view/$requisitionId"
                params={{ requisitionId: record.id }}
                search={search}
              />
            ),
          },
          ...(!online && copy?.batch
            ? [
                {
                  id: 'batch',
                  icon: <ClipboardCheckIcon />,
                  label: t('requisitions.batch.title'),
                  disabled,
                  link: <Link to="/requisitions/approve/batch" search={{ ids: record.id }} />,
                },
              ]
            : []),
          ...(copy
            ? [
                {
                  id: 'remove',
                  icon: <Trash2Icon />,
                  label: t('requisitions.offline.remove'),
                  destructive: true,
                  disabled: disabled || start.isPending,
                  onSelect: (element: HTMLButtonElement) => {
                    trigger.current = element;
                    start.mutate();
                  },
                },
              ]
            : []),
        ]}
      />
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!mutation.isPending) setOpen(next);
        }}
      >
        <AlertDialogContent
          finalFocus={() => {
            if (trigger.current?.isConnected) return trigger.current;
            const heading = document.querySelector<HTMLElement>('main h1');
            if (heading) heading.tabIndex = -1;
            return heading ?? false;
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{t('requisitions.offline.remove')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                error
                  ? 'requisitions.offline.stale'
                  : decision?.batchBlocked
                    ? 'requisitions.offline.batch-blocked'
                    : 'requisitions.offline.remove-description',
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {decision?.dirty && !decision.batchBlocked && (
            <p>{t('requisitions.offline.dirty-warning')}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>
              {t('dialog.cancel')}
            </AlertDialogCancel>
            {decision?.batchBlocked ? (
              <Button
                nativeButton={false}
                render={<Link to="/requisitions/approve/batch" search={{ ids: record.id }} />}
              >
                {t('requisitions.batch.title')}
              </Button>
            ) : (
              <Button
                variant="destructive-solid"
                disabled={!decision || error || mutation.isPending}
                onClick={() => decision && mutation.mutate(decision)}
              >
                {t('requisitions.offline.remove')}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
