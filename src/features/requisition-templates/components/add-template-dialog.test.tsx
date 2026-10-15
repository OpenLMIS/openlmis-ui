import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { facilityTypesOptions, programsOptions } from '@/features/reference-data/api/queries';
import { createRequisitionTemplate } from '@/features/requisition-templates/api/api';
import {
  availableColumnsOptions,
  requisitionTemplatesOptions,
} from '@/features/requisition-templates/api/queries';
import { AddTemplateDialog } from '@/features/requisition-templates/components/add-template-dialog';
import { queryKeys } from '@/lib/key-factory';
import { httpError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/requisition-templates/api/api', () => ({
  createRequisitionTemplate: vi.fn(),
  fetchRequisitionTemplates: vi.fn(),
  fetchAvailableColumns: vi.fn(),
}));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchPrograms: vi.fn(),
  fetchFacilityTypes: vi.fn(),
}));
vi.mock('@/features/reference-data/api/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/reference-data/api/queries')>();
  return {
    ...actual,
    programsOptions: () => ({ ...actual.programsOptions(), staleTime: Infinity }),
    facilityTypesOptions: (filter?: { active?: boolean }) => ({
      ...actual.facilityTypesOptions(filter),
      staleTime: Infinity,
    }),
  };
});
vi.mock('@/features/requisition-templates/api/queries', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/requisition-templates/api/queries')>();
  return {
    ...actual,
    requisitionTemplatesOptions: () => ({
      ...actual.requisitionTemplatesOptions(),
      staleTime: Infinity,
    }),
    availableColumnsOptions: () => ({ ...actual.availableColumnsOptions(), staleTime: Infinity }),
  };
});
const create = vi.mocked(createRequisitionTemplate);
const program = { id: 'p', code: 'P', name: 'Malaria', active: true };
const type = {
  id: 't',
  code: 'T',
  name: 'Health Center',
  active: true,
  displayOrder: 1,
  primaryHealthCare: true,
};
function renderAdd() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(programsOptions().queryKey, [program]);
  queryClient.setQueryData(facilityTypesOptions({ active: true }).queryKey, [type]);
  queryClient.setQueryData(requisitionTemplatesOptions().queryKey, []);
  queryClient.setQueryData(availableColumnsOptions().queryKey, []);
  const router = renderPage(<AddTemplateDialog onClose={vi.fn()} target="new" />, { queryClient });
  return { queryClient, router };
}
async function fillAndConfirm() {
  const user = userEvent.setup();
  await user.type(
    await screen.findByRole('textbox', { name: 'requisition-templates.form.name' }),
    'Malaria Template',
  );
  await user.click(screen.getByRole('combobox', { name: 'requisition-templates.form.program' }));
  await user.click(await screen.findByRole('option', { name: 'Malaria' }));
  await user.click(
    screen.getByRole('combobox', { name: 'requisition-templates.form.facility-type' }),
  );
  await user.click(await screen.findByRole('option', { name: 'Health Center' }));
  await user.click(
    screen.getByRole('button', { name: 'requisition-templates.form.add-facility-type' }),
  );
  await user.click(screen.getByRole('button', { name: 'requisition-templates.form.create' }));
  expect(create).not.toHaveBeenCalled();
  const confirmation = await screen.findByRole('alertdialog');
  await user.click(
    within(confirmation).getByRole('button', { name: 'requisition-templates.form.create' }),
  );
}
beforeEach(() => vi.resetAllMocks());
it('posts id references only after confirmation, refreshes templates and opens Configure', async () => {
  create.mockResolvedValue({ id: 'created' } as Awaited<
    ReturnType<typeof createRequisitionTemplate>
  >);
  const { queryClient, router } = renderAdd();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  await fillAndConfirm();
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/administration/requisition-templates/created'),
  );
  expect(create.mock.calls[0][0]).toMatchObject({
    name: 'Malaria Template',
    program: { id: 'p' },
    facilityTypes: [{ id: 't' }],
  });
  expect(create.mock.calls[0][0].program).toEqual({ id: 'p' });
  expect(create.mock.calls[0][0].facilityTypes).toEqual([{ id: 't' }]);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.requisitionTemplates.all });
});
it('puts a server duplicate name on the Name field', async () => {
  const error = httpError(400);
  Object.assign(error.response ?? {}, {
    data: {
      messageKey: 'requisition.error.validation.templateNameDuplication',
      message: 'Name taken',
    },
  });
  create.mockRejectedValue(error);
  renderAdd();
  await fillAndConfirm();
  const name = screen.getByRole('textbox', { name: 'requisition-templates.form.name' });
  await waitFor(() => expect(name).toHaveAttribute('aria-invalid', 'true'));
  expect(name).toHaveAccessibleDescription('requisition-templates.form.name-taken');
  expect(screen.queryByText('requisition-templates.form.save-error-title')).not.toBeInTheDocument();
});

it('describes the missing facility types error on the picker', async () => {
  const user = userEvent.setup();
  renderAdd();
  await user.type(
    await screen.findByRole('textbox', { name: 'requisition-templates.form.name' }),
    'New template',
  );
  await user.click(screen.getByRole('combobox', { name: 'requisition-templates.form.program' }));
  await user.click(await screen.findByRole('option', { name: 'Malaria' }));
  await user.click(screen.getByRole('button', { name: 'requisition-templates.form.create' }));
  const picker = screen.getByRole('combobox', { name: 'requisition-templates.form.facility-type' });
  await waitFor(() => expect(picker).toHaveAttribute('aria-invalid', 'true'));
  expect(picker).toHaveAccessibleDescription('requisition-templates.form.facility-types-required');
  expect(create).not.toHaveBeenCalled();
});
