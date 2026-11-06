import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { RequisitionCopyNotice } from './requisition-copy-notice';
import { RequisitionsToolbar } from './requisitions-toolbar';

vi.mock('@/lib/secure-context', () => ({ isSecureOrigin: false }));
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  useRouter: () => ({ invalidate: vi.fn() }),
}));
vi.mock('@/features/requisitions/hooks/use-offline-copies', () => ({ useOfflineCopies: () => [] }));
afterEach(cleanup);
it('hides the unavailable Offline filter on HTTP and explains saved-copy availability', async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RequisitionsToolbar search={{}} onFilterChange={vi.fn()} />
      <RequisitionCopyNotice list />
    </QueryClientProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: /Filters/ }));
  expect(
    screen.queryByRole('combobox', { name: 'requisitions.offline.label' }),
  ).not.toBeInTheDocument();
  expect(screen.getByText('requisitions.offline.insecure-description')).toBeInTheDocument();
});

it.each([{ id: 'r' }, { ids: ['r'], representation: 'batch' as const }])(
  'keeps the HTTP copy note on lists only: %s',
  (props) => {
    render(<RequisitionCopyNotice {...props} />);
    expect(screen.queryByText('requisitions.offline.insecure-description')).not.toBeInTheDocument();
  },
);
