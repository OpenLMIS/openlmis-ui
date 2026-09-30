import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAppConfiguration } from '@/features/system-settings/api/api';
import { appConfigurationOptions } from '@/features/system-settings/api/queries';
import { savedConfiguration } from '@/features/system-settings/components/settings-fixtures';
import { useConfigurationSave } from '@/features/system-settings/hooks/use-configuration-save';
import { PartialSaveError } from '@/features/system-settings/lib/partial-save-error';
import type { AppConfigurationDto } from '@/features/system-settings/lib/types';
import {
  DEFAULT_APP_CONFIGURATION,
  getAppConfiguration,
  setAppConfiguration,
} from '@/lib/app-configuration';
import { httpError } from '@/tests/http-error';

vi.mock('@/features/system-settings/api/api', () => ({ fetchAppConfiguration: vi.fn() }));

type Draft = { appName: string };

const toValues = (configuration: AppConfigurationDto): Draft => ({
  appName: configuration.appName ?? '',
});
const isChanged = (draft: Draft, base: AppConfigurationDto) =>
  draft.appName !== (base.appName ?? '');

const save = vi.fn<(base: AppConfigurationDto, draft: Draft) => Promise<AppConfigurationDto>>();
const onPartiallySaved = vi.fn<(draft: Draft) => void>();
const handleSubmit = vi.fn(() => Promise.resolve());

const newer: AppConfigurationDto = { ...savedConfiguration, version: 5, appName: 'Someone Else' };
const submitEvent = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent;

function useSettings() {
  const { data } = useSuspenseQuery({ ...appConfigurationOptions(), staleTime: Infinity });
  const saved = data as AppConfigurationDto;
  const [values, setValues] = useState(() => toValues(saved));
  const [form] = useState(() => ({ reset: setValues, handleSubmit }));
  const settings = useConfigurationSave({
    saved,
    form,
    formId: 'settings-form',
    values,
    toValues,
    isChanged,
    save,
    onPartiallySaved,
    toast: (draft) => ({ title: 'Saved', description: `Now ${draft.appName}` }),
  });
  return { ...settings, values, edit: (appName: string) => setValues({ appName }) };
}

function renderSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(appConfigurationOptions().queryKey, savedConfiguration);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useSettings(), { wrapper });
  const cached = () => queryClient.getQueryData(appConfigurationOptions().queryKey);
  return { result, queryClient, cached };
}

async function saveDraft(result: { current: ReturnType<typeof useSettings> }, appName: string) {
  act(() => result.current.edit(appName));
  await act(() => result.current.run({ appName }));
}

beforeEach(() => {
  localStorage.clear();
  setAppConfiguration(DEFAULT_APP_CONFIGURATION);
  vi.spyOn(toast, 'success').mockImplementation(() => '');
});

