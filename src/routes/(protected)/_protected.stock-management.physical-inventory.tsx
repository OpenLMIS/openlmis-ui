import {
  useQueries,
  useQuery,
  useQueryClient,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute, type ErrorComponentProps } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ClipboardPenLineIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { LoadError } from '@/components/load-error';
import { NoAccess } from '@/components/no-access-page';
import { QueryBoundary } from '@/components/query-boundary';
import {
  StockProgramPicker,
  StockProgramPickerSkeleton,
} from '@/components/stock-program-picker/stock-program-picker';
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
import { ForbiddenError, isForbidden, requirePermissions } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  facilityOptions,
  userProgramsOptions,
  userRecordOptions,
} from '@/features/reference-data/api/queries';
import { startPhysicalInventory } from '@/features/stock-events/api/physical-inventory-api';
import { physicalInventoryDraftOptions } from '@/features/stock-events/api/physical-inventory-queries';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { type NamedRecord, recordLabel } from '@/lib/facility-program-selection';
import { type ProgramGrant, programGrants } from '@/lib/permissions';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import { homeStockPrograms } from '@/lib/stock-programs';

export const Route = createFileRoute('/(protected)/_protected/stock-management/physical-inventory')(
  {
    loader: async ({ context: { queryClient } }) => {
      const userId = useLoginData.getState().referenceDataUserId;
      const permissions = await requirePermissions(queryClient, RIGHTS.stockInventoriesEdit);
      if (!userId || useLoginData.getState().referenceDataUserId !== userId) {
        throw new ForbiddenError(RIGHTS.stockInventoriesEdit);
      }
      queryClient.prefetchQuery(userProgramsOptions(userId));
      queryClient.prefetchQuery(userRecordOptions(userId)).then(() => {
        const user = queryClient.getQueryData(userRecordOptions(userId).queryKey);
        if (user?.homeFacilityId && useLoginData.getState().referenceDataUserId === userId) {
          queryClient.prefetchQuery(facilityOptions(user.homeFacilityId));
        }
      });
      return { userId, permissions };
    },
    pendingComponent: PhysicalInventoryPending,
    component: PhysicalInventoryPage,
  },
);

function PhysicalInventoryHeader({ userId }: { userId?: string }) {
  const { t } = useTranslation();
  const { data: user } = useQuery({ ...userRecordOptions(userId ?? ''), enabled: Boolean(userId) });
  const homeId = user?.homeFacilityId;
  const { data: home } = useQuery({ ...facilityOptions(homeId ?? ''), enabled: Boolean(homeId) });
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <ClipboardPenLineIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>
          {home
            ? t('physical-inventory.title', { facility: recordLabel(home) })
            : t('nav.stock-management.physical-inventory')}
        </WorkspaceTitle>
        <WorkspaceDescription>{t('physical-inventory.page-description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function PhysicalInventoryPage() {
  const { t } = useTranslation();
  const { userId } = Route.useLoaderData();
  return (
    <Workspace width="narrow">
      <PhysicalInventoryHeader userId={userId} />
      <WorkspaceContent>
        <QueryBoundary
          errorComponent={ProgramsError}
          pendingFallback={
            <StockProgramPickerSkeleton statusLabel={t('physical-inventory.status')} />
          }
          resetKey={userId}
        >
          <InventoryPrograms />
        </QueryBoundary>
      </WorkspaceContent>
    </Workspace>
  );
}

function InventoryPrograms() {
  const { userId, permissions } = Route.useLoaderData();
  const [user, programs] = useSuspenseQueries({
    queries: [userRecordOptions(userId), userProgramsOptions(userId)],
  });
  if (!user.data.homeFacilityId) return <ProgramsTable hasHomeFacility={false} programs={[]} />;
  return (
    <HomePrograms
      grants={programGrants(permissions, RIGHTS.stockInventoriesEdit)}
      homeId={user.data.homeFacilityId}
      programs={programs.data}
    />
  );
}

function HomePrograms({
  homeId,
  ...sources
}: {
  homeId: string;
  programs: readonly NamedRecord[];
  grants: readonly ProgramGrant[];
}) {
  const { data: homeFacility } = useSuspenseQuery(facilityOptions(homeId));
  return (
    <ProgramsTable
      hasHomeFacility
      facilityId={homeId}
      programs={homeStockPrograms({ homeFacility, ...sources })}
    />
  );
}

function ProgramsTable({
  programs,
  hasHomeFacility,
  facilityId = '',
}: {
  programs: readonly NamedRecord[];
  hasHomeFacility: boolean;
  facilityId?: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = Route.useNavigate();
  const drafts = useQueries({
    queries: programs.map((program) =>
      physicalInventoryDraftOptions({ programId: program.id, facilityId }),
    ),
  });
  const mutation = useSessionMutation({
    retry: false,
    mutationFn: async (programId: string) => {
      const scope = getSessionScope();
      const selection = { programId, facilityId };
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
    onError: () =>
      toast.error(t('physical-inventory.start-error-title'), {
        description: t('physical-inventory.start-error-description'),
      }),
  });
  const rows = programs.map((program, index) => {
    const result = drafts[index];
    return {
      id: program.id,
      label: recordLabel(program),
      status: result.isPending ? (
        <div className="h-4 w-20">
          <Skeleton fill />
        </div>
      ) : result.isError ? (
        t('physical-inventory.status-error')
      ) : (
        t(result.data ? 'physical-inventory.draft' : 'physical-inventory.not-started')
      ),
      actionLabel: t(
        result.isError
          ? 'physical-inventory.retry'
          : result.data
            ? 'physical-inventory.continue'
            : 'physical-inventory.start',
      ),
      disabled: result.isPending || mutation.isPending,
    };
  });
  return (
    <StockProgramPicker
      rows={rows}
      hasHomeFacility={hasHomeFacility}
      statusLabel={t('physical-inventory.status')}
      actionLabel={t('physical-inventory.start')}
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
        else mutation.mutate(row.id);
      }}
    />
  );
}

function ProgramsError({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();
  if (isForbidden(error)) return <NoAccess />;
  return (
    <LoadError
      description={t('stock-programs.load-error')}
      error={error}
      reset={reset}
      title={t('stock-programs.load-error-title')}
    />
  );
}

function PhysicalInventoryPending() {
  const { t } = useTranslation();
  return (
    <Workspace width="narrow">
      <PhysicalInventoryHeader />
      <WorkspaceContent>
        <StockProgramPickerSkeleton statusLabel={t('physical-inventory.status')} />
      </WorkspaceContent>
    </Workspace>
  );
}
