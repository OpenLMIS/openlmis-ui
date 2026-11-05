import { useStore } from '@tanstack/react-form';
import type { ParseKeys } from 'i18next';
import { type ReactNode, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsItem, SettingsList } from '@/components/form/settings-list';
import { FieldSet } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import type { InventoryItemFormApi } from '@/features/cce-inventory/components/use-inventory-item-form';
import { makeModelLabel } from '@/features/cce-inventory/lib/catalog';
import {
  EQUIPMENT_REASONS,
  hasFixedPowerModel,
  POWER_FIELDS,
  POWER_STATUSES,
  type PowerField,
  statusUsesDecommission,
  statusUsesReason,
  TEMPERATURE_GAUGES,
  TEMPERATURE_MONITORS,
  UTILIZATIONS,
} from '@/features/cce-inventory/lib/inventory-item-form';
import type {
  CatalogItem,
  PowerStatus,
  TemperatureGauge,
  TemperatureMonitor,
  Utilization,
} from '@/features/cce-inventory/lib/types';
import {
  EQUIPMENT_REASON_KEYS,
  EQUIPMENT_STATUS,
  EQUIPMENT_STATUSES,
} from '@/lib/cce-equipment-status';
import { orEmpty } from '@/lib/empty-value';
import { type FacilityProgramOptions, recordLabel } from '@/lib/facility-program-selection';

export const UTILIZATION_KEYS: Record<Utilization, ParseKeys> = {
  ACTIVE: 'cce-inventory.form.active',
  NOT_IN_USE: 'cce-inventory.form.not-in-use',
  IN_STORE_FOR_ALLOCATION: 'cce-inventory.form.in-store-for-allocation',
};

export const POWER_KEYS: Record<PowerStatus, ParseKeys> = {
  YES: 'cce-inventory.form.yes',
  NO: 'cce-inventory.form.no',
  UNKNOWN: 'cce-inventory.form.unknown',
  NOT_APPLICABLE: 'cce-inventory.form.not-applicable',
};

export const GAUGE_KEYS: Record<TemperatureGauge, ParseKeys> = {
  BUILD_IN: 'cce-inventory.form.built-in',
  PAIRED: 'cce-inventory.form.paired',
  NO_GAUGE: 'cce-inventory.form.no-gauge',
};

export const MONITOR_KEYS: Record<TemperatureMonitor, ParseKeys> = {
  BUILD_IN: 'cce-inventory.form.built-in',
  PAIRED: 'cce-inventory.form.paired',
  NO_RTM: 'cce-inventory.form.no-rtm',
};

const POWER_LABELS: Record<PowerField, ParseKeys> = {
  'details.voltageStabilizer': 'cce-inventory.form.voltage-stabilizer',
  'details.voltageRegulator': 'cce-inventory.form.voltage-regulator',
  'details.backupGenerator': 'cce-inventory.form.backup-generator',
};

function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h3 className="shrink-0 font-medium text-sm" id={id}>
        {children}
      </h3>
      <div className="min-w-0 flex-1">
        <Separator />
      </div>
    </div>
  );
}

export function Section({ legend, children }: { legend: string; children: ReactNode }) {
  const id = useId();
  return (
    <FieldSet aria-labelledby={id}>
      <SectionHeading id={id}>{legend}</SectionHeading>
      <div className="flex flex-col gap-5">{children}</div>
    </FieldSet>
  );
}

export type FormProps = { form: InventoryItemFormApi };

export type CatalogFormProps = FormProps & { catalog: readonly CatalogItem[] };

export function ChosenEquipment({
  form,
  options,
  catalog,
}: CatalogFormProps & { options: FacilityProgramOptions }) {
  const { t } = useTranslation();
  const { pair, equipmentType, catalogItemId } = form.state.values;
  const programs = pair.mode === 'my' ? options.myPrograms : options.supervisedPrograms;
  const program = programs.find((record) => record.id === pair.programId);
  const facility = pair.programId
    ? options.facilitiesFor(pair.programId).find((record) => record.id === pair.facilityId)
    : undefined;
  const model = catalog.find((item) => item.id === catalogItemId);
  const rows: [ParseKeys, string][] = [
    ['facility-program.facility', facility ? recordLabel(facility) : ''],
    ['facility-program.program', program ? recordLabel(program) : ''],
    ['cce-inventory.form.equipment-type', equipmentType ?? ''],
    ['cce-inventory.make-model', model ? makeModelLabel(model) : ''],
  ];
  return <ReadOnlySection legend={t('cce-inventory.form.equipment')} rows={rows} />;
}

export type ReadOnlyRow = [ParseKeys, ReactNode];

export function ReadOnlySection({
  legend,
  rows,
  children,
}: {
  legend?: string;
  rows: ReadOnlyRow[];
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <section aria-labelledby={legend ? id : undefined} className="flex flex-col gap-2">
      {legend && <SectionHeading id={id}>{legend}</SectionHeading>}
      <SettingsList density="compact">
        {rows.map(([label, value]) => (
          <SettingsItem key={label} label={t(label)}>
            <bdi>{orEmpty(value)}</bdi>
          </SettingsItem>
        ))}
        {children}
      </SettingsList>
    </section>
  );
}

