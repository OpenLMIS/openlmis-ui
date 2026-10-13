import { revalidateLogic } from '@tanstack/react-form';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { DialogLoadError, FieldSkeleton } from '@/components/dialog-parts';
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
import { lotsByTradeItemsOptions } from '@/features/reference-data/api/queries';
import type { EventLine } from '@/features/stock-events/lib/event-form';
import { editLotSchema } from '@/features/stock-events/lib/new-lot';
import type { NewLot } from '@/features/stock-events/lib/types';

type EditLotDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lot: NewLot;
  lineKey: string;
  product: string;
  lines: readonly Pick<EventLine, 'key' | 'lot'>[];
  today: string;
  onSave: (lot: Pick<NewLot, 'lotCode' | 'expirationDate'>) => void;
};

export function EditLotDialog({ open, onOpenChange, ...props }: EditLotDialogProps) {
  const { t } = useTranslation();
  const title = t('stock-events.edit-lot-title');
  const { shown, close, dialogProps } = useDialogTarget(open ? props.lineKey : undefined, () =>
    onOpenChange(false),
  );
  return (
    <FormDialog {...dialogProps()}>
      {shown && (
        <QueryBoundary
          resetKey={props.lot.tradeItemId}
          pendingFallback={<EditLotSkeleton title={title} />}
          errorComponent={({ error, reset }) => (
            <DialogLoadError
              error={error}
              errorTitle={t('stock-events.lots-error-title')}
              onRetry={reset}
              title={title}
            />
          )}
        >
          <EditLotForm {...props} onDone={close} />
        </QueryBoundary>
      )}
    </FormDialog>
  );
}

function EditLotForm({
  lot,
  lineKey,
  product,
  lines,
  today,
  onSave,
  onDone,
}: Omit<EditLotDialogProps, 'open' | 'onOpenChange'> & { onDone: () => boolean }) {
  const { t } = useTranslation();
  const { data: lots } = useSuspenseQuery(lotsByTradeItemsOptions([lot.tradeItemId]));
  const form = useAppForm({
    defaultValues: { lotCode: lot.lotCode, expirationDate: lot.expirationDate ?? '' },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: editLotSchema({ lot, lineKey, lots, lines, today }) },
    onSubmit: ({ value }) => {
      if (!onDone()) return;
      onSave({ lotCode: value.lotCode, expirationDate: value.expirationDate || null });
    },
  });
  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{t('stock-events.edit-lot-title')}</FormDialogTitle>
        <FormDialogDescription>
          {t('stock-events.edit-lot-description', { product })}
        </FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          <form.AppField name="lotCode">
            {(field) => <field.TextField dir="ltr" label={t('stock-events.lot-code')} required />}
          </form.AppField>
          <form.AppField name="expirationDate">
            {(field) => (
              <field.DateField
                clearLabel={t('stock-events.clear-expiration-date')}
                earliest={today}
                label={t('stock-events.expiration-date')}
                placeholder={t('stock-events.pick-date')}
              />
            )}
          </form.AppField>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('stock-events.cancel')}</FormDialogCancel>
        <FormDialogSubmit>{t('stock-events.save')}</FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}

function EditLotSkeleton({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{title}</FormDialogTitle>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          <FieldSkeleton label={t('stock-events.lot-code')} required />
          <FieldSkeleton label={t('stock-events.expiration-date')} />
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('stock-events.cancel')}</FormDialogCancel>
      </FormDialogFooter>
    </>
  );
}
