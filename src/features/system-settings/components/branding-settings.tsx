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
import { useConfigurationSave } from '@/features/system-settings/hooks/use-configuration-save';
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

  const form = useAppForm({
    defaultValues: toBrandingValues(saved),
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: brandingSchema },
    onSubmit: ({ value }) => settings.run({ steps: brandingSteps(value, settings.base) }),
  });
  const values = useStore(form.store, (state) => state.values);

  const settings = useConfigurationSave({
    saved,
    form,
    formId: FORM_ID,
    values,
    toValues: toBrandingValues,
    isChanged: (draft, base) => brandingSteps(draft, base).length > 0,
    save: (base, { steps }: { steps: BrandingStep[]; reset?: boolean }) =>
      saveBranding(base, steps),
    onPartiallySaved: () => form.setFieldValue('logo', undefined),
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
  const logoUrl = useLogoPreviewUrl(values.logo, settings.base);
  const guard = useDiscardGuard(settings.changed);

  const reset = () =>
    settings
      .run({ steps: resetBrandingSteps(settings.base), reset: true })
      .finally(() => setResetOpen(false));

  return (
    <>
      <SettingsSaveFooter
        canSave={settings.canSave}
        form={FORM_ID}
        onCancel={settings.cancel}
        pending={settings.pending}
      />
      <div className="flex flex-col gap-6">
        <SaveFeedback {...settings.feedback} />
        <form id={FORM_ID} noValidate onSubmit={settings.submit}>
          <SettingsList>
            <form.AppField name="appName">
              {(field) => (
                <field.TextField
                  description={t('system-settings.branding.name-description')}
                  disabled={settings.pending}
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
                    (field.state.value === undefined && settings.base.logo !== null)
                  }
                  chooseLabel={t('system-settings.branding.logo-upload')}
                  description={t('system-settings.branding.logo-description')}
                  disabled={settings.pending}
                  label={t('system-settings.branding.logo-label')}
                  previewAlt={t('system-settings.branding.logo-preview')}
                  previewUrl={logoUrl}
                  removeLabel={t('system-settings.branding.logo-remove')}
                />
              )}
            </form.AppField>
          </SettingsList>
        </form>
        <BrandingPreview appName={values.appName} logoUrl={logoUrl} />
        <div>
          <Button
            disabled={settings.blocked || resetBrandingSteps(settings.base).length === 0}
            focusableWhenDisabled
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
        pending={settings.pending}
        title={t('system-settings.branding.reset-title')}
      />
      <DiscardChangesDialog
        description={t('system-settings.discard-description')}
        {...guard.dialog}
      />
    </>
  );
}
