import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import {
  approveBuqForecast,
  authorizeBuqForecast,
  fetchBuqForecast,
  rejectBuqForecast,
  saveBuqForecast,
  submitBuqForecast,
} from '@/features/buq/api/api';
import { ForecastForm } from '@/features/buq/components/forecast-editor';
import type { ProductInfo } from '@/features/buq/lib/forecast';
import type { ForecastMode } from '@/features/buq/lib/forecast-actions';
import type { ForecastSearch } from '@/features/buq/lib/search';
import type { BuqForecast, BuqLineItem } from '@/features/buq/lib/types';
import { rejectionReasonsOptions } from '@/features/reference-data/api/queries';
import { httpError } from '@/test-utils/http-error';
import { renderPage } from '@/test-utils/render-page';

vi.mock('@/features/buq/api/api', () => ({
  BuqMovedError: class extends Error {},
  fetchBuqForecast: vi.fn(),
  saveBuqForecast: vi.fn(),
  submitBuqForecast: vi.fn(),
  authorizeBuqForecast: vi.fn(),
  approveBuqForecast: vi.fn(),
  rejectBuqForecast: vi.fn(),
}));

const NAMES = 'ABCDEFGHIJKL'.split('').map((letter) => `Product ${letter}`);

const line = (index: number, overrides: Partial<BuqLineItem> = {}): BuqLineItem => ({
  id: `l${index}`,
  orderableId: `o${index}`,
  annualAdjustedConsumption: 10,
  verifiedAnnualAdjustedConsumption: null,
  forecastedDemand: null,
  totalCost: null,
  remark: null,
  ...overrides,
});

const FORECAST: BuqForecast = {
  id: 'b1',
  facilityId: 'f1',
  programId: 'g1',
  processingPeriodId: 'p1',
  targetYear: 2018,
  status: 'DRAFT',
  bottomUpQuantificationLineItems: NAMES.map((_, index) =>
    index === 11
      ? line(index, { verifiedAnnualAdjustedConsumption: 5, forecastedDemand: 7 })
      : line(index),
  ),
  fundingDetails: {
    sourcesOfFunds: [
      {
        sourceOfFund: { id: 's1', name: 'User fee' },
        amountUsedInLastFinancialYear: 1,
        projectedFund: 2,
      },
    ],
  },
};

const PRODUCTS: Record<string, ProductInfo> = Object.fromEntries(
  NAMES.map((name, index) => [
    `l${index}`,
    { consumption: 10, code: `C${index}`, name, unit: 'each', price: 1, category: 'Vaccines' },
  ]),
);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchBuqForecast).mockResolvedValue(FORECAST);
});

const AUTHORIZED: BuqForecast = {
  ...FORECAST,
  status: 'AUTHORIZED',
  bottomUpQuantificationLineItems: NAMES.map((_, index) =>
    line(index, { verifiedAnnualAdjustedConsumption: 10, forecastedDemand: 10, totalCost: 10 }),
  ),
};

const CREATE: ForecastMode = {
  kind: 'create',
  rights: { create: true, authorize: false },
  skipAuthorization: false,
};

function Harness({
  forecast = FORECAST,
  mode = CREATE,
  onDone = vi.fn(),
}: {
  forecast?: BuqForecast;
  mode?: ForecastMode;
  onDone?: () => void;
}) {
  const [search, setSearch] = useState<ForecastSearch>({});
  return (
    <ForecastForm
      currency={{
        currencyCode: 'USD',
        currencySymbol: '$',
        currencySymbolSide: 'left',
        currencyDecimalPlaces: 2,
        groupingSize: 3,
        groupingSeparator: ',',
        decimalSeparator: '.',
      }}
      details={{
        region: 'Niassa',
        council: 'Cuamba',
        facilityType: 'Health Center',
        facilityCode: 'N003',
        facilityName: 'Cuamba, Cuamba',
        period: 'July 2017 - June 2018',
      }}
      forecast={forecast}
      header={null}
      onCloseDialog={() => setSearch((previous) => ({ ...previous, dialog: undefined }))}
      mode={mode}
      onDone={onDone}
      onOpenDialog={(dialog) => setSearch((previous) => ({ ...previous, dialog }))}
      onSearchChange={(update) =>
        setSearch((previous) => ({
          ...previous,
          ...(typeof update === 'function' ? update(previous) : update),
        }))
      }
      products={PRODUCTS}
      remarks={[{ id: 'r1', name: 'Outbreaks' }]}
      search={search}
      sources={[]}
    />
  );
}

const renderEditor = async (props: Parameters<typeof Harness>[0] = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  const category = { id: 'c1', code: 'BUQ', name: 'BUQ', active: true };
  queryClient.setQueryData(rejectionReasonsOptions().queryKey, [
    {
      id: 'x1',
      code: 'x1',
      name: 'Wrong quantities',
      active: true,
      rejectionReasonCategory: category,
    },
  ]);
  renderPage(<Harness {...props} />, { queryClient });
  await screen.findByText('Product A');
};

const card = (name: string) => {
  const item = screen.getByText(name).closest('li');
  if (!item) throw new Error(`No card for ${name}`);
  return within(item);
};

const verified = (name: string) =>
  card(name).getByRole('textbox', { name: 'buq.forecast.verified' });

