import { useStore } from '@tanstack/react-form';
import {
  useQuery,
  useQueryClient,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute, type ErrorComponentProps, useRouter } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ClipboardListIcon, PrinterIcon } from 'lucide-react';
import { type ComponentProps, type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { ListError } from '@/components/app-shell/list-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { DiscardChangesDialog } from '@/components/display/discard-changes-dialog';
import { toDateValue } from '@/components/form/date-value';
import { ActionTooltip } from '@/components/shared/action-tooltip';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
} from '@/components/workspace/workspace';
import { permissionsOptions } from '@/features/auth/api/queries';
import {
  requireRequisitionView,
  supervisoryNodesWithRight,
} from '@/features/auth/lib/requisition-access';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  deploymentTimeZoneOptions,
  facilityOptions,
  orderablesByIdentitiesOptions,
  processingPeriodOptions,
  programLookupOptions,
  requisitionGroupOptions,
  supervisoryNodesByIdsOptions,
} from '@/features/reference-data/api/queries';
import type { Orderable, Program, RejectionReason } from '@/features/reference-data/lib/types';
import {
  approveRequisition,
  authorizeRequisition,
  createRequisitionActionAttempt,
  deleteRequisition,
  fetchRequisition,
  fetchRequisitionReport,
  rejectRequisition,
  saveRequisition,
  skipRequisition,
  submitRequisition,
} from '@/features/requisitions/api/api';
import {
  requisitionGridQueries,
  requisitionOptions,
  requisitionStatusMessagesOptions,
  unskipSettingOptions,
} from '@/features/requisitions/api/queries';
import { AddProductsDialog } from '@/features/requisitions/components/add-products-dialog';
import { AdjustmentsEditorDialog } from '@/features/requisitions/components/adjustments-editor-dialog';
import { RejectReasonsDialog } from '@/features/requisitions/components/reject-reasons-dialog';
import {
  RequisitionActionDialog,
  RequisitionErrorDialog,
  RequisitionValidationDialog,
} from '@/features/requisitions/components/requisition-action-dialogs';
import { RequisitionComments } from '@/features/requisitions/components/requisition-comments';
import { RequisitionError } from '@/features/requisitions/components/requisition-error';
import { RequisitionFooter } from '@/features/requisitions/components/requisition-footer';
import { RequisitionHeader } from '@/features/requisitions/components/requisition-header';
import {
  type PendingEditing,
  RequisitionCommentsSkeleton,
  RequisitionHeaderSkeleton,
  RequisitionTabsPending,
} from '@/features/requisitions/components/requisition-skeletons';
import { RequisitionTabs } from '@/features/requisitions/components/requisition-tabs';
import { StockCountDateDialog } from '@/features/requisitions/components/stock-count-date-dialog';
import { useRequisitionForm } from '@/features/requisitions/hooks/use-requisition-form';
import { isApprovalKind, requisitionCapabilities } from '@/features/requisitions/lib/capabilities';
import {
  applyRequisitionDraft,
  buildRequisitionDraft,
  rebaseRequisitionDraft,
} from '@/features/requisitions/lib/draft';
import {
  ApprovalInProgress,
  type RequisitionFailure,
  RequisitionRetryConflict,
  toRequisitionFailure,
} from '@/features/requisitions/lib/failure';
import { buildLines, filterLines } from '@/features/requisitions/lib/lines';
import {
  applyPatientChanges,
  parsePatients,
  patientCountError,
  patientsForProduct,
  validatePatients,
} from '@/features/requisitions/lib/patients';
import { requisitionReturnTarget } from '@/features/requisitions/lib/requisition-return';
import { requisitionSearchSchema } from '@/features/requisitions/lib/search-facilities';
import { defaultRequisitionTab, hidesSkipped } from '@/features/requisitions/lib/template';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import { validateRequisition } from '@/features/requisitions/lib/validation';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { usePrintReport } from '@/hooks/use-print-report';
import { useQuantityUnit } from '@/hooks/use-quantity-unit';
import { useReloadForUser } from '@/hooks/use-reload-for-user';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { queryKeys } from '@/lib/key-factory';
import { requireOnline } from '@/lib/local-data';
import { useOnline } from '@/lib/online';
import { openReport } from '@/lib/open-report';
import { randomId } from '@/lib/random-id';
import { REQUISITION_STATUS, REQUISITION_STATUSES } from '@/lib/requisition-status';
import { revealField } from '@/lib/reveal-field';
import { RIGHTS } from '@/lib/rights';
import { isSecureOrigin } from '@/lib/secure-context';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import { detailPagingSchema, textFilterSchema } from '@/lib/table-search';

const dialogFlag = z.boolean().optional().catch(undefined);
const searchSchema = requisitionSearchSchema.extend({
  ...detailPagingSchema.shape,
  tab: z.enum(['fullSupply', 'nonFullSupply', 'patients']).optional().catch(undefined),
  product: textFilterSchema,
  skipped: dialogFlag,
  history: dialogFlag,
  rejection: dialogFlag,
  comment: dialogFlag,
  adjustments: textFilterSchema,
  addProduct: dialogFlag,
  dialog: z.enum(['reject-reasons']).optional().catch(undefined),
});
type EditorAction = Parameters<ComponentProps<typeof RequisitionFooter>['onAction']>[0];
type RequisitionData = {
  record: RequisitionRecord;
  userId: string;
  access: Awaited<ReturnType<typeof requireRequisitionView>>;
};

