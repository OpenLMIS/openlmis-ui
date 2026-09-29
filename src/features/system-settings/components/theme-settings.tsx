import { useStore } from '@tanstack/react-form';
import { RotateCcwIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { useAppForm } from '@/components/form/form';
import { Button } from '@/components/ui/button';
import { updateAppConfiguration } from '@/features/system-settings/api/api';
import { ResetDialog } from '@/features/system-settings/components/reset-dialog';
import {
  SaveFeedback,
  SettingsSaveFooter,
} from '@/features/system-settings/components/save-feedback';
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

const PRESET_LABELS = {
  blue: 'system-settings.theme.preset.blue',
  teal: 'system-settings.theme.preset.teal',
  green: 'system-settings.theme.preset.green',
  indigo: 'system-settings.theme.preset.indigo',
  purple: 'system-settings.theme.preset.purple',
  slate: 'system-settings.theme.preset.slate',
} as const;

const APPEARANCE_LABELS = {
  light: {
    label: 'system-settings.theme.appearance.light',
    description: 'system-settings.theme.appearance.light-description',
  },
  dark: {
    label: 'system-settings.theme.appearance.dark',
    description: 'system-settings.theme.appearance.dark-description',
  },
  system: {
    label: 'system-settings.theme.appearance.system',
    description: 'system-settings.theme.appearance.system-description',
  },
} as const;

export function ThemeSettings({ saved }: { saved: AppConfigurationDto }) {
  const { t } = useTranslation();
  const [resetOpen, setResetOpen] = useState(false);

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

  const reset = () =>
    settings
      .run({ theme: { preset: null, defaultAppearance: null }, reset: true })
      .finally(() => setResetOpen(false));

  const presetOptions = PRESET_NAMES.map((name) => ({
    value: name,
    label: t(PRESET_LABELS[name]),
    media: <ThemeSwatch preset={name} />,
  }));
  const appearanceOptions = APPEARANCES.map((appearance) => ({
    value: appearance,
    label: t(APPEARANCE_LABELS[appearance].label),
    description: t(APPEARANCE_LABELS[appearance].description),
  }));

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
        <form className="flex flex-col gap-6" id={FORM_ID} noValidate onSubmit={settings.submit}>
          <form.AppField name="preset">
            {(field) => (
              <field.RadioGroupField
                columns="fill"
                disabled={settings.pending}
                label={t('system-settings.theme.preset-label')}
                options={presetOptions}
              />
            )}
          </form.AppField>
          <form.AppField name="defaultAppearance">
            {(field) => (
              <field.RadioGroupField
                disabled={settings.pending}
                label={t('system-settings.theme.appearance-label')}
                options={appearanceOptions}
              />
            )}
          </form.AppField>
        </form>
        <ThemePreview preset={values.preset} />
        <div>
          <Button
            disabled={settings.blocked || isThemeDefault(settings.base)}
            focusableWhenDisabled
            onClick={() => setResetOpen(true)}
            type="button"
            variant="outline"
          >
            <RotateCcwIcon data-icon="inline-start" />
            {t('system-settings.theme.reset')}
          </Button>
        </div>
      </div>
      <ResetDialog
        confirmLabel={t('system-settings.theme.reset-confirm')}
        description={t('system-settings.theme.reset-description')}
        onConfirm={reset}
        onOpenChange={setResetOpen}
        open={resetOpen}
        pending={settings.pending}
        title={t('system-settings.theme.reset-title')}
      />
      <DiscardChangesDialog
        description={t('system-settings.discard-description')}
        {...guard.dialog}
      />
    </>
  );
}
