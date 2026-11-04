import { useQueryClient } from '@tanstack/react-query';
import type { ErrorComponentProps, HistoryState } from '@tanstack/react-router';
import { createFileRoute, useRouterState } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ClipboardCheckIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { ErrorFallback } from '@/components/app-shell/error-fallback';
import { DataTableEmpty } from '@/components/data-table/data-table';
import { serverMessage } from '@/components/display/dialog-parts';
import { DiscardChangesDialog } from '@/components/display/discard-changes-dialog';
import { DraftStatus, DraftStatusSkeleton } from '@/components/display/draft-status';
import { InvalidSubmitDialog } from '@/components/display/invalid-submit-dialog';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceFooter,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import { requireRight } from '@/features/auth/lib/access';
import { supervisoryNodesWithRight } from '@/features/auth/lib/requisition-access';
import { currencySettingsOptions } from '@/features/reference-data/api/queries';
import {
  approveBatchRequisitions,
  fetchBatchRequisitions,
  saveBatchRequisitions,
} from '@/features/requisitions/api/api';
import { batchRequisitionsOptions } from '@/features/requisitions/api/queries';
import { BatchCards } from '@/features/requisitions/components/batch-cards';
import { BatchContext } from '@/features/requisitions/components/batch-context';
import { BatchGrid, type BatchGridHandle } from '@/features/requisitions/components/batch-grid';
import { batchFieldId } from '@/features/requisitions/components/batch-quantity';
import { RemovedCopyDialog } from '@/features/requisitions/components/removed-copy-dialog';
import { RequisitionCopyNotice } from '@/features/requisitions/components/requisition-copy-notice';
import { RequisitionOutdatedAlert } from '@/features/requisitions/components/requisition-outdated-alert';
import { type BatchDrafts, useBatchDrafts } from '@/features/requisitions/hooks/use-batch-drafts';
import {
  batchApprovable,
  batchIds,
  batchLabel,
  batchRows,
  batchSaveBody,
  lineInvalid,
  orderBatch,
  parseBatchResult,
} from '@/features/requisitions/lib/batch';
import {
  type BatchReason,
  batchReason,
  batchReasonText,
} from '@/features/requisitions/lib/batch-reason';
import { recoverBatchApprovals } from '@/features/requisitions/lib/batch-recovery';
import type { BatchResponse } from '@/features/requisitions/lib/batch-types';
import { prepareRequisitionAccess } from '@/features/requisitions/lib/offline-access';
import {
  type BatchMembership,
  captureBatch,
  fetchBatchMembership,
  readBatch,
  verifyBatchMembership,
} from '@/features/requisitions/lib/offline-batch';
import {
  beginCopy,
  confirmBatchApproval,
  RequisitionCopyRemovedError,
  readCopy,
  retireCopy,
} from '@/features/requisitions/lib/offline-copies';
import { useCardLayout } from '@/hooks/use-card-view';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { queryKeys } from '@/lib/key-factory';
import { onlineOrDevice, requireOnline } from '@/lib/local-data';
import { isOnline, useOnline } from '@/lib/online';
import { revealField } from '@/lib/reveal-field';
import { RIGHTS } from '@/lib/rights';
import { isSecureOrigin } from '@/lib/secure-context';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import { uploadAccessEpoch } from '@/lib/upload-access';
import {
  currentApprovalNodes,
  freshRequisitionAccess,
  requireApprovalNode,
} from '@/routes/-requisition-access';

