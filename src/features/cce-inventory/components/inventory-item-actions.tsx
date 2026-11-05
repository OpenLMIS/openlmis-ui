import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorAlert, RetryButton, serverMessage } from '@/components/display/dialog-parts';
import { DiscardChangesDialog } from '@/components/display/discard-changes-dialog';
import { formatTimestamp } from '@/components/form/date-value';
import { useAppForm } from '@/components/form/form';
import { SettingsRowFrame } from '@/components/form/settings-list';
import {
  FormDialogBody,
  FormDialogFooter,
  FormDialogForm,
  FormDialogHeader,
  FormDialogSubmit,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { useFacilityProgramOptions } from '@/components/pickers/facility-program-selector/use-facility-program-options';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  dismissAlert,
  fetchAlertHistory,
  fetchInventoryItem,
  transferInventoryItem,
  updateInventoryItem,
} from '@/features/cce-inventory/api/api';
import { inventoryAlertsOptions } from '@/features/cce-inventory/api/queries';
import {
  ReadOnlySection,
  Section,
} from '@/features/cce-inventory/components/inventory-item-sections';
import { useItemDialogGuard } from '@/features/cce-inventory/components/use-item-dialog-guard';
import { activeAlertsByDevice, alertText } from '@/features/cce-inventory/lib/alerts';
import {
  EQUIPMENT_REASONS,
  type StatusValues,
  statusSchema,
  statusUsesDecommission,
  statusUsesReason,
  type TransferValues,
  toStatusUpdate,
  transferSchema,
} from '@/features/cce-inventory/lib/inventory-item-form';
import type { InventoryAlert, InventoryItemRecord } from '@/features/cce-inventory/lib/types';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { usePrintReport } from '@/hooks/use-print-report';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import {
  EQUIPMENT_REASON_KEYS,
  EQUIPMENT_STATUS,
  EQUIPMENT_STATUSES,
} from '@/lib/cce-equipment-status';
import { recordLabel } from '@/lib/facility-program-selection';
import { queryKeys } from '@/lib/key-factory';
import { openReport } from '@/lib/open-report';
import type { ProgramGrant } from '@/lib/permissions';
import { RIGHTS } from '@/lib/rights';
import { toWholeNumber } from '@/lib/whole-number';

export const SAVE_KEY = ['cce-inventory', 'save'];

type ActionProps = {
  item: InventoryItemRecord;
  userId: string;
  onBack: () => void;
  onDone: () => void;
  onCloseCancelled: () => void;
};

const notAlerts = ({ queryKey }: { queryKey: readonly unknown[] }) => queryKey[1] !== 'alerts';
const listsOnly = ({ queryKey }: { queryKey: readonly unknown[] }) => queryKey[1] === 'list';

export function useItemSave<TValues>(
  save: (values: TValues) => Promise<void>,
  onSaved: (values: TValues, fresh: boolean) => void,
  refreshed = notAlerts,
) {
  const queryClient = useQueryClient();
  const leaving = useRef(false);
  const mutation = useSessionMutation({
    mutationKey: SAVE_KEY,
    mutationFn: async (values: TValues) => {
      await save(values);
      return queryClient
        .invalidateQueries(
          { queryKey: queryKeys.inventoryItems.all, predicate: refreshed },
          { throwOnError: true },
        )
        .then(
          () => true,
          () => false,
        );
    },
    onSuccess: (fresh, values) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.home.all });
      leaving.current = true;
      onSaved(values, fresh);
    },
  });
  const allowLeave = useCallback(() => leaving.current, []);
  return { mutation, leaving, allowLeave };
}

type ActionFormProps = {
  title: string;
  name: string;
  pending: boolean;
  error: unknown;
  canSubmit: boolean;
  onSubmit: () => void;
  onBack: () => void;
  children: ReactNode;
};

