import { useStore } from '@tanstack/react-form';
import {
  useIsMutating,
  useQuery,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { ParseKeys } from 'i18next';
import { type RefObject, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import {
  DialogLoadError,
  DialogNotFound,
  ErrorAlert,
  FieldSkeleton,
  SkeletonLine,
  serverMessage,
} from '@/components/display/dialog-parts';
import { DiscardChangesDialog } from '@/components/display/discard-changes-dialog';
import { formatDateValue, formatTimestamp } from '@/components/form/date-value';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogForm,
  FormDialogHeader,
  FormDialogSubmit,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchInventoryItem, updateInventoryItem } from '@/features/cce-inventory/api/api';
import { inventoryAlertsOptions, inventoryItemOptions } from '@/features/cce-inventory/api/queries';
import {
  SAVE_KEY,
  StatusItem,
  TransferItem,
  useItemSave,
} from '@/features/cce-inventory/components/inventory-item-actions';
import {
  DetailsFields,
  GAUGE_KEYS,
  MONITOR_KEYS,
  POWER_KEYS,
  type ReadOnlyRow,
  ReadOnlySection,
  Section,
  UTILIZATION_KEYS,
} from '@/features/cce-inventory/components/inventory-item-sections';
import { useCloseOnce } from '@/features/cce-inventory/components/use-close-once';
import { useInventoryItemForm } from '@/features/cce-inventory/components/use-inventory-item-form';
import { useItemDialogGuard } from '@/features/cce-inventory/components/use-item-dialog-guard';
import { makeModelLabel } from '@/features/cce-inventory/lib/catalog';
import {
  inventoryItemSchema,
  solarPower,
  toEditValues,
  toInventoryItemUpdate,
  type ValidInventoryItemDetails,
} from '@/features/cce-inventory/lib/inventory-item-form';
import type { InventorySearch } from '@/features/cce-inventory/lib/search';
import type { InventoryItemRecord, PowerStatus } from '@/features/cce-inventory/lib/types';
import { facilityOptions, programLookupOptions } from '@/features/reference-data/api/queries';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { useOpening } from '@/hooks/use-opening';
import { EQUIPMENT_REASON_KEYS, EQUIPMENT_STATUS } from '@/lib/cce-equipment-status';
import { isNotFound, isRefused } from '@/lib/http';
import type { ProgramGrant } from '@/lib/permissions';
import { fullName } from '@/lib/text';

export type ItemAction = NonNullable<InventorySearch['action']>;

type InventoryItemViewProps = {
  itemId: string | undefined;
  action: ItemAction | undefined;
  stacked: boolean;
  userId: string;
  grants: readonly ProgramGrant[];
  transferGrants: readonly ProgramGrant[];
  onClose: () => void;
  onAction: (action: ItemAction | undefined) => void;
};

export function InventoryItemView({ itemId, onClose, ...content }: InventoryItemViewProps) {
  const { shown, dialogProps } = useDialogTarget(itemId, onClose);
  const pending = useIsMutating({ mutationKey: SAVE_KEY }) > 0;
  const { opening, requestClose, cancelClose } = useCloseOnce(itemId !== undefined, onClose);

  return (
    <FormDialog
      {...dialogProps(pending)}
      onOpenChange={(next) => {
        if (!next && !pending) requestClose();
      }}
      size="table"
    >
      {shown && (
        <ItemBoundary
          {...content}
          id={shown}
          key={opening}
          onCloseCancelled={cancelClose}
          onDone={requestClose}
        />
      )}
    </FormDialog>
  );
}

function ItemBoundary(props: ItemContentProps) {
  const { t } = useTranslation();
  const opening = useOpening();
  const alerts = useQuery({
    ...inventoryAlertsOptions([props.id]),
    enabled: props.action === 'status',
  });
  return (
    <QueryBoundary
      errorComponent={({ error, reset }) =>
        isNotFound(error) || isRefused(error) ? (
          <DialogNotFound
            description={t(
              isRefused(error) ? 'no-access.description' : 'cce-inventory.details.not-found',
            )}
            title={t('cce-inventory.details.title')}
          />
        ) : (
          <DialogLoadError
            error={error}
            errorTitle={t('cce-inventory.details.load-error-title')}
            onRetry={reset}
            title={t('cce-inventory.details.title')}
          />
        )
      }
      pendingFallback={
        <ViewSkeleton
          action={props.stacked ? undefined : props.action}
          editing={props.grants.length > 0}
        />
      }
      resetKey={props.id}
    >
      <ItemContent
        {...props}
        alertsLoading={
          alerts.isPending && alerts.failureCount === 0 && alerts.errorUpdateCount === 0
        }
        opening={opening}
      />
    </QueryBoundary>
  );
}

type ItemContentProps = Omit<InventoryItemViewProps, 'itemId' | 'onClose'> & {
  id: string;
  onCloseCancelled: () => void;
  onDone: () => void;
};

const grantsPair = (grants: readonly ProgramGrant[], item: InventoryItemRecord) =>
  grants.some(
    (grant) => grant.facilityId === item.facility.id && grant.programId === item.program.id,
  );

function ItemContent({
  id,
  opening,
  action,
  stacked,
  userId,
  grants,
  transferGrants,
  onAction,
  onDone,
  onCloseCancelled,
  alertsLoading,
}: ItemContentProps & { opening: number; alertsLoading: boolean }) {
  const { data: item } = useSuspenseQuery(inventoryItemOptions(id, opening));
  const [{ data: facility }, { data: program }] = useSuspenseQueries({
    queries: [facilityOptions(item.facility.id), programLookupOptions(item.program.id)],
  });
  const returnFocus: Record<ItemAction, RefObject<HTMLButtonElement | null>> = {
    edit: useRef<HTMLButtonElement>(null),
    status: useRef<HTMLButtonElement>(null),
    transfer: useRef<HTMLButtonElement>(null),
  };
  const canEdit = grantsPair(grants, item);
  const canTransfer = grantsPair(transferGrants, item);
  const allowed = action === 'transfer' ? canTransfer : action !== undefined && canEdit;
  const shownAction = allowed ? action : undefined;
  const header: ReadOnlyRow[] = [
    ['cce-inventory.details.district', facility.geographicZone.name],
    ['facility-program.facility', facility.name],
    ['facility-program.program', program.name],
    ['cce-inventory.form.equipment-type', item.catalogItem.type],
  ];
  const content = {
    item,
    userId,
    header,
    facilityName: facility.name,
    transferGrants,
    alertsLoading,
  };
  if (shownAction && !stacked) {
    return (
      <ActionContent
        {...content}
        action={shownAction}
        onBack={shownAction === 'status' ? onDone : () => onAction(undefined)}
        onCloseCancelled={onCloseCancelled}
        onDone={onDone}
      />
    );
  }
  return (
    <>
      <ItemDetails
        canEdit={canEdit}
        canTransfer={canTransfer}
        header={header}
        item={item}
        onAction={onAction}
        returnFocus={returnFocus}
      />
      <StackedAction
        {...content}
        action={stacked ? shownAction : undefined}
        onBack={() => onAction(undefined)}
        onDone={onDone}
        returnFocus={returnFocus}
      />
    </>
  );
}

type ActionContentProps = {
  action: ItemAction;
  item: InventoryItemRecord;
  userId: string;
  header: ReadOnlyRow[];
  facilityName: string | null;
  transferGrants: readonly ProgramGrant[];
  alertsLoading: boolean;
  onBack: () => void;
  onDone: () => void;
  onCloseCancelled: () => void;
};

function ActionContent({
  action,
  header,
  facilityName,
  transferGrants,
  alertsLoading,
  ...props
}: ActionContentProps) {
  if (action === 'edit') return <EditItem {...props} header={header} />;
  if (action === 'transfer') return <TransferItem {...props} grants={transferGrants} />;
  return alertsLoading ? (
    <ViewSkeleton action="status" editing />
  ) : (
    <StatusItem {...props} facilityName={facilityName} />
  );
}

function StackedAction({
  action,
  onBack,
  onDone,
  returnFocus,
  ...content
}: Omit<ActionContentProps, 'action' | 'onCloseCancelled'> & {
  action: ItemAction | undefined;
  returnFocus: Record<ItemAction, RefObject<HTMLButtonElement | null>>;
}) {
  const pending = useIsMutating({ mutationKey: SAVE_KEY }) > 0;
  const { shown, dialogProps } = useDialogTarget(action, onBack);
  const { opening, requestClose, cancelClose } = useCloseOnce(action !== undefined, onBack);
  return (
    <FormDialog
      {...dialogProps(pending)}
      finalFocus={shown ? returnFocus[shown] : undefined}
      onOpenChange={(next) => {
        if (!next && !pending) requestClose();
      }}
      size="table"
    >
      {shown && (
        <ActionContent
          {...content}
          action={shown}
          key={opening}
          onBack={requestClose}
          onCloseCancelled={cancelClose}
          onDone={shown === 'transfer' ? onDone : requestClose}
        />
      )}
    </FormDialog>
  );
}

const optional = (label: ParseKeys, value: string | number | undefined): ReadOnlyRow[] =>
  value === undefined || value === '' ? [] : [[label, value]];

function ItemDetails({
  item,
  header,
  canEdit,
  canTransfer,
  onAction,
  returnFocus,
}: {
  item: InventoryItemRecord;
  header: ReadOnlyRow[];
  canEdit: boolean;
  canTransfer: boolean;
  onAction: (action: ItemAction) => void;
  returnFocus: Record<ItemAction, RefObject<HTMLButtonElement | null>>;
}) {
  const { t, i18n } = useTranslation();
  const timeZone = useDeploymentTimeZone();
  const { labelKey, tone, icon: Icon } = EQUIPMENT_STATUS[item.functionalStatus];
  const modifier = fullName(item.lastModifier ?? {});
  const modified = formatTimestamp(item.modifiedDate, i18n.language, { time: true, timeZone });
  const reason = item.reasonNotWorkingOrNotInUse;
  const power = (value: PowerStatus) =>
    t(POWER_KEYS[solarPower(item.catalogItem.energySource, value)]);
  const volume = item.catalogItem.netVolume;

  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{t('cce-inventory.details.title')}</FormDialogTitle>
        <FormDialogDescription>{t('cce-inventory.details.description')}</FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col items-start gap-1 text-sm">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h3 className="min-w-0 font-medium text-base">
                  <bdi>{item.referenceName}</bdi>
                </h3>
                <Badge variant={tone}>
                  <Icon data-icon="inline-start" />
                  {t(labelKey)}
                </Badge>
              </div>
              {reason && <span>{t(EQUIPMENT_REASON_KEYS[reason])}</span>}
              {item.decommissionDate && (
                <span>
                  {t('cce-inventory.details.decommissioned', {
                    date: formatDateValue(item.decommissionDate, i18n.language),
                  })}
                </span>
              )}
              {(modifier || modified) && (
                <span className="text-muted-foreground">
                  <bdi>{modifier}</bdi> {modified}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <Button
                  onClick={() => onAction('status')}
                  ref={returnFocus.status}
                  variant="outline"
                >
                  {t('cce-inventory.details.update-status')}
                </Button>
              )}
              {canTransfer && (
                <Button
                  onClick={() => onAction('transfer')}
                  ref={returnFocus.transfer}
                  variant="outline"
                >
                  {t('cce-inventory.transfer.open')}
                </Button>
              )}
            </div>
          </div>
          <ReadOnlySection
            rows={[
              ...header,
              [
                'cce-inventory.details.net-volume',
                volume === undefined ? '' : t('cce-inventory.details.liters', { volume }),
              ],
            ]}
          />
          <ReadOnlySection
            legend={t('cce-inventory.form.identification')}
            rows={[
              ['cce-inventory.make-model', makeModelLabel(item.catalogItem)],
              ['cce-inventory.form.serial-number', item.equipmentTrackingId],
            ]}
          />
          <ReadOnlySection
            legend={t('cce-inventory.form.history')}
            rows={[
              ['cce-inventory.form.utilization', t(UTILIZATION_KEYS[item.utilization])],
              ['cce-inventory.form.year-of-installation', item.yearOfInstallation],
              ...optional('cce-inventory.form.source', item.source),
              ...optional('cce-inventory.form.year-of-warranty-expiry', item.yearOfWarrantyExpiry),
            ]}
          />
          <ReadOnlySection
            legend={t('cce-inventory.form.installation')}
            rows={[
              ['cce-inventory.form.voltage-stabilizer', power(item.voltageStabilizer)],
              ['cce-inventory.form.backup-generator', power(item.backupGenerator)],
              ['cce-inventory.form.voltage-regulator', power(item.voltageRegulator)],
              [
                'cce-inventory.form.manual-temperature-gauge',
                t(GAUGE_KEYS[item.manualTemperatureGauge]),
              ],
              [
                'cce-inventory.form.remote-temperature-monitor',
                t(MONITOR_KEYS[item.remoteTemperatureMonitor]),
              ],
            ]}
          />
          {item.additionalNotes && (
            <ReadOnlySection
              rows={[['cce-inventory.form.additional-notes', item.additionalNotes]]}
            />
          )}
        </div>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.close')}</FormDialogCancel>
        {canEdit && (
          <Button autoFocus onClick={() => onAction('edit')} ref={returnFocus.edit}>
            {t('cce-inventory.details.edit')}
          </Button>
        )}
      </FormDialogFooter>
    </>
  );
}

