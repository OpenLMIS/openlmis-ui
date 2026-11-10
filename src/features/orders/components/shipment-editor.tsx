import { useStore } from '@tanstack/react-form';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { LoadError } from '@/components/app-shell/load-error';
import { serverMessage } from '@/components/display/dialog-parts';
import { DiscardChangesDialog } from '@/components/display/discard-changes-dialog';
import { InvalidSubmitDialog } from '@/components/display/invalid-submit-dialog';
import { QuantityUnitToggle } from '@/components/display/quantity-unit-toggle';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import {
  cancelOrder,
  confirmShipment,
  createShipmentDraftOnce,
  deleteShipmentDraft,
  fetchPickPackList,
  forgetShipmentDraftCreate,
} from '@/features/orders/api/api';
import {
  orderOptions,
  shipmentDraftOptions,
  shipmentLotsOptions,
  shipmentOptions,
  shipmentProductsOptions,
  shipmentSavedProductsOptions,
  shipmentSummariesOptions,
  shipmentVvmOptions,
} from '@/features/orders/api/queries';
import { OrderHeader, OrderHeaderSkeleton } from '@/features/orders/components/order-header';
import { OrderLinesSkeleton } from '@/features/orders/components/order-lines';
import { ShipmentDialogs } from '@/features/orders/components/shipment-dialogs';
import { type ShipmentAction, ShipmentFooter } from '@/features/orders/components/shipment-footer';
import { ShipmentGrid } from '@/features/orders/components/shipment-grid';
import {
  mergeShipmentFills,
  ShipmentDraftExpiredError,
  saveExistingShipmentDraft,
} from '@/features/orders/lib/shipment-actions';
import { shipmentConfirmBody, shipmentCreateBody } from '@/features/orders/lib/shipment-body';
import {
  shipmentFieldKey,
  shipmentValues,
  useShipmentForm,
} from '@/features/orders/lib/shipment-form';
import {
  buildShipmentLines,
  type ShipmentLine,
  validateShipmentFill,
} from '@/features/orders/lib/shipment-lines';
import type { ShipmentRecord } from '@/features/orders/lib/shipment-types';
import type { Order } from '@/features/orders/lib/types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { usePrintReport } from '@/hooks/use-print-report';
import { useQuantityUnit } from '@/hooks/use-quantity-unit';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { isRefused } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
import { openReport } from '@/lib/open-report';
import { revealField } from '@/lib/reveal-field';
import { RIGHTS } from '@/lib/rights';
import { getSessionUserId } from '@/lib/session-scope';
import { toOptionalWholeNumber } from '@/lib/whole-number';

