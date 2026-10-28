import { useStore } from '@tanstack/react-form';
import { useQueryClient, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, type ErrorComponentProps, useRouter } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ClipboardListIcon, PrinterIcon } from 'lucide-react';
import {
  type ComponentProps,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { ActionTooltip } from '@/components/action-tooltip';
import { serverMessage } from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { ListError } from '@/components/list-error';
import { QueryBoundary } from '@/components/query-boundary';
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
} from '@/components/workspace';
import { permissionsOptions } from '@/features/auth/api/queries';
import { requireRequisitionView } from '@/features/auth/lib/requisition-access';
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
import type { Orderable } from '@/features/reference-data/lib/types';
import {
  authorizeRequisition,
  createRequisitionActionAttempt,
  deleteRequisition,
  fetchRequisition,
  fetchRequisitionReport,
  saveRequisition,
  skipRequisition,
  submitRequisition,
} from '@/features/requisitions/api/api';
import {
  requisitionGridQueries,
  requisitionOptions,
  requisitionStatusMessagesOptions,
} from '@/features/requisitions/api/queries';
import { AddProductsDialog } from '@/features/requisitions/components/add-products-dialog';
import { AdjustmentsEditorDialog } from '@/features/requisitions/components/adjustments-editor-dialog';
import { LegacyActionsNote } from '@/features/requisitions/components/legacy-actions-note';
import {
  type RequisitionAction,
  RequisitionActionDialog,
  RequisitionErrorDialog,
  type RequisitionFailure,
  RequisitionValidationDialog,
} from '@/features/requisitions/components/requisition-action-dialogs';
import { RequisitionComments } from '@/features/requisitions/components/requisition-comments';
import { RequisitionError } from '@/features/requisitions/components/requisition-error';
import {
  type FooterAction,
  RequisitionFooter,
} from '@/features/requisitions/components/requisition-footer';
import { RequisitionHeader } from '@/features/requisitions/components/requisition-header';
import {
  RequisitionCommentsSkeleton,
  RequisitionGridPending,
  RequisitionHeaderSkeleton,
  RequisitionTabsSkeleton,
} from '@/features/requisitions/components/requisition-skeletons';
import { RequisitionTabs } from '@/features/requisitions/components/requisition-tabs';
import { StockCountDateDialog } from '@/features/requisitions/components/stock-count-date-dialog';
import {
  type RequisitionEditor,
  useRequisitionForm,
} from '@/features/requisitions/hooks/use-requisition-form';
import { requisitionCapabilities } from '@/features/requisitions/lib/capabilities';
import {
  applyRequisitionDraft,
  buildRequisitionDraft,
  rebaseRequisitionDraft,
} from '@/features/requisitions/lib/draft';
import { buildLines, filterLines } from '@/features/requisitions/lib/lines';
import { requisitionSearchSchema } from '@/features/requisitions/lib/search-facilities';
import { defaultRequisitionTab, hidesSkipped } from '@/features/requisitions/lib/template';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import { validateRequisition } from '@/features/requisitions/lib/validation';
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
import type { QuantityUnit } from '@/lib/quantity';
import { randomId } from '@/lib/random-id';
import { REQUISITION_STATUS } from '@/lib/requisition-status';
import { revealField } from '@/lib/reveal-field';
import { RIGHTS } from '@/lib/rights';
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
  adjustments: textFilterSchema,
  addProduct: dialogFlag,
});
type RequisitionData = {
  record: RequisitionRecord;
  userId: string;
  access: Awaited<ReturnType<typeof requireRequisitionView>>;
};

const CLOSED_DIALOGS = {
  history: undefined,
  rejection: undefined,
  adjustments: undefined,
  addProduct: undefined,
};
class RequisitionRetryConflict extends Error {}
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
        <RequisitionReadShell data={data}>
          <SectionError {...props} />
        </RequisitionReadShell>
      )}
      pendingFallback={
        <RequisitionReadShell data={data}>
          <RequisitionGridPending
            record={data.record}
            hideSkipped={hidesSkipped(data.record.template)}
          />
        </RequisitionReadShell>
      }
    >
      <RequisitionBody key={`${userId}:${data.record.id}`} data={data} quantity={quantity} />
    </QueryBoundary>
  );
}

