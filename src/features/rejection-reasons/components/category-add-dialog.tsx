import { useIsMutating } from '@tanstack/react-query';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorAlert, serverMessage } from '@/components/dialog-parts';
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
import { CategoryFields } from '@/features/rejection-reasons/components/category-fields';
import {
  categorySaveKey,
  useCategoryForm,
} from '@/features/rejection-reasons/components/use-category-form';

export function CategoryAddDialog({
  target,
  onClose,
}: {
  target: 'new' | undefined;
  onClose: () => void;
}) {
  const { shown, close, dialogProps } = useDialogTarget(target, onClose);
  const pending = useIsMutating({ mutationKey: categorySaveKey }) > 0;
  return (
    <FormDialog {...dialogProps(pending)}>
      {shown && <CategoryAddForm onSaved={close} />}
    </FormDialog>
  );
}

function CategoryAddForm({ onSaved }: { onSaved: () => void }) {
  const { t } = useTranslation();
  const fields = useRef<HTMLDivElement>(null);
  const { form, save } = useCategoryForm({
    onSaved: (category) => {
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
  const disabled = save.isPending || save.isSuccess;
  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{t('rejection-reason-categories.form.create-title')}</FormDialogTitle>
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
  );
}
