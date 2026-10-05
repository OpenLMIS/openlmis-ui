import { revalidateLogic } from '@tanstack/react-form';
import { useIsMutating, useSuspenseQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  DialogLoadError,
  DialogNotFound,
  ErrorAlert,
  FieldSkeleton,
  SkeletonLine,
  SwitchSkeleton,
  serverMessage,
} from '@/components/dialog-parts';
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
import { QueryBoundary } from '@/components/query-boundary';
import { FieldGroup } from '@/components/ui/field';
import { productSaveKey, useProductSave } from '@/features/products/hooks/use-product-save';
import {
  EMPTY_PROGRAM_LINK_FORM,
  programLinkFormSchema,
  toProgramLinkFormValues,
  unlinkedPrograms,
  withProgramLink,
} from '@/features/products/lib/program-link-form';
import type { ProductDetail, ProgramLink } from '@/features/products/lib/types';
import {
  orderableDisplayCategoriesOptions,
  programsOptions,
} from '@/features/reference-data/api/queries';
import { productName } from '@/features/reference-data/lib/product-name';
import { programName } from '@/features/reference-data/lib/programs';
import { decimalMark } from '@/lib/decimal';

type ProgramLinkDialogProps = {
  product: ProductDetail;
  target: string | undefined;
  readOnly: boolean;
  onClose: () => void;
};

export function ProgramLinkDialog({ product, target, readOnly, onClose }: ProgramLinkDialogProps) {
  const { shown, dialogProps } = useDialogTarget(target, onClose);
  const isSaving = useIsMutating({ mutationKey: productSaveKey(product.id) }) > 0;

  return (
    <FormDialog {...dialogProps(isSaving)}>
      {shown && (
        <ProgramLinkContent onDone={onClose} product={product} readOnly={readOnly} target={shown} />
      )}
    </FormDialog>
  );
}

type ProgramLinkContentProps = Omit<ProgramLinkDialogProps, 'target' | 'onClose'> & {
  target: string;
  onDone: () => void;
};

function ProgramLinkContent({ product, target, readOnly, onDone }: ProgramLinkContentProps) {
  const { t } = useTranslation();
  const isNew = target === 'new';
  const link = product.programs.find((item) => item.programId === target);
  const fallbackTitle = t(isNew ? 'products.programs.form.add-title' : 'products.programs.program');

  if (!isNew && !link) {
    return (
      <DialogNotFound
        description={t('products.programs.form.not-found')}
        title={t('products.programs.program')}
      />
    );
  }

  return (
    <QueryBoundary
      errorComponent={({ error, reset }) => (
        <DialogLoadError
          error={error}
          errorTitle={t('products.programs.form.load-error-title')}
          onRetry={reset}
          title={fallbackTitle}
        />
      )}
      pendingFallback={
        <ProgramLinkSkeleton adding={isNew} readOnly={readOnly} title={fallbackTitle} />
      }
      resetKey={target}
    >
      <ProgramLinkForm link={link} onDone={onDone} product={product} readOnly={readOnly} />
    </QueryBoundary>
  );
}

type ProgramLinkFormProps = {
  product: ProductDetail;
  link: ProgramLink | undefined;
  readOnly: boolean;
  onDone: () => void;
};

