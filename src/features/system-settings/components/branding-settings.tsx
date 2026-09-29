import { revalidateLogic, useStore } from '@tanstack/react-form';
import { RotateCcwIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { useAppForm } from '@/components/form/form';
import { SettingsList } from '@/components/form/settings-list';
import { Button } from '@/components/ui/button';
import { saveBranding } from '@/features/system-settings/api/api';
import { BrandingPreview } from '@/features/system-settings/components/branding-preview';
import { ResetDialog } from '@/features/system-settings/components/reset-dialog';
import {
  SaveFeedback,
  SettingsSaveFooter,
} from '@/features/system-settings/components/save-feedback';
import { useConfigurationSave } from '@/features/system-settings/components/use-configuration-save';
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
import { DEFAULT_LOGO_URL, getLogoUrl } from '@/lib/app-configuration';

const FORM_ID = 'branding-form';

function useLogoPreviewUrl(logo: File | null | undefined, saved: AppConfigurationDto) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!(logo instanceof File)) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(logo);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);
  if (logo instanceof File) return objectUrl ?? DEFAULT_LOGO_URL;
  return logo === null ? DEFAULT_LOGO_URL : getLogoUrl(saved);
}

export function BrandingSettings({ saved }: { saved: AppConfigurationDto }) {
  const { t } = useTranslation();
  const [resetOpen, setResetOpen] = useState(false);

  const {
    mutation: save,
    conflict,
    reload,
    blocked,
  } = useConfigurationSave({
    save: ({ steps }: { steps: BrandingStep[]; reset?: boolean }) => saveBranding(saved, steps),
    onSaved: (next) => {
      form.reset(toBrandingValues(next));
      setResetOpen(false);
    },
    onReloaded: (fresh) => form.reset(toBrandingValues(fresh)),
    toast: ({ reset }) =>
      reset
        ? {
            title: t('system-settings.branding.reset-done-title'),
            description: t('system-settings.branding.reset-done-description'),
          }
        : {
            title: t('system-settings.branding.saved-title'),
            description: t('system-settings.branding.saved-description'),
          },
  });

  const form = useAppForm({
    defaultValues: toBrandingValues(saved),
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: brandingSchema },
    onSubmit: ({ value }) =>
      save.mutateAsync({ steps: brandingSteps(value, saved) }).catch(() => undefined),
  });

  const changed = useStore(form.store, (state) => brandingSteps(state.values, saved).length > 0);
  const appName = useStore(form.store, (state) => state.values.appName);
  const logo = useStore(form.store, (state) => state.values.logo);
  const logoUrl = useLogoPreviewUrl(logo, saved);
  const guard = useDiscardGuard(changed);

  const reset = () =>
    save
      .mutateAsync({ steps: resetBrandingSteps(saved), reset: true })
      .catch(() => setResetOpen(false));

  return (
    <>
      <SettingsSaveFooter
        canSave={changed && !conflict}
        form={FORM_ID}
        onCancel={() => {
          save.reset();
          form.reset(toBrandingValues(saved));
        }}
        pending={save.isPending}
      />
      <div className="flex flex-col gap-6">
        <SaveFeedback conflict={conflict} error={save.error} onReload={reload} />
        <form
          id={FORM_ID}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (changed && !blocked) void form.handleSubmit();
          }}
        >
          <SettingsList>
            <form.AppField name="appName">
              {(field) => (
                <field.TextField
                  description={t('system-settings.branding.name-description')}
                  disabled={save.isPending}
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
                  disabled={save.isPending}
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
            disabled={blocked || resetBrandingSteps(saved).length === 0}
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
        onConfirm={reset}
        onOpenChange={setResetOpen}
        open={resetOpen}
        pending={save.isPending}
        title={t('system-settings.branding.reset-title')}
      />
      <DiscardChangesDialog
        description={t('system-settings.discard-description')}
        {...guard.dialog}
      />
    </>
  );
}
