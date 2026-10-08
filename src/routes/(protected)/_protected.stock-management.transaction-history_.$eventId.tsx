import { useQuery } from '@tanstack/react-query';
import { createFileRoute, type ErrorComponentProps, Link } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ClipboardListIcon, PrinterIcon, SearchXIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { useColumnVisibility, useElementWidth } from '@/components/data-table/responsive-columns';
import { ErrorFallback } from '@/components/error-fallback';
import { ListError } from '@/components/list-error';
import { QuantityUnitToggle } from '@/components/quantity-unit-toggle';
import { QueryBoundary } from '@/components/query-boundary';
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
import { Spinner } from '@/components/ui/spinner';
import {
  Workspace,
  WorkspaceActions,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { ForbiddenError, requirePermissions } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { fetchStockEventReport } from '@/features/stock-events/api/api';
import { stockEventLinesOptions, stockEventOptions } from '@/features/stock-events/api/queries';
import { EventHeader, EventHeaderSkeleton } from '@/features/stock-events/components/event-header';
import {
  EventLines,
  EventLinesSkeleton,
  STOCK_EVENT_HIDEABLE_COLUMNS,
} from '@/features/stock-events/components/event-lines';
import { canReverseEvent } from '@/features/stock-events/lib/event-access';
import {
  type DetailPagingSearch,
  detailPagingSchema,
  detailTableSearch,
  transactionHistorySearchSchema,
} from '@/features/stock-events/lib/search';
import type { StockEventSummary } from '@/features/stock-events/lib/types';
import { usePrintReport } from '@/hooks/use-print-report';
import { useQuantityUnit } from '@/hooks/use-quantity-unit';
import { useReloadForUser } from '@/hooks/use-reload-for-user';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { useStoredState } from '@/hooks/use-stored-state';
import { isNotFound } from '@/lib/http';
import { openReport } from '@/lib/open-report';
import { hasProgramGrant } from '@/lib/permissions';
import type { QuantityUnit } from '@/lib/quantity';
import { toPaginationState } from '@/lib/table-search';

const RIGHT = RIGHTS.stockCardsView;
let shownEventId: string | undefined;
const stockEventSearchSchema = transactionHistorySearchSchema.extend(detailPagingSchema.shape);
const NO_DIALOGS = {};

const columnChoicesSchema = z.record(z.string(), z.boolean());

const REVERSAL_COLUMNS: readonly string[] = ['reversing', 'reversedBy'];
const WITH_REVERSALS = STOCK_EVENT_HIDEABLE_COLUMNS.map((column) =>
  REVERSAL_COLUMNS.includes(column.id) ? { ...column, defaultHidden: false } : column,
);

function useEventLayout(hasReversals = false) {
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const columnView = useColumnVisibility(
    hasReversals ? WITH_REVERSALS : STOCK_EVENT_HIDEABLE_COLUMNS,
    useStoredState('stock-event.column-visibility', columnChoicesSchema, {}),
    width,
  );
  return { measure, columnView };
}

export const Route = createFileRoute(
  '/(protected)/_protected/stock-management/transaction-history_/$eventId',
)({
  validateSearch: stockEventSearchSchema,
  staticData: {
    crumbKey: 'transaction-history.details-crumb',
    crumbParentSearch: (search) => transactionHistorySearchSchema.parse(search),
  },
  preload: false,
  loaderDeps: ({ search }) => ({ detailPage: search.detailPage, detailSize: search.detailSize }),
  loader: async ({ context: { queryClient }, params, cause, deps }) => {
    const userId = useLoginData.getState().referenceDataUserId;
    const options = stockEventOptions(params.eventId);
    const state = queryClient.getQueryState(options.queryKey);
    const sameEvent = cause === 'stay' && shownEventId === params.eventId;
    const userChanged = () => !userId || useLoginData.getState().referenceDataUserId !== userId;
    const [permissions, event] =
      (await Promise.all([
        requirePermissions(queryClient, RIGHT),
        sameEvent && !state?.error && !state?.isInvalidated
          ? queryClient.ensureQueryData(options)
          : queryClient.fetchQuery({ ...options, staleTime: 0 }),
        queryClient.ensureQueryData(deploymentTimeZoneOptions()),
      ]).catch((error: unknown) => {
        if (userChanged()) return undefined;
        throw error;
      })) ?? [];
    if (!userId || userChanged() || !permissions || !event) return;
    if (!hasProgramGrant(permissions, RIGHT, event.facilityId, event.programId)) {
      throw new ForbiddenError(RIGHT);
    }
    const { pageIndex, pageSize } = toPaginationState(detailTableSearch(deps));
    queryClient.prefetchQuery(
      stockEventLinesOptions(event.id, { page: pageIndex, size: pageSize }),
    );
    shownEventId = event.id;
    return {
      event,
      userId,
      canReverse: canReverseEvent(permissions, event, RIGHTS.stockEventsCancel),
    };
  },
  component: StockEventPage,
  pendingComponent: StockEventPending,
  errorComponent: StockEventError,
});

function StockEventPage() {
  const { t } = useTranslation();
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const { updateSearch } = useSearchNavigation<typeof search>(NO_DIALOGS);
  const { unit, setUnit, canSwitch } = useQuantityUnit();
  const { measure, columnView } = useEventLayout(useHasReversals(search));
  const userId = useReloadForUser(
    data?.userId,
    stockEventOptions(Route.useParams().eventId).queryKey,
  );
  if (!data || data.userId !== userId) return null;
  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceIcon>
            <ClipboardListIcon />
          </WorkspaceIcon>
          <WorkspaceTitle>{t('stock-event.title')}</WorkspaceTitle>
          <WorkspaceDescription>{t('stock-event.description')}</WorkspaceDescription>
        </WorkspaceHeading>
        <WorkspaceActions>
          <StockEventPrint event={data.event} userId={data.userId} unit={unit} search={search} />
        </WorkspaceActions>
      </WorkspaceHeader>
      <WorkspaceContent>
        <div className="flex flex-col gap-4" ref={measure}>
          <EventHeader event={data.event} />
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canSwitch && (
              <div className="flex-1 @md/main:flex-none">
                <QuantityUnitToggle unit={unit} onUnitChange={setUnit} />
              </div>
            )}
            <StockEventColumns columnView={columnView} />
          </div>
          <QueryBoundary
            resetKey={`${data.event.id}:${search.detailPage}:${search.detailSize}`}
            errorComponent={EventLinesError}
            pendingFallback={
              <EventLinesSkeleton search={search} columnVisibility={columnView.visibility} />
            }
          >
            <EventLines
              eventId={data.event.id}
              search={search}
              onSearchChange={updateSearch}
              unit={unit}
              columnVisibility={columnView.visibility}
            />
          </QueryBoundary>
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function useHasReversals(search: DetailPagingSearch) {
  const { pageIndex, pageSize } = toPaginationState(detailTableSearch(search));
  const { data } = useQuery({
    ...stockEventLinesOptions(Route.useParams().eventId, { page: pageIndex, size: pageSize }),
    enabled: false,
  });
  return Boolean(data?.content.some((line) => line.reversedEventId || line.cancellationEventId));
}

function StockEventColumns({ columnView }: { columnView: ReturnType<typeof useColumnVisibility> }) {
  const { t } = useTranslation();
  return (
    <div>
      <DataTableViewOptions
        columns={STOCK_EVENT_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({
          id,
          label: t(labelKey),
        }))}
        onReset={columnView.onReset}
        onVisibilityChange={columnView.onVisibilityChange}
        visibility={columnView.visibility}
      />
    </div>
  );
}

