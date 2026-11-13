import { createFileRoute } from '@tanstack/react-router';
import { CalculatorIcon } from 'lucide-react';
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
import { RIGHTS } from '@/features/auth/lib/rights';
import { BuqUnavailable } from '@/features/buq/components/buq-unavailable';
import { PrepareBuq, PrepareBuqSkeleton } from '@/features/buq/components/prepare-buq';
import { type BuqListSearch, buqListSearchSchema } from '@/features/buq/lib/search';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { loadBuqAccess } from '@/routes/-buq-access';

const PREPARE_RIGHTS = [RIGHTS.prepareBuq];

export const Route = createFileRoute('/(protected)/_protected/buq/prepare')({
  preload: false,
  validateSearch: buqListSearchSchema,
  loader: ({ context: { queryClient }, cause }) =>
    loadBuqAccess(queryClient, PREPARE_RIGHTS, cause, { activeSupport: true }),
  pendingComponent: PrepareBuqPending,
  component: PrepareBuqPage,
});

function PrepareBuqHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <CalculatorIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('buq.prepare.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('buq.prepare.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function PrepareBuqPage() {
  const { t } = useTranslation();
  const access = Route.useLoaderData();
  const search = Route.useSearch();
  const { updateSearch } = useSearchNavigation<BuqListSearch>({});
  return (
    <Workspace>
      <PrepareBuqHeader />
      <WorkspaceContent>
        {access.kind === 'ready' ? (
          <PrepareBuq
            facility={access.facility}
            onSearchChange={updateSearch}
            program={access.program}
            search={search}
          />
        ) : (
          <BuqUnavailable kind={access.kind} title={t('buq.prepare.unavailable-title')} />
        )}
      </WorkspaceContent>
    </Workspace>
  );
}

function PrepareBuqPending() {
  const search = Route.useSearch();
  return (
    <Workspace>
      <PrepareBuqHeader />
      <WorkspaceContent>
        <PrepareBuqSkeleton search={search} />
      </WorkspaceContent>
    </Workspace>
  );
}
