import {
  type QueryClient,
  type QueryKey,
  type UseQueryOptions,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { Loader2Icon, Trash2Icon } from 'lucide-react';
import { type RefObject, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useOfflineFailure } from '@/components/app-shell/offline-notice';
import { RetryButton, SkeletonLine } from '@/components/display/dialog-parts';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useOpening } from '@/hooks/use-opening';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { apiErrorText } from '@/lib/api-error';
import { isNotFound, isOfflineError, isRefused } from '@/lib/http';
import { reportApiError } from '@/lib/report-error';

type RecordSummary = { id: string; name: string };

type DeleteCopy = {
  deleted: string;
  deletedDescription: (name: string) => string;
  errorTitle: string;
  noAccessTitle: string;
  noAccess: string;
  loadErrorTitle: string;
  title: string;
  missingTitle: string;
  pendingTitle: string;
  description: (name: string) => string;
  missingDescription: string;
  action: string;
};

type BlockedRecord<T> = (record: T) => { title: string; description: string } | undefined;

type DeleteRecordOptions<T extends RecordSummary, TKey extends QueryKey> = {
  detailOptions: (id: string, opening: number) => UseQueryOptions<T, Error, T, TKey>;
  removeRecord: (id: string) => Promise<unknown>;
  refresh: (client: QueryClient, isCurrent: () => boolean) => Promise<void>;
  getCopy: (t: TFunction) => DeleteCopy;
  blocked?: BlockedRecord<T>;
  refreshOnError?: (error: unknown) => boolean;
};

export type DeleteRecordDialogProps<T extends RecordSummary> = {
  target: string | undefined;
  hint?: T;
  onClose: () => void;
  opener: RefObject<HTMLButtonElement | null>;
  addButton: RefObject<HTMLButtonElement | null>;
};

export function DeleteRecordDialog<T extends RecordSummary, TKey extends QueryKey>({
  target,
  hint,
  onClose,
  opener,
  addButton,
  detailOptions,
  removeRecord,
  refresh,
  getCopy,
  blocked,
  refreshOnError,
}: DeleteRecordDialogProps<T> & DeleteRecordOptions<T, TKey>) {
  const { t } = useTranslation();
  const copy = getCopy(t);
  const queryClient = useQueryClient();
  const { shown, close, dialogProps } = useDialogTarget(target, onClose);
  const opening = useOpening(target);
  const cancel = useRef<HTMLButtonElement>(null);
  const removed = useRef(false);
  const remove = useSessionMutation({
    mutationFn: ({ record }: { record: T; opening: number }) => removeRecord(record.id),
    onSuccess: async (_, { record }) => {
      await refresh(queryClient, remove.isCurrent);
      if (!remove.isCurrent()) return;
      toast.success(copy.deleted, {
        description: copy.deletedDescription(record.name),
      });
    },
    onError: async (error) => {
      reportApiError(error);
      if (isOfflineError(error)) return;
      const description = apiErrorText(error, 'error.description', t, { write: true });
      if (description !== null) {
        toast.error(copy.errorTitle, { description });
      }
      if (isNotFound(error) || refreshOnError?.(error)) {
        await refresh(queryClient, remove.isCurrent);
      }
    },
  });
  const props = dialogProps(remove.isPending);

  return (
    <AlertDialog
      {...props}
      onOpenChangeComplete={(next) => {
        props.onOpenChangeComplete(next);
        if (!next) remove.reset();
      }}
    >
      <AlertDialogContent
        finalFocus={() => {
          const trigger = opener.current;
          const focusTarget =
            !removed.current && trigger?.isConnected ? trigger : addButton.current;
          opener.current = null;
          removed.current = false;
          return focusTarget ?? true;
        }}
        initialFocus={cancel}
      >
        {shown && (
          <DeleteRecordContent
            blocked={blocked}
            copy={copy}
            detailOptions={detailOptions(shown, opening)}
            cancel={cancel}
            deleted={
              remove.isSuccess && remove.variables.opening === opening
                ? remove.variables.record
                : undefined
            }
            hint={hint?.id === shown ? hint : undefined}
            key={opening}
            onDelete={(record) =>
              remove.mutate(
                { record, opening },
                {
                  onSuccess: () => {
                    removed.current = true;
                    close();
                  },
                  onError: (error) => {
                    removed.current = isNotFound(error);
                    close();
                  },
                },
              )
            }
            pending={remove.isPending}
          />
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteRecordContent<T extends RecordSummary, TKey extends QueryKey>({
  blocked,
  copy,
  detailOptions,
  cancel,
  deleted,
  hint,
  onDelete,
  pending,
}: {
  blocked?: BlockedRecord<T>;
  copy: DeleteCopy;
  detailOptions: UseQueryOptions<T, Error, T, TKey>;
  cancel: RefObject<HTMLButtonElement | null>;
  deleted?: T;
  hint?: T;
  onDelete: (record: T) => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const [initialHint] = useState(hint);
  const detail = useQuery({
    ...detailOptions,
    enabled: !initialHint,
  });
  const record = deleted ?? initialHint ?? detail.data;
  const state = record
    ? 'found'
    : detail.isPending
      ? 'loading'
      : isNotFound(detail.error)
        ? 'missing'
        : 'failed';
  const blockedNotice = record && blocked?.(record);
  const failed = state === 'failed';
  const missing = state === 'missing';
  const refused = failed && isRefused(detail.error);
  const offline = useOfflineFailure(
    failed && !refused ? detail.error : null,
    () => void detail.refetch(),
  );
  const failureTitle = refused
    ? copy.noAccessTitle
    : offline
      ? t('offline.notice-title')
      : copy.loadErrorTitle;
  const failureDescription = refused
    ? copy.noAccess
    : offline
      ? t('offline.notice-description')
      : t('error.check-connection');

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogMedia>
          <Trash2Icon />
        </AlertDialogMedia>
        <AlertDialogTitle>
          {state === 'found'
            ? (blockedNotice?.title ?? copy.title)
            : missing
              ? copy.missingTitle
              : failed
                ? failureTitle
                : copy.pendingTitle}
        </AlertDialogTitle>
        {state === 'loading' ? (
          <SkeletonLine width="medium" />
        ) : (
          <AlertDialogDescription>
            {record ? (
              <span className="line-clamp-4 wrap-anywhere">
                {blockedNotice?.description ?? copy.description(record.name)}
              </span>
            ) : missing ? (
              copy.missingDescription
            ) : (
              failureDescription
            )}
          </AlertDialogDescription>
        )}
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending} ref={cancel}>
          {t(missing || failed || blockedNotice ? 'dialog.close' : 'dialog.cancel')}
        </AlertDialogCancel>
        {failed && !refused && <RetryButton onClick={() => void detail.refetch()} />}
        {!missing && !failed && !blockedNotice && (
          <Button
            disabled={pending || !record || !!deleted}
            focusableWhenDisabled={pending}
            onClick={() => record && onDelete(record)}
            variant="destructive"
          >
            {pending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
            {copy.action}
          </Button>
        )}
      </AlertDialogFooter>
    </>
  );
}
