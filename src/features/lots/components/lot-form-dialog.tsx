import { revalidateLogic } from '@tanstack/react-form';
import { useIsMutating, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
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
import { updateLot } from '@/features/lots/api/api';
import { lotDetailOptions } from '@/features/lots/api/queries';
import {
  isDuplicateLotCode,
  type LotFormValues,
  lotFormSchema,
  toLotBody,
  toLotFormValues,
} from '@/features/lots/lib/lot-form';
import type { Lot } from '@/features/lots/lib/types';
import { orderablesByTradeItemsOptions } from '@/features/reference-data/api/queries';
import { productName } from '@/features/reference-data/lib/product-name';
import { useOpening } from '@/hooks/use-opening';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { isNotFound, isOfflineError } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';

const saveKey = (id: string) => [...queryKeys.lots.all, 'save', id] as const;

type LotFormDialogProps = {
  target: string | undefined;
  onClose: () => void;
};

export function LotFormDialog({ target, onClose }: LotFormDialogProps) {
  const { shown, close, dialogProps } = useDialogTarget(target, onClose);
  const isSaving = useIsMutating({ mutationKey: saveKey(shown ?? '') }) > 0;

  return (
    <FormDialog {...dialogProps(isSaving)}>
      {shown && <LotDialogContent lotId={shown} onDone={close} />}
    </FormDialog>
  );
}

function LotDialogContent({ lotId, onDone }: { lotId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const title = t('lots.form.title');
  const opening = useOpening();

  return (
    <QueryBoundary
      errorComponent={({ error, reset }) =>
        isNotFound(error) ? (
          <DialogNotFound description={t('lots.form.not-found')} title={title} />
        ) : (
          <DialogLoadError
            error={error}
            errorTitle={t('lots.form.load-error-title')}
            onRetry={reset}
            title={title}
          />
        )
      }
      pendingFallback={<LotFormSkeleton />}
      resetKey={lotId}
    >
      <ExistingLot key={lotId} lotId={lotId} onDone={onDone} opening={opening} />
    </QueryBoundary>
  );
}

type ExistingLotProps = { lotId: string; opening: number; onDone: () => void };

function ExistingLot({ lotId, opening, onDone }: ExistingLotProps) {
  const { data: lot } = useSuspenseQuery(lotDetailOptions(lotId, opening));
  return <LotForm lot={lot} onDone={onDone} />;
}

function LotProduct({ tradeItemId }: { tradeItemId: string }) {
  const { t } = useTranslation();
  const { data, isPending, isError, error } = useQuery(
    orderablesByTradeItemsOptions([tradeItemId]),
  );
  if (isPending) return <SkeletonLine width="medium" />;
  const product = data?.[0];
  return (
    <FormDialogDescription>
      {isError
        ? t(isOfflineError(error) ? 'offline.notice-title' : 'lots.form.product-error')
        : product
          ? t('lots.form.product', { product: productName(product), code: product.productCode })
          : t('lots.form.no-product')}
    </FormDialogDescription>
  );
}

function LotForm({ lot, onDone }: { lot: Lot; onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [refused, setRefused] = useState<string[]>([]);
  const schema = useMemo(() => lotFormSchema(refused), [refused]);

  const save = useSessionMutation({
    mutationKey: saveKey(lot.id),
    mutationFn: (values: LotFormValues) => updateLot(toLotBody(values, lot)),
    onSuccess: (saved) => {
      toast.success(t('lots.form.saved-title'), {
        description: t('lots.form.saved', { lot: saved.lotCode }),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.lots.all,
        predicate: (query) => query.queryKey[1] !== 'detail',
      });
    },
    onError: (error, values) => {
      if (isDuplicateLotCode(error)) setRefused((taken) => [...taken, values.lotCode]);
    },
  });

  const form = useAppForm({
    defaultValues: toLotFormValues(lot),
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) => save.mutateAsync(value, { onSuccess: onDone }).catch(() => undefined),
  });

  useEffect(() => {
    if (refused.length > 0) void form.validate('change');
  }, [refused, form]);

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{t('lots.form.title')}</FormDialogTitle>
        <LotProduct tradeItemId={lot.tradeItemId} />
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          {save.isError && !isDuplicateLotCode(save.error) && (
            <ErrorAlert
              description={serverMessage(save.error) ?? t('lots.form.save-error')}
              title={t('lots.form.save-error-title')}
            />
          )}
          <form.AppField name="lotCode">
            {(field) => (
              <field.TextField autoComplete="off" dir="ltr" label={t('lots.lot-code')} required />
            )}
          </form.AppField>
          <form.AppField name="expirationDate">
            {(field) => (
              <field.DateField
                clearLabel={t('lots.form.clear-expiration-date')}
                label={t('lots.expiration-date')}
                placeholder={t('lots.form.pick-date')}
              />
            )}
          </form.AppField>
          <form.AppField name="manufactureDate">
            {(field) => (
              <field.DateField
                clearLabel={t('lots.form.clear-manufacture-date')}
                label={t('lots.manufacture-date')}
                placeholder={t('lots.form.pick-date')}
              />
            )}
          </form.AppField>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={save.isPending}>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit pending={save.isPending}>{t('lots.form.save')}</FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}

function LotFormSkeleton() {
  const { t } = useTranslation();
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{t('lots.form.title')}</FormDialogTitle>
        <SkeletonLine width="medium" />
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          <FieldSkeleton label={t('lots.lot-code')} required />
          <FieldSkeleton label={t('lots.expiration-date')} />
          <FieldSkeleton label={t('lots.manufacture-date')} />
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit disabled>{t('lots.form.save')}</FormDialogSubmit>
      </FormDialogFooter>
    </>
  );
}
