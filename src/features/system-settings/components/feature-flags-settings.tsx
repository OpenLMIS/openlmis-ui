import { useStore } from '@tanstack/react-form';
import { InfoIcon, RotateCcwIcon, SearchXIcon } from 'lucide-react';
import { useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { DataTableEmpty } from '@/components/data-table/data-table';
import { DataTableSearch } from '@/components/data-table/data-table-search';
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
  inheritedFlag,
  isFlagsChanged,
  toFlagDraft,
} from '@/features/system-settings/lib/flags';
import type { AppConfigurationDto } from '@/features/system-settings/lib/types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { FEATURE_FLAG_KEYS, FEATURE_FLAGS, type FeatureFlagDefinition } from '@/lib/feature-flags';
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

type FeatureFlagsSettingsProps = {
  saved: AppConfigurationDto;
  search: string;
  onSearchChange: (search: string) => void;
};

export function FeatureFlagsSettings({ saved, search, onSearchChange }: FeatureFlagsSettingsProps) {
  const { t } = useTranslation();
  const deployment = getDeploymentFlags();
  const searchBox = useRef<HTMLDivElement>(null);

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

  const needle = search.trim().toLowerCase();
  const visibleFlags = FEATURE_FLAG_KEYS.filter((flag) => {
    const { labelKey, descriptionKey, usedByKey } = FEATURE_FLAGS[flag];
    return (
      !needle ||
      [flag, t(labelKey), t(descriptionKey), t(usedByKey)].some((text) =>
        text.toLowerCase().includes(needle),
      )
    );
  });

  const clearSearch = () => {
    onSearchChange('');
    searchBox.current?.querySelector('input')?.focus();
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
        <div className="w-full @2xl/main:w-72" ref={searchBox}>
          <DataTableSearch
            label={t('system-settings.flags.search-label')}
            onValueChange={onSearchChange}
            placeholder={t('system-settings.flags.search-placeholder')}
            value={search}
          />
        </div>
        <SaveFeedback {...settings.feedback} />
        <form id={FORM_ID} noValidate onSubmit={settings.submit}>
          {visibleFlags.length === 0 ? (
            <DataTableEmpty
              action={
                <Button onClick={clearSearch} size="sm" type="button" variant="outline">
                  {t('system-settings.flags.clear-filters')}
                </Button>
              }
              description={t('system-settings.flags.no-match-description')}
              icon={<SearchXIcon />}
              title={t('system-settings.flags.no-match-title')}
            />
          ) : (
            <SettingsList>
              {visibleFlags.map((flag) => {
                const definition: FeatureFlagDefinition = FEATURE_FLAGS[flag];
                const label = t(definition.labelKey);
                const inherited = inheritedFlag(flag, deployment);
                const changed = values[flag].overridden;
                const inheritedLabel =
                  definition.type === 'enum'
                    ? t(definition.optionKeys[String(inherited.value)])
                    : t(inherited.value ? 'system-settings.flags.on' : 'system-settings.flags.off');
                return (
                  <form.AppField
                    key={flag}
                    listeners={{
                      onChange: ({ value }) =>
                        form.setFieldValue(`${flag}.overridden`, value !== inherited.value),
                    }}
                    name={`${flag}.value`}
                  >
                    {(field) => {
                      const shared = {
                        action: (
                          <>
                            <FlagAbout definition={definition} label={label} />
                            {changed && (
                              <Button
                                aria-label={t('system-settings.flags.reset-label', { name: label })}
                                disabled={settings.pending}
                                onClick={(event) => {
                                  const row = event.currentTarget.closest('[data-slot="field"]');
                                  field.handleChange(inherited.value);
                                  row
                                    ?.querySelector<HTMLElement>(
                                      '[role="switch"], [data-slot="select-trigger"]',
                                    )
                                    ?.focus();
                                }}
                                size="xs"
                                type="button"
                                variant="destructive"
                              >
                                <RotateCcwIcon data-icon="inline-start" />
                                {t('system-settings.flags.reset')}
                              </Button>
                            )}
                          </>
                        ),
                        description: (
                          <>
                            <code className="font-mono text-xs" dir="ltr">
                              {flag}
                            </code>
                            {!changed &&
                              inherited.source === 'deployment' &&
                              ` · ${t('system-settings.flags.from-deployment')}`}
                            {changed && (
                              <span className="block text-primary">
                                <Trans
                                  components={{ value: <span className="font-semibold" /> }}
                                  i18nKey={
                                    inherited.source === 'deployment'
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
                        disabled: settings.pending,
                        label,
                        layout: 'row' as const,
                      };
                      return (
                        <div className="relative">
                          {changed && (
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
          )}
        </form>
      </div>
      <DiscardChangesDialog
        description={t('system-settings.discard-description')}
        {...guard.dialog}
      />
    </>
  );
}
