import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, expect, it, vi } from 'vitest';
import {
  BuqMovedError,
  deleteBuq,
  downloadBuq,
  fetchBuqPeriods,
  fetchPreparedBuqs,
  fetchTakenPeriods,
  prepareBuq,
} from '@/features/buq/api/api';
import { PrepareBuq } from '@/features/buq/components/prepare-buq';
import type { BuqListSearch } from '@/features/buq/lib/search';
import type { Buq } from '@/features/buq/lib/types';
import { processingSchedulesOptions } from '@/features/reference-data/api/queries';
import { downloadFile } from '@/lib/download-file';
import { httpError } from '@/test-utils/http-error';
import { renderPage } from '@/test-utils/render-page';

vi.mock('@/features/buq/api/api', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchPreparedBuqs: vi.fn(),
  fetchTakenPeriods: vi.fn(),
  fetchBuqPeriods: vi.fn(),
  prepareBuq: vi.fn(),
  deleteBuq: vi.fn(),
  downloadBuq: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/lib/download-file', () => ({ downloadFile: vi.fn() }));

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
  vi.mocked(fetchTakenPeriods).mockResolvedValue([]);
});

const MONTHLY = { id: 's0', code: 'SCH001', name: 'Monthly' };
const BUQ_SCHEDULE = { id: 's1', code: 'BUQ', name: 'BUQ' };

function renderPrepare(search: BuqListSearch = {}, schedules = [BUQ_SCHEDULE]) {
  const onSearchChange = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(processingSchedulesOptions().queryKey, schedules);
  renderPage(
    <PrepareBuq
      facility={{ id: 'f1', name: 'Cuamba' }}
      onSearchChange={onSearchChange}
      program={{ id: 'g1', name: 'BUQ' }}
      search={search}
    />,
    { queryClient },
  );
  return onSearchChange;
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

  expect(await screen.findByText('buq.empty')).toBeInTheDocument();
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
  expect(screen.getByRole('combobox', { name: 'buq.prepare.select-period' })).toHaveFocus();
});

it('marks a period prepared whatever the status of its forecast', async () => {
  const user = userEvent.setup();
  vi.mocked(fetchPreparedBuqs).mockResolvedValue([]);
  vi.mocked(fetchTakenPeriods).mockResolvedValue([{ id: 'b-a', processingPeriodId: 'p16' }]);
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
  await waitFor(() => expect(fetchTakenPeriods).toHaveBeenCalledTimes(2));
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
  expect(await screen.findByText('buq.empty')).toBeInTheDocument();
});

it('returns to the last page that still has forecasts', async () => {
  vi.mocked(fetchPreparedBuqs).mockResolvedValue([
    prepared('p16', 2017),
    prepared('p17', 2018),
    prepared('p18', 2019),
  ]);
  const onSearchChange = renderPrepare({ page: 5, size: 1 });

  await waitFor(() => expect(onSearchChange).toHaveBeenCalledWith({ page: 3 }, true));
});

it('shows only the forecasts of the current page, in target year order', async () => {
  vi.mocked(fetchPreparedBuqs).mockResolvedValue([prepared('p17', 2018), prepared('p16', 2017)]);
  renderPrepare({ page: 2, size: 1 });

  expect(await screen.findByText('July 2017 - June 2018')).toBeInTheDocument();
  expect(screen.queryByText('July 2016 - June 2017')).toBeNull();
});

it('keeps the delete confirmation open until the list no longer shows the report', async () => {
  const user = userEvent.setup();
  let refreshed: (buqs: Buq[]) => void = () => {};
  vi.mocked(fetchPreparedBuqs)
    .mockResolvedValueOnce([prepared('p16', 2017)])
    .mockReturnValueOnce(
      new Promise((resolve) => {
        refreshed = resolve;
      }),
    );
  vi.mocked(deleteBuq).mockResolvedValue(undefined);
  renderPrepare();

  await user.click(await screen.findByRole('button', { name: 'buq.prepare.delete' }));
  const dialog = await screen.findByRole('alertdialog');
  await user.click(within(dialog).getByRole('button', { name: 'buq.prepare.delete' }));
  await waitFor(() => expect(fetchPreparedBuqs).toHaveBeenCalledTimes(2));

  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  refreshed([]);
  expect(await screen.findByText('buq.empty')).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
});

it('keeps the period picker working when only the report list fails', async () => {
  vi.mocked(fetchPreparedBuqs).mockRejectedValue(new Error('list failed'));
  renderPrepare();

  expect(await screen.findByText('buq.list-error-title')).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'buq.prepare.select-period' })).not.toHaveAttribute(
      'data-disabled',
    ),
  );
  expect(screen.queryByText('buq.prepare.periods-error')).toBeNull();
});

const picker = () => screen.getByRole('combobox', { name: 'buq.prepare.select-period' });

