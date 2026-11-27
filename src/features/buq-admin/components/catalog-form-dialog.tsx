import { revalidateLogic } from '@tanstack/react-form';
import { useMutationState, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { type RefObject, useRef, useState } from 'react';
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
  FormDialogDescription,
  FormDialogFooter,
  FormDialogForm,
  FormDialogHeader,
  FormDialogSubmit,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import { FieldGroup } from '@/components/ui/field';
import { createCatalogRecord, updateCatalogRecord } from '@/features/buq-admin/api/api';
import { buqCatalogDetailOptions, refreshBuqCatalog } from '@/features/buq-admin/api/queries';
import {
  CATALOG_DESCRIPTION_MAX,
  CATALOG_FIELD_ERRORS,
  CATALOG_NAME_MAX,
  catalogFormSchema,
} from '@/features/buq-admin/lib/catalog-form';
import {
  BUQ_CATALOG_NOT_FOUND,
  BUQ_CATALOGS,
  type BuqCatalogTab,
  type BuqCatalogWrite,
} from '@/features/buq-admin/lib/types';
import type { BuqCatalogRecord } from '@/features/reference-data/lib/types';
import { useOpening } from '@/hooks/use-opening';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { apiErrorText, fieldErrorFor } from '@/lib/api-error';
import { isNotFound, isRefused } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
import { reportApiError } from '@/lib/report-error';

const saveKey = (tab: BuqCatalogTab, target: string) =>
  [...queryKeys.buq.all, 'save', BUQ_CATALOGS[tab].kind, target] as const;

export function CatalogFormDialog({
  tab,
  target,
  onClose,
  opener,
  addButton,
}: {
  tab: BuqCatalogTab;
  target: string | undefined;
  onClose: () => void;
  opener: RefObject<HTMLButtonElement | null>;
  addButton: RefObject<HTMLButtonElement | null>;
}) {
  const { shown, close, dialogProps } = useDialogTarget(target, onClose);
  const opening = useOpening(target);
  const pendingSaves = useMutationState({
    filters: { mutationKey: saveKey(tab, shown ?? 'new'), status: 'pending', exact: true },
    select: () => true,
  });
  const isSaving = pendingSaves.length > 0;
  const saved = useRef(false);

  return (
    <FormDialog
      {...dialogProps(isSaving)}
      closeButton={!isSaving}
      finalFocus={() => {
        const trigger = opener.current;
        const focusTarget = !saved.current && trigger?.isConnected ? trigger : addButton.current;
        saved.current = false;
        opener.current = null;
        return focusTarget ?? true;
      }}
    >
      {shown && (
        <CatalogDialogContent
          isSaving={isSaving}
          key={opening}
          opening={opening}
          onDone={() => {
            saved.current = true;
            close();
          }}
          tab={tab}
          target={shown}
        />
      )}
    </FormDialog>
  );
}

type CatalogFormProps = {
  tab: BuqCatalogTab;
  isSaving: boolean;
  title: string;
  submit: string;
  onDone: () => void;
};

function CatalogDialogContent({
  tab,
  target,
  opening,
  onDone,
  isSaving,
}: Pick<CatalogFormProps, 'tab' | 'onDone' | 'isSaving'> & { opening: number; target: string }) {
  const { t } = useTranslation();
  const isNew = target === 'new';
  const kind = BUQ_CATALOGS[tab].kind;
  const title = t(`manage-buq.form.${isNew ? 'add' : 'edit'}-${kind}`);
  const submit = t(isNew ? 'manage-buq.form.add' : 'manage-buq.form.save');
  const formProps = { tab, isSaving, onDone, submit, title };
  const [savingAtOpen] = useState(isSaving);
  const [reread, setReread] = useState(false);
  if (savingAtOpen && !isSaving && !reread) setReread(true);
  if (isNew) return <CatalogForm {...formProps} />;

  return (
    <QueryBoundary
      errorComponent={({ error, reset }) =>
        isNotFound(error) ? (
          <DialogNotFound
            description={t(BUQ_CATALOG_NOT_FOUND[tab])}
            title={t('manage-buq.not-found-title')}
          />
        ) : isRefused(error) ? (
          <>
            <FormDialogHeader>
              <FormDialogTitle>{title}</FormDialogTitle>
            </FormDialogHeader>
            <ErrorAlert
              description={t('manage-buq.form.no-access')}
              title={t('manage-buq.form.no-access-title')}
            />
            <FormDialogFooter>
              <FormDialogCancel>{t('dialog.close')}</FormDialogCancel>
            </FormDialogFooter>
          </>
        ) : (
          <DialogLoadError
            error={error}
            errorTitle={t('manage-buq.load-error-title')}
            onRetry={reset}
            title={title}
          />
        )
      }
      pendingFallback={<CatalogFormSkeleton isSaving={isSaving} submit={submit} title={title} />}
      resetKey={`${opening}-${reread}`}
    >
      <ExistingCatalogRecord {...formProps} opening={opening} reread={reread} target={target} />
    </QueryBoundary>
  );
}

function ExistingCatalogRecord({
  opening,
  reread,
  target,
  ...props
}: CatalogFormProps & { opening: number; reread: boolean; target: string }) {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(buqCatalogDetailOptions(props.tab, target, opening, reread));
  if (data.editable === false) {
    return (
      <>
        <FormDialogHeader>
          <FormDialogTitle>{t('manage-buq.read-only-title')}</FormDialogTitle>
          <FormDialogDescription>{t('manage-buq.read-only-description')}</FormDialogDescription>
        </FormDialogHeader>
        <FormDialogFooter>
          <FormDialogCancel>{t('dialog.close')}</FormDialogCancel>
        </FormDialogFooter>
      </>
    );
  }
  return <CatalogForm {...props} record={data} key={String(reread)} />;
}

function CatalogForm({
  tab,
  record,
  isSaving,
  onDone,
  submit,
  title,
}: CatalogFormProps & { record?: BuqCatalogRecord }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const mutationKey = saveKey(tab, record?.id ?? 'new');
  const save = useSessionMutation({
    mutationKey,
    mutationFn: (body: BuqCatalogWrite) =>
      record ? updateCatalogRecord(tab, record.id, body) : createCatalogRecord(tab, body),
    onSuccess: async (saved) => {
      await refreshBuqCatalog(queryClient, tab, save.isCurrent);
      if (!save.isCurrent()) return;
      const kind = BUQ_CATALOGS[tab].kind;
      const verb = record ? 'saved' : 'added';
      toast.success(t(`manage-buq.toast.${verb}-${kind}`), {
        description: t(`manage-buq.toast.${verb}-${kind}-description`, { name: saved.name }),
      });
    },
    onError: async (error) => {
      reportApiError(error);
      const refusal = fieldErrorFor(error, CATALOG_FIELD_ERRORS);
      if (refusal) {
        form.setFieldMeta(refusal.field, (meta) => ({
          ...meta,
          errorMap: { ...meta.errorMap, onServer: refusal.key },
        }));
      }
      if (record && isNotFound(error)) {
        await refreshBuqCatalog(queryClient, tab, save.isCurrent);
        if (!save.isCurrent()) return;
        toast.error(t('manage-buq.not-found-title'), {
          description: t(BUQ_CATALOG_NOT_FOUND[tab]),
        });
      }
    },
  });

  const form = useAppForm({
    defaultValues: { name: record?.name ?? '', description: record?.description ?? '' },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: catalogFormSchema },
    onSubmit: ({ value }) => {
      if (queryClient.isMutating({ mutationKey, exact: true })) return;
      return save
        .mutateAsync(
          { name: value.name.trim(), description: value.description.trim() || null },
          {
            onSuccess: onDone,
            onError: (error) => {
              if (record && save.isCurrent() && isNotFound(error)) onDone();
            },
          },
        )
        .catch(() => undefined);
    },
  });

  const pending = isSaving || save.isPending;
  const showError =
    save.isError &&
    !(record && isNotFound(save.error)) &&
    !fieldErrorFor(save.error, CATALOG_FIELD_ERRORS);

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{title}</FormDialogTitle>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          {showError && (
            <ErrorAlert
              description={apiErrorText(save.error, 'error.description', t, { write: true })}
              title={t('manage-buq.form.save-error-title')}
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
                label={t('manage-buq.form.name')}
                maxLength={CATALOG_NAME_MAX}
                required
              />
            )}
          </form.AppField>
          <form.AppField name="description">
            {(field) => (
              <field.TextareaField
                disabled={pending}
                label={t('manage-buq.form.description')}
                maxLength={CATALOG_DESCRIPTION_MAX}
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

function CatalogFormSkeleton({
  isSaving,
  title,
  submit,
}: Pick<CatalogFormProps, 'isSaving' | 'title' | 'submit'>) {
  const { t } = useTranslation();
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{title}</FormDialogTitle>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          <FieldSkeleton label={t('manage-buq.form.name')} required />
          <FieldSkeleton control="textarea" label={t('manage-buq.form.description')} />
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={isSaving}>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit disabled>{submit}</FormDialogSubmit>
      </FormDialogFooter>
    </>
  );
}
