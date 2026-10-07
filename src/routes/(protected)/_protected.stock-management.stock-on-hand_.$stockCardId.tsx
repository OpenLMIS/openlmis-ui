import { createFileRoute, type ErrorComponentProps } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ClipboardListIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ErrorFallback } from '@/components/error-fallback';
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
import { stockCardProductName } from '@/features/stock-card/lib/card-lines';
import { stockOnHandSearchSchema } from '@/features/stock-on-hand/lib/search';
import { isNotFound } from '@/lib/http';
import { hasProgramGrant } from '@/lib/permissions';

const RIGHT = RIGHTS.stockCardsView;

export const Route = createFileRoute(
  '/(protected)/_protected/stock-management/stock-on-hand_/$stockCardId',
)({
  validateSearch: stockOnHandSearchSchema,
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
        <p>{stockCardProductName(data.card.orderable)}</p>
      </WorkspaceContent>
    </Workspace>
  );
}

function StockCardPending() {
  const { t } = useTranslation();
  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceTitle>{t('stock-card.crumb')}</WorkspaceTitle>
        </WorkspaceHeading>
      </WorkspaceHeader>
      <WorkspaceContent>
        <div aria-busy className="h-64">
          <Skeleton fill />
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
