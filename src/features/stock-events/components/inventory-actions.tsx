import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { CircleAlertIcon, WifiOffIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ActionTooltip } from '@/components/action-tooltip';
import { ErrorAlert, serverMessage } from '@/components/dialog-parts';
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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { WorkspaceFooterPortal } from '@/components/workspace-tabs';
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
import { DraftConflictError } from '@/lib/draft-store';
import { isOfflineError } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
import { requireOnline } from '@/lib/local-data';
import { isOnline, useOnline } from '@/lib/online';
import { openReport } from '@/lib/open-report';
import { reportCaughtError } from '@/lib/report-error';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

class UnknownSubmit extends Error {}
class InventoryOrphaned extends Error {}
function reportUnlessConflict(error: unknown) {
  if (error instanceof DraftConflictError) throw error;
  reportCaughtError(error, {});
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
  onLots: (lines: InventoryLine[]) => void;
  onSaved: (lines: InventoryLine[], terminal: boolean, localSaved: boolean) => void;
  onDialogChange: (open: boolean) => void;
  onInvalid: (lines: readonly InventoryLine[]) => void;
  onDeleted: () => void | Promise<void>;
  onSubmitted: () => void | Promise<void>;
};
type Failure = { title: string; description: string; offline?: boolean };
const ACTION_KEYS = {
  save: {
    errorTitle: 'physical-inventory.save-error-title',
    errorDescription: 'physical-inventory.save-error-description',
    successTitle: 'physical-inventory.saved-title',
    successDescription: 'physical-inventory.saved-description',
  },
  delete: {
    errorTitle: 'physical-inventory.delete-error-title',
    errorDescription: 'physical-inventory.delete-error-description',
    successTitle: 'physical-inventory.deleted-title',
    successDescription: 'physical-inventory.deleted-description',
    localClearError: 'physical-inventory.delete-local-clear-error',
  },
  submit: {
    errorTitle: 'physical-inventory.submit-error-title',
    errorDescription: 'physical-inventory.submit-error-description',
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
    mutationFn: async (action: Action) => {
      const scope = getSessionScope();
      const check = () => {
        assertSessionScope(scope);
        requireOnline();
      };
      check();
      try {
        await props.flush();
      } catch (error) {
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
      if (current?.id !== props.draft.id) {
        try {
          await reconcileInventoryCopies(props.draft, current?.id, requestedAt);
        } catch (error) {
          reportCaughtError(error, {});
        }
        check();
        await queryClient.invalidateQueries({ queryKey: queryKeys.physicalInventories.all });
        check();
        throw new InventoryOrphaned();
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
        (body) => {
          check();
          return createPhysicalInventoryLot(body);
        },
        async (next) => {
          assertSessionScope(scope);
          props.onLots(next);
          try {
            await props.writeLocal(inventoryLocalCopy(props.draft, next, props.baseline));
          } catch (error) {
            reportUnlessConflict(error);
          }
          assertSessionScope(scope);
        },
      );
      check();
      if (action.type === 'save')
        await savePhysicalInventory(inventorySavePayload(props.draft, prepared, eligible));
      else {
        try {
          await submitPhysicalInventory(
            inventorySubmitPayload(props.draft, prepared, action.occurredDate, action.signature),
          );
        } catch (error) {
          if (isAxiosError(error) && !error.response) throw new UnknownSubmit();
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
    errorDescription: t('physical-inventory.print-error-description'),
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
    let next: InventoryLine[];
    try {
      next = await mutation.mutateAsync(action);
    } catch (error) {
      if (!mutation.isCurrent()) return;
      if (!(error instanceof UnknownSubmit) && (isOfflineError(error) || !isOnline())) {
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
      let description = serverMessage(error) ?? t(ACTION_KEYS[action.type].errorDescription);
      if (error instanceof InventoryOrphaned) description = t('physical-inventory.orphaned-counts');
      if (error instanceof InventoryLotError)
        description =
          error.reason === 'duplicate'
            ? t('physical-inventory.lot-duplicate-error', { codes: error.codes.join(', ') })
            : error.reason === 'trade-item'
              ? t('physical-inventory.lot-trade-item-error', { codes: error.codes.join(', ') })
              : t('physical-inventory.lot-error', {
                  codes: error.codes.join(', '),
                  message: serverMessage(error.cause) ?? description,
                });
      if (error instanceof UnknownSubmit) {
        setUnknown(true);
        description = t('physical-inventory.unknown-outcome-description');
      }
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
      reportCaughtError(error, {});
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
        : inventoryRefreshFilters(props.draft);
    for (const filter of filters) void queryClient.invalidateQueries(filter);
    toast.success(t(ACTION_KEYS[action.type].successTitle), {
      description: t(ACTION_KEYS[action.type].successDescription),
    });
    setDialog(action.type === 'submit' ? 'print' : null);
    if (action.type === 'save' && isOnline()) {
      try {
        await queryClient.fetchQuery({
          ...physicalInventoryDraftOptions({
            programId: props.draft.programId,
            facilityId: props.draft.facilityId,
          }),
          staleTime: 0,
        });
      } catch (error) {
        reportCaughtError(error, {});
      }
      if (!mutation.isCurrent()) return;
    }
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
      <AlertDialog
        open={!!failure}
        onOpenChange={(open) => {
          if (!open) setFailure(null);
        }}
      >
        <AlertDialogContent
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
        >
          <AlertDialogHeader>
            <AlertDialogMedia>
              {failureCopy?.offline ? (
                <WifiOffIcon />
              ) : (
                <CircleAlertIcon className="text-destructive" />
              )}
            </AlertDialogMedia>
            <AlertDialogTitle>{failureCopy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{failureCopy?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dialog.close')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
