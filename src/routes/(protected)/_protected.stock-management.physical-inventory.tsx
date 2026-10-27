import { useQueries, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { CircleDashedIcon, CircleXIcon, FilePenLineIcon, WifiOffIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ActionTooltip } from '@/components/action-tooltip';
import { ListError } from '@/components/list-error';
import { StockProgramPicker } from '@/components/stock-program-picker/stock-program-picker';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RIGHTS } from '@/features/auth/lib/rights';
import { startPhysicalInventory } from '@/features/stock-events/api/physical-inventory-api';
import { physicalInventoryDraftOptions } from '@/features/stock-events/api/physical-inventory-queries';
import { useReloadOnConnectivityChange } from '@/hooks/use-reload-on-connectivity-change';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { recordLabel } from '@/lib/facility-program-selection';
import { isOfflineError } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
import { requireOnline } from '@/lib/local-data';
import { useOnline } from '@/lib/online';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import {
  loadStockEventPrograms,
  type ProgramsTableProps,
  StockEventProgramPicker,
  StockEventProgramsPending,
} from '@/routes/(protected)/-stock-event-program-picker';

const copy = {
  title: 'physical-inventory.title',
  nav: 'nav.stock-management.physical-inventory',
  description: 'physical-inventory.page-description',
  action: 'physical-inventory.continue',
  status: 'physical-inventory.status',
  actions: 'physical-inventory.actions',
} as const;

export const Route = createFileRoute('/(protected)/_protected/stock-management/physical-inventory')(
  {
    loader: ({ context: { queryClient } }) =>
      loadStockEventPrograms(queryClient, RIGHTS.stockInventoriesEdit),
    pendingComponent: () => <StockEventProgramsPending copy={copy} />,
    component: PhysicalInventoryPage,
  },
);

function PhysicalInventoryPage() {
  useReloadOnConnectivityChange(queryKeys.physicalInventories.all);
  const { userId, permissions } = Route.useLoaderData();
  return (
    <StockEventProgramPicker
      userId={userId}
      permissions={permissions}
      copy={copy}
      right={RIGHTS.stockInventoriesEdit}
    >
      {(table) => <ProgramsTable {...table} />}
    </StockEventProgramPicker>
  );
}

function ProgramsTable({ programs, hasHomeFacility, facilityId = '' }: ProgramsTableProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const online = useOnline();
  const navigate = Route.useNavigate();
  const drafts = useQueries({
    queries: programs.map((program) =>
      physicalInventoryDraftOptions({ programId: program.id, facilityId }, online),
    ),
  });
  const mutation = useSessionMutation({
    retry: false,
    mutationFn: async (programId: string) => {
      const scope = getSessionScope();
      const selection = { programId, facilityId };
      requireOnline();
      try {
        return await startPhysicalInventory(selection);
      } catch (error) {
        if (
          !isAxiosError(error) ||
          error.response?.status !== 400 ||
          !error.response?.data?.messageKey?.endsWith('draft.exists')
        )
          throw error;
        assertSessionScope(scope);
        const draft = await queryClient.fetchQuery({
          ...physicalInventoryDraftOptions(selection),
          staleTime: 0,
        });
        assertSessionScope(scope);
        if (!draft) throw error;
        return draft;
      }
    },
    onSuccess: async (draft) => {
      queryClient.setQueryData(
        physicalInventoryDraftOptions({ programId: draft.programId, facilityId }).queryKey,
        draft,
      );
      await navigate({
        to: '/stock-management/physical-inventory/$programId',
        params: { programId: draft.programId },
      });
    },
    onError: (error) =>
      toast.error(t('physical-inventory.start-error-title'), {
        description: t(
          isOfflineError(error)
            ? 'offline.action-description'
            : 'physical-inventory.start-error-description',
        ),
      }),
  });
  const rows = programs.map((program, index) => {
    const result = drafts[index];
    const missing = !online && result.isSuccess && !result.data;
    return {
      id: program.id,
      label: recordLabel(program),
      status: result.isPending ? (
        <div className="h-4 w-20">
          <Skeleton fill />
        </div>
      ) : result.isError ? (
        <Badge variant="destructive">
          <CircleXIcon aria-hidden="true" data-icon="inline-start" />
          {t('physical-inventory.status-error')}
        </Badge>
      ) : missing ? (
        <ActionTooltip reason={t('physical-inventory.open-online-first')}>
          <Badge variant="warning" tabIndex={0}>
            <WifiOffIcon aria-hidden="true" data-icon="inline-start" />
            {t('physical-inventory.not-on-device')}
            <span className="sr-only">{t('physical-inventory.open-online-first')}</span>
          </Badge>
        </ActionTooltip>
      ) : result.data ? (
        <Badge variant="info">
          <FilePenLineIcon aria-hidden="true" data-icon="inline-start" />
          {t('physical-inventory.draft')}
        </Badge>
      ) : (
        <Badge variant="secondary">
          <CircleDashedIcon aria-hidden="true" data-icon="inline-start" />
          {t('physical-inventory.not-started')}
        </Badge>
      ),
      actionLabel: t(
        result.isError
          ? 'physical-inventory.retry'
          : result.data || !online
            ? 'physical-inventory.continue'
            : 'physical-inventory.start',
      ),
      disabled: result.isPending || mutation.isPending || missing,
    };
  });
  const failed = drafts.filter((draft) => draft.isError);
  return (
    <>
      {failed.length > 0 && (
        <ListError
          title={t('physical-inventory.list-load-error-title')}
          description={t('physical-inventory.list-load-error-description')}
          error={failed[0].error}
          reset={() => {
            for (const result of failed) void result.refetch();
          }}
        />
      )}
      <StockProgramPicker
        rows={rows}
        hasHomeFacility={hasHomeFacility}
        statusLabel={t('physical-inventory.status')}
        actionsLabel={t('physical-inventory.actions')}
        onAction={(row) => {
          const result = drafts[programs.findIndex((program) => program.id === row.id)];
          if (result.isError) {
            void result.refetch();
            return;
          }
          if (result.data)
            void navigate({
              to: '/stock-management/physical-inventory/$programId',
              params: { programId: row.id },
            });
          else if (online) mutation.mutate(row.id);
        }}
      />
    </>
  );
}
