import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import { WorkspaceFooterPortal } from '@/components/workspace-tabs';
import {
  createPhysicalInventoryLot,
  deletePhysicalInventory,
  fetchPhysicalInventoryReport,
  savePhysicalInventory,
  submitPhysicalInventory,
} from '@/features/stock-events/api/physical-inventory-api';
import {
  eligibleInventoryProductsOptions,
  physicalInventoryDraftOptions,
} from '@/features/stock-events/api/physical-inventory-queries';
import { InventoryOccurredDateDialog } from '@/features/stock-events/components/inventory-occurred-date-dialog';
import {
  inventorySavePayload,
  inventorySubmitPayload,
  validateInventory,
} from '@/features/stock-events/lib/physical-inventory-form';
import { inventoryLocalCopy } from '@/features/stock-events/lib/physical-inventory-lines';
import {
  clearInventoryLocal,
  writeInventoryLocal,
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
import { queryKeys } from '@/lib/key-factory';
import { openReport } from '@/lib/open-report';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

class UnknownSubmit extends Error {}
type Action =
  | { type: 'save' }
  | { type: 'delete' }
  | { type: 'submit'; occurredDate: string; signature: string };
type Props = {
  draft: PhysicalInventoryDraft;
  baseline: readonly InventoryLine[];
  right: string;
  lines: readonly InventoryLine[];
  displayed: readonly InventoryLine[];
  userId: string;
  username: string;
  showInDoses: boolean;
  disabled: boolean;
  flush: () => Promise<void>;
  onBusy: (busy: boolean) => void;
  onLots: (lines: InventoryLine[]) => void;
  onSaved: (lines: InventoryLine[], terminal: boolean) => void;
  onDialogChange: (open: boolean) => void;
  onInvalid: (lines: readonly InventoryLine[]) => void;
  onDeleted: () => void | Promise<void>;
  onSubmitted: () => void | Promise<void>;
};
const ACTION_KEYS = {
  save: {
    errorTitle: 'physical-inventory.save-error-title',
    errorDescription: 'physical-inventory.save-error-description',
    successTitle: 'physical-inventory.saved-title',
    successDescription: 'physical-inventory.saved-description',
    localClearError: 'physical-inventory.save-local-clear-error',
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
  const [dialog, setDialog] = useState<'save' | 'delete' | 'submit' | 'print' | null>(null);
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
  useEffect(() => props.onDialogChange(dialog !== null), [dialog, props.onDialogChange]);
  const posting = useRef(false);
  const finished = useRef(false);
  const mutation = useSessionMutation({
    retry: false,
    mutationFn: async (action: Action) => {
      const scope = getSessionScope();
      await props.flush();
      assertSessionScope(scope);
      if (action.type === 'delete') {
        await deletePhysicalInventory(props.draft.id);
        return [];
      }
      const eligible = await queryClient.ensureQueryData(
        eligibleInventoryProductsOptions(props.draft),
      );
      assertSessionScope(scope);
      const lines = props.lines;
      if (action.type === 'submit' && validateInventory(lines, props.displayed).kind !== 'valid')
        throw new Error(t('physical-inventory.invalid-description'));
      const prepared = await createInventoryLots(
        lines,
        createPhysicalInventoryLot,
        async (next) => {
          assertSessionScope(scope);
          props.onLots(next);
          await writeInventoryLocal(inventoryLocalCopy(props.draft, next, props.baseline));
          assertSessionScope(scope);
        },
      );
      assertSessionScope(scope);
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
    const validation = validateInventory(props.lines, props.displayed);
    if (validation.kind === 'inactive') {
      toast.error(t('physical-inventory.inactive-title'), {
        description: t('physical-inventory.inactive-description'),
      });
    } else if (validation.kind === 'invalid') {
      props.onInvalid(validation.lines);
      toast.error(t('physical-inventory.invalid-title'), {
        description: t('physical-inventory.invalid-description'),
      });
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
      let description = serverMessage(error) ?? t(ACTION_KEYS[action.type].errorDescription);
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
      toast.error(
        t(
          error instanceof UnknownSubmit
            ? 'stock-events.unknown-outcome-title'
            : ACTION_KEYS[action.type].errorTitle,
        ),
        { description },
      );
      setDialog(null);
      props.onBusy(false);
      posting.current = false;
      return;
    }
    if (!mutation.isCurrent()) return;
    if (action.type !== 'save') finished.current = true;
    try {
      await clearInventoryLocal(props.draft.id);
    } catch {
      if (mutation.isCurrent())
        toast.error(t('physical-inventory.local-clear-error-title'), {
          description: t(ACTION_KEYS[action.type].localClearError),
        });
    }
    if (!mutation.isCurrent()) return;
    props.onSaved(next, action.type !== 'save');
    const keys =
      action.type === 'submit'
        ? [
            queryKeys.physicalInventories.all,
            queryKeys.stockEvents.all,
            queryKeys.stockCardSummaries.all,
            queryKeys.stockCards.all,
          ]
        : [queryKeys.physicalInventories.all];
    for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
    toast.success(t(ACTION_KEYS[action.type].successTitle), {
      description: t(ACTION_KEYS[action.type].successDescription),
    });
    if (action.type === 'save') {
      try {
        await queryClient.fetchQuery({
          ...physicalInventoryDraftOptions({
            programId: props.draft.programId,
            facilityId: props.draft.facilityId,
          }),
          staleTime: 0,
        });
      } catch {}
      if (!mutation.isCurrent()) return;
    }
    setDialog(action.type === 'submit' ? 'print' : null);
    props.onBusy(false);
    posting.current = false;
    if (action.type === 'delete') await props.onDeleted();
  };
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
        <Button
          size="lg"
          variant="outline"
          disabled={disabled}
          onClick={() => openConfirm('delete')}
        >
          {t('physical-inventory.delete')}
        </Button>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            size="lg"
            variant="outline"
            disabled={disabled}
            onClick={() => openConfirm('save')}
          >
            {t('physical-inventory.save')}
          </Button>
          <Button size="lg" disabled={disabled || unknown} onClick={submit}>
            {t('stock-events.submit')}
          </Button>
        </div>
      </WorkspaceFooterPortal>
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
          <Button
            onClick={() => {
              print.print();
              closePrint();
            }}
          >
            {t('physical-inventory.print')}
          </Button>
        </FormDialogFooter>
      </FormDialog>
    </>
  );
}
