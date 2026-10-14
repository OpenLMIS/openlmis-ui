import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDateValue } from '@/components/form/date-value';
import { createProcessingPeriod, fetchLatestPeriod } from '@/features/processing-schedules/api/api';
import { scheduleDetailOptions } from '@/features/processing-schedules/api/queries';
import { PeriodFormDialog } from '@/features/processing-schedules/components/period-form-dialog';
import { httpError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/processing-schedules/api/api', () => ({
  createProcessingPeriod: vi.fn(),
  fetchLatestPeriod: vi.fn(),
  fetchProcessingSchedule: vi.fn(),
  fetchProcessingPeriodsPage: vi.fn(),
  fetchProcessingSchedulesPage: vi.fn(),
}));

const schedule = { id: 's1', code: 'M', name: 'Monthly' };
const period = {
  id: 'p1',
  name: 'January',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  processingSchedule: schedule,
};
const latest = { content: [period], totalElements: 1, totalPages: 1, number: 0, size: 1 };

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryDefaults(scheduleDetailOptions(schedule.id).queryKey, {
    staleTime: Infinity,
  });
  queryClient.setQueryData(scheduleDetailOptions(schedule.id).queryKey, schedule);
  const onAdded = vi.fn();
  const onClose = vi.fn();
  renderPage(
    <PeriodFormDialog scheduleId={schedule.id} target="new" onAdded={onAdded} onClose={onClose} />,
    { queryClient },
  );
  return { onAdded, onClose };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchLatestPeriod).mockResolvedValue(latest);
});

describe('PeriodFormDialog', () => {
  it('prefills and locks the start from the latest period', async () => {
    renderDialog();
    const start = await screen.findByRole('button', {
      name: /processing-schedules.periods.start-date/,
    });
    expect(start).toBeDisabled();
    expect(start).toHaveTextContent(formatDateValue('2026-02-01', 'en'));
    expect(fetchLatestPeriod).toHaveBeenCalledWith(schedule.id);
  });

  it('keeps the first start empty and editable with its guidance', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchLatestPeriod).mockResolvedValue({ ...latest, content: [], totalElements: 0 });
    renderDialog();
    const start = await screen.findByRole('button', {
      name: /processing-schedules.periods.start-date/,
    });
    expect(start).toBeEnabled();
    expect(start).toHaveTextContent('processing-schedules.period-form.pick-date');
    expect(start).toHaveAccessibleDescription('processing-schedules.periods.start-hint');
    await user.click(start);
    const calendar = await screen.findByRole('dialog', {
      name: /processing-schedules.periods.start-date/,
    });
    await user.click(
      (await within(calendar).findAllByRole('button', { name: /Today/ }))[0] as HTMLElement,
    );
    expect(start).toHaveTextContent(formatDateValue(new Date().toLocaleDateString('sv-SE'), 'en'));
  });

  it('keeps a refused draft, shows the server reason and refreshes its locked start', async () => {
    const user = userEvent.setup();
    vi.mocked(createProcessingPeriod).mockRejectedValue(
      httpError(400, {
        message: 'Start date should be one day after last added end date',
      }),
    );
    const { onAdded, onClose } = renderDialog();
    await user.type(await screen.findByLabelText(/processing-schedules.periods.name/), 'February');
    await user.type(
      screen.getByLabelText(/processing-schedules.periods.description/),
      'Keep this draft',
    );
    await user.click(
      screen.getByRole('switch', { name: /processing-schedules.periods.report-only/ }),
    );
    await user.click(screen.getByRole('button', { name: /processing-schedules.periods.end-date/ }));
    const calendar = await screen.findByRole('dialog', {
      name: /processing-schedules.periods.end-date/,
    });
    await user.click(await within(calendar).findByRole('button', { name: /February 28th, 2026/ }));
    vi.mocked(fetchLatestPeriod).mockResolvedValue({
      ...latest,
      content: [{ ...period, endDate: '2026-02-10' }],
      totalElements: 2,
    });
    await user.click(screen.getByRole('button', { name: 'processing-schedules.period-form.add' }));
    expect(
      await screen.findByText('Start date should be one day after last added end date'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /processing-schedules.periods.start-date/ }),
      ).toHaveTextContent(formatDateValue('2026-02-11', 'en')),
    );
    expect(screen.getByDisplayValue('February')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Keep this draft')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /processing-schedules.periods.end-date/ }),
    ).toHaveTextContent(formatDateValue('2026-02-28', 'en'));
    expect(
      screen.getByRole('switch', { name: /processing-schedules.periods.report-only/ }),
    ).toBeChecked();
    expect(createProcessingPeriod).toHaveBeenCalledWith({
      processingSchedule: schedule,
      name: 'February',
      description: 'Keep this draft',
      startDate: '2026-02-01',
      endDate: '2026-02-28',
      extraData: { reportOnly: true },
    });
    expect(onAdded).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('finishes a saved add even when the refreshed count cannot load', async () => {
    const user = userEvent.setup();
    vi.mocked(createProcessingPeriod).mockResolvedValue({
      ...period,
      id: 'p2',
      name: 'February',
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    });
    const { onAdded } = renderDialog();
    await user.type(await screen.findByLabelText(/processing-schedules.periods.name/), 'February');
    await user.click(screen.getByRole('button', { name: /processing-schedules.periods.end-date/ }));
    const calendar = await screen.findByRole('dialog', {
      name: /processing-schedules.periods.end-date/,
    });
    await user.click(await within(calendar).findByRole('button', { name: /February 28th, 2026/ }));
    vi.mocked(fetchLatestPeriod).mockRejectedValue(httpError(503, {}));
    await user.click(screen.getByRole('button', { name: 'processing-schedules.period-form.add' }));
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith(2));
  });
});
