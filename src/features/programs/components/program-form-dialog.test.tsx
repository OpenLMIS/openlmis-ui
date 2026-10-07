import { QueryClient } from '@tanstack/react-query';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProgram, fetchProgram } from '@/features/programs/api/api';
import { ProgramFormDialog } from '@/features/programs/components/program-form-dialog';
import { fetchPrograms } from '@/features/reference-data/api/api';
import { programsOptions } from '@/features/reference-data/api/queries';
import { userProgramsKey } from '@/lib/key-factory';
import { httpError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/programs/api/api', () => ({
  createProgram: vi.fn(),
  updateProgram: vi.fn(),
  fetchProgram: vi.fn(),
}));

vi.mock('@/features/reference-data/api/api', () => ({
  fetchPrograms: vi.fn(),
}));

const create = vi.mocked(createProgram);
const fetchList = vi.mocked(fetchPrograms);
const fetchOne = vi.mocked(fetchProgram);

const malaria = { id: 'p9', code: 'PRG009', name: 'Malaria', active: true };

function refusal(messageKey: string) {
  const error = httpError(400);
  Object.assign(error.response ?? {}, { data: { messageKey, message: 'Not saved' } });
  return error;
}

function renderAdd(cached?: (typeof malaria)[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (cached) queryClient.setQueryData(programsOptions().queryKey, cached);
  renderPage(<ProgramFormDialog onClose={vi.fn()} target="new" />, { queryClient });
  return queryClient;
}

async function fillAndCreate(code: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/programs.form.code/), code);
  await user.type(screen.getByLabelText(/programs.form.name/), 'Malaria');
  await user.click(screen.getByRole('button', { name: 'programs.form.create' }));
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchList.mockResolvedValue([]);
});

describe('ProgramFormDialog', () => {
  it('fills Edit from the program as it is now, even when reopened at once', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    fetchOne.mockResolvedValueOnce(malaria);
    renderPage(<ProgramFormDialog onClose={vi.fn()} target="p9" />, { queryClient });
    expect(await screen.findByDisplayValue('Malaria')).toBeInTheDocument();

    cleanup();
    fetchOne.mockResolvedValueOnce({ ...malaria, name: 'Malaria Control' });
    renderPage(<ProgramFormDialog onClose={vi.fn()} target="p9" />, { queryClient });

    expect(await screen.findByDisplayValue('Malaria Control')).toBeInTheDocument();
  });

  it('loads only the program, not every program, to edit one', async () => {
    fetchOne.mockResolvedValueOnce(malaria);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderPage(<ProgramFormDialog onClose={vi.fn()} target="p9" />, { queryClient });

    expect(await screen.findByDisplayValue('Malaria')).toBeInTheDocument();
    expect(fetchList).not.toHaveBeenCalled();
  });

  it('checks codes against the programs as they are now, not as they were cached', async () => {
    create.mockResolvedValueOnce(malaria);
    renderAdd([malaria]);

    await fillAndCreate('PRG009');

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(screen.queryByText('programs.form.code-taken')).not.toBeInTheDocument();
  });

  it("refreshes every user's programs after a save, so pickers show the new name", async () => {
    create.mockResolvedValueOnce(malaria);
    const queryClient = renderAdd();
    queryClient.setQueryData(userProgramsKey('u1'), [malaria]);

    await fillAndCreate('PRG009');

    await waitFor(() =>
      expect(queryClient.getQueryState(userProgramsKey('u1'))?.isInvalidated).toBe(true),
    );
  });

  it('shows a code the server found in use on the code field', async () => {
    create.mockRejectedValueOnce(refusal('referenceData.error.program.code.duplicated'));
    renderAdd();

    await fillAndCreate('PRG009');

    expect(await screen.findByText('programs.form.code-taken')).toBeInTheDocument();
    expect(screen.queryByText('programs.form.save-error-title')).not.toBeInTheDocument();
  });

  it('says why a save failed for any other reason', async () => {
    create.mockRejectedValueOnce(refusal('referenceData.error.unauthorized'));
    renderAdd();

    await fillAndCreate('PRG009');

    expect(await screen.findByText('programs.form.save-error-title')).toBeInTheDocument();
    expect(screen.getByText('Not saved')).toBeInTheDocument();
  });
});
