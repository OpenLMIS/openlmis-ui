import { revalidateLogic } from '@tanstack/react-form';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { DialogLoadError, FieldSkeleton } from '@/components/dialog-parts';
import { formatDateValue } from '@/components/form/date-value';
import { useAppForm } from '@/components/form/form';
import {
  FormMessagesProvider,
  useAboutLabel,
  useDateMessages,
  useFormatError,
} from '@/components/form/form-messages';
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
import {
  deviceNewLotsOptions,
  type ReceiveDevice,
  receiveLotsOptions,
} from '@/features/stock-events/api/queries';
import type { EventLine } from '@/features/stock-events/lib/event-form';
import { editLotSchema } from '@/features/stock-events/lib/new-lot';
import type { NewLot } from '@/features/stock-events/lib/types';
import { conflictingDeviceLot } from '@/lib/lot-code';

type EditLotDialogProps = {
  device: ReceiveDevice;
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
  device,
}: Omit<EditLotDialogProps, 'open' | 'onOpenChange'> & { onDone: () => boolean }) {
  const { t, i18n } = useTranslation();
  const formatError = useFormatError();
  const dateMessages = useDateMessages();
  const aboutLabel = useAboutLabel();
  const queryClient = useQueryClient();
  const { data: lots } = useSuspenseQuery(
    receiveLotsOptions(queryClient, [lot.tradeItemId], device),
  );
  const deviceLots = useQuery(deviceNewLotsOptions()).data;
  const form = useAppForm({
    defaultValues: { lotCode: lot.lotCode, expirationDate: lot.expirationDate ?? '' },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: editLotSchema({ lot, lineKey, lots, lines, today, deviceLots }) },
    onSubmit: ({ value }) => {
      if (!onDone()) return;
      onSave({ lotCode: value.lotCode, expirationDate: value.expirationDate || null });
    },
  });
  const lotError = (message: string) => {
    if (message !== 'stock-events.lot-code-queued') return formatError(message);
    const values = form.state.values;
    const queuedLot = conflictingDeviceLot(
      deviceLots ?? [],
      lot.tradeItemId,
      values.lotCode,
      values.expirationDate,
    );
    return t('stock-events.lot-code-queued', {
      expiry: queuedLot?.expirationDate
        ? formatDateValue(queuedLot.expirationDate, i18n.language)
        : t('stock-events.no-expiry'),
    });
  };
  return (
    <FormMessagesProvider {...dateMessages} aboutLabel={aboutLabel} formatError={lotError}>
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
    </FormMessagesProvider>
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
