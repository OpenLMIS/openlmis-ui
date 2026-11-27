import type { TFunction } from 'i18next';
import {
  DeleteRecordDialog,
  type DeleteRecordDialogProps,
} from '@/components/display/delete-record-dialog';
import { deleteDashboardReport } from '@/features/dashboard-reports/api/api';
import {
  dashboardReportDetailOptions,
  refreshDashboardReports,
} from '@/features/dashboard-reports/api/queries';
import type { ManagedDashboardReport } from '@/features/dashboard-reports/lib/types';

const getCopy = (t: TFunction) => ({
  deleted: t('dashboard-reports.toast.deleted'),
  deletedDescription: (name: string) => t('dashboard-reports.toast.deleted-description', { name }),
  errorTitle: t('dashboard-reports.delete.error-title'),
  noAccessTitle: t('dashboard-reports.form.no-access-title'),
  noAccess: t('dashboard-reports.form.no-access'),
  loadErrorTitle: t('dashboard-reports.load-error-title'),
  title: t('dashboard-reports.delete.title'),
  missingTitle: t('dashboard-reports.not-found-title'),
  pendingTitle: t('dashboard-reports.delete.pending-title'),
  description: (name: string) => t('dashboard-reports.delete.description', { name }),
  missingDescription: t('api-error.report.error.dashboardReport.notFound'),
  action: t('dashboard-reports.delete'),
});

export function DeleteReportDialog(props: DeleteRecordDialogProps<ManagedDashboardReport>) {
  return (
    <DeleteRecordDialog
      {...props}
      detailOptions={(id, opening) => dashboardReportDetailOptions(id, opening, 'delete')}
      getCopy={getCopy}
      refresh={refreshDashboardReports}
      removeRecord={deleteDashboardReport}
    />
  );
}
