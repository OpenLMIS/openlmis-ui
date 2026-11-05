import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceActionsSlot, WorkspaceSlots } from '@/components/workspace/workspace-tabs';
import { createOrder } from '@/features/orders/api/api';
import * as orderQueries from '@/features/orders/api/queries';
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
function setup(readable = true, freshSuppliers = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(userProgramsOptions('user').queryKey, [
    { id: 'program', name: 'Program', code: 'P', active: true },
  ]);
  if (!freshSuppliers)
    for (const ids of [['0'], ['1'], ['2'], ['0', '1'], ['0', '2'], ['1', '2'], ['0', '1', '2']])
      client.setQueryData(supplyingFacilitiesOptions('program', ids).queryKey, ['2']);
  const onCreated = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <WorkspaceSlots>
        <WorkspaceActionsSlot />
        <CreateOrderForm
          userId="user"
          facilities={facilities}
          requesting={facilities}
          canRead={() => readable}
          onCreated={onCreated}
        />
      </WorkspaceSlots>
    </QueryClientProvider>,
  );
  return { client, onCreated, user: userEvent.setup() };
}
async function add(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('combobox', { name: 'orders.create.requesting-facility' }));
  await user.click(await screen.findByRole('option', { name }));
  expect(screen.queryByRole('button', { name: 'orders.add' })).not.toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'orders.create.requesting-facility' })).toHaveFocus();
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

it('moves focus to the next displayed removal control, then back to the facility picker', async () => {
  const { user } = setup();
  await add(user, 'Supplier');
  await add(user, 'Alpha');
  await add(user, 'Beta');
  const remove = () => screen.getAllByRole('button', { name: 'orders.create.remove-facility' });
  await user.click(remove()[0]);
  expect(remove()[0]).toHaveFocus();
  await user.click(remove()[0]);
  expect(remove()[0]).toHaveFocus();
  await user.click(remove()[0]);
  expect(screen.getByRole('combobox', { name: 'orders.create.requesting-facility' })).toHaveFocus();
});

it('keeps required picker placeholders free of spoken punctuation', () => {
  setup();
  for (const picker of screen.getAllByRole('combobox')) {
    expect(picker.getAttribute('placeholder')).not.toContain('*');
  }
});

it('shows the required requesting facility label before a facility is added', async () => {
  setup();
  const label = (await screen.findByText('orders.create.requesting-facility')).closest('label');
  expect(label).toBeVisible();
  expect(label?.textContent).toContain('*');
  expect(screen.getByRole('button', { name: 'orders.create.create' })).toBeDisabled();
});

it('retains removal focus when fresh supplier queries settle after removing the first facility', async () => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1000);
  let refresh = false;
  let finish!: (ids: string[]) => void;
  const original = orderQueries.supplyingFacilitiesOptions;
  const spy = vi
    .spyOn(orderQueries, 'supplyingFacilitiesOptions')
    .mockImplementation((...args) => ({
      ...original(...args),
      staleTime: 0,
      queryFn: () =>
        refresh
          ? new Promise<string[]>((resolve) => {
              finish = resolve;
            })
          : Promise.resolve(['2']),
    }));
  const { user, client } = setup(true, true);
  await add(user, 'Alpha');
  await add(user, 'Beta');
  const remove = () => screen.getAllByRole('button', { name: 'orders.create.remove-facility' });
  refresh = true;
  await user.click(remove()[0]);
  await waitFor(() => expect(finish).toBeDefined());
  await act(() => finish(['2']));
  await waitFor(() => expect(remove()[0]).toHaveFocus());
  await act(async () => {
    client.setQueryData(supplyingFacilitiesOptions('program', ['1']).queryKey, ['2', '0']);
  });
  expect(remove()[0]).toHaveFocus();
  spy.mockRestore();
});
