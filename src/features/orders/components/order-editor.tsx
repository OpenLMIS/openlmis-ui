import { useStore } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ListError } from '@/components/app-shell/list-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { serverMessage } from '@/components/display/dialog-parts';
import { DiscardChangesDialog } from '@/components/display/discard-changes-dialog';
import { InvalidSubmitDialog } from '@/components/display/invalid-submit-dialog';
import { QuantityUnitToggle } from '@/components/display/quantity-unit-toggle';
import { useAppForm } from '@/components/form/form';
import { quantityValue } from '@/components/form/quantity-value';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Tabs, TabsContent } from '@/components/ui/tabs';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceFooter,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import { orderOptions } from '@/features/orders/api/queries';
import { OrderHeader, OrderHeaderSkeleton } from '@/features/orders/components/order-header';
import { OrderLines, productName } from '@/features/orders/components/order-lines';
import { OrderProductPicker } from '@/features/orders/components/order-product-picker';
import { OrderSummaryDialog } from '@/features/orders/components/order-summary-dialog';
import { OrderTabs } from '@/features/orders/components/order-tabs';
import { executeOrderWrite, type OrderSnapshot } from '@/features/orders/lib/order-actions';
import {
  type DraftLine,
  draftLines,
  isChanged,
  mergeSavedLines,
  validLines,
  validQuantity,
} from '@/features/orders/lib/order-draft';
import type { LoadedOrder, OrderProblem } from '@/features/orders/lib/order-load';
import type { Order } from '@/features/orders/lib/types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useQuantityUnit } from '@/hooks/use-quantity-unit';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import type { QuantityUnit } from '@/lib/quantity';
import { randomId } from '@/lib/random-id';
import { revealField } from '@/lib/reveal-field';

function useOrderForm(initial: Record<string, DraftLine[]>) {
  return useAppForm({ defaultValues: { orders: initial } });
}

