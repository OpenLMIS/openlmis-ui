import { useTranslation } from 'react-i18next';
import { formatTimestamp } from '@/components/form/date-value';
import {
  FormDialog,
  FormDialogBody,
  FormDialogHeader,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import type { RequisitionStatusMessage } from '@/features/requisitions/lib/types';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { REQUISITION_STATUS } from '@/lib/requisition-status';

export function StatusMessage({ message }: { message: RequisitionStatusMessage }) {
  const { t, i18n } = useTranslation();
  const timeZone = useDeploymentTimeZone();
  const author = [message.authorFirstName, message.authorLastName].filter(Boolean).join(' ');
  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted-foreground text-sm">
        {t(REQUISITION_STATUS[message.status].labelKey)}
        {author && (
          <>
            {' '}
            - <bdi>{author}</bdi>
          </>
        )}{' '}
        {t('requisitions.requisition.on')}{' '}
        {formatTimestamp(message.createdDate, i18n.language, { time: true, timeZone })}
      </p>
      {message.body && (
        <p className="whitespace-pre-wrap break-words text-sm">
          <bdi>{message.body}</bdi>
        </p>
      )}
    </div>
  );
}
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
      </FormDialogHeader>
      <FormDialogBody>
        <div className="flex flex-col gap-4">
          {messages.length ? (
            messages.map((message, index) => (
              <StatusMessage key={message.id ?? index} message={message} />
            ))
          ) : (
            <p>{t('requisitions.requisition.no-comments')}</p>
          )}
        </div>
      </FormDialogBody>
    </FormDialog>
  );
}