const CLOSED_DIALOGS = {
  history: undefined,
  rejection: undefined,
  comment: undefined,
  adjustments: undefined,
  addProduct: undefined,
  dialog: undefined,
};
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
    if (needsUnskipSetting(record)) queryClient.prefetchQuery(unskipSettingOptions());
    queryClient.prefetchQuery(requisitionStatusMessagesOptions(record.id));
    queryClient.prefetchQuery(facilityOptions(record.facility.id));
    const [products, approvedProducts, period, currency, program] = requisitionGridQueries(record);
    queryClient.prefetchQuery(products);
    queryClient.prefetchQuery(approvedProducts);
    queryClient.prefetchQuery(period);
    queryClient.prefetchQuery(currency);
    queryClient.prefetchQuery(program);
    shownRequisitionId = record.id;
    return { record, userId, access };
  },
  component: RequisitionPage,
  pendingComponent: RequisitionPending,
  errorComponent: DetailError,
});

function RequisitionPage() {
  const data = Route.useLoaderData();
  const quantity = useQuantityUnit();
  const userId = useReloadForUser(
    data?.userId,
    requisitionOptions(Route.useParams().requisitionId).queryKey,
  );
  if (!data || data.userId !== userId) return null;
  return (
    <QueryBoundary
      resetKey={data.record.id}
      errorComponent={(props) => (
        <RequisitionReadShell data={data} quantity={quantity}>
          <SectionError {...props} />
        </RequisitionReadShell>
      )}
      pendingFallback={<RequisitionReadShell data={data} quantity={quantity} />}
    >
      <RequisitionBody key={`${userId}:${data.record.id}`} data={data} quantity={quantity} />
    </QueryBoundary>
  );
}

function RequisitionReadShell({
  data,
  quantity,
  children,
}: {
  data: RequisitionData;
  quantity: ReturnType<typeof useQuantityUnit>;
  children?: ReactNode;
}) {
  const record = data.record;
  const search = Route.useSearch();
  const { openDialog, closeDialog } = useSearchNavigation<typeof search>(CLOSED_DIALOGS, {
    keepState: true,
  });
  const pending = pendingPolicy(
    record,
    data.access,
    useCachedProgram(record.program.id),
    useCachedUnskipSetting(),
  );
  return (
    <>
      <Workspace width="wide">
        <WorkspaceHeader>
          <QueryBoundary
            resetKey={record.id}
            errorComponent={SectionError}
            pendingFallback={<RequisitionHeadingSkeleton />}
          >
            <RequisitionHeading record={record} />
          </QueryBoundary>
          <WorkspaceActions>
            <PrintPending />
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
            <QueryBoundary
              resetKey={record.id}
              errorComponent={SectionError}
              pendingFallback={
                <RequisitionCommentsSkeleton record={record} canComment={pending.policy.comments} />
              }
            >
              <RequisitionComments
                record={record}
                pending
                canComment={pending.policy.comments}
                history={search.history}
                rejection={search.rejection}
                onHistory={() => void openDialog({ history: true })}
                onRejection={() => void openDialog({ rejection: true })}
                onClose={closeDialog}
              />
            </QueryBoundary>
            {children ?? (
              <RequisitionTabsPending
                record={record}
                tab={search.tab}
                showNonFullSupply={pending.showNonFullSupply}
                editing={pending.editing}
                supplyingStock={pending.supplyingStock}
                unit={quantity.unit}
                canSwitch={quantity.canSwitch}
                hideSkipped={hidesSkipped(record.template, search.tab)}
              />
            )}
          </div>
        </WorkspaceContent>
      </Workspace>
      <RequisitionPendingFooter policy={pending.policy} />
    </>
  );
}

class PatientsPayloadError extends Error {}

