import { revalidateLogic } from '@tanstack/react-form';
import { useIsMutating, useQueryClient, useSuspenseQueries } from '@tanstack/react-query';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  DialogLoadError,
  DialogNotFound,
  ErrorAlert,
  SkeletonLine,
  serverMessage,
} from '@/components/dialog-parts';
import { useAppForm } from '@/components/form/form';
import { SettingsItem, SettingsList } from '@/components/form/settings-list';
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
import { QueryBoundary } from '@/components/query-boundary';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { updateGeographicZone } from '@/features/geographic-zones/api/api';
import { geographicZoneDetailOptions } from '@/features/geographic-zones/api/queries';
import {
  geographicZonePolicy,
  toZoneBody,
  toZoneFormValues,
  type ZoneFormValues,
  zoneFormSchema,
} from '@/features/geographic-zones/lib/zone-form';
import { geographicLevelsOptions } from '@/features/reference-data/api/queries';
import type { GeographicLevel, GeographicZone } from '@/features/reference-data/lib/types';
import { useOpening } from '@/hooks/use-opening';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { orEmpty } from '@/lib/empty-value';
import { isNotFound } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';

const saveKey = (id: string) => [...queryKeys.geographicZones.all, 'save', id] as const;

type GeographicZoneFormDialogProps = {
  target: string | undefined;
  automatic: boolean;
  onClose: () => void;
};

export function GeographicZoneFormDialog({
  target,
  automatic,
  onClose,
}: GeographicZoneFormDialogProps) {
  const { shown, close, dialogProps } = useDialogTarget(target, onClose);
  const isSaving = useIsMutating({ mutationKey: saveKey(shown ?? '') }) > 0;
  return (
    <FormDialog {...dialogProps(isSaving)}>
      {shown && (
        <ZoneDialogContent automatic={automatic} key={shown} onDone={close} zoneId={shown} />
      )}
    </FormDialog>
  );
}

