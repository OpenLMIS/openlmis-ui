import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
export function SupplyingStockNote({ record }: { record: RequisitionRecord }) {
  const { t, i18n } = useTranslation();
  if (record.supplyingFacilityAccessDenied)
    return (
      <Alert variant="warning">
        <AlertDescription>{t('requisitions.requisition.supplier-access-denied')}</AlertDescription>
      </Alert>
    );
  const unavailable = record.requisitionLineItems.every(
    (line) => line.supplyingFacilityStockOnHand == null,
  );
  const facilities = record.supplyingFacilities?.length
    ? new Intl.ListFormat(i18n.language).format(
        record.supplyingFacilities.map((facility) => facility.name ?? facility.id),
      )
    : t('requisitions.requisition.supplier-not-configured');
  return (
    <p className="text-sm">
      {t(
        record.supplyingFacilities?.length && unavailable
          ? 'requisitions.requisition.supplying-facility-unavailable'
          : 'requisitions.requisition.supplying-facility',
        { facilities },
      )}
    </p>
  );
}
