import { useStore } from '@tanstack/react-form';
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { useAppForm } from '@/components/form/form';
import { updateAppConfiguration } from '@/features/system-settings/api/api';
import { ResetAction, ResetDialog } from '@/features/system-settings/components/reset-dialog';
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
  sapphire: 'system-settings.theme.preset.sapphire',
  indigo: 'system-settings.theme.preset.indigo',
  purple: 'system-settings.theme.preset.purple',
  fuchsia: 'system-settings.theme.preset.fuchsia',
  pink: 'system-settings.theme.preset.pink',
  rose: 'system-settings.theme.preset.rose',
  red: 'system-settings.theme.preset.red',
  orange: 'system-settings.theme.preset.orange',
  amber: 'system-settings.theme.preset.amber',
  olive: 'system-settings.theme.preset.olive',
  green: 'system-settings.theme.preset.green',
  emerald: 'system-settings.theme.preset.emerald',
  teal: 'system-settings.theme.preset.teal',
  cyan: 'system-settings.theme.preset.cyan',
  brown: 'system-settings.theme.preset.brown',
  slate: 'system-settings.theme.preset.slate',
  graphite: 'system-settings.theme.preset.graphite',
} as const;

const APPEARANCE_OPTIONS = {
  light: {
    label: 'system-settings.theme.appearance.light',
    description: 'system-settings.theme.appearance.light-description',
    icon: SunIcon,
  },
  dark: {
    label: 'system-settings.theme.appearance.dark',
    description: 'system-settings.theme.appearance.dark-description',
    icon: MoonIcon,
  },
  system: {
    label: 'system-settings.theme.appearance.system',
    description: 'system-settings.theme.appearance.system-description',
    icon: MonitorIcon,
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
  const appearanceOptions = APPEARANCES.map((appearance) => {
    const { label, description, icon: Icon } = APPEARANCE_OPTIONS[appearance];
    return {
      value: appearance,
      label: t(label),
      description: t(description),
      media: (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon aria-hidden className="size-4" />
        </span>
      ),
    };
  });

  return (
    <>
      <ResetAction
        disabled={settings.blocked || isThemeDefault(settings.base)}
        label={t('system-settings.theme.reset')}
        onClick={() => setResetOpen(true)}
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
                columns="tiles"
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