function ActionForm({
  title,
  name,
  pending,
  error,
  canSubmit,
  onSubmit,
  onBack,
  children,
}: ActionFormProps) {
  const { t } = useTranslation();
  return (
    <FormDialogForm onSubmit={onSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{title}</FormDialogTitle>
      </FormDialogHeader>
      <FormDialogBody>
        <div className="flex flex-col gap-6" inert={pending}>
          <h3 className="font-medium text-base">
            <bdi>{name}</bdi>
          </h3>
          {error !== null && (
            <ErrorAlert
              description={serverMessage(error) ?? t('cce-inventory.form.save-error')}
              title={t('cce-inventory.form.save-error-title')}
            />
          )}
          {children}
        </div>
      </FormDialogBody>
      <FormDialogFooter>
        <Button disabled={pending} onClick={onBack} type="button" variant="outline">
          {t('dialog.cancel')}
        </Button>
        <FormDialogSubmit disabled={!canSubmit} pending={pending}>
          {t('cce-inventory.status.update')}
        </FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}

export function StatusItem({
  item,
  userId,
  facilityName,
  onBack,
  onDone,
  onCloseCancelled,
}: ActionProps & { facilityName: string | null }) {
  const { t } = useTranslation();
  const { labelKey, tone, icon: Icon } = EQUIPMENT_STATUS[item.functionalStatus];
  const { mutation, leaving, allowLeave } = useItemSave(
    async (status: StatusValues) =>
      updateInventoryItem(
        toStatusUpdate(await fetchInventoryItem(item.id), statusSchema.parse(status)),
      ),
    () => {
      toast.success(t('cce-inventory.status.saved-title'), {
        description: t('cce-inventory.status.saved', { name: item.referenceName }),
      });
      onDone();
    },
  );
  const defaultValues: StatusValues = {
    functionalStatus: item.functionalStatus,
    reasonNotWorkingOrNotInUse: item.reasonNotWorkingOrNotInUse ?? '',
    decommissionDate: item.decommissionDate ?? '',
  };
  const form = useAppForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: statusSchema },
    onSubmit: ({ value }) => mutation.mutateAsync(value).catch(() => undefined),
  });
  const status = useStore(form.store, (state) => state.values.functionalStatus);
  const valid = useStore(form.store, (state) => statusSchema.safeParse(state.values).success);
  const dirty = useStore(form.store, (state) => !state.isDefaultValue);
  const guard = useItemDialogGuard({ dirty, pending: mutation.isPending, allowLeave });
  const shownStatus = useRef(status);
  const alerts = useItemAlerts(item, userId);

  return (
    <>
      <ActionForm
        canSubmit={valid}
        error={mutation.error}
        name={item.referenceName}
        onBack={onBack}
        onSubmit={() => {
          if (!form.state.isSubmitting && !leaving.current) void form.handleSubmit();
        }}
        pending={mutation.isPending}
        title={t('cce-inventory.form.status')}
      >
        <ReadOnlySection
          rows={[
            ['facility-program.facility', facilityName],
            ['cce-inventory.form.equipment-type', item.catalogItem.type],
            [
              'cce-inventory.status.current',
              <Badge key="status" variant={tone}>
                <Icon data-icon="inline-start" />
                {t(labelKey)}
              </Badge>,
            ],
          ]}
        >
          {alerts.row}
        </ReadOnlySection>
        {alerts.error}
        <Section legend={t('cce-inventory.status.update-section')}>
          <form.AppField
            listeners={{
              onChange: ({ value }) => {
                if (value === shownStatus.current) return;
                shownStatus.current = value;
                form.setFieldValue('reasonNotWorkingOrNotInUse', '');
                form.setFieldValue('decommissionDate', '');
              },
            }}
            name="functionalStatus"
          >
            {(field) => (
              <field.SelectField
                items={EQUIPMENT_STATUSES.map((value) => ({
                  value,
                  label: t(EQUIPMENT_STATUS[value].labelKey),
                }))}
                label={t('cce-inventory.form.functional-status')}
                required
              />
            )}
          </form.AppField>
          {statusUsesReason(status) && (
            <form.AppField name="reasonNotWorkingOrNotInUse">
              {(field) => (
                <field.SelectField
                  items={EQUIPMENT_REASONS.map((value) => ({
                    value,
                    label: t(EQUIPMENT_REASON_KEYS[value]),
                  }))}
                  label={t('cce-inventory.form.reason')}
                  placeholder={t('cce-inventory.form.select-option')}
                  required
                />
              )}
            </form.AppField>
          )}
          {statusUsesDecommission(status) && (
            <form.AppField name="decommissionDate">
              {(field) => (
                <field.DateField
                  label={t('cce-inventory.form.decommission-date')}
                  placeholder={t('cce-inventory.form.decommission-date-placeholder')}
                  required
                />
              )}
            </form.AppField>
          )}
        </Section>
      </ActionForm>
      <DiscardChangesDialog
        description={t('cce-inventory.status.discard')}
        {...guard}
        onKeepEditing={() => {
          guard.onKeepEditing();
          onCloseCancelled();
        }}
      />
    </>
  );
}

