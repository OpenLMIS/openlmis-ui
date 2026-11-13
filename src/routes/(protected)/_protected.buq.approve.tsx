import { createFileRoute } from '@tanstack/react-router';
import { ClipboardCheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import { ApproveBuq, ApproveBuqSkeleton } from '@/features/buq/components/approve-buq';
import { BuqUnavailable } from '@/features/buq/components/buq-unavailable';
import { type BuqListSearch, buqListSearchSchema } from '@/features/buq/lib/search';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { loadApproveAccess } from '@/routes/-buq-access';

export const Route = createFileRoute('/(protected)/_protected/buq/approve')({
  preload: false,
  validateSearch: buqListSearchSchema,
  loader: ({ context: { queryClient }, cause }) => loadApproveAccess(queryClient, cause),
  pendingComponent: ApprovePending,
  component: ApprovePage,
});

function ApproveHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <ClipboardCheckIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('buq.approve.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('buq.approve.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function ApprovePage() {
  const { t } = useTranslation();
  const access = Route.useLoaderData();
  const search = Route.useSearch();
  const { updateSearch } = useSearchNavigation<BuqListSearch>({});
  return (
    <Workspace>
      <ApproveHeader />
      <WorkspaceContent>
        {access.kind === 'ready' ? (
          <ApproveBuq onSearchChange={updateSearch} programId={access.programId} search={search} />
        ) : (
          <BuqUnavailable kind={access.kind} title={t('buq.approve.unavailable-title')} />
        )}
      </WorkspaceContent>
    </Workspace>
  );
}

function ApprovePending() {
  const search = Route.useSearch();
  return (
    <Workspace>
      <ApproveHeader />
      <WorkspaceContent>
        <ApproveBuqSkeleton search={search} />
      </WorkspaceContent>
    </Workspace>
  );
}
