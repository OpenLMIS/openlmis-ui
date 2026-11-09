import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceActionsSlot, WorkspaceSlots } from '@/components/workspace/workspace-tabs';
import { createOrder } from '@/features/orders/api/api';
import { supplyingFacilitiesOptions } from '@/features/orders/api/queries';
import { CreateOrderForm } from '@/features/orders/components/create-order-form';
import * as referenceQueries from '@/features/reference-data/api/queries';
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
function setup(
  readable = true,
  freshSuppliers = false,
  freshPrograms = false,
  available = facilities,
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  if (!freshPrograms)
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
          facilities={available}
          requesting={available}
          canRead={() => readable}
          onCreated={onCreated}
        />
      </WorkspaceSlots>
    </QueryClientProvider>,
  );
  return { client, onCreated, user: userEvent.setup() };
}
async function add(user: ReturnType<typeof userEvent.setup>, name: string) {
  const input = screen.getByRole('combobox', { name: 'orders.create.requesting-facility' });
  if (input.getAttribute('aria-expanded') !== 'true') await user.click(input);
  await user.click(await screen.findByRole('option', { name }));
  expect(screen.queryByRole('button', { name: 'orders.add' })).not.toBeInTheDocument();
  await waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'false'));
  expect(input).toHaveFocus();
}
describe('create order workflow', () => {
  it('creates one legacy body per facility and opens successful ids after a partial failure', async () => {
    let finish!: (order: Awaited<ReturnType<typeof createOrder>>) => void;
    vi.mocked(createOrder)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockRejectedValueOnce(new Error('Refused'));
    const { user, onCreated } = setup();
    expect(screen.getByText('orders.create.requesting-facility').closest('label')).toBeVisible();
    for (const picker of screen.getAllByRole('combobox'))
      expect(picker.getAttribute('placeholder')).not.toContain('*');
    expect(screen.getByRole('button', { name: 'orders.create.create' })).toBeDisabled();
    await add(user, 'Alpha');
    await add(user, 'Beta');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'orders.create.create' }));
    expect(
      screen.getByRole('combobox', { name: 'orders.create.requesting-facility' }),
    ).toBeDisabled();
    for (const remove of screen.getAllByRole('button', { name: 'orders.create.remove-facility' }))
      expect(remove).toHaveAttribute('aria-disabled', 'true');
    await act(() => finish({ id: 'draft-a' } as Awaited<ReturnType<typeof createOrder>>));
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
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'orders.create.create' })).toBeDisabled();
    expect(screen.getByText('orders.create.no-read-right')).toBeVisible();
    expect(createOrder).not.toHaveBeenCalled();
  });
});

it('keeps picked facilities as chips and ticked options, toggles and removes them, and resets the supplier', async () => {
  const { user, client } = setup();
  for (const ids of [['0'], ['0', '1']])
    client.setQueryData(supplyingFacilitiesOptions('program', ids).queryKey, ['2', '0']);
  const create = screen.getByRole('button', { name: 'orders.create.create' });
  expect(create).toBeDisabled();
  await add(user, 'Alpha');
  const supplier = screen.getByRole('combobox', { name: 'orders.create.supplying-facility' });
  await user.click(supplier);
  await user.click(await screen.findByRole('option', { name: 'Supplier' }));
  expect(create).toBeEnabled();
  const facility = screen.getByRole('combobox', { name: 'orders.create.requesting-facility' });
  await user.click(facility);
  await user.keyboard('Bet{ArrowDown}{Enter}');
  await waitFor(() => expect(facility).toHaveAttribute('aria-expanded', 'false'));
  expect(facility).toHaveFocus();
  expect(facility).toHaveValue('');
  await user.click(facility);
  for (const name of ['Alpha', 'Beta']) {
    expect(await screen.findByRole('option', { name })).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByText(name, { selector: '[data-slot=combobox-chip] span[dir]' }),
    ).toBeVisible();
  }
  expect(create).toBeDisabled();
  await user.click(screen.getByRole('option', { name: 'Beta' }));
  expect(
    screen.queryByText('Beta', { selector: '[data-slot=combobox-chip] span[dir]' }),
  ).not.toBeInTheDocument();
  await add(user, 'Beta');
  await user.click(supplier);
  await user.click(await screen.findByRole('option', { name: 'Supplier' }));
  expect(create).toBeEnabled();
  const chip = screen
    .getByText('Beta', { selector: '[data-slot=combobox-chip] span[dir]' })
    .closest('[data-slot=combobox-chip]') as HTMLElement;
  await user.click(within(chip).getByRole('button', { name: 'orders.create.remove-facility' }));
  expect(
    screen.queryByText('Beta', { selector: '[data-slot=combobox-chip] span[dir]' }),
  ).not.toBeInTheDocument();
  expect(supplier).toHaveValue('');
  expect(create).toBeDisabled();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('keeps the facility picker mounted while programs load and enables the loaded program', async () => {
  let finish!: (programs: { id: string; name: string; code: string; active: boolean }[]) => void;
  const pending = new Promise<{ id: string; name: string; code: string; active: boolean }[]>(
    (resolve) => {
      finish = resolve;
    },
  );
  const original = referenceQueries.userProgramsOptions;
  vi.spyOn(referenceQueries, 'userProgramsOptions').mockImplementation((id) => ({
    ...original(id),
    queryFn: () => pending,
  }));
  const { user } = setup(true, false, true);
  expect(screen.getByRole('combobox', { name: 'orders.create.program' })).toHaveAttribute(
    'data-disabled',
  );
  expect(screen.getByRole('button', { name: 'orders.create.create' })).toBeDisabled();
  await add(user, 'Alpha');
  const picker = screen.getByRole('combobox', { name: 'orders.create.requesting-facility' });
  await act(() => finish([{ id: 'program', name: 'Program', code: 'P', active: true }]));
  await user.keyboard('{Escape}');
  expect(screen.getByRole('combobox', { name: 'orders.create.requesting-facility' })).toBe(picker);
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'orders.create.program' })).not.toHaveAttribute(
      'data-disabled',
    ),
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'orders.create.create' })).toBeEnabled(),
  );
});

it('offers every requesting facility through virtualization and can search its code', async () => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(248);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(36);
  const available = Array.from({ length: 1006 }, (_, index) => ({
    id: String(index),
    name: `Clinic ${index}`,
    code: `C${index}`,
    active: true,
  }));
  const { user, client } = setup(true, false, false, available);
  client.setQueryData(supplyingFacilitiesOptions('program', ['1005']).queryKey, ['2']);
  const input = screen.getByRole('combobox', { name: 'orders.create.requesting-facility' });
  await user.click(input);
  const listed = await screen.findAllByRole('option');
  expect(listed.length).toBeLessThan(30);
  expect(listed[0]).toHaveAttribute('aria-setsize', '1006');
  await user.type(input, 'C1005');
  await user.click(await screen.findByRole('option', { name: 'Clinic 1005' }));
  expect(input).toHaveValue('');
  expect(
    screen.getByText('Clinic 1005', { selector: '[data-slot=combobox-chip] span[dir]' }),
  ).toBeVisible();
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  await user.type(input, 'C1005');
  expect(await screen.findByRole('option', { name: 'Clinic 1005' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(screen.getByRole('combobox', { name: 'orders.create.requesting-facility' })).toHaveFocus();
});
