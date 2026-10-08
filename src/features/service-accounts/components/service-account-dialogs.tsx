import { useQueryClient } from '@tanstack/react-query';
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
import {
  createServiceAccount,
  deleteServiceAccount,
  KeyLeftBehindError,
} from '@/features/service-accounts/api/api';
import { CopyKeyButton } from '@/features/service-accounts/components/copy-key-button';
import type { ServiceAccount } from '@/features/service-accounts/lib/types';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { queryKeys } from '@/lib/key-factory';

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
  const { close, dialogProps } = useDialogTarget(open || undefined, onClose);

  const add = useSessionMutation({
    mutationFn: createServiceAccount,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.serviceAccounts.all });
    },
  });

  const props = dialogProps(add.isPending);

  return (
    <AlertDialog
      {...props}
      onOpenChangeComplete={(next) => {
        props.onOpenChangeComplete(next);
        if (next) return;
        setCreated(undefined);
        add.reset();
      }}
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
            {/* The new key is what the dialog is now about, so focus moves to its Copy button. */}
            <KeyBox autoFocus token={created.token} />
            <AlertDialogFooter>
              <Button onClick={close}>{t('service-accounts.done')}</Button>
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
                description={
                  add.error instanceof KeyLeftBehindError
                    ? t('service-accounts.key-left-behind', { key: add.error.token })
                    : (serverMessage(add.error) ?? t('service-accounts.request-error'))
                }
                title={t('service-accounts.add-error-title')}
              />
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={add.isPending}>{t('dialog.cancel')}</AlertDialogCancel>
              <Button
                disabled={add.isPending}
                focusableWhenDisabled
                onClick={() => add.mutate(undefined, { onSuccess: setCreated })}
              >
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

function KeyBox({ token, autoFocus = false }: { token: string; autoFocus?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
      <span className="min-w-0 flex-1 font-mono text-sm" dir="ltr">
        {token}
      </span>
      <CopyKeyButton autoFocus={autoFocus} token={token} />
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
  const { shown, close, dialogProps } = useDialogTarget(token, onClose);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const remove = useSessionMutation({
    mutationFn: deleteServiceAccount,
    onSuccess: (_, deleted) => {
      toast.success(t('service-accounts.deleted-title'), {
        description: t('service-accounts.deleted', { key: deleted }),
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.serviceAccounts.all });
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
            description={serverMessage(remove.error) ?? t('service-accounts.request-error')}
            title={t('service-accounts.delete-error-title')}
          />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending} ref={cancelRef}>
            {t('dialog.cancel')}
          </AlertDialogCancel>
          <Button
            disabled={remove.isPending}
            focusableWhenDisabled
            onClick={() => shown && remove.mutate(shown, { onSuccess: close })}
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
