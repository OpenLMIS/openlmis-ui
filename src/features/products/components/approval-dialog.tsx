import { revalidateLogic } from '@tanstack/react-form';
import {
  useIsMutating,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  DialogLoadError,
  DialogNotFound,
  ErrorAlert,
  FieldSkeleton,
  SkeletonLine,
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
import { ApprovalRemovedError, addApproval, saveApprovalStock } from '@/features/products/api/api';
import { approvalDetailOptions, productApprovalsOptions } from '@/features/products/api/queries';
import {
  type ApprovalFormValues,
  approvalFormSchema,
  EMPTY_APPROVAL_FORM,
  toApprovalFormValues,
  toApprovalStock,
} from '@/features/products/lib/approval-form';
import type { Approval, ProductDetail } from '@/features/products/lib/types';
import { facilityTypesOptions, programsOptions } from '@/features/reference-data/api/queries';
import { facilityTypeName } from '@/features/reference-data/lib/facility-types';
import { productName } from '@/features/reference-data/lib/product-name';
import { programName } from '@/features/reference-data/lib/programs';
import { useOpening } from '@/hooks/use-opening';
import { decimalMark } from '@/lib/decimal';
import { isNotFound } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';

const saveKey = (productId: string) =>
  [...queryKeys.facilityTypeApprovedProducts.all, 'save', productId] as const;

type ApprovalDialogProps = {
  product: ProductDetail;
  target: string | undefined;
  readOnly: boolean;
  onClose: () => void;
};

export function ApprovalDialog({ product, target, readOnly, onClose }: ApprovalDialogProps) {
  const { shown, close, dialogProps } = useDialogTarget(target, onClose);
  const isSaving = useIsMutating({ mutationKey: saveKey(product.id) }) > 0;

  return (
    <FormDialog {...dialogProps(isSaving)}>
      {shown && (
        <ApprovalContent onDone={close} product={product} readOnly={readOnly} target={shown} />
      )}
    </FormDialog>
  );
}

type ApprovalContentProps = Omit<ApprovalDialogProps, 'target' | 'onClose'> & {
  target: string;
  onDone: () => void;
};

function ApprovalContent({ product, target, readOnly, onDone }: ApprovalContentProps) {
  const { t } = useTranslation();
  const isNew = target === 'new';
  const title = t(isNew ? 'products.approvals.form.add-title' : 'products.approvals.facility-type');
  const opening = useOpening();

  return (
    <QueryBoundary
      errorComponent={({ error, reset }) =>
        isNotFound(error) ? (
          <DialogNotFound description={t('products.approvals.form.not-found')} title={title} />
        ) : (
          <DialogLoadError
            error={error}
            errorTitle={t('products.approvals.form.load-error-title')}
            onRetry={reset}
            title={title}
          />
        )
      }
      pendingFallback={<ApprovalSkeleton adding={isNew} readOnly={readOnly} title={title} />}
      resetKey={target}
    >
      {isNew ? (
        <ApprovalForm onDone={onDone} product={product} readOnly={readOnly} />
      ) : (
        <ExistingApproval
          approvalId={target}
          key={target}
          onDone={onDone}
          opening={opening}
          product={product}
          readOnly={readOnly}
        />
      )}
    </QueryBoundary>
  );
}

type ExistingApprovalProps = Omit<ApprovalFormProps, 'approval'> & {
  approvalId: string;
  opening: number;
};

function ExistingApproval({ approvalId, opening, ...props }: ExistingApprovalProps) {
  const { data: approval } = useSuspenseQuery(approvalDetailOptions(approvalId, opening));
  return <ApprovalForm approval={approval} {...props} />;
}

type ApprovalFormProps = {
  product: ProductDetail;
  approval?: Approval;
  readOnly: boolean;
  onDone: () => void;
};

function ApprovalForm({ product, approval, readOnly, onDone }: ApprovalFormProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { data: facilityTypes } = useSuspenseQuery(facilityTypesOptions());
  const { data: programs } = useSuspenseQuery(programsOptions());
  const { data: approved } = useSuspenseQuery(productApprovalsOptions(product.id));
  const productLabel = productName(product);
  const schema = useMemo(() => approvalFormSchema(approved, approval?.id), [approved, approval]);

  const facilityTypeItems = useMemo(
    () =>
      facilityTypes
        .map((type) => ({ value: type.id, label: facilityTypeName(type) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [facilityTypes],
  );
  const programItems = useMemo(() => {
    const linked = new Set(product.programs.map((link) => link.programId));
    const items = programs
      .filter((program) => linked.has(program.id))
      .map((program) => ({ value: program.id, label: programName(program) }));
    if (approval && !items.some((item) => item.value === approval.program.id)) {
      items.push({
        value: approval.program.id,
        label: programName(approval.program),
      });
    }
    return items.sort((a, b) => a.label.localeCompare(b.label));
  }, [programs, product.programs, approval]);

  const names = (values: ApprovalFormValues) => ({
    facilityType:
      facilityTypeItems.find((item) => item.value === values.facilityTypeId)?.label ?? '',
    program: programItems.find((item) => item.value === values.programId)?.label ?? '',
  });

  const save = useMutation({
    mutationKey: saveKey(product.id),
    mutationFn: (values: ApprovalFormValues) => {
      const stock = toApprovalStock(values);
      if (approval) return saveApprovalStock(approval.id, stock);
      const facilityType = facilityTypes.find((type) => type.id === values.facilityTypeId);
      const program = programs.find((item) => item.id === values.programId);
      if (!facilityType || !program) throw new Error('Unknown facility type or program');
      return addApproval({ orderableId: product.id, facilityType, program, stock });
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: productApprovalsOptions(product.id).queryKey }),
  });

  const form = useAppForm({
    defaultValues: approval
      ? toApprovalFormValues(approval, decimalMark(i18n.language))
      : EMPTY_APPROVAL_FORM,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) =>
      save
        .mutateAsync(value, {
          onSuccess: () => {
            const params = { ...names(value), product: productLabel };
            toast.success(
              t(
                approval
                  ? 'products.approvals.form.saved-title'
                  : 'products.approvals.form.added-title',
              ),
              {
                description: t(
                  approval ? 'products.approvals.form.saved' : 'products.approvals.form.added',
                  params,
                ),
              },
            );
            onDone();
          },
        })
        .catch(() => undefined),
  });

  const shown = approval && {
    facilityType: facilityTypeName(approval.facilityType),
    program: programName(approval.program),
  };
  const title = !approval
    ? t('products.approvals.form.add-title')
    : readOnly
      ? (shown?.facilityType ?? '')
      : t('products.approvals.form.edit-title', { facilityType: shown?.facilityType });

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{title}</FormDialogTitle>
        <FormDialogDescription>
          {approval
            ? t('products.approvals.form.edit-description', {
                product: productLabel,
                facilityType: shown?.facilityType,
                program: shown?.program,
              })
            : t('products.approvals.form.add-description', { product: productLabel })}
        </FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          {save.isError && (
            <ErrorAlert
              description={
                save.error instanceof ApprovalRemovedError
                  ? t('products.approvals.form.not-found')
                  : (serverMessage(save.error) ?? t('products.form.save-error'))
              }
              title={t('products.approvals.form.save-error-title')}
            />
          )}
          <form.AppField name="facilityTypeId">
            {(field) => (
              <field.ComboboxField
                clearLabel={t('products.approvals.form.facility-type-clear')}
                description={
                  approval && !readOnly ? t('products.approvals.form.locked') : undefined
                }
                disabled={Boolean(approval)}
                emptyMessage={t('products.approvals.form.facility-type-empty')}
                items={facilityTypeItems}
                label={t('products.approvals.facility-type')}
                placeholder={t('products.approvals.form.facility-type-placeholder')}
                required
              />
            )}
          </form.AppField>
          <form.AppField name="programId">
            {(field) => (
              <field.ComboboxField
                clearLabel={t('products.approvals.form.program-clear')}
                description={
                  approval ? undefined : t('products.approvals.form.program-description')
                }
                disabled={Boolean(approval)}
                emptyMessage={t('products.approvals.form.program-empty')}
                items={programItems}
                label={t('products.approvals.program')}
                placeholder={t('products.approvals.form.program-placeholder')}
                required
              />
            )}
          </form.AppField>
          <form.AppField name="maxPeriodsOfStock">
            {(field) => (
              <field.DecimalField
                description={t('products.approvals.form.max-periods-description')}
                disabled={readOnly}
                label={t('products.approvals.max-periods')}
                required
              />
            )}
          </form.AppField>
          <div className="grid gap-5 @md/field-group:grid-cols-2">
            <form.AppField name="emergencyOrderPoint">
              {(field) => (
                <field.DecimalField
                  description={t('products.approvals.form.emergency-point-description')}
                  disabled={readOnly}
                  label={t('products.approvals.emergency-point')}
                />
              )}
            </form.AppField>
            <form.AppField name="minPeriodsOfStock">
              {(field) => (
                <field.DecimalField
                  description={t('products.approvals.form.min-periods-description')}
                  disabled={readOnly}
                  label={t('products.approvals.min-periods')}
                />
              )}
            </form.AppField>
          </div>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={save.isPending}>
          {t(readOnly ? 'dialog.close' : 'dialog.cancel')}
        </FormDialogCancel>
        {!readOnly && (
          <FormDialogSubmit pending={save.isPending}>
            {t(approval ? 'products.approvals.form.save' : 'products.approvals.form.add')}
          </FormDialogSubmit>
        )}
      </FormDialogFooter>
    </FormDialogForm>
  );
}

type ApprovalSkeletonProps = { title: string; adding: boolean; readOnly: boolean };

function ApprovalSkeleton({ title, adding, readOnly }: ApprovalSkeletonProps) {
  const { t } = useTranslation();
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{title}</FormDialogTitle>
        <SkeletonLine width="medium" />
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          <FieldSkeleton label={t('products.approvals.facility-type')} required />
          <FieldSkeleton label={t('products.approvals.program')} required />
          <FieldSkeleton label={t('products.approvals.max-periods')} required />
          <div className="grid gap-5 @md/field-group:grid-cols-2">
            <FieldSkeleton label={t('products.approvals.emergency-point')} />
            <FieldSkeleton label={t('products.approvals.min-periods')} />
          </div>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t(readOnly ? 'dialog.close' : 'dialog.cancel')}</FormDialogCancel>
        {!readOnly && (
          <FormDialogSubmit disabled>
            {t(adding ? 'products.approvals.form.add' : 'products.approvals.form.save')}
          </FormDialogSubmit>
        )}
      </FormDialogFooter>
    </>
  );
}
