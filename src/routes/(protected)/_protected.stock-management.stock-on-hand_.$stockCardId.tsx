import { createFileRoute, type ErrorComponentProps } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ClipboardListIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useElementWidth } from '@/components/data-table/responsive-columns';
import { ErrorFallback } from '@/components/error-fallback';
import { QuantityUnitToggle } from '@/components/quantity-unit-toggle';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { ForbiddenError, requirePermissions } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import { stockCardOptions } from '@/features/stock-card/api/queries';
import {
  StockCardHeader,
  StockCardHeaderSkeleton,
} from '@/features/stock-card/components/stock-card-header';
import {
  type CardLayout,
  StockCardLines,
  StockCardLinesSkeleton,
} from '@/features/stock-card/components/stock-card-lines';
import { cardPagingSchema } from '@/features/stock-card/lib/search';
import { stockOnHandSearchSchema } from '@/features/stock-on-hand/lib/search';
import { useQuantityUnit } from '@/hooks/use-quantity-unit';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { isNotFound } from '@/lib/http';
import { hasProgramGrant } from '@/lib/permissions';

const RIGHT = RIGHTS.stockCardsView;
const stockCardSearchSchema = stockOnHandSearchSchema.extend(cardPagingSchema.shape);
const NO_DIALOGS = {};

function useCardLayout() {
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const layout: CardLayout = width === undefined || width >= 768 ? 'table' : 'cards';
  return [measure, layout] as const;
}

export const Route = createFileRoute(
  '/(protected)/_protected/stock-management/stock-on-hand_/$stockCardId',
)({
  validateSearch: stockCardSearchSchema,
  staticData: { crumbKey: 'stock-card.crumb' },
  loader: async ({ context: { queryClient }, params }) => {
    const userId = useLoginData.getState().referenceDataUserId;
    const permissions = await requirePermissions(queryClient, RIGHT);
    if (!userId || useLoginData.getState().referenceDataUserId !== userId) return;
    const card = await queryClient.ensureQueryData(stockCardOptions(params.stockCardId));
    if (useLoginData.getState().referenceDataUserId !== userId) return;
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
  const { updateSearch } = useSearchNavigation<typeof search>(NO_DIALOGS);
  const { unit, setUnit, canSwitch } = useQuantityUnit();
  const [measure, layout] = useCardLayout();
  const userId = useLoginData((state) => state.referenceDataUserId);
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
        </WorkspaceHeading>
      </WorkspaceHeader>
      <WorkspaceContent>
        <div className="flex flex-col gap-4" ref={measure}>
          <StockCardHeader card={data.card} unit={unit} />
          {canSwitch && (
            <div className="flex justify-end">
              <QuantityUnitToggle unit={unit} onUnitChange={setUnit} />
            </div>
          )}
          <StockCardLines
            card={data.card}
            search={search}
            onSearchChange={updateSearch}
            unit={unit}
            layout={layout}
          />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function StockCardPending() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const [measure, layout] = useCardLayout();
  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceTitle>{t('stock-card.crumb')}</WorkspaceTitle>
        </WorkspaceHeading>
      </WorkspaceHeader>
      <WorkspaceContent>
        <div aria-busy className="flex flex-col gap-4" ref={measure}>
          <StockCardHeaderSkeleton />
          <div className="ms-auto h-8 w-36">
            <Skeleton fill />
          </div>
          <StockCardLinesSkeleton layout={layout} search={search} />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function StockCardError(props: ErrorComponentProps) {
  const { t } = useTranslation();
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
            <EmptyTitle>
              <h1>{t('stock-card.not-found-title')}</h1>
            </EmptyTitle>
            <EmptyDescription>{t('stock-card.not-found-description')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}
