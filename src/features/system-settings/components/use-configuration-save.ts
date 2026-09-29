import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { appConfigurationOptions } from '@/features/system-settings/api/queries';
import type { AppConfigurationDto } from '@/features/system-settings/lib/types';
import { rememberAppConfiguration } from '@/lib/app-configuration';
import { isConflict } from '@/lib/http';

type ConfigurationSaveOptions<Variables> = {
  save: (variables: Variables) => Promise<AppConfigurationDto>;
  onSaved: (next: AppConfigurationDto) => void;
  onReloaded: (fresh: AppConfigurationDto) => void;
  toast: (variables: Variables) => { title: string; description: string };
};

export function useConfigurationSave<Variables>({
  save,
  onSaved,
  onReloaded,
  toast: toastFor,
}: ConfigurationSaveOptions<Variables>) {
  const queryClient = useQueryClient();
  const [conflict, setConflict] = useState(false);

  const store = (next: AppConfigurationDto) => {
    queryClient.setQueryData(appConfigurationOptions().queryKey, next);
    rememberAppConfiguration(next);
  };

  const refresh = async () => {
    const fresh = await queryClient.fetchQuery(appConfigurationOptions());
    if (fresh) rememberAppConfiguration(fresh);
    return fresh;
  };

  const mutation = useMutation({
    mutationFn: save,
    onSuccess: (next, variables) => {
      store(next);
      onSaved(next);
      const { title, description } = toastFor(variables);
      toast.success(title, { description });
    },
    onError: (error) => {
      if (isConflict(error)) setConflict(true);
      else void refresh().catch(() => undefined);
    },
  });

  const reload = async () => {
    const fresh = await refresh();
    setConflict(false);
    mutation.reset();
    if (fresh) onReloaded(fresh);
  };

  return { mutation, conflict, reload, blocked: conflict || mutation.isPending };
}
