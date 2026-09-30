import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { appConfigurationOptions } from '@/features/system-settings/api/queries';
import { PartialSaveError } from '@/features/system-settings/lib/partial-save-error';
import type { AppConfigurationDto } from '@/features/system-settings/lib/types';
import { rememberAppConfiguration } from '@/lib/app-configuration';
import { isConflict } from '@/lib/http';

type SettingsForm<Values> = {
  reset: (values: Values) => void;
  handleSubmit: () => Promise<unknown>;
};

type ConfigurationSaveOptions<Values, Variables> = {
  saved: AppConfigurationDto;
  form: SettingsForm<Values>;
  formId: string;
  values: Values;
  toValues: (configuration: AppConfigurationDto) => Values;
  isChanged: (values: Values, base: AppConfigurationDto) => boolean;
  save: (base: AppConfigurationDto, variables: Variables) => Promise<AppConfigurationDto>;
  toast: (variables: Variables) => { title: string; description: string };
  onPartiallySaved?: (variables: Variables) => void;
};

function focusFirstControl(formId: string) {
  const controls = document
    .getElementById(formId)
    ?.querySelectorAll<HTMLElement>('input, button, select, textarea, [tabindex]');
  const first = [...(controls ?? [])].find(
    (control) =>
      control.tabIndex >= 0 &&
      !control.hasAttribute('disabled') &&
      control.getAttribute('aria-hidden') !== 'true' &&
      !(control instanceof HTMLInputElement && control.type === 'hidden'),
  );
  first?.focus();
}

export function useConfigurationSave<Values, Variables>({
  saved,
  form,
  formId,
  values,
  toValues,
  isChanged,
  save,
  toast: toastFor,
  onPartiallySaved,
}: ConfigurationSaveOptions<Values, Variables>) {
  const queryClient = useQueryClient();
  const [base, setBase] = useState(saved);
  const [conflict, setConflict] = useState(false);
  const [reloadError, setReloadError] = useState<unknown>(null);
  const [reloaded, setReloaded] = useState(0);
  const changed = isChanged(values, base);

  const settle = (next: AppConfigurationDto) => {
    const { queryKey } = appConfigurationOptions();
    void queryClient.cancelQueries({ queryKey });
    queryClient.setQueryData(queryKey, next);
    rememberAppConfiguration(next);
    setBase(next);
  };

  const mutation = useMutation({
    mutationFn: (variables: Variables) => save(base, variables),
    onSuccess: (next, variables) => {
      settle(next);
      form.reset(toValues(next));
      const { title, description } = toastFor(variables);
      toast.success(title, { description });
    },
    onError: (error, variables) => {
      if (error instanceof PartialSaveError) {
        settle(error.saved);
        onPartiallySaved?.(variables);
      }
      if (isConflict(error instanceof PartialSaveError ? error.cause : error)) setConflict(true);
    },
  });

  useEffect(() => {
    if (saved === base || changed || mutation.isPending) return;
    setBase(saved);
    form.reset(toValues(saved));
  }, [saved, base, changed, mutation.isPending, form, toValues]);

  useEffect(() => {
    if (reloaded > 0) focusFirstControl(formId);
  }, [reloaded, formId]);

  const reload = async () => {
    try {
      const fresh = await queryClient.fetchQuery(appConfigurationOptions());
      setReloadError(null);
      setConflict(false);
      mutation.reset();
      if (fresh) {
        setBase(fresh);
        form.reset(toValues(fresh));
      }
      setReloaded((count) => count + 1);
    } catch (error) {
      setReloadError(error);
    }
  };

  const canSave = changed && !conflict;

  return {
    base,
    changed,
    canSave,
    pending: mutation.isPending,
    blocked: conflict || mutation.isPending,
    run: (variables: Variables) =>
      mutation.mutateAsync(variables).then(
        () => undefined,
        () => undefined,
      ),
    submit: (event: FormEvent) => {
      event.preventDefault();
      if (canSave && !mutation.isPending) void form.handleSubmit();
    },
    cancel: () => {
      mutation.reset();
      setBase(saved);
      form.reset(toValues(saved));
    },
    feedback: {
      conflict,
      error: mutation.error instanceof PartialSaveError ? mutation.error.cause : mutation.error,
      reloadError,
      onReload: reload,
    },
  };
}