function RequisitionBody({
  data,
  quantity,
}: {
  data: RequisitionData;
  quantity: ReturnType<typeof useQuantityUnit>;
}) {
  const [record, setRecord] = useState(data.record);
  const currentData = { ...data, record };
  const editor = useRequisitionForm(record);
  const addedLines = useStore(editor.form.store, (state) => state.values.draft.addedLines);
  const gridRecord = useMemo(
    () => ({
      ...record,
      requisitionLineItems: [...record.requisitionLineItems, ...addedLines],
    }),
    [record, addedLines],
  );

  const search = Route.useSearch();
  const { unit, setUnit, canSwitch } = quantity;
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const policy = useRequisitionPolicy(currentData);
  const [{ data: products }, { data: approved }, { data: period }, , { data: program }] =
    useSuspenseQueries({ queries: requisitionGridQueries(gridRecord) });
  const currentLines = () =>
    buildLines(applyRequisitionDraft(record, editor.draft), products, approved);
  const timeZone = useDeploymentTimeZone();
  const today = toDateValue(new Date(), timeZone);
  const [action, setAction] = useState<
    ComponentProps<typeof RequisitionActionDialog>['action'] | null
  >(null);
  const [dateAction, setDateAction] = useState<Extract<
    EditorAction,
    'submit' | 'submitAndAuthorize' | 'authorize'
  > | null>(null);
  const [validation, setValidation] = useState<{
    allSkipped: boolean;
    patient?: string;
    target?: { id: string; field: string; fullSupply: boolean };
  } | null>(null);
  const [rejectReasons, setRejectReasons] = useState<readonly RejectionReason[] | undefined>();
  const [serverStatus, setServerStatus] = useState<RequisitionRecord['status'] | null>(null);
  const [failure, setFailure] = useState<RequisitionFailure | null>(null);
  const posting = useRef(false);
  const refreshPending = useRef(false);
  const finished = useRef(false);
  const [attempt] = useState(createRequisitionActionAttempt);
  const [busy, setBusy] = useState(false);
  const [synced, setSynced] = useState(false);
  const uncertain = useRef<{
    kind: 'submit' | 'submitAndAuthorize' | 'authorize' | 'approve' | 'reject';
    node?: string | null;
    keyUsed?: boolean;
    status: RequisitionRecord['status'];
    modifiedDate: RequisitionRecord['modifiedDate'];
  } | null>(null);
  const [uncertainty, setUncertainty] = useState<typeof uncertain.current>(null);
  const updateUncertain = (next: typeof uncertain.current) => {
    uncertain.current = next;
    setUncertainty(next);
  };
  const latest = useRef({ record, editor });
  latest.current = { record, editor };
  const [opening] = useState(() =>
    requisitionReturnTarget(router.state.location.state, router.state.location.search),
  );
  const reload = async (keepKey = false) => {
    const scope = getSessionScope();
    requireOnline();
    const fresh = await fetchRequisition(record.id);
    assertSessionScope(scope);
    await editor.device.update(fresh);
    assertSessionScope(scope);
    setRecord(fresh);
    queryClient.setQueryData(requisitionOptions(record.id).queryKey, fresh);
    setFailure(null);
    setServerStatus(null);
    updateUncertain(null);
    refreshPending.current = false;
    setSynced(false);
    if (!keepKey) attempt.key = randomId();
    return fresh;
  };
  const refreshSaved = async () => {
    const scope = getSessionScope();
    const saved = await fetchRequisition(record.id);
    assertSessionScope(scope);
    const next = rebaseRequisitionDraft(saved, latest.current.editor.form.state.values.draft);
    editor.form.setFieldValue('draft', next);
    editor.device.write(next, saved);
    setRecord(saved);
    setSynced(true);
    latest.current = { record: saved, editor };
    refreshPending.current = false;
    queryClient.setQueryData(requisitionOptions(saved.id).queryKey, saved);
    await editor.device.flush({ allowFailure: true });
    assertSessionScope(scope);
    return saved;
  };
  const sync = async () => {
    const scope = getSessionScope();
    await editor.device.flush({ allowFailure: true });
    assertSessionScope(scope);
    requireOnline();
    if (refreshPending.current) {
      await refreshSaved();
      assertSessionScope(scope);
      requireOnline();
    }
    const sent = applyRequisitionDraft(
      latest.current.record,
      latest.current.editor.form.state.values.draft,
    );
    const patients = applyPatientChanges(
      parsePatients(latest.current.record.patientsData),
      latest.current.editor.draft.patients,
    );
    const patientErrors =
      sent.template.patientsTabEnabled && !patients.unreadable ? validatePatients(patients) : {};
    if (Object.keys(patientErrors).length) {
      setValidation({ allSkipped: false, patient: Object.keys(patientErrors)[0] });
      throw new PatientsPayloadError();
    }
    if (
      policy.patientsEditable &&
      !patients.unreadable &&
      sent.template.columnsMap.numberOfPatientsOnTreatmentNextMonth?.source === 'CALCULATED'
    ) {
      const models = new Map(
        buildLines(sent, products, approved).map((model) => [model.line.id, model]),
      );
      sent.requisitionLineItems = sent.requisitionLineItems.map((line) => ({
        ...line,
        numberOfPatientsOnTreatmentNextMonth: patientsForProduct(
          patients,
          models.get(line.id)?.product?.productCode ?? '',
        ),
      }));
    }
    if (sent.template.patientsTabEnabled) {
      const invalid = sent.requisitionLineItems.find((line) =>
        patientCountError(
          latest.current.editor.draft.lines[line.id]?.numberOfPatientsOnTreatmentNextMonth ??
            line.numberOfPatientsOnTreatmentNextMonth,
        ),
      );
      if (invalid) {
        const model = buildLines(sent, products, approved).find(
          (model) => model.line.id === invalid.id,
        );
        setValidation({
          allSkipped: false,
          target: {
            id: invalid.id,
            field: 'numberOfPatientsOnTreatmentNextMonth',
            fullSupply: model?.fullSupply ?? true,
          },
        });
        throw new PatientsPayloadError();
      }
    }
    await saveRequisition(
      sent,
      latest.current.editor.draft.addedLines.map((line) => line.id),
    );
    assertSessionScope(scope);
    refreshPending.current = true;
    return refreshSaved();
  };
  const mutation = useSessionMutation({
    retry: false,
    mutationFn: async (kind: EditorAction | 'update' | 'print') => {
      const scope = getSessionScope();
      if (kind === 'update') {
        if (failure?.kind === 'forbidden') {
          await queryClient.invalidateQueries({
            queryKey: permissionsOptions(data.userId).queryKey,
            refetchType: 'none',
          });
          assertSessionScope(scope);
          await queryClient.invalidateQueries({
            queryKey: requisitionOptions(record.id).queryKey,
            refetchType: 'none',
          });
          assertSessionScope(scope);
          try {
            await reload();
          } finally {
            assertSessionScope(scope);
            await router.invalidate();
            assertSessionScope(scope);
          }
        } else await reload(!!uncertain.current && isApprovalKind(uncertain.current.kind));
        assertSessionScope(scope);
        updateUncertain(null);
        return;
      }
      requireOnline();
      let advanced = false;
      let saved: RequisitionRecord | undefined;
      const retry = uncertain.current;
      if (retry) {
        if (kind !== retry.kind) throw new RequisitionRetryConflict();
        const fresh = await fetchRequisition(record.id);
        assertSessionScope(scope);
        const approval = isApprovalKind(retry.kind);
        const progressed = REQUISITION_STATUSES.slice(retry.kind === 'authorize' ? 3 : 2, 8);
        advanced =
          retry.kind === 'approve'
            ? ['APPROVED', 'RELEASED', 'RELEASED_WITHOUT_ORDER'].includes(fresh.status) ||
              (fresh.status === 'IN_APPROVAL' && fresh.supervisoryNode !== retry.node)
            : retry.kind === 'reject'
              ? fresh.status === 'REJECTED'
              : progressed.includes(fresh.status);
        if (advanced) {
          setRecord(fresh);
          queryClient.setQueryData(requisitionOptions(record.id).queryKey, fresh);
        } else if (
          fresh.status !== retry.status ||
          (approval && fresh.supervisoryNode !== retry.node) ||
          !retry.modifiedDate ||
          fresh.modifiedDate !== retry.modifiedDate
        ) {
          if (approval) {
            await editor.device.update(fresh);
            assertSessionScope(scope);
            setRecord(fresh);
            queryClient.setQueryData(requisitionOptions(record.id).queryKey, fresh);
            updateUncertain(null);
            attempt.key = randomId();
          }
          throw new RequisitionRetryConflict();
        } else if (approval && retry.keyUsed) {
          updateUncertain(null);
          attempt.key = randomId();
        }
      } else if (
        kind === 'sync' ||
        kind === 'print' ||
        kind === 'submit' ||
        kind === 'submitAndAuthorize' ||
        kind === 'authorize' ||
        isApprovalKind(kind)
      ) {
        saved = await sync();
        assertSessionScope(scope);
      }
      requireOnline();
      if (!advanced) {
        if (
          kind === 'submit' ||
          kind === 'submitAndAuthorize' ||
          kind === 'authorize' ||
          isApprovalKind(kind)
        ) {
          const base = saved ?? latest.current.record;
          try {
            if (kind === 'approve') await approveRequisition(record.id, attempt);
            else if (kind === 'reject') await rejectRequisition(record.id, attempt, rejectReasons);
            else if (kind === 'authorize') await authorizeRequisition(record.id, attempt);
            else await submitRequisition(record.id, attempt);
          } catch (error) {
            assertSessionScope(scope);
            const status = isAxiosError(error) ? error.response?.status : undefined;
            const locked =
              isAxiosError(error) &&
              status === 409 &&
              error.response?.data?.messageKey === 'requisition.error.approve.inProgress';
            if (locked && !retry) {
              updateUncertain(null);
              attempt.key = randomId();
              throw new ApprovalInProgress(t('requisitions.edit.approval-in-progress'));
            }
            if (
              isAxiosError(error) &&
              (!error.response ||
                (isApprovalKind(kind) && (status === 409 || (status ?? 0) >= 500)))
            )
              updateUncertain({
                kind,
                status: base.status,
                modifiedDate: base.modifiedDate,
                node: base.supervisoryNode,
                keyUsed: toRequisitionFailure(error).kind === 'key-used',
              });
            else updateUncertain(null);
            throw error;
          }
          updateUncertain(null);
        } else if (kind === 'skip') await skipRequisition(record.id, attempt);
        else if (kind === 'delete') await deleteRequisition(record.id);
      }
      assertSessionScope(scope);
      if (kind === 'sync' || kind === 'print') {
        if (kind === 'sync')
          toast.success(t('requisitions.edit.synced-title'), {
            description: t('requisitions.edit.synced-description'),
          });
        return;
      }
      finished.current = true;
      try {
        await editor.device.clear();
      } catch {
        assertSessionScope(scope);
        toast.error(t('requisitions.edit.error-title'), {
          description: t('requisitions.edit.clear-error'),
        });
      }
      assertSessionScope(scope);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.requisitions.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.home.all }),
      ]);
      assertSessionScope(scope);
      toast.success(
        t(
          `requisitions.edit.success.${kind === 'submitAndAuthorize' ? 'submit-and-authorize' : kind}`,
        ),
        {
          description: t(
            `requisitions.edit.success.${kind === 'submitAndAuthorize' ? 'submit-and-authorize' : kind}-description`,
          ),
        },
      );
      await router.navigate(opening);
      assertSessionScope(scope);
    },
  });
  const run = async (kind: EditorAction | 'update' | 'print') => {
    if (posting.current || finished.current) return false;
    posting.current = true;
    setBusy(true);
    try {
      await mutation.mutateAsync(kind);
      if (!mutation.isCurrent()) return false;
      setAction(null);
      return true;
    } catch (error) {
      if (!mutation.isCurrent()) return false;
      setAction(null);
      if (error instanceof PatientsPayloadError) return false;
      const failure =
        uncertain.current && isApprovalKind(uncertain.current.kind)
          ? { kind: 'reconciling' as const }
          : toRequisitionFailure(error);
      if (failure.kind === 'key-used') {
        const fresh = await fetchRequisition(record.id).catch(() => undefined);
        if (!mutation.isCurrent()) return false;
        if (fresh) setServerStatus(fresh.status);
      }
      if (
        isAxiosError(error) &&
        error.response?.data?.messageKey === 'requisition.error.reject.requisitionWasSplit'
      ) {
        setFailure({ kind: 'server', message: t('requisitions.edit.split-rejection') });
      } else setFailure(failure);
      return false;
    } finally {
      posting.current = false;
      if (mutation.isCurrent()) setBusy(false);
    }
  };
  const print = usePrintReport({
    userId: data.userId,
    serverAuthorized: true,
    right: RIGHTS.requisitionView,
    facilityId: record.facility.id,
    programId: record.program.id,
    beforeRequest: policy.actions.includes('sync') ? () => run('print') : undefined,
    request: (lang) => fetchRequisitionReport(record.id, { showInDoses: unit === 'DOSES', lang }),
    onReport: () =>
      openReport(`requisition_${record.id}.pdf`, t('requisitions.requisition.print-loading')),
    successTitle: t('requisitions.requisition.printed-title'),
    successDescription: t('requisitions.requisition.printed'),
    errorTitle: t('requisitions.requisition.print-error-title'),
    errorDescription: t('requisitions.requisition.print-error'),
    refusedDescription: t('requisitions.requisition.print-refused'),
  });
  const pending = busy || print.isPending;
  const editingBlocked = pending || !!uncertainty;
  const baseline = useMemo(() => JSON.stringify(buildRequisitionDraft(record)), [record]);
  const dirty = useStore(
    editor.form.store,
    (state) => JSON.stringify(state.values.draft) !== baseline,
  );
  const guard = useDiscardGuard(dirty, {
    pending,
    allowLeave: () => finished.current,
    flushBeforeLeave: editor.device.deviceAvailable
      ? async () => {
          try {
            await editor.device.flush();
            return true;
          } catch {
            return false;
          }
        }
      : undefined,
  });
  const begin = (kind: EditorAction) => {
    if (posting.current || pending || finished.current) return;
    if (uncertain.current && isApprovalKind(uncertain.current.kind)) {
      void run(uncertain.current.kind);
      return;
    }
    if (kind === 'sync') {
      void run(kind);
      return;
    }
    if (
      kind === 'submit' ||
      kind === 'submitAndAuthorize' ||
      kind === 'authorize' ||
      kind === 'approve'
    ) {
      editor.form.setFieldValue('showAllErrors', true);
      if (kind !== 'approve' && record.template.patientsTabEnabled) {
        const patients = applyPatientChanges(
          parsePatients(record.patientsData),
          editor.draft.patients,
        );
        const errors = validatePatients(patients, true);
        if (Object.keys(errors).length) {
          setValidation({ allSkipped: false, patient: Object.keys(errors)[0] });
          return;
        }
      }
      const models = currentLines();
      const result = validateRequisition(
        record,
        models,
        {
          monthsInPeriod: period.durationInMonths ?? 1,
          columns: policy.approver ? policy.editableColumns : undefined,
        },
        editor.draft.lines,
      );
      const first = models.find((model) => result.lines[model.line.id]);
      if (first || result.errors.length) {
        setValidation({
          allSkipped: result.errors.includes('requisitions.edit.validation.all-skipped'),
          target: first
            ? {
                id: first.line.id,
                field: Object.keys(result.lines[first.line.id])[0],
                fullSupply: first.fullSupply,
              }
            : undefined,
        });
        return;
      }
      if (
        kind !== 'approve' &&
        !record.emergency &&
        program.enableDatePhysicalStockCountCompleted
      ) {
        setDateAction(kind);
        return;
      }
    }
    if (kind === 'reject' && record.template.rejectionReasonWindowVisible) {
      void openDialog({ dialog: 'reject-reasons' });
      return;
    }
    setRejectReasons(undefined);
    setAction(kind);
  };

  const { updateSearch, openDialog, closeDialog } = useSearchNavigation<typeof search>(
    CLOSED_DIALOGS,
    { keepState: true },
  );
  const onAdjustments = useCallback(
    (adjustments: string) => {
      void openDialog({ adjustments });
    },
    [openDialog],
  );
  const fullSupply = (search.tab ?? defaultRequisitionTab(record.template)) === 'fullSupply';
  const canAdd = fullSupply ? policy.addFullSupplyProduct : policy.addNonFullSupplyProduct;
  const selectOffered = (available: readonly Orderable[]) => {
    if (!canAdd || editor.device.outdated) return [];
    const models = currentLines();
    const hiddenSkipped = hidesSkipped(
      record.template,
      fullSupply ? 'fullSupply' : 'nonFullSupply',
    );
    const existing = new Map(
      models.flatMap((model) => (model.product ? [[model.product.id, model] as const] : [])),
    );
    const candidates = new Map(available.map((product) => [product.id, product]));
    for (const model of models) {
      if (model.product && model.line.skipped && model.fullSupply === fullSupply && hiddenSkipped)
        candidates.set(model.product.id, { ...model.product, description: null });
    }
    return [...candidates.values()].filter((product) => {
      const entry = product.programs?.findLast((entry) => entry.programId === record.program.id);
      if (!entry || !!entry.fullSupply !== fullSupply) return false;
      const line = existing.get(product.id);
      if (line) return !!line.line.skipped && hiddenSkipped;
      return !fullSupply || record.emergency;
    });
  };
  return (
    <>
      <Workspace width="wide">
        <WorkspaceHeader>
          <RequisitionHeading record={record} />
          <WorkspaceActions>
            <RequisitionPrint
              print={print}
              disabled={editingBlocked || !!serverStatus || editor.locked}
            />
          </WorkspaceActions>
        </WorkspaceHeader>
        <WorkspaceContent>
          {serverStatus && (
            <Alert variant="info">
              <AlertTitle>{t('requisitions.edit.key-used-title')}</AlertTitle>
              <AlertDescription>
                {t('requisitions.edit.error.key-used')}{' '}
                {t(REQUISITION_STATUS[serverStatus].labelKey)}
              </AlertDescription>
              <AlertAction>
                <RequisitionUpdate
                  tone="info"
                  pending={pending}
                  onUpdate={() => {
                    setFailure(null);
                    setAction('update');
                  }}
                />
              </AlertAction>
            </Alert>
          )}
          {synced && !dirty && (
            <p role="note" className="text-muted-foreground text-sm">
              {t('requisitions.edit.synced-title')}
            </p>
          )}
          {editor.device.outdated && (
            <Alert variant="warning">
              <AlertTitle>{t('requisitions.edit.outdated-title')}</AlertTitle>
              <AlertDescription>{t('requisitions.edit.outdated-description')}</AlertDescription>
              <AlertAction>
                <RequisitionUpdate
                  tone="warning"
                  pending={pending}
                  onUpdate={() => {
                    setFailure(null);
                    setAction('update');
                  }}
                />
              </AlertAction>
            </Alert>
          )}

          <div className="flex flex-col gap-4">
            <QueryBoundary
              resetKey={record.id}
              errorComponent={SectionError}
              pendingFallback={<RequisitionHeaderSkeleton record={record} />}
            >
              <RequisitionHeader record={record} />
            </QueryBoundary>
            <QueryBoundary
              resetKey={record.id}
              errorComponent={SectionError}
              pendingFallback={
                <RequisitionCommentsSkeleton record={record} canComment={policy.comments} />
              }
            >
              <RequisitionComments
                pending={editingBlocked || editor.locked}
                editor={policy.comments ? editor : undefined}
                record={record}
                history={search.history}
                rejection={search.rejection}
                comment={search.comment}
                onHistory={() => void openDialog({ history: true })}
                onRejection={() => void openDialog({ rejection: true })}
                onComment={() => void openDialog({ comment: true })}
                onClose={closeDialog}
              />
            </QueryBoundary>
            <QueryBoundary
              resetKey={record.id}
              errorComponent={SectionError}
              pendingFallback={
                <RequisitionTabsPending
                  record={record}
                  tab={search.tab}
                  showNonFullSupply={!!program.showNonFullSupplyTab}
                  editing={{ ...policy, deviceAvailable: editor.device.deviceAvailable }}
                  supplyingStock={
                    policy.approver &&
                    !!record.template.columnsMap.supplyingFacilityStockOnHand?.isDisplayed
                  }
                  unit={unit}
                  hideSkipped={hidesSkipped(record.template, search.tab)}
                  canSwitch={canSwitch}
                />
              }
            >
              <RequisitionPolicyTabs
                data={{ ...data, record: gridRecord }}
                policy={policy}
                pending={editingBlocked}
                editor={editor}
                onAddProduct={() => void openDialog({ addProduct: true })}
                unit={unit}
                setUnit={setUnit}
                canSwitch={canSwitch}
                tab={search.tab}
                onTabChange={(tab) =>
                  updateSearch({
                    tab: tab === defaultRequisitionTab(record.template) ? undefined : tab,
                    detailPage: undefined,
                  })
                }
                search={search}
                onSearchChange={updateSearch}
                onAdjustments={onAdjustments}
                onCloseAdjustments={closeDialog}
              />
            </QueryBoundary>
          </div>
        </WorkspaceContent>
      </Workspace>
      <RequisitionFooter
        policy={policy}
        pending={pending}
        disabled={!!serverStatus || editor.locked}
        onAction={begin}
        reconciling={uncertainty && isApprovalKind(uncertainty.kind) ? uncertainty.kind : undefined}
      />
      <DiscardChangesDialog
        {...guard.dialog}
        description={t('requisitions.edit.discard-description')}
      />
      {action && (
        <RequisitionActionDialog
          action={action}
          pending={pending}
          onClose={() => setAction(null)}
          onConfirm={() => void run(action)}
        />
      )}
      {search.dialog === 'reject-reasons' &&
        policy.actions.includes('reject') &&
        !editingBlocked && (
          <RejectReasonsDialog
            onClose={closeDialog}
            onConfirm={(reasons) => {
              setRejectReasons(reasons);
              closeDialog();
              setAction('reject');
            }}
          />
        )}
      {dateAction && (
        <StockCountDateDialog
          today={today}
          action={dateAction === 'authorize' ? 'authorize' : 'submit'}
          value={editor.draft.datePhysicalStockCountCompleted ?? ''}
          onClose={() => setDateAction(null)}
          onConfirm={(date) => {
            editor.form.setFieldValue('draft.datePhysicalStockCountCompleted', date);
            setAction(dateAction);
            setDateAction(null);
          }}
        />
      )}
      {failure && (
        <RequisitionErrorDialog
          error={failure}
          pending={pending}
          onUpdate={() => {
            setFailure(null);
            setAction('update');
          }}
          onClose={() => {
            if (failure.kind === 'forbidden') void run('update');
            else setFailure(null);
          }}
        />
      )}
      {validation && (
        <RequisitionValidationDialog
          allSkipped={validation.allSkipped}
          finalFocus={validation.target || validation.patient ? () => false : undefined}
          onClose={() => {
            const target = validation.target;
            const patient = validation.patient;
            setValidation(null);
            if (patient) {
              void router
                .navigate({ to: '.', state: true, search: { ...search, tab: 'patients' } } as never)
                .then(() => {
                  requestAnimationFrame(() => {
                    const node = document.querySelector<HTMLElement>(`[name="texts.${patient}"]`);
                    if (node) revealField(node, !!node.closest('li'));
                  });
                });
              return;
            }
            if (!target) return;
            const tab = target.fullSupply ? 'fullSupply' : 'nonFullSupply';
            const lines = filterLines(
              currentLines().filter((model) => model.fullSupply === target.fullSupply),
              { hideSkipped: hidesSkipped(record.template, tab) },
            );
            const page =
              Math.floor(
                lines.findIndex((model) => model.line.id === target.id) / (search.detailSize ?? 10),
              ) + 1;
            void router
              .navigate({
                to: '.',
                state: true,
                search: {
                  ...search,
                  tab,
                  product: undefined,
                  skipped: undefined,
                  detailPage: page === 1 ? undefined : page,
                },
              } as never)
              .then(() => {
                const focus = () => {
                  const node = document.querySelector<HTMLElement>(
                    `[name^="quantities.${target.id}:${target.field}."], [name="texts.${target.id}:${target.field}"], [name^="quantities.${target.id}:"], [name^="texts.${target.id}:"]`,
                  );
                  if (node) revealField(node, !!node.closest('li'));
                };
                requestAnimationFrame(focus);
              });
          }}
        />
      )}
      {search.adjustments &&
        policy.editable &&
        !editingBlocked &&
        !editor.locked &&
        (() => {
          const model = currentLines().find((model) => model.line.id === search.adjustments);
          return model ? (
            <AdjustmentsEditorDialog
              model={model}
              reasons={record.stockAdjustmentReasons ?? []}
              unit={unit}
              onClose={closeDialog}
              onSave={(stockAdjustments) => {
                editor.setLine(model.line.id, { stockAdjustments });
                void closeDialog();
              }}
            />
          ) : null;
        })()}
      {search.addProduct && canAdd && !editingBlocked && !editor.locked && (
        <AddProductsDialog
          load={{ identities: record.availableProducts ?? [], select: selectOffered }}
          onClose={closeDialog}
          onSave={(picked) => {
            const nextLines = [
              ...gridRecord.requisitionLineItems,
              ...picked.map((product) => ({
                orderable: { id: product.id, versionNumber: product.meta?.versionNumber ?? 1 },
              })),
            ];
            const options = orderablesByIdentitiesOptions(nextLines.map((line) => line.orderable));
            const combined = new Map(
              [...products, ...picked].map((product) => [product.id, product]),
            );
            queryClient.setQueryData(options.queryKey, [...combined.values()]);
            const models = currentLines();
            editor.form.setFieldValue('draft', (draft) => {
              const lines = { ...draft.lines };
              const addedLines = [...draft.addedLines];
              for (const product of picked) {
                const hidden = models.find(
                  (model) => model.product?.id === product.id && model.line.skipped,
                );
                if (hidden) lines[hidden.line.id] = { ...lines[hidden.line.id], skipped: false };
                else {
                  const entry = product.programs?.findLast(
                    (entry) => entry.programId === record.program.id,
                  );
                  addedLines.push({
                    id: randomId(),
                    orderable: { id: product.id, versionNumber: product.meta?.versionNumber ?? 1 },
                    pricePerPack: entry?.pricePerPack,
                  });
                }
              }
              return { ...draft, lines, addedLines };
            });
            void closeDialog();
          }}
        />
      )}
    </>
  );
}

