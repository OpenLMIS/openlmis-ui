import { createFileRoute } from '@tanstack/react-router';
import { PlusIcon, TruckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { ListError } from '@/components/list-error';
import { QueryBoundary } from '@/components/query-boundary';
import { Button } from '@/components/ui/button';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { supplyPartnersOptions } from '@/features/supply-partners/api/queries';
import { AddSupplyPartnerDialog } from '@/features/supply-partners/components/add-supply-partner-dialog';
import {
  SupplyPartnersTable,
  SupplyPartnersTableSkeleton,
} from '@/features/supply-partners/components/supply-partners-table';
import {
  type SupplyPartnersSearch,
  supplyPartnersSearchSchema,
  toSupplyPartnersQuery,
} from '@/features/supply-partners/lib/search';
import { useCardLayout } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: router types extend by interface merging.
  interface HistoryState {
    supplyPartnersListSearch?: SupplyPartnersSearch;
  }
}
const CLOSED = { partner: undefined };
export const Route = createFileRoute('/(protected)/_protected/administration/supply-partners')({
  validateSearch: supplyPartnersSearchSchema,
  loaderDeps: ({ search }) => ({ query: toSupplyPartnersQuery(search) }),
  loader: async ({ context: { queryClient }, deps }) => {
    await requireRight(queryClient, RIGHTS.supplyPartnersManage);
    queryClient.prefetchQuery(supplyPartnersOptions(deps.query));
  },
  pendingComponent: ListPending,
  component: ListPage,
});
function Heading() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <TruckIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('supply-partners.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('supply-partners.page-description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}
function ListPage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const { updateSearch, openDialog, closeDialog } =
    useSearchNavigation<SupplyPartnersSearch>(CLOSED);
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <Workspace>
      <Heading />
      <WorkspaceContent>
        <div className="flex flex-col gap-4" ref={measure}>
          <DataTableToolbar>
            <div className="ms-auto">
              <Button onClick={() => void openDialog({ partner: 'new' })}>
                <PlusIcon data-icon="inline-start" />
                {t('supply-partners.add')}
              </Button>
            </div>
          </DataTableToolbar>
          <QueryBoundary
            resetKey={JSON.stringify(toSupplyPartnersQuery(search))}
            pendingFallback={<SupplyPartnersTableSkeleton cards={cards} search={search} />}
            errorComponent={({ error, reset }) => (
              <ListError
                error={error}
                reset={reset}
                title={t('supply-partners.load-error-title')}
                description={t('supply-partners.load-error')}
              />
            )}
          >
            <SupplyPartnersTable cards={cards} search={search} onSearchChange={updateSearch} />
          </QueryBoundary>
          <AddSupplyPartnerDialog target={search.partner} search={search} onClose={closeDialog} />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
function ListPending() {
  const { t } = useTranslation();
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <Workspace>
      <Heading />
      <WorkspaceContent>
        <div className="flex flex-col gap-4" ref={measure}>
          <DataTableToolbar>
            <div className="ms-auto">
              <Button disabled>
                <PlusIcon data-icon="inline-start" />
                {t('supply-partners.add')}
              </Button>
            </div>
          </DataTableToolbar>
          <SupplyPartnersTableSkeleton cards={cards} search={{}} />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
