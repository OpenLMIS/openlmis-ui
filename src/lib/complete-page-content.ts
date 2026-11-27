import type { Page } from '@/lib/types';

export function completePageContent<T>({ content, totalElements, totalPages }: Page<T>): T[] {
  if (totalPages > 1 || totalElements !== content.length) {
    throw new Error('The response did not include every record');
  }
  return content;
}
