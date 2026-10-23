import { revalidateLogic } from '@tanstack/react-form';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import { FieldGroup } from '@/components/ui/field';
import type { LotSummary } from '@/features/reference-data/lib/types';
import type { EventLine } from '@/features/stock-events/lib/event-form';
import { type NewLotValues, newLotSchema } from '@/features/stock-events/lib/new-lot';
import type { NewLot } from '@/features/stock-events/lib/types';
import { conflictingDeviceLot } from '@/lib/lot-code';

type NewLotDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus: () => HTMLElement | null;
  product: string;
  tradeItemId: string;
  lots: readonly LotSummary[];
  lines: readonly Pick<EventLine, 'key' | 'lot'>[];
  deviceLots?: readonly NewLot[];
  today: string;
  values: NewLotValues;
  check: boolean;
  onAdd: (values: NewLotValues) => void;
};

export function NewLotDialog({ open, onOpenChange, returnFocus, ...props }: NewLotDialogProps) {
  const { shown, close, dialogProps } = useDialogTarget(open ? props.tradeItemId : undefined, () =>
    onOpenChange(false),
  );
  return (
    <FormDialog {...dialogProps()} finalFocus={returnFocus}>
      {shown && <NewLotForm {...props} onDone={close} />}
    </FormDialog>
  );
}

function NewLotForm({
  product,
  tradeItemId,
  lots,
  lines,
  deviceLots = [],
  today,
  values,
  check,
  onAdd,
  onDone,
}: Omit<NewLotDialogProps, 'open' | 'onOpenChange' | 'returnFocus'> & { onDone: () => boolean }) {
  const { t, i18n } = useTranslation();
  const formatError = useFormatError();
  const dateMessages = useDateMessages();
  const aboutLabel = useAboutLabel();
  const form = useAppForm({
    defaultValues: values,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: newLotSchema({ tradeItemId, lots, lines, today, deviceLots }) },
    onSubmit: ({ value }) => {
      if (!onDone()) return;
      onAdd(value);
    },
  });
  useEffect(() => {
    if (check) void form.handleSubmit();
  }, [check, form]);
  const lotError = (message: string) => {
    if (message !== 'stock-events.lot-code-queued') return formatError(message);
    const current = form.state.values;
    const queued = conflictingDeviceLot(
      deviceLots,
      tradeItemId,
      current.lotCode,
      current.expirationDate,
    );
    return t('stock-events.lot-code-queued', {
      expiry: formatDateValue(queued?.expirationDate ?? '', i18n.language),
    });
  };
  return (
    <FormMessagesProvider {...dateMessages} aboutLabel={aboutLabel} formatError={lotError}>
      <FormDialogForm onSubmit={form.handleSubmit}>
        <FormDialogHeader>
          <FormDialogTitle>{t('stock-events.add-new-lot')}</FormDialogTitle>
          <FormDialogDescription>
            {t('stock-events.add-new-lot-description', { product })}
          </FormDialogDescription>
        </FormDialogHeader>
        <FormDialogBody>
          <FieldGroup>
            <form.AppField name="lotCode">
              {(field) => (
                <field.TextField dir="ltr" label={t('stock-events.new-lot-code')} required />
              )}
            </form.AppField>
            <form.AppField name="expirationDate">
              {(field) => (
                <field.DateField
                  clearLabel={t('stock-events.clear-expiry-date')}
                  earliest={today}
                  label={t('stock-events.expiry-date')}
                  placeholder={t('stock-events.pick-date')}
                />
              )}
            </form.AppField>
          </FieldGroup>
        </FormDialogBody>
        <FormDialogFooter>
          <FormDialogCancel>{t('stock-events.cancel')}</FormDialogCancel>
          <FormDialogSubmit>{t('stock-events.add')}</FormDialogSubmit>
        </FormDialogFooter>
      </FormDialogForm>
    </FormMessagesProvider>
  );
}