export const isFulfillable = (order: Order) => ['ORDERED', 'FULFILLING'].includes(order.status);
export const shipmentStockFilter = (order: Order) => ({
  programId: order.program.id,
  facilityId: order.supplyingFacility.id,
  orderableIds: order.orderLineItems.map((line) => line.orderable.id),
});
export type ShipmentAccess = { canEdit: boolean; canCancel: boolean; canPrint: boolean };
export function ShipmentFrame({
  order,
  cceStatus,
  children,
}: {
  order: Order;
  cceStatus: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Workspace width="wide">
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceTitle>
            {t('orders.shipment.title', { orderCode: order.orderCode ?? order.id })}
          </WorkspaceTitle>
          <WorkspaceDescription>{t('orders.shipment.description')}</WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
      <WorkspaceContent>
        <div className="flex flex-col gap-4">
          <OrderHeader order={order} cceStatus={cceStatus} />
          {children}
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
export function ShipmentScreen({
  orderId,
  cceStatus,
  access,
  onReturn,
}: {
  orderId: string;
  cceStatus: ReactNode;
  access: ShipmentAccess;
  onReturn: () => Promise<unknown>;
}) {
  const order = useSuspenseQuery(orderOptions(orderId)).data;
  return (
    <ShipmentData
      key={orderId}
      order={order}
      cceStatus={cceStatus}
      access={access}
      onReturn={onReturn}
    />
  );
}
function ShipmentData({
  order,
  cceStatus,
  access,
  onReturn,
}: {
  order: Order;
  cceStatus: ReactNode;
  access: ShipmentAccess;
  onReturn: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const editableStatus = isFulfillable(order);
  const record = useQuery({
    ...(editableStatus ? shipmentDraftOptions(order.id) : shipmentOptions(order.id)),
    retry: false,
  });
  const summaries = useQuery({
    ...shipmentSummariesOptions(shipmentStockFilter(order)),
    retry: false,
  });
  const products = useQuery({
    ...shipmentProductsOptions(summaries.data ?? []),
    enabled: !!summaries.data,
  });
  const savedProducts = useQuery(shipmentSavedProductsOptions(record.data?.lineItems ?? []));
  const lots = useQuery(shipmentLotsOptions(summaries.data ?? [], record.data?.lineItems));
  const vvm = useQuery(shipmentVvmOptions(summaries.data ?? [], products.data ?? []));
  const lines = buildShipmentLines({
    orderLines: order.orderLineItems,
    summaries: summaries.data ?? [],
    products: [...(savedProducts.data ?? []), ...(products.data ?? [])],
    lots: lots.data ?? [],
    savedLines: record.data?.lineItems,
    readOnly: !editableStatus,
    vvm: vvm.data,
  });
  const create = useSessionMutation({
    mutationFn: () => createShipmentDraftOnce(shipmentCreateBody(order.id, lines)),
    onSuccess: async (draft) => {
      client.setQueryData(shipmentDraftOptions(order.id).queryKey, draft);
      await Promise.all([
        client.invalidateQueries({ queryKey: orderOptions(order.id).queryKey }),
        client.invalidateQueries({ queryKey: [...queryKeys.orders.all, 'list'] }),
        client.invalidateQueries({ queryKey: [...queryKeys.orders.all, 'requesting-facilities'] }),
        client.invalidateQueries({ queryKey: queryKeys.home.all }),
      ]);
    },
  });
  const ready = !!summaries.data && !!products.data;
  useEffect(() => {
    if (
      order.status === 'ORDERED' &&
      access.canEdit &&
      ready &&
      record.isSuccess &&
      !record.data &&
      create.status === 'idle'
    )
      create.mutate();
  }, [
    order.status,
    access.canEdit,
    ready,
    record.isSuccess,
    record.data,
    create.status,
    create.mutate,
  ]);
  const notice = (message: string) => (
    <ShipmentFrame order={order} cceStatus={cceStatus}>
      <Alert>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </ShipmentFrame>
  );
  if (record.isError && isRefused(record.error)) return notice(t('orders.shipment.cannot-view'));
  if (!editableStatus && record.isSuccess && !record.data)
    return notice(t('orders.shipment.cannot-fulfill'));
  const error =
    record.error ?? summaries.error ?? products.error ?? savedProducts.error ?? create.error;
  if (error)
    return (
      <ShipmentFrame order={order} cceStatus={cceStatus}>
        <LoadError
          title={t('orders.shipment.stock-error')}
          description={t('error.description')}
          error={error}
          reset={() => {
            void record.refetch();
            void summaries.refetch();
            void products.refetch();
            void savedProducts.refetch();
            create.reset();
          }}
        />
      </ShipmentFrame>
    );
  if (
    !ready ||
    record.isPending ||
    savedProducts.isPending ||
    (editableStatus && access.canEdit && !record.data)
  )
    return (
      <ShipmentFrame order={order} cceStatus={cceStatus}>
        <OrderLinesSkeleton />
      </ShipmentFrame>
    );
  return (
    <ShipmentEditor
      order={order}
      cceStatus={cceStatus}
      lines={lines}
      record={record.data ?? null}
      access={editableStatus ? access : { canEdit: false, canCancel: false, canPrint: false }}
      onReturn={onReturn}
    />
  );
}
function ShipmentEditor({
  order,
  cceStatus,
  lines,
  record,
  access,
  onReturn,
}: {
  order: Order;
  cceStatus: ReactNode;
  lines: ShipmentLine[];
  record: ShipmentRecord | null;
  access: ShipmentAccess;
  onReturn: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [initial] = useState(() => shipmentValues(lines, record?.notes));
  const form = useShipmentForm(initial);
  const [baseline, setBaseline] = useState(initial);
  const dirty = useStore(
    form.store,
    (state) => JSON.stringify(state.values) !== JSON.stringify(baseline),
  );
  const [action, setAction] = useState<ShipmentAction | null>(null);
  const [failure, setFailure] = useState<{ title: string; description: string } | null>(null);
  const [gone, setGone] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const invalidTarget = useRef<string | null>(null);
  const leaving = useRef(false);
  const region = useRef<HTMLFormElement>(null);
  const { unit, setUnit, canSwitch } = useQuantityUnit();
  useEffect(() => {
    for (const line of lines) {
      const key = shipmentFieldKey(line.key);
      if (!form.getFieldValue(`lines.${key}`)) {
        const value = { fill: String(line.fill ?? '') };
        form.setFieldValue(`lines.${key}`, value);
        setBaseline((previous) => ({ ...previous, lines: { ...previous.lines, [key]: value } }));
      }
    }
  }, [lines, form]);
  const snapshot = () =>
    lines.map((line) => ({
      ...line,
      fill: toOptionalWholeNumber(
        form.getFieldValue(`lines.${shipmentFieldKey(line.key)}.fill`) ?? '',
      ),
    }));
  const validate = () => {
    setAttempted(true);
    const bad = lines.find((line) =>
      validateShipmentFill(
        line,
        form.getFieldValue(`lines.${shipmentFieldKey(line.key)}.fill`) ?? '',
      ),
    );
    if (!bad) return true;
    invalidTarget.current = `lines.${shipmentFieldKey(bad.key)}.fill`;
    setInvalid(true);
    return false;
  };
  const fail = (error: unknown, kind: ShipmentAction) => {
    setAction(null);
    if (error instanceof ShipmentDraftExpiredError) setGone(true);
    else
      setFailure({
        title: t(`orders.shipment.${kind}-failed`),
        description: serverMessage(error) ?? t('error.description'),
      });
  };
  const save = useSessionMutation({
    mutationFn: async () => {
      if (!record) throw new ShipmentDraftExpiredError();
      const submitted = snapshot();
      const notes = form.getFieldValue('notes');
      const response = await saveExistingShipmentDraft({ ...record, notes }, submitted);
      return { submitted, response, notes };
    },
    onSuccess: ({ submitted, response, notes }) => {
      const merged = mergeShipmentFills(snapshot(), submitted, response);
      for (const line of merged) {
        const key = shipmentFieldKey(line.key);
        const raw = form.getFieldValue(`lines.${key}.fill`);
        const sent = submitted.find((item) => item.key === line.key);
        if (toOptionalWholeNumber(raw ?? '') === sent?.fill)
          form.setFieldValue(`lines.${key}`, { fill: String(line.fill ?? '') });
      }
      setBaseline(
        shipmentValues(
          lines.map((line) => ({
            ...line,
            fill:
              response.lineItems.find(
                (saved) => saved.orderable.id === line.product.id && saved.lot?.id === line.lot?.id,
              )?.quantityShipped ?? line.fill,
          })),
          notes,
        ),
      );
      client.setQueryData(shipmentDraftOptions(order.id).queryKey, response);
      void client.invalidateQueries({ queryKey: queryKeys.stockCardSummaries.all });
      toast.success(t('orders.shipment.saved'), {
        description: t('orders.shipment.saved-description'),
      });
    },
    onError: (error) => fail(error, 'save'),
  });
  const print = usePrintReport({
    serverAuthorized: true,
    userId: getSessionUserId() ?? '',
    facilityId: order.supplyingFacility.id,
    programId: order.program.id,
    right: RIGHTS.shipmentsEdit,
    beforeRequest: async () => {
      try {
        await save.mutateAsync();
        return true;
      } catch {
        return false;
      }
    },
    request: (language) => fetchPickPackList(record?.id ?? '', language),
    onReport: () => openReport(`${order.orderCode ?? order.id}.pdf`, t('orders.shipment.print')),
    successTitle: t('orders.shipment.printed'),
    successDescription: t('orders.shipment.printed-description'),
    errorTitle: t('orders.shipment.print-failed'),
    errorDescription: t('error.description'),
    refusedDescription: t('orders.shipment.cannot-view'),
  });
  const mutation = useSessionMutation({
    mutationFn: async (kind: 'delete' | 'cancel' | 'confirm') => {
      if (kind === 'delete' && record) await deleteShipmentDraft(record.id);
      if (kind === 'cancel') await cancelOrder(order.id);
      if (kind === 'confirm' && record)
        await confirmShipment(
          shipmentConfirmBody({ ...record, notes: form.getFieldValue('notes') }, snapshot()),
        );
    },
    onSuccess: async (_, kind) => {
      leaving.current = true;
      forgetShipmentDraftCreate(order.id);
      setAction(null);
      client.removeQueries({ queryKey: shipmentDraftOptions(order.id).queryKey, exact: true });
      await Promise.all([
        client.invalidateQueries({ queryKey: orderOptions(order.id).queryKey }),
        client.invalidateQueries({ queryKey: [...queryKeys.orders.all, 'list'] }),
        client.invalidateQueries({ queryKey: [...queryKeys.orders.all, 'requesting-facilities'] }),
        client.invalidateQueries({ queryKey: queryKeys.home.all }),
        ...(kind === 'confirm'
          ? [
              client.invalidateQueries({ queryKey: shipmentOptions(order.id).queryKey }),
              client.invalidateQueries({ queryKey: queryKeys.stockCardSummaries.all }),
            ]
          : []),
      ]);
      if (!mutation.isCurrent()) return;
      toast.success(t(`orders.shipment.${kind}-success`), {
        description: t(`orders.shipment.${kind}-success-description`),
      });
      await onReturn();
    },
    onError: (error, kind) => fail(error, kind),
  });
  const pending = save.isPending || mutation.isPending || print.isPending;
  const guard = useDiscardGuard(access.canEdit && dirty, {
    pending,
    allowLeave: () => leaving.current,
  });
  return (
    <>
      <ShipmentFrame order={order} cceStatus={cceStatus}>
        <form
          ref={region}
          onSubmit={(event) => event.preventDefault()}
          className="flex flex-col gap-4"
        >
          {canSwitch && (
            <div className="flex justify-end">
              <QuantityUnitToggle unit={unit} onUnitChange={setUnit} />
            </div>
          )}
          <ShipmentGrid
            order={order}
            lines={lines}
            form={form}
            unit={unit}
            canEdit={access.canEdit}
            disabled={mutation.isPending}
            attempted={attempted}
          />
        </form>
      </ShipmentFrame>
      <ShipmentFooter
        {...access}
        hasDraft={!!record}
        hasLines={lines.length > 0}
        pending={pending}
        onAction={(kind) => {
          if (kind === 'save') save.mutate();
          else if (kind === 'print') print.print();
          else if (kind !== 'confirm' || validate()) setAction(kind);
        }}
      />
      <ShipmentDialogs
        action={action}
        pending={pending}
        onClose={() => setAction(null)}
        onConfirm={() => {
          if (action === 'confirm' && !validate()) {
            setAction(null);
            return;
          }
          if (action === 'delete' || action === 'cancel' || action === 'confirm')
            mutation.mutate(action);
        }}
        failure={failure}
        onFailureClose={() => setFailure(null)}
        gone={gone}
        onReload={() => {
          leaving.current = true;
          window.location.reload();
        }}
      />
      <InvalidSubmitDialog
        open={invalid}
        onOpenChange={setInvalid}
        title={t('orders.shipment.invalid')}
        description={t('orders.shipment.invalid-description')}
        closeLabel={t('dialog.close')}
        onOpenChangeComplete={(open) => {
          if (!open && invalidTarget.current) {
            const target = document.getElementById(invalidTarget.current);
            if (target) revealField(target, !!target.closest('li'));
          }
        }}
      />
      <DiscardChangesDialog
        {...guard.dialog}
        description={t('orders.shipment.discard-description')}
      />
    </>
  );
}
export function ShipmentPending() {
  const { t } = useTranslation();
  return (
    <Workspace width="wide">
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceTitle>{t('orders.shipment.crumb')}</WorkspaceTitle>
          <WorkspaceDescription>{t('orders.shipment.description')}</WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
      <WorkspaceContent>
        <OrderHeaderSkeleton />
        <OrderLinesSkeleton />
      </WorkspaceContent>
    </Workspace>
  );
}
