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
import { StatusMessage } from '@/features/requisitions/components/status-message';
import type { RequisitionStatusMessage } from '@/features/requisitions/lib/types';

export function RequisitionHistoryDialog({
  messages,
  open,
  onClose,
}: {
  messages: readonly RequisitionStatusMessage[];
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <FormDialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <FormDialogHeader>
        <FormDialogTitle>{t('requisitions.requisition.history')}</FormDialogTitle>
        <FormDialogDescription>
          {t('requisitions.requisition.history-description')}
        </FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        {messages.length ? (
          <ol className="flex flex-col gap-3">
            {messages.map((message, index) => (
              <li key={message.id ?? index}>
                <StatusMessage message={message} />
              </li>
            ))}
          </ol>
        ) : (
          <p>{t('requisitions.requisition.no-comments')}</p>
        )}
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.close')}</FormDialogCancel>
      </FormDialogFooter>
    </FormDialog>
  );
}