function ProgramLinkForm({ product, link, readOnly, onDone }: ProgramLinkFormProps) {
  const { t, i18n } = useTranslation();
  const { data: programs } = useSuspenseQuery(programsOptions());
  const { data: categories } = useSuspenseQuery(orderableDisplayCategoriesOptions());
  const save = useProductSave(product.id);
  const productLabel = productName(product);
  const program = link && programs.find((item) => item.id === link.programId);
  const linkedName = program ? programName(program) : link?.programId;

  const [productAtOpen] = useState(product);
  const programItems = useMemo(
    () =>
      unlinkedPrograms(programs, productAtOpen)
        .map((item) => ({ value: item.id, label: programName(item) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [programs, productAtOpen],
  );
  const categoryItems = useMemo(
    () => categories.map((category) => ({ value: category.id, label: category.displayName })),
    [categories],
  );

  const form = useAppForm({
    defaultValues: link
      ? toProgramLinkFormValues(link, decimalMark(i18n.language))
      : EMPTY_PROGRAM_LINK_FORM,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: programLinkFormSchema() },
    onSubmit: ({ value }) =>
      save
        .mutateAsync((latest) => withProgramLink(latest, value), {
          onSuccess: () => {
            const added = programs.find((item) => item.id === value.programId);
            const name = added ? programName(added) : (linkedName ?? '');
            toast.success(
              t(link ? 'products.programs.form.saved-title' : 'products.programs.form.added-title'),
              {
                description: t(
                  link ? 'products.programs.form.saved' : 'products.programs.form.added',
                  { product: productLabel, program: name },
                ),
              },
            );
            onDone();
          },
        })
        .catch(() => undefined),
  });

  const title = !link
    ? t('products.programs.form.add-title')
    : readOnly
      ? (linkedName ?? '')
      : t('products.programs.form.edit-title', { program: linkedName });

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{title}</FormDialogTitle>
        <FormDialogDescription>
          {t(
            !link
              ? 'products.programs.form.add-description'
              : readOnly
                ? 'products.programs.form.view-description'
                : 'products.programs.form.edit-description',
            { product: productLabel },
          )}
        </FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          {save.isError && (
            <ErrorAlert
              description={serverMessage(save.error) ?? t('products.form.save-error')}
              title={t('products.programs.form.save-error-title')}
            />
          )}
          {!link && (
            <form.AppField name="programId">
              {(field) => (
                <field.ComboboxField
                  clearLabel={t('products.programs.form.program-clear')}
                  emptyMessage={t('products.programs.form.program-empty')}
                  items={programItems}
                  label={t('products.programs.program')}
                  placeholder={t('products.programs.form.program-placeholder')}
                  required
                />
              )}
            </form.AppField>
          )}
          <form.AppField name="orderableDisplayCategoryId">
            {(field) => (
              <field.ComboboxField
                clearLabel={t('products.programs.form.category-clear')}
                description={t('products.programs.form.category-description')}
                disabled={readOnly}
                emptyMessage={t('products.programs.form.category-empty')}
                items={categoryItems}
                label={t('products.programs.form.category')}
                placeholder={t('products.programs.form.category-placeholder')}
                required
              />
            )}
          </form.AppField>
          <div className="grid gap-5 @md/field-group:grid-cols-2">
            <form.AppField name="dosesPerPatient">
              {(field) => (
                <field.NumberField
                  disabled={readOnly}
                  label={t('products.programs.form.doses-per-patient')}
                />
              )}
            </form.AppField>
            <form.AppField name="displayOrder">
              {(field) => (
                <field.NumberField
                  description={t('products.programs.form.display-order-description')}
                  disabled={readOnly}
                  label={t('products.programs.form.display-order')}
                />
              )}
            </form.AppField>
          </div>
          <form.AppField name="pricePerPack">
            {(field) => (
              <field.DecimalField disabled={readOnly} label={t('products.programs.price')} />
            )}
          </form.AppField>
          <form.AppField name="fullSupply">
            {(field) => (
              <field.SwitchField
                description={t('products.programs.form.full-supply-description')}
                disabled={readOnly}
                label={t('products.programs.full-supply')}
              />
            )}
          </form.AppField>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={save.isPending}>
          {t(readOnly ? 'dialog.close' : 'dialog.cancel')}
        </FormDialogCancel>
        {!readOnly && (
          <FormDialogSubmit pending={save.isPending}>
            {t(link ? 'products.programs.form.save' : 'products.programs.form.add')}
          </FormDialogSubmit>
        )}
      </FormDialogFooter>
    </FormDialogForm>
  );
}

type ProgramLinkSkeletonProps = { title: string; adding: boolean; readOnly: boolean };

function ProgramLinkSkeleton({ title, adding, readOnly }: ProgramLinkSkeletonProps) {
  const { t } = useTranslation();
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{title}</FormDialogTitle>
        <SkeletonLine width="medium" />
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          {adding && <FieldSkeleton label={t('products.programs.program')} required />}
          <FieldSkeleton label={t('products.programs.form.category')} required />
          <div className="grid gap-5 @md/field-group:grid-cols-2">
            <FieldSkeleton label={t('products.programs.form.doses-per-patient')} />
            <FieldSkeleton label={t('products.programs.form.display-order')} />
          </div>
          <FieldSkeleton label={t('products.programs.price')} />
          <SwitchSkeleton />
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t(readOnly ? 'dialog.close' : 'dialog.cancel')}</FormDialogCancel>
        {!readOnly && (
          <FormDialogSubmit disabled>
            {t(adding ? 'products.programs.form.add' : 'products.programs.form.save')}
          </FormDialogSubmit>
        )}
      </FormDialogFooter>
    </>
  );
}
