import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRoundIcon, Loader2Icon, Trash2Icon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorAlert, serverMessage } from '@/components/dialog-parts';
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
import { createServiceAccount, deleteServiceAccount } from '@/features/service-accounts/api/api';
import { CopyKeyButton } from '@/features/service-accounts/components/copy-key-button';
import type { ServiceAccount } from '@/features/service-accounts/lib/types';
import { queryKeys } from '@/lib/key-factory';

const addKey = [...queryKeys.serviceAccounts.all, 'add'] as const;
const deleteKey = (token: string) => [...queryKeys.serviceAccounts.all, 'delete', token] as const;

type ServiceAccountDialogsProps = {
  adding: boolean;
  deleting: string | undefined;
  onClose: () => void;
};

export function ServiceAccountDialogs({ adding, deleting, onClose }: ServiceAccountDialogsProps) {
  return (
    <>
      <AddServiceAccountDialog onClose={onClose} open={adding} />
      <DeleteServiceAccountDialog onClose={onClose} token={deleting} />
    </>
  );
}

function AddServiceAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [created, setCreated] = useState<ServiceAccount>();
  const isSaving = useIsMutating({ mutationKey: addKey }) > 0;

  const add = useMutation({
    mutationKey: addKey,
    mutationFn: createServiceAccount,
    onSuccess: setCreated,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.serviceAccounts.all });
    },
  });

  return (
    <AlertDialog
      onOpenChange={(next) => !next && !isSaving && onClose()}
      onOpenChangeComplete={(next) => {
        if (next) return;
        setCreated(undefined);
        add.reset();
      }}
      open={open}
    >
      <AlertDialogContent>
        {created ? (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia>
                <KeyRoundIcon />
              </AlertDialogMedia>
              <AlertDialogTitle>{t('service-accounts.added-title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('service-accounts.added-description')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <KeyBox token={created.token} />
            <AlertDialogFooter>
              <Button onClick={onClose}>{t('service-accounts.done')}</Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia>
                <KeyRoundIcon />
              </AlertDialogMedia>
              <AlertDialogTitle>{t('service-accounts.add-title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('service-accounts.add-description')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {add.isError && (
              <ErrorAlert
                description={serverMessage(add.error) ?? t('service-accounts.save-error')}
                title={t('service-accounts.add-error-title')}
              />
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={add.isPending}>{t('dialog.cancel')}</AlertDialogCancel>
              <Button disabled={add.isPending} onClick={() => add.mutate()}>
                {add.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
                {t('service-accounts.add')}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function KeyBox({ token }: { token: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
      <span className="min-w-0 flex-1 font-mono text-sm" dir="ltr">
        {token}
      </span>
      <CopyKeyButton token={token} />
    </div>
  );
}

function DeleteServiceAccountDialog({
  token,
  onClose,
}: {
  token: string | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { shown, dialogProps } = useDialogTarget(token, onClose);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const isDeleting = useIsMutating({ mutationKey: deleteKey(shown ?? '') }) > 0;

  const remove = useMutation({
    mutationKey: deleteKey(shown ?? ''),
    mutationFn: deleteServiceAccount,
    onSuccess: (_, deleted) => {
      toast.success(t('service-accounts.deleted-title'), {
        description: t('service-accounts.deleted', { key: deleted }),
      });
      onClose();
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.serviceAccounts.all });
    },
  });

  return (
    <AlertDialog
      {...dialogProps(isDeleting)}
      onOpenChangeComplete={(next) => {
        dialogProps().onOpenChangeComplete(next);
        if (!next) remove.reset();
      }}
    >
      {/* Cancel first, not the key's Copy button: deleting cannot be undone. */}
      <AlertDialogContent initialFocus={cancelRef}>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>{t('service-accounts.delete-title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('service-accounts.delete-description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {shown && <KeyBox token={shown} />}
        {remove.isError && (
          <ErrorAlert
            description={serverMessage(remove.error) ?? t('service-accounts.save-error')}
            title={t('service-accounts.delete-error-title')}
          />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending} ref={cancelRef}>
            {t('dialog.cancel')}
          </AlertDialogCancel>
          <Button
            disabled={remove.isPending || !shown}
            onClick={() => shown && remove.mutate(shown)}
            variant="destructive"
          >
            {remove.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
            {t('service-accounts.delete')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
