import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { ShipmentAction } from '@/features/orders/components/shipment-footer';

export function ShipmentDialogs({
  action,
  pending,
  onClose,
  onConfirm,
  failure,
  onFailureClose,
  gone,
  onReload,
}: {
  action: ShipmentAction | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
  failure: { title: string; description: string } | null;
  onFailureClose: () => void;
  gone: boolean;
  onReload: () => void;
}) {
  const { t } = useTranslation();
  const confirmation =
    action === 'delete' || action === 'cancel' || action === 'confirm' ? action : null;
  return (
    <>
      <AlertDialog
        open={!!confirmation}
        onOpenChange={(open) => {
          if (!open && !pending) onClose();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation && t(`orders.shipment.${confirmation}`)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation && t(`orders.shipment.${confirmation}-description`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t('dialog.cancel')}</AlertDialogCancel>
            <Button
              variant={confirmation === 'confirm' ? 'default' : 'destructive'}
              disabled={pending}
              onClick={onConfirm}
            >
              {confirmation && t(`orders.shipment.${confirmation}`)}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={!!failure}
        onOpenChange={(open) => {
          if (!open) onFailureClose();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{failure?.title}</AlertDialogTitle>
            <AlertDialogDescription>{failure?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dialog.close')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={gone}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('orders.shipment.draft-gone')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('orders.shipment.draft-gone-description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button onClick={onReload}>{t('orders.shipment.reload')}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