function EditItem({
  item,
  header,
  onBack,
  onDone,
  onCloseCancelled,
}: {
  item: InventoryItemRecord;
  header: ReadOnlyRow[];
  onBack: () => void;
  onDone: () => void;
  onCloseCancelled: () => void;
}) {
  const { t } = useTranslation();
  const fields = useRef<HTMLDivElement>(null);
  const {
    mutation: save,
    leaving,
    allowLeave,
  } = useItemSave(
    async (details: ValidInventoryItemDetails) =>
      updateInventoryItem(toInventoryItemUpdate(await fetchInventoryItem(item.id), details)),
    (details, fresh) => {
      toast.success(t('cce-inventory.details.saved-title'), {
        description: t('cce-inventory.details.saved', { name: details.referenceName.trim() }),
      });
      if (fresh) onBack();
      else onDone();
    },
  );

  const form = useInventoryItemForm(
    toEditValues(item),
    (values) => save.mutateAsync(inventoryItemSchema.parse(values).details).catch(() => undefined),
    () =>
      requestAnimationFrame(() =>
        fields.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      ),
  );
  const dirty = useStore(form.store, (state) => !state.isDefaultValue);
  const guard = useItemDialogGuard({ dirty, pending: save.isPending, allowLeave });

  return (
    <>
      <FormDialogForm
        onSubmit={() => {
          if (!form.state.isSubmitting && !leaving.current) void form.handleSubmit();
        }}
      >
        <FormDialogHeader>
          <FormDialogTitle>{t('cce-inventory.details.edit-title')}</FormDialogTitle>
          <FormDialogDescription>
            {t('cce-inventory.details.edit-description')}
          </FormDialogDescription>
        </FormDialogHeader>
        <FormDialogBody>
          <div className="flex flex-col gap-6" inert={save.isPending} ref={fields}>
            {save.isError && (
              <ErrorAlert
                description={serverMessage(save.error) ?? t('cce-inventory.form.save-error')}
                title={t('cce-inventory.form.save-error-title')}
              />
            )}
            <ReadOnlySection
              legend={t('cce-inventory.form.equipment')}
              rows={[...header, ['cce-inventory.make-model', makeModelLabel(item.catalogItem)]]}
            />
            <DetailsFields catalog={[item.catalogItem]} form={form} />
          </div>
        </FormDialogBody>
        <FormDialogFooter>
          <Button disabled={save.isPending} onClick={onBack} type="button" variant="outline">
            {t('dialog.cancel')}
          </Button>
          <FormDialogSubmit pending={save.isPending}>
            {t('cce-inventory.form.save')}
          </FormDialogSubmit>
        </FormDialogFooter>
      </FormDialogForm>
      <DiscardChangesDialog
        description={t('cce-inventory.details.discard-description')}
        {...guard}
        onKeepEditing={() => {
          guard.onKeepEditing();
          onCloseCancelled();
        }}
      />
    </>
  );
}

