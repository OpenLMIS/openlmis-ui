import { useStore } from '@tanstack/react-form';
import { useIsMutating, useSuspenseQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  DialogLoadError,
  DialogNotFound,
  ErrorAlert,
  FieldSkeleton,
  SwitchSkeleton,
  serverMessage,
} from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
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
import { QueryBoundary } from '@/components/query-boundary';
import { FieldGroup } from '@/components/ui/field';
import type { RejectionReason } from '@/features/reference-data/lib/types';
import { rejectionReasonDetailOptions } from '@/features/rejection-reasons/api/queries';
import { RejectionReasonFields } from '@/features/rejection-reasons/components/rejection-reason-fields';
import { useDialogDiscardGuard } from '@/features/rejection-reasons/components/use-dialog-discard-guard';
import { useDialogOpeningKey } from '@/features/rejection-reasons/components/use-dialog-opening-key';
import {
  rejectionReasonSaveKey,
  useRejectionReasonForm,
} from '@/features/rejection-reasons/components/use-rejection-reason-form';
import { useOpening } from '@/hooks/use-opening';
import { isNotFound } from '@/lib/http';

export function RejectionReasonFormDialog({
  target,
  onClose,
}: {
  target: string | undefined;
  onClose: () => void;
}) {
  const openingKey = useDialogOpeningKey(target);
  const { shown, close, dialogProps } = useDialogTarget(target, onClose);
  const pending = useIsMutating({ mutationKey: rejectionReasonSaveKey }) > 0;
  return (
    <FormDialog
      {...dialogProps(pending)}
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      {shown && (
        <RejectionReasonDialogContent
          key={openingKey}
          target={shown}
          active={target === shown}
          onSaved={close}
        />
      )}
    </FormDialog>
  );
}

function RejectionReasonForm({
  onSaved,
  saved,
  active,
}: {
  onSaved: () => void;
  saved?: RejectionReason;
  active: boolean;
}) {
  const { t } = useTranslation();
  const fields = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);
  const { form, save, categoryReady } = useRejectionReasonForm({
    saved,
    onSaved: (reason) => {
      leaving.current = true;
      toast.success(t('rejection-reasons.form.saved-title'), {
        description: t('rejection-reasons.form.saved', { name: reason.name }),
      });
      onSaved();
    },
    onInvalid: () =>
      requestAnimationFrame(() =>
        fields.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      ),
  });
  const dirty = useStore(form.store, (state) => !state.isDefaultValue);
  const guard = useDialogDiscardGuard({
    dirty,
    pending: save.isPending,
    active: active && Boolean(saved),
    targetKey: 'reason',
    allowLeave: () => leaving.current,
  });
  const disabled = save.isPending || save.isSuccess;
  return (
    <>
      <FormDialogForm onSubmit={form.handleSubmit}>
        <FormDialogHeader>
          <FormDialogTitle>
            {t(saved ? 'rejection-reasons.form.edit-title' : 'rejection-reasons.form.create-title')}
          </FormDialogTitle>
          <FormDialogDescription>{t('rejection-reasons.form.description')}</FormDialogDescription>
        </FormDialogHeader>
        <FormDialogBody>
          <div ref={fields}>
            <FieldGroup>
              {save.isError && (
                <ErrorAlert
                  title={t('rejection-reasons.form.save-error-title')}
                  description={serverMessage(save.error) ?? t('rejection-reasons.form.save-error')}
                />
              )}
              <RejectionReasonFields form={form} disabled={disabled} saved={saved} />
            </FieldGroup>
          </div>
        </FormDialogBody>
        <FormDialogFooter>
          <FormDialogCancel disabled={save.isPending}>{t('dialog.cancel')}</FormDialogCancel>
          <FormDialogSubmit disabled={save.isSuccess || !categoryReady} pending={save.isPending}>
            {t('rejection-reasons.form.save')}
          </FormDialogSubmit>
        </FormDialogFooter>
      </FormDialogForm>
      <DiscardChangesDialog
        description={t('rejection-reasons.form.discard-description', {
          name: saved?.name ?? form.state.values.name,
        })}
        {...guard}
      />
    </>
  );
}

function RejectionReasonDialogContent({
  target,
  active,
  onSaved,
}: {
  target: string;
  active: boolean;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const opening = useOpening();
  const title = t(
    target === 'new' ? 'rejection-reasons.form.create-title' : 'rejection-reasons.form.edit-title',
  );
  return (
    <QueryBoundary
      resetKey={target}
      errorComponent={({ error, reset }) =>
        isNotFound(error) ? (
          <DialogNotFound
            title={title}
            description={t('rejection-reasons.form.not-found-description')}
          />
        ) : (
          <DialogLoadError
            error={error}
            errorTitle={t('rejection-reasons.form.load-error-title')}
            title={title}
            onRetry={reset}
          />
        )
      }
      pendingFallback={<RejectionReasonFormSkeleton title={title} />}
    >
      {target === 'new' ? (
        <RejectionReasonForm active={active} onSaved={onSaved} />
      ) : (
        <ExistingRejectionReasonForm
          id={target}
          opening={opening}
          active={active}
          onSaved={onSaved}
        />
      )}
    </QueryBoundary>
  );
}

function ExistingRejectionReasonForm({
  id,
  opening,
  active,
  onSaved,
}: {
  id: string;
  opening: number;
  active: boolean;
  onSaved: () => void;
}) {
  const { data } = useSuspenseQuery(rejectionReasonDetailOptions(id, opening));
  const [saved] = useState(() => data);
  return <RejectionReasonForm saved={saved} active={active} onSaved={onSaved} />;
}

function RejectionReasonFormSkeleton({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{title}</FormDialogTitle>
        <FormDialogDescription>{t('rejection-reasons.form.description')}</FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          <FieldSkeleton label={t('rejection-reasons.name')} required />
          <FieldSkeleton label={t('rejection-reasons.code')} required />
          <FieldSkeleton label={t('rejection-reasons.category')} required />
          <SwitchSkeleton />
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit disabled>{t('rejection-reasons.form.save')}</FormDialogSubmit>
      </FormDialogFooter>
    </>
  );
}
