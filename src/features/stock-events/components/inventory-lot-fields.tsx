import { useTranslation } from 'react-i18next';
import { withForm } from '@/components/form/form';
export const InventoryLotFields = withForm({
  defaultValues: { productId: '', lotId: '', lotCode: '', expirationDate: '' },
  props: {} as { today: string; newLot?: boolean },
  render: function Render({ form, today, newLot }) {
    const { t } = useTranslation();
    return (
      <>
        <form.AppField name="lotCode">
          {(field) => (
            <field.TextField
              label={t(newLot ? 'physical-inventory.new-lot-code' : 'stock-events.lot-code')}
              required
              dir="auto"
            />
          )}
        </form.AppField>
        <form.AppField name="expirationDate">
          {(field) => (
            <field.DateField
              label={t('stock-events.expiry-date')}
              placeholder={t('stock-events.expiry-date')}
              earliest={today}
              clearLabel={t('stock-events.clear')}
            />
          )}
        </form.AppField>
      </>
    );
  },
});
