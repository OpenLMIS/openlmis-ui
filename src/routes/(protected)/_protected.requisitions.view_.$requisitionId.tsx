import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, type ErrorComponentProps } from '@tanstack/react-router';
import { ClipboardListIcon, PrinterIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ActionTooltip } from '@/components/action-tooltip';
import { ListError } from '@/components/list-error';
import { QueryBoundary } from '@/components/query-boundary';
import { Button } from '@/components/ui/button';
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
import { requireRequisitionView } from '@/features/auth/lib/requisition-access';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  approvedProductsByIdentitiesOptions,
  currencySettingsOptions,
  deploymentTimeZoneOptions,
  facilityOptions,
  orderablesByIdentitiesOptions,
  processingPeriodOptions,
  programLookupOptions,
  requisitionGroupOptions,
  supervisoryNodesByIdsOptions,
} from '@/features/reference-data/api/queries';
import { fetchRequisitionReport } from '@/features/requisitions/api/api';
import {
  requisitionOptions,
  requisitionStatusMessagesOptions,
} from '@/features/requisitions/api/queries';
import { LegacyActionsNote } from '@/features/requisitions/components/legacy-actions-note';
import { RequisitionComments } from '@/features/requisitions/components/requisition-comments';
import { RequisitionError } from '@/features/requisitions/components/requisition-error';
import { RequisitionHeader } from '@/features/requisitions/components/requisition-header';
import {
  RequisitionCommentsSkeleton,
  RequisitionGridPending,
  RequisitionHeaderSkeleton,
  RequisitionTabsSkeleton,
} from '@/features/requisitions/components/requisition-skeletons';
import { RequisitionTabs } from '@/features/requisitions/components/requisition-tabs';
import { requisitionCapabilities } from '@/features/requisitions/lib/capabilities';
import { requisitionSearchSchema } from '@/features/requisitions/lib/search-facilities';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import { usePrintReport } from '@/hooks/use-print-report';
import { useQuantityUnit } from '@/hooks/use-quantity-unit';
import { useReloadForUser } from '@/hooks/use-reload-for-user';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { openReport } from '@/lib/open-report';
import type { QuantityUnit } from '@/lib/quantity';
import { RIGHTS } from '@/lib/rights';
import { detailPagingSchema, type SearchChange, textFilterSchema } from '@/lib/table-search';

const dialogFlag = z.boolean().optional().catch(undefined);
const searchSchema = requisitionSearchSchema.extend({
  ...detailPagingSchema.shape,
  tab: z.enum(['fullSupply', 'nonFullSupply', 'patients']).optional().catch(undefined),
  product: textFilterSchema,
  skipped: dialogFlag,
  history: dialogFlag,
  rejection: dialogFlag,
  adjustments: textFilterSchema,
});
type RequisitionData = {
  record: RequisitionRecord;
  userId: string;
  access: Awaited<ReturnType<typeof requireRequisitionView>>;
};

const CLOSED_DIALOGS = { history: undefined, rejection: undefined, adjustments: undefined };
let shownRequisitionId: string | undefined;

