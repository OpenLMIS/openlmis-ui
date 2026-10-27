import { useTranslation } from 'react-i18next';
import {
  FormDialog,
  FormDialogBody,
  FormDialogHeader,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';

export function RejectionReasonsDialog({
  record,
  open,
  onClose,
}: {
  record: RequisitionRecord;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const rejection = record.statusHistory
    ?.filter((entry) => entry.status === 'REJECTED')
    .toSorted((a, b) => b.createdDate.localeCompare(a.createdDate))[0];
  return (
    <FormDialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <FormDialogHeader>
        <FormDialogTitle>{t('requisitions.requisition.rejection')}</FormDialogTitle>
      </FormDialogHeader>
      <FormDialogBody>
        <div className="flex flex-col gap-3">
          {rejection?.rejections?.length ? (
            rejection.rejections.map(({ id, rejectionReason: reason }) => (
              <p key={id}>
                {reason.rejectionReasonCategory?.name && (
                  <>{reason.rejectionReasonCategory.name}: </>
                )}
                {reason.name}
              </p>
            ))
          ) : (
            <p>{t('requisitions.requisition.no-rejection-reasons')}</p>
          )}
        </div>
      </FormDialogBody>
    </FormDialog>
  );
}
