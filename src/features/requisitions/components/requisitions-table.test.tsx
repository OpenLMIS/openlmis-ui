import { QueryClient } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { Suspense } from 'react';
import { expect, it } from 'vitest';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { ApprovalTableSkeleton } from '@/features/requisitions/components/approval-table';
import { ConvertTableSkeleton } from '@/features/requisitions/components/convert-table';
import { RequisitionsTableSkeleton } from '@/features/requisitions/components/requisitions-table';
import { renderPage } from '@/test-utils/render-page';

it.each([
  [RequisitionsTableSkeleton, 'requisitions.columns.date-initiated'],
  [ApprovalTableSkeleton, 'requisitions.approve.date-authorized'],
  [ConvertTableSkeleton, 'requisitions.convert.date-approved'],
])('renders %s without waiting for the deployment time zone', async (Skeleton, header) => {
  const client = new QueryClient();
  const options = deploymentTimeZoneOptions();
  void client.fetchQuery({
    ...options,
    queryFn: () => new Promise<{ zone: string; read: boolean }>(() => {}),
  });
  renderPage(
    <Suspense fallback={<p>Escaped loading boundary</p>}>
      <Skeleton cards={false} columns={{}} search={{}} />
    </Suspense>,
    { queryClient: client },
  );
  expect(await screen.findByRole('columnheader', { name: header })).toBeVisible();
  expect(screen.queryByText('Escaped loading boundary')).not.toBeInTheDocument();
  expect(client.getQueryState(options.queryKey)?.status).toBe('pending');
});
