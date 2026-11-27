import type { TFunction } from 'i18next';
import {
  DeleteRecordDialog,
  type DeleteRecordDialogProps,
} from '@/components/display/delete-record-dialog';
import { deleteReportCategory } from '@/features/report-categories/api/api';
import {
  refreshReportCategories,
  reportCategoryDetailOptions,
} from '@/features/report-categories/api/queries';
import type { ReportCategory } from '@/features/report-categories/lib/types';

const getCopy = (t: TFunction) => ({
  deleted: t('report-categories.toast.deleted'),
  deletedDescription: (name: string) => t('report-categories.toast.deleted-description', { name }),
  errorTitle: t('report-categories.delete.error-title'),
  noAccessTitle: t('report-categories.form.no-access-title'),
  noAccess: t('report-categories.form.no-access'),
  loadErrorTitle: t('report-categories.load-error-title'),
  title: t('report-categories.delete.title'),
  missingTitle: t('report-categories.not-found-title'),
  pendingTitle: t('report-categories.delete.pending-title'),
  description: (name: string) => t('report-categories.delete.description', { name }),
  missingDescription: t('api-error.report.error.reportCategory.notFound'),
  action: t('report-categories.delete'),
});

export function DeleteCategoryDialog(props: DeleteRecordDialogProps<ReportCategory>) {
  return (
    <DeleteRecordDialog
      {...props}
      detailOptions={(id, opening) => reportCategoryDetailOptions(id, 'delete', opening)}
      getCopy={getCopy}
      refresh={refreshReportCategories}
      removeRecord={deleteReportCategory}
    />
  );
}
