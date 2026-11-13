import { QueryClient } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { getI18n } from 'react-i18next';
import { toast } from 'sonner';
import { beforeEach, expect, it, vi } from 'vitest';
import {
  fetchBuqPeriods,
  fetchBuqsForFinalApproval,
  fetchSupervisedZones,
  finalApproveBuqs,
} from '@/features/buq/api/api';
import { NationalApproval } from '@/features/buq/components/national-approval';
import type { NationalSearch } from '@/features/buq/lib/search';
import type { FinalApprovalItem } from '@/features/buq/lib/types';
import { fetchFacilitiesByIds } from '@/features/reference-data/api/api';
import {
  currencySettingsOptions,
  geographicZonesOptions,
  processingSchedulesOptions,
} from '@/features/reference-data/api/queries';
import { httpError } from '@/test-utils/http-error';
import { renderPage } from '@/test-utils/render-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn() } }));

vi.mock('@/features/reference-data/api/api', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchFacilitiesByIds: vi.fn(),
}));

vi.mock('@/features/buq/api/api', () => ({
  fetchBuqPeriods: vi.fn(),
  fetchBuqsForFinalApproval: vi.fn(),
  fetchSupervisedZones: vi.fn(),
  finalApproveBuqs: vi.fn(),
}));

const zone = (id: string, name: string, level: string) => ({
  id,
  code: id,
  name,
  level: { name: level },
});

const item = (id: string, facilityId: string): FinalApprovalItem => ({
  bottomUpQuantification: {
    id,
    facilityId,
    programId: 'g1',
    processingPeriodId: 'p17',
    targetYear: 2018,
    status: 'APPROVED',
  },
  calculatedGroupsCosts: { Pharmaceuticals: '10.00 USD', Others: '5.00 USD' },
});

const ITEMS = Array.from({ length: 12 }, (_, index) => item(`b${index}`, `f${index}`));
const FACILITIES = ITEMS.map(({ bottomUpQuantification: { facilityId } }, index) => ({
  id: facilityId,
  code: facilityId,
  name: `Facility ${index}`,
  active: true,
  enabled: true,
  type: { id: 't1', code: 'health_center', name: 'Health Center' },
  geographicZone: zone('cu', 'Cuamba', 'District'),
}));

const rowBox = (index: number) =>
  screen.findAllByRole('checkbox', { name: /buq\.national\.row/ }).then((boxes) => boxes[index]);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchSupervisedZones).mockResolvedValue({ mz: { ni: { cu: [] } } });
  vi.mocked(fetchBuqPeriods).mockResolvedValue([
    { id: 'p16', name: 'July 2016 - June 2017', startDate: '2016-07-01', endDate: '2017-06-30' },
    { id: 'p17', name: 'July 2017 - June 2018', startDate: '2017-07-01', endDate: '2018-06-30' },
  ]);
  vi.mocked(fetchBuqsForFinalApproval).mockResolvedValue(ITEMS);
  vi.mocked(fetchFacilitiesByIds).mockResolvedValue(FACILITIES);
});

let searchFor: (search: NationalSearch) => void = () => {};

function StatefulNational({ start }: { start: NationalSearch }) {
  const [search, setSearch] = useState(start);
  searchFor = setSearch;
  return (
    <NationalApproval
      selectionSlot={document.body}
      onSearchChange={setSearch}
      programId="g1"
      search={search}
    />
  );
}

function renderNational(search: NationalSearch = {}, stateful = false) {
  const onSearchChange = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(processingSchedulesOptions().queryKey, [
    { id: 's1', code: 'BUQ', name: 'BUQ' },
  ]);
  queryClient.setQueryData(geographicZonesOptions().queryKey, [
    zone('mz', 'Mozambique', 'Country'),
    zone('ni', 'Niassa', 'Region'),
    zone('cu', 'Cuamba', 'District'),
  ]);
  queryClient.setQueryData(currencySettingsOptions().queryKey, {
    currencyCode: 'USD',
    currencySymbol: '$',
    currencySymbolSide: 'left',
    currencyDecimalPlaces: 2,
    groupingSeparator: ',',
    groupingSize: 3,
    decimalSeparator: '.',
  });
  renderPage(
    stateful ? (
      <StatefulNational start={search} />
    ) : (
      <NationalApproval
        selectionSlot={document.body}
        onSearchChange={onSearchChange}
        programId="g1"
        search={search}
      />
    ),
    { queryClient },
  );
  return onSearchChange;
}

