import { createFileRoute } from '@tanstack/react-router';
import { FilePenLineIcon } from 'lucide-react';
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
import {
  CreateAuthorize,
  CreateAuthorizeSkeleton,
} from '@/features/buq/components/create-authorize';
import { type BuqListSearch, buqListSearchSchema } from '@/features/buq/lib/search';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { loadBuqAccess } from '@/routes/-buq-access';

const FORECASTING_RIGHTS = [RIGHTS.createForecasting, RIGHTS.authorizeForecasting];

export const Route = createFileRoute('/(protected)/_protected/buq/create')({
  validateSearch: buqListSearchSchema,
  loader: ({ context: { queryClient }, cause }) =>
    loadBuqAccess(queryClient, FORECASTING_RIGHTS, cause),
  pendingComponent: CreateAuthorizePending,
  component: CreateAuthorizePage,
});

function CreateAuthorizeHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <FilePenLineIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('buq.create.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('buq.create.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function CreateAuthorizePage() {
  const { t } = useTranslation();
  const access = Route.useLoaderData();
  const search = Route.useSearch();
  const { updateSearch } = useSearchNavigation<BuqListSearch>({});
  return (
    <Workspace>
      <CreateAuthorizeHeader />
      <WorkspaceContent>
        {access.kind === 'ready' ? (
          <CreateAuthorize
            facility={access.facility}
            onSearchChange={updateSearch}
            program={access.program}
            search={search}
          />
        ) : (
          <BuqUnavailable kind={access.kind} title={t('buq.create.unavailable-title')} />
        )}
      </WorkspaceContent>
    </Workspace>
  );
}

function CreateAuthorizePending() {
  const search = Route.useSearch();
  return (
    <Workspace>
      <CreateAuthorizeHeader />
      <WorkspaceContent>
        <CreateAuthorizeSkeleton search={search} />
      </WorkspaceContent>
    </Workspace>
  );
}