export const Route = createFileRoute('/(protected)/_protected/requisitions/view_/$requisitionId')({
  validateSearch: searchSchema,
  staticData: {
    crumbKey: 'requisitions.requisition',
    crumbParentSearch: (search) => requisitionSearchSchema.parse(search),
  },
  preload: false,
  loader: async ({ context: { queryClient }, params, cause }) => {
    const userId = useLoginData.getState().referenceDataUserId;
    const options = requisitionOptions(params.requisitionId);
    const state = queryClient.getQueryState(options.queryKey);
    const sameRecord = cause === 'stay' && shownRequisitionId === params.requisitionId;
    shownRequisitionId = undefined;
    const userChanged = () => !userId || useLoginData.getState().referenceDataUserId !== userId;
    const [access, record] =
      (await Promise.all([
        requireRequisitionView(queryClient),
        sameRecord && !state?.error && !state?.isInvalidated
          ? queryClient.ensureQueryData(options)
          : queryClient.fetchQuery({ ...options, staleTime: 0 }),
        queryClient.ensureQueryData(deploymentTimeZoneOptions()),
      ]).catch((error: unknown) => {
        if (userChanged()) return undefined;
        throw error;
      })) ?? [];
    if (!userId || userChanged() || !access || !record) return;
    queryClient.prefetchQuery(requisitionStatusMessagesOptions(record.id));
    queryClient.prefetchQuery(facilityOptions(record.facility.id));
    queryClient.prefetchQuery(processingPeriodOptions(record.processingPeriod.id));
    queryClient.prefetchQuery(programLookupOptions(record.program.id));
    queryClient.prefetchQuery(currencySettingsOptions());
    queryClient.prefetchQuery(
      orderablesByIdentitiesOptions(
        record.requisitionLineItems.map(({ orderable }) => ({
          id: orderable.id,
          versionNumber: orderable.versionNumber,
        })),
      ),
    );
    queryClient.prefetchQuery(
      approvedProductsByIdentitiesOptions(
        record.requisitionLineItems.flatMap(({ approvedProduct }) =>
          approvedProduct
            ? [{ id: approvedProduct.id, versionNumber: approvedProduct.versionNumber }]
            : [],
        ),
      ),
    );
    shownRequisitionId = record.id;
    return { record, userId, access };
  },
  component: RequisitionPage,
  pendingComponent: RequisitionPending,
  errorComponent: DetailError,
});

function RequisitionPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const { updateSearch, openDialog, closeDialog } =
    useSearchNavigation<typeof search>(CLOSED_DIALOGS);
  const { unit, setUnit, canSwitch } = useQuantityUnit();
  const onAdjustments = useCallback(
    (adjustments: string) => {
      void openDialog({ adjustments });
    },
    [openDialog],
  );
  const userId = useReloadForUser(
    data?.userId,
    requisitionOptions(Route.useParams().requisitionId).queryKey,
  );
  if (!data || data.userId !== userId) return null;
  const { record } = data;
  return (
    <Workspace>
      <WorkspaceHeader>
        <QueryBoundary
          resetKey={record.id}
          errorComponent={SectionError}
          pendingFallback={<RequisitionHeadingSkeleton />}
        >
          <RequisitionHeading record={record} />
        </QueryBoundary>
        <WorkspaceActions>
          <RequisitionPrint record={record} userId={userId} unit={unit} />
        </WorkspaceActions>
      </WorkspaceHeader>
      <WorkspaceContent>
        <div className="flex flex-col gap-4">
          <QueryBoundary
            resetKey={record.id}
            errorComponent={SectionError}
            pendingFallback={<RequisitionHeaderSkeleton record={record} />}
          >
            <RequisitionHeader record={record} />
          </QueryBoundary>
          <QueryBoundary resetKey={record.id} errorComponent={SectionError} pendingFallback={null}>
            <RequisitionLegacyActions data={data} />
          </QueryBoundary>
          <QueryBoundary
            resetKey={record.id}
            errorComponent={SectionError}
            pendingFallback={<RequisitionCommentsSkeleton />}
          >
            <RequisitionComments
              record={record}
              history={search.history}
              rejection={search.rejection}
              onHistory={() => void openDialog({ history: true })}
              onRejection={() => void openDialog({ rejection: true })}
              onClose={closeDialog}
            />
          </QueryBoundary>
          <QueryBoundary
            resetKey={record.id}
            errorComponent={SectionError}
            pendingFallback={
              <>
                <RequisitionTabsSkeleton />
                <RequisitionGridPending
                  hideSkipped={
                    search.tab !== 'nonFullSupply' &&
                    !record.emergency &&
                    !!record.template.columnsMap.skipped?.isDisplayed &&
                    record.template.columnsMap.skipped?.option?.optionName ===
                      'hideSkippedLineItems'
                  }
                  canSwitch={canSwitch}
                />
              </>
            }
          >
            <RequisitionDetailTabs
              data={data}
              unit={unit}
              setUnit={setUnit}
              canSwitch={canSwitch}
              search={search}
              onSearchChange={updateSearch}
              onAdjustments={onAdjustments}
              onCloseAdjustments={closeDialog}
            />
          </QueryBoundary>
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function RequisitionHeading({ record }: { record: RequisitionRecord }) {
  const { t } = useTranslation();
  const [{ data: program }, { data: facility }, { data: period }] = useSuspenseQueries({
    queries: [
      programLookupOptions(record.program.id),
      facilityOptions(record.facility.id),
      processingPeriodOptions(record.processingPeriod.id),
    ],
  });
  return (
    <WorkspaceHeading>
      <WorkspaceIcon>
        <ClipboardListIcon />
      </WorkspaceIcon>
      <WorkspaceTitle>
        {t('requisitions.requisition.title', {
          program: program.name,
          facilityType: facility.type.name,
        })}
      </WorkspaceTitle>
      <WorkspaceDescription>
        {t('requisitions.requisition.description', {
          facility: facility.name,
          period: period.name,
        })}
      </WorkspaceDescription>
    </WorkspaceHeading>
  );
}
function RequisitionHeadingSkeleton() {
  return (
    <WorkspaceHeading>
      <WorkspaceIcon>
        <ClipboardListIcon />
      </WorkspaceIcon>
      <WorkspaceTitle>
        <TitleSkeleton />
      </WorkspaceTitle>
      <WorkspaceDescription>
        <DescriptionSkeleton />
      </WorkspaceDescription>
    </WorkspaceHeading>
  );
}

function useRequisitionPolicy(data: RequisitionData) {
  const { record, access } = data;
  const { data: program } = useSuspenseQuery(programLookupOptions(record.program.id));
  const approveRoles = new Set(
    access.roles
      .filter((role) => role.rights.some(({ name }) => name === RIGHTS.requisitionApprove))
      .map(({ id }) => id),
  );
  const approvalNodes = [
    ...new Set(
      access.user.roleAssignments.flatMap((assignment) =>
        assignment.programId === record.program.id &&
        assignment.supervisoryNodeId &&
        approveRoles.has(assignment.roleId)
          ? [assignment.supervisoryNodeId]
          : [],
      ),
    ),
  ];
  const { data: nodes } = useSuspenseQuery(
    supervisoryNodesByIdsOptions(
      !record.supervisoryNode && ['AUTHORIZED', 'IN_APPROVAL'].includes(record.status)
        ? approvalNodes
        : [],
    ),
  );
  const groups = useSuspenseQueries({
    queries: nodes.flatMap((node) =>
      node.requisitionGroup ? [requisitionGroupOptions(node.requisitionGroup.id)] : [],
    ),
  });
  const currentNodes = record.supervisoryNode?.id
    ? [record.supervisoryNode.id]
    : nodes
        .filter((node) =>
          groups.some(
            ({ data: group }) =>
              group.id === node.requisitionGroup?.id &&
              group.memberFacilities.some(({ id }) => id === record.facility.id),
          ),
        )
        .map(({ id }) => id);
  const grants = access.permissions.grants
    .filter(
      (grant) => grant.facilityId === record.facility.id && grant.programId === record.program.id,
    )
    .map(({ right }) => right);
  const context = {
    ...record,
    program: {
      ...program,
      name: program.name ?? undefined,
      showNonFullSupplyTab: program.showNonFullSupplyTab ?? undefined,
    },
    grants,
    approvalNodes,
    isSplit: !!record.extraData?.originalRequisition,
  };
  const policies = (currentNodes.length ? currentNodes : [undefined]).map((currentNodeId) =>
    requisitionCapabilities({ ...context, currentNodeId }),
  );
  return {
    deferred: policies.some((policy) => policy.deferred.length > 0),
    approver: policies.some((policy) => policy.approver),
  };
}
function RequisitionLegacyActions({ data }: { data: RequisitionData }) {
  const { record } = data;
  const { deferred } = useRequisitionPolicy(data);
  return deferred ? <LegacyActionsNote requisitionId={record.id} /> : null;
}

function RequisitionDetailTabs({
  unit,
  setUnit,
  canSwitch,
  data,
  search,
  onSearchChange,
  onAdjustments,
  onCloseAdjustments,
}: {
  data: RequisitionData;
  unit: QuantityUnit;
  setUnit: (unit: QuantityUnit) => void;
  canSwitch: boolean;
  search: ReturnType<typeof Route.useSearch>;
  onSearchChange: SearchChange<ReturnType<typeof Route.useSearch>>;
  onAdjustments: (id: string) => void;
  onCloseAdjustments: () => void;
}) {
  const { approver } = useRequisitionPolicy(data);
  return (
    <RequisitionTabs
      record={data.record}
      unit={unit}
      setUnit={setUnit}
      canSwitch={canSwitch}
      tab={search.tab}
      onTabChange={(tab) =>
        onSearchChange({
          tab:
            tab === (data.record.template.patientsTabEnabled ? 'patients' : 'fullSupply')
              ? undefined
              : tab,
          detailPage: undefined,
        })
      }
      search={search}
      onSearchChange={onSearchChange}
      onAdjustments={onAdjustments}
      onCloseAdjustments={onCloseAdjustments}
      supplyingStock={
        approver && !!data.record.template.columnsMap.supplyingFacilityStockOnHand?.isDisplayed
      }
    />
  );
}

function RequisitionPrint({
  record,
  userId,
  unit,
}: {
  record: RequisitionRecord;
  userId: string;
  unit: QuantityUnit;
}) {
  const { t } = useTranslation();
  const print = usePrintReport({
    userId,
    serverAuthorized: true,
    right: RIGHTS.requisitionView,
    facilityId: record.facility.id,
    programId: record.program.id,
    request: (lang) => fetchRequisitionReport(record.id, { showInDoses: unit === 'DOSES', lang }),
    onReport: () =>
      openReport(`requisition_${record.id}.pdf`, t('requisitions.requisition.print-loading')),
    successTitle: t('requisitions.requisition.printed-title'),
    successDescription: t('requisitions.requisition.printed'),
    errorTitle: t('requisitions.requisition.print-error-title'),
    errorDescription: t('requisitions.requisition.print-error'),
    refusedDescription: t('requisitions.requisition.print-refused'),
  });
  return (
    <ActionTooltip reason={print.disabledReason}>
      <Button
        size="lg"
        disabled={print.offline || print.isPending}
        onClick={print.print}
        focusableWhenDisabled={print.offline}
        aria-description={print.disabledReason}
      >
        {print.isPending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <PrinterIcon data-icon="inline-start" />
        )}
        {t('requisitions.requisition.print')}
      </Button>
    </ActionTooltip>
  );
}
function TitleSkeleton() {
  return (
    <span className="block h-7 w-64">
      <Skeleton fill />
    </span>
  );
}
function DescriptionSkeleton() {
  return (
    <span className="block h-4 w-48">
      <Skeleton fill />
    </span>
  );
}
function RequisitionPending() {
  useReloadForUser(
    useLoginData((state) => state.referenceDataUserId),
    requisitionOptions(Route.useParams().requisitionId).queryKey,
  );
  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceIcon>
            <ClipboardListIcon />
          </WorkspaceIcon>
          <WorkspaceTitle>
            <TitleSkeleton />
          </WorkspaceTitle>
          <WorkspaceDescription>
            <DescriptionSkeleton />
          </WorkspaceDescription>
        </WorkspaceHeading>
        <WorkspaceActions>
          <div className="h-9 w-24">
            <Skeleton fill />
          </div>
        </WorkspaceActions>
      </WorkspaceHeader>
      <WorkspaceContent>
        <div aria-busy className="flex flex-col gap-4">
          <RequisitionHeaderSkeleton />
          <RequisitionCommentsSkeleton />
          <RequisitionTabsSkeleton />
          <RequisitionGridPending />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
function DetailError(props: ErrorComponentProps) {
  useReloadForUser(
    useLoginData((state) => state.referenceDataUserId),
    requisitionOptions(Route.useParams().requisitionId).queryKey,
  );
  return <RequisitionError {...props} search={Route.useSearch()} />;
}
function SectionError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  return (
    <ListError
      {...props}
      title={t('requisitions.requisition.section-error-title')}
      description={t('requisitions.requisition.section-error-description')}
    />
  );
}
