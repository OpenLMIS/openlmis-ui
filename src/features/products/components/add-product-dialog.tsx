import { revalidateLogic } from '@tanstack/react-form';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
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
import { FieldGroup } from '@/components/ui/field';
import { createProduct } from '@/features/products/api/api';
import { ProductFormFields } from '@/features/products/components/product-form-fields';
import {
  EMPTY_PRODUCT_FORM,
  isDuplicateCode,
  type ProductFormValues,
  productFormSchema,
  toCreateProductBody,
} from '@/features/products/lib/product-form';
import { productName } from '@/features/reference-data/lib/product-name';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { queryKeys } from '@/lib/key-factory';

const SAVE_KEY = [...queryKeys.orderables.all, 'create'] as const;

type AddProductDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (productId: string) => void;
};

export function AddProductDialog({ open, onClose, onCreated }: AddProductDialogProps) {
  const { shown, dialogProps } = useDialogTarget(open || undefined, onClose);
  const isSaving = useIsMutating({ mutationKey: SAVE_KEY }) > 0;

  return (
    <FormDialog {...dialogProps(isSaving)}>
      {shown && <AddProductForm onCreated={onCreated} />}
    </FormDialog>
  );
}

function AddProductForm({ onCreated }: Pick<AddProductDialogProps, 'onCreated'>) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [refusedCodes, setRefusedCodes] = useState<string[]>([]);
  const schema = useMemo(() => productFormSchema(refusedCodes), [refusedCodes]);

  const save = useSessionMutation({
    mutationKey: SAVE_KEY,
    mutationFn: (values: ProductFormValues) => createProduct(toCreateProductBody(values)),
    onSuccess: (product) => {
      toast.success(t('products.form.created-title'), {
        description: t('products.form.created', {
          product: productName(product),
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
    onSubmit: ({ value }) =>
      save
        .mutateAsync(value, { onSuccess: (product) => onCreated(product.id) })
        .catch(() => undefined),
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
          <ProductFormFields form={form} />
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={save.isPending}>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit pending={save.isPending}>{t('products.form.create')}</FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}
