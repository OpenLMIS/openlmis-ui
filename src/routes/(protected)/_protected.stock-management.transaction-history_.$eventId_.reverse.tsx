import { createFileRoute, type ErrorComponentProps, Link } from '@tanstack/react-router';
import { ClipboardListIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useLoginData } from '@/features/auth/store/login-data';
import { deploymentTimeZoneOptions, reasonsOptions } from '@/features/reference-data/api/queries';
import { stockEventAllLinesOptions, stockEventOptions } from '@/features/stock-events/api/queries';
import { EventHeaderSkeleton } from '@/features/stock-events/components/event-header';
import { ReverseEditor } from '@/features/stock-events/components/reverse-editor';
import { StockEventError } from '@/features/stock-events/components/stock-event-error';
import {
  detailPagingSchema,
  reversePagingSchema,
  transactionHistorySearchSchema,
} from '@/features/stock-events/lib/search';
import { useReloadForUser } from '@/hooks/use-reload-for-user';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

const searchSchema = transactionHistorySearchSchema
  .extend(detailPagingSchema.shape)
  .extend(reversePagingSchema.shape);
const detailSearchSchema = transactionHistorySearchSchema.extend(detailPagingSchema.shape);
const NO_DIALOGS = {};
let shownEventId: string | undefined;
export const Route = createFileRoute(
  '/(protected)/_protected/stock-management/transaction-history_/$eventId_/reverse',
)({
  validateSearch: searchSchema,
  staticData: {
    crumbKey: 'stock-event-reverse.crumb',
    crumbParentSearch: (search) => transactionHistorySearchSchema.parse(search),
  },
  preload: false,
  loader: async ({ context: { queryClient }, params, cause }) => {
    const userId = useLoginData.getState().referenceDataUserId;
    const options = stockEventOptions(params.eventId);
    const state = queryClient.getQueryState(options.queryKey);
    const sameEvent = cause === 'stay' && shownEventId === params.eventId;
    shownEventId = undefined;
    const userChanged = () => !userId || useLoginData.getState().referenceDataUserId !== userId;
    try {
      await requireRight(queryClient, RIGHTS.stockEventsCancel);
    } catch (error) {
      if (userChanged()) return;
      throw error;
    }
    if (userChanged()) return;
    if (!sameEvent) {
      queryClient.removeQueries({
        queryKey: stockEventAllLinesOptions(params.eventId).queryKey,
        exact: true,
      });
      queryClient.prefetchQuery(stockEventAllLinesOptions(params.eventId));
      queryClient.prefetchQuery({ ...reasonsOptions(), staleTime: 0 });
    }
    const [event] =
      (await Promise.all([
        sameEvent && !state?.error && !state?.isInvalidated
          ? queryClient.ensureQueryData(options)
          : queryClient.fetchQuery({ ...options, staleTime: 0 }),
        queryClient.ensureQueryData(deploymentTimeZoneOptions()),
      ]).catch((error: unknown) => {
        if (userChanged()) return undefined;
        throw error;
      })) ?? [];
    if (!event || userChanged() || !userId) return;
    shownEventId = event.id;
    return { event, userId };
  },
  component: ReversePage,
  pendingComponent: ReversePending,
  errorComponent: ReverseError,
});
function ReverseHeading() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <ClipboardListIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('stock-event-reverse.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('stock-event-reverse.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}
function ReversePage() {
  const { t } = useTranslation();
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const username = useLoginData((state) => state.username) ?? '';
  const { updateSearch } = useSearchNavigation<typeof search>(NO_DIALOGS);
  const userId = useReloadForUser(
    data?.userId,
    stockEventOptions(Route.useParams().eventId).queryKey,
  );
  if (!data || data.userId !== userId) return null;
  const detailSearch = detailSearchSchema.parse(search);
  const cancel = (
    <Button
      size="lg"
      variant="outline"
      nativeButton={false}
      render={
        <Link
          to="/stock-management/transaction-history/$eventId"
          params={{ eventId: data.event.id }}
          search={detailSearch}
        />
      }
    >
      {t('stock-events.cancel')}
    </Button>
  );
  return (
    <ReverseEditor
      key={data.event.id}
      event={data.event}
      username={username}
      search={search}
      onSearchChange={updateSearch}
      cancel={cancel}
      onSubmitted={() =>
        navigate({
          to: '/stock-management/transaction-history/$eventId',
          params: { eventId: data.event.id },
          search: detailSearch,
          replace: true,
        })
      }
    >
      <ReverseHeading />
    </ReverseEditor>
  );
}
function ReverseLoading() {
  return (
    <Workspace>
      <ReverseHeading />
      <WorkspaceContent>
        <div className="flex flex-col gap-4" aria-busy>
          <EventHeaderSkeleton />
          <div className="h-80">
            <Skeleton fill />
          </div>
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
function ReversePending() {
  useReloadForUser(
    useLoginData((state) => state.referenceDataUserId),
    stockEventOptions(Route.useParams().eventId).queryKey,
  );
  return <ReverseLoading />;
}
function ReverseError(props: ErrorComponentProps) {
  useReloadForUser(
    useLoginData((state) => state.referenceDataUserId),
    stockEventOptions(Route.useParams().eventId).queryKey,
  );
  return <StockEventError {...props} search={Route.useSearch()} />;
}
