import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { WorkspaceFooter } from '@/components/workspace/workspace';

export type ShipmentAction = 'delete' | 'cancel' | 'save' | 'print' | 'confirm';
export function ShipmentFooter({
  canEdit,
  canCancel,
  canPrint,
  hasDraft,
  hasLines,
  pending,
  onAction,
}: {
  canEdit: boolean;
  canCancel: boolean;
  canPrint: boolean;
  hasDraft: boolean;
  hasLines: boolean;
  pending: boolean;
  onAction: (action: ShipmentAction) => void;
}) {
  const { t } = useTranslation();
  if (!canEdit && !canCancel) return null;
  return (
    <WorkspaceFooter width="wide">
      <div className="flex flex-wrap gap-2">
        {canEdit && hasDraft && (
          <Button
            size="lg"
            variant="destructive"
            disabled={pending}
            onClick={() => onAction('delete')}
          >
            {t('orders.shipment.delete')}
          </Button>
        )}
        {canCancel && (
          <Button
            size="lg"
            variant="destructive-outline"
            disabled={pending}
            onClick={() => onAction('cancel')}
          >
            {t('orders.shipment.cancel')}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {canEdit && hasDraft && (
          <Button size="lg" variant="outline" disabled={pending} onClick={() => onAction('save')}>
            {t('orders.shipment.save')}
          </Button>
        )}
        {canPrint && hasDraft && (
          <Button size="lg" variant="outline" disabled={pending} onClick={() => onAction('print')}>
            {t('orders.shipment.print')}
          </Button>
        )}
        {canEdit && hasDraft && hasLines && (
          <Button size="lg" disabled={pending} onClick={() => onAction('confirm')}>
            {t('orders.shipment.confirm')}
          </Button>
        )}
      </div>
    </WorkspaceFooter>
  );
}