function RequisitionReadShell({ data, children }: { data: RequisitionData; children: ReactNode }) {
  const record = data.record;
  const search = Route.useSearch();
  const { openDialog, closeDialog } = useSearchNavigation<typeof search>(CLOSED_DIALOGS);
  return (
    <Workspace width="wide">
      <WorkspaceHeader>
        <QueryBoundary
          resetKey={record.id}
          errorComponent={SectionError}
          pendingFallback={<RequisitionHeadingSkeleton />}
        >
          <RequisitionHeading record={record} />
        </QueryBoundary>
      </WorkspaceHeader>
      <WorkspaceContent>
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
        {children}
      </WorkspaceContent>
    </Workspace>
  );
}

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
  const dialogDraft = useStore(editor.form.store, (state) =>
    search.addProduct || search.adjustments ? state.values.draft : null,
  );
  const current = useMemo(
    () => applyRequisitionDraft(gridRecord, dialogDraft ?? editor.draft),
    [gridRecord, editor, dialogDraft],
  );
  const [{ data: products }, { data: approved }, { data: period }, , { data: program }] =
    useSuspenseQueries({ queries: requisitionGridQueries(current) });
  const models = useMemo(
    () => buildLines(current, products, approved),
    [current, products, approved],
  );
  const [action, setAction] = useState<RequisitionAction | null>(null);
  const [dateAction, setDateAction] = useState<RequisitionAction | null>(null);
  const [validation, setValidation] = useState<{
    allSkipped: boolean;
    target?: { id: string; field: string; fullSupply: boolean };
  } | null>(null);
  const [serverStatus, setServerStatus] = useState<RequisitionRecord['status'] | null>(null);
  const [failure, setFailure] = useState<RequisitionFailure | null>(null);
  const posting = useRef(false);
  const finished = useRef(false);
  const [printPending, setPrintPending] = useState(false);
  const [attempt] = useState(createRequisitionActionAttempt);
  const [busy, setBusy] = useState(false);
  const [synced, setSynced] = useState(false);
  const uncertain = useRef<{
    kind: 'submit' | 'submit-and-authorize' | 'authorize';
    status: RequisitionRecord['status'];
    modifiedDate: RequisitionRecord['modifiedDate'];
  } | null>(null);
  const latest = useRef({ record, editor });
  latest.current = { record, editor };
  const [opening] = useState(() => ({
    to: '/requisitions/view' as const,
    search: requisitionSearchSchema.parse(router.state.location.search),
  }));
  const reload = async () => {
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
    uncertain.current = null;
    setSynced(false);
    attempt.key = randomId();
    return fresh;
  };
  const sync = async () => {
    const scope = getSessionScope();
    await editor.device.flush();
    assertSessionScope(scope);
    requireOnline();
    const sent = applyRequisitionDraft(
      latest.current.record,
      latest.current.editor.form.state.values.draft,
    );
    const saved = await saveRequisition(sent);
    assertSessionScope(scope);
    const next = rebaseRequisitionDraft(saved, latest.current.editor.form.state.values.draft);
    editor.form.setFieldValue('draft', next);
    editor.device.write(next, saved);
    setRecord(saved);
    setSynced(true);
    latest.current = { record: saved, editor };
    queryClient.setQueryData(requisitionOptions(saved.id).queryKey, saved);
    await editor.device.flush();
    assertSessionScope(scope);
    return saved;
  };
  const mutation = useSessionMutation({
    retry: false,
    mutationFn: async (kind: FooterAction | 'update' | 'print') => {
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
        } else await reload();
        assertSessionScope(scope);
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
        const progressed =
          retry.kind === 'authorize'
            ? ['AUTHORIZED', 'IN_APPROVAL', 'APPROVED', 'RELEASED', 'RELEASED_WITHOUT_ORDER']
            : [
                'SUBMITTED',
                'AUTHORIZED',
                'IN_APPROVAL',
                'APPROVED',
                'RELEASED',
                'RELEASED_WITHOUT_ORDER',
              ];
        advanced = progressed.includes(fresh.status);
        if (advanced) {
          setRecord(fresh);
          queryClient.setQueryData(requisitionOptions(record.id).queryKey, fresh);
        } else if (
          fresh.status !== retry.status ||
          !retry.modifiedDate ||
          fresh.modifiedDate !== retry.modifiedDate
        ) {
          throw new RequisitionRetryConflict();
        }
      } else if (
        kind === 'sync' ||
        kind === 'print' ||
        kind === 'submit' ||
        kind === 'submit-and-authorize' ||
        kind === 'authorize'
      ) {
        saved = await sync();
        assertSessionScope(scope);
      }
      requireOnline();
      if (!advanced) {
        if (kind === 'submit' || kind === 'submit-and-authorize' || kind === 'authorize') {
          const base = saved ?? latest.current.record;
          try {
            if (kind === 'authorize') await authorizeRequisition(record.id, attempt);
            else await submitRequisition(record.id, attempt);
          } catch (error) {
            assertSessionScope(scope);
            if (isAxiosError(error) && !error.response)
              uncertain.current = { kind, status: base.status, modifiedDate: base.modifiedDate };
            else uncertain.current = null;
            throw error;
          }
          uncertain.current = null;
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
      toast.success(t(`requisitions.edit.success.${kind}`), {
        description: t(`requisitions.edit.success.${kind}-description`),
      });
      await router.navigate(opening);
      assertSessionScope(scope);
    },
  });
  const run = async (kind: FooterAction | 'update' | 'print') => {
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
      const status = isAxiosError(error) ? error.response?.status : undefined;
      const keyUsed =
        status === 409 &&
        /key.*(already|used)|already.*key/i.test(
          JSON.stringify(isAxiosError(error) ? error.response?.data : ''),
        );
      if (keyUsed) {
        const fresh = await fetchRequisition(record.id).catch(() => undefined);
        if (!mutation.isCurrent()) return false;
        if (fresh) setServerStatus(fresh.status);
        setFailure({ kind: 'key-used' });
      } else
        setFailure(
          status === 409 || error instanceof RequisitionRetryConflict
            ? { kind: 'conflict' }
            : status === 403
              ? { kind: 'forbidden' }
              : {
                  kind: 'server',
                  message:
                    (serverMessage(error) ??
                      (status === 400 && isAxiosError(error)
                        ? Object.values(error.response?.data ?? {})
                            .flatMap((value) =>
                              value &&
                              typeof value === 'object' &&
                              'message' in value &&
                              typeof value.message === 'string'
                                ? [value.message]
                                : [],
                            )
                            .join('\n')
                        : '')) ||
                    t('requisitions.edit.error-description'),
                },
        );
      return false;
    } finally {
      posting.current = false;
      if (mutation.isCurrent()) setBusy(false);
    }
  };
  const pending = busy || mutation.isPending || printPending;
  const editingBlocked = pending || !!uncertain.current;
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
  const begin = (kind: FooterAction) => {
    if (posting.current || pending || finished.current) return;
    if (kind === 'sync') {
      void run(kind);
      return;
    }
    if (kind === 'submit' || kind === 'submit-and-authorize' || kind === 'authorize') {
      editor.form.setFieldValue('showAllErrors', true);
      const current = applyRequisitionDraft(record, editor.draft);
      const models = buildLines(current, products, approved);
      const result = validateRequisition(current, models, {
        monthsInPeriod: period.durationInMonths ?? 1,
        today: new Date().toISOString().slice(0, 10),
      });
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
      if (!record.emergency && program.enableDatePhysicalStockCountCompleted) {
        setDateAction(kind);
        return;
      }
    }
    setAction(kind);
  };

  const { updateSearch, openDialog, closeDialog } =
    useSearchNavigation<typeof search>(CLOSED_DIALOGS);
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
    const existing = new Map(
      models.flatMap((model) => (model.product ? [[model.product.id, model] as const] : [])),
    );
    const candidates = new Map(available.map((product) => [product.id, product]));
    for (const model of models) {
      if (
        model.product &&
        model.line.skipped &&
        hidesSkipped(record.template, model.fullSupply ? 'fullSupply' : 'nonFullSupply')
      )
        candidates.set(model.product.id, { ...model.product, description: null });
    }
    return [...candidates.values()].filter((product) => {
      const entry = product.programs?.findLast((entry) => entry.programId === record.program.id);
      if (!entry || !!entry.fullSupply !== fullSupply) return false;
      const line = existing.get(product.id);
      if (line)
        return (
          !!line.line.skipped &&
          hidesSkipped(record.template, fullSupply ? 'fullSupply' : 'nonFullSupply')
        );
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
              record={record}
              userId={data.userId}
              unit={unit}
              disabled={
                editingBlocked ||
                !!serverStatus ||
                editor.device.outdated ||
                editor.device.status.status === 'loading'
              }
              onPending={setPrintPending}
              beforePrint={policy.actions.includes('sync') ? () => run('print') : undefined}
            />
          </WorkspaceActions>
        </WorkspaceHeader>
        <WorkspaceContent>
          {serverStatus && (
            <Alert variant="info">
              <AlertTitle>{t('requisitions.edit.error.key-used')}</AlertTitle>
              <AlertDescription>{t(REQUISITION_STATUS[serverStatus].labelKey)}</AlertDescription>
              <AlertAction>
                <RequisitionUpdate
                  tone="info"
                  pending={pending}
                  onUpdate={() => void run('update')}
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
                  onUpdate={() => void run('update')}
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
              pendingFallback={null}
            >
              <RequisitionLegacyNote data={currentData} />
            </QueryBoundary>
            <QueryBoundary
              resetKey={record.id}
              errorComponent={SectionError}
              pendingFallback={<RequisitionCommentsSkeleton />}
            >
              <RequisitionEditableComments
                data={currentData}
                pending={editingBlocked}
                editor={editor}
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
                  <RequisitionTabsSkeleton record={record} />
                  <RequisitionGridPending
                    record={record}
                    tab={search.tab}
                    unit={unit}
                    hideSkipped={hidesSkipped(record.template, search.tab)}
                    canSwitch={canSwitch}
                  />
                </>
              }
            >
              <RequisitionPolicyTabs
                data={{ ...data, record: gridRecord }}
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
        disabled={
          !!serverStatus || editor.device.outdated || editor.device.status.status === 'loading'
        }
        onAction={begin}
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
      {dateAction && (
        <StockCountDateDialog
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
          onUpdate={() => void run('update')}
          onClose={() => {
            if (failure.kind === 'forbidden') void run('update');
            else setFailure(null);
          }}
        />
      )}
      {validation && (
        <RequisitionValidationDialog
          allSkipped={validation.allSkipped}
          finalFocus={validation.target ? () => false : undefined}
          onClose={() => {
            const target = validation.target;
            setValidation(null);
            if (!target) return;
            const tab = target.fullSupply ? 'fullSupply' : 'nonFullSupply';
            const lines = filterLines(
              buildLines(applyRequisitionDraft(record, editor.draft), products, approved).filter(
                (model) => model.fullSupply === target.fullSupply,
              ),
              { hideSkipped: hidesSkipped(record.template, tab) },
            );
            const page =
              Math.floor(
                lines.findIndex((model) => model.line.id === target.id) / (search.detailSize ?? 10),
              ) + 1;
            void router
              .navigate({
                to: '.',
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
        !editor.device.outdated &&
        editor.device.status.status !== 'loading' &&
        (() => {
          const model = models.find((model) => model.line.id === search.adjustments);
          return model ? (
            <AdjustmentsEditorDialog
              model={model}
              reasons={record.stockAdjustmentReasons ?? []}
              unit={unit}
              readOnly={
                !policy.editable ||
                editor.device.outdated ||
                !!record.template.populateStockOnHandFromStockCards
              }
              onClose={closeDialog}
              onSave={(stockAdjustments) => {
                editor.setLine(model.line.id, { stockAdjustments });
                void closeDialog();
              }}
            />
          ) : null;
        })()}
      {search.addProduct &&
        canAdd &&
        !editingBlocked &&
        !editor.device.outdated &&
        editor.device.status.status !== 'loading' && (
          <AddProductsDialog
            products={[]}
            load={{ identities: record.availableProducts ?? [], select: selectOffered }}
            onClose={closeDialog}
            onSave={(picked) => {
              const nextLines = [
                ...gridRecord.requisitionLineItems,
                ...picked.map((product) => ({
                  orderable: { id: product.id, versionNumber: product.meta?.versionNumber ?? 1 },
                })),
              ];
              const options = orderablesByIdentitiesOptions(
                nextLines.map((line) => line.orderable),
              );
              const combined = new Map(
                [...products, ...picked].map((product) => [product.id, product]),
              );
              queryClient.setQueryData(options.queryKey, [...combined.values()]);
              for (const product of picked) {
                const hidden = models.find(
                  (model) => model.product?.id === product.id && model.line.skipped,
                );
                if (hidden) editor.setLine(hidden.line.id, { skipped: false });
                else {
                  const entry = product.programs?.findLast(
                    (entry) => entry.programId === record.program.id,
                  );
                  editor.form.setFieldValue('draft.addedLines', (lines) => [
                    ...lines,
                    {
                      id: randomId(),
                      orderable: {
                        id: product.id,
                        versionNumber: product.meta?.versionNumber ?? 1,
                      },
                      pricePerPack: entry?.pricePerPack,
                    },
                  ]);
                }
              }
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

function RequisitionEditableComments({
  data,
  editor,
  pending,
  ...props
}: { data: RequisitionData; editor: RequisitionEditor; pending: boolean } & ComponentProps<
  typeof RequisitionComments
>) {
  return (
    <QueryBoundary
      resetKey={data.record.id}
      pendingFallback={<RequisitionComments {...props} />}
      errorComponent={() => <RequisitionComments {...props} />}
    >
      <PolicyComments data={data} editor={editor} pending={pending} {...props} />
    </QueryBoundary>
  );
}
function PolicyComments({
  data,
  editor,
  pending,
  ...props
}: { data: RequisitionData; editor: RequisitionEditor; pending: boolean } & ComponentProps<
  typeof RequisitionComments
>) {
  const policy = useRequisitionPolicy(data);
  return (
    <RequisitionComments
      {...props}
      editor={
        !pending &&
        policy.comments &&
        !editor.device.outdated &&
        editor.device.status.status !== 'loading'
          ? editor
          : undefined
      }
    />
  );
}

function RequisitionLegacyNote({ data }: { data: RequisitionData }) {
  const { deferred } = useRequisitionPolicy(data);
  return deferred ? <LegacyActionsNote requisitionId={data.record.id} /> : null;
}

function RequisitionPolicyTabs({
  data,
  pending,
  ...props
}: { data: RequisitionData; pending: boolean } & Omit<
  ComponentProps<typeof RequisitionTabs>,
  'record' | 'supplyingStock' | 'editing'
>) {
  const policy = useRequisitionPolicy(data);
  const { approver } = policy;
  const columnsKey = policy.editableColumns.join('|');
  const editableColumns = useMemo(() => columnsKey.split('|'), [columnsKey]);
  const editor = props.editor;
  const editable =
    !!editor &&
    !pending &&
    policy.editable &&
    !editor.device.outdated &&
    editor.device.status.status !== 'loading';
  const editing = useMemo(
    () =>
      editor
        ? {
            editor,
            editable,
            editableColumns,
            skipLines: policy.skipLines,
            addFullSupplyProduct: policy.addFullSupplyProduct,
            addNonFullSupplyProduct: policy.addNonFullSupplyProduct,
          }
        : undefined,
    [
      editor,
      editable,
      editableColumns,
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
    ...(policies.find((policy) => policy.editable) ?? policies[0]),
    deferred: policies.some((policy) => policy.deferred.length > 0),
    approver: policies.some((policy) => policy.approver),
  };
}

function RequisitionPrint({
  record,
  userId,
  unit,
  disabled = false,
  beforePrint,
  onPending,
}: {
  disabled?: boolean;
  beforePrint?: () => Promise<boolean>;
  onPending?: (pending: boolean) => void;
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
    beforeRequest: beforePrint,
    request: (lang) => fetchRequisitionReport(record.id, { showInDoses: unit === 'DOSES', lang }),
    onReport: () =>
      openReport(`requisition_${record.id}.pdf`, t('requisitions.requisition.print-loading')),
    successTitle: t('requisitions.requisition.printed-title'),
    successDescription: t('requisitions.requisition.printed'),
    errorTitle: t('requisitions.requisition.print-error-title'),
    errorDescription: t('requisitions.requisition.print-error'),
    refusedDescription: t('requisitions.requisition.print-refused'),
  });
  useEffect(() => {
    onPending?.(print.isPending);
  }, [onPending, print.isPending]);
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
    <Workspace width="wide">
      <WorkspaceHeader>
        <RequisitionHeadingSkeleton />
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
