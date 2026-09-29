import { revalidateLogic, useStore } from '@tanstack/react-form';
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
import { useConfigurationSave } from '@/features/system-settings/components/use-configuration-save';
import {
  isThemeChanged,
  isThemeDefault,
  PRESET_NAMES,
  themeSchema,
  toThemeSettings,
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

  const {
    mutation: save,
    conflict,
    reload,
    blocked,
  } = useConfigurationSave({
    save: ({ theme }: { theme: AppConfigurationDto['theme']; reset?: boolean }) =>
      updateAppConfiguration(saved, { theme }),
    onSaved: (next) => {
      form.reset(toThemeValues(next));
      setResetOpen(false);
    },
    onReloaded: (fresh) => form.reset(toThemeValues(fresh)),
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

  const form = useAppForm({
    defaultValues: toThemeValues(saved),
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: themeSchema },
    onSubmit: ({ value }) =>
      save.mutateAsync({ theme: toThemeSettings(value) }).catch(() => undefined),
  });

  const changed = useStore(form.store, (state) => isThemeChanged(state.values, saved));
  const preset = useStore(form.store, (state) => state.values.preset);
  const guard = useDiscardGuard(changed);

  const reset = () =>
    save
      .mutateAsync({ theme: { preset: null, defaultAppearance: null }, reset: true })
      .catch(() => setResetOpen(false));

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
        canSave={changed && !conflict}
        form={FORM_ID}
        onCancel={() => {
          save.reset();
          form.reset(toThemeValues(saved));
        }}
        pending={save.isPending}
      />
      <div className="flex flex-col gap-6">
        <SaveFeedback conflict={conflict} error={save.error} onReload={reload} />
        <form
          className="flex flex-col gap-6"
          id={FORM_ID}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (changed && !blocked) void form.handleSubmit();
          }}
        >
          <form.AppField name="preset">
            {(field) => (
              <field.RadioGroupField
                columns="fill"
                disabled={save.isPending}
                label={t('system-settings.theme.preset-label')}
                options={presetOptions}
              />
            )}
          </form.AppField>
          <form.AppField name="appearance">
            {(field) => (
              <field.RadioGroupField
                disabled={save.isPending}
                label={t('system-settings.theme.appearance-label')}
                options={appearanceOptions}
              />
            )}
          </form.AppField>
        </form>
        <ThemePreview preset={preset} />
        <div>
          <Button
            disabled={blocked || isThemeDefault(saved)}
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
        pending={save.isPending}
        title={t('system-settings.theme.reset-title')}
      />
      <DiscardChangesDialog
        description={t('system-settings.discard-description')}
        {...guard.dialog}
      />
    </>
  );
}
