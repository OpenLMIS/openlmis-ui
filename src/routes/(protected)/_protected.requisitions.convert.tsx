import { createFileRoute, type ErrorComponentProps } from '@tanstack/react-router';
import { ClipboardListIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ListError } from '@/components/app-shell/list-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import { requireRight } from '@/features/auth/lib/access';
import {
  deploymentTimeZoneOptions,
  minimalFacilitiesOptions,
  programsOptions,
} from '@/features/reference-data/api/queries';
import { convertListOptions } from '@/features/requisitions/api/queries';
import {
  CONVERT_HIDEABLE_COLUMNS,
  ConvertTable,
  ConvertTableSkeleton,
} from '@/features/requisitions/components/convert-table';
import { ConvertToolbar } from '@/features/requisitions/components/convert-toolbar';
import { useConvertActions } from '@/features/requisitions/components/use-convert-actions';
import {
  type ConvertSearch,
  convertSearchSchema,
} from '@/features/requisitions/lib/convert-search';
import { useCardView } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { RIGHTS } from '@/lib/rights';

export const Route = createFileRoute('/(protected)/_protected/requisitions/convert')({
  validateSearch: convertSearchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context: { queryClient }, deps: { search } }) => {
    await requireRight(queryClient, RIGHTS.ordersEdit);
    queryClient.prefetchQuery(convertListOptions(search));
    queryClient.prefetchQuery(programsOptions());
    queryClient.prefetchQuery(minimalFacilitiesOptions());
    queryClient.prefetchQuery(deploymentTimeZoneOptions());
  },
  component: ConvertPage,
  pendingComponent: ConvertPending,
});
function ConvertError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  return (
    <ListError
      {...props}
      title={t('requisitions.convert.error-title')}
      description={t('requisitions.convert.error-description')}
    />
  );
}
function ConvertPage() {
  return <ConvertLayout />;
}
function ConvertPending() {
  return <ConvertLayout pending />;
}
function ConvertLayout({ pending = false }: { pending?: boolean }) {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const { updateSearch } = useSearchNavigation<ConvertSearch>({});
  const view = useCardView(CONVERT_HIDEABLE_COLUMNS, 'requisitions.convert.column-visibility');
  const actions = useConvertActions(search, view.cards);
  const skeleton = (
    <ConvertTableSkeleton cards={view.cards} columns={view.columnView.visibility} search={search} />
  );
  return (
    <>
      <Workspace>
        <WorkspaceHeader>
          <WorkspaceHeading>
            <WorkspaceIcon>
              <ClipboardListIcon />
            </WorkspaceIcon>
            <WorkspaceTitle>{t('requisitions.convert.title')}</WorkspaceTitle>
            <WorkspaceDescription>{t('requisitions.convert.description')}</WorkspaceDescription>
          </WorkspaceHeading>
        </WorkspaceHeader>
        <WorkspaceContent>
          <div className="flex flex-col gap-4" ref={view.measure}>
            <ConvertToolbar
              search={search}
              onFilterChange={updateSearch}
              disabled={pending || actions.pending}
              view={
                <DataTableViewOptions
                  size="lg"
                  disabled={pending || actions.pending}
                  layout={view.layout}
                  columns={CONVERT_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({
                    id,
                    label: t(labelKey),
                  }))}
                  visibility={view.columnView.visibility}
                  onReset={view.columnView.onReset}
                  onVisibilityChange={view.columnView.onVisibilityChange}
                />
              }
            />
            {pending ? (
              skeleton
            ) : (
              <QueryBoundary
                resetKey={JSON.stringify(search)}
                pendingFallback={skeleton}
                errorComponent={ConvertError}
              >
                <ConvertTable
                  cards={view.cards}
                  search={search}
                  columns={view.columnView.visibility}
                  onSearchChange={updateSearch}
                  {...actions.table}
                />
              </QueryBoundary>
            )}
            {actions.dialogs}
          </div>
        </WorkspaceContent>
      </Workspace>
      {!pending && actions.controls}
    </>
  );
}
