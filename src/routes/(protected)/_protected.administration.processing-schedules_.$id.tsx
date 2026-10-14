import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  Workspace,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceTitle,
} from '@/components/workspace';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { periodsSearchSchema, toListSearch } from '@/features/processing-schedules/lib/search';

export const Route = createFileRoute(
  '/(protected)/_protected/administration/processing-schedules_/$id',
)({
  validateSearch: periodsSearchSchema,
  loader: async ({ context: { queryClient } }) => {
    await requireRight(queryClient, RIGHTS.processingSchedulesManage);
  },
  staticData: {
    crumbKey: 'processing-schedules.periods.crumb',
    crumbParentSearch: toListSearch,
  },
  component: PeriodsPage,
});

function PeriodsPage() {
  const { t } = useTranslation();

  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceTitle>{t('processing-schedules.periods.title')}</WorkspaceTitle>
          <WorkspaceDescription>
            {t('processing-schedules.periods.page-description')}
          </WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
    </Workspace>
  );
}
