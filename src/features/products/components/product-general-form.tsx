import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2Icon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorAlert, serverMessage } from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { useAppForm } from '@/components/form/form';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { WorkspaceFooterPortal } from '@/components/workspace-tabs';
import { saveProductChange } from '@/features/products/api/api';
import { productDetailOptions } from '@/features/products/api/queries';
import { ProductFormFields } from '@/features/products/components/product-form-fields';
import { productSaveKey } from '@/features/products/hooks/use-product-save';
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
import { productName } from '@/features/reference-data/lib/product-name';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useSessionMutation } from '@/hooks/use-session-mutation';
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
    () => productFormSchema(refusedCodes, { unitRequired: unitNeeded }),
    [refusedCodes, unitNeeded],
  );
  const leaving = useRef(false);

  const save = useSessionMutation({
    mutationKey: productSaveKey(product.id),
    mutationFn: (values: ProductFormValues) =>
      saveProductChange(product.id, (latest) => toProductUpdateBody(values, latest)),
    onSuccess: (saved) => {
      queryClient.setQueryData(productDetailOptions(product.id).queryKey, saved);
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.orderables.all, 'list'] });
      toast.success(t('products.edit.saved-title'), {
        description: t('products.edit.saved', {
          product: productName(saved),
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
          onSuccess: (saved) => {
            if (hasProductChanges(form.state.values, saved)) return;
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
          <ProductFormFields
            disabled={readOnly}
            form={form}
            sizeCode={product.dispensable.sizeCode}
          />
        </FieldGroup>
      </form>
      <WorkspaceFooterPortal width="default">
        <Button
          disabled={save.isPending}
          focusableWhenDisabled={save.isPending}
          onClick={onDone}
          size="lg"
          variant="outline"
        >
          {t(readOnly ? 'products.edit.back' : 'products.edit.cancel')}
        </Button>
        {!readOnly && (
          <Button
            disabled={!changed || save.isPending}
            focusableWhenDisabled={save.isPending}
            form={FORM_ID}
            size="lg"
            type="submit"
          >
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
