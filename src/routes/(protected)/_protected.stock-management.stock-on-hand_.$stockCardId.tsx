import { createFileRoute, type ErrorComponentProps, Link } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ClipboardListIcon, PrinterIcon, SearchXIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { useColumnVisibility, useElementWidth } from '@/components/data-table/responsive-columns';
import { ErrorFallback } from '@/components/error-fallback';
import { QuantityUnitToggle } from '@/components/quantity-unit-toggle';
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
import { fetchStockCardReport } from '@/features/stock-card/api/api';
import { stockCardOptions } from '@/features/stock-card/api/queries';
import {
  StockCardHeader,
  StockCardHeaderSkeleton,
} from '@/features/stock-card/components/stock-card-header';
import {
  STOCK_CARD_HIDEABLE_COLUMNS,
  StockCardLines,
  StockCardLinesSkeleton,
} from '@/features/stock-card/components/stock-card-lines';
import { cardPagingSchema } from '@/features/stock-card/lib/search';
import type { StockCard, StockCardLine } from '@/features/stock-card/lib/types';
import { stockOnHandSearchSchema } from '@/features/stock-on-hand/lib/search';
import { usePrintReport } from '@/hooks/use-print-report';
import { useQuantityUnit } from '@/hooks/use-quantity-unit';
import { useReloadForUser } from '@/hooks/use-reload-for-user';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { useStoredState } from '@/hooks/use-stored-state';
import { isNotFound } from '@/lib/http';
import { openReport } from '@/lib/open-report';
import { hasProgramGrant } from '@/lib/permissions';
import type { QuantityUnit } from '@/lib/quantity';
import { withShownReversals } from '@/lib/stock-labels';

const RIGHT = RIGHTS.stockCardsView;
const stockCardSearchSchema = stockOnHandSearchSchema.extend(cardPagingSchema.shape);
const NO_DIALOGS = {};

const columnChoicesSchema = z.record(z.string(), z.boolean());

const NO_LINES: readonly StockCardLine[] = [];

function useCardLayout(lines: readonly StockCardLine[] = NO_LINES) {
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const reversing = lines.some((line) => line.reversedEventId);
  const reversedBy = lines.some((line) => line.cancellationEventId);
  const columns = useMemo(
    () => withShownReversals(STOCK_CARD_HIDEABLE_COLUMNS, { reversing, reversedBy }),
    [reversing, reversedBy],
  );
  const columnView = useColumnVisibility(
    columns,
    useStoredState('stock-card.column-visibility', columnChoicesSchema, {}),
    width,
  );
  return { measure, columnView };
}

export const Route = createFileRoute(
  '/(protected)/_protected/stock-management/stock-on-hand_/$stockCardId',
)({
  validateSearch: stockCardSearchSchema,
  staticData: {
    crumbKey: 'stock-card.crumb',
    crumbParentSearch: (search) => stockOnHandSearchSchema.parse(search),
  },
  preload: false,
  loader: async ({ context: { queryClient }, params, cause }) => {
    const userId = useLoginData.getState().referenceDataUserId;
    const options = stockCardOptions(params.stockCardId);
    const state = queryClient.getQueryState(options.queryKey);
    const userChanged = () => !userId || useLoginData.getState().referenceDataUserId !== userId;
    const [permissions, card] =
      (await Promise.all([
        requirePermissions(queryClient, RIGHT),
        cause === 'stay' && !state?.error && !state?.isInvalidated
          ? queryClient.ensureQueryData(options)
          : queryClient.fetchQuery({ ...options, staleTime: 0 }),
      ]).catch((error: unknown) => {
        if (userChanged()) return undefined;
        throw error;
      })) ?? [];
    if (!userId || userChanged() || !permissions || !card) return;
    if (!hasProgramGrant(permissions, RIGHT, card.facility.id, card.program.id)) {
      throw new ForbiddenError(RIGHT);
    }
    return { card, userId };
  },
  component: StockCardPage,
  pendingComponent: StockCardPending,
  errorComponent: StockCardError,
});

