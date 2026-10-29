import { createColumnHelper, useTable } from '@tanstack/react-table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTableEmpty,
  type DataTableFeatures,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DialogTable } from '@/components/display/dialog-table';
import { CellText } from '@/components/display/table-cards';
import { formatTimestamp } from '@/components/form/date-value';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogHeader,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { messageAuthor, StatusBadge } from '@/features/requisitions/components/status-message';
import type { RequisitionStatusMessage } from '@/features/requisitions/lib/types';
import { useDialogCardLayout } from '@/hooks/use-card-view';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';

type HistoryRow = {
  status: RequisitionStatusMessage['status'];
  author: string;
  date: string;
  comment: string;
};
const helper = createColumnHelper<DataTableFeatures, HistoryRow>();

export function RequisitionHistoryDialog({
  messages,
  open,
  onClose,
}: {
  messages: readonly RequisitionStatusMessage[];
  open: boolean;
  onClose: () => void;
}) {
  return (
    <FormDialog
      open={open}
      size="xl"
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <HistoryContent messages={messages} />
    </FormDialog>
  );
}

function HistoryContent({ messages }: { messages: readonly RequisitionStatusMessage[] }) {
  const { t, i18n } = useTranslation();
  const timeZone = useDeploymentTimeZone();
  const { measure, cards } = useDialogCardLayout('xl');
  const data = useMemo(
    () =>
      messages.map((message) => ({
        status: message.status,
        author: messageAuthor(message),
        date: formatTimestamp(message.createdDate, i18n.language, { time: true, timeZone }),
        comment: message.body ?? '',
      })),
    [messages, i18n.language, timeZone],
  );
  const table = useTable({
    features: dataTableFeatures,
    columns: helper.columns([
      helper.accessor('status', {
        header: t('requisitions.requisition.status'),
        meta: { label: t('requisitions.requisition.status') },
        cell: ({ getValue }) => <StatusBadge status={getValue()} />,
      }),
      helper.accessor('author', {
        header: t('requisitions.requisition.history-author'),
        meta: { label: t('requisitions.requisition.history-author') },
        cell: ({ getValue }) =>
          getValue() ? <CellText overflow="nowrap">{getValue()}</CellText> : null,
      }),
      helper.accessor('date', {
        header: t('requisitions.requisition.history-date'),
        meta: { label: t('requisitions.requisition.history-date') },
        cell: ({ getValue }) => <CellText overflow="nowrap">{getValue()}</CellText>,
      }),
      helper.accessor('comment', {
        header: t('requisitions.requisition.history-comment'),
        meta: { label: t('requisitions.requisition.history-comment') },
        cell: ({ getValue }) =>
          getValue() ? (
            <span className="whitespace-pre-wrap break-words" dir="auto">
              {getValue()}
            </span>
          ) : null,
      }),
    ]),
    data,
  });
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4" ref={measure}>
      <FormDialogHeader>
        <FormDialogTitle>{t('requisitions.requisition.history')}</FormDialogTitle>
        <FormDialogDescription>
          {t('requisitions.requisition.history-description')}
        </FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <DialogTable
          table={table}
          cards={cards}
          title="status"
          density="compact"
          layout="auto"
          empty={<DataTableEmpty title={t('requisitions.requisition.no-comments')} />}
        />
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.close')}</FormDialogCancel>
      </FormDialogFooter>
    </div>
  );
}
