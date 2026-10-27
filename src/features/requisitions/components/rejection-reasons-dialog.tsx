import { useTranslation } from 'react-i18next';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogHeader,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { StatusMessage } from '@/features/requisitions/components/requisition-history-dialog';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';

export function latestRejection(record: RequisitionRecord) {
  return record.statusHistory
    ?.filter((entry) => entry.status === 'REJECTED')
    .toSorted((a, b) => b.createdDate.localeCompare(a.createdDate))[0];
}

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
  const rejection = latestRejection(record);
  return (
    <FormDialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <FormDialogHeader>
        <FormDialogTitle>{t('requisitions.requisition.rejection')}</FormDialogTitle>
        <FormDialogDescription>
          {t('requisitions.requisition.rejection-description')}
        </FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <div className="flex flex-col gap-3">
          {rejection && (
            <StatusMessage
              message={
                rejection.statusMessageDto ?? {
                  status: rejection.status,
                  createdDate: rejection.createdDate,
                }
              }
            />
          )}
          {rejection?.rejectionDtos?.length ? (
            <ol className="flex list-decimal flex-col gap-2 ps-6">
              {rejection.rejectionDtos.map(({ id, rejectionReason: reason }) => (
                <li key={id}>
                  <bdi>{reason.name}</bdi>
                </li>
              ))}
            </ol>
          ) : (
            <p>{t('requisitions.requisition.no-rejection-reasons')}</p>
          )}
        </div>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.close')}</FormDialogCancel>
      </FormDialogFooter>
    </FormDialog>
  );
}
