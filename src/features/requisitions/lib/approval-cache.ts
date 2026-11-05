import type { QueryClient } from '@tanstack/react-query';
import type { ApprovalListRow } from '@/features/requisitions/lib/types';
import { queryKeys } from '@/lib/key-factory';
import type { Page } from '@/lib/types';

export function removeApprovedFromLists(client: QueryClient, ids: readonly string[]) {
  if (!ids.length) return;
  const removed = new Set(ids);
  client.setQueriesData<Page<ApprovalListRow>>(
    { queryKey: [...queryKeys.requisitions.all, 'approval'] },
    (page) => {
      if (!page) return page;
      const content = page.content.filter((row) => !removed.has(row.id));
      return {
        ...page,
        content,
        totalElements: Math.max(0, page.totalElements - page.content.length + content.length),
      };
    },
  );
}