function StockEventPrint({
  event,
  userId,
  unit,
  search,
}: {
  event: StockEventSummary;
  userId: string;
  unit: QuantityUnit;
  search: { detailPage?: number; detailSize?: number };
}) {
  const { t } = useTranslation();
  const { pageIndex, pageSize } = toPaginationState(detailTableSearch(search));
  const lines = useQuery({
    ...stockEventLinesOptions(event.id, { page: pageIndex, size: pageSize }),
    enabled: false,
  });
  const print = usePrintReport({
    userId,
    right: RIGHT,
    facilityId: event.facilityId,
    programId: event.programId,
    request: (lang) => fetchStockEventReport(event.id, { showInDoses: unit === 'DOSES', lang }),
    onReport: () => openReport(`stock_event_${event.id}.pdf`, t('stock-event.print-loading')),
    successTitle: t('stock-event.printed-title'),
    successDescription: t('stock-event.printed'),
    errorTitle: t('stock-event.print-error-title'),
    errorDescription: t('stock-event.print-error'),
    refusedDescription: t('stock-event.print-refused'),
  });
  return (
    <Button
      size="lg"
      disabled={print.isPending || !lines.data?.totalElements || !!lines.error}
      onClick={print.print}
    >
      {print.isPending ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <PrinterIcon data-icon="inline-start" />
      )}
      {t('stock-event.print')}
    </Button>
  );
}

function StockEventPending() {
  const { canSwitch } = useQuantityUnit();
  useReloadForUser(
    useLoginData((state) => state.referenceDataUserId),
    stockEventOptions(Route.useParams().eventId).queryKey,
  );
  const search = Route.useSearch();
  const { measure, columnView } = useEventLayout();
  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceIcon>
            <Skeleton fill />
          </WorkspaceIcon>
          <div className="h-7 w-72 max-w-full">
            <Skeleton fill />
          </div>
          <div className="h-5 w-48 max-w-full">
            <Skeleton fill />
          </div>
        </WorkspaceHeading>
        <WorkspaceActions>
          <div className="h-10 w-24">
            <Skeleton fill />
          </div>
        </WorkspaceActions>
      </WorkspaceHeader>
      <WorkspaceContent>
        <div aria-busy className="flex flex-col gap-4" ref={measure}>
          <EventHeaderSkeleton />
          <div className="flex justify-end gap-2">
            {canSwitch && (
              <div className="h-8 flex-1 @md/main:w-36 @md/main:flex-none">
                <Skeleton fill />
              </div>
            )}
            <div className="h-8 w-20">
              <Skeleton fill />
            </div>
          </div>
          <EventLinesSkeleton search={search} columnVisibility={columnView.visibility} />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function StockEventError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  const search = Route.useSearch();
  useReloadForUser(
    useLoginData((state) => state.referenceDataUserId),
    stockEventOptions(Route.useParams().eventId).queryKey,
  );
  if (
    !isNotFound(props.error) &&
    !(isAxiosError(props.error) && props.error.response?.status === 400)
  ) {
    return (
      <ErrorFallback
        {...props}
        title={t('stock-event.error-title')}
        description={t('stock-event.error-description')}
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
          <EmptyContent>
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <Link
                  to="/stock-management/transaction-history"
                  search={transactionHistorySearchSchema.parse(search)}
                />
              }
            >
              {t('stock-event.back')}
            </Button>
          </EmptyContent>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}

function EventLinesError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  return (
    <ListError
      {...props}
      title={t('stock-event.lines-error-title')}
      description={t('stock-event.lines-error-description')}
    />
  );
}
