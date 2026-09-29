import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2Icon, RotateCcwIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorAlert, serverMessage } from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { useAppForm } from '@/components/form/form';
import { Button } from '@/components/ui/button';
import { updateAppConfiguration } from '@/features/system-settings/api/api';
import { appConfigurationOptions } from '@/features/system-settings/api/queries';
import { ConflictAlert } from '@/features/system-settings/components/conflict-alert';
import { ResetDialog } from '@/features/system-settings/components/reset-dialog';
import { SystemSettingsFooter } from '@/features/system-settings/components/system-settings-workspace';
import { ThemePreview, ThemeSwatch } from '@/features/system-settings/components/theme-preview';
import {
  APPEARANCES,
  isThemeChanged,
  isThemeDefault,
  PRESET_NAMES,
  type ThemeValues,
  themeSchema,
  toThemeSettings,
  toThemeValues,
} from '@/features/system-settings/lib/theme';
import type { AppConfigurationDto } from '@/features/system-settings/lib/types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { rememberAppConfiguration } from '@/lib/app-configuration';
import { isConflict } from '@/lib/http';

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
  const queryClient = useQueryClient();
  const [conflict, setConflict] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const store = (next: AppConfigurationDto) => {
    queryClient.setQueryData(appConfigurationOptions().queryKey, next);
    rememberAppConfiguration(next);
    form.reset(toThemeValues(next));
  };
  const onError = (error: Error) => {
    if (isConflict(error)) setConflict(true);
    void queryClient.invalidateQueries({ queryKey: appConfigurationOptions().queryKey });
  };

  const save = useMutation({
    mutationFn: (values: ThemeValues) =>
      updateAppConfiguration(saved, { theme: toThemeSettings(values) }),
    onSuccess: (next) => {
      store(next);
      toast.success(t('system-settings.theme.saved-title'), {
        description: t('system-settings.theme.saved-description'),
      });
    },
    onError,
  });

  const reset = useMutation({
    mutationFn: () =>
      updateAppConfiguration(saved, { theme: { preset: null, defaultAppearance: null } }),
    onSuccess: (next) => {
      store(next);
      setResetOpen(false);
      toast.success(t('system-settings.theme.reset-done-title'), {
        description: t('system-settings.theme.reset-done-description'),
      });
    },
    onError: (error) => {
      setResetOpen(false);
      onError(error);
    },
  });

  const form = useAppForm({
    defaultValues: toThemeValues(saved),
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: themeSchema },
    onSubmit: ({ value }) => save.mutateAsync(value).catch(() => undefined),
  });

  const changed = useStore(form.store, (state) => isThemeChanged(state.values, saved));
  const preset = useStore(form.store, (state) => state.values.preset);
  const guard = useDiscardGuard(changed);
  const busy = save.isPending || reset.isPending;

  const reload = async () => {
    const fresh = await queryClient.fetchQuery({ ...appConfigurationOptions(), staleTime: 0 });
    setConflict(false);
    save.reset();
    if (fresh) form.reset(toThemeValues(fresh));
  };

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
      <SystemSettingsFooter>
        <Button
          disabled={!changed || busy}
          onClick={() => {
            save.reset();
            form.reset(toThemeValues(saved));
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
          className="flex flex-col gap-6"
          id={FORM_ID}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (changed) void form.handleSubmit();
          }}
        >
          <form.AppField name="preset">
            {(field) => (
              <field.RadioGroupField
                columns="fill"
                label={t('system-settings.theme.preset-label')}
                options={presetOptions}
              />
            )}
          </form.AppField>
          <form.AppField name="appearance">
            {(field) => (
              <field.RadioGroupField
                label={t('system-settings.theme.appearance-label')}
                options={appearanceOptions}
              />
            )}
          </form.AppField>
        </form>
        <ThemePreview preset={preset} />
        <div>
          <Button
            disabled={busy || isThemeDefault(saved)}
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
        onConfirm={() => reset.mutate()}
        onOpenChange={setResetOpen}
        open={resetOpen}
        pending={reset.isPending}
        title={t('system-settings.theme.reset-title')}
      />
      <DiscardChangesDialog
        description={t('system-settings.discard-description')}
        {...guard.dialog}
      />
    </>
  );
}
