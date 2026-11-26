import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { deleteReportCategory } from '@/features/report-categories/api/api';
import {
  refreshReportCategories,
  reportCategoryDetailOptions,
} from '@/features/report-categories/api/queries';
import type { ReportCategory } from '@/features/report-categories/lib/types';
import { useOpening } from '@/hooks/use-opening';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { apiErrorText } from '@/lib/api-error';
import { isNotFound, isOfflineError, isRefused } from '@/lib/http';
import { reportApiError } from '@/lib/report-error';

type DeleteCategoryDialogProps = {
  target: string | undefined;
  hint?: ReportCategory;
  onClose: () => void;
  opener: RefObject<HTMLButtonElement | null>;
  addButton: RefObject<HTMLButtonElement | null>;
};

export function DeleteCategoryDialog({
  target,
  hint,
  onClose,
  opener,
  addButton,
}: DeleteCategoryDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { shown, close, dialogProps } = useDialogTarget(target, onClose);
  const opening = useOpening(target);
  const cancel = useRef<HTMLButtonElement>(null);
  const removed = useRef(false);
  const remove = useSessionMutation({
    mutationFn: ({ category }: { category: ReportCategory; opening: number }) =>
      deleteReportCategory(category.id),
    onSuccess: async (_, { category }) => {
      await refreshReportCategories(queryClient, remove.isCurrent);
      if (!remove.isCurrent()) return;
      toast.success(t('report-categories.toast.deleted'), {
        description: t('report-categories.toast.deleted-description', { name: category.name }),
      });
    },
    onError: async (error) => {
      reportApiError(error);
      if (isOfflineError(error)) return;
      const description = apiErrorText(error, 'error.description', t, { write: true });
      if (description !== null) {
        toast.error(t('report-categories.delete.error-title'), { description });
      }
      if (isNotFound(error)) await refreshReportCategories(queryClient, remove.isCurrent);
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
          <DeleteCategoryContent
            cancel={cancel}
            deleted={
              remove.isSuccess && remove.variables.opening === opening
                ? remove.variables.category
                : undefined
            }
            hint={hint?.id === shown ? hint : undefined}
            key={opening}
            opening={opening}
            onDelete={(category) =>
              remove.mutate(
                { category, opening },
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
            target={shown}
          />
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteCategoryContent({
  cancel,
  deleted,
  hint,
  opening,
  onDelete,
  pending,
  target,
}: {
  cancel: RefObject<HTMLButtonElement | null>;
  deleted?: ReportCategory;
  hint?: ReportCategory;
  opening: number;
  onDelete: (category: ReportCategory) => void;
  pending: boolean;
  target: string;
}) {
  const { t } = useTranslation();
  const [initialHint] = useState(hint);
  const detail = useQuery({
    ...reportCategoryDetailOptions(target, 'delete', opening),
    enabled: !initialHint,
  });
  const category = deleted ?? initialHint ?? detail.data;
  const state = category
    ? 'found'
    : detail.isPending
      ? 'loading'
      : isNotFound(detail.error)
        ? 'missing'
        : 'failed';
  const failed = state === 'failed';
  const missing = state === 'missing';
  const refused = failed && isRefused(detail.error);
  const offline = useOfflineFailure(
    failed && !refused ? detail.error : null,
    () => void detail.refetch(),
  );
  const failureTitle = refused
    ? 'report-categories.form.no-access-title'
    : offline
      ? 'offline.notice-title'
      : 'report-categories.load-error-title';
  const failureDescription = refused
    ? 'report-categories.form.no-access'
    : offline
      ? 'offline.notice-description'
      : 'error.check-connection';

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogMedia>
          <Trash2Icon />
        </AlertDialogMedia>
        <AlertDialogTitle>
          {t(
            state === 'found'
              ? 'report-categories.delete.title'
              : missing
                ? 'report-categories.not-found-title'
                : failed
                  ? failureTitle
                  : 'report-categories.delete.pending-title',
          )}
        </AlertDialogTitle>
        {state === 'loading' ? (
          <SkeletonLine width="medium" />
        ) : (
          <AlertDialogDescription>
            {category ? (
              <span className="line-clamp-4 wrap-anywhere">
                {t('report-categories.delete.description', { name: category.name })}
              </span>
            ) : (
              t(missing ? 'api-error.report.error.reportCategory.notFound' : failureDescription)
            )}
          </AlertDialogDescription>
        )}
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending} ref={cancel}>
          {t(missing || failed ? 'dialog.close' : 'dialog.cancel')}
        </AlertDialogCancel>
        {failed && !refused && <RetryButton onClick={() => void detail.refetch()} />}
        {!missing && !failed && (
          <Button
            disabled={pending || !category || !!deleted}
            focusableWhenDisabled={pending}
            onClick={() => category && onDelete(category)}
            variant="destructive"
          >
            {pending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
            {t('report-categories.delete')}
          </Button>
        )}
      </AlertDialogFooter>
    </>
  );
}
