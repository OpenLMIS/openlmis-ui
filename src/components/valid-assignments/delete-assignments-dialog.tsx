import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2Icon, Trash2Icon } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorAlert } from '@/components/dialog-parts';
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
import { deleteAssignments } from '@/components/valid-assignments/delete-assignments';
import type { AssignmentsApi } from '@/components/valid-assignments/types';

type DeleteAssignmentsDialogProps = {
  api: AssignmentsApi;
  /** The rows to delete, by id and name; none closes the dialog. */
  targets: ReadonlyMap<string, string> | undefined;
  onClose: () => void;
  /** Called with the ids that are gone, whatever happened to the rest. */
  onDeleted: (ids: string[]) => void;
};

export function DeleteAssignmentsDialog({
  api,
  targets,
  onClose,
  onDeleted,
}: DeleteAssignmentsDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { shown, dialogProps } = useDialogTarget(targets, onClose);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const count = shown?.size ?? 0;

  const remove = useMutation({
    mutationFn: (ids: string[]) => deleteAssignments(api.remove, ids),
    onSuccess: ({ deleted, failed }) => {
      onDeleted(deleted);
      if (deleted.length === 0) return;
      onClose();
      if (failed.length === 0) {
        toast.success(
          t('valid-assignments.deleted-title', { kind: api.kind, count: deleted.length }),
          {
            description: t('valid-assignments.deleted', { count: deleted.length }),
          },
        );
      } else {
        toast.error(t('valid-assignments.partly-deleted-title'), {
          description: t('valid-assignments.partly-deleted', {
            deleted: deleted.length,
            failed: failed.length,
          }),
        });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: api.queryKey });
    },
  });
  const nothingDeleted = remove.isError || remove.data?.deleted.length === 0;

  const props = dialogProps(remove.isPending);

  return (
    <AlertDialog
      {...props}
      onOpenChangeComplete={(next) => {
        props.onOpenChangeComplete(next);
        if (!next) remove.reset();
      }}
    >
      <AlertDialogContent initialFocus={cancelRef}>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>
            {t('valid-assignments.delete-title', { kind: api.kind, count })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('valid-assignments.delete-description', {
              kind: api.kind,
              count,
              name: shown?.values().next().value ?? '',
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {nothingDeleted && (
          <ErrorAlert
            description={t('valid-assignments.delete-error-description')}
            title={t('valid-assignments.delete-error-title')}
          />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending} ref={cancelRef}>
            {t('dialog.cancel')}
          </AlertDialogCancel>
          <Button
            disabled={remove.isPending}
            focusableWhenDisabled
            onClick={() => shown && remove.mutate([...shown.keys()])}
            variant="destructive"
          >
            {remove.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
            {t('valid-assignments.delete-confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