export const Route = createFileRoute('/(protected)/_protected/requisitions/approve_/batch')({
  validateSearch: z.object({ ids: z.string().catch(''), program: z.string().optional() }),
  loaderDeps: ({ search }) => ({ ids: batchIds(search.ids), program: search.program }),
  preload: false,
  loader: async ({ context: { queryClient }, deps: { ids, program } }) => {
    const scope = getSessionScope();
    await prepareRequisitionAccess(queryClient);
    await requireRight(queryClient, RIGHTS.requisitionApprove);
    const leases = isSecureOrigin ? await Promise.all(ids.map(beginCopy)) : [];
    let copyResult: Promise<unknown> | undefined;
    let membership: BatchMembership | undefined;
    const loaded = await onlineOrDevice(
      async () => {
        const [rawResponse, currency, found] = await Promise.all([
          queryClient.fetchQuery(batchRequisitionsOptions(ids)),
          queryClient.ensureQueryData(currencySettingsOptions()),
          fetchBatchMembership(ids, scope, program),
        ]);
        assertSessionScope(scope);
        membership = found;
        const response = verifyBatchMembership(rawResponse, found);
        if (isSecureOrigin) {
          copyResult = captureBatch(leases, response, currency, 'wait', found).then(
            () => undefined,
            (error: unknown) => error,
          );
        }
        return { response, currency, fetchedAt: undefined as number | undefined };
      },
      () => readBatch(ids),
    );
    const fresh = isOnline() && loaded.fetchedAt === undefined;
    const recovered = fresh
      ? await recoverBatchApprovals(ids, loaded.response)
      : { response: loaded.response, removed: new Map<string, string>() };
    return {
      ...loaded,
      response: recovered.response,
      removed: recovered.removed,
      ids,
      copyResult,
      membership,
      copyLeases: leases,
      accessEpoch: fresh ? uploadAccessEpoch() : undefined,
    };
  },
  component: BatchPage,
  pendingComponent: BatchPending,
  errorComponent: BatchError,
  staticData: { crumbKey: 'requisitions.batch.crumb' },
});
function BatchHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <ClipboardCheckIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('requisitions.batch.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('requisitions.batch.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}
function BatchError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  const navigate = Route.useNavigate();
  const state = useRouterState({ select: (s) => s.location.state });
  return (
    <ErrorFallback
      {...props}
      title={t('requisitions.batch.load-error-title')}
      description={t('requisitions.batch.load-error-description')}
      back={
        <Button variant="outline" onClick={() => void navigate(approvalReturn(state))}>
          {t('requisitions.approve.title')}
        </Button>
      }
    />
  );
}
function BatchPending() {
  const { t } = useTranslation();
  return (
    <>
      <Workspace width="wide">
        <BatchHeader />
        <WorkspaceContent>
          <DraftStatusSkeleton />
          <div className="h-128">
            <Skeleton fill />
          </div>
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width="wide">
        <Button size="lg" variant="outline" disabled>
          {t('dialog.cancel')}
        </Button>
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="lg" variant="outline" disabled>
            {t('requisitions.batch.revert')}
          </Button>
          <Button size="lg" variant="outline" disabled>
            {t('requisitions.batch.sync')}
          </Button>
          <Button size="lg" disabled>
            {t('requisitions.batch.approve')}
          </Button>
        </div>
      </WorkspaceFooter>
    </>
  );
}
function BatchDraftStatus({ drafts }: { drafts: BatchDrafts }) {
  const { t } = useTranslation();
  const status = useSyncExternalStore(drafts.subscribeStatus, drafts.getStatus);
  if (status.error instanceof RequisitionCopyRemovedError) return <RemovedCopyDialog />;
  return drafts.deviceAvailable ? (
    <DraftStatus
      {...status}
      labels={{
        copy: null,
        conflictDescription: t('requisitions.edit.draft-conflict-description'),
      }}
      onRetry={drafts.retry}
      onResolve={drafts.resolve}
    />
  ) : (
    <p role="note">{t('requisitions.batch.memory')}</p>
  );
}
function approvalReturn(state: HistoryState) {
  return state.requisitionReturn?.to === '/requisitions/approve' ||
    state.requisitionReturn?.to === '/requisitions/view'
    ? state.requisitionReturn
    : { to: '/requisitions/approve' as const, search: {} };
}
const actionCopy = {
  approve: ['requisitions.batch.approve', 'requisitions.batch.approve-confirm'],
  remove: ['requisitions.batch.remove', 'requisitions.batch.remove-confirm'],
  anyway: ['requisitions.batch.anyway', 'requisitions.batch.anyway-confirm'],
  update: ['requisitions.edit.update', 'requisitions.edit.actions.update-confirm'],
  revert: ['requisitions.batch.revert', 'requisitions.batch.revert-confirm'],
} as const;
type Action = 'approve' | 'revert' | 'anyway' | 'update' | 'remove';
function BatchPage() {
  const search = Route.useSearch();
  const loaded = Route.useLoaderData();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = Route.useNavigate();
  const locationState = useRouterState({ select: (state) => state.location.state });
  const [response, setResponse] = useState(loaded.response);
  const [copyFailure, setCopyFailure] = useState<unknown>();
  const accessEpoch = useRef(loaded.accessEpoch);
  const membership = useRef(loaded.membership);
  const opening = useRef(loaded);
  if (opening.current !== loaded) {
    opening.current = loaded;
    setCopyFailure(undefined);
    membership.current = loaded.membership;
    setResponse(loaded.response);
  }
  const records = response.requisitionDtos;
  const drafts = useBatchDrafts(records);
  const meta = useSyncExternalStore(
    (listener) => drafts.subscribe('meta', listener),
    () => drafts.version('meta'),
  );
  const online = useOnline();
  const layout = useCardLayout<HTMLDivElement>();
  const [reasons, setReasons] = useState(new Map<string, BatchReason>());
  const [action, setAction] = useState<Action | null>(null);
  const [target, setTarget] = useState<string[]>([]);
  const [dialog, setDialog] = useState<string | Map<string, string> | null>(() =>
    loaded.removed.size
      ? [...loaded.removed.values()]
          .map((label) => `${label}: ${t('requisitions.batch.possibly-approved')}`)
          .join('\n')
      : null,
  );
  const [invalid, setInvalid] = useState<string | null>(null);
  const invalidTarget = useRef<string | null>(null);
  const grid = useRef<BatchGridHandle>(null);
  const busy = useRef(false);
  const leaving = useRef(false);
  const dirty = useSyncExternalStore(
    (listener) => drafts.subscribe('dirty', listener),
    drafts.dirty,
  );
  const needsRefresh = useRef<string[]>([]);
  const scope = useRef(getSessionScope()).current;
  const ids = records.map((r) => r.id);
  const unresolved = records.filter((r) => drafts.unresolved(r.id));
  const outdated = records.filter((r) => batchApprovable(r) && drafts.outdated(r.id));
  const returnToList = () => navigate(approvalReturn(locationState));
  const replaceIds = (next: readonly string[]) =>
    navigate({
      to: '/requisitions/approve/batch',
      search: { ids: next.join(','), program: search.program },
      replace: true,
      state: locationState,
    });
  const recordLabel = (id: string) => {
    const record = records.find((r) => r.id === id);
    return record
      ? batchLabel(record)
      : (response.requisitionErrors?.find((error) => error.requisitionId === id)?.label ??
          locationState.requisitionBatchLabels?.[id] ??
          id);
  };
  const report = (failures: Map<string, string>) => {
    setReasons(new Map([...failures].map(([id, message]) => [id, batchReason(message)])));
    if (failures.size) setDialog(failures);
  };
  const refresh = async () => {
    const [result, found] = await Promise.all([
      fetchBatchRequisitions(ids),
      fetchBatchMembership(ids, scope, search.program),
    ]);
    assertSessionScope(scope);
    membership.current = found;
    return orderBatch(verifyBatchMembership(result, found), ids);
  };
  const retireUnavailable = async (fresh: BatchResponse) => {
    const unavailable = records
      .filter((record) => {
        const next = fresh.requisitionDtos?.find((next) => next.id === record.id);
        return next && !batchApprovable(next);
      })
      .map((record) => record.id);
    if (!unavailable.length) return;
    await drafts.clear(unavailable, fresh.requisitionDtos, false);
    drafts.releaseCopies(unavailable);
    if (isSecureOrigin) {
      try {
        for (const id of unavailable) await retireCopy(await beginCopy(id));
      } catch (error) {
        assertSessionScope(scope);
        setCopyFailure(error);
      }
    }
    assertSessionScope(scope);
  };
  const reconcile = async (fresh: BatchResponse) => {
    const removed = ids.filter((id) =>
      drafts.unresolvedChanged(
        id,
        fresh.requisitionDtos?.find((r) => r.id === id),
      ),
    );
    if (removed.length) {
      await drafts.clear(removed, [], false);
      const labels = removed.map(recordLabel).join(', ');
      const description = `${labels}: ${t('requisitions.batch.possibly-approved')}`;
      setDialog(description);
      toast.warning(t('requisitions.batch.status-uncertain'), { description });
    }
    return removed;
  };
  const mutation = useSessionMutation({
    mutationFn: async (kind: 'sync' | Action | 'check') => {
      if (kind !== 'revert' && kind !== 'remove') requireOnline();
      await drafts.flush();
      if (kind !== 'revert' && kind !== 'remove' && accessEpoch.current !== uploadAccessEpoch()) {
        const epoch = uploadAccessEpoch();
        const access = await freshRequisitionAccess(queryClient);
        assertSessionScope(scope);
        for (const record of records) {
          const copy = await readCopy(record.id);
          assertSessionScope(scope);
          if (!copy) {
            if (!loaded.accessEpoch) throw new Error(t('requisitions.offline.failed-description'));
            continue;
          }
          const nodes = copy.summary.supervisoryNode
            ? await currentApprovalNodes(queryClient, access, copy.summary)
            : supervisoryNodesWithRight(
                access.user,
                access.roles,
                RIGHTS.requisitionApprove,
                copy.summary.program.id,
              );
          assertSessionScope(scope);
          requireApprovalNode(nodes);
        }
        if (kind !== 'check') {
          const fresh = await refresh();
          assertSessionScope(scope);
          if (
            records.some((record) => {
              const next = fresh.requisitionDtos?.find((next) => next.id === record.id);
              return (
                !next ||
                next.status !== record.status ||
                next.modifiedDate !== record.modifiedDate ||
                batchApprovable(next) !== batchApprovable(record)
              );
            })
          ) {
            setResponse(fresh);
            throw new Error(t('requisitions.batch.review-refreshed'));
          }
        }
        requireOnline();
        if (epoch !== uploadAccessEpoch())
          throw new Error(t('requisitions.batch.review-refreshed'));
        accessEpoch.current = epoch;
      }
      if (kind === 'revert' || kind === 'update') {
        await drafts.clear(kind === 'update' ? target : ids);
        return;
      }
      if (kind === 'anyway') {
        await drafts.mark(target, false);
        return;
      }
      if (kind === 'remove') {
        const kept = ids.filter((id) => !target.includes(id));
        await drafts.clear(target, [], false);
        if (!kept.length) {
          leaving.current = true;
          await returnToList();
        } else await replaceIds(kept);
        assertSessionScope(scope);
        return;
      }
      if (kind === 'check') {
        const fresh = await refresh();
        const removed = await reconcile(fresh);
        assertSessionScope(scope);
        const kept = ids.filter((id) => !removed.includes(id));
        if (removed.length) {
          if (kept.length) await replaceIds(kept);
          else await returnToList();
          assertSessionScope(scope);
        } else setResponse(orderBatch(fresh, ids));
        return;
      }
      if (needsRefresh.current.length) {
        const fresh = await refresh();
        const affected = needsRefresh.current;
        needsRefresh.current = [];
        setResponse(fresh);
        report(new Map(affected.map((id) => [id, 'requisitions.batch.review-refreshed'])));
        return;
      }
      const failures = new Map<string, string>();
      const eligible = records.filter((r) => {
        const invalidNumber = r.requisitionLineItems.some(
          (l) =>
            lineInvalid(l, drafts.text(r.id, l)) &&
            (kind === 'approve' || drafts.text(r.id, l).trim() !== ''),
        );
        const reason = !batchApprovable(r)
          ? r.approvalAvailable === false
            ? 'requisitions.batch.no-longer-awaiting'
            : 'requisitions.batch.possibly-approved'
          : drafts.unresolved(r.id)
            ? 'requisitions.batch.uncertain'
            : drafts.outdated(r.id)
              ? 'requisitions.edit.outdated-title'
              : invalidNumber
                ? 'requisitions.batch.invalid-requisition'
                : undefined;
        if (reason) failures.set(r.id, reason);
        return !reason;
      });
      if (!eligible.length) {
        report(failures);
        return;
      }
      assertSessionScope(scope);
      let saveResponse: BatchResponse;
      try {
        saveResponse = await saveBatchRequisitions(batchSaveBody(eligible, drafts.quantities()));
        assertSessionScope(scope);
      } catch (error) {
        assertSessionScope(scope);
        needsRefresh.current = eligible.map((r) => r.id);
        try {
          const fresh = await refresh();
          setResponse(fresh);
        } catch {
          assertSessionScope(scope);
        }
        assertSessionScope(scope);
        throw error;
      }
      const save = parseBatchResult(
        saveResponse,
        eligible.map((r) => r.id),
      );
      for (const [id, reason] of save.failed)
        failures.set(id, reason || 'requisitions.batch.save-failed');
      needsRefresh.current = eligible.map((r) => r.id);
      const fresh =
        kind === 'sync' || failures.size ? await refresh() : orderBatch(saveResponse, ids);
      assertSessionScope(scope);
      setResponse(fresh);
      await drafts.clear(save.succeeded, fresh.requisitionDtos, false);
      assertSessionScope(scope);
      if (isSecureOrigin && save.succeeded.length) {
        const leases = loaded.copyLeases.filter((lease) => save.succeeded.includes(lease.id));
        try {
          await captureBatch(
            leases,
            orderBatch(fresh, save.succeeded),
            loaded.currency,
            'read',
            membership.current,
          );
          assertSessionScope(scope);
          setCopyFailure(null);
        } catch (error) {
          assertSessionScope(scope);
          setCopyFailure(error);
        }
      }
      needsRefresh.current = [];
      if (kind === 'sync') {
        report(failures);
        if (save.succeeded.length)
          toast.success(t('requisitions.batch.synced', { count: save.succeeded.length }), {
            description: t('requisitions.batch.synced-description'),
          });
        return;
      }
      const available = new Set(fresh.requisitionDtos?.map((r) => r.id));
      const saved = save.succeeded.filter((id) => available.has(id));
      for (const id of save.succeeded)
        if (!available.has(id))
          failures.set(
            id,
            parseBatchResult(fresh, [id]).failed.get(id) || t('requisitions.batch.missing'),
          );
      let approved: string[] = [];
      if (saved.length) {
        let confirmed = false;
        let resolvedApprovals: string[] = [];
        await drafts.mark(saved, true);
        try {
          const approvalResponse = await approveBatchRequisitions(saved);
          assertSessionScope(scope);
          confirmed = true;
          const approval = parseBatchResult(approvalResponse, saved);
          approved = approval.succeeded;
          setResponse((previous) => ({
            ...previous,
            requisitionDtos: previous.requisitionDtos.map(
              (record) =>
                approvalResponse.requisitionDtos?.find((next) => next.id === record.id) ?? record,
            ),
          }));
          resolvedApprovals = saved.filter(
            (id) =>
              approved.includes(id) ||
              approvalResponse.requisitionErrors?.some((error) => error.requisitionId === id),
          );
          if (isSecureOrigin) {
            try {
              for (const record of approvalResponse.requisitionDtos ?? []) {
                const lease = loaded.copyLeases.find((lease) => lease.id === record.id);
                if (lease && approved.includes(record.id))
                  await confirmBatchApproval(lease, record);
              }
            } catch (error) {
              assertSessionScope(scope);
              setCopyFailure(error);
            }
          }
          let approvedElsewhere = false;
          for (const [id, reason] of approval.failed) {
            const alreadyApproved = approvalResponse.requisitionErrors
              ?.find((e) => e.requisitionId === id)
              ?.errorMessage?.messageKey?.endsWith('requisitionMustBeAuthorized');
            if (alreadyApproved) approvedElsewhere = true;
            failures.set(
              id,
              alreadyApproved
                ? 'requisitions.batch.possibly-approved'
                : reason || 'requisitions.batch.missing',
            );
          }
          if (approvedElsewhere) {
            try {
              const latest = await refresh();
              await retireUnavailable(latest);
              assertSessionScope(scope);
              setResponse(latest);
            } catch (error) {
              assertSessionScope(scope);
              setCopyFailure(error);
            }
          }
        } catch (error) {
          assertSessionScope(scope);
          const uncertain = !isAxiosError(error) || !error.response || error.response.status >= 500;
          if (!uncertain) {
            await drafts.mark(saved, false);
          }
          for (const id of saved)
            failures.set(id, uncertain ? 'requisitions.batch.uncertain' : errorMessage(error));
          try {
            const latest = await refresh();
            await retireUnavailable(latest);
            const removed = await reconcile(latest);
            assertSessionScope(scope);
            setResponse(latest);
            for (const id of removed) failures.delete(id);
          } catch {
            assertSessionScope(scope);
          }
        }
        if (confirmed) {
          await drafts.mark(resolvedApprovals, false);
        }
      }
      await drafts.clear(approved, [], false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.home.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.requisitions.all });
      if (approved.length)
        toast.success(t('requisitions.batch.approved', { count: approved.length }), {
          description: t('requisitions.batch.approved-description'),
        });
      report(failures);
      if (!failures.size) {
        leaving.current = true;
        await returnToList();
      } else {
        await replaceIds(ids.filter((id) => failures.has(id)));
      }
      assertSessionScope(scope);
    },
    onError: (error) => setDialog(errorMessage(error)),
    onSettled: () => {
      busy.current = false;
      setAction(null);
    },
  });
  const run = (kind: Parameters<typeof mutation.mutate>[0]) => {
    if (busy.current) return;
    busy.current = true;
    mutation.mutate(kind);
  };
  const pending = mutation.isPending;
  const guard = useDiscardGuard(dirty, {
    allowLeave: () => leaving.current,
    pending,
    flushBeforeLeave: drafts.deviceAvailable
      ? async () => {
          try {
            await drafts.flush();
            return true;
          } catch {
            return false;
          }
        }
      : undefined,
  });
  const recoveredOpening = useRef(false);
  useEffect(() => {
    if (recoveredOpening.current || !loaded.removed.size) return;
    recoveredOpening.current = true;
    void replaceIds(ids);
  });
  const initialReconcile = useRef(false);
  useEffect(() => {
    if (!online || initialReconcile.current || !drafts.ready() || !unresolved.length) return;
    initialReconcile.current = true;
    if (unresolved.some((r) => drafts.unresolvedChanged(r.id, r))) run('check');
  });
  const context = useMemo(
    () => ({
      records,
      rows: batchRows(records),
      drafts,
      currency: loaded.currency,
      disabled: pending,
      reasons,
    }),
    [records, drafts, loaded.currency, pending, reasons],
  );
  const refused = parseBatchResult(
    response,
    loaded.ids.filter((id) => !loaded.removed.has(id)),
  ).failed;
  const approve = () => {
    const first = records.flatMap((record) =>
      record.requisitionLineItems
        .filter((line) => lineInvalid(line, drafts.text(record.id, line)))
        .map((line) => batchFieldId(record.id, line.id)),
    )[0];
    if (first) {
      invalidTarget.current = first;
      setInvalid(first);
    } else setAction('approve');
  };
  return (
    <>
      <Workspace width="wide">
        <BatchHeader />
        <WorkspaceContent>
          <div ref={layout.measure} className="min-w-0" data-batch-version={meta}>
            <div className="mb-4 flex flex-col gap-3">
              <RequisitionCopyNotice
                representation="batch"
                expected={records.some(batchApprovable)}
                local={loaded.fetchedAt !== undefined}
                id={ids[0]}
                result={loaded.copyResult}
                failure={copyFailure}
              />
              <BatchDraftStatus drafts={drafts} />
              {[...refused].map(([id, reason]) => (
                <Alert key={id} variant="warning">
                  <AlertTitle>{recordLabel(id)}</AlertTitle>
                  <AlertDescription>
                    {reason === 'requisitions.batch.no-longer-awaiting'
                      ? t(reason)
                      : reason ||
                        (reasons.has(id)
                          ? batchReasonText(reasons.get(id), t)
                          : t('requisitions.batch.missing'))}
                  </AlertDescription>
                </Alert>
              ))}
              {outdated.map((r) => (
                <RequisitionOutdatedAlert key={r.id} label={batchLabel(r)}>
                  <Button
                    variant="warning"
                    disabled={pending}
                    onClick={() => {
                      setTarget([r.id]);
                      setAction('update');
                    }}
                  >
                    {t('requisitions.edit.update')}
                  </Button>
                </RequisitionOutdatedAlert>
              ))}
              {unresolved.map((r) => (
                <Alert key={r.id} variant="warning">
                  <AlertTitle>{batchLabel(r)}</AlertTitle>
                  <AlertDescription>{t('requisitions.batch.uncertain')}</AlertDescription>
                  <AlertAction>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="warning"
                        disabled={pending || !online}
                        onClick={() => run('check')}
                      >
                        {t('requisitions.batch.check')}
                      </Button>
                      <Button
                        variant="warning"
                        disabled={pending}
                        onClick={() => {
                          setTarget([r.id]);
                          setAction('anyway');
                        }}
                      >
                        {t('requisitions.batch.anyway')}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={pending}
                        onClick={() => {
                          setTarget([r.id]);
                          setAction('remove');
                        }}
                      >
                        {t('requisitions.batch.remove')}
                      </Button>
                    </div>
                  </AlertAction>
                </Alert>
              ))}
            </div>
            <BatchContext value={context}>
              {!records.length ? (
                <DataTableEmpty
                  title={t('requisitions.approve.empty')}
                  description={t('requisitions.approve.empty-description')}
                  icon={<ClipboardCheckIcon />}
                />
              ) : layout.cards ? (
                <BatchCards />
              ) : (
                <BatchGrid ref={grid} />
              )}
            </BatchContext>
          </div>
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width="wide">
        <Button size="lg" variant="outline" disabled={pending} onClick={() => void returnToList()}>
          {t('dialog.cancel')}
        </Button>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            size="lg"
            variant="outline"
            disabled={pending || !records.length}
            onClick={() => setAction('revert')}
          >
            {t('requisitions.batch.revert')}
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={pending || !online || !records.some(batchApprovable) || !drafts.ready()}
            onClick={() => run('sync')}
          >
            {t('requisitions.batch.sync')}
          </Button>
          <Button
            size="lg"
            disabled={
              pending ||
              !online ||
              !records.some(batchApprovable) ||
              !!unresolved.length ||
              !drafts.ready()
            }
            onClick={approve}
          >
            {t('requisitions.batch.approve')}
          </Button>
        </div>
      </WorkspaceFooter>
      <AlertDialog
        open={!!action}
        onOpenChange={(open) => {
          if (!open && !pending) setAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(actionCopy[action ?? 'revert'][0])}</AlertDialogTitle>
            <AlertDialogDescription>{t(actionCopy[action ?? 'revert'][1])}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t('dialog.cancel')}</AlertDialogCancel>
            <Button disabled={pending} onClick={() => action && run(action)}>
              {t('requisitions.batch.confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <InvalidSubmitDialog
        open={!!invalid}
        title={t('requisitions.batch.invalid-title')}
        description={t('requisitions.batch.invalid-description')}
        closeLabel={t('dialog.close')}
        finalFocus={() => false}
        onOpenChange={(open) => {
          if (!open) setInvalid(null);
        }}
        onOpenChangeComplete={(open) => {
          if (open) return;
          const id = invalidTarget.current ?? '';
          if (grid.current) grid.current.reveal(id);
          const element = document.getElementById(id);
          invalidTarget.current = null;
          if (element) revealField(element, !!element.closest('li'));
        }}
      />
      <InvalidSubmitDialog
        open={!!dialog}
        title={t('requisitions.batch.errors', { count: reasons.size || 1 })}
        description={
          <span className="whitespace-pre-line">
            {dialog instanceof Map
              ? ids
                  .filter((id) => dialog.has(id))
                  .map((id) => {
                    const reason = dialog.get(id);
                    return t('requisitions.batch.failure-line', {
                      requisition: recordLabel(id),
                      reason: batchReasonText(
                        batchReason(reason || 'requisitions.batch.missing'),
                        t,
                      ),
                    });
                  })
                  .join('\n')
              : dialog}
          </span>
        }
        closeLabel={t('dialog.close')}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      />
      <DiscardChangesDialog
        {...guard.dialog}
        description={t('requisitions.edit.discard-description')}
      />
    </>
  );
}
function errorMessage(error: unknown) {
  return serverMessage(error) ?? (error instanceof Error ? error.message : String(error));
}
