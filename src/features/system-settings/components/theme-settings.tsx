import { useStore } from '@tanstack/react-form';
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { useAppForm } from '@/components/form/form';
import { updateAppConfiguration } from '@/features/system-settings/api/api';
import {
  SaveFeedback,
  SettingsSaveFooter,
} from '@/features/system-settings/components/save-feedback';
import { SettingsReset } from '@/features/system-settings/components/settings-reset';
import { ThemePreview, ThemeSwatch } from '@/features/system-settings/components/theme-preview';
import { useConfigurationSave } from '@/features/system-settings/hooks/use-configuration-save';
import {
  isThemeChanged,
  isThemeDefault,
  PRESET_NAMES,
  toThemeValues,
} from '@/features/system-settings/lib/theme';
import type { AppConfigurationDto } from '@/features/system-settings/lib/types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { APPEARANCES } from '@/lib/app-configuration';

const FORM_ID = 'theme-form';

const APPEARANCE_ICONS = { light: SunIcon, dark: MoonIcon, system: MonitorIcon } as const;

export function ThemeSettings({ saved }: { saved: AppConfigurationDto }) {
  const { t } = useTranslation();

  const form = useAppForm({
    defaultValues: toThemeValues(saved),
    onSubmit: ({ value }) => settings.run({ theme: value }),
  });
  const values = useStore(form.store, (state) => state.values);

  const settings = useConfigurationSave({
    saved,
    form,
    formId: FORM_ID,
    values,
    toValues: toThemeValues,
    isChanged: isThemeChanged,
    save: (base, { theme }: { theme: AppConfigurationDto['theme']; reset?: boolean }) =>
      updateAppConfiguration(base, { theme }),
    toast: ({ reset }) =>
      reset
        ? {
            title: t('system-settings.theme.reset-done-title'),
            description: t('system-settings.theme.reset-done-description'),
          }
        : {
            title: t('system-settings.theme.saved-title'),
            description: t('system-settings.theme.saved-description'),
          },
  });
  const guard = useDiscardGuard(settings.changed);

  const presetOptions = PRESET_NAMES.map((name) => ({
    value: name,
    label: t(`system-settings.theme.preset.${name}`),
    media: <ThemeSwatch preset={name} />,
  }));
  const appearanceOptions = APPEARANCES.map((appearance) => {
    const Icon = APPEARANCE_ICONS[appearance];
    return {
      value: appearance,
      label: t(`system-settings.theme.appearance.${appearance}`),
      description: t(`system-settings.theme.appearance.${appearance}-description`),
      media: (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon aria-hidden className="size-4" />
        </span>
      ),
    };
  });

  return (
    <>
      <SettingsReset
        confirmLabel={t('system-settings.theme.reset-confirm')}
        description={t('system-settings.theme.reset-description')}
        disabled={settings.blocked || isThemeDefault(settings.base)}
        label={t('system-settings.theme.reset')}
        onConfirm={() =>
          settings.run({ theme: { preset: null, defaultAppearance: null }, reset: true })
        }
        pending={settings.pending}
        title={t('system-settings.theme.reset-title')}
      />
      <SettingsSaveFooter
        canSave={settings.canSave}
        form={FORM_ID}
        onCancel={settings.cancel}
        pending={settings.pending}
      />
      <div className="flex flex-col gap-6">
        <SaveFeedback {...settings.feedback} />
        <form className="flex flex-col gap-6" id={FORM_ID} noValidate onSubmit={settings.submit}>
          <form.AppField name="preset">
            {(field) => (
              <field.RadioGroupField
                disabled={settings.pending}
                label={t('system-settings.theme.preset-label')}
                options={presetOptions}
                variant="tile"
              />
            )}
          </form.AppField>
          <form.AppField name="defaultAppearance">
            {(field) => (
              <field.RadioGroupField
                columns="row"
                disabled={settings.pending}
                label={t('system-settings.theme.appearance-label')}
                options={appearanceOptions}
              />
            )}
          </form.AppField>
        </form>
        <ThemePreview preset={values.preset} />
      </div>
      <DiscardChangesDialog
        description={t('system-settings.discard-description')}
        {...guard.dialog}
      />
    </>
  );
}