function useItemAlerts(item: InventoryItemRecord, userId: string) {
  const { t, i18n } = useTranslation();
  const timeZone = useDeploymentTimeZone();
  const { data: alerts = [], isError, refetch } = useQuery(inventoryAlertsOptions([item.id]));
  const queryClient = useQueryClient();
  const historyButton = useRef<HTMLButtonElement>(null);
  const dismiss = useSessionMutation({
    mutationFn: dismissAlert,
    onSuccess: async (_, dismissed) => {
      queryClient.setQueriesData<InventoryAlert[]>(
        { queryKey: [...queryKeys.inventoryItems.all, 'alerts'] },
        (list) =>
          list?.map((alert) =>
            alert.alert_id === dismissed.alert_id ? { ...alert, dismissed: true } : alert,
          ),
      );
      historyButton.current?.focus();
      await queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItems.all });
    },
    onError: () =>
      toast.error(t('cce-inventory.status.dismiss-error-title'), {
        description: t('cce-inventory.status.dismiss-error'),
      }),
  });
  const history = usePrintReport({
    userId,
    facilityId: item.facility.id,
    programId: item.program.id,
    right: RIGHTS.cceInventoryView,
    request: (lang) => fetchAlertHistory(item.id, lang),
    onReport: () =>
      openReport(`alert_history_${item.id}.pdf`, t('cce-inventory.status.history-loading')),
    successTitle: t('cce-inventory.status.history-title'),
    successDescription: t('cce-inventory.status.history-ready'),
    errorTitle: t('cce-inventory.status.history-error-title'),
    errorDescription: t('cce-inventory.status.history-error'),
    refusedDescription: t('cce-inventory.status.history-refused'),
  });
  if (isError && alerts.length === 0) {
    return {
      error: (
        <ErrorAlert
          action={<RetryButton onClick={() => void refetch()} />}
          description={t('cce-inventory.status.alerts-error')}
          title={t('cce-inventory.status.alerts-error-title')}
        />
      ),
    };
  }
  if (alerts.length === 0) return {};
  const active = activeAlertsByDevice(alerts).get(item.id) ?? [];

  return {
    row: (
      <SettingsRowFrame
        description={
          <div className="pt-1">
            <Button
              disabled={history.isPending || history.offline}
              focusableWhenDisabled={history.isPending}
              onClick={history.print}
              ref={historyButton}
              size="sm"
              variant="outline"
            >
              {t('cce-inventory.status.view-history')}
            </Button>
          </div>
        }
        label={<span className="text-sm">{t('cce-inventory.alerts-title')}</span>}
        value="wide"
      >
        {active.length === 0 ? (
          <p className="text-end font-medium text-sm">{t('cce-inventory.status.no-alerts')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {active.map((alert) => {
              const time = formatTimestamp(alert.start_ts, i18n.language, {
                time: true,
                timeZone,
              });
              return (
                <li className="flex items-start justify-between gap-3 text-sm" key={alert.alert_id}>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-muted-foreground text-xs">{time}</span>
                    <span dir="auto">{alertText(alert, i18n.language)}</span>
                  </div>
                  <Button
                    aria-label={t('cce-inventory.status.dismiss-label', { time })}
                    disabled={dismiss.isPending}
                    focusableWhenDisabled
                    onClick={() => dismiss.mutate(alert)}
                    size="sm"
                    variant="outline"
                  >
                    {t('cce-inventory.status.dismiss')}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsRowFrame>
    ),
  };
}

export function TransferItem({
  item,
  userId,
  grants,
  onBack,
  onDone,
  onCloseCancelled,
}: ActionProps & { grants: readonly ProgramGrant[] }) {
  const { t } = useTranslation();
  const options = useFacilityProgramOptions(userId, grants);
  const programs = [...new Set([...options.myPrograms, ...options.supervisedPrograms])].sort(
    (a, b) => recordLabel(a).localeCompare(recordLabel(b)),
  );
  const facilitiesOf = (programId: string | null) =>
    programId ? options.facilitiesFor(programId) : [];

  const { mutation, leaving, allowLeave } = useItemSave(
    async (values: TransferValues) => {
      const { target, yearOfInstallation } = transferSchema.parse(values);
      await transferInventoryItem(item.id, {
        ...target,
        yearOfInstallation: toWholeNumber(yearOfInstallation),
      });
    },
    (values) => {
      const { programId, facilityId } = values.target;
      const facility = facilitiesOf(programId).find(({ id }) => id === facilityId);
      toast.success(t('cce-inventory.transfer.saved-title'), {
        description: t('cce-inventory.transfer.saved', {
          name: item.referenceName,
          facility: facility ? recordLabel(facility) : '',
        }),
      });
      onDone();
    },
    listsOnly,
  );
  const keepsPair = facilitiesOf(item.program.id).some(({ id }) => id === item.facility.id);
  const defaultValues: TransferValues = {
    target: {
      programId: keepsPair ? item.program.id : null,
      facilityId: keepsPair ? item.facility.id : null,
    },
    yearOfInstallation: String(item.yearOfInstallation),
  };
  const form = useAppForm({
    defaultValues,
    validationLogic: revalidateLogic({ mode: 'change' }),
    validators: { onDynamic: transferSchema },
    onSubmit: ({ value }) => mutation.mutateAsync(value).catch(() => undefined),
  });
  const programId = useStore(form.store, (state) => state.values.target.programId);
  const valid = useStore(form.store, (state) => transferSchema.safeParse(state.values).success);
  const dirty = useStore(form.store, (state) => !state.isDefaultValue);
  const guard = useItemDialogGuard({ dirty, pending: mutation.isPending, allowLeave });
  const facilityItems = facilitiesOf(programId).map((facility) => ({
    value: facility.id,
    label: recordLabel(facility),
    description: facility.code,
  }));

  return (
    <>
      <ActionForm
        canSubmit={valid}
        error={mutation.error}
        name={item.referenceName}
        onBack={onBack}
        onSubmit={() => {
          if (!form.state.isSubmitting && !leaving.current) void form.handleSubmit();
        }}
        pending={mutation.isPending}
        title={t('cce-inventory.transfer.title')}
      >
        <Section legend={t('cce-inventory.form.equipment')}>
          <form.AppField
            listeners={{
              onChange: ({ value }) => {
                const facilities = facilitiesOf(value);
                const facilityId = form.getFieldValue('target.facilityId');
                if (facilities.some(({ id }) => id === facilityId)) return;
                form.setFieldValue(
                  'target.facilityId',
                  facilities.length === 1 ? (facilities[0]?.id ?? null) : null,
                );
              },
            }}
            name="target.programId"
          >
            {(field) => (
              <field.ComboboxField
                clearLabel={t('facility-program.clear-program')}
                emptyMessage={t('facility-program.no-programs')}
                items={programs.map((program) => ({
                  value: program.id,
                  label: recordLabel(program),
                }))}
                label={t('facility-program.program')}
                limit={-1}
                placeholder={t('facility-program.program-placeholder')}
                required
              />
            )}
          </form.AppField>
          <form.AppField name="target.facilityId">
            {(field) => (
              <field.ComboboxField
                clearLabel={t('facility-program.clear-facility')}
                disabled={!programId}
                emptyMessage={t('facility-program.no-facilities')}
                items={facilityItems}
                label={t('facility-program.facility')}
                limit={-1}
                placeholder={
                  programId
                    ? t('facility-program.facility-placeholder')
                    : t('facility-program.facility-after-program')
                }
                required
              />
            )}
          </form.AppField>
          <form.AppField name="yearOfInstallation">
            {(field) => (
              <field.NumberField label={t('cce-inventory.form.year-of-installation')} required />
            )}
          </form.AppField>
        </Section>
      </ActionForm>
      <DiscardChangesDialog
        description={t('cce-inventory.transfer.discard')}
        {...guard}
        onKeepEditing={() => {
          guard.onKeepEditing();
          onCloseCancelled();
        }}
      />
    </>
  );
}
