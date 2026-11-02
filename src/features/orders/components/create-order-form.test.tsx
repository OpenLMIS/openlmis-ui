import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceActionsSlot, WorkspaceSlots } from '@/components/workspace/workspace-tabs';
import { createOrder } from '@/features/orders/api/api';
import { supplyingFacilitiesOptions } from '@/features/orders/api/queries';
import { CreateOrderForm } from '@/features/orders/components/create-order-form';
import { userProgramsOptions } from '@/features/reference-data/api/queries';

vi.mock('@/components/app-shell/app-breadcrumbs', () => ({ AppBreadcrumbs: () => null }));
vi.mock('@/features/orders/api/api', () => ({ createOrder: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const facilities = ['Alpha', 'Beta', 'Supplier'].map((name, index) => ({
  id: String(index),
  name,
  code: name,
  active: true,
}));
function setup(readable = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(userProgramsOptions('user').queryKey, [
    { id: 'program', name: 'Program', code: 'P', active: true },
  ]);
  for (const ids of [['0'], ['0', '1']])
    client.setQueryData(supplyingFacilitiesOptions('program', ids).queryKey, ['2']);
  const onCreated = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <WorkspaceSlots>
        <WorkspaceActionsSlot />
        <CreateOrderForm
          userId="user"
          facilities={facilities}
          requesting={facilities.slice(0, 2)}
          canRead={() => readable}
          onCreated={onCreated}
        />
      </WorkspaceSlots>
    </QueryClientProvider>,
  );
  return { onCreated, user: userEvent.setup() };
}
async function add(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('combobox', { name: 'orders.create.requesting-facility' }));
  await user.click(await screen.findByRole('option', { name }));
  await user.click(screen.getByRole('button', { name: 'orders.add' }));
}
describe('create order workflow', () => {
  it('creates one legacy body per facility and opens successful ids after a partial failure', async () => {
    vi.mocked(createOrder)
      .mockResolvedValueOnce({ id: 'draft-a' } as Awaited<ReturnType<typeof createOrder>>)
      .mockRejectedValueOnce(new Error('Refused'));
    const { user, onCreated } = setup();
    await add(user, 'Alpha');
    await add(user, 'Beta');
    await user.click(screen.getByRole('button', { name: 'orders.create.create' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(['draft-a']));
    expect(createOrder).toHaveBeenCalledTimes(2);
    for (const id of ['0', '1'])
      expect(createOrder).toHaveBeenCalledWith({
        emergency: true,
        createdBy: { id: 'user' },
        program: { id: 'program' },
        requestingFacility: { id },
        receivingFacility: { id },
        supplyingFacility: { id: '2' },
        facility: { id },
      });
  });
  it('blocks creation when drafts cannot be read', async () => {
    const { user } = setup(false);
    await add(user, 'Alpha');
    expect(screen.getByRole('button', { name: 'orders.create.create' })).toBeDisabled();
    expect(screen.getByText('orders.create.no-read-right')).toBeVisible();
    expect(createOrder).not.toHaveBeenCalled();
  });
});