export function OrderEditor({
  entries,
  tab,
  onTab,
  onBatchChange,
  onCancel,
}: {
  entries: LoadedOrder[];
  tab?: string;
  onTab: (id: string) => void;
  onBatchChange: (ids: string[]) => Promise<unknown>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [initial] = useState<Record<string, DraftLine[]>>(() =>
    Object.fromEntries(
      entries.flatMap((entry) => (entry.order ? [[entry.id, draftLines(entry.order)]] : [])),
    ),
  );
  const form = useOrderForm(initial);
  const [baselines, setBaselines] = useState(initial);
  const [records, setRecords] = useState<Record<string, Order>>(() =>
    Object.fromEntries(entries.flatMap((entry) => (entry.order ? [[entry.id, entry.order]] : []))),
  );
  const [problems, setProblems] = useState<Record<string, OrderProblem>>({});
  const active = entries.find((entry) => entry.id === tab) ?? entries[0];
  const current = active && records[active.id];
  const problem = active && (problems[active.id] ?? active.problem);
  const status = useStore(
    form.store,
    (state) =>
      entries.map((entry) => {
        const lines = state.values.orders[entry.id] ?? [];
        return {
          id: entry.id,
          dirty: isChanged(lines, baselines[entry.id] ?? []),
          invalid: !!(problems[entry.id] ?? entry.problem) || !validLines(lines, true),
        };
      }),
    (previous, next) =>
      previous.length === next.length &&
      previous.every(
        (item, index) =>
          item.id === next[index].id &&
          item.dirty === next[index].dirty &&
          item.invalid === next[index].invalid,
      ),
  );
  const dirty = (id: string) => status.some((entry) => entry.id === id && entry.dirty);
  const invalid = (id: string) => status.some((entry) => entry.id === id && entry.invalid);
  const editable = entries.filter(
    (entry) => records[entry.id] && !entry.problem && !problems[entry.id],
  );
  const { unit, setUnit, canSwitch } = useQuantityUnit();
  const [summary, setSummary] = useState<OrderSnapshot[] | null>(null);
  const [deleting, setDeleting] = useState<{ ids: string[]; batch: boolean } | null>(null);
  const [failure, setFailure] = useState<{ title: string; description: string } | null>(null);
  const [creatingInvalid, setCreatingInvalid] = useState(false);
  const [invalidOpen, setInvalidOpen] = useState(false);
  const invalidTarget = useRef<string | null>(null);
  const leaving = useRef(false);
  const region = useRef<HTMLFormElement>(null);
  const removed = useRef(false);
  const drop = async (ids: readonly string[]) => {
    leaving.current = true;
    try {
      await onBatchChange(
        entries.filter((entry) => !ids.includes(entry.id)).map((entry) => entry.id),
      );
      if (mutation.isCurrent())
        region.current?.querySelector<HTMLElement>('[role=tab][aria-selected=true]')?.focus();
    } finally {
      if (mutation.isCurrent()) leaving.current = false;
    }
  };
  const mutation = useSessionMutation({
    mutationFn: executeOrderWrite,
    onSuccess: async (outcomes, action) => {
      const success = outcomes.filter((outcome) => outcome.success);
      const failed = outcomes.filter((outcome) => !outcome.success);
      if (action.kind === 'save') {
        for (const outcome of success) {
          const snapshot = action.snapshots.find((item) => item.order.id === outcome.id);
          if (!snapshot || !outcome.response) continue;
          const response = outcome.response;
          form.setFieldValue(
            `orders.${outcome.id}`,
            mergeSavedLines(
              form.getFieldValue(`orders.${outcome.id}`) ?? [],
              snapshot.lines,
              response,
            ),
          );
          setBaselines((previous) => ({ ...previous, [outcome.id]: snapshot.lines }));
          setRecords((previous) => ({ ...previous, [outcome.id]: response }));
          queryClient.setQueryData(orderOptions(outcome.id).queryKey, response);
        }
      }
      if (failed.some((item) => item.problem))
        setProblems((previous) => ({
          ...previous,
          ...Object.fromEntries(
            failed.flatMap((item) => (item.problem ? [[item.id, item.problem]] : [])),
          ),
        }));
      if (failed.length) {
        const facilities = failed
          .map((item) => records[item.id]?.requestingFacility.name ?? item.id)
          .join(', ');
        const reason =
          [...new Set(failed.map((item) => serverMessage(item.error)).filter(Boolean))].join(
            '; ',
          ) || t('error.description');
        const key =
          action.kind === 'save'
            ? 'save-failed'
            : action.kind === 'send'
              ? 'create-failed'
              : 'delete-failed';
        setFailure({
          title: t(`orders.edit.${key}-title`),
          description: t(`orders.edit.${key}-description`, { facilities, reason }),
        });
      } else {
        const key =
          action.kind === 'save' ? 'saved' : action.kind === 'send' ? 'created' : 'deleted';
        toast.success(t(`orders.edit.${key}-title`), {
          description: t(`orders.edit.${key}-description`),
        });
      }
      if (action.kind !== 'send' || success.length !== entries.length) setSummary(null);
      setDeleting(null);
      if (action.kind !== 'save' && success.length) {
        removed.current = true;
        for (const outcome of success)
          queryClient.removeQueries({ queryKey: orderOptions(outcome.id).queryKey });
        await drop(success.map((item) => item.id));
      }
    },
    onError: (error, variables) => {
      const key =
        variables.kind === 'save'
          ? 'save-failed'
          : variables.kind === 'send'
            ? 'create-failed'
            : 'delete-failed';
      setSummary(null);
      setDeleting(null);
      setFailure({
        title: t(`orders.edit.${key}-title`),
        description: serverMessage(error) ?? t('error.description'),
      });
    },
  });
  const pending = mutation.isPending;
  const invalidBatch = !entries.length || status.some((entry) => entry.invalid);
  const guard = useDiscardGuard(
    entries.some((entry) => dirty(entry.id)),
    { pending, allowLeave: () => leaving.current },
  );
  const snapshots = () =>
    editable.map((entry) => ({
      order: records[entry.id],
      lines: structuredClone(form.getFieldValue(`orders.${entry.id}`) ?? []),
    }));
  const showInvalid = (id: string, lines: readonly DraftLine[], create = false) => {
    onTab(id);
    const index = Math.max(
      0,
      lines.findIndex((line) => !validQuantity(line.quantity, create)),
    );
    invalidTarget.current = lines.length ? `orders.${id}[${index}].quantity` : 'order-product';
    setInvalidOpen(true);
  };
  const submitSave = () => {
    setCreatingInvalid(false);
    const changed = snapshots().filter((item) => dirty(item.order.id));
    const bad = changed.find((item) => !validLines(item.lines, false));
    if (bad) {
      showInvalid(bad.order.id, bad.lines);
      return;
    }
    mutation.mutate({ kind: 'save', snapshots: changed });
  };
  return (
    <>
      <Workspace>
        <WorkspaceHeader>
          <WorkspaceHeading>
            <WorkspaceTitle>{t('orders.create.title')}</WorkspaceTitle>
            <WorkspaceDescription>{t('orders.edit.description')}</WorkspaceDescription>
          </WorkspaceHeading>
        </WorkspaceHeader>
        <WorkspaceContent>
          <form
            ref={region}
            id="order-drafts"
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!pending) submitSave();
            }}
          >
            <Tabs value={active?.id ?? ''} onValueChange={(value) => onTab(String(value))}>
              <OrderTabs
                entries={entries}
                active={active?.id}
                disabled={pending}
                deletable={(id) => editable.some((entry) => entry.id === id)}
                onDelete={(id) => {
                  onTab(id);
                  setDeleting({ ids: [id], batch: false });
                }}
                dirty={dirty}
                invalid={invalid}
              />
              <TabsContent value={active?.id ?? ''}>
                <div className="flex flex-col gap-4">
                  {problem ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        <div className="flex flex-col items-start gap-3">
                          {t(`orders.edit.${problem}`)}
                          <Button
                            disabled={pending}
                            variant="outline"
                            size="lg"
                            onClick={() => drop([active.id])}
                          >
                            {t('orders.edit.remove-from-batch')}
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    current && (
                      <>
                        <QueryBoundary
                          resetKey={current.id}
                          errorComponent={HeaderError}
                          pendingFallback={<OrderHeaderSkeleton />}
                        >
                          <OrderHeader order={current} />
                        </QueryBoundary>
                        <OrderFields
                          key={active.id}
                          form={form}
                          order={current}
                          unit={unit}
                          canSwitch={canSwitch}
                          setUnit={setUnit}
                          disabled={pending && mutation.variables?.kind !== 'save'}
                        />
                      </>
                    )
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </form>
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter>
        <div className="self-end">
          <Button size="lg" variant="outline" disabled={pending} onClick={onCancel}>
            {t('orders.edit.cancel')}
          </Button>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            size="lg"
            variant="destructive"
            disabled={pending || !editable.length}
            onClick={() => setDeleting({ ids: editable.map((entry) => entry.id), batch: true })}
          >
            {t('orders.edit.delete-batch')}
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={
              pending ||
              !entries.some((entry) => !entry.problem && !problems[entry.id] && dirty(entry.id))
            }
            type="submit"
            form="order-drafts"
          >
            {t('orders.edit.save-draft')}
          </Button>
          <Button
            size="lg"
            disabled={pending || invalidBatch}
            aria-description={
              invalidBatch ? t('orders.edit.create-invalid-description') : undefined
            }
            onClick={() => {
              const bad = entries.find((entry) => invalid(entry.id));
              setCreatingInvalid(true);
              if (bad) showInvalid(bad.id, form.getFieldValue(`orders.${bad.id}`) ?? [], true);
              else setSummary(snapshots());
            }}
          >
            {t('orders.edit.create')}
          </Button>
        </div>
      </WorkspaceFooter>
      <OrderSummaryDialog
        open={summary !== null}
        onOpenChange={(open) => {
          if (!open) setSummary(null);
        }}
        snapshots={summary ?? []}
        unit={unit}
        pending={pending}
        onConfirm={() => {
          if (summary) mutation.mutate({ kind: 'send', snapshots: summary });
        }}
      />
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleting(null);
        }}
      >
        <AlertDialogContent
          finalFocus={() =>
            removed.current
              ? (region.current?.querySelector<HTMLElement>('[role=tab][aria-selected=true]') ??
                false)
              : true
          }
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(!deleting?.batch ? 'orders.edit.delete-order' : 'orders.edit.delete-batch')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                !deleting?.batch
                  ? 'orders.edit.delete-order-confirm'
                  : 'orders.edit.delete-batch-confirm',
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t('orders.edit.cancel')}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (deleting) mutation.mutate({ kind: 'delete', ids: deleting.ids });
              }}
            >
              {t(!deleting?.batch ? 'orders.edit.delete-order-action' : 'orders.edit.delete-batch')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <InvalidSubmitDialog
        open={invalidOpen}
        onOpenChange={setInvalidOpen}
        title={t('orders.edit.invalid')}
        description={
          creatingInvalid
            ? problem
              ? t(`orders.edit.${problem}`)
              : t('orders.edit.create-invalid-description')
            : t('orders.edit.invalid-description')
        }
        closeLabel={t('dialog.close')}
        onOpenChangeComplete={(open) => {
          if (!open && invalidTarget.current) {
            const target = document.querySelector<HTMLElement>(`[id^="${invalidTarget.current}"]`);
            if (!target)
              region.current?.querySelector<HTMLElement>('[role=tab][aria-selected=true]')?.focus();
            if (target) revealField(target, !!target.closest('li'));
          }
        }}
      />
      <InvalidSubmitDialog
        open={failure !== null}
        onOpenChange={(open) => {
          if (!open) setFailure(null);
        }}
        title={failure?.title}
        description={failure?.description}
        closeLabel={t('dialog.close')}
      />
      <DiscardChangesDialog {...guard.dialog} description={t('orders.edit.discard-description')} />
    </>
  );
}

