import type { AxiosAdapter } from 'axios';
import { afterEach, expect, it, vi } from 'vitest';
import { uploadIdealStockAmounts } from '@/features/ideal-stock-amounts/api/api';
import { client } from '@/integrations/axios';

const originalAdapter = client.defaults.adapter;

afterEach(() => {
  client.defaults.adapter = originalAdapter;
});

function readBytes(blob: Blob) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

it('sends original CSV bytes as a multipart file with only its extension normalized', async () => {
  const adapter = vi.fn<AxiosAdapter>(async (config) => ({
    data: { amount: 0 },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  }));
  client.defaults.adapter = adapter;
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 70, 97, 99, 105, 108, 105, 116, 121, 13, 10]);
  const file = new File([bytes], 'Current Amounts.CSV', { type: '' });

  await expect(uploadIdealStockAmounts(file)).resolves.toEqual({ amount: 0 });

  expect(adapter).toHaveBeenCalledOnce();
  const config = adapter.mock.calls[0][0];
  expect(config.method).toBe('post');
  expect(config.url).toBe('/idealStockAmounts');
  expect(config.params).toEqual({ format: 'csv' });
  expect(config.timeout).toBe(300_000);
  expect(client.defaults.timeout).toBe(60_000);
  expect(config.headers.getContentType()).toBe('multipart/form-data');
  expect(config.data).toBeInstanceOf(FormData);
  const body = config.data as FormData;
  expect([...body.keys()]).toEqual(['file']);
  const uploaded = body.get('file') as File;
  expect(uploaded.name).toBe('Current Amounts.csv');
  expect(file.name).toBe('Current Amounts.CSV');
  expect(new Uint8Array(await readBytes(uploaded))).toEqual(bytes);
});

it.each([{}, '<html>proxy login</html>'])(
  'rejects a malformed successful upload response (%j)',
  async (data) => {
    client.defaults.adapter = async (config) => ({
      data,
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': typeof data === 'string' ? 'text/html' : 'application/json' },
      config,
    });

    await expect(uploadIdealStockAmounts(new File(['header'], 'values.csv'))).rejects.toThrow();
  },
);