const ACTION_TITLES: Record<ItemAction, ParseKeys> = {
  edit: 'cce-inventory.details.edit-title',
  status: 'cce-inventory.form.status',
  transfer: 'cce-inventory.transfer.title',
};

function ViewSkeleton({ action, editing }: { action: ItemAction | undefined; editing: boolean }) {
  const { t } = useTranslation();
  const rows = (labels: readonly ParseKeys[]): ReadOnlyRow[] =>
    labels.map((label) => [label, <SkeletonLine key={label} width="short" />]);
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>
          {t(action ? ACTION_TITLES[action] : 'cce-inventory.details.title')}
        </FormDialogTitle>
        {(action === undefined || action === 'edit') && (
          <FormDialogDescription>
            {t(
              action
                ? 'cce-inventory.details.edit-description'
                : 'cce-inventory.details.description',
            )}
          </FormDialogDescription>
        )}
      </FormDialogHeader>
      <FormDialogBody>
        <div aria-busy className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <SkeletonLine width="medium" />
            {action === undefined && <SkeletonLine width="short" />}
          </div>
          {action === undefined ? (
            <>
              <ReadOnlySection rows={rows(HEADER_SKELETON)} />
              <ReadOnlySection
                legend={t('cce-inventory.form.identification')}
                rows={rows(IDENTIFICATION_SKELETON)}
              />
              <ReadOnlySection
                legend={t('cce-inventory.form.history')}
                rows={rows(HISTORY_SKELETON)}
              />
              <ReadOnlySection
                legend={t('cce-inventory.form.installation')}
                rows={rows(INSTALLATION_SKELETON)}
              />
            </>
          ) : (
            <>
              {ACTION_SKELETON[action].length > 0 && (
                <ReadOnlySection rows={rows(ACTION_SKELETON[action])} />
              )}
              <Section legend={t(ACTION_SECTION[action])}>
                {ACTION_FIELDS[action].map((label) => (
                  <FieldSkeleton key={label} label={t(label)} required />
                ))}
              </Section>
            </>
          )}
        </div>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t(action ? 'dialog.cancel' : 'dialog.close')}</FormDialogCancel>
        {editing && (
          <div className="h-8 w-24">
            <Skeleton fill />
          </div>
        )}
      </FormDialogFooter>
    </>
  );
}