it('starts on the first group and latest period, and enables Search only with both', async () => {
  const user = userEvent.setup();
  const onSearchChange = renderNational();

  const search = await screen.findByRole('button', { name: 'facility-program.search' });
  expect(search).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'buq.national.clear-group' }));
  expect(search).toBeDisabled();
  await user.click(screen.getByRole('combobox', { name: /buq\.national\.group/ }));
  await user.click(await screen.findByRole('option', { name: /Niassa/ }));
  expect(search).toBeEnabled();
  await user.click(search);

  expect(onSearchChange).toHaveBeenCalledWith({ zone: 'ni', period: 'p17', page: undefined });
});

it('keeps Search off while the period is missing', async () => {
  const user = userEvent.setup();
  renderNational({ period: 'gone' });

  await user.click(await screen.findByRole('combobox', { name: /buq\.national\.group/ }));
  await user.click(await screen.findByRole('option', { name: /Niassa/ }));

  expect(screen.getByRole('button', { name: 'facility-program.search' })).toBeDisabled();
});

it('keeps Final Approval off until a row is picked, and Select All picks every page', async () => {
  const user = userEvent.setup();
  vi.mocked(finalApproveBuqs).mockResolvedValue({
    approved: ITEMS.map(({ bottomUpQuantification: { id } }) => id),
    error: undefined,
  });
  renderNational({ zone: 'mz', period: 'p17' });

  expect(await screen.findByRole('button', { name: 'buq.national.final-approval' })).toBeDisabled();
  await user.click(await rowBox(0));
  await user.click(screen.getByRole('button', { name: /select-all-short/ }));
  await user.click(screen.getByRole('button', { name: /final-approval-short/ }));
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'buq.national.approve',
    }),
  );

  await waitFor(() => expect(finalApproveBuqs).toHaveBeenCalledTimes(1));
  expect(vi.mocked(finalApproveBuqs).mock.calls[0]?.[0]).toHaveLength(12);
});

it('sends only the picked reports still waiting in a fresh read of the list', async () => {
  const user = userEvent.setup();
  vi.mocked(finalApproveBuqs).mockResolvedValue({ approved: ['b1'], error: undefined });
  renderNational({ zone: 'mz', period: 'p17' });

  await user.click(await rowBox(0));
  await user.click(await rowBox(1));
  vi.mocked(fetchBuqsForFinalApproval).mockResolvedValue(ITEMS.slice(1));
  await user.click(screen.getByRole('button', { name: /final-approval-short/ }));
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'buq.national.approve',
    }),
  );

  await waitFor(() => expect(finalApproveBuqs).toHaveBeenCalledWith(['b1']));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'buq.national.final-approval' })).toBeDisabled(),
  );
});

it('tells the user when every picked report had already left the list', async () => {
  const user = userEvent.setup();
  vi.mocked(finalApproveBuqs).mockResolvedValue({ approved: [], error: undefined });
  renderNational({ zone: 'mz', period: 'p17' });

  await user.click(await rowBox(0));
  vi.mocked(fetchBuqsForFinalApproval).mockResolvedValue(ITEMS.slice(1));
  await user.click(screen.getByRole('button', { name: /final-approval-short/ }));
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'buq.national.approve',
    }),
  );

  await waitFor(() => expect(toast.info).toHaveBeenCalled());
  expect(toast.success).not.toHaveBeenCalled();
  expect(finalApproveBuqs).toHaveBeenCalledWith([]);
});

