import { useQueries } from '@tanstack/react-query';
import { createColumnHelper, useTable } from '@tanstack/react-table';
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
import { userRecordOptions } from '@/features/reference-data/api/queries';
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
      <HistoryContent messages={messages} open={open} />
    </FormDialog>
  );
}

function HistoryContent({
  messages,
  open,
}: {
  messages: readonly RequisitionStatusMessage[];
  open: boolean;
}) {
  const { t, i18n } = useTranslation();
  const timeZone = useDeploymentTimeZone();
  const authorIds = [
    ...new Set(
      messages.flatMap((message) =>
        message.authorId && !messageAuthor(message) ? [message.authorId] : [],
      ),
    ),
  ];
  const authors = useQueries({
    queries: authorIds.map((id) => ({ ...userRecordOptions(id), enabled: open })),
  });
  const authorNames = authors.map(({ data }) =>
    data ? [data.firstName, data.lastName].filter(Boolean).join(' ') : '',
  );
  const { measure, cards } = useDialogCardLayout('xl');
  const data = messages.map((message) => ({
    status: message.status,
    author:
      messageAuthor(message) ||
      (message.authorId ? authorNames[authorIds.indexOf(message.authorId)] : '') ||
      '',
    date: formatTimestamp(message.createdDate, i18n.language, { time: true, timeZone }),
    comment: message.body ?? '',
  }));
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