function RequisitionUpdate({
  tone,
  pending,
  onUpdate,
}: {
  tone: 'warning' | 'info';
  pending: boolean;
  onUpdate: () => void;
}) {
  const { t } = useTranslation();
  const online = useOnline();
  const reason = online ? undefined : t('offline.action-description');
  return (
    <ActionTooltip reason={reason}>
      <Button
        variant={tone}
        disabled={pending || !online}
        focusableWhenDisabled={!online}
        aria-description={reason}
        onClick={onUpdate}
      >
        {t('requisitions.edit.update')}
      </Button>
    </ActionTooltip>
  );
}

function RequisitionPolicyTabs({
  data,
  policy,
  pending,
  ...props
}: {
  data: RequisitionData;
  policy: ReturnType<typeof useRequisitionPolicy>;
  pending: boolean;
} & Omit<ComponentProps<typeof RequisitionTabs>, 'record' | 'supplyingStock' | 'editing'>) {
  const { approver } = policy;
  const columnsKey = policy.editableColumns.join('|');
  const editableColumns = useMemo(() => columnsKey.split('|'), [columnsKey]);
  const editor = props.editor;
  const editable = !!editor && policy.editable;
  const blocked = pending || !!editor?.locked;
  const editing = useMemo(
    () =>
      editor
        ? {
            editor,
            editable,
            pending: blocked,
            editableColumns,
            approver: policy.approver,
            patientsEditable: policy.patientsEditable,
            skipLines: policy.skipLines,
            addFullSupplyProduct: policy.addFullSupplyProduct,
            addNonFullSupplyProduct: policy.addNonFullSupplyProduct,
          }
        : undefined,
    [
      editor,
      editable,
      blocked,
      editableColumns,
      policy.approver,
      policy.patientsEditable,
      policy.skipLines,
      policy.addFullSupplyProduct,
      policy.addNonFullSupplyProduct,
    ],
  );
  return (
    <RequisitionTabs
      {...props}
      record={data.record}
      editing={editing}
      supplyingStock={
        approver && !!data.record.template.columnsMap.supplyingFacilityStockOnHand?.isDisplayed
      }
    />
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
  const approvalNodes = approvalNodesFor(access, record.program.id);
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
  const currentNodes = record.supervisoryNode
    ? [record.supervisoryNode]
    : nodes
        .filter((node) =>
          groups.some(
            ({ data: group }) =>
              group.id === node.requisitionGroup?.id &&
              group.memberFacilities.some(({ id }) => id === record.facility.id),
          ),
        )
        .map(({ id }) => id);
  const { data: unskip } = useQuery({
    ...unskipSettingOptions(),
    enabled: needsUnskipSetting(record),
  });
  const context = capabilityContext(record, access, program, unskip?.unskipRequisition);
  const policies = (currentNodes.length ? currentNodes : [undefined]).map((currentNodeId) =>
    requisitionCapabilities({ ...context, currentNodeId }),
  );
  return {
    ...(policies.find((policy) => policy.editable) ?? policies[0]),
    approver: policies.some((policy) => policy.approver),
  };
}

function RequisitionPrint({
  print,
  disabled = false,
}: {
  print: ReturnType<typeof usePrintReport>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <ActionTooltip reason={print.disabledReason}>
      <Button
        size="lg"
        disabled={disabled || print.offline || print.isPending}
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
    <span className="block h-5 w-64 max-w-full">
      <Skeleton fill />
    </span>
  );
}
function DescriptionSkeleton() {
  return (
    <span className="flex h-5 items-center">
      <span className="block h-4 w-48 max-w-full">
        <Skeleton fill inline />
      </span>
    </span>
  );
}
function PrintPending() {
  const { t } = useTranslation();
  return (
    <Button size="lg" disabled>
      <PrinterIcon data-icon="inline-start" />
      {t('requisitions.requisition.print')}
    </Button>
  );
}
function RequisitionPending() {
  useReloadForUser(
    useLoginData((state) => state.referenceDataUserId),
    requisitionOptions(Route.useParams().requisitionId).queryKey,
  );
  const queryClient = useQueryClient();
  const quantity = useQuantityUnit();
  const search = Route.useSearch();
  const userId = useLoginData((state) => state.referenceDataUserId);
  const record = queryClient.getQueryData(
    requisitionOptions(Route.useParams().requisitionId).queryKey,
  );
  const permissions = userId
    ? queryClient.getQueryData(permissionsOptions(userId).queryKey)
    : undefined;
  const program = useCachedProgram(record?.program.id);
  const unskip = useCachedUnskipSetting();
  const pending = record && permissions && pendingPolicy(record, { permissions }, program, unskip);
  return (
    <>
      <Workspace width="wide">
        <WorkspaceHeader>
          <RequisitionHeadingSkeleton />
          <WorkspaceActions>
            <PrintPending />
          </WorkspaceActions>
        </WorkspaceHeader>
        <WorkspaceContent>
          <div aria-busy className="flex flex-col gap-4">
            <RequisitionHeaderSkeleton record={record} />
            <RequisitionCommentsSkeleton record={record} canComment={pending?.policy.comments} />
            <RequisitionTabsPending
              record={record}
              tab={search.tab}
              showNonFullSupply={pending?.showNonFullSupply}
              editing={pending?.editing}
              supplyingStock={pending?.supplyingStock}
              unit={quantity.unit}
              canSwitch={quantity.canSwitch}
              hideSkipped={!!record && hidesSkipped(record.template, search.tab)}
            />
          </div>
        </WorkspaceContent>
      </Workspace>
      {pending && <RequisitionPendingFooter policy={pending.policy} />}
    </>
  );
}
type PendingAccess = Pick<RequisitionData['access'], 'permissions'> &
  Partial<Pick<RequisitionData['access'], 'user' | 'roles'>>;
function approvalNodesFor(access: PendingAccess, programId: string) {
  if (!access.user || !access.roles) return [];
  return supervisoryNodesWithRight(access.user, access.roles, RIGHTS.requisitionApprove, programId);
}
function capabilityContext(
  record: RequisitionRecord,
  access: PendingAccess,
  program: Program | undefined,
  unskipWhenApproving = false,
) {
  const grants = access.permissions.grants
    .filter(
      (grant) => grant.facilityId === record.facility.id && grant.programId === record.program.id,
    )
    .map(({ right }) => right);
  return {
    ...record,
    program: program
      ? {
          ...program,
          name: program.name ?? undefined,
          showNonFullSupplyTab: program.showNonFullSupplyTab ?? undefined,
        }
      : record.program,
    grants,
    unskipWhenApproving,
    approvalNodes: approvalNodesFor(access, record.program.id),
    isSplit: !!record.extraData?.originalRequisition,
  };
}
function pendingPolicy(
  record: RequisitionRecord,
  access: PendingAccess,
  program: Program | undefined,
  unskipWhenApproving = false,
) {
  const policy = requisitionCapabilities({
    ...capabilityContext(record, access, program, unskipWhenApproving),
    currentNodeId: record.supervisoryNode,
  });
  const editing: PendingEditing = { ...policy, deviceAvailable: isSecureOrigin };
  return {
    policy,
    editing,
    showNonFullSupply: program ? !!program.showNonFullSupplyTab : true,
    supplyingStock:
      policy.approver && !!record.template.columnsMap.supplyingFacilityStockOnHand?.isDisplayed,
  };
}
function useCachedProgram(id: string | undefined) {
  return useQuery({ ...programLookupOptions(id ?? ''), enabled: false }).data;
}
function RequisitionPendingFooter({
  policy,
}: {
  policy: ReturnType<typeof requisitionCapabilities>;
}) {
  if (!policy.editable) return null;
  return <RequisitionFooter policy={policy} pending disabled onAction={() => {}} />;
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

function needsUnskipSetting(record: RequisitionRecord) {
  return ['AUTHORIZED', 'IN_APPROVAL'].includes(record.status);
}
function useCachedUnskipSetting() {
  return useQuery({ ...unskipSettingOptions(), enabled: false }).data?.unskipRequisition;
}
