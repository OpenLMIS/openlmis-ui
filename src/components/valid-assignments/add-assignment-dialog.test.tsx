import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddAssignmentDialog } from '@/components/valid-assignments/add-assignment-dialog';
import type { AssignmentsApi } from '@/components/valid-assignments/types';
import {
  fetchFacilityTypes,
  fetchGeographicLevels,
  fetchMinimalFacilities,
  fetchOrganizations,
  fetchPrograms,
} from '@/features/reference-data/api/api';
import { httpError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/reference-data/api/api', () => ({
  fetchPrograms: vi.fn(),
  fetchFacilityTypes: vi.fn(),
  fetchMinimalFacilities: vi.fn(),
  fetchOrganizations: vi.fn(),
  fetchGeographicLevels: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn() } }));

const create = vi.fn();
const api: AssignmentsApi = {
  kind: 'destinations',
  queryKey: ['validDestinations'],
  fetchList: vi.fn(),
  create,
  remove: vi.fn(),
};

const saved = {
  id: 'a1',
  programId: 'p1',
  facilityTypeId: 't1',
  node: { id: 'n1', referenceId: 'f1', refDataFacility: true },
  name: 'Comfort Health Clinic',
  geoLevelAffinityId: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchPrograms).mockResolvedValue([
    { id: 'p1', code: 'PRG001', name: 'EPI', active: true },
  ]);
  vi.mocked(fetchFacilityTypes).mockResolvedValue([
    {
      id: 't1',
      code: 'health_center',
      name: 'Health Center',
      displayOrder: 1,
      active: true,
      primaryHealthCare: true,
    },
  ]);
  vi.mocked(fetchMinimalFacilities).mockResolvedValue([
    { id: 'f1', code: 'HC01', name: 'Comfort Health Clinic', active: true },
  ]);
  vi.mocked(fetchOrganizations).mockResolvedValue([{ id: 'o1', name: 'NGO' }]);
  vi.mocked(fetchGeographicLevels).mockResolvedValue([
    { id: 'l3', code: 'District', name: 'District', levelNumber: 3 },
  ]);
});

async function pickProgramAndType() {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('combobox', { name: /valid-assignments.program/ }, { timeout: 10_000 }),
  );
  await user.click(await screen.findByRole('option', { name: 'EPI' }));
  await user.click(screen.getByRole('combobox', { name: /valid-assignments.facility-type/ }));
  await user.click(await screen.findByRole('option', { name: 'Health Center' }));
  return user;
}

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'valid-assignments.form.create' }));

describe('AddAssignmentDialog', { timeout: 20_000 }, () => {
  it('asks for the program, the facility type and the facility before sending anything', async () => {
    renderPage(<AddAssignmentDialog api={api} canPickOrganizations onClose={vi.fn()} open />);
    const user = userEvent.setup();

    await screen.findByRole('combobox', { name: /valid-assignments.program/ }, { timeout: 10_000 });
    await submit(user);

    expect(
      await screen.findByText('valid-assignments.form.program-required', {}, { timeout: 5000 }),
    ).toBeVisible();
    expect(screen.getByText('valid-assignments.form.facility-type-required')).toBeVisible();
    expect(screen.getByText('valid-assignments.form.facility-required')).toBeVisible();
    expect(create).not.toHaveBeenCalled();
  });

  it('adds a facility, says so and closes', async () => {
    const onClose = vi.fn();
    create.mockResolvedValueOnce({ assignment: saved, created: true });
    renderPage(<AddAssignmentDialog api={api} canPickOrganizations onClose={onClose} open />);

    const user = await pickProgramAndType();
    await user.type(
      screen.getByRole('combobox', { name: /^valid-assignments.facility(?!-)/ }),
      'Comfort',
    );
    await user.click(
      await screen.findByRole('option', { name: /Comfort Health Clinic/ }, { timeout: 5000 }),
    );
    await submit(user);

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 5000 });
    expect(create).toHaveBeenCalledWith({
      programId: 'p1',
      facilityTypeId: 't1',
      node: { referenceId: 'f1' },
    });
    expect(toast.success).toHaveBeenCalledWith('valid-assignments.form.created-title', {
      description: 'valid-assignments.form.created',
    });
  });

  it('switches to an organization and sends it as the node', async () => {
    create.mockResolvedValueOnce({ assignment: saved, created: true });
    renderPage(<AddAssignmentDialog api={api} canPickOrganizations onClose={vi.fn()} open />);

    const user = await pickProgramAndType();
    await user.click(screen.getByRole('radio', { name: /valid-assignments.organization/ }));
    await user.click(
      await screen.findByRole(
        'combobox',
        { name: /valid-assignments.organization/ },
        { timeout: 5000 },
      ),
    );
    await user.click(await screen.findByRole('option', { name: 'NGO' }));
    await submit(user);

    await vi.waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        programId: 'p1',
        facilityTypeId: 't1',
        node: { referenceId: 'o1' },
      }),
    );
  });

  it('offers no organizations to a user who may not list them', async () => {
    renderPage(
      <AddAssignmentDialog api={api} canPickOrganizations={false} onClose={vi.fn()} open />,
    );

    await screen.findByRole('combobox', { name: /valid-assignments.program/ }, { timeout: 10_000 });
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(fetchOrganizations).not.toHaveBeenCalled();
  });

  it('says when the server already had it, rather than that it was added', async () => {
    create.mockResolvedValueOnce({ assignment: saved, created: false });
    renderPage(<AddAssignmentDialog api={api} canPickOrganizations onClose={vi.fn()} open />);

    const user = await pickProgramAndType();
    await user.type(
      screen.getByRole('combobox', { name: /^valid-assignments.facility(?!-)/ }),
      'Comfort',
    );
    await user.click(
      await screen.findByRole('option', { name: /Comfort Health Clinic/ }, { timeout: 5000 }),
    );
    await submit(user);

    await vi.waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith('valid-assignments.form.exists-title', {
        description: 'valid-assignments.form.exists',
      }),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('shows the server message when it refuses, and stays open', async () => {
    const onClose = vi.fn();
    create.mockRejectedValueOnce(
      httpError(400, { message: 'Program with ID p1 can not be found' }),
    );
    renderPage(<AddAssignmentDialog api={api} canPickOrganizations onClose={onClose} open />);

    const user = await pickProgramAndType();
    await user.type(
      screen.getByRole('combobox', { name: /^valid-assignments.facility(?!-)/ }),
      'Comfort',
    );
    await user.click(
      await screen.findByRole('option', { name: /Comfort Health Clinic/ }, { timeout: 5000 }),
    );
    await submit(user);

    expect(await screen.findByText('Program with ID p1 can not be found')).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });
});
