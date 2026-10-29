import { useStore } from '@tanstack/react-form';
import { useIsMutating, useSuspenseQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import {
  DialogLoadError,
  DialogNotFound,
  ErrorAlert,
  FieldSkeleton,
  SwitchSkeleton,
  serverMessage,
} from '@/components/display/dialog-parts';
import { DiscardChangesDialog } from '@/components/display/discard-changes-dialog';
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
import type { RejectionReasonCategory } from '@/features/reference-data/lib/types';
import { rejectionReasonCategoryDetailOptions } from '@/features/rejection-reasons/api/queries';
import { CategoryFields } from '@/features/rejection-reasons/components/category-fields';
import {
  categorySaveKey,
  useCategoryForm,
} from '@/features/rejection-reasons/components/use-category-form';
import { useDialogDiscardGuard } from '@/features/rejection-reasons/components/use-dialog-discard-guard';
import { useDialogOpeningKey } from '@/features/rejection-reasons/components/use-dialog-opening-key';
import { useOpening } from '@/hooks/use-opening';
import { isNotFound } from '@/lib/http';

export function CategoryFormDialog({
  target,
  onClose,
}: {
  target: string | undefined;
  onClose: () => void;
}) {
  const openingKey = useDialogOpeningKey(target);
  const { shown, close, dialogProps } = useDialogTarget(target, onClose);
  const pending = useIsMutating({ mutationKey: categorySaveKey }) > 0;
  return (
    <FormDialog
      {...dialogProps(pending)}
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      {shown && (
        <CategoryDialogContent
          key={openingKey}
          target={shown}
          active={target === shown}
          onSaved={close}
        />
      )}
    </FormDialog>
  );
}

function CategoryForm({
  onSaved,
  saved,
  active,
}: {
  onSaved: () => void;
  saved?: RejectionReasonCategory;
  active: boolean;
}) {
  const { t } = useTranslation();
  const fields = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);
  const { form, save } = useCategoryForm({
    saved,
    onSaved: (category) => {
      leaving.current = true;
      toast.success(t('rejection-reason-categories.form.saved-title'), {
        description: t('rejection-reason-categories.form.saved', { name: category.name }),
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
    targetKey: 'category',
    allowLeave: () => leaving.current,
  });
  const disabled = save.isPending || save.isSuccess;
  return (
    <>
      <FormDialogForm onSubmit={form.handleSubmit}>
        <FormDialogHeader>
          <FormDialogTitle>
            {t(
              saved
                ? 'rejection-reason-categories.form.edit-title'
                : 'rejection-reason-categories.form.create-title',
            )}
          </FormDialogTitle>
          <FormDialogDescription>
            {t('rejection-reason-categories.form.description')}
          </FormDialogDescription>
        </FormDialogHeader>
        <FormDialogBody>
          <div ref={fields}>
            <FieldGroup>
              {save.isError && (
                <ErrorAlert
                  title={t('rejection-reason-categories.form.save-error-title')}
                  description={
                    serverMessage(save.error) ?? t('rejection-reason-categories.form.save-error')
                  }
                />
              )}
              <CategoryFields form={form} disabled={disabled} />
            </FieldGroup>
          </div>
        </FormDialogBody>
        <FormDialogFooter>
          <FormDialogCancel disabled={save.isPending}>{t('dialog.cancel')}</FormDialogCancel>
          <FormDialogSubmit disabled={save.isSuccess} pending={save.isPending}>
            {t('rejection-reason-categories.form.save')}
          </FormDialogSubmit>
        </FormDialogFooter>
      </FormDialogForm>
      <DiscardChangesDialog
        description={t('rejection-reason-categories.form.discard-description', {
          name: saved?.name ?? form.state.values.name,
        })}
        {...guard}
      />
    </>
  );
}

function CategoryDialogContent({
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
    target === 'new'
      ? 'rejection-reason-categories.form.create-title'
      : 'rejection-reason-categories.form.edit-title',
  );
  return (
    <QueryBoundary
      resetKey={target}
      errorComponent={({ error, reset }) =>
        isNotFound(error) ? (
          <DialogNotFound
            title={title}
            description={t('rejection-reason-categories.form.not-found-description')}
          />
        ) : (
          <DialogLoadError
            error={error}
            errorTitle={t('rejection-reason-categories.form.load-error-title')}
            title={title}
            onRetry={reset}
          />
        )
      }
      pendingFallback={<CategoryFormSkeleton title={title} />}
    >
      {target === 'new' ? (
        <CategoryForm active={active} onSaved={onSaved} />
      ) : (
        <ExistingCategoryForm id={target} opening={opening} active={active} onSaved={onSaved} />
      )}
    </QueryBoundary>
  );
}

function ExistingCategoryForm({
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
  const { data } = useSuspenseQuery(rejectionReasonCategoryDetailOptions(id, opening));
  const [saved] = useState(() => data);
  return <CategoryForm saved={saved} active={active} onSaved={onSaved} />;
}

function CategoryFormSkeleton({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{title}</FormDialogTitle>
        <FormDialogDescription>
          {t('rejection-reason-categories.form.description')}
        </FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          <FieldSkeleton label={t('rejection-reason-categories.name')} required />
          <FieldSkeleton label={t('rejection-reason-categories.code')} required />
          <SwitchSkeleton />
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit disabled>{t('rejection-reason-categories.form.save')}</FormDialogSubmit>
      </FormDialogFooter>
    </>
  );
}
