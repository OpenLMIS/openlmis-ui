import { AxiosError, isAxiosError } from 'axios';
import { client } from '@/integrations/axios';

export const isNotFound = (error: unknown) => isAxiosError(error) && error.response?.status === 404;

export const isRefused = (error: unknown) => isAxiosError(error) && error.response?.status === 403;

/** No answer at all, as offline; a timeout is a slow server, not a missing connection. */
export const isOfflineError = (error: unknown) =>
  isAxiosError(error) && !error.response && error.code !== AxiosError.ECONNABORTED;

export const isUnauthorized = (error: unknown) =>
  isAxiosError(error) && error.response?.status === 401;

/** A record that may not exist yet, such as a user's contact details; missing is null, not an error. */
export async function getIfExists<T>(url: string): Promise<T | null> {
  try {
    const { data } = await client.get<T>(url);
    return data;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}
