import { isAxiosError } from 'axios';

export function templateServerMessages(error: unknown): string[] {
  const data: unknown = isAxiosError(error) ? error.response?.data : undefined;
  if (!data || typeof data !== 'object') return [];
  if ('message' in data && typeof data.message === 'string') return [data.message];
  return Object.values(data).flatMap((value: unknown) =>
    value && typeof value === 'object' && 'message' in value && typeof value.message === 'string'
      ? [value.message]
      : [],
  );
}