it('keeps the confirmation open with the server message when approval fails', async () => {
  const user = userEvent.setup();
  vi.mocked(finalApproveBuqs).mockRejectedValue(
    httpError(400, { messageKey: 'buq.error', message: 'Approval refused by the server.' }),
  );
  renderNational({ zone: 'mz', period: 'p17' });

  await user.click(await rowBox(0));
  await user.click(screen.getByRole('button', { name: /final-approval-short/ }));
  const dialog = await screen.findByRole('alertdialog');
  await user.click(within(dialog).getByRole('button', { name: 'buq.national.approve' }));

  expect(await within(dialog).findByText('Approval refused by the server.')).toBeInTheDocument();
});

it('keeps the confirmation open and only the unapproved rows picked when a later batch fails', async () => {
  const user = userEvent.setup();
  vi.mocked(finalApproveBuqs).mockResolvedValue({
    approved: ['b0'],
    error: httpError(400, { messageKey: 'buq.error', message: 'Approval refused by the server.' }),
  });
  renderNational({ zone: 'mz', period: 'p17' });

  await user.click(await rowBox(0));
  await user.click(await rowBox(1));
  await user.click(screen.getByRole('button', { name: /final-approval-short/ }));
  const dialog = await screen.findByRole('alertdialog');
  await user.click(within(dialog).getByRole('button', { name: 'buq.national.approve' }));

  expect(
    await within(dialog).findByText('buq.national.partly-approved Approval refused by the server.'),
  ).toBeInTheDocument();
  expect(within(dialog).getByText('buq.national.partly-approved-title')).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'dialog.cancel' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(await rowBox(0)).not.toBeChecked();
  expect(await rowBox(1)).toBeChecked();
});

const approveIn = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'buq.national.approve',
    }),
  );

it('shows the totals of every listed report and each cost under its own group', async () => {
  vi.mocked(fetchBuqsForFinalApproval).mockResolvedValue([
    ...ITEMS,
    {
      ...item('b12', 'f0'),
      calculatedGroupsCosts: { 'Medical supplies': '7.00 USD', Vaccines: '1.00 USD' },
    },
  ]);
  renderNational({ zone: 'mz', period: 'p17' });

  const summary = await screen.findByRole('region', { name: 'buq.national.summary' });
  expect(within(summary).getByText('$120.00')).toBeInTheDocument();
  expect(within(summary).getByText('$7.00')).toBeInTheDocument();
  expect(within(summary).getByText('$61.00')).toBeInTheDocument();
  expect(screen.getAllByText('$10.00')).toHaveLength(10);
});

it('drops the approved reports from the list and moves focus to it', async () => {
  const user = userEvent.setup();
  vi.mocked(finalApproveBuqs).mockResolvedValue({ approved: ['b0'], error: undefined });
  renderNational({ zone: 'mz', period: 'p17' });

  await user.click(await rowBox(0));
  await user.click(screen.getByRole('button', { name: /final-approval-short/ }));
  vi.mocked(fetchBuqsForFinalApproval)
    .mockResolvedValueOnce(ITEMS)
    .mockResolvedValue(ITEMS.slice(1));
  await approveIn(user);

  await waitFor(() => expect(screen.queryByText('Facility 0')).not.toBeInTheDocument());
  await waitFor(() => expect(document.body).not.toHaveFocus());
  expect(document.activeElement).toContainElement(
    screen.getByRole('region', { name: 'buq.national.summary' }),
  );
});

it('moves focus to the list when nothing was left to approve', async () => {
  const user = userEvent.setup();
  vi.mocked(finalApproveBuqs).mockResolvedValue({ approved: [], error: undefined });
  renderNational({ zone: 'mz', period: 'p17' });

  await user.click(await rowBox(0));
  vi.mocked(fetchBuqsForFinalApproval).mockResolvedValue(ITEMS.slice(1));
  await user.click(screen.getByRole('button', { name: /final-approval-short/ }));
  await approveIn(user);

  await waitFor(() => expect(toast.info).toHaveBeenCalled());
  const summary = screen.getByRole('region', { name: 'buq.national.summary' });
  await waitFor(() => {
    expect(document.body).not.toHaveFocus();
    expect(document.activeElement).toContainElement(summary);
  });
});

