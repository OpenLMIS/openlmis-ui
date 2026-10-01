import { revalidateLogic } from '@tanstack/react-form';
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorAlert, serverMessage } from '@/components/dialog-parts';
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
import { FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field';
import { createProduct } from '@/features/products/api/api';
import {
  EMPTY_PRODUCT_FORM,
  isDuplicateCode,
  type ProductFormValues,
  productFormSchema,
  toCreateProductBody,
} from '@/features/products/lib/product-form';
import { queryKeys } from '@/lib/key-factory';

const SAVE_KEY = [...queryKeys.orderables.all, 'create'] as const;

type AddProductDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function AddProductDialog({ open, onClose }: AddProductDialogProps) {
  const { shown, dialogProps } = useDialogTarget(open || undefined, onClose);
  const isSaving = useIsMutating({ mutationKey: SAVE_KEY }) > 0;

  return (
    <FormDialog {...dialogProps(isSaving)}>
      {shown && <AddProductForm onDone={onClose} />}
    </FormDialog>
  );
}

function AddProductForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [refusedCodes, setRefusedCodes] = useState<string[]>([]);
  const schema = useMemo(() => productFormSchema(refusedCodes), [refusedCodes]);

  const save = useMutation({
    mutationKey: SAVE_KEY,
    mutationFn: (values: ProductFormValues) => createProduct(toCreateProductBody(values)),
    onSuccess: (product) => {
      toast.success(t('products.form.created-title'), {
        description: t('products.form.created', {
          product: product.fullProductName || product.productCode,
        }),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.orderables.all });
    },
    onError: (error, values) => {
      if (isDuplicateCode(error)) setRefusedCodes((codes) => [...codes, values.productCode]);
    },
  });
  const codeRefused = isDuplicateCode(save.error);

  const form = useAppForm({
    defaultValues: EMPTY_PRODUCT_FORM,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) => save.mutateAsync(value, { onSuccess: onDone }).catch(() => undefined),
  });

  useEffect(() => {
    if (refusedCodes.length > 0) void form.validate('change');
  }, [refusedCodes, form]);

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{t('products.form.create-title')}</FormDialogTitle>
        <FormDialogDescription>{t('products.form.create-description')}</FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          {save.isError && !codeRefused && (
            <ErrorAlert
              description={serverMessage(save.error) ?? t('products.form.save-error')}
              title={t('products.form.save-error-title')}
            />
          )}
          <form.AppField name="productCode">
            {(field) => (
              <field.TextField
                autoComplete="off"
                dir="ltr"
                label={t('products.form.code')}
                required
              />
            )}
          </form.AppField>
          <form.AppField name="fullProductName">
            {(field) => <field.TextField autoComplete="off" label={t('products.form.name')} />}
          </form.AppField>
          <form.AppField name="description">
            {(field) => <field.TextareaField label={t('products.form.description')} />}
          </form.AppField>
          <FieldSet>
            <FieldLegend>{t('products.form.pack-size')}</FieldLegend>
            <FieldGroup>
              <form.AppField name="dispensingUnit">
                {(field) => (
                  <field.TextField
                    autoComplete="off"
                    description={t('products.form.dispensing-unit-description')}
                    label={t('products.form.dispensing-unit')}
                    required
                  />
                )}
              </form.AppField>
              <div className="grid gap-5 sm:grid-cols-2">
                <form.AppField name="netContent">
                  {(field) => (
                    <field.NumberField
                      description={t('products.form.net-content-description')}
                      label={t('products.form.net-content')}
                      required
                    />
                  )}
                </form.AppField>
                <form.AppField name="packRoundingThreshold">
                  {(field) => (
                    <field.NumberField
                      description={t('products.form.pack-rounding-threshold-description')}
                      label={t('products.form.pack-rounding-threshold')}
                      required
                    />
                  )}
                </form.AppField>
              </div>
              <form.AppField name="roundToZero">
                {(field) => (
                  <field.SwitchField
                    description={t('products.form.round-to-zero-description')}
                    label={t('products.form.round-to-zero')}
                  />
                )}
              </form.AppField>
            </FieldGroup>
          </FieldSet>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={save.isPending}>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit pending={save.isPending}>{t('products.form.create')}</FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}
