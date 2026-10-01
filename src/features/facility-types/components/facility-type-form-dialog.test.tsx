import { QueryClient } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFacilityType } from '@/features/facility-types/api/api';
import { FacilityTypeFormDialog } from '@/features/facility-types/components/facility-type-form-dialog';
import { fetchFacilityTypes } from '@/features/reference-data/api/api';
import { facilityTypesOptions } from '@/features/reference-data/api/queries';
import { httpError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/facility-types/api/api', () => ({
  createFacilityType: vi.fn(),
  updateFacilityType: vi.fn(),
  fetchFacilityType: vi.fn(),
  fetchFacilityTypesPage: vi.fn(),
}));

vi.mock('@/features/reference-data/api/api', () => ({
  fetchFacilityTypes: vi.fn(),
}));

const create = vi.mocked(createFacilityType);
const fetchTypes = vi.mocked(fetchFacilityTypes);

const foo = {
  id: 'ft9',
  code: 'foo',
  name: 'Foo',
  description: null,
  displayOrder: 9,
  active: true,
  primaryHealthCare: false,
};

function refusal(messageKey: string) {
  const error = httpError(400);
  Object.assign(error.response ?? {}, { data: { messageKey, message: 'In use' } });
  return error;
}

function renderAdd(cached?: (typeof foo)[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (cached) queryClient.setQueryData(facilityTypesOptions().queryKey, cached);
  renderPage(<FacilityTypeFormDialog onClose={vi.fn()} target="new" />, { queryClient });
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchTypes.mockResolvedValue([]);
});

async function fillAndCreate(name: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/facility-types.form.code/), 'store');
  await user.type(screen.getByLabelText(/facility-types.form.name/), name);
  await user.click(screen.getByRole('button', { name: 'facility-types.form.create' }));
}

describe('FacilityTypeFormDialog', () => {
  it('checks names against the types as they are now, not as they were cached', async () => {
    create.mockResolvedValueOnce({ ...foo, id: 'ft10', code: 'store' });
    renderAdd([foo]);

    await fillAndCreate('Foo');

    await vi.waitFor(() => expect(create).toHaveBeenCalled());
    expect(screen.queryByText('facility-types.form.name-taken')).not.toBeInTheDocument();
  });

  it('still saves when the list of types to check against cannot load', async () => {
    fetchTypes.mockRejectedValue(new Error('offline'));
    create.mockResolvedValueOnce({ ...foo, id: 'ft10', code: 'store' });
    renderAdd();

    await fillAndCreate('Store');

    await vi.waitFor(() => expect(create).toHaveBeenCalled());
  });

  it('shows a name the server found in use on the name field', async () => {
    const user = userEvent.setup();
    create.mockRejectedValueOnce(refusal('referenceData.error.facilityType.name.duplicated'));
    renderAdd();

    await user.type(await screen.findByLabelText(/facility-types.form.code/), 'store');
    await user.type(screen.getByLabelText(/facility-types.form.name/), 'District Store');
    await user.click(screen.getByRole('button', { name: 'facility-types.form.create' }));

    expect(await screen.findByText('facility-types.form.name-taken')).toBeInTheDocument();
    expect(screen.queryByText('facility-types.form.save-error-title')).not.toBeInTheDocument();
  });

  it('says why a save failed for any other reason', async () => {
    const user = userEvent.setup();
    create.mockRejectedValueOnce(refusal('referenceData.error.facilityType.saving.with.id'));
    renderAdd();

    await user.type(await screen.findByLabelText(/facility-types.form.code/), 'store');
    await user.type(screen.getByLabelText(/facility-types.form.name/), 'District Store');
    await user.click(screen.getByRole('button', { name: 'facility-types.form.create' }));

    expect(await screen.findByText('facility-types.form.save-error-title')).toBeInTheDocument();
    expect(screen.getByText('In use')).toBeInTheDocument();
  });
});
