import { revalidateLogic } from '@tanstack/react-form';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { ErrorAlert, serverMessage } from '@/components/display/dialog-parts';
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
import { createSupplyPartner } from '@/features/supply-partners/api/api';
import type { SupplyPartnersSearch } from '@/features/supply-partners/lib/search';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { queryKeys } from '@/lib/key-factory';
import { getSessionScope } from '@/lib/session-scope';

const SAVE_KEY = [...queryKeys.supplyPartners.all, 'create'];
const schema = z.object({
  code: z.string().trim().min(1, 'supply-partners.code-required'),
  name: z.string().trim().min(1, 'supply-partners.name-required'),
});
export function AddSupplyPartnerDialog({
  target,
  search,
  onClose,
}: {
  target: 'new' | undefined;
  search: SupplyPartnersSearch;
  onClose: () => void;
}) {
  const { shown, close, dialogProps } = useDialogTarget(target, onClose);
  const pending = useIsMutating({ mutationKey: SAVE_KEY }) > 0;
  return (
    <FormDialog {...dialogProps(pending)} closeButton={!pending}>
      {shown && <AddPartnerForm search={search} onDone={close} />}
    </FormDialog>
  );
}
function AddPartnerForm({ search, onDone }: { search: SupplyPartnersSearch; onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const mutation = useSessionMutation({
    mutationKey: SAVE_KEY,
    mutationFn: createSupplyPartner,
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.supplyPartners.all });
      onDone();
      const scope = getSessionScope();
      toast.success(t('supply-partners.created-title'), {
        description: t('supply-partners.created'),
        action: {
          label: t('supply-partners.add-associations'),
          onClick: () => {
            if (scope !== getSessionScope()) return;
            void navigate({
              to: '/administration/supply-partners/$id',
              params: { id: saved.id },
              search: { listPage: search.page, listSize: search.size },
              state: { supplyPartnersListSearch: { page: search.page, size: search.size } },
            });
          },
        },
      });
    },
  });
  const form = useAppForm({
    defaultValues: { code: '', name: '' },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) =>
      mutation
        .mutateAsync({ code: value.code.trim(), name: value.name.trim() })
        .catch(() => undefined),
  });
  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{t('supply-partners.add')}</FormDialogTitle>
        <FormDialogDescription>{t('supply-partners.create-description')}</FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          {mutation.isError && (
            <ErrorAlert
              title={t('supply-partners.save-error-title')}
              description={serverMessage(mutation.error) ?? t('supply-partners.save-error')}
            />
          )}
          <form.AppField name="code">
            {(field) => (
              <field.TextField
                label={t('supply-partners.code')}
                required
                disabled={mutation.isPending}
                autoComplete="off"
              />
            )}
          </form.AppField>
          <form.AppField name="name">
            {(field) => (
              <field.TextField
                label={t('supply-partners.name')}
                required
                disabled={mutation.isPending}
                autoComplete="off"
              />
            )}
          </form.AppField>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={mutation.isPending}>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit pending={mutation.isPending}>{t('supply-partners.add')}</FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}
