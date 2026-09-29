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
import { useConfigurationSave } from '@/features/system-settings/hooks/use-configuration-save';
import {
  buildFlagOverrides,
  type FlagDraft,
  flagSource,
  inheritedFlagValue,
  isFlagsChanged,
  toFlagDraft,
} from '@/features/system-settings/lib/flags';
import type { AppConfigurationDto } from '@/features/system-settings/lib/types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import {
  FEATURE_FLAG_KEYS,
  FEATURE_FLAGS,
  type FeatureFlagDefinition,
  type FeatureFlagKey,
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

  const form = useAppForm({
    defaultValues: toFlagDraft(saved.featureFlags, deployment),
    onSubmit: ({ value }) => settings.run(value),
  });
  const values = useStore(form.store, (state) => state.values);

  const settings = useConfigurationSave({
    saved,
    form,
    formId: FORM_ID,
    values,
    toValues: (configuration) => toFlagDraft(configuration.featureFlags, deployment),
    isChanged: (draft, base) => isFlagsChanged(draft, base.featureFlags, deployment),
    save: (base, draft: FlagDraft) =>
      updateAppConfiguration(base, { featureFlags: buildFlagOverrides(draft, base.featureFlags) }),
    toast: () => ({
      title: t('system-settings.flags.saved-title'),
      description: t('system-settings.flags.saved-description'),
    }),
  });
  const guard = useDiscardGuard(settings.changed);

  const resetFlag = (flag: FeatureFlagKey, row: Element | null) => {
    form.setFieldValue(`${flag}.value`, inheritedFlagValue(flag, deployment));
    form.setFieldValue(`${flag}.overridden`, false);
    row?.querySelector<HTMLElement>('[role="switch"], [data-slot="select-trigger"]')?.focus();
  };

  return (
    <>
      <SettingsSaveFooter
        canSave={settings.canSave}
        form={FORM_ID}
        onCancel={settings.cancel}
        pending={settings.pending}
      />
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">{t('system-settings.flags.description')}</p>
        <SaveFeedback {...settings.feedback} />
        <form id={FORM_ID} noValidate onSubmit={settings.submit}>
          <SettingsList>
            {FEATURE_FLAG_KEYS.map((flag) => {
              const definition: FeatureFlagDefinition = FEATURE_FLAGS[flag];
              const label = t(definition.labelKey);
              return (
                <form.AppField
                  key={flag}
                  listeners={{
                    onChange: ({ value }) =>
                      form.setFieldValue(
                        `${flag}.overridden`,
                        value !== inheritedFlagValue(flag, deployment),
                      ),
                  }}
                  name={`${flag}.value`}
                >
                  {(field) => {
                    const source = flagSource(flag, values[flag], deployment);
                    const shared = {
                      badge: (
                        <Badge variant={source === 'admin' ? 'info' : 'secondary'}>
                          {t(SOURCE_LABELS[source])}
                        </Badge>
                      ),
                      action: source === 'admin' && (
                        <Button
                          aria-label={t('system-settings.flags.reset-label', { name: label })}
                          disabled={settings.pending}
                          onClick={(event) =>
                            resetFlag(flag, event.currentTarget.closest('[data-slot="field"]'))
                          }
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
                      disabled: settings.pending,
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
                          label: t(definition.optionKeys[option]),
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
