import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorAlert, serverMessage } from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { SettingsList, SettingsRowFrame } from '@/components/form/settings-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { updateAppConfiguration } from '@/features/system-settings/api/api';
import { appConfigurationOptions } from '@/features/system-settings/api/queries';
import { ConflictAlert } from '@/features/system-settings/components/conflict-alert';
import { SystemSettingsFooter } from '@/features/system-settings/components/system-settings-workspace';
import {
  buildFlagOverrides,
  type FlagDraft,
  isFlagsChanged,
  toFlagDraft,
} from '@/features/system-settings/lib/flags';
import type { AppConfigurationDto } from '@/features/system-settings/lib/types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { rememberAppConfiguration } from '@/lib/app-configuration';
import {
  FEATURE_FLAG_KEYS,
  FEATURE_FLAGS,
  type FeatureFlagKey,
  type FeatureFlagSource,
  resolveFlag,
} from '@/lib/feature-flags';
import { isConflict } from '@/lib/http';
import { getDeploymentFlags } from '@/lib/runtime-config';

const SOURCE_LABELS = {
  admin: 'system-settings.flags.source.admin',
  deployment: 'system-settings.flags.source.deployment',
  default: 'system-settings.flags.source.default',
} as const satisfies Record<FeatureFlagSource, string>;

type FlagRowProps = {
  flag: FeatureFlagKey;
  draft: FlagDraft;
  disabled: boolean;
  onChange: (flag: FeatureFlagKey, value: boolean | string | undefined) => void;
};

function FlagRow({ flag, draft, disabled, onChange }: FlagRowProps) {
  const { t } = useTranslation();
  const definition = FEATURE_FLAGS[flag];
  const { value, source } = resolveFlag(flag, draft, getDeploymentFlags());
  const id = `flag-${flag}`;
  const descriptionId = `${id}-description`;

  return (
    <SettingsRowFrame
      badge={
        <Badge variant={source === 'admin' ? 'info' : 'secondary'}>
          {t(SOURCE_LABELS[source])}
        </Badge>
      }
      description={
        <div className="flex flex-col gap-1 text-muted-foreground text-sm" id={descriptionId}>
          <p>{t(definition.descriptionKey)}</p>
          <p>{t('system-settings.flags.used-by', { screen: t(definition.usedByKey) })}</p>
          {!definition.inNewUi && <p>{t('system-settings.flags.not-in-new-ui')}</p>}
          <code className="font-mono text-xs" dir="ltr">
            {flag}
          </code>
        </div>
      }
      label={
        <label className="text-sm" htmlFor={id}>
          {t(definition.labelKey)}
        </label>
      }
      value="fit"
    >
      <div className="flex items-center gap-2">
        {source === 'admin' && (
          <Button
            disabled={disabled}
            onClick={() => onChange(flag, undefined)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t('system-settings.flags.reset')}
          </Button>
        )}
        {definition.type === 'boolean' ? (
          <Switch
            aria-describedby={descriptionId}
            checked={value === true}
            disabled={disabled}
            id={id}
            onCheckedChange={(checked) => onChange(flag, checked)}
          />
        ) : (
          <Select
            disabled={disabled}
            items={definition.options.map((option) => ({
              value: option,
              label: t(definition.optionKeys[option as keyof typeof definition.optionKeys]),
            }))}
            onValueChange={(next) => next !== null && onChange(flag, next)}
            value={String(value)}
          >
            <SelectTrigger aria-describedby={descriptionId} id={id}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {definition.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(definition.optionKeys[option as keyof typeof definition.optionKeys])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </SettingsRowFrame>
  );
}

export function FeatureFlagsSettings({ saved }: { saved: AppConfigurationDto }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<FlagDraft>(() => toFlagDraft(saved.featureFlags));
  const [conflict, setConflict] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      updateAppConfiguration(saved, {
        featureFlags: buildFlagOverrides(draft, saved.featureFlags),
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(appConfigurationOptions().queryKey, next);
      rememberAppConfiguration(next);
      setDraft(toFlagDraft(next.featureFlags));
      toast.success(t('system-settings.flags.saved-title'), {
        description: t('system-settings.flags.saved-description'),
      });
    },
    onError: (error) => {
      if (isConflict(error)) setConflict(true);
      void queryClient.invalidateQueries({ queryKey: appConfigurationOptions().queryKey });
    },
  });

  const changed = isFlagsChanged(draft, saved.featureFlags);
  const guard = useDiscardGuard(changed);

  const onChange = (flag: FeatureFlagKey, value: boolean | string | undefined) =>
    setDraft((current) => {
      const next = { ...current };
      if (value === undefined) delete next[flag];
      else next[flag] = value;
      return next;
    });

  const reload = async () => {
    const fresh = await queryClient.fetchQuery({ ...appConfigurationOptions(), staleTime: 0 });
    setConflict(false);
    save.reset();
    if (fresh) setDraft(toFlagDraft(fresh.featureFlags));
  };

  return (
    <>
      <SystemSettingsFooter>
        <Button
          disabled={!changed || save.isPending}
          onClick={() => {
            save.reset();
            setDraft(toFlagDraft(saved.featureFlags));
          }}
          size="lg"
          variant="outline"
        >
          {t('system-settings.cancel')}
        </Button>
        <Button disabled={!changed || save.isPending} onClick={() => save.mutate()} size="lg">
          {save.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
          {t('system-settings.save')}
        </Button>
      </SystemSettingsFooter>
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">{t('system-settings.flags.description')}</p>
        {conflict ? (
          <ConflictAlert onReload={reload} />
        ) : (
          save.isError && (
            <ErrorAlert
              description={serverMessage(save.error) ?? t('system-settings.save-error-description')}
              title={t('system-settings.save-error-title')}
            />
          )
        )}
        <SettingsList>
          {FEATURE_FLAG_KEYS.map((flag) => (
            <FlagRow
              disabled={save.isPending}
              draft={draft}
              flag={flag}
              key={flag}
              onChange={onChange}
            />
          ))}
        </SettingsList>
      </div>
      <DiscardChangesDialog
        description={t('system-settings.discard-description')}
        {...guard.dialog}
      />
    </>
  );
}
