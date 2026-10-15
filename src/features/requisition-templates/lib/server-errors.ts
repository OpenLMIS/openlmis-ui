import { isAxiosError } from 'axios';
import { serverMessage } from '@/components/dialog-parts';

export function templateServerMessages(error: unknown): string[] {
  const data: unknown = isAxiosError(error) ? error.response?.data : undefined;
  if (!data || typeof data !== 'object') return [];
  const message = serverMessage(error);
  if (message) return [message];
  return Object.values(data).flatMap((value: unknown) =>
    value && typeof value === 'object' && 'message' in value && typeof value.message === 'string'
      ? [value.message]
      : [],
  );
}
