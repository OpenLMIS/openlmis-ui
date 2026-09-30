import { useStore } from '@tanstack/react-form';
import { InfoIcon, RotateCcwIcon } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { useAppForm } from '@/components/form/form';
import { SettingsList } from '@/components/form/settings-list';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
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
} from '@/lib/feature-flags';
import { getDeploymentFlags } from '@/lib/runtime-config';

const FORM_ID = 'feature-flags-form';

type FlagAboutProps = { label: string; definition: FeatureFlagDefinition };

function FlagAbout({ label, definition }: FlagAboutProps) {
  const { t } = useTranslation();
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-label={t('system-settings.flags.about-label', { name: label })}
            size="icon-xs"
            type="button"
            variant="ghost"
          />
        }
      >
        <InfoIcon />
      </PopoverTrigger>
      <PopoverContent align="start">
        <PopoverHeader>
          <PopoverTitle>{label}</PopoverTitle>
          <PopoverDescription>{t(definition.descriptionKey)}</PopoverDescription>
        </PopoverHeader>
        <p className="text-sm">
          {t('system-settings.flags.used-by', { screen: t(definition.usedByKey) })}
        </p>
      </PopoverContent>
    </Popover>
  );
}

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
                    const inherited = inheritedFlagValue(flag, deployment);
                    const inheritedLabel =
                      typeof inherited === 'boolean'
                        ? t(inherited ? 'system-settings.flags.on' : 'system-settings.flags.off')
                        : definition.type === 'enum'
                          ? t(definition.optionKeys[inherited])
                          : inherited;
                    const inheritedFrom = flagSource(
                      flag,
                      { ...values[flag], overridden: false },
                      deployment,
                    );
                    const shared = {
                      hint: <FlagAbout definition={definition} label={label} />,
                      description: (
                        <>
                          <code className="font-mono text-xs" dir="ltr">
                            {flag}
                          </code>
                          {source === 'deployment' &&
                            ` · ${t('system-settings.flags.from-deployment')}`}
                          {source === 'admin' && (
                            <span className="block text-primary">
                              <Trans
                                components={{ value: <span className="font-semibold" /> }}
                                i18nKey={
                                  inheritedFrom === 'deployment'
                                    ? 'system-settings.flags.changed-deployment'
                                    : 'system-settings.flags.changed-default'
                                }
                                t={t}
                                values={{ value: inheritedLabel }}
                              />
                            </span>
                          )}
                        </>
                      ),
                      action: source === 'admin' && (
                        <Button
                          aria-label={t('system-settings.flags.reset-label', { name: label })}
                          disabled={settings.pending}
                          onClick={(event) =>
                            resetFlag(flag, event.currentTarget.closest('[data-slot="field"]'))
                          }
                          size="xs"
                          type="button"
                          variant="destructive"
                        >
                          <RotateCcwIcon data-icon="inline-start" />
                          {t('system-settings.flags.reset')}
                        </Button>
                      ),
                      disabled: settings.pending,
                      label,
                      layout: 'row' as const,
                    };
                    return (
                      <div className="relative">
                        {source === 'admin' && (
                          <span
                            aria-hidden
                            className="absolute inset-y-3 start-0 w-0.5 rounded-full bg-primary"
                          />
                        )}
                        {definition.type === 'boolean' ? (
                          <field.SwitchField {...shared} />
                        ) : (
                          <field.SelectField
                            {...shared}
                            items={definition.options.map((option) => ({
                              value: option,
                              label: t(definition.optionKeys[option]),
                            }))}
                          />
                        )}
                      </div>
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