describe('useConfigurationSave', () => {
  it('lets Cancel put the saved values back', () => {
    const { result } = renderSettings();

    act(() => result.current.edit('Mine'));
    expect(result.current).toMatchObject({ changed: true, canSave: true });

    act(() => result.current.cancel());

    expect(result.current.values).toEqual({ appName: 'SIGECA' });
    expect(result.current).toMatchObject({ changed: false, canSave: false });
  });

  it('stores a save in the cache and the running app, starts the form from it and says so', async () => {
    const stored = { ...savedConfiguration, version: 4, appName: 'Mine' };
    save.mockResolvedValue(stored);
    const { result, cached } = renderSettings();

    await saveDraft(result, 'Mine');

    expect(save).toHaveBeenCalledWith(savedConfiguration, { appName: 'Mine' });
    await waitFor(() => expect(cached()).toEqual(stored));
    expect(getAppConfiguration().appName).toBe('Mine');
    expect(result.current.base).toEqual(stored);
    expect(result.current.values).toEqual({ appName: 'Mine' });
    expect(result.current.changed).toBe(false);
    expect(toast.success).toHaveBeenCalledWith('Saved', { description: 'Now Mine' });
  });

  it('settles on the value from the store, not one the draft was sent with', async () => {
    save.mockResolvedValue({ ...savedConfiguration, version: 4, appName: 'Mine!' });
    const { result } = renderSettings();

    await saveDraft(result, 'Mine');

    expect(result.current.values).toEqual({ appName: 'Mine!' });
  });

  it('keeps the draft and blocks Save when someone else saved first', async () => {
    save.mockRejectedValue(httpError(409));
    const { result, cached } = renderSettings();

    await saveDraft(result, 'Mine');

    expect(result.current.feedback.conflict).toBe(true);
    expect(result.current).toMatchObject({ changed: true, canSave: false, blocked: true });
    expect(result.current.values).toEqual({ appName: 'Mine' });
    expect(cached()).toEqual(savedConfiguration);
    expect(toast.success).not.toHaveBeenCalled();

    act(() => result.current.submit(submitEvent()));
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('reports a failed save without blocking the next try', async () => {
    const failure = httpError(500);
    save.mockRejectedValue(failure);
    const { result } = renderSettings();

    await act(async () => {
      result.current.edit('Mine');
      await expect(result.current.run({ appName: 'Mine' })).resolves.toBeUndefined();
    });

    expect(result.current.feedback).toMatchObject({ conflict: false, error: failure });
    expect(result.current.canSave).toBe(true);
  });

  it('keeps Save blocked after Cancel until Reload, since the saved version is out of date', async () => {
    save.mockRejectedValue(httpError(409));
    const { result } = renderSettings();
    await saveDraft(result, 'Mine');

    act(() => result.current.cancel());

    expect(result.current.values).toEqual({ appName: 'SIGECA' });
    expect(result.current.feedback).toMatchObject({ conflict: true, error: null });
    act(() => result.current.edit('Again'));
    expect(result.current.canSave).toBe(false);
  });

  it('settles what the server stored when a save failed part way, and keeps the rest of the draft', async () => {
    const stored = {
      ...savedConfiguration,
      version: 4,
      logo: { url: '/api/appConfiguration/logo?v=new', contentType: 'image/png', size: 1 },
    };
    const cause = httpError(500);
    save.mockRejectedValue(new PartialSaveError(stored, cause));
    const { result, cached } = renderSettings();

    await saveDraft(result, 'Mine');

    await waitFor(() => expect(cached()).toEqual(stored));
    expect(getAppConfiguration().logo?.url).toBe(stored.logo.url);
    expect(result.current.base).toEqual(stored);
    expect(onPartiallySaved).toHaveBeenCalledWith({ appName: 'Mine' });
    expect(result.current.values).toEqual({ appName: 'Mine' });
    expect(result.current.feedback).toMatchObject({ conflict: false, error: cause });
    expect(result.current.canSave).toBe(true);
  });

  it('counts a part way save that ended in a conflict as a conflict', async () => {
    save.mockRejectedValue(new PartialSaveError(savedConfiguration, httpError(409)));
    const { result } = renderSettings();

    await saveDraft(result, 'Mine');

    expect(result.current.feedback.conflict).toBe(true);
    expect(result.current.canSave).toBe(false);
  });

  it('lets Reload clear the conflict and start the form from the latest version', async () => {
    save.mockRejectedValue(httpError(409));
    vi.mocked(fetchAppConfiguration).mockResolvedValue(newer);
    const { result, cached } = renderSettings();
    await saveDraft(result, 'Mine');

    await act(() => result.current.feedback.onReload());

    expect(result.current.feedback).toMatchObject({ conflict: false, error: null });
    expect(result.current.values).toEqual({ appName: 'Someone Else' });
    expect(result.current.base).toEqual(newer);
    expect(cached()).toEqual(newer);
    expect(getAppConfiguration().appName).toBe('Someone Else');
  });

  it('keeps the conflict when Reload fails, and says why', async () => {
    const failure = httpError(500);
    save.mockRejectedValue(httpError(409));
    vi.mocked(fetchAppConfiguration).mockRejectedValue(failure);
    const { result } = renderSettings();
    await saveDraft(result, 'Mine');

    await act(() => result.current.feedback.onReload());

    expect(result.current.feedback).toMatchObject({ conflict: true, reloadError: failure });
    expect(result.current.values).toEqual({ appName: 'Mine' });
  });

  it('saves against the version the draft started from when a newer one arrives meanwhile', async () => {
    save.mockRejectedValue(httpError(409));
    const { result, queryClient } = renderSettings();

    act(() => result.current.edit('Mine'));
    act(() => queryClient.setQueryData(appConfigurationOptions().queryKey, newer));
    await act(() => result.current.run({ appName: 'Mine' }));

    expect(save).toHaveBeenCalledWith(savedConfiguration, { appName: 'Mine' });
    expect(result.current.values).toEqual({ appName: 'Mine' });
  });

  it('follows a newer version while there is no draft', async () => {
    const { result, queryClient } = renderSettings();

    act(() => queryClient.setQueryData(appConfigurationOptions().queryKey, newer));

    await waitFor(() => expect(result.current.base).toEqual(newer));
    expect(result.current.values).toEqual({ appName: 'Someone Else' });
  });

  it('submits only a changed draft', () => {
    const { result } = renderSettings();
    const unchanged = submitEvent();

    act(() => result.current.submit(unchanged));
    expect(unchanged.preventDefault).toHaveBeenCalled();
    expect(handleSubmit).not.toHaveBeenCalled();

    act(() => result.current.edit('Mine'));
    act(() => result.current.submit(submitEvent()));
    expect(handleSubmit).toHaveBeenCalledOnce();
  });
});
