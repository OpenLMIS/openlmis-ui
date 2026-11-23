import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Trash2Icon } from 'lucide-react';
import { use, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { returnState } from '@/features/requisitions/lib/requisition-return';
import type { RequisitionSearch } from '@/features/requisitions/lib/search-facilities';
import type { RequisitionSearchResult } from '@/features/requisitions/lib/types';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { apiErrorText, isSilentApiError } from '@/lib/api-error';
import { reportApiError } from '@/lib/report-error';

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
  const client = useQueryClient();
  const copies = use(RequisitionCopiesContext);
  const copy = copies?.find((copy) => copy.id === record.id);
  const [decision, setDecision] = useState<Decision>();
  const [failure, setFailure] = useState<{ error: unknown }>();
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
    onError: (error) => {
      if (isSilentApiError(error)) return;
      reportApiError(error);
      setFailure({ error });
    },
  });
  const start = useSessionMutation({
    mutationFn: () => removalDecision(record.id),
    onSuccess: (current) => {
      setDecision(current);
      setFailure(undefined);
      setOpen(true);
    },
    onError: (error) => {
      if (isSilentApiError(error)) return;
      reportApiError(error);
      setDecision(undefined);
      setFailure({ error });
      setOpen(true);
    },
  });
  const error = failure ? apiErrorText(failure.error, 'requisitions.offline.stale', t) : null;
  return (
    <>
      <ViewRequisition
        record={record}
        disabled={disabled}
        linkProps={{ search }}
        actions={
          copy
            ? [
                {
                  id: 'remove',
                  icon: <Trash2Icon />,
                  label: t('requisitions.offline.remove'),
                  destructive: true,
                  disabled: disabled || start.isPending,
                  onSelect: (element) => {
                    trigger.current = element;
                    start.mutate();
                  },
                },
              ]
            : []
        }
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
              {error ??
                t(
                  decision?.batchBlocked
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
                render={
                  <Link
                    to="/requisitions/approve/batch"
                    search={{ ids: record.id, program: record.program?.id }}
                    state={returnState({ to: '/requisitions/view', search })}
                  />
                }
              >
                {t('requisitions.batch.title')}
              </Button>
            ) : (
              <Button
                variant="destructive-solid"
                disabled={!decision || error !== null || mutation.isPending}
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
