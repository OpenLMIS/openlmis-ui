import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useIsMutating, useSuspenseQuery } from '@tanstack/react-query';
import { type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import {
  DialogLoadError,
  ErrorAlert,
  FieldSkeleton,
  serverMessage,
} from '@/components/display/dialog-parts';
import { useAppForm } from '@/components/form/form';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogForm,
  FormDialogHeader,
  FormDialogSubmit,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { FieldGroup } from '@/components/ui/field';
import { rejectBuqForecast } from '@/features/buq/api/api';
import {
  buqRejectionReasons,
  COMMENTS_MAX,
  type RejectionValues,
  rejectionSchema,
} from '@/features/buq/lib/rejection';
import { rejectionReasonsOptions } from '@/features/reference-data/api/queries';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { queryKeys } from '@/lib/key-factory';

type RejectDialogProps = {
  forecastId: string;
  open: boolean;
  onClose: () => void;
  onRejected: () => void;
};

const EMPTY: RejectionValues = { rejectionReasons: [], generalComments: '' };

const rejectKey = (id: string) => [...queryKeys.buq.detail(id), 'reject'];

export function RejectDialog({ forecastId, open, onClose, onRejected }: RejectDialogProps) {
  const { t } = useTranslation();
  const rejecting = useIsMutating({ mutationKey: rejectKey(forecastId) }) > 0;
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  const title = t('buq.approve.reject-title');

  return (
    <FormDialog
      onOpenChange={(next) => !next && !rejecting && onClose()}
      onOpenChangeComplete={(next) => !next && setMounted(false)}
      open={open}
      size="table"
    >
      {mounted && (
        <QueryBoundary
          errorComponent={({ error, reset }) => (
            <DialogLoadError
              error={error}
              errorTitle={t('buq.approve.reject-reasons-error')}
              onRetry={reset}
              title={title}
            />
          )}
          pendingFallback={
            <RejectLayout disabled title={title}>
              <FieldSkeleton label={t('buq.approve.reject-reasons')} required />
              <FieldSkeleton control="textarea" label={t('buq.approve.reject-comments')} />
            </RejectLayout>
          }
          resetKey={forecastId}
        >
          <RejectForm forecastId={forecastId} onRejected={onRejected} title={title} />
        </QueryBoundary>
      )}
    </FormDialog>
  );
}

function RejectLayout({
  title,
  pending = false,
  disabled = false,
  children,
}: {
  title: string;
  pending?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{title}</FormDialogTitle>
        <FormDialogDescription>{t('buq.approve.reject-description')}</FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>{children}</FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={pending}>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit disabled={disabled} pending={pending} variant="destructive">
          {t('buq.approve.reject')}
        </FormDialogSubmit>
      </FormDialogFooter>
    </>
  );
}

function RejectForm({
  forecastId,
  title,
  onRejected,
}: {
  forecastId: string;
  title: string;
  onRejected: () => void;
}) {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(rejectionReasonsOptions());
  const reasons = useMemo(() => buqRejectionReasons(data), [data]);
  const reject = useSessionMutation({
    mutationKey: rejectKey(forecastId),
    mutationFn: (values: RejectionValues) => rejectBuqForecast(forecastId, values),
    onSuccess: onRejected,
  });
  const form = useAppForm({
    defaultValues: EMPTY,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: rejectionSchema },
    onSubmit: ({ value }) => reject.mutateAsync(value).catch(() => undefined),
  });
  const comments = useStore(form.store, (state) => state.values.generalComments);

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <RejectLayout pending={reject.isPending} title={title}>
        {reject.isError && (
          <ErrorAlert
            description={serverMessage(reject.error) ?? t('buq.approve.reject-error')}
            title={t('buq.approve.reject-error-title')}
          />
        )}
        <form.AppField name="rejectionReasons">
          {(field) => (
            <field.MultiComboboxField
              emptyMessage={t('buq.approve.reject-reasons-empty')}
              items={reasons}
              label={t('buq.approve.reject-reasons')}
              placeholder={t('buq.approve.reject-reasons-placeholder')}
              removeLabel={(reason) => t('buq.approve.reject-reasons-remove', { reason })}
              required
            />
          )}
        </form.AppField>
        <form.AppField name="generalComments">
          {(field) => (
            <field.TextareaField
              description={t('buq.approve.reject-characters-left', {
                count: COMMENTS_MAX - comments.length,
              })}
              dir="auto"
              label={t('buq.approve.reject-comments')}
              maxLength={COMMENTS_MAX}
            />
          )}
        </form.AppField>
      </RejectLayout>
    </FormDialogForm>
  );
}
