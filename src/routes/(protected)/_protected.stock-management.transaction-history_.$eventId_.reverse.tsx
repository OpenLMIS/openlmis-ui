import { createFileRoute, type ErrorComponentProps, Link } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ChevronLeftIcon, ClipboardListIcon, SearchXIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ErrorFallback } from '@/components/error-fallback';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
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
import { EventHeader, EventHeaderSkeleton } from '@/features/stock-events/components/event-header';
import { ReverseEditor } from '@/features/stock-events/components/reverse-editor';
import {
  detailPagingSchema,
  reversePagingSchema,
  transactionHistorySearchSchema,
} from '@/features/stock-events/lib/search';
import { useReloadForUser } from '@/hooks/use-reload-for-user';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { isNotFound } from '@/lib/http';

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
    const [, event] =
      (await Promise.all([
        requireRight(queryClient, RIGHTS.stockEventsCancel),
        sameEvent && !state?.error && !state?.isInvalidated
          ? queryClient.ensureQueryData(options)
          : queryClient.fetchQuery({ ...options, staleTime: 0 }),
        queryClient.ensureQueryData(deploymentTimeZoneOptions()),
      ]).catch((error: unknown) => {
        if (userChanged()) return undefined;
        throw error;
      })) ?? [];
    if (!event || userChanged() || !userId) return;
    if (!sameEvent) {
      queryClient.removeQueries({
        queryKey: stockEventAllLinesOptions(event.id).queryKey,
        exact: true,
      });
      queryClient.prefetchQuery(stockEventAllLinesOptions(event.id));
      queryClient.prefetchQuery({ ...reasonsOptions(), staleTime: 0 });
    }
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
function ReverseLoading({
  event,
}: {
  event?: NonNullable<ReturnType<typeof Route.useLoaderData>>['event'];
}) {
  return (
    <Workspace>
      <ReverseHeading />
      <WorkspaceContent>
        <div className="flex flex-col gap-4" aria-busy>
          {event ? <EventHeader event={event} showSignature={false} /> : <EventHeaderSkeleton />}
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
  const { t } = useTranslation();
  const search = Route.useSearch();
  useReloadForUser(
    useLoginData((state) => state.referenceDataUserId),
    stockEventOptions(Route.useParams().eventId).queryKey,
  );
  const back = (
    <Button
      nativeButton={false}
      render={
        <Link
          search={transactionHistorySearchSchema.parse(search)}
          to="/stock-management/transaction-history"
        />
      }
      size="sm"
      variant="outline"
    >
      <ChevronLeftIcon className="rtl:rotate-180" data-icon="inline-start" />
      {t('stock-event.back')}
    </Button>
  );
  if (
    !isNotFound(props.error) &&
    !(isAxiosError(props.error) && props.error.response?.status === 400)
  ) {
    return (
      <ErrorFallback
        {...props}
        back={back}
        description={t('stock-event.error-description')}
        title={t('stock-event.error-title')}
      />
    );
  }
  return (
    <Workspace>
      <WorkspaceContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>
              <h1>{t('stock-event.not-found-title')}</h1>
            </EmptyTitle>
            <EmptyDescription>{t('stock-event.not-found-description')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{back} </EmptyContent>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}
