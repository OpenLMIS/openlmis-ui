import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2Icon, RotateCcwIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorAlert, serverMessage } from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { useAppForm } from '@/components/form/form';
import { SettingsList } from '@/components/form/settings-list';
import { Button } from '@/components/ui/button';
import { saveBranding } from '@/features/system-settings/api/api';
import { appConfigurationOptions } from '@/features/system-settings/api/queries';
import { BrandingPreview } from '@/features/system-settings/components/branding-preview';
import { ConflictAlert } from '@/features/system-settings/components/conflict-alert';
import { ResetDialog } from '@/features/system-settings/components/reset-dialog';
import { SystemSettingsFooter } from '@/features/system-settings/components/system-settings-workspace';
import {
  type BrandingStep,
  brandingSchema,
  brandingSteps,
  LOGO_TYPES,
  logoSchema,
  resetBrandingSteps,
  toBrandingValues,
} from '@/features/system-settings/lib/branding';
import type { AppConfigurationDto } from '@/features/system-settings/lib/types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { DEFAULT_LOGO_URL, rememberAppConfiguration } from '@/lib/app-configuration';
import { isConflict } from '@/lib/http';

const FORM_ID = 'branding-form';

function useLogoPreviewUrl(logo: File | null | undefined, saved: AppConfigurationDto) {
  const objectUrl = useMemo(
    () => (logo instanceof File ? URL.createObjectURL(logo) : null),
    [logo],
  );
  useEffect(
    () => () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
    [objectUrl],
  );
  if (objectUrl) return objectUrl;
  if (logo === null) return DEFAULT_LOGO_URL;
  return saved.logo?.url ?? DEFAULT_LOGO_URL;
}

export function BrandingSettings({ saved }: { saved: AppConfigurationDto }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [conflict, setConflict] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const store = (next: AppConfigurationDto) => {
    queryClient.setQueryData(appConfigurationOptions().queryKey, next);
    rememberAppConfiguration(next);
  };
  const refetch = () =>
    queryClient.invalidateQueries({ queryKey: appConfigurationOptions().queryKey });

  const onError = (error: Error) => {
    if (isConflict(error)) setConflict(true);
    void refetch();
  };

  const save = useMutation({
    mutationFn: (steps: BrandingStep[]) => saveBranding(saved, steps),
    onSuccess: (next) => {
      store(next);
      form.reset(toBrandingValues(next));
      toast.success(t('system-settings.branding.saved-title'), {
        description: t('system-settings.branding.saved-description'),
      });
    },
    onError,
  });

  const reset = useMutation({
    mutationFn: () => saveBranding(saved, resetBrandingSteps(saved)),
    onSuccess: (next) => {
      store(next);
      form.reset(toBrandingValues(next));
      setResetOpen(false);
      toast.success(t('system-settings.branding.reset-done-title'), {
        description: t('system-settings.branding.reset-done-description'),
      });
    },
    onError: (error) => {
      setResetOpen(false);
      onError(error);
    },
  });

  const form = useAppForm({
    defaultValues: toBrandingValues(saved),
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: brandingSchema },
    onSubmit: ({ value }) => save.mutateAsync(brandingSteps(value, saved)).catch(() => undefined),
  });

  const changed = useStore(form.store, (state) => brandingSteps(state.values, saved).length > 0);
  const appName = useStore(form.store, (state) => state.values.appName);
  const logo = useStore(form.store, (state) => state.values.logo);
  const logoUrl = useLogoPreviewUrl(logo, saved);
  const guard = useDiscardGuard(changed);
  const busy = save.isPending || reset.isPending;

  const reload = async () => {
    const fresh = await queryClient.fetchQuery({ ...appConfigurationOptions(), staleTime: 0 });
    setConflict(false);
    save.reset();
    if (fresh) form.reset(toBrandingValues(fresh));
  };

  return (
    <>
      <SystemSettingsFooter>
        <Button
          disabled={!changed || busy}
          onClick={() => {
            save.reset();
            form.reset(toBrandingValues(saved));
          }}
          size="lg"
          variant="outline"
        >
          {t('system-settings.cancel')}
        </Button>
        <Button disabled={!changed || busy} form={FORM_ID} size="lg" type="submit">
          {save.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
          {t('system-settings.save')}
        </Button>
      </SystemSettingsFooter>
      <div className="flex flex-col gap-6">
        {conflict ? (
          <ConflictAlert onReload={reload} />
        ) : (
          (save.isError || reset.isError) && (
            <ErrorAlert
              description={
                serverMessage(save.error ?? reset.error) ??
                t('system-settings.save-error-description')
              }
              title={t('system-settings.save-error-title')}
            />
          )
        )}
        <form
          id={FORM_ID}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (changed) void form.handleSubmit();
          }}
        >
          <SettingsList>
            <form.AppField name="appName">
              {(field) => (
                <field.TextField
                  description={t('system-settings.branding.name-description')}
                  label={t('system-settings.branding.name-label')}
                  layout="row"
                  required
                />
              )}
            </form.AppField>
            <form.AppField name="logo" validators={{ onChange: logoSchema }}>
              {(field) => (
                <field.ImageField
                  accept={LOGO_TYPES.join(',')}
                  canRemove={
                    field.state.value instanceof File ||
                    (field.state.value === undefined && saved.logo !== null)
                  }
                  chooseLabel={t('system-settings.branding.logo-upload')}
                  description={t('system-settings.branding.logo-description')}
                  label={t('system-settings.branding.logo-label')}
                  previewAlt={t('system-settings.branding.logo-preview')}
                  previewUrl={logoUrl}
                  removeLabel={t('system-settings.branding.logo-remove')}
                />
              )}
            </form.AppField>
          </SettingsList>
        </form>
        <BrandingPreview appName={appName} logoUrl={logoUrl} />
        <div>
          <Button
            disabled={busy || resetBrandingSteps(saved).length === 0}
            onClick={() => setResetOpen(true)}
            type="button"
            variant="outline"
          >
            <RotateCcwIcon data-icon="inline-start" />
            {t('system-settings.branding.reset')}
          </Button>
        </div>
      </div>
      <ResetDialog
        confirmLabel={t('system-settings.branding.reset-confirm')}
        description={t('system-settings.branding.reset-description')}
        onConfirm={() => reset.mutate()}
        onOpenChange={setResetOpen}
        open={resetOpen}
        pending={reset.isPending}
        title={t('system-settings.branding.reset-title')}
      />
      <DiscardChangesDialog
        description={t('system-settings.discard-description')}
        {...guard.dialog}
      />
    </>
  );
}