function ZoneDialogContent({
  zoneId,
  automatic,
  onDone,
}: {
  zoneId: string;
  automatic: boolean;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const opening = useOpening();
  const title = t('geographic-zones.details-title');
  return (
    <QueryBoundary
      errorComponent={({ error, reset }) =>
        isNotFound(error) ? (
          <DialogNotFound description={t('geographic-zones.not-found')} title={title} />
        ) : (
          <DialogLoadError
            error={error}
            errorTitle={t('geographic-zones.detail-error-title')}
            onRetry={reset}
            title={title}
          />
        )
      }
      pendingFallback={<ZoneDetailsSkeleton />}
      resetKey={zoneId}
    >
      <ZoneDetails automatic={automatic} onDone={onDone} opening={opening} zoneId={zoneId} />
    </QueryBoundary>
  );
}

function ZoneDetails({
  zoneId,
  opening,
  automatic,
  onDone,
}: {
  zoneId: string;
  opening: number;
  automatic: boolean;
  onDone: () => void;
}) {
  const [{ data: zone }, { data: levels }] = useSuspenseQueries({
    queries: [geographicZoneDetailOptions(zoneId, opening), geographicLevelsOptions()],
  });
  const policy = geographicZonePolicy(zone, levels, automatic);
  if (policy?.editable)
    return <ZoneEditForm automatic={automatic} levels={levels} onDone={onDone} zone={zone} />;
  return <ZoneReadOnly invalidConfiguration={!policy} zone={zone} />;
}

function ZoneValues({ zone }: { zone: GeographicZone }) {
  const { t, i18n } = useTranslation();
  const number = new Intl.NumberFormat(i18n.language);
  return (
    <SettingsList>
      <SettingsItem label={t('geographic-zones.name')}>
        <span dir="auto">{orEmpty(zone.name)}</span>
      </SettingsItem>
      <SettingsItem label={t('geographic-zones.code')}>
        <span dir="auto">{orEmpty(zone.code)}</span>
      </SettingsItem>
      <SettingsItem label={t('geographic-zones.level')}>
        <span dir="auto">{orEmpty(zone.level.name)}</span>
      </SettingsItem>
      <SettingsItem label={t('geographic-zones.parent')}>
        <span dir="auto">{orEmpty(zone.parent?.name)}</span>
      </SettingsItem>
      <SettingsItem label={t('geographic-zones.population')}>
        {zone.catchmentPopulation == null ? orEmpty(null) : number.format(zone.catchmentPopulation)}
      </SettingsItem>
      <SettingsItem label={t('geographic-zones.longitude')}>
        <span dir="ltr">{orEmpty(zone.longitude)}</span>
      </SettingsItem>
      <SettingsItem label={t('geographic-zones.latitude')}>
        <span dir="ltr">{orEmpty(zone.latitude)}</span>
      </SettingsItem>
    </SettingsList>
  );
}

function ZoneReadOnly({
  zone,
  invalidConfiguration,
}: {
  zone: GeographicZone;
  invalidConfiguration: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{t('geographic-zones.view-title', { zone: zone.name })}</FormDialogTitle>
        <FormDialogDescription>{t('geographic-zones.view-description')}</FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <div className="flex flex-col gap-4">
          {invalidConfiguration && (
            <ErrorAlert
              title={t('geographic-zones.configuration-title')}
              description={t('geographic-zones.configuration-description')}
            />
          )}
          <ZoneValues zone={zone} />
        </div>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.close')}</FormDialogCancel>
      </FormDialogFooter>
    </>
  );
}

function ZoneEditForm({
  zone,
  levels,
  automatic,
  onDone,
}: {
  zone: GeographicZone;
  levels: GeographicLevel[];
  automatic: boolean;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const save = useSessionMutation({
    mutationKey: saveKey(zone.id),
    mutationFn: (values: ZoneFormValues) => {
      if (!geographicZonePolicy(zone, levels, automatic)?.editable)
        throw new Error('Population editing is unavailable');
      return updateGeographicZone(zone.id, toZoneBody(values, zone));
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.geographicZones.all,
        predicate: (query) => query.queryKey[1] !== 'detail',
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.geographicZones.all,
        predicate: (query) => query.queryKey[1] === 'detail',
        refetchType: 'none',
      });
      toast.success(t('geographic-zones.saved-title'), {
        description: t('geographic-zones.saved-description', { zone: saved.name }),
      });
      onDone();
    },
  });
  const form = useAppForm({
    defaultValues: toZoneFormValues(zone),
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: zoneFormSchema },
    onSubmit: ({ value }) => {
      if (save.isPending || !geographicZonePolicy(zone, levels, automatic)?.editable) return;
      return save.mutateAsync(value).catch(() => undefined);
    },
  });

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{t('geographic-zones.edit-title', { zone: zone.name })}</FormDialogTitle>
        <FormDialogDescription>
          {t(
            automatic
              ? 'geographic-zones.edit-auto-description'
              : 'geographic-zones.edit-description',
          )}
        </FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <div className="flex flex-col gap-4">
          {save.isError && (
            <ErrorAlert
              description={
                serverMessage(save.error) ?? t('geographic-zones.save-error-description')
              }
              title={t('geographic-zones.save-error-title')}
            />
          )}
          <FieldGroup>
            <DisabledZoneField label={t('geographic-zones.name')} value={zone.name} />
            <DisabledZoneField label={t('geographic-zones.code')} value={zone.code} />
            <DisabledZoneField label={t('geographic-zones.level')} value={zone.level.name} />
            <DisabledZoneField label={t('geographic-zones.parent')} value={zone.parent?.name} />
            <form.AppField name="catchmentPopulation">
              {(field) => (
                <field.NumberField
                  description={t('geographic-zones.population-description')}
                  disabled={save.isPending}
                  label={t('geographic-zones.population')}
                />
              )}
            </form.AppField>
            <DisabledZoneField
              dir="ltr"
              label={t('geographic-zones.longitude')}
              value={zone.longitude}
            />
            <DisabledZoneField
              dir="ltr"
              label={t('geographic-zones.latitude')}
              value={zone.latitude}
            />
          </FieldGroup>
        </div>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={save.isPending}>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit pending={save.isPending}>{t('geographic-zones.save')}</FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}

function DisabledZoneField({
  label,
  value,
  dir = 'auto',
}: {
  label: string;
  value: string | number | null | undefined;
  dir?: 'auto' | 'ltr';
}) {
  const id = useId();
  return (
    <Field data-disabled>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input dir={dir} disabled id={id} value={value ?? ''} />
    </Field>
  );
}

function ZoneDetailsSkeleton() {
  const { t } = useTranslation();
  const keys = ['name', 'code', 'level', 'parent', 'population', 'longitude', 'latitude'] as const;
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{t('geographic-zones.details-title')}</FormDialogTitle>
        <SkeletonLine width="medium" />
      </FormDialogHeader>
      <FormDialogBody>
        <SettingsList>
          {keys.map((key) => (
            <SettingsItem key={key} label={t(`geographic-zones.${key}`)}>
              <SkeletonLine width="short" />
            </SettingsItem>
          ))}
        </SettingsList>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.close')}</FormDialogCancel>
      </FormDialogFooter>
    </>
  );
}
