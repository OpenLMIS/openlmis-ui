import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';
import { WifiOffIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorAlert } from '@/components/display/dialog-parts';
import { InvalidSubmitDialog } from '@/components/display/invalid-submit-dialog';
import {
  FormDialog,
  FormDialogCancel,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogForm,
  FormDialogHeader,
  FormDialogSubmit,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { ActionTooltip } from '@/components/shared/action-tooltip';
import { Button } from '@/components/ui/button';
import { WorkspaceFooterPortal } from '@/components/workspace/workspace-tabs';
import { fetchLotsByTradeItemAndCode } from '@/features/reference-data/api/api';
import {
  createPhysicalInventoryLot,
  deletePhysicalInventory,
  fetchPhysicalInventoryDraft,
  fetchPhysicalInventoryReport,
  savePhysicalInventory,
  submitPhysicalInventory,
} from '@/features/stock-events/api/physical-inventory-api';
import {
  eligibleInventoryProductsOptions,
  inventoryRefreshFilters,
  physicalInventoryDraftOptions,
} from '@/features/stock-events/api/physical-inventory-queries';
import { InventoryOccurredDateDialog } from '@/features/stock-events/components/inventory-occurred-date-dialog';
import {
  inventorySavePayload,
  inventorySubmitPayload,
  validateInventory,
} from '@/features/stock-events/lib/physical-inventory-form';
import {
  eligibleInventoryLines,
  inventoryLocalCopy,
} from '@/features/stock-events/lib/physical-inventory-lines';
import {
  readInventoryLocal,
  reconcileInventoryCopies,
  type writeInventoryLocal,
} from '@/features/stock-events/lib/physical-inventory-local';
import {
  createInventoryLots,
  InventoryLotError,
} from '@/features/stock-events/lib/physical-inventory-lots';
import type {
  InventoryLine,
  PhysicalInventoryDraft,
} from '@/features/stock-events/lib/physical-inventory-types';
import { usePrintReport } from '@/hooks/use-print-report';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import {
  apiErrorText,
  isApiTimeout,
  isSilentApiError,
  isWriteApiTimeout,
  keyedApiErrorText,
  serverMessage,
  serverMessageKey,
} from '@/lib/api-error';
import { DraftConflictError } from '@/lib/draft-store';
import { isAccessFallbackError, isOfflineError } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
import { requireOnline } from '@/lib/local-data';
import { isOnline, useOnline } from '@/lib/online';
import { openReport } from '@/lib/open-report';
import { reportApiError, reportCaughtError } from '@/lib/report-error';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

class UnknownSubmit extends Error {}
class InventoryOrphaned extends Error {
  constructor(readonly keptCounts: boolean) {
    super();
  }
}
function reportUnlessConflict(error: unknown) {
  if (error instanceof DraftConflictError) throw error;
  reportCaughtError(error, {});
}
function inventoryKeepOpenText(error: unknown, t: TFunction) {
  if (isWriteApiTimeout(error)) return t('physical-inventory.save-timeout-keep-open');
  if (!isApiTimeout(error) && !isOfflineError(error) && !isAccessFallbackError(error)) {
    const key = serverMessageKey(error);
    const refusal = key && keyedApiErrorText(key, serverMessage(error), t)?.trimEnd();
    if (refusal) {
      const punctuation = /[.!?؟。！？]$/.test(refusal) ? '' : '.';
      return `${refusal}${punctuation} ${t('physical-inventory.counts-only-on-page')}`;
    }
  }
  return t('physical-inventory.save-error-keep-open');
}
type Action =
  | { type: 'save' }
  | { type: 'delete' }
  | { type: 'submit'; occurredDate: string; signature: string };
type Props = {
  draft: PhysicalInventoryDraft;
  eligibleUpdatedAfter?: number;
  baseline: readonly Pick<InventoryLine, 'key'>[];
  right: string;
  getLines: () => InventoryLine[];
  displayed: readonly InventoryLine[];
  includeInactive: boolean;
  userId: string;
  username: string;
  showInDoses: boolean;
  disabled: boolean;
  writeDisabled?: boolean;
  conflicted?: boolean;
  writeDisabledReason?: string;
  flush: () => Promise<void>;
  clearLocal: (draftId: string) => Promise<void>;
  writeLocal: (copy: Parameters<typeof writeInventoryLocal>[0]) => Promise<unknown>;
  onBusy: (busy: boolean) => void;
  onOrphaned?: () => void;
  onLots: (lines: InventoryLine[]) => void;
  onSaved: (lines: InventoryLine[], terminal: boolean, localSaved: boolean) => void;
  onDialogChange: (open: boolean) => void;
  onInvalid: (lines: readonly InventoryLine[]) => void;
  onDeleted: () => void | Promise<void>;
  onSubmitted: () => void | Promise<void>;
};
type Attempt = { action: Action; countsOnDevice?: boolean };
type Failure = { title: string; description: string; offline?: boolean };
const ACTION_KEYS = {
  save: {
    errorTitle: 'physical-inventory.save-error-title',
    successTitle: 'physical-inventory.saved-title',
    successDescription: 'physical-inventory.saved-description',
  },
  delete: {
    errorTitle: 'physical-inventory.delete-error-title',
    errorDescription: 'error.description',
    successTitle: 'physical-inventory.deleted-title',
    successDescription: 'physical-inventory.deleted-description',
    localClearError: 'physical-inventory.delete-local-clear-error',
  },
  submit: {
    errorTitle: 'physical-inventory.submit-error-title',
    errorDescription: 'error.description',
    successTitle: 'physical-inventory.submitted-title',
    successDescription: 'physical-inventory.submitted-description',
    localClearError: 'physical-inventory.submit-local-clear-error',
  },
} as const;
export function InventoryActions(props: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const online = useOnline();
  const offlineReason = !online ? t('offline.action-description') : undefined;
  const eligibleOptions = eligibleInventoryProductsOptions(props.draft, props.eligibleUpdatedAfter);
  const eligibleFetching = useIsFetching({ queryKey: eligibleOptions.queryKey }) > 0;
  const [dialog, setDialog] = useState<'save' | 'delete' | 'submit' | 'print' | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [failureCopy, setFailureCopy] = useState(failure);
  const showFailure = (next: Failure) => {
    setFailure(next);
    setFailureCopy(next);
  };
  const showOffline = () =>
    showFailure({
      title: t('physical-inventory.submit-offline-title'),
      description: t('physical-inventory.submit-offline-description'),
      offline: true,
    });
  const invalidLines = useRef<readonly InventoryLine[] | null>(null);
  const submitButton = useRef<HTMLButtonElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const [unknown, setUnknown] = useState(false);
  const [confirmType, setConfirmType] = useState<'save' | 'delete'>('save');
  const openConfirm = (type: 'save' | 'delete') => {
    setConfirmType(type);
    setDialog(type);
  };
  const closePrint = () => {
    setDialog(null);
    void props.onSubmitted();
  };
  useEffect(
    () => props.onDialogChange(dialog !== null || !!failure),
    [dialog, failure, props.onDialogChange],
  );
  const posting = useRef(false);
  const finished = useRef(false);
  const mutation = useSessionMutation({
    retry: false,
    mutationFn: async (attempt: Attempt) => {
      const { action } = attempt;
      const scope = getSessionScope();
      const check = () => {
        assertSessionScope(scope);
        requireOnline();
      };
      check();
      try {
        await props.flush();
        attempt.countsOnDevice = true;
      } catch (error) {
        attempt.countsOnDevice = false;
        reportUnlessConflict(error);
      }
      assertSessionScope(scope);
      try {
        const local = await readInventoryLocal(props.draft.id);
        assertSessionScope(scope);
        if (local?.orphaned) throw new DraftConflictError(local);
      } catch (error) {
        assertSessionScope(scope);
        reportUnlessConflict(error);
      }
      check();
      if (action.type === 'delete') {
        await deletePhysicalInventory(props.draft.id);
        return [];
      }
      const requestedAt = Date.now();
      const current = await fetchPhysicalInventoryDraft(props.draft);
      check();
      try {
        await reconcileInventoryCopies(props.draft, current?.id, requestedAt);
      } catch (error) {
        if (!(error instanceof DraftConflictError)) reportCaughtError(error, {});
      }
      check();
      if (current?.id !== props.draft.id) {
        props.onOrphaned?.();
        await queryClient.invalidateQueries({ queryKey: queryKeys.physicalInventories.all });
        check();
        const earlier = await readInventoryLocal(props.draft.id).catch(() => undefined);
        check();
        throw new InventoryOrphaned(Boolean(earlier?.modified));
      }
      const eligible = await queryClient.fetchQuery(eligibleOptions);
      check();
      const lines = eligibleInventoryLines(props.getLines(), eligible);
      if (
        action.type === 'submit' &&
        validateInventory(lines, props.displayed, props.includeInactive).kind !== 'valid'
      )
        throw new Error(t('physical-inventory.invalid-description'));
      const prepared = await createInventoryLots(
        lines,
        (tradeItemId, lotCode) => {
          check();
          return fetchLotsByTradeItemAndCode(tradeItemId, lotCode);
        },
        (body) => {
          check();
          return createPhysicalInventoryLot(body);
        },
        async (next) => {
          assertSessionScope(scope);
          props.onLots(next);
          try {
            await props.writeLocal(inventoryLocalCopy(props.draft, next, props.baseline));
            attempt.countsOnDevice = true;
          } catch (error) {
            reportUnlessConflict(error);
          }
          assertSessionScope(scope);
        },
      );
      check();
      if (action.type === 'save') {
        const saved = inventorySavePayload(props.draft, prepared, eligible);
        await savePhysicalInventory(saved);
        assertSessionScope(scope);
        queryClient.setQueryData(
          physicalInventoryDraftOptions(
            { facilityId: props.draft.facilityId, programId: props.draft.programId },
            true,
          ).queryKey,
          saved,
        );
      } else {
        try {
          await submitPhysicalInventory(
            inventorySubmitPayload(props.draft, prepared, action.occurredDate, action.signature),
          );
        } catch (error) {
          if (isAxiosError(error) && !error.response && !isSilentApiError(error))
            throw new UnknownSubmit();
          throw error;
        }
      }
      assertSessionScope(scope);
      return prepared;
    },
  });
  const print = usePrintReport({
    userId: props.userId,
    facilityId: props.draft.facilityId,
    programId: props.draft.programId,
    right: props.right,
    request: (lang) => fetchPhysicalInventoryReport(props.draft.id, props.showInDoses, lang),
    onReport: () =>
      openReport(`physical_inventory_${props.draft.id}.pdf`, t('physical-inventory.print-loading')),
    successTitle: t('physical-inventory.printed-title'),
    successDescription: t('physical-inventory.printed-description'),
    errorTitle: t('physical-inventory.print-error-title'),
    errorDescription: t('error.description'),
    refusedDescription: t('physical-inventory.print-refused'),
  });
  const submit = () => {
    const validation = validateInventory(props.getLines(), props.displayed, props.includeInactive);
    if (validation.kind === 'inactive') {
      showFailure({
        title: t('physical-inventory.inactive-title'),
        description: t('physical-inventory.inactive-description'),
      });
    } else if (validation.kind === 'invalid') {
      invalidLines.current = validation.lines;
      showFailure({
        title: t('physical-inventory.invalid-title'),
        description: t('physical-inventory.invalid-description'),
      });
    } else if (!isOnline()) {
      showOffline();
    } else setDialog('submit');
  };
  const confirm = async (action: Action) => {
    if (posting.current || finished.current || (action.type === 'submit' && unknown)) return;
    posting.current = true;
    props.onBusy(true);
    const attempt: Attempt = { action };
    let next: InventoryLine[];
    try {
      next = await mutation.mutateAsync(attempt);
    } catch (error) {
      if (!mutation.isCurrent()) return;
      const cause = error instanceof InventoryLotError ? error.cause : error;
      if (isSilentApiError(cause)) {
        setDialog(null);
        props.onBusy(false);
        posting.current = false;
        return;
      }
      if (
        !(
          cause instanceof DraftConflictError ||
          cause instanceof InventoryOrphaned ||
          cause instanceof UnknownSubmit
        )
      )
        reportApiError(cause);
      const keepOpen = action.type === 'save' && attempt.countsOnDevice === false;
      if (
        !keepOpen &&
        !(error instanceof UnknownSubmit) &&
        !isApiTimeout(cause) &&
        (isOfflineError(error) || !isOnline())
      ) {
        if (action.type === 'submit') showOffline();
        else
          toast.error(t(ACTION_KEYS[action.type].errorTitle), {
            description: t('offline.action-description'),
          });
        setDialog(null);
        props.onBusy(false);
        posting.current = false;
        return;
      }
      const fallback =
        action.type === 'save'
          ? 'physical-inventory.save-error-description'
          : ACTION_KEYS[action.type].errorDescription;
      let description: string | null;
      if (error instanceof InventoryOrphaned)
        description = t(
          error.keptCounts
            ? 'physical-inventory.orphaned-action'
            : 'physical-inventory.no-draft-description',
        );
      else if (error instanceof InventoryLotError)
        description =
          error.reason === 'duplicate'
            ? t('physical-inventory.lot-duplicate-error', { codes: error.codes.join(', ') })
            : error.reason === 'trade-item'
              ? t('physical-inventory.lot-trade-item-error', { codes: error.codes.join(', ') })
              : t('physical-inventory.lot-error', {
                  codes: error.codes.join(', '),
                  message: keepOpen
                    ? isWriteApiTimeout(cause)
                      ? t('physical-inventory.lot-timeout-keep-open')
                      : inventoryKeepOpenText(cause, t)
                    : apiErrorText(cause, fallback, t),
                });
      else if (keepOpen) description = inventoryKeepOpenText(cause, t);
      else description = apiErrorText(error, fallback, t);
      if (error instanceof UnknownSubmit) {
        setUnknown(true);
        description = t('physical-inventory.unknown-outcome-description');
      }
      if (description !== null)
        showFailure({
          title: t(
            error instanceof UnknownSubmit
              ? 'stock-events.unknown-outcome-title'
              : ACTION_KEYS[action.type].errorTitle,
          ),
          description,
        });
      setDialog(null);
      props.onBusy(false);
      posting.current = false;
      return;
    }
    if (!mutation.isCurrent()) return;
    if (action.type !== 'save') finished.current = true;
    let localSaved = true;
    try {
      if (action.type === 'save')
        await props.writeLocal(inventoryLocalCopy(props.draft, next, next, false));
      else await props.clearLocal(props.draft.id);
    } catch (error) {
      localSaved = false;
      if (!(error instanceof DraftConflictError)) reportCaughtError(error, {});
      if (mutation.isCurrent() && action.type !== 'save')
        toast.error(t('physical-inventory.local-clear-error-title'), {
          description: t(ACTION_KEYS[action.type].localClearError),
        });
    }
    if (!mutation.isCurrent()) return;
    if (action.type !== 'delete') props.onSaved(next, action.type !== 'save', localSaved);
    const filters =
      action.type === 'submit'
        ? [
            queryKeys.physicalInventories.all,
            queryKeys.stockEvents.all,
            queryKeys.stockCardSummaries.all,
            queryKeys.stockCards.all,
          ].map((queryKey) => ({ queryKey }))
        : inventoryRefreshFilters(props.draft, action.type !== 'save');
    for (const filter of filters) void queryClient.invalidateQueries(filter);
    toast.success(t(ACTION_KEYS[action.type].successTitle), {
      description: t(ACTION_KEYS[action.type].successDescription),
    });
    setDialog(action.type === 'submit' ? 'print' : null);
    props.onBusy(false);
    posting.current = false;
    if (action.type === 'delete') await props.onDeleted();
  };
  const writeReason = props.writeDisabledReason ?? offlineReason;
  const deleteReason = props.conflicted ? props.writeDisabledReason : offlineReason;
  const disabled = props.disabled || mutation.isPending || finished.current;
  return (
    <>
      {unknown && (
        <ErrorAlert
          title={t('stock-events.unknown-outcome-title')}
          description={t('physical-inventory.unknown-outcome-description')}
        />
      )}
      <WorkspaceFooterPortal width="wide">
        <ActionTooltip reason={deleteReason}>
          <Button
            size="lg"
            variant="destructive"
            disabled={disabled || props.conflicted || !online}
            focusableWhenDisabled={!!deleteReason}
            aria-description={deleteReason}
            onClick={() => openConfirm('delete')}
          >
            {t('physical-inventory.delete')}
          </Button>
        </ActionTooltip>
        <div className="flex flex-wrap justify-end gap-2">
          <ActionTooltip reason={writeReason}>
            <Button
              ref={saveButton}
              size="lg"
              variant="outline"
              disabled={disabled || props.writeDisabled || eligibleFetching || !online}
              focusableWhenDisabled={!!writeReason}
              aria-description={writeReason}
              onClick={() => openConfirm('save')}
            >
              {t('physical-inventory.save')}
            </Button>
          </ActionTooltip>
          <ActionTooltip reason={props.writeDisabledReason}>
            <Button
              ref={submitButton}
              size="lg"
              disabled={disabled || props.writeDisabled || eligibleFetching || unknown}
              focusableWhenDisabled={!!props.writeDisabledReason}
              aria-description={props.writeDisabledReason}
              onClick={submit}
            >
              {t('stock-events.submit')}
            </Button>
          </ActionTooltip>
        </div>
      </WorkspaceFooterPortal>
      <InvalidSubmitDialog
        open={!!failure}
        onOpenChange={(open) => {
          if (!open) setFailure(null);
        }}
        finalFocus={() => {
          const invalid = invalidLines.current;
          if (invalid) {
            if (failure) return false;
            invalidLines.current = null;
            props.onInvalid(invalid);
            return false;
          }
          return unknown ? saveButton.current : submitButton.current;
        }}
        title={failureCopy?.title}
        description={failureCopy?.description}
        closeLabel={t('dialog.close')}
        media={failureCopy?.offline ? <WifiOffIcon /> : undefined}
      />
      <FormDialog
        open={dialog === 'save' || dialog === 'delete'}
        closeButton={!mutation.isPending}
        onOpenChange={(open) => {
          if (!open && !posting.current) setDialog(null);
        }}
      >
        <FormDialogForm
          onSubmit={() => {
            if (dialog === 'save' || dialog === 'delete') void confirm({ type: dialog });
          }}
        >
          <FormDialogHeader>
            <FormDialogTitle>
              {t(
                confirmType === 'delete' ? 'physical-inventory.delete' : 'physical-inventory.save',
              )}
            </FormDialogTitle>
            <FormDialogDescription>
              {t(
                confirmType === 'delete'
                  ? 'physical-inventory.delete-confirm'
                  : 'physical-inventory.save-confirm',
              )}
            </FormDialogDescription>
          </FormDialogHeader>
          <FormDialogFooter>
            <FormDialogCancel disabled={mutation.isPending}>
              {t('stock-events.cancel')}
            </FormDialogCancel>
            <FormDialogSubmit pending={mutation.isPending}>
              {t(
                confirmType === 'delete' ? 'physical-inventory.delete' : 'physical-inventory.save',
              )}
            </FormDialogSubmit>
          </FormDialogFooter>
        </FormDialogForm>
      </FormDialog>
      {dialog === 'submit' && (
        <InventoryOccurredDateDialog
          pending={mutation.isPending}
          username={props.username}
          onClose={() => setDialog(null)}
          onConfirm={(value) => confirm({ type: 'submit', ...value })}
        />
      )}
      <FormDialog
        open={dialog === 'print'}
        onOpenChange={(open) => {
          if (!open) closePrint();
        }}
      >
        <FormDialogHeader>
          <FormDialogTitle>{t('physical-inventory.print-title')}</FormDialogTitle>
          <FormDialogDescription>{t('physical-inventory.print-description')}</FormDialogDescription>
        </FormDialogHeader>
        <FormDialogFooter>
          <Button variant="outline" onClick={closePrint}>
            {t('physical-inventory.no')}
          </Button>
          <ActionTooltip reason={print.disabledReason}>
            <Button
              disabled={print.offline}
              focusableWhenDisabled={print.offline}
              aria-description={print.disabledReason}
              onClick={() => {
                print.print();
                closePrint();
              }}
            >
              {t('physical-inventory.print')}
            </Button>
          </ActionTooltip>
        </FormDialogFooter>
      </FormDialog>
    </>
  );
}
