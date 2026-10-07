import type { AxiosRequestConfig } from 'axios';
import { isAxiosError } from 'axios';
import { client } from '@/integrations/axios';

export async function fetchReport(path: string, params: AxiosRequestConfig['params']) {
  try {
    const { data } = await client.get<Blob>(path, { params, responseType: 'blob' });
    return data;
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