function OrderFields({
  form,
  order,
  unit,
  canSwitch,
  setUnit,
  disabled,
}: {
  form: ReturnType<typeof useOrderForm>;
  order: Order;
  unit: QuantityUnit;
  canSwitch: boolean;
  setUnit: (unit: QuantityUnit) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const lines = useStore(form.store, (state) => state.values.orders[order.id]);
  const addedFocus = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!addedFocus.current) return;
    const index = lines.findIndex((line) => line.key === addedFocus.current);
    addedFocus.current = null;
    if (index >= 0)
      document
        .querySelector<HTMLElement>(`[name^="orders.${order.id}[${index}].quantity"]`)
        ?.focus();
  }, [lines, order.id]);
  const productIds = lines.map((line) => line.product.id).join(',');
  const added = useMemo(() => productIds.split(',').filter(Boolean), [productIds]);
  const onAdd = useCallback(
    (product: DraftLine['product']) => {
      const key = randomId();
      addedFocus.current = key;
      form.setFieldValue(`orders.${order.id}`, [
        ...(form.getFieldValue(`orders.${order.id}`) ?? []),
        { key, product, quantity: quantityValue('', product.netContent) },
      ]);
    },
    [form, order.id],
  );
  const onRemove = useCallback(
    (key: string) => {
      form.setFieldValue(
        `orders.${order.id}`,
        (form.getFieldValue(`orders.${order.id}`) ?? []).filter((line) => line.key !== key),
      );
    },
    [form, order.id],
  );
  const quantity = useCallback(
    (line: DraftLine, index: number, cards: boolean) => (
      <form.AppField
        key={line.key}
        name={`orders.${order.id}[${index}].quantity`}
        validators={{
          onChange: ({ value }) =>
            validQuantity(value) ? undefined : 'orders.edit.invalid-description',
        }}
      >
        {(field) => (
          <field.QuantityField
            label={t('orders.edit.quantity-label', { product: productName(line) })}
            layout="inline"
            hideErrors
            required
            unit={unit}
            netContent={line.product.netContent}
            packsLabel={t('quantity-unit.packs')}
            dosesLabel={t('quantity-unit.doses')}
            sizing={cards ? 'fill' : 'minimum'}
            notation="plus"
            disabled={disabled}
          />
        )}
      </form.AppField>
    ),
    [form, order.id, unit, disabled, t],
  );
  return (
    <>
      <DataTableToolbar>
        <OrderProductPicker
          programId={order.program.id}
          facilityId={order.requestingFacility.id}
          added={added}
          disabled={disabled}
          onAdd={onAdd}
        />
        {canSwitch && (
          <div className="ms-auto flex-1 @2xl/main:flex-none">
            <QuantityUnitToggle unit={unit} onUnitChange={setUnit} />
          </div>
        )}
      </DataTableToolbar>
      <OrderLines
        order={order}
        lines={lines ?? []}
        unit={unit}
        disabled={disabled}
        onRemove={onRemove}
        quantity={quantity}
      />
    </>
  );
}

function HeaderError(props: { error: unknown; reset: () => void }) {
  const { t } = useTranslation();
  return (
    <ListError
      {...props}
      title={t('orders.create.title')}
      description={t('error.check-connection')}
    />
  );
}
