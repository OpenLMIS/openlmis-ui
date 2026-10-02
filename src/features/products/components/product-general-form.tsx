import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2Icon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  ErrorAlert,
  FieldSkeleton,
  SwitchSkeleton,
  serverMessage,
} from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { useAppForm } from '@/components/form/form';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { WorkspaceFooterPortal } from '@/components/workspace-tabs';
import { updateProduct } from '@/features/products/api/api';
import { productDetailOptions } from '@/features/products/api/queries';
import { ProductFormFields } from '@/features/products/components/product-form-fields';
import {
  hasProductChanges,
  isDuplicateCode,
  needsDispensingUnit,
  type ProductFormValues,
  productFormSchema,
  toProductFormValues,
  toProductUpdateBody,
} from '@/features/products/lib/product-form';
import type { ProductDetail } from '@/features/products/lib/types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { queryKeys } from '@/lib/key-factory';

const FORM_ID = 'product-general-form';

type ProductGeneralFormProps = {
  product: ProductDetail;
  readOnly: boolean;
  onDone: () => void;
};

export function ProductGeneralForm({ product, readOnly, onDone }: ProductGeneralFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [refusedCodes, setRefusedCodes] = useState<string[]>([]);
  const unitNeeded = needsDispensingUnit(product);
  const schema = useMemo(
    () => productFormSchema(refusedCodes, { needsDispensingUnit: unitNeeded }),
    [refusedCodes, unitNeeded],
  );
  const leaving = useRef(false);

  const save = useMutation({
    mutationFn: (values: ProductFormValues) =>
      updateProduct(product.id, toProductUpdateBody(values, product)),
    onSuccess: (saved) => {
      queryClient.setQueryData(productDetailOptions(product.id).queryKey, saved);
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.orderables.all, 'list'] });
      toast.success(t('products.edit.saved-title'), {
        description: t('products.edit.saved', {
          product: saved.fullProductName || saved.productCode,
        }),
      });
    },
    onError: (error, values) => {
      if (isDuplicateCode(error)) setRefusedCodes((codes) => [...codes, values.productCode]);
    },
  });
  const codeRefused = isDuplicateCode(save.error);

  const form = useAppForm({
    defaultValues: toProductFormValues(product),
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) =>
      save
        .mutateAsync(value, {
          onSuccess: () => {
            if (hasProductChanges(form.state.values, toProductUpdateBody(value, product))) return;
            leaving.current = true;
            if (!guard.leaveIfAsked()) onDone();
          },
        })
        .catch(() => undefined),
  });

  useEffect(() => {
    if (refusedCodes.length > 0) void form.validate('change');
  }, [refusedCodes, form]);

  const changed = useStore(form.store, (state) => hasProductChanges(state.values, product));
  const guard = useDiscardGuard(changed, { allowLeave: () => leaving.current });

  return (
    <>
      <form
        className="max-w-xl"
        id={FORM_ID}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (changed) void form.handleSubmit();
        }}
      >
        <FieldGroup>
          {save.isError && !codeRefused && (
            <ErrorAlert
              description={serverMessage(save.error) ?? t('products.form.save-error')}
              title={t('products.form.save-error-title')}
            />
          )}
          <ProductFormFields disabled={readOnly} form={form} needsDispensingUnit={unitNeeded} />
        </FieldGroup>
      </form>
      <WorkspaceFooterPortal width="default">
        <Button disabled={save.isPending} onClick={onDone} size="lg" variant="outline">
          {t(readOnly ? 'products.edit.back' : 'products.edit.cancel')}
        </Button>
        {!readOnly && (
          <Button disabled={!changed || save.isPending} form={FORM_ID} size="lg" type="submit">
            {save.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
            {t('products.edit.save')}
          </Button>
        )}
      </WorkspaceFooterPortal>
      <DiscardChangesDialog
        description={t('products.edit.discard-description')}
        {...guard.dialog}
      />
    </>
  );
}

export function ProductGeneralFormSkeleton() {
  const { t } = useTranslation();

  return (
    <div aria-busy className="max-w-xl">
      <FieldGroup>
        <FieldSkeleton label={t('products.form.code')} required />
        <FieldSkeleton label={t('products.form.name')} />
        <FieldSkeleton label={t('products.form.description')} />
        <FieldSkeleton label={t('products.form.dispensing-unit')} required />
        <div className="grid gap-5 sm:grid-cols-2">
          <FieldSkeleton label={t('products.form.net-content')} required />
          <FieldSkeleton label={t('products.form.pack-rounding-threshold')} required />
        </div>
        <SwitchSkeleton />
      </FieldGroup>
    </div>
  );
}
