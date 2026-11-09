import { QueryClient } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { Suspense } from 'react';
import { expect, it } from 'vitest';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { ApprovalTableSkeleton } from '@/features/requisitions/components/approval-table';
import { renderPage } from '@/test-utils/render-page';

it('renders the loading table while the deployment time zone is pending', async () => {
  const client = new QueryClient();
  const options = deploymentTimeZoneOptions();
  void client.fetchQuery({
    ...options,
    queryFn: () => new Promise<{ zone: string; read: boolean }>(() => {}),
  });
  renderPage(
    <Suspense fallback={<p>Escaped loading boundary</p>}>
      <ApprovalTableSkeleton cards={false} columns={{}} search={{}} />
    </Suspense>,
    { queryClient: client },
  );
  expect(
    await screen.findByRole('columnheader', { name: 'requisitions.approve.date-authorized' }),
  ).toBeVisible();
  expect(screen.queryByText('Escaped loading boundary')).not.toBeInTheDocument();
  expect(client.getQueryState(options.queryKey)?.status).toBe('pending');
});
