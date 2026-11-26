import { revalidateLogic } from '@tanstack/react-form';
import { useIsMutating, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { type RefObject, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import {
  DialogLoadError,
  DialogNotFound,
  ErrorAlert,
  FieldSkeleton,
} from '@/components/display/dialog-parts';
import { useAppForm } from '@/components/form/form';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogFooter,
  FormDialogForm,
  FormDialogHeader,
  FormDialogSubmit,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import { FieldGroup } from '@/components/ui/field';
import { createReportCategory, updateReportCategory } from '@/features/report-categories/api/api';
import {
  refreshReportCategories,
  reportCategoryDetailOptions,
} from '@/features/report-categories/api/queries';
import {
  CATEGORY_FIELD_ERRORS,
  categoryFormSchema,
} from '@/features/report-categories/lib/category-form';
import type { ReportCategory } from '@/features/report-categories/lib/types';
import { useOpening } from '@/hooks/use-opening';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { apiErrorText, fieldErrorFor } from '@/lib/api-error';
import { isNotFound, isRefused } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
import { reportApiError } from '@/lib/report-error';

const saveKey = (target: string) => [...queryKeys.reportCategories.all, 'save', target] as const;

export function CategoryFormDialog({
  target,
  onClose,
  opener,
  addButton,
}: {
  target: string | undefined;
  onClose: () => void;
  opener?: RefObject<HTMLButtonElement | null>;
  addButton?: RefObject<HTMLButtonElement | null>;
}) {
  const { shown, close, dialogProps } = useDialogTarget(target, onClose);
  const opening = useOpening(target);
  const isSaving = useIsMutating({ mutationKey: saveKey(shown ?? 'new') }) > 0;
  const saved = useRef(false);

  return (
    <FormDialog
      {...dialogProps(isSaving)}
      closeButton={!isSaving}
      finalFocus={() => {
        const trigger = opener?.current;
        const focusTarget = !saved.current && trigger?.isConnected ? trigger : addButton?.current;
        saved.current = false;
        if (opener) opener.current = null;
        return focusTarget ?? true;
      }}
    >
      {shown && (
        <CategoryDialogContent
          isSaving={isSaving}
          key={opening}
          opening={opening}
          onDone={() => {
            saved.current = true;
            close();
          }}
          target={shown}
        />
      )}
    </FormDialog>
  );
}

type CategoryFormProps = {
  isSaving: boolean;
  title: string;
  submit: string;
  onDone: () => void;
};

function CategoryDialogContent({
  target,
  opening,
  onDone,
  isSaving,
}: Pick<CategoryFormProps, 'onDone' | 'isSaving'> & { opening: number; target: string }) {
  const { t } = useTranslation();
  const isNew = target === 'new';
  const title = t(isNew ? 'report-categories.form.add-title' : 'report-categories.form.edit-title');
  const submit = t(isNew ? 'report-categories.form.add' : 'report-categories.form.save');
  const formProps = { isSaving, onDone, submit, title };
  if (isNew) return <CategoryForm {...formProps} />;

  return (
    <QueryBoundary
      errorComponent={({ error, reset }) =>
        isNotFound(error) ? (
          <DialogNotFound
            description={t('api-error.report.error.reportCategory.notFound')}
            title={t('report-categories.not-found-title')}
          />
        ) : isRefused(error) ? (
          <>
            <FormDialogHeader>
              <FormDialogTitle>{title}</FormDialogTitle>
            </FormDialogHeader>
            <ErrorAlert
              description={t('report-categories.form.no-access')}
              title={t('report-categories.form.no-access-title')}
            />
            <FormDialogFooter>
              <FormDialogCancel>{t('dialog.close')}</FormDialogCancel>
            </FormDialogFooter>
          </>
        ) : (
          <DialogLoadError
            error={error}
            errorTitle={t('report-categories.load-error-title')}
            onRetry={reset}
            title={title}
          />
        )
      }
      pendingFallback={<CategoryFormSkeleton submit={submit} title={title} />}
      resetKey={opening}
    >
      <ExistingCategory {...formProps} opening={opening} target={target} />
    </QueryBoundary>
  );
}

function ExistingCategory({
  opening,
  target,
  ...props
}: CategoryFormProps & { opening: number; target: string }) {
  const { data } = useSuspenseQuery(reportCategoryDetailOptions(target, 'edit', opening));
  return <CategoryForm {...props} category={data} />;
}

function CategoryForm({
  category,
  isSaving,
  onDone,
  submit,
  title,
}: CategoryFormProps & { category?: ReportCategory }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const save = useSessionMutation({
    mutationKey: saveKey(category?.id ?? 'new'),
    mutationFn: (name: string) =>
      category ? updateReportCategory(category.id, name) : createReportCategory(name),
    onSuccess: async (saved) => {
      await refreshReportCategories(
        queryClient,
        save.isCurrent,
        category && category.name !== saved.name ? saved : undefined,
      );
      if (!save.isCurrent()) return;
      toast.success(
        t(category ? 'report-categories.toast.saved' : 'report-categories.toast.added'),
        {
          description: t(
            category
              ? 'report-categories.toast.saved-description'
              : 'report-categories.toast.added-description',
            { name: saved.name },
          ),
        },
      );
    },
    onError: async (error) => {
      reportApiError(error);
      const refusal = fieldErrorFor(error, CATEGORY_FIELD_ERRORS);
      if (refusal) {
        form.setFieldMeta(refusal.field, (meta) => ({
          ...meta,
          errorMap: { ...meta.errorMap, onServer: refusal.key },
        }));
      }
      if (category && isNotFound(error)) await refreshReportCategories(queryClient, save.isCurrent);
    },
  });

  const form = useAppForm({
    defaultValues: { name: category?.name ?? '' },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: categoryFormSchema },
    onSubmit: ({ value }) => {
      if (queryClient.isMutating({ mutationKey: saveKey(category?.id ?? 'new') })) return;
      return save.mutateAsync(value.name.trim(), { onSuccess: onDone }).catch(() => undefined);
    },
  });

  const pending = isSaving || save.isPending;

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{title}</FormDialogTitle>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          {save.isError && !fieldErrorFor(save.error, CATEGORY_FIELD_ERRORS) && (
            <ErrorAlert
              description={apiErrorText(save.error, 'error.description', t, { write: true })}
              title={t('report-categories.form.save-error-title')}
            />
          )}
          <form.AppField
            name="name"
            listeners={{
              onChange: () => {
                if (!form.getFieldMeta('name')?.errorMap.onServer) return;
                form.setFieldMeta('name', (meta) => ({
                  ...meta,
                  errorMap: { ...meta.errorMap, onServer: undefined },
                }));
              },
            }}
          >
            {(field) => (
              <field.TextField
                autoComplete="off"
                disabled={pending}
                label={t('report-categories.name')}
                required
              />
            )}
          </form.AppField>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={pending}>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit pending={pending}>{submit}</FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}

function CategoryFormSkeleton({ title, submit }: Pick<CategoryFormProps, 'title' | 'submit'>) {
  const { t } = useTranslation();
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{title}</FormDialogTitle>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldSkeleton label={t('report-categories.name')} required />
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit disabled>{submit}</FormDialogSubmit>
      </FormDialogFooter>
    </>
  );
}
