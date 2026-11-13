import { useStore } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardCheckIcon, PrinterIcon } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useDeviceWork } from '@/components/app-shell/device-work';
import { serverMessage } from '@/components/display/dialog-parts';
import { DiscardChangesDialog } from '@/components/display/discard-changes-dialog';
import { InvalidSubmitDialog } from '@/components/display/invalid-submit-dialog';
import {
  RecordSummary,
  RecordSummaryField,
  RecordSummaryFields,
  RecordSummaryHeading,
} from '@/components/display/record-summary';
import { formatDateValue, formatTimestamp, toDateValue } from '@/components/form/date-value';
import { SettingsItem, SettingsList } from '@/components/form/settings-list';
import { FlagBadge } from '@/components/shared/flag-badge';
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
import {
  Workspace,
  WorkspaceActions,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceFooter,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import { fetchProofOfDeliveryPdf, saveProofOfDelivery } from '@/features/orders/api/api';
import { proofOfDeliveryOptions } from '@/features/orders/api/queries';
import { OrderStatusBadge } from '@/features/orders/components/order-status-badge';
import { PodGrid } from '@/features/orders/components/pod-grid';
import { mergePodDraft, podDraft } from '@/features/orders/lib/pod-draft';
import { usePodForm } from '@/features/orders/lib/pod-form';
import { groupPodLines, shippedQuantity } from '@/features/orders/lib/pod-lines';
import { buildPodBody, mergeSavedPod } from '@/features/orders/lib/pod-save';
import type { PodDraft, ProofOfDelivery } from '@/features/orders/lib/pod-types';
import { validatePodFooter, validatePodLine } from '@/features/orders/lib/pod-validation';
import type { OrderProduct } from '@/features/orders/lib/types';
import type { OrderableFulfills } from '@/features/reference-data/lib/types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { usePrintReport } from '@/hooks/use-print-report';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { orEmpty } from '@/lib/empty-value';
import { queryKeys } from '@/lib/key-factory';
import { openReport } from '@/lib/open-report';
import { revealField } from '@/lib/reveal-field';
import { getSessionUserId } from '@/lib/session-scope';
import { homeStockRefreshKey } from '@/lib/stock-programs';

export function PodEditor({
  initial,
  products,
  lots,
  fulfills,
  reasons,
  canEdit,
  timeZone,
  onCancel,
}: {
  initial: ProofOfDelivery;
  products: OrderProduct[];
  lots: { id: string; lotCode: string }[];
  fulfills: OrderableFulfills;
  reasons: { id: string; name: string }[];
  canEdit: boolean;
  timeZone: string;
  onCancel: () => void;
}) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const { refreshOfflineDownload } = useDeviceWork();
  const [pod, setPod] = useState(initial);
  const [baseline, setBaseline] = useState(() => podDraft(initial));
  const form = usePodForm(baseline);
  const dirty = useStore(
    form.store,
    (state) => JSON.stringify(state.values) !== JSON.stringify(baseline),
  );
  const editable = canEdit && pod.status === 'INITIATED';
  const order = pod.shipment.order;
  const groups = useMemo(
    () =>
      groupPodLines(
        order.orderLineItems,
        pod.lineItems,
        pod.shipment.lineItems,
        fulfills,
        products,
      ),
    [order, pod, fulfills, products],
  );
  const [attempted, setAttempted] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const invalidTarget = useRef<string | null>(null);
  const leaving = useRef(false);
  const mutation = useSessionMutation({
    mutationFn: async ({ snapshot, confirming }: { snapshot: PodDraft; confirming: boolean }) => {
      const response = await saveProofOfDelivery(
        pod.id,
        buildPodBody(pod, snapshot, confirming ? 'CONFIRMED' : 'INITIATED'),
      );
      return mergeSavedPod(pod, response);
    },
    onSuccess: async (saved, { snapshot, confirming }) => {
      const next = podDraft(saved);
      const merged = mergePodDraft(form.state.values, snapshot, next);
      for (const key of ['lines', 'receivedBy', 'deliveredBy', 'receivedDate'] as const)
        form.setFieldValue(key, merged[key]);
      setBaseline(next);
      setPod(saved);
      client.setQueryData(proofOfDeliveryOptions(pod.id).queryKey, saved);
      toast.success(t(confirming ? 'orders.pod.confirmed' : 'orders.pod.saved'), {
        description: t(
          confirming ? 'orders.pod.confirmed-description' : 'orders.pod.saved-description',
        ),
      });
      if (confirming) {
        setConfirm(false);
        leaving.current = true;
        if (order.receivingFacility)
          refreshOfflineDownload(homeStockRefreshKey(order.receivingFacility.id, order.program.id));
        await Promise.all([
          client.invalidateQueries({ queryKey: queryKeys.orders.all }),
          client.invalidateQueries({ queryKey: queryKeys.proofsOfDelivery.all }),
          client.invalidateQueries({ queryKey: queryKeys.home.all }),
          client.invalidateQueries({ queryKey: queryKeys.stockCardSummaries.all }),
        ]);
        if (mutation.isCurrent()) onCancel();
      }
    },
    onError: (error) => {
      setConfirm(false);
      setFailure(serverMessage(error) ?? t('error.description'));
    },
  });
  const validate = (mode: 'save' | 'confirm') => {
    const snapshot = form.state.values;
    setAttempted(true);
    const errors: [string, string][] = [];
    for (const line of pod.lineItems) {
      const found = validatePodLine(
        snapshot.lines[line.id],
        {
          quantityShipped: shippedQuantity(line, pod.shipment.lineItems),
          useVvm: line.useVvm,
        },
        mode,
      );
      for (const [key, value] of Object.entries(found))
        errors.push([`lines.${line.id}.${key}`, value]);
    }
    for (const [key, value] of Object.entries(validatePodFooter(snapshot, mode, timeZone)))
      errors.push([key, value]);
    for (const [path, error] of errors)
      form.setFieldMeta(path as 'receivedBy', (meta) => ({
        ...meta,
        isTouched: true,
        errorMap: { ...meta.errorMap, onChange: error },
      }));
    invalidTarget.current = errors[0]?.[0] ?? null;
    if (errors.length) {
      setInvalid(true);
      return null;
    }
    return structuredClone(snapshot);
  };
  const save = async () => {
    const snapshot = validate('save');
    if (!snapshot) return false;
    try {
      await mutation.mutateAsync({ snapshot, confirming: false });
      return true;
    } catch {
      return false;
    }
  };
  const print = usePrintReport({
    serverAuthorized: true,
    userId: getSessionUserId() ?? '',
    beforeRequest: async () => !editable || !dirty || (await save()),
    request: (language) => fetchProofOfDeliveryPdf(pod.id, language),
    onReport: () => openReport(`${order.orderCode ?? pod.id}.pdf`, t('orders.print')),
    successTitle: t('orders.print-success-title'),
    successDescription: t('orders.print-success-description'),
    errorTitle: t('orders.print-error-title'),
    errorDescription: t('orders.print-error-description'),
    refusedDescription: t('orders.print-refused-description'),
  });
  const pending = mutation.isPending || print.isPending;
  const guard = useDiscardGuard(editable && dirty, { pending, allowLeave: () => leaving.current });
  return (
    <>
      <Workspace width="large">
        <WorkspaceHeader>
          <WorkspaceHeading>
            <WorkspaceIcon>
              <ClipboardCheckIcon />
            </WorkspaceIcon>
            <WorkspaceTitle>
              {t('orders.pod.detail-title-program', {
                program: order.program.name ?? order.program.id,
              })}
            </WorkspaceTitle>
            <WorkspaceDescription>{t('orders.pod.detail-description')}</WorkspaceDescription>
          </WorkspaceHeading>
          <WorkspaceActions>
            <Button
              size="lg"
              variant="outline"
              disabled={pending || print.offline}
              onClick={print.print}
            >
              <PrinterIcon data-icon="inline-start" />
              {t('orders.print')}
            </Button>
          </WorkspaceActions>
        </WorkspaceHeader>
        <WorkspaceContent>
          <div className="flex flex-col gap-4">
            <RecordSummary>
              <RecordSummaryHeading>
                <span className="font-normal text-muted-foreground text-xs">
                  {t('orders.pod.columns.order-code')}
                </span>
                <span className="break-words">
                  <bdi>{order.orderCode ?? order.id}</bdi>
                </span>
              </RecordSummaryHeading>
              <RecordSummaryFields>
                <RecordSummaryField label={t('orders.pod.columns.status')}>
                  <OrderStatusBadge status={order.status} />
                </RecordSummaryField>
                <RecordSummaryField label={t('orders.pod.ordering-facility')}>
                  {[order.facility.code, order.facility.name].filter(Boolean).join(' - ')}
                </RecordSummaryField>
                <RecordSummaryField label={t('orders.pod.columns.created-date')}>
                  {orEmpty(
                    formatTimestamp(order.createdDate, i18n.language, { time: true, timeZone }),
                  )}
                </RecordSummaryField>
                <RecordSummaryField label={t('orders.pod.reporting-period')}>
                  {order.processingPeriod
                    ? [order.processingPeriod.startDate, order.processingPeriod.endDate]
                        .map((date) => formatDateValue(date ?? '', i18n.language))
                        .join(' - ')
                    : orEmpty(null)}
                </RecordSummaryField>
                <RecordSummaryField label={t('orders.pod.supplying-facility')}>
                  {order.supplyingFacility.name ?? order.supplyingFacility.id}
                </RecordSummaryField>
                <RecordSummaryField label={t('orders.pod.columns.emergency')}>
                  <FlagBadge
                    value={order.emergency ?? false}
                    trueLabel={t('orders.yes')}
                    falseLabel={t('orders.no')}
                  />
                </RecordSummaryField>
              </RecordSummaryFields>
            </RecordSummary>
            {!editable && (
              <Alert>
                <AlertDescription>{t('orders.pod.read-only')}</AlertDescription>
              </Alert>
            )}
            {pod.lineItems.some(
              (line) => shippedQuantity(line, pod.shipment.lineItems) === null,
            ) && (
              <Alert variant="warning">
                <AlertDescription>{t('orders.pod.no-shipped-quantity')}</AlertDescription>
              </Alert>
            )}
            <form
              id="pod-editor"
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (editable && !pending) void save();
              }}
            >
              <PodGrid
                form={form}
                groups={groups}
                lots={lots}
                reasons={reasons}
                editable={editable}
                disabled={pending && mutation.variables?.confirming === true}
                attempted={attempted}
              />
              <div className="ms-auto w-full max-w-2xl">
                <SettingsList>
                  {(['deliveredBy', 'receivedBy', 'receivedDate'] as const).map((key) =>
                    editable ? (
                      <form.AppField
                        key={key}
                        name={key}
                        validators={{
                          onChange: ({ fieldApi }) =>
                            attempted || fieldApi.state.meta.isBlurred
                              ? validatePodFooter(form.state.values, 'confirm', timeZone)[key]
                              : undefined,
                        }}
                        listeners={{ onBlur: ({ fieldApi }) => void fieldApi.validate('change') }}
                      >
                        {(field) =>
                          key === 'receivedDate' ? (
                            <field.DateField
                              label={t('orders.pod.received-date')}
                              placeholder={t('orders.pod.received-date')}
                              layout="row"
                              required
                              latest={toDateValue(new Date(), timeZone)}
                              disabled={pending && mutation.variables?.confirming === true}
                            />
                          ) : (
                            <field.TextField
                              label={t(
                                key === 'deliveredBy'
                                  ? 'orders.pod.delivered-by'
                                  : 'orders.pod.received-by',
                              )}
                              layout="row"
                              required
                              disabled={pending && mutation.variables?.confirming === true}
                            />
                          )
                        }
                      </form.AppField>
                    ) : (
                      <SettingsItem
                        key={key}
                        label={t(
                          key === 'receivedDate'
                            ? 'orders.pod.received-date'
                            : key === 'receivedBy'
                              ? 'orders.pod.received-by'
                              : 'orders.pod.delivered-by',
                        )}
                      >
                        {orEmpty(
                          key === 'receivedDate'
                            ? formatDateValue(baseline[key], i18n.language)
                            : baseline[key],
                        )}
                      </SettingsItem>
                    ),
                  )}
                </SettingsList>
              </div>
            </form>
          </div>
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width="large">
        <Button size="lg" variant="outline" disabled={pending} onClick={onCancel}>
          {t('orders.edit.cancel')}
        </Button>
        {editable && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              size="lg"
              variant="outline"
              type="submit"
              form="pod-editor"
              disabled={pending || !dirty}
            >
              {t('orders.pod.save')}
            </Button>
            <Button
              size="lg"
              disabled={pending}
              onClick={() => {
                if (validate('confirm')) setConfirm(true);
              }}
            >
              {t('orders.pod.confirm')}
            </Button>
          </div>
        )}
      </WorkspaceFooter>
      <AlertDialog
        open={confirm}
        onOpenChange={(open) => {
          if (!pending) setConfirm(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('orders.pod.confirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('orders.pod.confirm-description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t('orders.edit.cancel')}</AlertDialogCancel>
            <Button
              disabled={pending}
              onClick={() => {
                const snapshot = validate('confirm');
                if (snapshot) mutation.mutate({ snapshot, confirming: true });
                else setConfirm(false);
              }}
            >
              {t('orders.pod.confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <InvalidSubmitDialog
        open={invalid}
        onOpenChange={setInvalid}
        title={t('orders.pod.invalid-form')}
        description={t('orders.pod.correct-errors')}
        closeLabel={t('dialog.close')}
        onOpenChangeComplete={(open) => {
          if (!open && invalidTarget.current) {
            const field = document.getElementById(invalidTarget.current);
            if (field) revealField(field, !!field.closest('li'));
          }
        }}
      />
      <InvalidSubmitDialog
        open={failure !== null}
        onOpenChange={(open) => {
          if (!open) setFailure(null);
        }}
        title={t('orders.pod.save-failed')}
        description={failure}
        closeLabel={t('dialog.close')}
      />
      <DiscardChangesDialog {...guard.dialog} description={t('orders.pod.discard-description')} />
    </>
  );
}
