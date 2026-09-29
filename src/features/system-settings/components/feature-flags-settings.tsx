import { useStore } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { useAppForm } from '@/components/form/form';
import { SettingsList } from '@/components/form/settings-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { updateAppConfiguration } from '@/features/system-settings/api/api';
import {
  SaveFeedback,
  SettingsSaveFooter,
} from '@/features/system-settings/components/save-feedback';
import { useConfigurationSave } from '@/features/system-settings/components/use-configuration-save';
import {
  buildFlagOverrides,
  type FlagValues,
  flagSource,
  inheritedFlagValue,
  isFlagsChanged,
  toFlagValues,
} from '@/features/system-settings/lib/flags';
import type { AppConfigurationDto } from '@/features/system-settings/lib/types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import {
  FEATURE_FLAG_KEYS,
  FEATURE_FLAGS,
  type FeatureFlagDefinition,
  type FeatureFlagSource,
} from '@/lib/feature-flags';
import { getDeploymentFlags } from '@/lib/runtime-config';

const FORM_ID = 'feature-flags-form';

const SOURCE_LABELS = {
  admin: 'system-settings.flags.source.admin',
  deployment: 'system-settings.flags.source.deployment',
  default: 'system-settings.flags.source.default',
} as const satisfies Record<FeatureFlagSource, string>;

export function FeatureFlagsSettings({ saved }: { saved: AppConfigurationDto }) {
  const { t } = useTranslation();
  const deployment = getDeploymentFlags();

  const {
    mutation: save,
    conflict,
    reload,
    blocked,
  } = useConfigurationSave({
    save: (values: FlagValues) =>
      updateAppConfiguration(saved, {
        featureFlags: buildFlagOverrides(values, saved.featureFlags, deployment),
      }),
    onSaved: (next) => form.reset(toFlagValues(next.featureFlags, deployment)),
    onReloaded: (fresh) => form.reset(toFlagValues(fresh.featureFlags, deployment)),
    toast: () => ({
      title: t('system-settings.flags.saved-title'),
      description: t('system-settings.flags.saved-description'),
    }),
  });

  const form = useAppForm({
    defaultValues: toFlagValues(saved.featureFlags, deployment),
    onSubmit: ({ value }) => save.mutateAsync(value).catch(() => undefined),
  });

  const changed = useStore(form.store, (state) =>
    isFlagsChanged(state.values, saved.featureFlags, deployment),
  );
  const guard = useDiscardGuard(changed);

  return (
    <>
      <SettingsSaveFooter
        canSave={changed && !conflict}
        form={FORM_ID}
        onCancel={() => {
          save.reset();
          form.reset(toFlagValues(saved.featureFlags, deployment));
        }}
        pending={save.isPending}
      />
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">{t('system-settings.flags.description')}</p>
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
            {FEATURE_FLAG_KEYS.map((flag) => {
              const definition: FeatureFlagDefinition = FEATURE_FLAGS[flag];
              const label = t(definition.labelKey);
              return (
                <form.AppField key={flag} name={flag}>
                  {(field) => {
                    const source = flagSource(flag, field.state.value, deployment);
                    const shared = {
                      badge: (
                        <Badge variant={source === 'admin' ? 'info' : 'secondary'}>
                          {t(SOURCE_LABELS[source])}
                        </Badge>
                      ),
                      action: source === 'admin' && (
                        <Button
                          aria-label={t('system-settings.flags.reset-label', { name: label })}
                          disabled={save.isPending}
                          onClick={() => field.handleChange(inheritedFlagValue(flag, deployment))}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          {t('system-settings.flags.reset')}
                        </Button>
                      ),
                      description: (
                        <>
                          {t(definition.descriptionKey)}{' '}
                          {t('system-settings.flags.used-by', { screen: t(definition.usedByKey) })}
                          {!definition.inNewUi && ` ${t('system-settings.flags.not-in-new-ui')}`}
                          <span className="block">
                            <code className="font-mono text-xs" dir="ltr">
                              {flag}
                            </code>
                          </span>
                        </>
                      ),
                      disabled: save.isPending,
                      label,
                      layout: 'row' as const,
                    };
                    return definition.type === 'boolean' ? (
                      <field.SwitchField {...shared} />
                    ) : (
                      <field.SelectField
                        {...shared}
                        items={definition.options.map((option) => ({
                          value: option,
                          label: definition.optionKeys[option]
                            ? t(definition.optionKeys[option])
                            : option,
                        }))}
                      />
                    );
                  }}
                </form.AppField>
              );
            })}
          </SettingsList>
        </form>
      </div>
      <DiscardChangesDialog
        description={t('system-settings.discard-description')}
        {...guard.dialog}
      />
    </>
  );
}
