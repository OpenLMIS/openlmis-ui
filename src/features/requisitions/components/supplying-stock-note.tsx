import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
export function SupplyingStockNote({ record }: { record: RequisitionRecord }) {
  const { t } = useTranslation();
  const unavailable = record.requisitionLineItems.every(
    (line) => line.supplyingFacilityStockOnHand == null,
  );
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        {t('requisitions.requisition.supplying-facility')}{' '}
        <bdi>
          {record.supplyingFacilities?.map((f) => f.name ?? f.id).join(', ') ||
            t('requisitions.requisition.supplier-not-configured')}
        </bdi>
        {record.supplyingFacilities?.length && unavailable
          ? ` (${t('requisitions.requisition.stock-unavailable')})`
          : null}
      </p>
      {record.supplyingFacilityAccessDenied && (
        <Alert variant="warning">
          <AlertDescription>
            {t('requisitions.requisition.supplier-access-denied')}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