it('keeps the rows on screen while the facilities of a refreshed list load', async () => {
  const user = userEvent.setup();
  vi.mocked(finalApproveBuqs).mockResolvedValue({ approved: ['b0'], error: undefined });
  renderNational({ zone: 'mz', period: 'p17' });

  await user.click(await rowBox(0));
  vi.mocked(fetchBuqsForFinalApproval).mockResolvedValue(ITEMS.slice(1));
  vi.mocked(fetchFacilitiesByIds).mockReturnValue(new Promise(() => {}));
  await user.click(screen.getByRole('button', { name: /final-approval-short/ }));
  await approveIn(user);

  await waitFor(() => expect(fetchFacilitiesByIds).toHaveBeenCalledTimes(2));
  expect(screen.getAllByRole('checkbox', { name: /buq\.national\.row/ })).not.toHaveLength(0);
  expect(screen.getByText('Facility 1')).toBeInTheDocument();
});

it('asks for Search when the picked group differs from the shown list', async () => {
  const user = userEvent.setup();
  renderNational({ zone: 'mz', period: 'p17' });

  await rowBox(0);
  await user.click(screen.getByRole('combobox', { name: /buq\.national\.group/ }));
  await user.click(await screen.findByRole('option', { name: /Niassa/ }));

  expect(await screen.findByText('buq.national.choose')).toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: /buq\.national\.row/ })).not.toBeInTheDocument();
});

it('clears the picks and closes the confirmation when another group is searched', async () => {
  const user = userEvent.setup();
  renderNational({ zone: 'ni', period: 'p17' }, true);

  await user.click(await rowBox(0));
  await user.click(screen.getByRole('button', { name: /final-approval-short/ }));
  await screen.findByRole('alertdialog');
  act(() => searchFor({ zone: 'mz', period: 'p17' }));

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  await waitFor(() => expect(fetchBuqsForFinalApproval).toHaveBeenCalledTimes(2));
  expect(await rowBox(0)).not.toBeChecked();
});

it('retries only the reports a failed batch left, and skips none of them', async () => {
  const user = userEvent.setup();
  getI18n().addResourceBundle(
    'en',
    'translation',
    {
      'buq.national.approved': '{{count}} approved',
      'buq.national.confirm-title': 'Approve {{count}}',
    },
    true,
    true,
  );
  vi.mocked(finalApproveBuqs)
    .mockResolvedValueOnce({ approved: ['b0'], error: httpError(500) })
    .mockResolvedValue({ approved: ['b1'], error: undefined });
  renderNational({ zone: 'mz', period: 'p17' });

  await user.click(await rowBox(0));
  await user.click(await rowBox(1));
  await user.click(screen.getByRole('button', { name: /final-approval-short/ }));
  await approveIn(user);
  const dialog = await screen.findByRole('alertdialog');
  expect(await within(dialog).findByText('Approve 1')).toBeInTheDocument();
  vi.mocked(fetchBuqsForFinalApproval).mockResolvedValue(ITEMS.slice(1));
  await approveIn(user);

  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith('buq.national.approved-title', {
      description: '1 approved',
    }),
  );
  expect(toast.info).not.toHaveBeenCalled();
  expect(finalApproveBuqs).toHaveBeenLastCalledWith(['b1']);
  getI18n().removeResourceBundle('en', 'translation');
  getI18n().addResourceBundle('en', 'translation', {});
});

it('shows the results after Search even when the URL went back to the same choice', async () => {
  const user = userEvent.setup();
  renderNational({ zone: 'mz', period: 'p17' }, true);

  await rowBox(0);
  await user.click(screen.getByRole('combobox', { name: /buq\.national\.group/ }));
  await user.click(await screen.findByRole('option', { name: /Niassa/ }));
  act(() => searchFor({}));
  await user.click(await screen.findByRole('button', { name: 'facility-program.search' }));

  expect(await rowBox(0)).toBeInTheDocument();
});

it('reads the list again when Search repeats the shown choice', async () => {
  const user = userEvent.setup();
  renderNational({ zone: 'mz', period: 'p17' });

  await rowBox(0);
  await user.click(screen.getByRole('button', { name: 'facility-program.search' }));

  await waitFor(() => expect(fetchBuqsForFinalApproval).toHaveBeenCalledTimes(2));
});
