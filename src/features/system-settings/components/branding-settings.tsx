import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { useAppForm } from '@/components/form/form';
import { SettingsList } from '@/components/form/settings-list';
import { saveBranding } from '@/features/system-settings/api/api';
import { BrandingPreview } from '@/features/system-settings/components/branding-preview';
import {
  SaveFeedback,
  SettingsSaveFooter,
} from '@/features/system-settings/components/save-feedback';
import { SettingsReset } from '@/features/system-settings/components/settings-reset';
import { useConfigurationSave } from '@/features/system-settings/hooks/use-configuration-save';
import {
  type BrandingStep,
  brandingSchema,
  brandingSteps,
  isBrandingDefault,
  LOGO_TYPES,
  logoSchema,
  MAX_APP_NAME_LENGTH,
  resetBrandingSteps,
  toBrandingValues,
} from '@/features/system-settings/lib/branding';
import type { AppConfigurationDto } from '@/features/system-settings/lib/types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { DEFAULT_LOGO_URL, getLogoUrl } from '@/lib/app-configuration';
import { appConfig } from '@/lib/config';

const FORM_ID = 'branding-form';

function useLogoPreviewUrl(logo: File | null | undefined, saved: AppConfigurationDto) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const file = logo instanceof File && logoSchema.safeParse(logo).success ? logo : null;
  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (file) return objectUrl ?? DEFAULT_LOGO_URL;
  return logo === null ? DEFAULT_LOGO_URL : getLogoUrl(saved);
}

export function BrandingSettings({ saved }: { saved: AppConfigurationDto }) {
  const { t } = useTranslation();

  const form = useAppForm({
    defaultValues: toBrandingValues(saved),
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: brandingSchema(saved) },
    onSubmit: ({ value }) => settings.run({ steps: brandingSteps(value, settings.base) }),
    onSubmitInvalid: () =>
      document.querySelector<HTMLElement>(`#${FORM_ID} [aria-invalid="true"]`)?.focus(),
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
    onPartiallySaved: ({ steps }) => {
      if (steps[0]?.kind === 'upload') form.setFieldValue('logo', undefined);
    },
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

  return (
    <>
      <SettingsReset
        confirmLabel={t('system-settings.branding.reset-confirm')}
        description={t('system-settings.branding.reset-description')}
        disabled={settings.blocked || isBrandingDefault(settings.base)}
        label={t('system-settings.branding.reset')}
        onConfirm={() => settings.run({ steps: resetBrandingSteps(settings.base), reset: true })}
        pending={settings.pending}
        title={t('system-settings.branding.reset-title')}
      />
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
                  maxLength={MAX_APP_NAME_LENGTH}
                  placeholder={appConfig.BRAND}
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
            <form.AppField name="showAppName">
              {(field) => (
                <field.SwitchField
                  description={t('system-settings.branding.show-name-description')}
                  disabled={settings.pending}
                  label={t('system-settings.branding.show-name-label')}
                  layout="row"
                />
              )}
            </form.AppField>
          </SettingsList>
        </form>
        <BrandingPreview
          appName={values.appName}
          logoUrl={logoUrl}
          showAppName={values.showAppName}
        />
      </div>
      <DiscardChangesDialog
        description={t('system-settings.discard-description')}
        {...guard.dialog}
      />
    </>
  );
}
