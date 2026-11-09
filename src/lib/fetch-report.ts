import type { AxiosRequestConfig } from 'axios';
import { isAxiosError } from 'axios';
import { client } from '@/integrations/axios';

async function requestReport(path: string, params: AxiosRequestConfig['params']) {
  try {
    return await client.get<Blob>(path, { params, responseType: 'blob' });
  } catch (error) {
    if (isAxiosError(error) && error.response?.data instanceof Blob) {
      try {
        error.response.data = JSON.parse(await error.response.data.text());
      } catch {
        error.response.data = undefined;
      }
    }
    throw error;
  }
}

function reportFilename(disposition: unknown): string | undefined {
  if (typeof disposition !== 'string') return undefined;
  const encoded = /(?:^|;)\s*filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.trim());
    } catch {}
  }
  const match = /(?:^|;)\s*filename=(?:"((?:[^"\\]|\\.)*)"|([^;]+))/i.exec(disposition);
  return match?.[1]?.replace(/\\(.)/g, '$1') ?? match?.[2]?.trim();
}

export async function fetchReport(path: string, params: AxiosRequestConfig['params']) {
  return (await requestReport(path, params)).data;
}

export async function fetchReportFile(path: string, params: AxiosRequestConfig['params']) {
  const { data, headers } = await requestReport(path, params);
  return { blob: data, filename: reportFilename(headers['content-disposition']) };
}
