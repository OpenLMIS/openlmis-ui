import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAppConfiguration,
  removeLogo,
  saveBranding,
  updateAppConfiguration,
  uploadLogo,
} from '@/features/system-settings/api/api';
import { PartialSaveError } from '@/features/system-settings/lib/partial-save-error';
import type { AppConfigurationDto } from '@/features/system-settings/lib/types';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({
  client: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const get = vi.mocked(client.get);
const put = vi.mocked(client.put);
const remove = vi.mocked(client.delete);

const saved: AppConfigurationDto = {
  version: 3,
  appName: 'SIGECA',
  logo: null,
  theme: { preset: 'teal', defaultAppearance: 'dark' },
  featureFlags: { GS1_SCANNING: true },
  modifiedDate: '2026-09-29T10:00:00Z',
};

const atVersion = (version: number, changes: Partial<AppConfigurationDto> = {}) => ({
  data: { ...saved, ...changes, version },
});

beforeEach(() => vi.resetAllMocks());

describe('fetchAppConfiguration', () => {
  it('reads the configuration', async () => {
    get.mockResolvedValueOnce({ data: saved });

    await expect(fetchAppConfiguration()).resolves.toEqual(saved);
    expect(get).toHaveBeenCalledWith('/appConfiguration');
  });

  it('has nothing when the server has no configuration endpoint', async () => {
    get.mockRejectedValueOnce(
      new AxiosError('failed', '404', undefined, undefined, {
        status: 404,
        statusText: '',
        data: {},
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );

    await expect(fetchAppConfiguration()).resolves.toBeNull();
  });
});

describe('updateAppConfiguration', () => {
  it('sends the whole configuration with the version it is based on', async () => {
    put.mockResolvedValueOnce(atVersion(4));

    await updateAppConfiguration(saved, { appName: 'Malawi LMIS' });

    expect(put).toHaveBeenCalledWith(
      '/appConfiguration',
      {
        appName: 'Malawi LMIS',
        theme: saved.theme,
        featureFlags: saved.featureFlags,
      },
      { headers: { 'If-Match': 'W/"3"' } },
    );
  });
});

describe('uploadLogo', () => {
  it('sends the file as the multipart file part', async () => {
    put.mockResolvedValueOnce(atVersion(4));
    const file = new File(['x'], 'logo.png', { type: 'image/png' });

    await uploadLogo(saved, file);

    const [url, body, config] = put.mock.calls[0] ?? [];
    expect(url).toBe('/appConfiguration/logo');
    expect((body as FormData).get('file')).toBe(file);
    expect(config).toEqual({
      headers: { 'If-Match': 'W/"3"', 'Content-Type': 'multipart/form-data' },
    });
  });
});

describe('removeLogo', () => {
  it('names the version it is based on', async () => {
    remove.mockResolvedValueOnce(atVersion(4));

    await removeLogo(saved);

    expect(remove).toHaveBeenCalledWith('/appConfiguration/logo', {
      headers: { 'If-Match': 'W/"3"' },
    });
  });
});

describe('saveBranding', () => {
  it('runs each step on the version the previous one returned', async () => {
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    put.mockResolvedValueOnce(atVersion(4)).mockResolvedValueOnce(atVersion(5, { appName: 'New' }));

    const result = await saveBranding(saved, [
      { kind: 'upload', file },
      { kind: 'update', appName: 'New' },
    ]);

    expect(put.mock.calls[0]?.[2]).toMatchObject({ headers: { 'If-Match': 'W/"3"' } });
    expect(put.mock.calls[1]?.[2]).toEqual({ headers: { 'If-Match': 'W/"4"' } });
    expect(result).toEqual({ ...saved, appName: 'New', version: 5 });
  });

  it('returns the saved configuration when there is nothing to do', async () => {
    await expect(saveBranding(saved, [])).resolves.toBe(saved);
    expect(put).not.toHaveBeenCalled();
  });

  it('reports what was stored when a later step fails', async () => {
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    const failure = new Error('offline');
    put.mockResolvedValueOnce(atVersion(4)).mockRejectedValueOnce(failure);

    const error = await saveBranding(saved, [
      { kind: 'upload', file },
      { kind: 'update', appName: 'New' },
    ]).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PartialSaveError);
    expect(error).toMatchObject({ saved: { ...saved, version: 4 }, cause: failure });
  });

  it('passes on the error when nothing was stored', async () => {
    const failure = new Error('offline');
    put.mockRejectedValueOnce(failure);

    await expect(saveBranding(saved, [{ kind: 'update', appName: 'New' }])).rejects.toBe(failure);
  });
});