it('asks only for the periods of the BUQ schedule', async () => {
  vi.mocked(fetchPreparedBuqs).mockResolvedValue([]);
  renderPrepare({}, [MONTHLY, BUQ_SCHEDULE]);

  await waitFor(() => expect(picker()).not.toHaveAttribute('data-disabled'));
  expect(fetchBuqPeriods).toHaveBeenCalledWith('s1');
});

it('offers no periods without a BUQ schedule', async () => {
  vi.mocked(fetchPreparedBuqs).mockResolvedValue([prepared('p16', 2017)]);
  renderPrepare({}, [MONTHLY]);

  await waitFor(() => expect(picker()).not.toHaveAttribute('data-disabled'));
  expect(fetchBuqPeriods).not.toHaveBeenCalled();
  expect(await screen.findAllByText('2017')).toHaveLength(2);
});

it('keeps the period picker disabled until the prepared periods are known', async () => {
  vi.mocked(fetchPreparedBuqs).mockResolvedValue([]);
  vi.mocked(fetchTakenPeriods).mockRejectedValue(new Error('taken failed'));
  renderPrepare();

  expect(await screen.findByText('buq.empty')).toBeInTheDocument();
  await waitFor(() => expect(fetchTakenPeriods).toHaveBeenCalled());
  expect(picker()).toHaveAttribute('data-disabled');
});

it('warns when the prepared report has no products', async () => {
  const user = userEvent.setup();
  vi.mocked(fetchPreparedBuqs).mockResolvedValue([]);
  vi.mocked(prepareBuq).mockResolvedValue({
    ...prepared('p17', 2018),
    bottomUpQuantificationLineItems: [],
  });
  renderPrepare();

  await choosePeriod(user, 'July 2017 - June 2018');
  await user.click(screen.getByRole('button', { name: 'buq.prepare.prepare' }));

  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith('buq.prepare.prepared-title', {
      description: 'buq.prepare.prepared-empty',
    }),
  );
});

it('downloads the chosen forecast as the legacy CSV file', async () => {
  const user = userEvent.setup();
  const csv = new Blob(['csv']);
  vi.mocked(fetchPreparedBuqs).mockResolvedValue([prepared('p16', 2017), prepared('p17', 2018)]);
  vi.mocked(downloadBuq).mockResolvedValue(csv);
  renderPrepare();

  await screen.findByText('July 2017 - June 2018');
  const cards = screen.getAllByRole('listitem');
  await user.click(within(cards[1]).getByRole('button', { name: 'buq.prepare.download' }));

  await waitFor(() =>
    expect(downloadFile).toHaveBeenCalledWith(csv, 'buq_quantification_preparation_report.csv'),
  );
  expect(downloadBuq).toHaveBeenCalledWith('b-p17', expect.anything());
});

it('deletes the forecast of the chosen row and moves focus to the list', async () => {
  const user = userEvent.setup();
  vi.mocked(fetchPreparedBuqs)
    .mockResolvedValueOnce([prepared('p16', 2017), prepared('p17', 2018)])
    .mockResolvedValue([prepared('p16', 2017)]);
  vi.mocked(deleteBuq).mockResolvedValue(undefined);
  renderPrepare();

  await screen.findByText('July 2017 - June 2018');
  const cards = screen.getAllByRole('listitem');
  await user.click(within(cards[1]).getByRole('button', { name: 'buq.prepare.delete' }));
  const dialog = await screen.findByRole('alertdialog');
  await user.click(within(dialog).getByRole('button', { name: 'buq.prepare.delete' }));

  await waitFor(() => expect(deleteBuq).toHaveBeenCalledWith('b-p17', expect.anything()));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  await waitFor(() => {
    expect(document.body).not.toHaveFocus();
    expect(screen.getByRole('region', { name: 'buq.prepare.report-list' })).toHaveFocus();
  });
});

it('refuses to delete a report that has moved on in the approval process', async () => {
  const user = userEvent.setup();
  vi.mocked(fetchPreparedBuqs).mockResolvedValue([prepared('p16', 2017)]);
  vi.mocked(deleteBuq).mockRejectedValue(new BuqMovedError());
  renderPrepare();

  await user.click(await screen.findByRole('button', { name: 'buq.prepare.delete' }));
  const dialog = await screen.findByRole('alertdialog');
  await user.click(within(dialog).getByRole('button', { name: 'buq.prepare.delete' }));

  expect(await within(dialog).findByText('buq.prepare.delete-moved')).toBeInTheDocument();
});

it('locks the period input while a report is being prepared', async () => {
  const user = userEvent.setup();
  vi.mocked(fetchPreparedBuqs).mockResolvedValue([]);
  vi.mocked(prepareBuq).mockReturnValue(new Promise(() => {}));
  renderPrepare();

  await choosePeriod(user, 'July 2017 - June 2018');
  await user.click(screen.getByRole('button', { name: 'buq.prepare.prepare' }));

  await waitFor(() => expect(picker()).toBeDisabled());
});