const HEADER_SKELETON: readonly ParseKeys[] = [
  'cce-inventory.details.district',
  'facility-program.facility',
  'facility-program.program',
  'cce-inventory.form.equipment-type',
  'cce-inventory.details.net-volume',
];

const IDENTIFICATION_SKELETON: readonly ParseKeys[] = [
  'cce-inventory.make-model',
  'cce-inventory.form.serial-number',
];

const HISTORY_SKELETON: readonly ParseKeys[] = [
  'cce-inventory.form.utilization',
  'cce-inventory.form.year-of-installation',
];

const INSTALLATION_SKELETON: readonly ParseKeys[] = [
  'cce-inventory.form.voltage-stabilizer',
  'cce-inventory.form.backup-generator',
  'cce-inventory.form.voltage-regulator',
  'cce-inventory.form.manual-temperature-gauge',
  'cce-inventory.form.remote-temperature-monitor',
];

const ACTION_SKELETON: Record<ItemAction, readonly ParseKeys[]> = {
  edit: [...HEADER_SKELETON.slice(0, 4), 'cce-inventory.make-model'],
  status: [
    'facility-program.facility',
    'cce-inventory.form.equipment-type',
    'cce-inventory.status.current',
  ],
  transfer: [],
};

const ACTION_SECTION: Record<ItemAction, ParseKeys> = {
  edit: 'cce-inventory.form.identification',
  status: 'cce-inventory.status.update-section',
  transfer: 'cce-inventory.form.equipment',
};

const ACTION_FIELDS: Record<ItemAction, readonly ParseKeys[]> = {
  edit: ['cce-inventory.form.serial-number', 'cce-inventory.reference-name'],
  status: ['cce-inventory.form.functional-status'],
  transfer: [
    'facility-program.program',
    'facility-program.facility',
    'cce-inventory.form.year-of-installation',
  ],
};
