import { createFileRoute } from '@tanstack/react-router';
import { StampIcon } from 'lucide-react';
import { useState } from 'react';
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
import { BuqUnavailable } from '@/features/buq/components/buq-unavailable';
import {
  NationalApproval,
  NationalApprovalSkeleton,
} from '@/features/buq/components/national-approval';
import { type NationalSearch, nationalSearchSchema } from '@/features/buq/lib/search';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { loadNationalAccess } from '@/routes/-buq-access';

export const Route = createFileRoute('/(protected)/_protected/buq/national-approval')({
  preload: false,
  validateSearch: nationalSearchSchema,
  loaderDeps: ({ search: { zone, period } }) => ({ zone, period }),
  loader: ({ context: { queryClient }, deps, cause }) =>
    loadNationalAccess(queryClient, deps, cause),
  pendingComponent: NationalPending,
  component: NationalPage,
});

function NationalHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <StampIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('buq.national.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('buq.national.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function NationalPage() {
  const { t } = useTranslation();
  const access = Route.useLoaderData();
  const search = Route.useSearch();
  const { updateSearch } = useSearchNavigation<NationalSearch>({});
  const [selectionSlot, setSelectionSlot] = useState<HTMLElement | null>(null);
  return (
    <>
      <Workspace width="wide">
        <NationalHeader />
        <WorkspaceContent>
          {access.kind === 'ready' ? (
            <NationalApproval
              selectionSlot={selectionSlot}
              onSearchChange={updateSearch}
              programId={access.programId}
              search={search}
            />
          ) : (
            <BuqUnavailable kind={access.kind} title={t('buq.national.unavailable-title')} />
          )}
        </WorkspaceContent>
      </Workspace>
      <div className="contents" ref={setSelectionSlot} />
    </>
  );
}

function NationalPending() {
  const search = Route.useSearch();
  return (
    <Workspace width="wide">
      <NationalHeader />
      <WorkspaceContent>
        <NationalApprovalSkeleton search={search} />
      </WorkspaceContent>
    </Workspace>
  );
}