it('keeps an edit on page 1 after moving to page 2 and back', async () => {
  const user = userEvent.setup();
  await renderEditor();

  await user.clear(verified('Product A'));
  await user.type(verified('Product A'), '30');
  await user.click(screen.getByRole('button', { name: 'Page 2' }));
  expect(await screen.findByText('Product L')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Page 1' }));

  expect(verified('Product A')).toHaveValue('30');
  expect(card('Product A').getByRole('textbox', { name: 'buq.forecast.forecasted' })).toHaveValue(
    '30',
  );
});

it('refuses Submit for an untouched invalid line on another page and marks that page', async () => {
  const user = userEvent.setup();
  await renderEditor();

  await user.click(screen.getByRole('button', { name: 'buq.forecast.submit' }));

  const dialog = await screen.findByRole('alertdialog');
  expect(dialog).toHaveTextContent('buq.forecast.invalid-title');
  expect(submitBuqForecast).not.toHaveBeenCalled();
  await user.click(within(dialog).getByRole('button', { name: 'dialog.close' }));

  expect(
    await screen.findByRole('button', { name: 'Page 2: Contains Invalid Rows' }),
  ).toBeInTheDocument();
  expect(card('Product L').getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
});

it('keeps the draft and shows the server message when Submit is refused', async () => {
  const user = userEvent.setup();
  vi.mocked(submitBuqForecast).mockRejectedValue(
    httpError(400, { messageKey: 'buq.error', message: 'Supervisory node is missing' }),
  );
  await renderEditor();

  await user.click(screen.getByRole('button', { name: 'Page 2' }));
  await screen.findByText('Product L');
  await user.click(card('Product L').getByRole('combobox'));
  await user.click(await screen.findByRole('option', { name: 'Outbreaks' }));
  await user.click(screen.getByRole('button', { name: 'buq.forecast.submit' }));
  const confirm = await screen.findByRole('alertdialog');
  await user.click(within(confirm).getByRole('button', { name: 'buq.forecast.submit' }));

  const failure = await screen.findByRole('alertdialog');
  expect(failure).toHaveTextContent('Supervisory node is missing');
  await waitFor(() => expect(submitBuqForecast).toHaveBeenCalledTimes(1));
  await user.click(within(failure).getByRole('button', { name: 'dialog.close' }));
  expect(card('Product L').getByRole('combobox')).toHaveTextContent('Outbreaks');
});

const completeLastLine = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Page 2' }));
  await screen.findByText('Product L');
  await user.click(card('Product L').getByRole('combobox'));
  await user.click(await screen.findByRole('option', { name: 'Outbreaks' }));
};

it('sends nothing when the report moved on since the page opened', async () => {
  const user = userEvent.setup();
  vi.mocked(fetchBuqForecast).mockResolvedValue({ ...FORECAST, status: 'AUTHORIZED' });
  await renderEditor();

  await user.click(screen.getByRole('button', { name: 'buq.forecast.save' }));

  const failure = await screen.findByRole('alertdialog');
  expect(failure).toHaveTextContent('buq.forecast.moved');
  expect(saveBuqForecast).not.toHaveBeenCalled();
});

it('sends Submit & Authorize to authorize when the program skips authorization', async () => {
  const user = userEvent.setup();
  vi.mocked(authorizeBuqForecast).mockResolvedValue({ ...FORECAST, status: 'AUTHORIZED' });
  await renderEditor({ mode: { ...CREATE, skipAuthorization: true } });
  await completeLastLine(user);

  await user.click(screen.getByRole('button', { name: 'buq.forecast.submit-and-authorize' }));
  const confirm = await screen.findByRole('alertdialog');
  await user.click(
    within(confirm).getByRole('button', { name: 'buq.forecast.submit-and-authorize' }),
  );

  await waitFor(() => expect(authorizeBuqForecast).toHaveBeenCalledTimes(1));
  expect(submitBuqForecast).not.toHaveBeenCalled();
});

it('approves the forecast exactly as loaded, without letting the approver edit it', async () => {
  const user = userEvent.setup();
  const onDone = vi.fn();
  vi.mocked(fetchBuqForecast).mockResolvedValue(AUTHORIZED);
  vi.mocked(approveBuqForecast).mockResolvedValue({ ...AUTHORIZED, status: 'IN_APPROVAL' });
  await renderEditor({ forecast: AUTHORIZED, mode: { kind: 'approve' }, onDone });

  expect(verified('Product A')).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'buq.forecast.save' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'buq.approve.approve' }));
  const confirm = await screen.findByRole('alertdialog');
  await user.click(within(confirm).getByRole('button', { name: 'buq.approve.approve' }));

  await waitFor(() => expect(onDone).toHaveBeenCalled());
  expect(approveBuqForecast).toHaveBeenCalledWith(AUTHORIZED);
});

it('rejects with the chosen reasons and comment once a reason is picked', async () => {
  const user = userEvent.setup();
  const onDone = vi.fn();
  vi.mocked(rejectBuqForecast).mockResolvedValue({ ...AUTHORIZED, status: 'REJECTED' });
  await renderEditor({ forecast: AUTHORIZED, mode: { kind: 'approve' }, onDone });

  await user.click(screen.getByRole('button', { name: 'buq.approve.reject' }));
  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: 'buq.approve.reject' }));
  expect(await within(dialog).findByText('buq.approve.reject-reasons-required')).toBeVisible();
  expect(rejectBuqForecast).not.toHaveBeenCalled();

  await user.click(within(dialog).getByRole('combobox', { name: /buq.approve.reject-reasons/ }));
  await user.click(await screen.findByRole('option', { name: 'Wrong quantities' }));
  await user.type(screen.getByLabelText('buq.approve.reject-comments'), 'Too high');
  await user.click(within(dialog).getByRole('button', { name: 'buq.approve.reject' }));

  await waitFor(() => expect(onDone).toHaveBeenCalled());
  expect(rejectBuqForecast).toHaveBeenCalledWith('b1', {
    rejectionReasons: ['x1'],
    generalComments: 'Too high',
  });
});
