import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { deleteBuq, fetchBuqPeriods, fetchPreparedBuqs, prepareBuq } from '@/features/buq/api/api';
import { PrepareBuq } from '@/features/buq/components/prepare-buq';
import type { Buq } from '@/features/buq/lib/types';
import { processingSchedulesOptions } from '@/features/reference-data/api/queries';
import { httpError } from '@/test-utils/http-error';
import { renderPage } from '@/test-utils/render-page';

vi.mock('@/features/buq/api/api', () => ({
  fetchPreparedBuqs: vi.fn(),
  fetchBuqPeriods: vi.fn(),
  prepareBuq: vi.fn(),
  deleteBuq: vi.fn(),
  downloadBuq: vi.fn(),
}));

const PERIODS = [
  { id: 'p16', name: 'July 2016 - June 2017', startDate: '2016-07-01', endDate: '2017-06-30' },
  { id: 'p17', name: 'July 2017 - June 2018', startDate: '2017-07-01', endDate: '2018-06-30' },
];

const prepared = (period: string, targetYear: number): Buq => ({
  id: `b-${period}`,
  facilityId: 'f1',
  programId: 'g1',
  processingPeriodId: period,
  targetYear,
  status: 'DRAFT',
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchBuqPeriods).mockResolvedValue(PERIODS);
});

function renderPrepare() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(processingSchedulesOptions().queryKey, [
    { id: 's1', code: 'BUQ', name: 'BUQ' },
  ]);
  renderPage(
    <PrepareBuq
      facility={{ id: 'f1', name: 'Cuamba' }}
      onSearchChange={vi.fn()}
      program={{ id: 'g1', name: 'BUQ' }}
      search={{}}
    />,
    { queryClient },
  );
}

const openPeriods = async (user: ReturnType<typeof userEvent.setup>) => {
  const picker = () => screen.getByRole('combobox', { name: 'buq.prepare.select-period' });
  await waitFor(() => expect(picker()).not.toHaveAttribute('data-disabled'));
  await user.click(picker());
};

const choosePeriod = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await openPeriods(user);
  await user.click(await screen.findByRole('option', { name }));
};

it('prepares a forecast for the home facility and BUQ program once a period is chosen', async () => {
  const user = userEvent.setup();
  vi.mocked(fetchPreparedBuqs)
    .mockResolvedValueOnce([])
    .mockResolvedValue([prepared('p17', 2018)]);
  vi.mocked(prepareBuq).mockResolvedValue(prepared('p17', 2018));
  renderPrepare();

  expect(await screen.findByText('buq.prepare.empty')).toBeInTheDocument();
  const prepare = screen.getByRole('button', { name: 'buq.prepare.prepare' });
  expect(prepare).toBeDisabled();
  await choosePeriod(user, 'July 2017 - June 2018');
  await user.click(prepare);

  await waitFor(() =>
    expect(prepareBuq).toHaveBeenCalledWith(
      { facilityId: 'f1', programId: 'g1', processingPeriodId: 'p17' },
      expect.anything(),
    ),
  );
  const card = await screen.findByRole('listitem');
  expect(within(card).getByText('July 2017 - June 2018')).toBeInTheDocument();
  expect(within(card).getByText('2018')).toBeInTheDocument();
  expect(within(card).getByText('Cuamba')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'buq.prepare.prepare' })).toBeDisabled();
});

it('offers a period whose forecast is listed as already prepared', async () => {
  const user = userEvent.setup();
  vi.mocked(fetchPreparedBuqs).mockResolvedValue([prepared('p16', 2017)]);
  renderPrepare();

  await openPeriods(user);

  expect(await screen.findByRole('option', { name: /July 2016 - June 2017/ })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  expect(screen.getByRole('option', { name: 'July 2017 - June 2018' })).not.toHaveAttribute(
    'aria-disabled',
    'true',
  );
});

it('shows the server refusal and keeps the chosen period', async () => {
  const user = userEvent.setup();
  vi.mocked(fetchPreparedBuqs).mockResolvedValue([]);
  vi.mocked(prepareBuq).mockRejectedValue(
    httpError(400, {
      messageKey: 'buq.error.periodAndFacilityUnique',
      message: 'Selected period is already prepared',
    }),
  );
  renderPrepare();

  await choosePeriod(user, 'July 2016 - June 2017');
  await user.click(screen.getByRole('button', { name: 'buq.prepare.prepare' }));

  expect(await screen.findByText('Selected period is already prepared')).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'buq.prepare.select-period' })).toHaveValue(
    'July 2016 - June 2017',
  );
});

it('deletes a forecast only after confirmation', async () => {
  const user = userEvent.setup();
  vi.mocked(fetchPreparedBuqs)
    .mockResolvedValueOnce([prepared('p16', 2017)])
    .mockResolvedValue([]);
  vi.mocked(deleteBuq).mockResolvedValue(undefined);
  renderPrepare();

  await user.click(await screen.findByRole('button', { name: 'buq.prepare.delete' }));
  const dialog = await screen.findByRole('alertdialog');
  expect(deleteBuq).not.toHaveBeenCalled();
  await user.click(within(dialog).getByRole('button', { name: 'buq.prepare.delete' }));

  await waitFor(() => expect(deleteBuq).toHaveBeenCalledWith('b-p16', expect.anything()));
  expect(await screen.findByText('buq.prepare.empty')).toBeInTheDocument();
});
