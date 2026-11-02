import { useStore } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import { Separator } from '@/components/ui/separator';
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
import { OrderHeader } from '@/features/orders/components/order-header';
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
import { randomId } from '@/lib/random-id';
import { revealField } from '@/lib/reveal-field';

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
  const form = useAppForm({ defaultValues: { orders: initial as Record<string, DraftLine[]> } });
  const values = useStore(form.store, (state) => state.values.orders);
  const [baselines, setBaselines] = useState(initial);
  const [records, setRecords] = useState<Record<string, Order>>(() =>
    Object.fromEntries(entries.flatMap((entry) => (entry.order ? [[entry.id, entry.order]] : []))),
  );
  const [problems, setProblems] = useState<Record<string, OrderProblem>>({});
  const [known, setKnown] = useState(entries.map((entry) => entry.id));
  if (entries.some((entry) => !known.includes(entry.id))) {
    const next = { ...baselines };
    const nextRecords = { ...records };
    for (const entry of entries)
      if (!known.includes(entry.id) && entry.order) {
        const lines = draftLines(entry.order);
        form.setFieldValue(`orders.${entry.id}`, lines);
        next[entry.id] = lines;
        nextRecords[entry.id] = entry.order;
      }
    setKnown(entries.map((entry) => entry.id));
    setBaselines(next);
    setRecords(nextRecords);
  }
  const active = entries.find((entry) => entry.id === tab) ?? entries[0];
  const current = active && records[active.id];
  const problem = active && (problems[active.id] ?? active.problem);
  const dirty = (id: string) => isChanged(values[id] ?? [], baselines[id] ?? []);
  const invalid = (id: string) =>
    !!problems[id] ||
    !!entries.find((entry) => entry.id === id)?.problem ||
    !validLines(values[id] ?? [], true);
  const { unit, setUnit, canSwitch } = useQuantityUnit();
  const [summary, setSummary] = useState<OrderSnapshot[] | null>(null);
  const [deleting, setDeleting] = useState<{ ids: string[]; batch: boolean } | null>(null);
  const [invalidOpen, setInvalidOpen] = useState(false);
  const invalidTarget = useRef<string | null>(null);
  const leaving = useRef(false);
  const drop = async (ids: readonly string[]) => {
    leaving.current = true;
    try {
      await onBatchChange(
        entries.filter((entry) => !ids.includes(entry.id)).map((entry) => entry.id),
      );
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
          failed
            .map((item) => serverMessage(item.error))
            .filter(Boolean)
            .join('; ') || t('error.description');
        const key =
          action.kind === 'save'
            ? 'save-failed'
            : action.kind === 'send'
              ? 'create-failed'
              : 'delete-failed';
        toast.error(t(`orders.edit.${key}-title`), {
          description: t(`orders.edit.${key}-description`, { facilities, reason }),
        });
      } else {
        const key =
          action.kind === 'save' ? 'saved' : action.kind === 'send' ? 'created' : 'deleted';
        toast.success(t(`orders.edit.${key}-title`), {
          description: t(`orders.edit.${key}-description`),
        });
      }
      setSummary(null);
      setDeleting(null);
      if (action.kind !== 'save' && success.length) {
        for (const outcome of success)
          queryClient.removeQueries({ queryKey: orderOptions(outcome.id).queryKey });
        await drop(success.map((item) => item.id));
        if (!mutation.isCurrent()) return;
      }
    },
    onError: (error) =>
      toast.error(t('orders.edit.save-failed-title'), {
        description: serverMessage(error) ?? t('error.description'),
      }),
  });
  const pending = mutation.isPending;
  const guard = useDiscardGuard(
    entries.some((entry) => dirty(entry.id)),
    { pending, allowLeave: () => leaving.current },
  );
  const snapshots = () =>
    entries
      .filter((entry) => records[entry.id] && !entry.problem && !problems[entry.id])
      .map((entry) => ({
        order: records[entry.id],
        lines: structuredClone(form.getFieldValue(`orders.${entry.id}`) ?? []),
      }));
  const submitSave = () => {
    const changed = snapshots().filter((item) => dirty(item.order.id));
    const bad = changed.find((item) => !validLines(item.lines, false));
    if (bad) {
      onTab(bad.order.id);
      const index = bad.lines.findIndex((line) => !validQuantity(line.quantity));
      invalidTarget.current = `orders.${bad.order.id}[${index}].quantity`;
      setInvalidOpen(true);
      return;
    }
    mutation.mutate({ kind: 'save', snapshots: changed });
  };
  const blocked = entries.some((entry) => entry.problem || problems[entry.id]);
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
            id="order-drafts"
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!pending) submitSave();
            }}
          >
            <Tabs value={active?.id ?? ''} onValueChange={(value) => onTab(String(value))}>
              <OrderTabs entries={entries} dirty={dirty} invalid={invalid} />
              <TabsContent value={active?.id ?? ''}>
                <div className="flex flex-col gap-4">
                  {problem ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        {t(`orders.edit.${problem}`)}
                        {problem !== 'no-read-access' && (
                          <Button
                            disabled={pending}
                            variant="outline"
                            onClick={() => drop([active.id])}
                          >
                            {t('orders.edit.remove-from-batch')}
                          </Button>
                        )}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    current && (
                      <>
                        <OrderHeader order={current} />
                        <div>
                          <Button
                            variant="destructive"
                            disabled={pending}
                            onClick={() => setDeleting({ ids: [active.id], batch: false })}
                          >
                            {t('orders.edit.delete-order')}
                          </Button>
                        </div>
                        <OrderProductPicker
                          key={active.id}
                          programId={current.program.id}
                          facilityId={current.requestingFacility.id}
                          added={(values[active.id] ?? []).map((line) => line.product.id)}
                          disabled={pending && mutation.variables?.kind !== 'save'}
                          onAdd={(product) =>
                            form.setFieldValue(`orders.${active.id}`, [
                              ...(form.getFieldValue(`orders.${active.id}`) ?? []),
                              {
                                key: randomId(),
                                product,
                                quantity: quantityValue('', product.netContent),
                              },
                            ])
                          }
                        />
                        <Separator />
                        {canSwitch && (
                          <div className="flex justify-end">
                            <QuantityUnitToggle unit={unit} onUnitChange={setUnit} />
                          </div>
                        )}
                        <OrderLines
                          order={current}
                          lines={values[active.id] ?? []}
                          unit={unit}
                          disabled={pending && mutation.variables?.kind !== 'save'}
                          onRemove={(key) =>
                            form.setFieldValue(
                              `orders.${active.id}`,
                              (form.getFieldValue(`orders.${active.id}`) ?? []).filter(
                                (line) => line.key !== key,
                              ),
                            )
                          }
                          quantity={(line, index, cards) => (
                            <form.AppField
                              key={line.key}
                              name={`orders.${active.id}[${index}].quantity`}
                              validators={{
                                onMount: ({ value }) =>
                                  validQuantity(value)
                                    ? undefined
                                    : 'orders.edit.invalid-description',
                                onChange: ({ value }) =>
                                  validQuantity(value)
                                    ? undefined
                                    : 'orders.edit.invalid-description',
                              }}
                            >
                              {(field) => (
                                <field.QuantityField
                                  label={`${t('orders.edit.quantity')} ${productName(line)}`}
                                  layout="inline"
                                  hideErrors
                                  required
                                  unit={unit}
                                  netContent={line.product.netContent}
                                  packsLabel={t('quantity-unit.packs')}
                                  dosesLabel={t('quantity-unit.doses')}
                                  sizing={cards ? 'fill' : 'minimum'}
                                  notation="plus"
                                  disabled={pending && mutation.variables?.kind !== 'save'}
                                />
                              )}
                            </form.AppField>
                          )}
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
        <div className="flex flex-wrap gap-2">
          <Button size="lg" variant="outline" disabled={pending} onClick={onCancel}>
            {t('orders.edit.cancel')}
          </Button>
          <Button
            size="lg"
            variant="destructive"
            disabled={pending}
            onClick={() => setDeleting({ ids: entries.map((entry) => entry.id), batch: true })}
          >
            {t('orders.edit.delete-batch')}
          </Button>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
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
            disabled={pending || blocked || entries.some((entry) => invalid(entry.id))}
            onClick={() => setSummary(snapshots())}
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
        <AlertDialogContent>
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
        description={t('orders.edit.invalid-description')}
        closeLabel={t('orders.edit.cancel')}
        onOpenChangeComplete={(open) => {
          if (!open && invalidTarget.current) {
            const target = document.querySelector<HTMLElement>(`[id^="${invalidTarget.current}"]`);
            if (target) revealField(target, !!target.closest('li'));
          }
        }}
      />
      <DiscardChangesDialog {...guard.dialog} description={t('orders.edit.unsaved')} />
    </>
  );
}