function StockCardPage() {
  const { t } = useTranslation();
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const eventSearch = useMemo(
    () => ({ mode: search.mode, programId: search.programId, facilityId: search.facilityId }),
    [search.mode, search.programId, search.facilityId],
  );
  const { updateSearch } = useSearchNavigation<typeof search>(NO_DIALOGS);
  const { unit, setUnit, canSwitch } = useQuantityUnit();
  const { measure, columnView } = useCardLayout(data?.card.lineItems);
  const userId = useReloadForUser(
    data?.userId,
    stockCardOptions(Route.useParams().stockCardId).queryKey,
  );
  if (!data || data.userId !== userId) return null;
  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceIcon>
            <ClipboardListIcon />
          </WorkspaceIcon>
          <WorkspaceTitle>
            {t('stock-card.title', { program: data.card.program.name })}
          </WorkspaceTitle>
          <WorkspaceDescription>
            <bdi>{data.card.orderable.fullProductName}</bdi>
          </WorkspaceDescription>
        </WorkspaceHeading>
        <WorkspaceActions>
          <StockCardPrint card={data.card} userId={data.userId} unit={unit} />
        </WorkspaceActions>
      </WorkspaceHeader>
      <WorkspaceContent>
        <div className="flex flex-col gap-4" ref={measure}>
          <StockCardHeader card={data.card} unit={unit} />
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canSwitch && (
              <div className="flex-1 @md/main:flex-none">
                <QuantityUnitToggle unit={unit} onUnitChange={setUnit} />
              </div>
            )}
            <StockCardColumns columnView={columnView} />
          </div>
          <StockCardLines
            card={data.card}
            search={search}
            onSearchChange={updateSearch}
            unit={unit}
            columnVisibility={columnView.visibility}
            eventSearch={eventSearch}
          />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function StockCardColumns({ columnView }: { columnView: ReturnType<typeof useColumnVisibility> }) {
  const { t } = useTranslation();
  return (
    <div>
      <DataTableViewOptions
        columns={STOCK_CARD_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({
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

function StockCardPrint({
  card,
  userId,
  unit,
}: {
  card: StockCard;
  userId: string;
  unit: QuantityUnit;
}) {
  const { t } = useTranslation();
  const print = usePrintReport({
    userId,
    right: RIGHT,
    facilityId: card.facility.id,
    programId: card.program.id,
    request: (lang) => fetchStockCardReport(card.id, { showInDoses: unit === 'DOSES', lang }),
    onReport: () => openReport(`stock_card_${card.id}.pdf`, t('stock-card.print-loading')),
    successTitle: t('stock-card.printed-title'),
    successDescription: t('stock-card.printed', { product: card.orderable.fullProductName }),
    errorTitle: t('stock-card.print-error-title'),
    errorDescription: t('stock-card.print-error'),
    refusedDescription: t('stock-card.print-refused'),
  });
  return (
    <Button size="lg" disabled={print.isPending} onClick={print.print}>
      {print.isPending ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <PrinterIcon data-icon="inline-start" />
      )}
      {t('stock-card.print')}
    </Button>
  );
}

function StockCardPending() {
  const { canSwitch } = useQuantityUnit();
  useReloadForUser(
    useLoginData((state) => state.referenceDataUserId),
    stockCardOptions(Route.useParams().stockCardId).queryKey,
  );
  const search = Route.useSearch();
  const { measure, columnView } = useCardLayout();
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
          <StockCardHeaderSkeleton />
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
          <StockCardLinesSkeleton search={search} columnVisibility={columnView.visibility} />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function StockCardError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  const search = Route.useSearch();
  useReloadForUser(
    useLoginData((state) => state.referenceDataUserId),
    stockCardOptions(Route.useParams().stockCardId).queryKey,
  );
  if (
    !isNotFound(props.error) &&
    !(isAxiosError(props.error) && props.error.response?.status === 400)
  ) {
    return (
      <ErrorFallback
        {...props}
        title={t('stock-card.error-title')}
        description={t('stock-card.error-description')}
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
              <h1>{t('stock-card.not-found-title')}</h1>
            </EmptyTitle>
            <EmptyDescription>{t('stock-card.not-found-description')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <Link
                  to="/stock-management/stock-on-hand"
                  search={stockOnHandSearchSchema.parse(search)}
                />
              }
            >
              {t('stock-card.back')}
            </Button>
          </EmptyContent>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}
