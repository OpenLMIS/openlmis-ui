import { revalidateLogic } from '@tanstack/react-form';
import { useIsMutating, useSuspenseQuery } from '@tanstack/react-query';
import { type ReactNode, useMemo } from 'react';
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
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
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

export const rejectKey = (id: string) => [...queryKeys.buq.detail(id), 'reject'];

export function RejectDialog({ forecastId, open, onClose, onRejected }: RejectDialogProps) {
  const { t } = useTranslation();
  const rejecting = useIsMutating({ mutationKey: rejectKey(forecastId) }) > 0;
  const { shown, dialogProps } = useDialogTarget(open ? forecastId : undefined, onClose);

  return (
    <FormDialog {...dialogProps(rejecting)} size="table">
      {shown && (
        <QueryBoundary
          errorComponent={({ error, reset }) => (
            <DialogLoadError
              error={error}
              errorTitle={t('buq.approve.reject-reasons-error')}
              onRetry={reset}
              title={t('buq.approve.reject-title')}
            />
          )}
          pendingFallback={
            <RejectLayout disabled>
              <FieldSkeleton label={t('buq.approve.reject-reasons')} required />
              <FieldSkeleton
                control="textarea"
                description={t('buq.approve.reject-characters-left', { count: COMMENTS_MAX })}
                label={t('buq.approve.reject-comments')}
              />
            </RejectLayout>
          }
          resetKey={shown}
        >
          <RejectForm forecastId={shown} onRejected={onRejected} />
        </QueryBoundary>
      )}
    </FormDialog>
  );
}

function RejectLayout({
  pending = false,
  disabled = false,
  children,
}: {
  pending?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{t('buq.approve.reject-title')}</FormDialogTitle>
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

function RejectForm({ forecastId, onRejected }: { forecastId: string; onRejected: () => void }) {
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

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <RejectLayout pending={reject.isPending}>
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
                count: COMMENTS_MAX - field.state.value.length,
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