export function DetailsFields({
  form,
  catalog,
  children,
}: CatalogFormProps & { children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <>
      <IdentificationSection form={form} />
      <HistorySection form={form} />
      <InstallationSection catalog={catalog} form={form} />
      {children}
      <form.AppField name="details.additionalNotes">
        {(field) => (
          <field.TextareaField dir="auto" label={t('cce-inventory.form.additional-notes')} />
        )}
      </form.AppField>
    </>
  );
}

function IdentificationSection({ form }: FormProps) {
  const { t } = useTranslation();
  return (
    <Section legend={t('cce-inventory.form.identification')}>
      <form.AppField name="details.equipmentTrackingId">
        {(field) => (
          <field.TextField
            autoComplete="off"
            dir="auto"
            label={t('cce-inventory.form.serial-number')}
            required
          />
        )}
      </form.AppField>
      <form.AppField name="details.referenceName">
        {(field) => (
          <field.TextField
            autoComplete="off"
            description={t('cce-inventory.form.reference-name-description')}
            dir="auto"
            label={t('cce-inventory.reference-name')}
            required
          />
        )}
      </form.AppField>
    </Section>
  );
}

function HistorySection({ form }: FormProps) {
  const { t } = useTranslation();
  return (
    <Section legend={t('cce-inventory.form.history')}>
      <form.AppField name="details.utilization">
        {(field) => (
          <field.SelectField
            placeholder={t('cce-inventory.form.select-option')}
            items={UTILIZATIONS.map((value) => ({ value, label: t(UTILIZATION_KEYS[value]) }))}
            label={t('cce-inventory.form.utilization')}
            required
          />
        )}
      </form.AppField>
      <form.AppField name="details.yearOfInstallation">
        {(field) => (
          <field.NumberField label={t('cce-inventory.form.year-of-installation')} required />
        )}
      </form.AppField>
      <form.AppField name="details.source">
        {(field) => (
          <field.TextField
            autoComplete="off"
            description={t('cce-inventory.form.source-description')}
            dir="auto"
            label={t('cce-inventory.form.source')}
          />
        )}
      </form.AppField>
      <form.AppField name="details.yearOfWarrantyExpiry">
        {(field) => <field.NumberField label={t('cce-inventory.form.year-of-warranty-expiry')} />}
      </form.AppField>
    </Section>
  );
}

function InstallationSection({ form, catalog }: CatalogFormProps) {
  const { t } = useTranslation();
  const fixed = useStore(form.store, (state) =>
    hasFixedPowerModel(catalog, state.values.catalogItemId),
  );
  const powerItems = POWER_STATUSES.map((value) => ({ value, label: t(POWER_KEYS[value]) }));

  return (
    <Section legend={t('cce-inventory.form.installation')}>
      {POWER_FIELDS.map((name) => (
        <form.AppField key={name} name={name}>
          {(field) => (
            <field.SelectField
              placeholder={t('cce-inventory.form.select-option')}
              disabled={fixed}
              items={powerItems}
              label={t(POWER_LABELS[name])}
              required
            />
          )}
        </form.AppField>
      ))}
      <form.AppField name="details.manualTemperatureGauge">
        {(field) => (
          <field.SelectField
            placeholder={t('cce-inventory.form.select-option')}
            items={TEMPERATURE_GAUGES.map((value) => ({ value, label: t(GAUGE_KEYS[value]) }))}
            label={t('cce-inventory.form.manual-temperature-gauge')}
            required
          />
        )}
      </form.AppField>
      <form.AppField name="details.remoteTemperatureMonitor">
        {(field) => (
          <field.SelectField
            placeholder={t('cce-inventory.form.select-option')}
            items={TEMPERATURE_MONITORS.map((value) => ({ value, label: t(MONITOR_KEYS[value]) }))}
            label={t('cce-inventory.form.remote-temperature-monitor')}
            required
          />
        )}
      </form.AppField>
    </Section>
  );
}

export function StatusSection({ form }: FormProps) {
  const { t } = useTranslation();
  const status = useStore(form.store, (state) => state.values.details.functionalStatus);
  const shownStatus = useRef(status);

  return (
    <Section legend={t('cce-inventory.form.status')}>
      <form.AppField
        listeners={{
          onChange: ({ value }) => {
            if (value === shownStatus.current) return;
            shownStatus.current = value;
            form.setFieldValue('details.reasonNotWorkingOrNotInUse', '');
            form.setFieldValue('details.decommissionDate', '');
          },
        }}
        name="details.functionalStatus"
      >
        {(field) => (
          <field.SelectField
            placeholder={t('cce-inventory.form.select-option')}
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
        <form.AppField name="details.reasonNotWorkingOrNotInUse">
          {(field) => (
            <field.SelectField
              placeholder={t('cce-inventory.form.select-option')}
              items={EQUIPMENT_REASONS.map((value) => ({
                value,
                label: t(EQUIPMENT_REASON_KEYS[value]),
              }))}
              label={t('cce-inventory.form.reason')}
              required
            />
          )}
        </form.AppField>
      )}
      {statusUsesDecommission(status) && (
        <form.AppField name="details.decommissionDate">
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
  );
}
